import { expect, test } from './fixtures'
import os from 'node:os'
import path from 'node:path'

// PLAN-ROADMAP Phase 24: Style panel — node/edge editing, palettes,
// colour-blind mode, CVD preview; shapes and widths survive a session save.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

type Ctx = {
  nodeObjects: {
    layer: string
    color: string
    shape: string
    getScale: () => number
  }[]
  edgeObjects: { widthFactor: number; interLayer: boolean }[]
}
const snap = () => {
  const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
  return {
    colors: [...new Set(ctx.nodeObjects.map((n) => n.color))].length,
    shapes: [...new Set(ctx.nodeObjects.map((n) => n.shape))].sort(),
    layer1: ctx.nodeObjects
      .filter((n) => n.layer === 'Layer1')
      .map((n) => [n.color, n.getScale(), n.shape].join()),
    wide: ctx.edgeObjects.filter((e) => e.widthFactor === 3).length,
    inter: ctx.edgeObjects.filter((e) => e.interLayer).length,
  }
}

test('style panel edits, palettes, colour-blind mode, CVD preview, session', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  await page
    .getByRole('tab', { name: 'Style', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#styleNodeTarget').selectOption('layer:Layer1')
  await page.locator('#styleNodeColor').fill('#ff00aa')
  await page.locator('#styleNodeColorApply').click()
  await page.locator('#styleNodeSize').fill('2')
  await page.locator('#styleNodeSizeApply').click()
  await page.locator('#styleNodeShape').selectOption('tetrahedron')
  await page.locator('#styleNodeShapeApply').click()
  const s1 = await page.evaluate(snap)
  expect(new Set(s1.layer1)).toEqual(new Set(['#ff00aa,2,tetrahedron']))

  await page.locator('#styleEdgeTarget').selectOption('inter')
  await page.locator('#styleEdgeWidth').fill('3')
  await page.locator('#styleEdgeWidthApply').click()
  expect((await page.evaluate(snap)).wide).toBe(s1.inter)

  await page.locator('#styleNodeTarget').selectOption('all')
  await page.locator('#styleColorBy').selectOption('degree')
  await expect(page.locator('#styleSequential')).toBeVisible()
  await page.locator('#styleSequential').selectOption('cividis')
  await page.locator('#styleColorByApply').click()
  await expect(page.locator('#style_status')).toContainText(
    'Coloured by degree'
  )
  expect((await page.evaluate(snap)).colors).toBeGreaterThan(3)

  await page.locator('#colorBlindMode').click()
  const cb = await page.evaluate(snap)
  expect(cb.colors).toBe(4) // one Okabe–Ito colour per layer
  expect(cb.shapes).toEqual(['box', 'cone', 'diamond', 'sphere'])

  await page.locator('#cvdSimulate').selectOption('deuteranopia')
  expect(
    await page.evaluate(() => document.querySelector('canvas')!.style.filter)
  ).toContain('cvd-deuteranopia')
  await page
    .getByRole('tab', { name: '3D View', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/style-cvd.png' })
  await page
    .getByRole('tab', { name: 'Style', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#cvdSimulate').selectOption('none')
  expect(
    await page.evaluate(() => document.querySelector('canvas')!.style.filter)
  ).toBe('')

  // session round trip keeps shapes and widths
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#save_network_object').click(),
  ])
  const file = path.join(os.tmpdir(), 'arena3d-e2e-style-session.json')
  await dl.saveAs(file)
  await page.reload()
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.locator('#load_network_file').setInputFiles(file)
  await expect(page.locator('#file_status')).toContainText('Session loaded')
  const back = await page.evaluate(snap)
  expect(back.shapes).toEqual(cb.shapes)
  expect(back.wide).toBe(cb.wide)
})
