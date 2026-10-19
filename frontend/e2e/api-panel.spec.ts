import { expect, test } from './fixtures'

// Top bar → API (before Help): the REST API at a glance, code to copy in four
// languages, and the interactive Swagger UI, bundled and loaded on first open.

test('the API panel shows the facts, the code and the Swagger UI', async ({
  page,
}) => {
  await page.goto('/')
  const menu = page.getByRole('tab', { name: 'API', exact: true })
  // it sits just before Help in the top bar
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('#navbarTabs [data-menu]')].map(
      (b) => (b as HTMLElement).dataset.menu
    )
  )
  expect(order.indexOf('api')).toBe(order.indexOf('help') - 1)

  await menu.click()
  await expect(page.locator('#panel-api')).toHaveClass(/show/)
  await expect(page.locator('#apiBase')).toContainText('/api')
  await expect(page.locator('#apiVersion')).toHaveText(/\d+\.\d+\.\d+/)
  await expect(page.locator('#apiLimits')).toContainText('nodes')

  // four languages, one shown at a time
  await expect(page.locator('.api-tab')).toHaveCount(4)
  await page.locator('.api-tab[data-lang="Python"]').click()
  await expect(page.locator('.api-code[data-lang="Python"]')).toBeVisible()
  await expect(page.locator('.api-code[data-lang="curl"]')).toBeHidden()
  await expect(page.locator('.api-code[data-lang="Python"]')).toContainText(
    'requests.post'
  )

  // Swagger UI lists the endpoints from /api/openapi.json
  const paths = page.locator('#swaggerUi .opblock-summary-path')
  await expect(paths.first()).toBeVisible({ timeout: 30_000 })
  expect(await paths.count()).toBeGreaterThan(20)
  await expect(
    page.locator('#swaggerUi .opblock-summary-path', { hasText: '/api/open' })
  ).toHaveCount(1)
  await page.screenshot({ path: 'test-results/api-panel.png', fullPage: false })

  // Try it out: GET /api/config runs against this server
  const config = page.locator('#swaggerUi .opblock', {
    has: page.locator('.opblock-summary-path', { hasText: /^\/api\/config$/ }),
  })
  await config.locator('.opblock-summary').click()
  await config.getByRole('button', { name: 'Try it out' }).click()
  await config.getByRole('button', { name: 'Execute' }).click()
  await expect(
    config.locator('.live-responses-table tbody .response-col_status').first()
  ).toContainText('200')
  await page
    .locator('#swaggerUi')
    .screenshot({ path: 'test-results/api-swagger.png' })
})
