import { expect, test } from './fixtures'

// The scene legend frames the entries of selected layers in the yellow their
// floors turn, whichever way the layers were selected.

test('selected layers are framed in the legend', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#input_network_file')
    .setInputFiles('public/data/figure2A_data.tsv')
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  const entries = page.locator('#legend .legend-entry')
  await expect(entries).toHaveCount(4)
  await expect(page.locator('#legend .legend-entry.is-selected')).toHaveCount(0)

  // tick the second layer in the Layer selection tab
  await page
    .getByRole('tab', {
      name: 'Layer selection',
      includeHidden: true,
      exact: true,
    })
    .dispatchEvent('click')
  await page.locator('#checkbox_1').click()
  const framed = page.locator('#legend .legend-entry.is-selected')
  await expect(framed).toHaveCount(1)
  await expect(framed).toHaveAttribute('data-label', 'Layer2')
  await expect(framed).toHaveCSS('border-top-color', 'rgb(247, 244, 62)')

  // …and untick it: the frame goes
  await page.locator('#checkbox_1').click()
  await expect(page.locator('#legend .legend-entry.is-selected')).toHaveCount(0)
})
