import { expect, test } from '@playwright/test'

// Grouped menus: View / Edit / Analyze dropdowns open their panels with real
// clicks; the Analysis panel holds the moved analysis tools.

test('grouped menus open their panels', async ({ page }) => {
  await page.goto('/')
  const open = async (menu: string, item: string, pane: string) => {
    await page.getByRole('button', { name: menu, exact: true }).click()
    await page.getByRole('tab', { name: item, exact: true }).click()
    await expect(page.locator(pane)).toHaveClass(/show/)
  }
  // top-level panels (no dropdown); the Databases panel holds one importer per card
  for (const [item, pane] of [
    ['File', '#panel-file'],
    ['Databases', '#panel-databases'],
    ['Find', '#panel-find'],
    ['Export', '#panel-export'],
    ['Layout', '#panel-layouts'],
  ] as const) {
    await page.getByRole('tab', { name: item, exact: true }).click()
    await expect(page.locator(pane)).toHaveClass(/show/)
    if (item === 'Databases') {
      // one card per source; STRING open, the others folded until clicked
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
          page.locator(`#panel-databases #card_${key} summary`)
        ).toBeVisible()
      await expect(page.locator('#db_import_string')).toBeVisible()
      await expect(page.locator('#db_import_layers')).toBeHidden()
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
