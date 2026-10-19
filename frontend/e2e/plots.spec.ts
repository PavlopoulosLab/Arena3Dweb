import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// Analyze → Plots (ui/plots.ts) on a bundled example: a degree histogram per
// layer (progress bar, summary table, a click on a bar selects its nodes), a
// scatter of degree against betweenness (correlations, a dragged box selects
// the points), C(k) on log axes, the downloads, then every other plot type.

const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

type Win = {
  __arena: { ctx: { nodeObjects: { isSelected: boolean }[] } }
}

const selected = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as Win).__arena.ctx.nodeObjects.filter(
        (n) => n.isSelected
      ).length
  )

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

test('distribution and topology plots', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  const total = await page.evaluate(
    () => (window as unknown as Win).__arena.ctx.nodeObjects.length
  )
  await tab(page, 'Plots')
  await expect(page.locator('#panel-plots')).toHaveClass(/active/)
  const status = page.locator('#plot_status')
  const chart = page.locator('#plotChart')

  // ---- histogram of degree, each layer overlaid; the server's work shows
  // as a progress bar that ends green (the request is held back a moment)
  await page.route('**/api/plots', async (route) => {
    await new Promise((r) => setTimeout(r, 1200))
    await route.continue()
  })
  await page.locator('#plotKind').selectOption('histogram')
  await page.locator('#plotSource').selectOption('metric:Degree')
  await page.locator('#plotDraw').click()
  const bar = page.locator('#plotsProgress .progress-bar')
  await expect(bar).toContainText('Computing on the server')
  await expect(page.locator('#plotCancel')).toBeVisible()
  await expect(status).toContainText('Drawn: Histogram', {
    timeout: 30_000,
  })
  await expect(bar).toHaveClass(/bg-success/)
  await page.unroute('**/api/plots')
  const bars = chart.locator('rect.ch-hit')
  expect(await bars.count()).toBeGreaterThan(4)
  await expect(page.locator('#plotStats tbody tr')).toHaveCount(4) // 4 layers
  // a click on a bar selects the nodes counted in it
  const tip = await bars.first().locator('title').textContent()
  const count = Number(/: (\d+) \(click/.exec(tip ?? '')?.[1])
  await bars.first().click()
  await expect(status).toContainText(`Selected ${count} node`)
  expect(await selected(page)).toBe(count)

  // ---- scatter: degree against betweenness, every node a point
  await page.locator('#plotKind').selectOption('scatter')
  await page.locator('#plotX').selectOption('metric:Degree')
  await page.locator('#plotY').selectOption('metric:Betweenness Centrality')
  await page.locator('#plotDraw').click()
  await expect(status).toContainText('Drawn: Scatter', {
    timeout: 30_000,
  })
  const points = chart.locator('circle.ch-hit')
  await expect(points).toHaveCount(total)
  await expect(chart).toContainText('Spearman ρ =')
  await expect(chart).toContainText('Pearson r =')
  await page
    .locator('#plotBox')
    .screenshot({ path: 'test-results/plots-scatter.png' })
  // a box dragged over the whole chart selects every point
  const box = (await chart.locator('svg').boundingBox())!
  await page.mouse.move(box.x + 2, box.y + 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2, {
    steps: 5,
  })
  await page.mouse.up()
  await expect(status).toContainText(`Selected ${total} nodes`)

  // ---- C(k) against degree, on log axes
  await page.locator('#plotKind').selectOption('ck')
  await expect(page.locator('#plotLog')).toBeChecked()
  await page.locator('#plotDraw').click()
  await expect(status).toContainText('Drawn: Clustering against degree', {
    timeout: 30_000,
  })
  expect(await chart.locator('path.ch-line').count()).toBeGreaterThan(0)
  await page
    .locator('#plotBox')
    .screenshot({ path: 'test-results/plots-ck.png' })

  // ---- downloads
  const download = page.waitForEvent('download')
  await page.locator('#plotSvg').click()
  const file = await download
  expect(file.suggestedFilename()).toBe('plot_ck.svg')
  const csv = page.waitForEvent('download')
  await page.locator('#plotCsv').click()
  expect((await csv).suggestedFilename()).toBe('plot_ck.csv')

  // ---- every other plot type draws
  for (const [kind, text] of [
    ['density', 'Density'],
    ['cdf', 'Cumulative'],
    ['loglog', 'Log–log'],
    ['box', 'Box and violin'],
    ['correlation', 'Metric correlation matrix'],
    ['knn', 'Neighbour degree'],
    ['richclub', 'Rich-club'],
    ['kcore', 'k-core'],
    ['ranking', 'Centrality ranking'],
    ['profiles', 'Layer profiles'],
  ] as const) {
    await page.locator('#plotKind').selectOption(kind)
    await page.locator('#plotDraw').click()
    await expect(status).toContainText(`Drawn: ${text}`, { timeout: 30_000 })
    await expect(chart.locator('svg')).toBeVisible()
  }
  await page
    .locator('#plotBox')
    .screenshot({ path: 'test-results/plots-profiles.png' })
})
