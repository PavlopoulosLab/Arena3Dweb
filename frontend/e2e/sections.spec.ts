import { expect, test, type Page } from './fixtures'

// Panel cards (ui/sections.ts): the first card of every panel starts open and
// the others folded (and inside a card, its first sub-section), a folded
// card's title (and hint) still says what is inside, Expand all / Collapse all
// does every card of a panel, and the browser remembers what the user opened
// or folded. These are the real defaults: the other specs see every card open.
test.use({ openCards: false })

const tab = async (page: Page, name: string, pane: string) => {
  await page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')
  await expect(page.locator(pane)).toHaveClass(/show/)
}

// cards whose default is wrong: in every panel (and inside every card) the
// first card open, the rest folded
const misfolded = (page: Page) =>
  page.evaluate(() => {
    const CARDS = 'details.lp-more[id], details.db-card[id]'
    const bad: string[] = []
    const check = (scope: Element, parent: Element | null) =>
      [...scope.querySelectorAll<HTMLDetailsElement>(CARDS)]
        .filter((d) => (d.parentElement?.closest('details') ?? null) === parent)
        .forEach((d, i) => {
          if (d.open !== (i === 0)) bad.push(d.id)
        })
    document
      .querySelectorAll('#panelContent .tab-pane')
      .forEach((pane) => check(pane, null))
    document
      .querySelectorAll<HTMLDetailsElement>('#panelContent details[id]')
      .forEach((card) => check(card, card))
    return bad
  })
const openCards = (page: Page) =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLDetailsElement>(
        '#panelContent details[open]'
      ),
    ].map((d) => d.id)
  )

const start = async (page: Page) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
}

test('the first card of each panel starts open; choices are remembered', async ({
  page,
}) => {
  await start(page)
  // a choice saved under the old key (when some cards started open) is gone
  await page.evaluate(() =>
    localStorage.setItem(
      'arena3d.sections',
      JSON.stringify({ nodeCard_shape: true })
    )
  )
  await start(page)
  expect(await misfolded(page)).toEqual([])
  const defaults = await openCards(page)
  expect(defaults).toEqual(
    expect.arrayContaining([
      'fileCard_network',
      'card_string',
      'exportCard_image',
      'exportSub_formats',
      'layoutCard_layers',
      'explore_card',
      'koSub_nodes',
    ])
  )
  expect(defaults).not.toContain('fileCard_examples')
  expect(
    await page.evaluate(() => localStorage.getItem('arena3d.sections'))
  ).toBeNull()

  await tab(page, 'File', '#panel-file')
  await expect(page.locator('#input_network_file')).toBeVisible()
  await expect(page.locator('#fileCard_examples > summary')).toBeVisible()
  await expect(page.locator('#exampleButton')).toBeVisible() // not in a card

  await tab(page, 'Nodes', '#panel-node')
  const style = page.locator('#nodeCard_labelStyle')
  await expect(page.locator('#selectAllNodes')).toBeVisible() // first card
  await expect(style).toHaveJSProperty('open', false)
  await style.locator('> summary').click()
  await expect(page.locator('#applyLabelStyle')).toBeVisible()

  // a first card folded stays folded
  await tab(page, 'Explore', '#panel-explore')
  await page.locator('#explore_card > summary').click()
  await expect(page.locator('#explore_card')).toHaveJSProperty('open', false)

  // the same after a reload; the other cards keep their defaults
  await start(page)
  await tab(page, 'Nodes', '#panel-node')
  await expect(style).toHaveJSProperty('open', true)
  expect((await openCards(page)).sort()).toEqual(
    [
      ...defaults.filter((id) => id !== 'explore_card'),
      'nodeCard_labelStyle',
    ].sort()
  )
})

test('Expand all and Collapse all do every card of the panel', async ({
  page,
}) => {
  await start(page)
  await tab(page, 'Edges', '#panel-edge')
  await expect(page.locator('#panel-edge details.lp-more')).toHaveCount(5)

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
  await expect(page.locator('#export_scene_image')).toBeVisible() // first card

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

test('Layout opens 1 · Layers, folds the rest; Run Layout stays in view', async ({
  page,
}) => {
  await start(page)
  await tab(page, 'Layout', '#panel-layouts')
  await expect(page.locator('#runLayout')).toBeVisible()
  await expect(page.locator('#layoutAlgorithmChoice')).toBeHidden()
  // the folded Weights & 3D sub-section says what is on
  const hint = page.locator('#layoutOptionsHint')
  await expect(hint).toHaveText('2D layout, no edge weights')
  await page.locator('#layoutCard_layout > summary').click()
  await expect(page.locator('#layoutAlgorithmChoice')).toBeVisible()
  // its first sub-section starts open
  await expect(page.locator('#layoutSub_options')).toHaveJSProperty(
    'open',
    true
  )
  await page.locator('#layout3dCheckbox').check()
  await expect(hint).toHaveText('3D layout, no edge weights')

  await page.locator('#panel-layouts [data-fold-all="open"]').click()
  await expect(page.locator('#panel-layouts details:not([open])')).toHaveCount(
    0
  )
  await expect(page.locator('#groupForce')).toBeVisible()
})

test('Database Importers and Perturbation open their first card', async ({
  page,
}) => {
  await start(page)
  await tab(page, 'Database Importers', '#panel-databases')
  await expect(page.locator('#db_import_string')).toBeVisible()
  await expect(page.locator('#db_import_reactome')).toBeHidden()
  await page.locator('#card_reactome > summary').click()
  await expect(page.locator('#db_import_reactome')).toBeVisible()

  await tab(page, 'Perturbation', '#panel-perturbation')
  await expect(page.locator('#runKnockout')).toBeVisible()
  await expect(page.locator('#koSub_nodes > summary')).toContainText('top k')
  await expect(page.locator('#koNodes')).toBeVisible()
  await expect(page.locator('#attackSteps')).toBeHidden()
  await page.locator('#panel-perturbation [data-fold-all="open"]').click()
  await expect(
    page.locator('#panel-perturbation details:not([open])')
  ).toHaveCount(0)
  await expect(page.locator('#attackSteps')).toBeVisible()
})
