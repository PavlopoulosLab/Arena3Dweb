import { expect, test, type Page } from './fixtures'
import fs from 'node:fs'
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

// Edit → Nodes → Labels to show: tick boxes, a filter (Enter ticks every
// match), All / None / Invert / The selected nodes, a count; then the label
// columns of Edit → Attributes and the node attribute file
test('label picker and the label columns of Edit → Attributes', async ({
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
  type P = {
    name: string
    labelShown: boolean
    labelSize: number
    labelPosition: string
    labelLook: { style: string; bold: boolean } | null
  }
  const nodes = () =>
    page.evaluate(
      () =>
        (window as unknown as { __arena: { ctx: { nodeObjects: P[] } } })
          .__arena.ctx.nodeObjects
    )
  const chosen = async () => (await nodes()).filter((n) => n.labelShown)

  await tab(page, 'Nodes')
  // (cards start open in tests; a click on the heading would fold it)
  await page.evaluate(() => {
    ;(
      document.getElementById('nodeCard_labelPicker') as HTMLDetailsElement
    ).open = true
  })
  const search = page.locator('#labelPickSearch')
  await search.fill('17')
  await search.press('Enter') // ticks every match
  const matches = await chosen()
  expect(matches.length).toBeGreaterThan(0)
  expect(matches.every((n) => n.name.includes('17'))).toBe(true)
  await expect(page.locator('#labelPickStatus')).toContainText(
    'Show Labels switched to Chosen'
  )
  await expect(page.locator('#nodeLabels_chosen')).toBeChecked()
  await expect(page.locator('#labelPickCount')).toContainText(
    `${matches.length} of 255 labels chosen · ${matches.length} listed`
  )
  // Invert on the listed rows; then a tick box with the keyboard
  await page.locator('#labelPickInvert').click()
  expect(await chosen()).toHaveLength(0)
  await search.fill('')
  await search.press('Tab') // to the layer and group filters, the buttons …
  const first = page.locator('#labelPickList input[type="checkbox"]').first()
  await first.focus()
  await page.keyboard.press('Space')
  expect(await chosen()).toHaveLength(1)
  // every node selected → The selected nodes ticks them all
  await page.locator('#selectAllNodes').dispatchEvent('click')
  await page.locator('#labelPickSelected').click()
  expect(await chosen()).toHaveLength(255)
  await page.locator('#labelPickNone').click()
  expect(await chosen()).toHaveLength(0)
  await page.locator('#selectAllNodes').dispatchEvent('click') // unselect

  // the label columns of the node table
  await tab(page, 'Attributes')
  await expect(page.locator('#panel-attributes')).toHaveClass(/show/)
  const row = page.locator('#attrNodeTable .attr-body .attr-row').first()
  await row.locator('[data-f="labelSize"]').fill('18')
  await row.locator('[data-f="labelSize"]').press('Enter')
  await row.locator('[data-f="labelBold"]').check()
  await row.locator('[data-f="labelPosition"]').selectOption('above')
  await row.locator('[data-f="labelShown"]').check()
  const n0 = (await nodes())[0]
  expect(n0.labelSize).toBe(18)
  expect(n0.labelLook).toMatchObject({ style: 'halo', bold: true }) // the default look, bold
  expect(n0.labelPosition).toBe('above')
  expect(n0.labelShown).toBe(true)

  // the node attribute file carries every label column
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#attrExportNodes').click(),
  ])
  const text = fs.readFileSync(await dl.path(), 'utf8')
  const [head, firstRow] = text.split('\n')
  const cols = head.split('\t')
  for (const c of [
    'Label',
    'LabelColor',
    'LabelSize',
    'LabelStyle',
    'LabelPosition',
    'LabelBold',
    'LabelShown',
  ])
    expect(cols).toContain(c)
  const cell = (c: string) => firstRow.split('\t')[cols.indexOf(c)]
  expect([cell('LabelSize'), cell('LabelStyle'), cell('LabelBold')]).toEqual([
    '18',
    'halo 2',
    'yes',
  ])
  expect([cell('LabelPosition'), cell('LabelShown')]).toEqual(['above', 'yes'])
})

// Edit → Layers → Labels & axes: the layer labels' look, font, colour and
// place; undo; a saved session; a theme's colours take over their colour
test('layer label styles: halo by default, font, palette, position, session, theme', async ({
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
  type L = {
    labelFont: string
    labelBold: boolean
    labelItalic: boolean
    labelColor: string
    labelPosition: string
  }
  const layers = () =>
    page.evaluate(() => {
      const ctx = (window as unknown as { __arena: { ctx: { layers: L[] } } })
        .__arena.ctx
      return ctx.layers.map((l) => ({
        font: l.labelFont,
        bold: l.labelBold,
        italic: l.labelItalic,
        color: l.labelColor,
        position: l.labelPosition,
      }))
    })
  const drawn = () =>
    page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>('#labelDiv .layer-labels'),
      ].map((d) => {
        const cs = getComputedStyle(d)
        return {
          stroke: cs.getPropertyValue('-webkit-text-stroke-width'),
          font: cs.fontFamily,
          weight: cs.fontWeight,
          style: cs.fontStyle,
          transform: d.style.transform,
        }
      })
    )
  // the halo is the default for layer labels too
  expect((await drawn())[0].stroke).toBe('4px')

  await tab(page, 'Layers')
  await page.evaluate(() => {
    ;(document.getElementById('layerCard_labels') as HTMLDetailsElement).open =
      true
  })
  await page.locator('#layerLabelFont').selectOption('condensed')
  await page.locator('#layerLabelBold').check()
  await page.locator('#layerLabelItalic').check()
  await page.locator('#layerLabelColorBy').selectOption('palette')
  await page.locator('#layerLabelPalette').selectOption('okabeIto')
  await page.locator('#layerLabelPosition').selectOption('above')
  await page.locator('#applyLayerLabelStyle').click()
  await expect(page.locator('#layerLabelStatus')).toContainText(
    'Label style applied to 4 layers'
  )
  const styled = await layers()
  expect(new Set(styled.map((l) => l.color)).size).toBe(4)
  expect(styled[0]).toMatchObject({
    font: 'condensed',
    bold: true,
    italic: true,
    position: 'above',
  })
  const d0 = (await drawn())[0]
  expect(d0.font).toContain('Condensed')
  expect([d0.weight, d0.style]).toEqual(['700', 'italic'])
  expect(d0.transform).toContain('translate(-50%')

  // undo, redo
  await page.evaluate(() =>
    (
      window as unknown as { __arena: { history: { undo: () => void } } }
    ).__arena.history.undo()
  )
  expect((await layers())[0]).toMatchObject({ font: '', position: 'corner' })
  await page.evaluate(() =>
    (
      window as unknown as { __arena: { history: { redo: () => void } } }
    ).__arena.history.redo()
  )

  // a saved session keeps them
  await tab(page, 'File')
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#save_network_object').click(),
  ])
  const file = path.join(os.tmpdir(), 'arena3d-e2e-layer-labels.json')
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
  expect(await layers()).toEqual(styled)

  // applying a theme's colours gives the labels the theme's colour again
  await page.locator('#themeSelect').selectOption('light')
  await page.locator('#themeColours_apply').check()
  await page.locator('#themeDialogOk').click()
  expect((await layers()).map((l) => l.color)).toEqual(['', '', '', ''])
  expect((await layers())[0].font).toBe('condensed') // the rest stays
})
