import { expect, test } from './fixtures'
import path from 'node:path'

// PLAN-ROADMAP Phase 1: channel-weighted layouts. Upload the 3-channel aspirin
// example, turn on edge weights, give channels different weights, run a
// layout, and check the request body the panel sends.
// Inputs are driven with dispatchEvent/evaluate for the same render-loop
// starvation reason as network-flow.spec.ts.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const ASPIRIN = path.resolve('public/data/aspirin_3channels.tsv')

test('channel weights are sent with weighted layouts', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )

  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.locator('#input_network_file').setInputFiles(ASPIRIN)
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  await page
    .getByRole('tab', { name: 'Layout', includeHidden: true, exact: true })
    .dispatchEvent('click')

  const weights = page.locator('#channelColorLayoutDiv .channel_weight')
  await expect(weights).toHaveCount(3)
  // disabled until weighted layouts are switched on
  for (const w of await weights.all()) await expect(w).toBeDisabled()

  await page.locator('#useEdgeWeightsCheckbox').dispatchEvent('click')
  for (const w of await weights.all()) await expect(w).toBeEnabled()

  // first channel boosted, second out of range (clamped to 10), third blank (-> 1)
  await page.evaluate(() => {
    const inputs = document.querySelectorAll<HTMLInputElement>(
      '#channelColorLayoutDiv .channel_weight'
    )
    inputs[0].value = '5'
    inputs[1].value = '99'
    inputs[2].value = ''
  })
  const channels = await weights.evaluateAll((els) =>
    els.map((el) => (el as HTMLInputElement).dataset.channel!)
  )

  await page.locator('#subgraph_allLayers').dispatchEvent('click')
  await page.locator('#selectAllLayersCheckbox').dispatchEvent('click')
  await page.locator('#layoutAlgorithmChoice').evaluate((el) => {
    ;(el as HTMLSelectElement).value = 'Fruchterman-Reingold'
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })

  const [request, response] = await Promise.all([
    page.waitForRequest('**/api/layout'),
    page.waitForResponse('**/api/layout'),
    page.locator('#runLayout').dispatchEvent('click'),
  ])
  const body = request.postDataJSON() as {
    use_weights: boolean
    channel_weights: Record<string, number>
  }
  expect(body.use_weights).toBe(true)
  expect(body.channel_weights).toEqual({
    [channels[0]]: 5,
    [channels[1]]: 10,
    [channels[2]]: 1,
  })
  expect(response.status()).toBe(200)
  await expect(page.locator('#layouts_status')).toHaveText('Layout applied.')
})
