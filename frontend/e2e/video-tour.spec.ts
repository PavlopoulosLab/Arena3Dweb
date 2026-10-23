import { expect, test, type Page } from './fixtures'

// The video tour on Home and in Help: a still with a play button, nothing
// asked of YouTube until it is pressed, then YouTube's privacy-enhanced
// player; a chapter starts the video at that chapter.

const ready = (page: Page) =>
  page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )

test('the tour loads nothing from YouTube until it is played, on Home and in Help', async ({
  page,
}) => {
  // answer YouTube with an empty page, so the test stays offline
  const youtube: string[] = []
  await page.route(
    /youtube(-nocookie)?\.com|ytimg\.com|googlevideo\.com/,
    (route) => {
      youtube.push(route.request().url())
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><title>player</title>',
      })
    }
  )
  await page.goto('/')
  await ready(page)
  const home = page.locator('#homeTour')
  const still = home.locator('.tour__poster img')
  await expect(still).toBeVisible()
  // the still is Arena3D's own, not YouTube's thumbnail
  await expect(still).toHaveAttribute('src', /images\/video\/tour\.jpg$/)
  await expect
    .poll(() => still.evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBe(1280)
  await expect(page.locator('#panel-home .tour__chapter')).toHaveCount(13)
  expect(youtube).toEqual([])

  await home.locator('.tour__poster').click()
  const frame = home.locator('iframe')
  await expect(frame).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/M_uWFOXeXUc?autoplay=1&rel=0&start=0'
  )
  await expect.poll(() => youtube.length).toBeGreaterThan(0)
  await page
    .locator('#panel-home .tour__chapter', { hasText: 'Analysis' })
    .click()
  await expect(frame).toHaveAttribute('src', /start=149$/)

  // Help → Getting Started has a player of its own, not framed as a screenshot
  await page
    .getByRole('tab', { name: 'Help', includeHidden: true, exact: true })
    .dispatchEvent('click')
  const help = page.locator('#helpTour')
  await expect(help.locator('.tour__poster img')).toBeVisible()
  await expect(page.locator('#Start_tab .help-tour figure')).toHaveCount(0)
  await expect(page.locator('#Start_tab .tour__chapter')).toHaveCount(13)
  await page.locator('#Start_tab .tour__chapter', { hasText: 'Themes' }).click()
  await expect(help.locator('iframe')).toHaveAttribute('src', /start=199$/)
})
