import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

// A numeric node table (expression, scores) colours nodes by a column from
// Edit → Style, with a diverging scale around zero and the range in the legend.

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

test('node values colour nodes by a column, with a legend', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page
    .locator('#input_network_file')
    .setInputFiles(path.resolve('public/data/figure2A_data.tsv'))
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  const rows = Array.from({ length: 20 }, (_, i) => `${i + 1}\t${i}\t${i - 10}`)
  await page.locator('#values_file').setInputFiles({
    name: 'values.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from(['Node\tscore\tlog2fc', ...rows].join('\n') + '\n'),
  })
  await expect(page.locator('#file_status')).toContainText(
    'Values loaded (2 columns'
  )
  await expect(page.locator('#dataTab-values')).not.toHaveClass(/d-none/)

  await tab(page, 'Style')
  await expect(page.locator('#styleColorBy')).toHaveValue('values')
  await expect(page.locator('#styleNodeTarget')).toHaveValue('all')
  await page.locator('#styleValueColumn').selectOption('log2fc')
  await page.locator('#styleColorByApply').dispatchEvent('click')
  await expect(page.locator('#style_status')).toContainText(
    'diverging around 0'
  )
  const colors = await page.evaluate(() => {
    const c = (
      window as unknown as {
        __arena: { ctx: { nodeObjects: { name: string; color: string }[] } }
      }
    ).__arena.ctx
    const of = (name: string) =>
      c.nodeObjects
        .filter((n) => n.name === name)
        .map((n) => n.color.toLowerCase())
    return { low: of('1'), high: of('20'), mid: of('11') }
  })
  expect(new Set(colors.low).size).toBe(1) // every copy alike
  expect(colors.low[0]).not.toBe(colors.high[0])
  expect(colors.mid[0]).not.toBe(colors.low[0])
  await expect(page.locator('#legend .legend-title')).toHaveText('log2fc')
  await expect(page.locator('#legend .legend-gradient')).toBeVisible()
  await expect(page.locator('#legend .legend-min')).toHaveText('-10')
  await expect(page.locator('#legend .legend-max')).toHaveText('10')
  // Scene & Camera hides the legend
  await tab(page, 'Scene & Camera')
  await page
    .locator('#toggleLegend')
    .evaluate((el) => (el as HTMLInputElement).click())
  await expect(page.locator('#legend')).toBeHidden()
})
