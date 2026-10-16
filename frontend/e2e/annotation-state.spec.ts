import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

// Annotation options are off while the network has no annotations and come
// on when a group file brings some.

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

test('pies, annotation hulls and annotation groups follow the data', async ({
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

  await tab(page, 'Analysis')
  await page.locator('#annotation_card summary').dispatchEvent('click')
  await expect(page.locator('#showPies')).toBeDisabled()
  await expect(page.locator('#hull_annotation')).toBeDisabled()
  await expect(page.locator('#hull_cluster')).toBeEnabled()
  await expect(page.locator('#annotationsNote')).toBeVisible()
  await expect(
    page.locator('#groupsSource option[value="annotation"]')
  ).toBeDisabled()
  await tab(page, 'Layout')
  await expect(
    page.locator('#groupSource option[value="annotations"]')
  ).toBeDisabled()
  await tab(page, 'Style')
  await expect(
    page.locator('#styleColorBy option[value="annotation"]')
  ).toBeDisabled()

  // a group file brings annotations: everything switches on
  await tab(page, 'File')
  await page.locator('#groups_file').setInputFiles({
    name: 'groups.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from('Alpha\t1, 2, 3\nBeta\t3;4;5;6\n'),
  })
  await expect(page.locator('#file_status')).toContainText('2 groups applied')
  await tab(page, 'Analysis')
  await expect(page.locator('#showPies')).toBeEnabled()
  await expect(page.locator('#hull_annotation')).toBeEnabled()
  await expect(page.locator('#annotationsNote')).toBeHidden()
  await expect(
    page.locator('#groupsSource option[value="annotation"]')
  ).toBeEnabled()
  await page.locator('#hull_annotation').dispatchEvent('click')
  await expect(page.locator('#hull_annotation')).toBeChecked()

  // a network without annotations: back off, the hull choice falls back
  await tab(page, 'File')
  await page
    .locator('#input_network_file')
    .setInputFiles(path.resolve('public/data/figure2B_data.tsv'))
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  await tab(page, 'Analysis')
  await expect(page.locator('#showPies')).toBeDisabled()
  await expect(page.locator('#hull_none')).toBeChecked()
})
