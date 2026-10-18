import { expect, test, type Page } from './fixtures'

// Every change shows at once: after a layout the scene must not wait for a
// move to redraw (the edges between layers and the labels used to stay where
// the nodes had been), and a hive plot and 3D containers give way to each
// other cleanly, bringing back what they replaced.

type Arena = {
  __arena: {
    history: { undo: () => void }
    ctx: {
      scene: { sphere: { rotation: { y: number } } }
      hive: unknown
      layers: { container: string; floorShape: string }[]
      nodeObjects: { getPosition: (a: string) => number }[]
    }
  }
}

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

async function load(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page
    .locator('#input_network_file')
    .setInputFiles('public/data/figure2A_data.tsv')
  await expect(page.locator('#file_status')).toContainText('Loaded network')
}

// a scene "move" that leaves the view where it was: what dragging triggers
const nudge = (page: Page) =>
  page.evaluate(async () => {
    const s = (window as unknown as Arena).__arena.ctx.scene.sphere
    const frames = () =>
      new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    s.rotation.y += 1e-6
    await frames()
    s.rotation.y -= 1e-6
    await frames()
  })

async function settledShot(page: Page): Promise<Buffer> {
  await tab(page, '3D View')
  await page.waitForTimeout(1200)
  return page.screenshot()
}

test('the scene redraws when a layout finishes, without a move', async ({
  page,
}) => {
  await load(page)
  await tab(page, 'Layer selection')
  await page.locator('#selectAllLayersCheckbox').click()
  await tab(page, 'Layout')
  await page.locator('#layoutAlgorithmChoice').selectOption('Kamada-Kawai')
  await page.locator('#runLayout').click()
  await expect(page.locator('#layouts_status')).toContainText(
    'Layout applied',
    { timeout: 60_000 }
  )
  const before = await settledShot(page)
  await nudge(page)
  await page.waitForTimeout(800)
  // nothing was left for the move to fix
  expect(before.equals(await page.screenshot())).toBe(true)
})

test('a hive plot and 3D containers give way to each other', async ({
  page,
}) => {
  await load(page)
  const state = () =>
    page.evaluate(() => {
      const c = (window as unknown as Arena).__arena.ctx
      return {
        hive: !!c.hive,
        layers: c.layers.map((l) => `${l.container}/${l.floorShape}`),
        nodes: c.nodeObjects.map((n) =>
          ['x', 'y', 'z'].map((a) => Math.round(n.getPosition(a))).join(',')
        ),
      }
    })
  const arrange = async (name: string) => {
    await tab(page, 'Layout')
    await page
      .locator('#arrangementCard')
      .evaluate((el) => ((el as HTMLDetailsElement).open = true))
    await page.locator('#layerArrangement').selectOption(name)
    await page
      .locator('#layouts_status')
      .evaluate((el) => (el.textContent = ''))
    await page.locator('#applyArrangement').dispatchEvent('click')
    await expect(page.locator('#layouts_status')).not.toBeEmpty()
  }
  const container = async (kind: string) => {
    await tab(page, 'Layers')
    await page.locator('#layerContainer').selectOption(kind)
    await page.locator('#layer_status').evaluate((el) => (el.textContent = ''))
    await page.locator('#applyLayerContainer').click()
    await expect(page.locator('#layer_status')).not.toBeEmpty({
      timeout: 60_000,
    })
  }

  // a 3D container during a hive plot ends the plot first
  await arrange('hive')
  expect((await state()).layers.every((l) => l === 'floor/axis')).toBe(true)
  await container('sphere')
  await expect(page.locator('#layer_status')).toContainText('Hive plot ended')
  const spheres = await state()
  expect(spheres.hive).toBe(false)
  expect(spheres.layers.every((l) => l === 'sphere/square')).toBe(true)

  // a hive plot sets the spheres aside; leaving it brings them and the
  // nodes' places back
  await arrange('hive')
  const hive = await state()
  expect(hive.layers.every((l) => l === 'floor/axis')).toBe(true)
  await arrange('parallel')
  const back = await state()
  expect(back.hive).toBe(false)
  expect(back.layers).toEqual(spheres.layers)
  expect(back.nodes).toEqual(spheres.nodes)

  // undo returns to the hive plot, and once more to the spheres
  await page.evaluate(() => (window as unknown as Arena).__arena.history.undo())
  expect((await state()).layers.every((l) => l === 'floor/axis')).toBe(true)
  await page.evaluate(() => (window as unknown as Arena).__arena.history.undo())
  const undone = await state()
  expect(undone.layers).toEqual(spheres.layers)
  expect(undone.nodes).toEqual(spheres.nodes)
})
