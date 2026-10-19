import { expect, test } from './fixtures'

// Grouped menus: View / Edit / Analyze dropdowns open their panels with real
// clicks; Analyze holds one panel per kind of analysis.

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
    ['Clustering', '#panel-clustering'],
  ] as const) {
    await page.getByRole('tab', { name: item, exact: true }).click()
    await expect(page.locator(pane)).toHaveClass(/show/)
    if (item === 'Clustering')
      await expect(
        page.locator('#panel-clustering #runClustering')
      ).toBeVisible()
    if (item === 'Database Importers') {
      // one card per source (folded by default: sections.spec.ts)
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
  await open('View', 'Scene & Camera', '#panel-scene')
  // how groups are highlighted in the scene, then the group list; no
  // top-level Annotations menu any more
  await open('View', 'Annotations', '#panel-annotation-view')
  for (const control of ['#hull_cluster', '#hullStyle_sphere', '#groups_card'])
    await expect(
      page.locator(`#panel-annotation-view ${control}`)
    ).toBeVisible()
  await expect(page.locator('#menu-view')).toHaveClass(/active/)
  await expect(page.locator('[data-menu="annotations"]')).toHaveCount(0)
  await open('View', 'Performance', '#panel-fps')
  // no "3D View" entry: the scene is always there, the drawer handle closes
  // a panel
  await expect(
    page.locator('[aria-labelledby="menu-view"] .dropdown-item', {
      hasText: '3D View',
    })
  ).toHaveCount(0)
  await open('Edit', 'Nodes', '#panel-node')
  await open('Edit', 'Style', '#panel-style')
  await open('Edit', 'Attributes', '#panel-attributes')
  await expect(page.locator('#panel-attributes #attrNodeTable')).toBeVisible()
  for (const [item, pane, control] of [
    ['Metrics', '#panel-metrics', '#runTopologyScale'],
    ['Statistics', '#panel-statistics', '#networkStats'],
    ['Plots', '#panel-plots', '#plotDraw'],
    ['Perturbation', '#panel-perturbation', '#runKnockout'],
    ['Explore', '#panel-explore', '#explore_card'],
    ['Annotations & Groups', '#panel-annotations', '#runEnrichment'],
  ] as const) {
    await open('Analyze', item, pane)
    await expect(page.locator(`${pane} ${control}`)).toBeVisible()
  }
  await expect(page.locator('#panel-layouts #runTopologyScale')).toHaveCount(0)
  // the parent menu shows which group is active
  await expect(page.locator('#menu-analyze')).toHaveClass(/active/)
  // Analyze → Annotations & Groups keeps the enrichment and a way to View →
  // Annotations
  await open('Analyze', 'Annotations & Groups', '#panel-annotations')
  await page.locator('#analyzeOpenAnnotations').click()
  await expect(page.locator('#panel-annotation-view')).toHaveClass(/show/)
  await open('Analyze', 'Data Tables', '#panel-data')
  // choosing the panel that is already open still closes the menu
  await open('Analyze', 'Data Tables', '#panel-data')
  await expect(
    page.getByRole('tab', { name: 'Data Tables', exact: true })
  ).toBeHidden()
  await page.screenshot({ path: 'test-results/menus.png' })
})
