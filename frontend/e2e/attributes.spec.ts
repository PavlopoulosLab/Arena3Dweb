import { expect, test, type Page } from './fixtures'
import os from 'node:os'
import path from 'node:path'

// Edit → Attributes: the node and edge tables (edit one node, bulk-edit a
// lasso selection and ticked rows, edge colour and width, undo, a session
// round trip), the inspector (right-click → Edit Attributes on a node and on
// an edge, Alt + double-click) and the attribute files it exports, loaded
// back through File.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

type N = {
  name: string
  layer: string
  isSelected: boolean
  shape: string
  alpha: number
  label: string
  descr: string
  importedColor: string
  getScale: () => number
  getWorldPosition: (a: string) => number
}
type E = {
  interLayer: boolean
  isSelected: boolean
  colors: string[]
  widthFactor: number
  lineType: string
  sourceNodeIndex: number
  targetNodeIndex: number
}
type Ctx = {
  xBoundMax: number
  yBoundMax: number
  nodeObjects: N[]
  edgeObjects: E[]
}
type Arena = {
  ctx: Ctx
  history: { undo: () => void; redo: () => void }
  executeCommand: (i: number, option: string) => void
}
type W = { __arena: Arena } // page.evaluate runs in the page: no helpers

async function load(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
}

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

async function openAttributes(page: Page): Promise<void> {
  await tab(page, 'Attributes')
  await expect(page.locator('#panel-attributes')).toHaveClass(/show/)
}

const undo = (page: Page) =>
  page.evaluate(() => (window as unknown as W).__arena.history.undo())

// "<name> (<layer>)", as the table's controls are labelled
const who = (page: Page, i: number) =>
  page.evaluate((i) => {
    const n = (window as unknown as W).__arena.ctx.nodeObjects[i]
    return `${n.name} (${n.layer})`
  }, i)

test('node table: one node, a lasso selection and ticked rows, undo, session', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await load(page)
  await openAttributes(page)
  await expect(page.locator('#attrNodeSummary')).toHaveText(
    '255 of 255 nodes · 0 ticked'
  )
  // only the rows in view are drawn
  expect(
    await page.locator('#attrNodeTable .attr-body .attr-row').count()
  ).toBeLessThan(80)

  // one node: its own row
  const first = await who(page, 0)
  await page.getByLabel(`Shape of ${first}`).selectOption('box')
  await page.getByLabel(`Size of ${first}`).fill('2.5')
  await page.getByLabel(`Size of ${first}`).press('Enter')
  await page.getByLabel(`Label of ${first}`).fill('Hub')
  await page.getByLabel(`Label of ${first}`).press('Enter')
  await page.getByLabel(`Colour of ${first}`).fill('#00ff00')
  const one = await page.evaluate(() => {
    const ns = (window as unknown as W).__arena.ctx.nodeObjects
    return {
      shape: ns[0].shape,
      scale: ns[0].getScale(),
      label: ns[0].label,
      color: ns[0].importedColor,
      boxes: ns.filter((n) => n.shape === 'box').length,
    }
  })
  expect(one).toEqual({
    shape: 'box',
    scale: 2.5,
    label: 'Hub',
    color: '#00ff00',
    boxes: 1,
  })
  await expect(page.locator('#attr_status')).toContainText('Set the colour of')

  // filter and sort: the layer's nodes, by name, descending
  await page.locator('#attrNodeLayer').selectOption('Layer2')
  await expect(page.locator('#attrNodeSummary')).toContainText('80 of 255')
  await page.locator('#attrNodeTable [data-sort="name"]').click()
  await page.locator('#attrNodeTable [data-sort="name"]').click()
  await expect(
    page.locator('#attrNodeTable [data-col="name"]')
  ).toHaveAttribute('aria-sort', 'descending')
  await page.locator('#attrNodeTable [data-sort="name"]').click() // as loaded
  await page.locator('#attrNodeLayer').selectOption('')

  // a lasso (rectangle) selection in the scene ticks its rows
  await tab(page, '3D View')
  await page.waitForTimeout(300)
  const box = (await page.locator('#app canvas').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.keyboard.down('Shift')
  await page.mouse.move(cx - 220, cy - 160)
  await page.mouse.down()
  await page.mouse.move(cx + 120, cy + 160, { steps: 15 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  const lassoed = await page.evaluate(
    () =>
      (window as unknown as W).__arena.ctx.nodeObjects.filter(
        (n) => n.isSelected
      ).length
  )
  expect(lassoed).toBeGreaterThan(3)
  await openAttributes(page)
  await page.locator('#attrNodeSelectedOnly').check()
  await expect(page.locator('#attrNodeSummary')).toHaveText(
    `${lassoed} of 255 nodes · ${lassoed} ticked — editing a ticked row changes all ${lassoed}`
  )
  // a change to one ticked row changes them all, as one undo step
  const row = page.locator('#attrNodeTable .attr-body .attr-row').first()
  await row.locator('[data-f="alpha"]').fill('0.4')
  await row.locator('[data-f="alpha"]').press('Enter')
  const faded = () =>
    page.evaluate(
      () =>
        (window as unknown as W).__arena.ctx.nodeObjects.filter(
          (n) => n.alpha === 0.4
        ).length
    )
  expect(await faded()).toBe(lassoed)
  await expect(page.locator('#attr_status')).toContainText(
    `of ${lassoed} nodes (one undo step)`
  )
  await undo(page)
  expect(await faded()).toBe(0)
  await expect(row.locator('[data-f="alpha"]')).toHaveValue('1')
  await page.evaluate(() => (window as unknown as W).__arena.history.redo())
  expect(await faded()).toBe(lassoed)

  // ticking rows: the scene selection follows; Shift ticks a run
  await page.locator('#attrNodeSelectedOnly').uncheck()
  await page.locator('#attrNodeTickAll').check() // all …
  await page.locator('#attrNodeTickAll').uncheck() // … and none
  expect(
    await page.evaluate(
      () =>
        (window as unknown as W).__arena.ctx.nodeObjects.filter(
          (n) => n.isSelected
        ).length
    )
  ).toBe(0)
  // rows 1 and 3 of the list (aria-rowindex 1 is the header)
  const at = (k: number) =>
    page.locator(`#attrNodeTable .attr-row[aria-rowindex="${k + 2}"]`)
  await at(1).locator('[data-f="tick"]').check()
  await at(3)
    .locator('[data-f="tick"]')
    .click({ modifiers: ['Shift'] })
  await expect(at(2).locator('[data-f="tick"]')).toBeChecked()
  const selected = () =>
    page.evaluate(() =>
      (window as unknown as W).__arena.ctx.nodeObjects.flatMap((n, i) =>
        n.isSelected ? [i] : []
      )
    )
  expect(await selected()).toEqual([1, 2, 3])
  await at(2).locator('[data-f="descr"]').fill('Kinase')
  await at(2).locator('[data-f="descr"]').press('Enter')
  expect(
    await page.evaluate(() =>
      (window as unknown as W).__arena.ctx.nodeObjects.flatMap((n, i) =>
        n.descr === 'Kinase' ? [i] : []
      )
    )
  ).toEqual([1, 2, 3])

  // a selection in the scene ticks rows too
  await page.evaluate(() =>
    (window as unknown as W).__arena.executeCommand(0, 'Select Neighbors')
  )
  const now = (await selected()).length
  expect(now).toBeGreaterThan(3)
  await expect(page.locator('#attrNodeSummary')).toContainText(
    `· ${now} ticked`
  )

  // session round trip
  await tab(page, 'File')
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#save_network_object').click(),
  ])
  const file = path.join(os.tmpdir(), 'arena3d-e2e-attributes.json')
  await dl.saveAs(file)
  await page.reload()
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#load_network_file').setInputFiles(file)
  await expect(page.locator('#file_status')).toContainText('Session loaded')
  const back = await page.evaluate(() => {
    const ns = (window as unknown as W).__arena.ctx.nodeObjects
    return {
      shape: ns[0].shape,
      scale: ns[0].getScale(),
      label: ns[0].label,
      faded: ns.filter((n) => n.alpha === 0.4).length,
      kinases: ns.filter((n) => n.descr === 'Kinase').length,
    }
  })
  expect(back).toEqual({
    shape: 'box',
    scale: 2.5,
    label: 'Hub',
    faded: lassoed,
    kinases: 3,
  })
  await openAttributes(page)
  await expect(page.getByLabel(`Label of ${first}`)).toHaveValue('Hub')
})

test('edge table: colour and width of inter-layer edges, undo, session', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await load(page)
  await openAttributes(page)
  await page.locator('#attrShowEdges').click()
  await expect(page.locator('#attrEdges')).toBeVisible()
  await page.locator('#attrEdgeKind').selectOption('inter')
  const inter = await page.evaluate(
    () =>
      (window as unknown as W).__arena.ctx.edgeObjects.filter(
        (e) => e.interLayer
      ).length
  )
  await expect(page.locator('#attrEdgeSummary')).toHaveText(
    `${inter} of 437 edges · 0 ticked`
  )

  // one edge
  const row = page.locator('#attrEdgeTable .attr-row[aria-rowindex="2"]')
  await row.locator('[data-f="lineType"]').selectOption('dashed')
  expect(
    await page.evaluate(
      () =>
        (window as unknown as W).__arena.ctx.edgeObjects.filter(
          (e) => e.lineType === 'dashed'
        ).length
    )
  ).toBe(1)

  // every inter-layer edge: tick them all, then edit one
  await page.locator('#attrEdgeTickAll').check()
  await expect(page.locator('#attrEdgeSummary')).toContainText(
    `${inter} ticked`
  )
  await row.locator('[data-f="color"]').fill('#ff00ff')
  await row.locator('[data-f="width"]').fill('3')
  await row.locator('[data-f="width"]').press('Enter')
  const look = () =>
    page.evaluate(() => {
      const es = (window as unknown as W).__arena.ctx.edgeObjects
      return {
        magenta: es.filter((e) => e.colors.every((c) => c === '#ff00ff'))
          .length,
        wide: es.filter((e) => e.widthFactor === 3).length,
        interMagenta: es.filter(
          (e) => e.interLayer && e.colors[0] === '#ff00ff'
        ).length,
      }
    })
  expect(await look()).toEqual({
    magenta: inter,
    wide: inter,
    interMagenta: inter,
  })
  // the width was one step, the colour another
  await undo(page)
  expect(await look()).toEqual({ magenta: inter, wide: 0, interMagenta: inter })
  await expect(row.locator('[data-f="width"]')).toHaveValue('1')
  await page.evaluate(() => (window as unknown as W).__arena.history.redo())

  await page.locator('#attrEdgeTickAll').uncheck()
  await page.screenshot({ path: 'test-results/attributes-edges.png' })

  await tab(page, 'File')
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#save_network_object').click(),
  ])
  const file = path.join(os.tmpdir(), 'arena3d-e2e-attributes-edges.json')
  await dl.saveAs(file)
  await page.reload()
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#load_network_file').setInputFiles(file)
  await expect(page.locator('#file_status')).toContainText('Session loaded')
  const back = await look()
  expect(back.wide).toBe(inter)
  expect(back.interMagenta).toBe(inter)
})

test('inspector: right-click a node or an edge, Alt + double-click', async ({
  page,
}) => {
  await load(page)
  await tab(page, '3D View')
  await page.waitForTimeout(300)
  const card = page.locator('#attrInspector')

  // a node's place in the window, where nothing covers the canvas
  // (navigation controls, legend, minimap); right-clicks are real clicks,
  // as the menu reads the event's layerX / layerY
  const node = await page.evaluate(() => {
    const c = (window as unknown as W).__arena.ctx
    const canvas = document.querySelector('#app canvas')!
    const r = canvas.getBoundingClientRect()
    for (let i = 0; i < c.nodeObjects.length; i++) {
      const n = c.nodeObjects[i]
      const x = r.left + c.xBoundMax + n.getWorldPosition('x')
      const y = r.top + c.yBoundMax - n.getWorldPosition('y')
      if (document.elementFromPoint(x, y) === canvas) return { i, x, y }
    }
    return null
  })
  expect(node).not.toBeNull()
  const { i } = node!

  // right-click on a node → Edit Attributes
  await page.mouse.click(node!.x, node!.y, { button: 'right' })
  const menu = page.locator('select.optionsBox')
  await menu.selectOption('Edit Attributes…')
  await expect(card).toBeVisible()
  await expect(menu).toHaveCount(0) // it would cover the inspector
  await expect(card).toHaveAttribute('data-kind', 'node')
  const title = await page.locator('#attrInspectorTitle').textContent()
  await page.locator('#inspNodeSize').fill('3')
  await page.locator('#inspNodeSize').press('Enter')
  await page.locator('#inspNodeShape').selectOption('diamond')
  await page.locator('#inspNodeDescr').fill('Seen in the inspector')
  await page.locator('#inspNodeDescr').press('Enter')
  // the node in front at that spot (floors overlap in 3D): the one named
  const edited = await page.evaluate(() =>
    (window as unknown as W).__arena.ctx.nodeObjects
      .filter((n) => n.descr === 'Seen in the inspector')
      .map((n) => [n.name, n.getScale(), n.shape])
  )
  expect(edited).toEqual([[title, 3, 'diamond']])
  // an undo shows in the inspector
  await undo(page)
  await expect(page.locator('#inspNodeDescr')).toHaveValue('')
  await card.press('Escape')
  await expect(card).toBeHidden()

  // Alt + double-click on a node opens it too, and selects nothing
  await page.keyboard.down('Alt')
  await page.mouse.dblclick(node!.x, node!.y)
  await page.keyboard.up('Alt')
  await expect(card).toBeVisible()
  await expect(page.locator('#attrInspectorTitle')).toHaveText(title!)
  expect(
    await page.evaluate(
      () =>
        (window as unknown as W).__arena.ctx.nodeObjects.filter(
          (n) => n.isSelected
        ).length
    )
  ).toBe(0)
  expect(i).toBeGreaterThanOrEqual(0)
  await card.locator('[data-act="close"]').click()
  await expect(card).toBeHidden()

  // right-click on an edge, away from every node and every other edge →
  // Edit Edge Attributes
  const edge = await page.evaluate(() => {
    const c = (window as unknown as W).__arena.ctx
    const canvas = document.querySelector('#app canvas')!
    const r = canvas.getBoundingClientRect()
    const pos = c.nodeObjects.map((n) => [
      r.left + c.xBoundMax + n.getWorldPosition('x'),
      r.top + c.yBoundMax - n.getWorldPosition('y'),
    ])
    const toEdge = (x: number, y: number, k: number) => {
      const e = c.edgeObjects[k]
      const [a, b] = [pos[e.sourceNodeIndex], pos[e.targetNodeIndex]]
      const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
      const len = dx * dx + dy * dy
      const t = len
        ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len))
        : 0
      return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)
    }
    for (let k = 0; k < c.edgeObjects.length; k++) {
      const e = c.edgeObjects[k]
      const [a, b] = [pos[e.sourceNodeIndex], pos[e.targetNodeIndex]]
      for (const t of [0.3, 0.4, 0.5, 0.6, 0.7]) {
        const x = a[0] + (b[0] - a[0]) * t
        const y = a[1] + (b[1] - a[1]) * t
        if (
          document.elementFromPoint(x, y) === canvas &&
          pos.every(([px, py]) => Math.hypot(px - x, py - y) > 20) &&
          c.edgeObjects.every((_, j) => j === k || toEdge(x, y, j) > 10)
        )
          return { k, x, y }
      }
    }
    return null
  })
  expect(edge).not.toBeNull()
  await page.mouse.click(edge!.x, edge!.y, { button: 'right' })
  await menu.selectOption({ label: 'Edit Edge Attributes…' })
  await expect(card).toHaveAttribute('data-kind', 'edge')
  await page.locator('#inspEdgeColor').fill('#00ffff')
  await page.locator('#inspEdgeWidth').fill('4')
  await page.locator('#inspEdgeWidth').press('Enter')
  const e = await page.evaluate((k) => {
    const ed = (window as unknown as W).__arena.ctx.edgeObjects[k]
    return [ed.colors[0], ed.widthFactor]
  }, edge!.k)
  expect(e).toEqual(['#00ffff', 4])
  // Show in table: the edge's row, in the Edges table
  await card.locator('[data-act="table"]').click()
  await expect(page.locator('#panel-attributes')).toHaveClass(/show/)
  await expect(page.locator('#attrEdges')).toBeVisible()
  await expect(
    page.locator(
      `#attrEdgeTable .attr-row[data-i="${edge!.k}"] [data-f="width"]`
    )
  ).toHaveValue('4')
})

test('exported attribute files load back through File', async ({ page }) => {
  await load(page)
  await openAttributes(page)
  const first = await who(page, 0)
  await page.getByLabel(`Shape of ${first}`).selectOption('cone')
  await page.getByLabel(`Opacity of ${first}`).fill('0.6')
  await page.getByLabel(`Opacity of ${first}`).press('Enter')
  await page.getByLabel(`Label of ${first}`).fill('Exported')
  await page.getByLabel(`Label of ${first}`).press('Enter')
  await page.locator('#attrShowEdges').click()
  const row = page.locator('#attrEdgeTable .attr-row[aria-rowindex="2"]')
  await row.locator('[data-f="lineType"]').selectOption('dotted')
  await row.locator('[data-f="width"]').fill('2')
  await row.locator('[data-f="width"]').press('Enter')

  const save = async (button: string, name: string) => {
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.locator(button).click(),
    ])
    expect(dl.suggestedFilename()).toBe(name)
    const file = path.join(os.tmpdir(), `arena3d-e2e-${name}`)
    await dl.saveAs(file)
    return file
  }
  const nodesFile = await save('#attrExportNodes', 'node_attributes.tsv')
  const edgesFile = await save('#attrExportEdges', 'edge_attributes.tsv')

  // a fresh copy of the network, then the two files
  await load(page)
  await tab(page, 'File')
  await page.locator('#node_attributes_file').setInputFiles(nodesFile)
  await expect(page.locator('#file_status')).toContainText(
    'Node attributes applied'
  )
  await page.locator('#edge_attributes_file').setInputFiles(edgesFile)
  await expect(page.locator('#file_status')).toContainText(
    'Edge attributes applied'
  )
  const back = await page.evaluate(() => {
    const c = (window as unknown as W).__arena.ctx
    const n = c.nodeObjects[0]
    return {
      node: [n.shape, n.alpha, n.label],
      cones: c.nodeObjects.filter((m) => m.shape === 'cone').length,
      dotted: c.edgeObjects.filter((e) => e.lineType === 'dotted').length,
      wide: c.edgeObjects.filter((e) => e.widthFactor === 2).length,
    }
  })
  expect(back).toEqual({
    node: ['cone', 0.6, 'Exported'],
    cones: 1,
    dotted: 1,
    wide: 1,
  })
})
