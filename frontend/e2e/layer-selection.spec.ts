import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

// Top bar → Layer selection: the layers to work on are ticked in a tab of
// their own; the Layout panel only reports the count and opens the tab, and
// the tab steps aside in Single network mode.

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

test('layers are ticked in the Layer selection tab', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page
    .locator('#input_network_file')
    .setInputFiles(path.resolve('public/data/figure2A_data.tsv'))
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  await tab(page, 'Layer selection')
  await expect(page.locator('#panel-layer-selection')).toHaveClass(/active/)
  await expect(page.locator('#checkboxdiv .layer-row')).toHaveCount(4)
  await expect(
    page.locator('#checkboxdiv .layer-row__count').first()
  ).toHaveText(/\d+ nodes/)
  await expect(page.locator('#layerSelectionCount')).toHaveText(
    'No layer selected: all 4 are used.'
  )

  await page.locator('#selectAllLayersCheckbox').click()
  await expect(page.locator('#layerSelectionCount')).toHaveText(
    '4 of 4 layers selected.'
  )
  await expect(page.locator('#checkbox_2')).toBeChecked()
  await page.locator('#invertLayerSelection').click()
  await expect(page.locator('#layerSelectionCount')).toHaveText(
    'No layer selected: all 4 are used.'
  )
  await page.locator('#checkbox_1').click()
  await expect(page.locator('#layerSelectionCount')).toHaveText(
    '1 of 4 layers selected.'
  )
  await expect(page.locator('#selectAllLayersCheckbox')).not.toBeChecked()

  // the Layout panel reports the same and opens the tab
  await tab(page, 'Layout')
  await expect(page.locator('#layoutLayerSummary')).toHaveText(
    '1 of 4 layers selected.'
  )
  await page.locator('#openLayerSelection').click()
  await expect(page.locator('#panel-layer-selection')).toHaveClass(/active/)

  // the Analysis panel follows the ticks too
  await tab(page, 'Analysis')
  await expect(page.locator('#analyzeLayers')).toContainText(
    '1 layer(s) ticked in Layer selection'
  )

  // one graph: no layers to pick
  await page.locator('#modeSingle').dispatchEvent('click')
  await expect(page.locator('body')).toHaveClass(/mode-single/, {
    timeout: 15000,
  })
  await expect(
    page.locator('[data-bs-target="#panel-layer-selection"]')
  ).toBeHidden()
})
