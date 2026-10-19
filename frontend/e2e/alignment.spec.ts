import { expect, openCard, test, type Page } from './fixtures'
import path from 'node:path'

// Pseudo-alignment across layers: anchoring/soft alignment lowers the
// reported inter-layer misalignment compared with independent layouts.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

async function run(page: Page): Promise<number> {
  await page.locator('#runLayout').dispatchEvent('click')
  await expect(page.locator('#layouts_status')).toHaveText('Layout applied.')
  const text = (await page.locator('#layout_score').textContent()) ?? ''
  return Number(/misalignment: ([\d.]+)%/.exec(text)![1])
}

test('alignment modes reduce cross-layer misalignment', async ({ page }) => {
  test.setTimeout(120_000)
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
  await page
    .locator('#layoutAlgorithmChoice')
    .selectOption('Fruchterman-Reingold')

  const free = await run(page)
  await page
    .getByRole('tab', { name: '3D View', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/alignment-none.png' })
  await page
    .getByRole('tab', { name: 'Layout', includeHidden: true, exact: true })
    .dispatchEvent('click')

  await openCard(page, '#alignmentCard')
  await page.locator('#alignmentMode').selectOption('anchor')
  await expect(page.locator('#alignmentReference')).toBeVisible()
  await page.locator('#alignmentReference').selectOption('Layer2')
  await page.locator('#alignmentStrength').fill('1')
  const anchored = await run(page)
  expect(anchored).toBeLessThan(free / 2)
  await page
    .getByRole('tab', { name: '3D View', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/alignment-anchor.png' })
  await page
    .getByRole('tab', { name: 'Layout', includeHidden: true, exact: true })
    .dispatchEvent('click')

  await page.locator('#alignmentMode').selectOption('soft')
  await page.locator('#alignmentStrength').fill('0.5')
  const soft = await run(page)
  expect(soft).toBeLessThan(free)

  await page.locator('#alignmentMode').selectOption('chain')
  expect(await run(page)).toBeLessThan(free)

  // other scopes lock the alignment instead of mixing it in; Run Aligned
  // Layout brings the Per Layer scope back and runs
  await page.locator('#subgraph_allLayers').dispatchEvent('click')
  await expect(page.locator('#alignmentMode')).toBeDisabled()
  await expect(page.locator('#alignmentNote')).toContainText('Per Layer')
  await page.locator('#runAlignedLayout').dispatchEvent('click')
  await expect(page.locator('#subgraph_perLayer')).toBeChecked()
  await expect(page.locator('#layouts_status')).toHaveText('Layout applied.', {
    timeout: 60000,
  })
  await expect(page.locator('#alignmentMode')).toBeEnabled()
  expect(await page.locator('#layout_score').textContent()).toContain(
    'misalignment'
  )
})
