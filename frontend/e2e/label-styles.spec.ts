import { expect, test, type Page } from './fixtures'
import os from 'node:os'
import path from 'node:path'

// Node label styles (Edit → Style, Edit → Attributes, the inspector): a halo
// around the letters, a box, a shadow, bold, centred / above / below, and
// label colours apart from the nodes' — by layer and palette, against the
// node — each one undo step and kept in a saved session.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

type Look = { style: string; color: string; bold: boolean } | null
type N = {
  layer: string
  color: string
  labelColor: string
  labelLook: Look
  labelPosition: string
}
type Arena = {
  ctx: { nodeLayerNames: string[]; nodeObjects: N[] }
  history: { undo: () => void }
}
type W = { __arena: Arena } // page.evaluate runs in the page: no helpers

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

// the first node of a layer, and its label as drawn
const first = (page: Page, layer: string) =>
  page.evaluate((layer) => {
    const ctx = (window as unknown as W).__arena.ctx
    const i = ctx.nodeObjects.findIndex((n) => n.layer === layer)
    const n = ctx.nodeObjects[i]
    const div = document.getElementById(`${ctx.nodeLayerNames[i]}_label`)!
    const cs = getComputedStyle(div)
    return {
      look: n.labelLook,
      position: n.labelPosition,
      labelColor: n.labelColor,
      color: n.color,
      stroke: cs.getPropertyValue('-webkit-text-stroke-width'),
      paint: cs.getPropertyValue('paint-order'),
      weight: cs.fontWeight,
      transform: div.style.transform,
      box: cs.backgroundColor,
      shadow: cs.textShadow,
      shown: cs.display !== 'none',
    }
  }, layer)

const labelColors = (page: Page) =>
  page.evaluate(() => {
    const ctx = (window as unknown as W).__arena.ctx
    return Object.fromEntries(
      ctx.nodeObjects.map((n) => [n.layer, n.labelColor] as const)
    )
  })

test('label styles, positions and label colours: Style, Attributes, inspector, session', async ({
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
  // every label on screen (Edit → Nodes → Show Labels: All)
  await page.evaluate(() => document.getElementById('nodeLabels_all')!.click())

  await tab(page, 'Style')
  await page.locator('#styleNodeTarget').selectOption('layer:Layer1')
  // halo is offered first; its width shows, the box opacity does not
  await expect(page.locator('#styleNodeLabelLook')).toHaveValue('halo')
  await expect(page.locator('#styleNodeLabelHalo')).toBeVisible()
  await expect(page.locator('#styleNodeLabelBox')).toBeHidden()
  await page.locator('#styleNodeLabelBold').check()
  await page.locator('#styleNodeLabelHalo').fill('3')
  await page.locator('#styleNodeLabelLookApply').click()
  await page.locator('#styleNodeLabelPosition').selectOption('centre')
  await page.locator('#styleNodeLabelPositionApply').click()
  await expect(page.locator('#style_status')).toContainText(
    'Label position set (50)'
  )
  const halo = await first(page, 'Layer1')
  expect(halo.look).toMatchObject({ style: 'halo', color: '', bold: true })
  expect(halo.position).toBe('centre')
  expect(halo.shown).toBe(true)
  expect(halo.stroke).toBe('6px') // twice the outline: half sits under the fill
  expect(halo.paint).toContain('stroke')
  expect(halo.weight).toBe('700')
  expect(halo.transform).toContain('translate')
  const now = (key: string) =>
    page.locator(`#styleNodeProps [data-now="${key}"]`)
  await expect(now('labelLook')).toHaveText('halo')
  await expect(now('labelPosition')).toHaveText('Centre')

  // a box with its own colour on Layer2, a shadow on Layer3
  await page.locator('#styleNodeTarget').selectOption('layer:Layer2')
  await page.locator('#styleNodeLabelLook').selectOption('box')
  await expect(page.locator('#styleNodeLabelBox')).toBeVisible()
  await expect(page.locator('#styleNodeLabelHalo')).toBeHidden()
  await page.locator('#styleNodeLabelLookColor').fill('#ffff00')
  await expect(page.locator('#styleNodeLabelLookAuto')).not.toBeChecked()
  await page.locator('#styleNodeLabelBold').uncheck()
  await page.locator('#styleNodeLabelLookApply').click()
  const box = await first(page, 'Layer2')
  expect(box.look).toMatchObject({ style: 'box', color: '#ffff00' })
  expect(box.box).toMatch(/^rgba\(255, 255, 0, 0\.75\)$/)
  expect(box.stroke).toBe('0px')
  await page.locator('#styleNodeTarget').selectOption('layer:Layer3')
  await page.locator('#styleNodeLabelLook').selectOption('shadow')
  await page.locator('#styleNodeLabelLookApply').click()
  expect((await first(page, 'Layer3')).shadow).not.toBe('none')

  // label colours by layer with a palette: one per layer, nodes untouched
  await page.locator('#styleNodeTarget').selectOption('all')
  await page.locator('#styleLabelColorBy').selectOption('layer')
  await page.locator('#styleLabelPalette').selectOption('tol')
  await page.locator('#styleLabelColorByApply').click()
  await expect(page.locator('#style_status')).toContainText(
    'Labels coloured by layer (4 groups)'
  )
  const byLayer = await labelColors(page)
  expect(new Set(Object.values(byLayer)).size).toBe(4)
  expect((await first(page, 'Layer1')).color).toBe(halo.color)
  // against the node: red Layer1 nodes get white labels
  await page.locator('#styleNodeTarget').selectOption('layer:Layer1')
  await page.locator('#styleLabelColorBy').selectOption('contrast')
  await expect(page.locator('#styleLabelPalette')).toBeHidden()
  await page.locator('#styleLabelColorByApply').click()
  expect((await first(page, 'Layer1')).labelColor).toBe('#ffffff')
  await page.evaluate(() => (window as unknown as W).__arena.history.undo())
  expect((await first(page, 'Layer1')).labelColor).toBe(byLayer.Layer1)

  // Edit → Attributes: the first row (a Layer1 node) shows its style; a
  // shadow picked there keeps the bold
  await tab(page, 'Attributes')
  await expect(page.locator('#panel-attributes')).toHaveClass(/show/)
  const row = page.locator('#attrNodeTable .attr-body .attr-row').first()
  const style = row.locator('[data-f="labelStyle"]')
  await expect(style).toHaveValue('halo')
  await style.selectOption('shadow')
  expect((await first(page, 'Layer1')).look).toMatchObject({
    style: 'shadow',
    bold: true,
  })
  // its own label colour, then back to the label style's
  await row.locator('[data-f="labelColor"]').fill('#00ff00')
  expect((await first(page, 'Layer1')).labelColor).toBe('#00ff00')
  await row.locator('[data-f="labelColorReset"]').click()
  expect((await first(page, 'Layer1')).labelColor).toBe('')

  // the inspector: plain, below the node
  await row.locator('[data-f="inspect"]').click()
  await expect(page.locator('#attrInspector')).toBeVisible()
  await expect(page.locator('#inspNodeLook')).toHaveValue('shadow')
  await page.locator('#inspNodeLook').selectOption('plain')
  await page.locator('#inspNodeLabelPosition').selectOption('below')
  const inspected = await first(page, 'Layer1')
  expect(inspected.look).toMatchObject({ style: 'plain', bold: true })
  expect(inspected.position).toBe('below')
  expect(inspected.shadow).toBe('none')

  // a saved session keeps looks, positions and label colours
  await tab(page, 'File')
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#save_network_object').click(),
  ])
  const file = path.join(os.tmpdir(), 'arena3d-e2e-label-styles.json')
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
  const back = await first(page, 'Layer1')
  expect(back.look).toMatchObject({ style: 'plain', bold: true })
  expect(back.position).toBe('below')
  expect((await first(page, 'Layer2')).look).toMatchObject({
    style: 'box',
    color: '#ffff00',
  })
  expect(await labelColors(page)).toMatchObject({
    Layer2: byLayer.Layer2,
    Layer3: byLayer.Layer3,
  })
})

// Chosen labels: found by name (no mouse), kept on screen when the selection
// changes; also from the Attributes table and Edit → Style; cleared, undone
// and saved with Show Labels' choice
test('chosen labels: Find, Edit → Nodes, Attributes, Style, Chosen, session', async ({
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
  const state = () =>
    page.evaluate(() => {
      const ctx = (window as unknown as W).__arena.ctx as unknown as {
        nodeObjects: {
          name: string
          layer: string
          labelShown: boolean
          showLabel: boolean
          isSelected: boolean
        }[]
      }
      const ns = ctx.nodeObjects
      return {
        pinned: ns.filter((n) => n.labelShown).map((n) => n.name),
        shown: ns.filter((n) => n.showLabel).length,
        selected: ns.filter((n) => n.isSelected).length,
      }
    })

  // select by name, then keep their labels
  await tab(page, 'Find')
  await page.locator('#nodeSearchBar').fill('5, 7')
  await page.locator('#nodeSearchBar').press('Enter')
  const found = (await state()).selected
  expect(found).toBeGreaterThan(1)
  await tab(page, 'Nodes')
  await page.locator('#pinSelectedLabels').dispatchEvent('click')
  await expect(page.locator('#nodeLabelsStatus')).toContainText(
    `${found} labels chosen; Show Labels: Chosen`
  )
  await expect(page.locator('#nodeLabels_chosen')).toBeChecked()
  // nothing selected any more: the chosen labels stay
  await page.locator('#selectAllNodes').dispatchEvent('click')
  await page.locator('#selectAllNodes').dispatchEvent('click')
  let s = await state()
  expect(s.selected).toBe(0)
  expect(new Set(s.pinned)).toEqual(new Set(['5', '7']))
  expect(s.shown).toBe(found)

  // the Attributes table's Label shown box, and Edit → Style for a layer
  await tab(page, 'Attributes')
  const row = page.locator('#attrNodeTable .attr-body .attr-row').first()
  await row.locator('[data-f="labelShown"]').check()
  expect((await state()).shown).toBe(found + 1)
  await tab(page, 'Style')
  await page.locator('#styleNodeTarget').selectOption('layer:Layer4')
  await page.locator('#styleNodeLabelShownApply').click()
  await expect(
    page.locator('#styleNodeProps [data-now="labelShown"]')
  ).toHaveText('shown')
  s = await state()
  expect(s.pinned.length).toBeGreaterThan(found + 1)

  // Clear Chosen Labels unpins all; undo brings them back
  await tab(page, 'Nodes')
  await page.locator('#clearChosenLabels').dispatchEvent('click')
  expect((await state()).pinned).toEqual([])
  await page.evaluate(() => (window as unknown as W).__arena.history.undo())
  expect((await state()).pinned.length).toBe(s.pinned.length)

  // a saved session keeps the chosen labels and Show Labels: Chosen
  await tab(page, 'File')
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#save_network_object').click(),
  ])
  const file = path.join(os.tmpdir(), 'arena3d-e2e-chosen-labels.json')
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
  const back = await state()
  expect(back.pinned.length).toBe(s.pinned.length)
  expect(back.shown).toBe(s.pinned.length)
  await expect(page.locator('#nodeLabels_chosen')).toBeChecked()
})
