import { expect, test } from './fixtures'

// 2D navigator: appears on network load and its thumbnail re-projects when the
// scene rotates (the core requirement — it must always show the current
// monitor 2D projection).

test('minimap shows on load and redraws on rotation', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )

  // Hidden until a network exists.
  await expect(page.locator('#minimap')).toBeHidden()

  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.getByRole('button', { name: 'Load Example' }).click()
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  const minimap = page.locator('#minimap')
  await expect(minimap).toBeVisible()

  const snapshot = () =>
    page.evaluate(() =>
      (
        document.querySelector('#minimap canvas') as HTMLCanvasElement
      ).toDataURL()
    )

  // Let the render loop draw at least one frame.
  await page.waitForFunction(() => {
    const c = document.querySelector('#minimap canvas') as HTMLCanvasElement
    const g = c.getContext('2d')!
    const { data } = g.getImageData(0, 0, c.width, c.height)
    return data.some((v) => v !== 0) // something was drawn
  })

  const before = await snapshot()

  // Rotate the scene; the thumbnail must change.
  await page.evaluate(() => {
    ;(
      window as unknown as {
        __arena: { ctx: { scene: { rotateY: (r: number) => void } } }
      }
    ).__arena.ctx.scene.rotateY(0.6)
  })
  await page.waitForFunction(
    (prev) =>
      (
        document.querySelector('#minimap canvas') as HTMLCanvasElement
      ).toDataURL() !== prev,
    before,
    { timeout: 5_000 }
  )

  // Toggle via the Scene panel hides it. dispatchEvent, not click()/uncheck():
  // the post-load WebGL render loop saturates the main thread on headless CI,
  // so Playwright's actionability wait times out — fire the handler directly.
  await page
    .getByRole('tab', {
      name: 'Scene & Camera',
      includeHidden: true,
      exact: true,
    })
    .dispatchEvent('click')
  await page.locator('#toggleMinimap').dispatchEvent('click')
  await expect(minimap).toBeHidden()

  // Performance → Navigator refresh Off hides it and unticks the box; ticking
  // the box shows it again and turns the refresh back on, so it draws
  const choose = (id: string, value: string) =>
    page.locator(id).evaluate((el, v) => {
      ;(el as HTMLSelectElement).value = v
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
  await page.locator('#toggleMinimap').dispatchEvent('click')
  await expect(minimap).toBeVisible()
  await choose('#perf_minimap', '0')
  await expect(minimap).toBeHidden()
  await expect(page.locator('#toggleMinimap')).not.toBeChecked()
  await page.locator('#toggleMinimap').dispatchEvent('click')
  await expect(minimap).toBeVisible()
  await expect(page.locator('#perf_minimap')).toHaveValue('1')
  // another Performance change leaves an unticked navigator hidden
  await page.locator('#toggleMinimap').dispatchEvent('click')
  await expect(minimap).toBeHidden()
  await choose('#perf_minimap', '3')
  await choose('#perf_detail', 'low')
  await expect(minimap).toBeHidden()
})
