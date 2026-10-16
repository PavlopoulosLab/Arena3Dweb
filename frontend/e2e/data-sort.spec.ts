import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

// Analyze → Data Tables: a click on a column title sorts the report by that
// column (numbers largest first), a second click turns the order round, and
// the order survives a refresh of the report.

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

const column = (page: Page, pane: string, col: number) =>
  page
    .locator(`${pane} table.data-table tbody tr`)
    .evaluateAll(
      (rows, col) => rows.map((r) => r.children[col].textContent ?? ''),
      col
    )

test('reports sort by a column, largest first, then the other way', async ({
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
  await tab(page, 'Data Tables')
  const pane = '#dataPane-network'
  await expect(page.locator(`${pane} table.data-table`)).toBeVisible()
  const weightHeader = page.locator(`${pane} th.data-sort`, {
    hasText: 'Weight',
  })

  // numbers: largest first
  await weightHeader.click()
  await expect(weightHeader).toHaveAttribute('aria-sort', 'descending')
  const desc = (await column(page, pane, 4)).map(Number)
  expect(desc.length).toBeGreaterThan(2)
  for (let i = 1; i < desc.length; i++)
    expect(desc[i]).toBeLessThanOrEqual(desc[i - 1])

  // the other way round
  await weightHeader.click()
  await expect(weightHeader).toHaveAttribute('aria-sort', 'ascending')
  const asc = (await column(page, pane, 4)).map(Number)
  for (let i = 1; i < asc.length; i++)
    expect(asc[i]).toBeGreaterThanOrEqual(asc[i - 1])

  // text: A → Z, then Z → A (the node names of this network are numbers;
  // the layer names are text)
  const sourceHeader = page.locator(`${pane} th.data-sort`, {
    hasText: 'SourceLayer',
  })
  await sourceHeader.click()
  await expect(sourceHeader).toHaveAttribute('aria-sort', 'ascending')
  await expect(weightHeader).toHaveAttribute('aria-sort', 'none')
  const names = await column(page, pane, 1)
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
  })
  for (let i = 1; i < names.length; i++)
    expect(collator.compare(names[i - 1], names[i])).toBeLessThanOrEqual(0)
  await sourceHeader.click()
  await expect(sourceHeader).toHaveAttribute('aria-sort', 'descending')
  expect((await column(page, pane, 1))[0]).toBe(names[names.length - 1])

  // the Group Statistics report sorts too (a report another button produces)
  await tab(page, 'File')
  await page.locator('#groups_file').setInputFiles({
    name: 'groups.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from('Alpha\t1, 2, 3\nBeta\t3;4;5;6;7;8\nGamma\t9\n'),
  })
  await expect(page.locator('#file_status')).toContainText('3 groups applied')
  await tab(page, 'Analysis')
  await page.locator('#groupsStats').dispatchEvent('click')
  await expect(page.locator('#panel-data')).toHaveClass(/active/)
  const stats = '#dataPane-groupStats'
  await page
    .locator(`${stats} th.data-sort`, { hasText: 'Nodes' })
    .first()
    .click()
  const nodes = (await column(page, stats, 1)).map(Number)
  for (let i = 1; i < nodes.length; i++)
    expect(nodes[i]).toBeLessThanOrEqual(nodes[i - 1])
})
