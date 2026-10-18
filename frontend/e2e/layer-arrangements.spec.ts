import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// PLAN-ROADMAP Phase 4 (+16): new layer arrangements, split a layer by
// cluster, merge layers, lift nodes by degree.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

type Ctx = {
  layers: {
    name: string
    plane: { position: { x: number; y: number; z: number } }
  }[]
  nodeObjects: { getPosition: (a: string) => number }[]
}
async function load(page: Page) {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
}

const layerPositions = (page: Page) =>
  page.evaluate(() => {
    const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    return ctx.layers.map((l) =>
      [l.plane.position.x, l.plane.position.y, l.plane.position.z].map((v) =>
        Math.round(v)
      )
    )
  })

test('new arrangements move the layers and undo', async ({ page }) => {
  await load(page)
  await page
    .getByRole('tab', {
      name: 'Scene & Camera',
      includeHidden: true,
      exact: true,
    })
    .dispatchEvent('click')
  const parallel = await layerPositions(page)
  for (const v of ['helix', 'sphere', 'grid', 'connectivity']) {
    await page.locator(`#predef_${v}`).dispatchEvent('click')
    const now = await layerPositions(page)
    expect(now, v).not.toEqual(parallel)
    if (v === 'sphere' || v === 'connectivity') {
      await page
        .getByRole('tab', { name: '3D View', includeHidden: true, exact: true })
        .dispatchEvent('click')
      await page.waitForTimeout(500)
      await page.screenshot({ path: `test-results/arrangement-${v}.png` })
      await page
        .getByRole('tab', {
          name: 'Scene & Camera',
          includeHidden: true,
          exact: true,
        })
        .dispatchEvent('click')
    }
  }
  // undo the four arrangements -> back to parallel
  await page.evaluate(() => {
    const h = (
      window as unknown as { __arena: { history: { undo: () => void } } }
    ).__arena.history
    for (let i = 0; i < 4; i++) h.undo()
  })
  expect(await layerPositions(page)).toEqual(parallel)
})

test('split by cluster, merge, lift by degree', async ({ page }) => {
  await load(page)
  const layerNames = () =>
    page.evaluate(() =>
      (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx.layers.map(
        (l) => l.name
      )
    )
  const before = await layerNames()

  // cluster the first layer
  await page
    .getByRole('tab', { name: 'Layout', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#checkbox_0').dispatchEvent('click')
  for (const [sel, v] of [
    ['#layoutAlgorithmChoice', 'Fruchterman-Reingold'],
    ['#clusteringAlgorithmChoice', 'Louvain'],
  ])
    await page.locator(sel).evaluate((el, value) => {
      ;(el as HTMLSelectElement).value = value
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }, v)
  await page.locator('#runLayout').dispatchEvent('click')
  await expect(page.locator('#layouts_status')).toHaveText('Layout applied.')

  await page
    .getByRole('tab', { name: 'Layers', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#splitLayerByCluster').dispatchEvent('click')
  await expect(page.locator('#layer_status')).toContainText('Split')
  const split = await layerNames()
  expect(split.length).toBeGreaterThan(before.length)
  expect(split.filter((n) => n.startsWith(`${before[0]} · C`)).length).toBe(
    split.length - before.length + 1
  )

  // merge the first two layers of the split network
  await page
    .getByRole('tab', { name: 'Layout', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#checkbox_0').dispatchEvent('click')
  await page.locator('#checkbox_1').dispatchEvent('click')
  await page
    .getByRole('tab', { name: 'Layers', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#mergeSelectedLayers').dispatchEvent('click')
  await expect(page.locator('#layer_status')).toContainText('Merged 2 layers')
  expect((await layerNames()).length).toBe(split.length - 1)

  await page.locator('#liftNodesByDegree').dispatchEvent('click')
  const depths = await page.evaluate(() =>
    (
      window as unknown as { __arena: { ctx: Ctx } }
    ).__arena.ctx.nodeObjects.map((n) => n.getPosition('x'))
  )
  expect(Math.max(...depths)).toBeCloseTo(150)

  // undo the merge restores the split network (store sync fix)
  await page.evaluate(() => {
    const h = (
      window as unknown as { __arena: { history: { undo: () => void } } }
    ).__arena.history
    h.undo() // lift
    h.undo() // merge
  })
  expect(await layerNames()).toEqual(split)
})
