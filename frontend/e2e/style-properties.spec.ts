import { expect, test } from './fixtures'
import os from 'node:os'
import path from 'node:path'

// Edit → Style property tables, after Cytoscape's Style panel: node opacity,
// border, proportions, label text / colour / size and description, edge
// opacity, line type and arrow colour — each undoable, shown in the Now
// column and kept in a saved session.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

type Ctx = {
  nodeLayerNames: string[]
  nodeObjects: {
    layer: string
    alpha: number
    borderColor: string
    borderWidth: number
    outline: object | null
    stretch: number[]
    label: string
    labelColor: string
    labelSize: number
    descr: string
    sphere: { scale: { y: number } }
    getLabel: () => string
  }[]
  edgeObjects: {
    interLayer: boolean
    opacityFactor: number
    lineType: string
    arrowColor: string
  }[]
}
type Arena = { ctx: Ctx; history: { undo: () => void; redo: () => void } }

// the first Layer1 node, and how many nodes / edges carry each change
const snap = () => {
  const ctx = (window as unknown as { __arena: Arena }).__arena.ctx
  const i = ctx.nodeObjects.findIndex((n) => n.layer === 'Layer1')
  const n = ctx.nodeObjects[i]
  const div = document.getElementById(`${ctx.nodeLayerNames[i]}_label`)
  return {
    alpha: n.alpha,
    border: [n.borderColor, n.borderWidth, n.outline !== null],
    stretch: n.stretch,
    height: n.sphere.scale.y,
    label: [n.getLabel(), div?.textContent, div?.style.fontSize],
    labelColor: n.labelColor,
    descr: n.descr,
    faded: ctx.nodeObjects.filter((m) => m.alpha < 1).length,
    dotted: ctx.edgeObjects.filter((e) => e.lineType === 'dotted').length,
    inter: ctx.edgeObjects.filter((e) => e.interLayer).length,
    halfEdges: ctx.edgeObjects.filter((e) => e.opacityFactor === 0.5).length,
    blueArrows: ctx.edgeObjects.filter((e) => e.arrowColor === '#0000ff')
      .length,
  }
}

test('style property tables: node and edge overrides, undo, Now column, session', async ({
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
  await expect(page.locator('#styleNodeCount')).toHaveText('50 nodes')
  const now = (key: string) =>
    page.locator(`#styleNodeProps [data-now="${key}"]`)
  await expect(now('alpha')).toHaveText('1')
  await expect(now('border')).toHaveText('none')

  await page.locator('#styleNodeAlpha').fill('0.6')
  await expect(page.locator('#styleNodeAlphaValue')).toHaveText('0.60')
  await page.locator('#styleNodeAlphaApply').click()
  await page.locator('#styleNodeBorderColor').fill('#ff0000')
  await page.locator('#styleNodeBorderWidth').fill('3')
  await page.locator('#styleNodeBorderApply').click()
  // unlocked: height alone
  await page.locator('#styleNodeStretchLock').uncheck()
  await page.locator('#styleNodeStretchH').fill('3')
  await page.locator('#styleNodeStretchApply').click()
  await page.locator('#styleNodeLabel').fill('Hub')
  await page.locator('#styleNodeLabelApply').click()
  await page.locator('#styleNodeLabelColor').fill('#00ff00')
  await page.locator('#styleNodeLabelColorApply').click()
  await page.locator('#styleNodeLabelSize').fill('20')
  await page.locator('#styleNodeLabelSizeApply').click()
  await page.locator('#styleNodeDescr').fill('A tumour suppressor')
  await page.locator('#styleNodeDescrApply').click()
  await expect(page.locator('#style_status')).toContainText(
    'Descriptions set (50)'
  )

  const s1 = await page.evaluate(snap)
  expect(s1.alpha).toBe(0.6)
  expect(s1.border).toEqual(['#ff0000', 3, true])
  expect(s1.stretch).toEqual([1, 3, 1])
  expect(s1.height).toBeCloseTo(3)
  expect(s1.label).toEqual(['Hub', 'Hub', '20px'])
  expect(s1.labelColor).toBe('#00ff00')
  expect(s1.descr).toBe('A tumour suppressor')
  expect(s1.faded).toBe(50)
  await expect(now('alpha')).toHaveText('0.6')
  await expect(now('border')).toHaveText('3')
  await expect(now('stretch')).toHaveText('1·3·1')
  await expect(now('label')).toHaveText('Hub')

  // every Set is its own undo step
  await page.evaluate(() =>
    (window as unknown as { __arena: Arena }).__arena.history.undo()
  )
  expect((await page.evaluate(snap)).descr).toBe('')
  await page.evaluate(() =>
    (window as unknown as { __arena: Arena }).__arena.history.redo()
  )
  expect((await page.evaluate(snap)).descr).toBe('A tumour suppressor')

  // the Now column says "mixed" when the targets differ
  await page.locator('#styleNodeTarget').selectOption('all')
  await expect(now('alpha')).toHaveText('mixed')
  await page.locator('#styleNodeTarget').selectOption('layer:Layer1')

  // locked: the three axes move together
  await page.locator('#styleNodeStretchLock').check()
  await page.locator('#styleNodeStretchW').fill('2')
  await expect(page.locator('#styleNodeStretchH')).toHaveValue('2')
  await expect(page.locator('#styleNodeStretchDValue')).toHaveText('2.0×')

  // Reset takes an override away
  await page.locator('#styleNodeLabelReset').click()
  const s2 = await page.evaluate(snap)
  expect(s2.label[0]).not.toBe('Hub')
  expect(s2.label[0]).toBe(s2.label[1])

  // edges
  await page.locator('#styleShowEdges').click()
  await page.locator('#styleEdgeTarget').selectOption('inter')
  await page.locator('#styleEdgeLineType').selectOption('dotted')
  await page.locator('#styleEdgeLineTypeApply').click()
  await page.locator('#styleEdgeOpacity').fill('0.5')
  await page.locator('#styleEdgeOpacityApply').click()
  await page.locator('#styleEdgeArrowColor').fill('#0000ff')
  await page.locator('#styleEdgeArrowApply').click()
  const s3 = await page.evaluate(snap)
  expect(s3.dotted).toBe(s3.inter)
  expect(s3.halfEdges).toBe(s3.inter)
  expect(s3.blueArrows).toBe(s3.inter)
  await expect(
    page.locator('#styleEdgeProps [data-now="lineType"]')
  ).toHaveText('· · ·')

  await page
    .getByRole('tab', { name: '3D View', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/style-properties.png' })

  // session round trip keeps every override
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#save_network_object').click(),
  ])
  const file = path.join(os.tmpdir(), 'arena3d-e2e-style-properties.json')
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
  expect(back.alpha).toBe(0.6)
  expect(back.border).toEqual(['#ff0000', 3, true])
  expect(back.stretch).toEqual([1, 3, 1])
  expect(back.labelColor).toBe('#00ff00')
  expect(back.descr).toBe('A tumour suppressor')
  expect(back.dotted).toBe(s3.inter)
  expect(back.halfEdges).toBe(s3.inter)
  expect(back.blueArrows).toBe(s3.inter)
})
