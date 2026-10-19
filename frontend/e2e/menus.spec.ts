import { expect, test, type Page } from './fixtures'

// Grouped menus: View / Edit / Analyze dropdowns open their panels with real
// clicks; Analyze holds one panel per kind of analysis.
//
// Split into independent tests (rather than one long chain) so they run in
// parallel across workers — this one file alone used to eat a whole worker's
// time end-to-end, and kept outgrowing its own test.setTimeout bump as more
// menu items were added.

const open = async (page: Page, menu: string, item: string, pane: string) => {
  await page.getByRole('button', { name: menu, exact: true }).click()
  await page.getByRole('tab', { name: item, exact: true }).click()
  await expect(page.locator(pane)).toHaveClass(/show/)
}

test('top-level panels open, including the Databases card sweep', async ({
  page,
}) => {
  await page.goto('/')
  // top-level panels (no dropdown); the Databases panel holds one importer per card
  for (const [item, pane] of [
    ['File', '#panel-file'],
    ['Database Importers', '#panel-databases'],
    ['Find', '#panel-find'],
    ['Export', '#panel-export'],
    ['Layout', '#panel-layouts'],
    ['Clustering', '#panel-clustering'],
  ] as const) {
    await page.getByRole('tab', { name: item, exact: true }).click()
    await expect(page.locator(pane)).toHaveClass(/show/)
    if (item === 'Clustering')
      await expect(
        page.locator('#panel-clustering #runClustering')
      ).toBeVisible()
    if (item === 'Database Importers') {
      // one card per source (the first open, the rest folded: sections.spec.ts)
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
      await expect(page.locator('#db_import_string')).toBeVisible()
      await expect(page.locator('#db_import_layers')).toBeVisible()
    }
  }
})

test('View menu panels', async ({ page }) => {
  await page.goto('/')
  await open(page, 'View', 'Scene & Camera', '#panel-scene')
  // how groups are highlighted in the scene, then the group list; no
  // top-level Annotations menu any more
  await open(page, 'View', 'Annotations', '#panel-annotation-view')
  for (const control of ['#hull_cluster', '#hullStyle_sphere', '#groups_card'])
    await expect(
      page.locator(`#panel-annotation-view ${control}`)
    ).toBeVisible()
  await expect(page.locator('#menu-view')).toHaveClass(/active/)
  await expect(page.locator('[data-menu="annotations"]')).toHaveCount(0)
  await open(page, 'View', 'Performance', '#panel-fps')
  // no "3D View" entry: the scene is always there, the drawer handle closes
  // a panel
  await expect(
    page.locator('[aria-labelledby="menu-view"] .dropdown-item', {
      hasText: '3D View',
    })
  ).toHaveCount(0)
})

test('Edit menu panels', async ({ page }) => {
  await page.goto('/')
  await open(page, 'Edit', 'Nodes', '#panel-node')
  await open(page, 'Edit', 'Style', '#panel-style')
  await open(page, 'Edit', 'Attributes', '#panel-attributes')
  await expect(page.locator('#panel-attributes #attrNodeTable')).toBeVisible()
})

test('Analyze menu panels', async ({ page }) => {
  // the heaviest of the four split-out tests (6 sub-panels plus extra checks)
  test.setTimeout(120_000)
  await page.goto('/')
  for (const [item, pane, control] of [
    ['Metrics', '#panel-metrics', '#runTopologyScale'],
    ['Statistics', '#panel-statistics', '#networkStats'],
    ['Plots', '#panel-plots', '#plotDraw'],
    ['Perturbation', '#panel-perturbation', '#runKnockout'],
    ['Explore', '#panel-explore', '#explore_card'],
    ['Annotations & Groups', '#panel-annotations', '#runEnrichment'],
  ] as const) {
    await open(page, 'Analyze', item, pane)
    await expect(page.locator(`${pane} ${control}`)).toBeVisible()
  }
  await expect(page.locator('#panel-layouts #runTopologyScale')).toHaveCount(0)
  // the parent menu shows which group is active
  await expect(page.locator('#menu-analyze')).toHaveClass(/active/)
  // Analyze → Annotations & Groups keeps the enrichment and a way to View →
  // Annotations
  await open(page, 'Analyze', 'Annotations & Groups', '#panel-annotations')
  await page.locator('#analyzeOpenAnnotations').click()
  await expect(page.locator('#panel-annotation-view')).toHaveClass(/show/)
  await open(page, 'Analyze', 'Data Tables', '#panel-data')
  // choosing the panel that is already open still closes the menu
  await open(page, 'Analyze', 'Data Tables', '#panel-data')
  await expect(
    page.getByRole('tab', { name: 'Data Tables', exact: true })
  ).toBeHidden()
})
