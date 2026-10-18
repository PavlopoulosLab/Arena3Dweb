import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// NORMA-2.0 group layouts: clusters within layers, layers as groups (floors
// placed and angled), and 3D local layouts inside sphere layers.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')
const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

type Ctx = {
  layers: {
    plane: {
      quaternion: { x: number; y: number; z: number; w: number }
      position: { x: number; y: number; z: number }
    }
  }[]
  nodeObjects: {
    cluster: string
    layer: string
    getPosition: (a: string) => number
  }[]
}
const read = (page: Page) =>
  page.evaluate(() => {
    const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    return {
      quats: ctx.layers.map((l) =>
        [
          l.plane.quaternion.x,
          l.plane.quaternion.y,
          l.plane.quaternion.z,
          l.plane.quaternion.w,
        ]
          .map((v) => v.toFixed(3))
          .join()
      ),
      pos: ctx.layers.map((l) =>
        [l.plane.position.x, l.plane.position.y, l.plane.position.z]
          .map(Math.round)
          .join()
      ),
      deep: ctx.nodeObjects.filter((n) => Math.abs(n.getPosition('x')) > 1)
        .length,
      clusters: ctx.nodeObjects.filter((n) => n.cluster !== '').length,
    }
  })

// the Clustering panel, then back to the Layout panel's Group Layout card
async function findCommunities(page: Page) {
  await tab(page, 'Clustering')
  await page.locator('#clusterAlgorithm').selectOption('Louvain')
  await page.locator('#runClustering').dispatchEvent('click')
  await expect(page.locator('#cluster_status')).toContainText(
    'nodes coloured by community',
    { timeout: 60_000 }
  )
  await tab(page, 'Layout')
}

async function setup(page: Page) {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page.getByRole('tab', { name: 'File', exact: true }).click()
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  await tab(page, 'Layout')
  await page.locator('#groupLayoutCard summary').click()
}

test('clusters as groups, then layers as groups (placed + angled)', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await setup(page)
  // no clusters yet -> clear message
  await expect(page.locator('#groupNoClusters')).toBeVisible()
  await page.locator('#runGroupLayout').click()
  await expect(page.locator('#layouts_status')).toContainText('No clusters yet')

  await findCommunities(page)
  expect((await read(page)).clusters).toBe(255)
  await expect(page.locator('#groupNoClusters')).toBeHidden()

  for (const strategy of ['virtual', 'gravity', 'supernodes']) {
    await page.locator('#groupStrategy').selectOption(strategy)
    await page.locator('#runGroupLayout').click()
    await expect(page.locator('#layouts_status')).toContainText(
      'Groups laid out'
    )
  }
  await tab(page, '3D View')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/group-supernodes.png' })

  await tab(page, 'Layout')
  const before = await read(page)
  await page.locator('#groupSource').selectOption('layers')
  await page.locator('#runGroupLayout').click()
  await expect(page.locator('#layouts_status')).toContainText(
    '4 layers placed and angled'
  )
  const after = await read(page)
  expect(new Set(after.quats).size).toBeGreaterThan(1) // floors turned differently
  expect(after.pos).not.toEqual(before.pos)
  await tab(page, '3D View')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/group-layers.png' })
  // placement + the camera fit that follows it (committed after its 350 ms animation)
  await page.waitForTimeout(600)
  await page.evaluate(() => {
    const h = (
      window as unknown as { __arena: { history: { undo: () => void } } }
    ).__arena.history
    h.undo() // camera fit
    h.undo() // layers as groups
  })
  expect((await read(page)).pos).toEqual(before.pos)
})

test('sphere layers get 3D local layouts inside each group', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await setup(page)
  await tab(page, 'Layers')
  await page.locator('#layerContainer').selectOption('sphere')
  await page.locator('#applyLayerContainer').click()
  await expect(page.locator('#layer_status')).toContainText(
    'Layers set to sphere'
  )
  await findCommunities(page)
  await page.locator('#groupStrategy').selectOption('supernodes')
  // Kamada-Kawai is disabled as a 3D group-local layout (igraph bug — see
  // actions/group_layout.ts's UNSAFE_3D_LOCAL_LAYOUTS); sphere layers force
  // 3D here, so it should be unselectable. Circle still proves the point (a
  // genuine 3D placement inside each group's sphere).
  await expect(
    page.locator('#groupLocal option[value="Kamada-Kawai"]')
  ).toBeDisabled()
  await page.locator('#groupLocal').selectOption('Circle')
  await page.locator('#runGroupLayout').click()
  await expect(page.locator('#layouts_status')).toContainText('in 3D')
  expect((await read(page)).deep).toBeGreaterThan(100)
  await tab(page, '3D View')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/group-spheres.png' })
})
