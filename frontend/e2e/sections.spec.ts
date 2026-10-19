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
