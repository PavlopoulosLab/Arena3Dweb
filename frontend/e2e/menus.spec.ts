import { expect, test } from './fixtures'

// Grouped menus: View / Edit / Analyze dropdowns open their panels with real
// clicks; the Analysis panel holds the moved analysis tools.

test('grouped menus open their panels', async ({ page }) => {
  // ~15 sequential menu/tab interactions plus a Databases-card sweep — already
  // the suite's second-slowest test (see other e2e files' test.setTimeout for
  // the same reason: CI's software-GL rendering routinely pushes heavy tests
  // past the 90s default).
  test.setTimeout(120_000)
  await page.goto('/')
  const open = async (menu: string, item: string, pane: string) => {
    await page.getByRole('button', { name: menu, exact: true }).click()
    await page.getByRole('tab', { name: item, exact: true }).click()
    await expect(page.locator(pane)).toHaveClass(/show/)
  }
  // top-level panels (no dropdown); the Databases panel holds one importer per card
  for (const [item, pane] of [
    ['File', '#panel-file'],
    ['Database Importers', '#panel-databases'],
    ['Find', '#panel-find'],
    ['Export', '#panel-export'],
    ['Layout', '#panel-layouts'],
  ] as const) {
    await page.getByRole('tab', { name: item, exact: true }).click()
    await expect(page.locator(pane)).toHaveClass(/show/)
    if (item === 'Database Importers') {
      // one card per source, all folded until clicked
      for (const key of [
        'string',
        'reactome',
        'omnipath',
        'ndex',
        'intact',
        'go',
        'compare',
      ])
        await expect(
          page.locator(`#panel-databases #card_${key} > summary`)
        ).toBeVisible()
      await expect(page.locator('#panel-databases details[open]')).toHaveCount(
        0
      )
      await expect(page.locator('#db_import_string')).toBeHidden()
      await expect(page.locator('#db_import_layers')).toBeHidden()
      await page.locator('#card_string > summary').click()
      await expect(page.locator('#db_import_string')).toBeVisible()
      await page.locator('#card_compare summary').click()
      await expect(page.locator('#db_import_layers')).toBeVisible()
    }
  }
  await open('View', 'Scene & Camera', '#panel-scene')
  await open('View', 'Performance', '#panel-fps')
  await open('Edit', 'Nodes', '#panel-node')
  await open('Edit', 'Style', '#panel-style')
  await open('Analyze', 'Analysis', '#panel-analyze')
  await expect(page.locator('#panel-analyze #networkStats')).toBeVisible()
  await expect(page.locator('#panel-analyze #explore_card')).toBeVisible()
  await expect(page.locator('#panel-layouts #runTopologyScale')).toHaveCount(0)
  // the parent menu shows which group is active
  await expect(page.locator('#menu-analyze')).toHaveClass(/active/)
  await open('Analyze', 'Data Tables', '#panel-data')
  // choosing the panel that is already open still closes the menu
  await open('Analyze', 'Data Tables', '#panel-data')
  await expect(
    page.getByRole('tab', { name: 'Data Tables', exact: true })
  ).toBeHidden()
  await page.screenshot({ path: 'test-results/menus.png' })
})
