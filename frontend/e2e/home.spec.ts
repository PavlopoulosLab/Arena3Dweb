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
    hasText: 'Six layers',
  })
  await expect(card).toBeVisible()
  await card.click()
  await expect(page.locator('#file_status')).toContainText('Session loaded')
  const layers = await page.evaluate(
    () =>
      (window as unknown as { __arena: { ctx: { layers: unknown[] } } }).__arena
        .ctx.layers.length
  )
  expect(layers).toBe(6)
})

test('the spheres card opens four layers in glowing spheres, their links bundled', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .locator('.home-example', { hasText: 'Layers in 3D spheres' })
    .click()
  await expect(page.locator('#file_status')).toContainText('Session loaded')
  const scene = await page.evaluate(() => {
    const ctx = (
      window as unknown as {
        __arena: {
          ctx: { layers: { container: string }[]; interEdgeBundling: number }
        }
      }
    ).__arena.ctx
    return {
      containers: ctx.layers.map((l) => l.container),
      bundling: ctx.interEdgeBundling,
    }
  })
  expect(scene.containers).toEqual(['bubble', 'bubble', 'bubble', 'bubble'])
  expect(scene.bundling).toBeGreaterThan(0.5)
})

test('the hero button opens the first featured example', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page.locator('#homeHeroExample').click()
  await expect(page.locator('#file_status')).toContainText('Session loaded')
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

test('free and open to all with no login, the licence, and Privacy & data from Home and the footer', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await expect(page.locator('.home-eyebrow')).toHaveText(
    'Free and open to all users · no login required'
  )
  await expect(page.locator('.home-terms a[href$="/LICENSE"]')).toHaveText(
    'GNU AGPL v3'
  )
  await page.locator('#homeToPrivacy').click()
  await expect(page.locator('#panel-help')).toHaveClass(/show/)
  const privacy = page.locator('#Privacy_tab')
  await expect(privacy).toBeVisible()
  await expect(privacy).toContainText('no login, no registration')
  await expect(privacy).toContainText('deleted after one hour')
  await expect(privacy).toContainText('sets no cookies')

  // the footer opens the same page, its link clear of an open drawer (Home
  // covers the footer)
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await expect(page.locator('#panel-file')).toHaveClass(/show/)
  await expect(privacy).toBeHidden()
  await page.locator('#footerPrivacy').click()
  await expect(privacy).toBeVisible()
})
