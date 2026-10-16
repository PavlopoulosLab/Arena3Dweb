import { expect, test } from '@playwright/test'
import path from 'node:path'

// PLAN-ROADMAP Phase 5: multilayer metrics (scale + colour), layer
// similarity heatmap, multiplex Leiden with the coupled scope.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

type Ctx = {
  nodeObjects: { color: string; cluster: string; name: string }[]
}
const nodeColors = () =>
  (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx.nodeObjects.map(
    (n) => n.color
  )

async function select(
  page: import('@playwright/test').Page,
  sel: string,
  value: string
) {
  await page.locator(sel).evaluate((el, v) => {
    ;(el as HTMLSelectElement).value = v
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

test('multilayer metric colours nodes; layers compare in View Data', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  await page
    .getByRole('tab', { name: 'Layout', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#selectAllLayersCheckbox').dispatchEvent('click')

  // multiplex Leiden through the coupled scope
  await page.locator('#subgraph_coupled').dispatchEvent('click')
  await select(page, '#layoutAlgorithmChoice', 'Fruchterman-Reingold')
  await select(page, '#clusteringAlgorithmChoice', 'Leiden')
  await page.locator('#runLayout').dispatchEvent('click')
  await expect(page.locator('#layouts_status')).toHaveText('Layout applied.')
  const sameClusterPerLabel = await page.evaluate(() => {
    const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    const byLabel: Record<string, Set<string>> = {}
    for (const n of ctx.nodeObjects)
      (byLabel[n.name] ??= new Set()).add(n.cluster)
    return Object.values(byLabel).every((s) => s.size === 1)
  })
  expect(sameClusterPerLabel).toBe(true)

  // participation coefficient, coloured — in Analyze → Analysis
  await page
    .getByRole('tab', { name: 'Analysis', includeHidden: true, exact: true })
    .dispatchEvent('click')
  const before = await page.evaluate(nodeColors)
  await select(page, '#topologyScaleMetricChoice', 'Participation Coefficient')
  await page.locator('#colorByMetricCheckbox').dispatchEvent('click')
  await page.locator('#runTopologyScale').dispatchEvent('click')
  await expect(page.locator('#analyze_status')).toHaveText(
    'Node scaling applied.'
  )
  const after = await page.evaluate(nodeColors)
  expect(after).not.toEqual(before)
  expect(new Set(after).size).toBeGreaterThan(1)

  await page.locator('#compareLayers').dispatchEvent('click')
  await expect(page.locator('#analyze_status')).toContainText(
    'Layer Similarity'
  )
  await page
    .getByRole('tab', { name: 'Data Tables', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await expect(page.locator('#dataTab-similarity')).toBeVisible()
  await expect(page.locator('#dataPane-similarity table')).toHaveCount(2)
  await expect(page.locator('#dataTab-participation')).toBeVisible()
  await page.screenshot({ path: 'test-results/layer-similarity.png' })
})
