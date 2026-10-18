import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// Analyze → Node Metrics → Treat the network as: undirected merges the
// channels of a node pair into one edge, multi-edged counts every channel.

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

// the Degree report in Data Tables: node -> value
const degrees = (page: Page) =>
  page
    .locator('#dataPane-degree table.data-table tbody tr')
    .evaluateAll((rows) =>
      Object.fromEntries(
        rows.map((r) => [
          r.children[0].textContent ?? '',
          Number(r.children[1].textContent),
        ])
      )
    )

test('metrics count the channels only on a multi-edged graph', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page
    .locator('#input_network_file')
    .setInputFiles(path.resolve('public/data/aspirin_3channels.tsv'))
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  await tab(page, 'Analysis')
  // the channels of this network run between its two layers: count them
  // across layers
  await page.locator('#analysisScope_allLayers').dispatchEvent('click')
  await page
    .locator('#topologyScaleMetricChoice')
    .selectOption({ label: 'Degree' })
  await page.locator('#runTopologyScale').dispatchEvent('click')
  await expect(page.locator('#analyze_status')).toContainText(
    'Node scaling applied'
  )
  const merged = await degrees(page)
  expect(Object.keys(merged).length).toBeGreaterThan(2)

  const sum = (d: Record<string, number>) =>
    Object.values(d).reduce((a, v) => a + v, 0)
  await page.locator('#topologyGraph').selectOption('multi')
  await Promise.all([
    page.waitForResponse('**/api/topology'),
    page.locator('#runTopologyScale').dispatchEvent('click'),
  ])
  // the report is redrawn once the answer is in
  await expect
    .poll(async () => sum(await degrees(page)))
    .toBeGreaterThan(sum(merged))
  const multi = await degrees(page)
  for (const [node, value] of Object.entries(merged))
    expect(multi[node]).toBeGreaterThanOrEqual(value)

  await page.locator('#topologyGraph').selectOption('directed')
  await page
    .locator('#topologyScaleMetricChoice')
    .selectOption({ label: 'PageRank' })
  await Promise.all([
    page.waitForResponse('**/api/topology'),
    page.locator('#runTopologyScale').dispatchEvent('click'),
  ])
  // the report's tab appears (the Data Tables panel itself stays closed)
  await expect(page.locator('#dataTab-pagerankNode')).not.toHaveClass(/d-none/)
})
