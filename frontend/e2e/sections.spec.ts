import { expect, test, type Page } from './fixtures'

// Panel cards (ui/sections.ts): the main ones start open and the rest folded,
// Expand all / Collapse all does every card of a panel, and the browser
// remembers what the user opened or folded.

const tab = async (page: Page, name: string, pane: string) => {
  await page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')
  await expect(page.locator(pane)).toHaveClass(/show/)
}

const start = async (page: Page) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
}

test('cards start open or folded and remember the choice', async ({ page }) => {
  await start(page)
  // File: loading stays in view, the attribute files are folded away
  await tab(page, 'File', '#panel-file')
  for (const [id, open] of [
    ['fileCard_network', true],
    ['fileCard_attributes', false],
    ['fileCard_groups', false],
    ['fileCard_examples', true],
    ['fileCard_networks', true],
  ] as const)
    await expect(page.locator(`#${id}`)).toHaveJSProperty('open', open)
  await expect(page.locator('#input_network_file')).toBeVisible()
  await expect(page.locator('#node_attributes_file')).toBeHidden()

  await tab(page, 'Nodes', '#panel-node')
  const labels = page.locator('#nodeCard_labels')
  const style = page.locator('#nodeCard_labelStyle')
  await expect(labels).toHaveJSProperty('open', true)
  await expect(style).toHaveJSProperty('open', false)
  await expect(page.locator('#applyLabelStyle')).toBeHidden()

  await style.locator('> summary').click()
  await expect(page.locator('#applyLabelStyle')).toBeVisible()
  await labels.locator('> summary').click()
  await expect(page.locator('#selectAllNodes')).toBeHidden()

  // the same after a reload; cards nobody touched keep their defaults
  await start(page)
  await tab(page, 'Nodes', '#panel-node')
  await expect(style).toHaveJSProperty('open', true)
  await expect(labels).toHaveJSProperty('open', false)
  await expect(page.locator('#nodeCard_shape')).toHaveJSProperty('open', true)
  await expect(page.locator('#nodeCard_colours')).toHaveJSProperty(
    'open',
    false
  )
})

test('Expand all and Collapse all do every card of the panel', async ({
  page,
}) => {
  await start(page)
  await tab(page, 'Edges', '#panel-edge')
  const cards = page.locator('#panel-edge details.lp-more')
  await expect(cards).toHaveCount(5)
  await expect(page.locator('#panel-edge details[open]')).toHaveCount(3)

  await page.locator('#panel-edge [data-fold-all="open"]').click()
  await expect(page.locator('#panel-edge details[open]')).toHaveCount(5)
  await expect(page.locator('#intraBundling')).toBeVisible()
  // other panels keep theirs
  await expect(page.locator('#nodeCard_labelStyle')).toHaveJSProperty(
    'open',
    false
  )

  await start(page)
  await tab(page, 'Edges', '#panel-edge')
  await expect(page.locator('#panel-edge details[open]')).toHaveCount(5)
  await page.locator('#panel-edge [data-fold-all="close"]').click()
  await expect(page.locator('#panel-edge details[open]')).toHaveCount(0)
  await start(page)
  await expect(page.locator('#panel-edge details[open]')).toHaveCount(0)
})

test('Export lists its tools in folded sub-sections', async ({ page }) => {
  await start(page)
  await tab(page, 'Export', '#panel-export')
  // only Image & 3D starts open
  await expect(page.locator('#panel-export details[open]')).toHaveCount(1)
  await expect(page.locator('#exportCard_image')).toHaveJSProperty('open', true)

  await page.locator('#exportCard_tools > summary').click()
  await expect(page.locator('#exportSub_flame > summary')).toContainText(
    'functional enrichment'
  )
  await expect(page.locator('#open_flame')).toBeHidden()
  await page.locator('#exportSub_flame > summary').click()
  await expect(page.locator('#open_flame')).toBeVisible()

  // Expand all reaches the sub-sections; both levels are remembered
  await page.locator('#panel-export [data-fold-all="open"]').click()
  await expect(page.locator('#panel-export details:not([open])')).toHaveCount(0)
  await start(page)
  await tab(page, 'Export', '#panel-export')
  await expect(page.locator('#panel-export details:not([open])')).toHaveCount(0)
  await expect(page.locator('#export_sankey')).toBeVisible()
})

test('Layout keeps the algorithm in view and folds the options', async ({
  page,
}) => {
  await start(page)
  await tab(page, 'Layout', '#panel-layouts')
  await expect(page.locator('#layoutAlgorithmChoice')).toBeVisible()
  await expect(page.locator('#subgraph_perLayer')).toBeVisible()
  await expect(page.locator('#runLayout')).toBeVisible()
  await expect(page.locator('#layout3dCheckbox')).toBeHidden()
  // the folded Weights & 3D sub-section says what is on
  const hint = page.locator('#layoutOptionsHint')
  await expect(hint).toHaveText('2D layout, no edge weights')
  await page.locator('#layoutSub_options > summary').click()
  await page.locator('#layout3dCheckbox').check()
  await expect(hint).toHaveText('3D layout, no edge weights')

  await page.locator('#panel-layouts [data-fold-all="open"]').click()
  await expect(page.locator('#panel-layouts details:not([open])')).toHaveCount(
    0
  )
  await expect(page.locator('#groupForce')).toBeVisible()
})
