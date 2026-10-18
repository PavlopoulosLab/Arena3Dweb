import { expect, test } from './fixtures'
import path from 'node:path'

// PLAN-ROADMAP Phase 21: network statistics table + degree chart; new node
// metrics in the topology list.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

test('network statistics and new node metrics', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  // analysis lives under Analyze → Analysis (all layers when none selected)
  await page
    .getByRole('tab', { name: 'Analysis', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#networkStats').click()
  await expect(page.locator('#analyze_status')).toContainText(
    'Network Statistics'
  )

  await page
    .getByRole('tab', { name: 'Data Tables', includeHidden: true, exact: true })
    .dispatchEvent('click')
  const table = page.locator('#dataPane-stats table')
  await expect(table.locator('thead th')).toHaveCount(1 + 4 + 1) // 4 layers + whole
  await expect(table.locator('tbody tr')).toHaveCount(12)
  await expect(table).toContainText('Average path length')
  expect(await page.locator('#degreeChart .deg-bar').count()).toBeGreaterThan(3)
  await page.locator('#degreeChart').scrollIntoViewIfNeeded()
  await page
    .locator('#degreeChart')
    .screenshot({ path: 'test-results/degree-chart.png' })

  await page
    .getByRole('tab', { name: 'Analysis', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#topologyScaleMetricChoice')
    .selectOption('Coreness (k-core)')
  await page.locator('#runTopologyScale').dispatchEvent('click')
  await expect(page.locator('#analyze_status')).toHaveText(
    'Node scaling applied.'
  )
})
