import { expect, test, type Page } from './fixtures'

// The Home page as a landing page: its calls to action open the right panels,
// a featured example card loads its network, and the citations copy.

const home = (page: Page) =>
  page
    .getByRole('tab', { name: 'Home', includeHidden: true, exact: true })
    .dispatchEvent('click')

test('the landing page leads to the File panel, the importers and an example', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await expect(page.locator('.home-title')).toContainText(
    'Multilayered networks'
  )
  await expect(page.locator('.home-feature')).toHaveCount(6)
  await expect(page.locator('.home-stat')).toHaveCount(5)

  await page.locator('#link_to_fileInput').click()
  await expect(page.locator('#panel-file')).toHaveClass(/show/)

  await home(page)
  await page.locator('#homeToDatabases').click()
  await expect(page.locator('#panel-databases')).toHaveClass(/show/)

  // a featured example opens straight away (the fixture answers Import as)
  await home(page)
  const card = page.locator('.home-example', {
    hasText: 'Four weighted layers',
  })
  await expect(card).toBeVisible()
  await card.click()
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  const layers = await page.evaluate(
    () =>
      (window as unknown as { __arena: { ctx: { layers: unknown[] } } }).__arena
        .ctx.layers.length
  )
  expect(layers).toBe(4)
})

test('the hero button opens the first featured example', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page.locator('#homeHeroExample').click()
  await expect(page.locator('#file_status')).toContainText('Loaded network')
})

test('each citation copies to the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  const copy = page.locator('.home-cite__copy')
  await expect(copy).toHaveCount(2)
  await copy.first().click()
  await expect(copy.first()).toHaveText('Copied')
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toContain('NAR Genomics and Bioinformatics')
  expect(text).toContain('Arena3Dweb')
})
