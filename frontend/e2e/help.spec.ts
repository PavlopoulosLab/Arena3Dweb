import { expect, test } from '@playwright/test'

// Help: every page opens; file formats are shown as tables, not tab-separated
// text; the How-to page holds its recipes; images and example downloads work.

test('help pages, format tables, how-to, images and example links', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'Help', includeHidden: true, exact: true })
    .dispatchEvent('click')
  const buttons = page.locator('#helpDiv .tablinks')
  const n = await buttons.count()
  expect(n).toBeGreaterThanOrEqual(16)
  for (let i = 0; i < n; i++) {
    await buttons.nth(i).dispatchEvent('click')
    await expect(page.locator('#helpDiv .tabcontent:visible')).toHaveCount(1)
  }

  await page
    .locator('#helpDiv [data-help-tab="File_tab"]')
    .dispatchEvent('click')
  // six file formats as tables; no tab-separated <pre> examples left
  expect(await page.locator('#File_tab table.help-tsv').count()).toBe(6)
  const tabbedPre = await page
    .locator('#File_tab pre')
    .evaluateAll(
      (els) => els.filter((e) => e.textContent?.includes('\t')).length
    )
  expect(tabbedPre).toBe(0)
  await expect(
    page
      .locator('#File_tab .help-tsv-note', { hasText: 'Network file' })
      .locator('xpath=following-sibling::table[1]')
      .locator('th')
  ).toHaveCount(6)

  await page
    .locator('#helpDiv [data-help-tab="Howto_tab"]')
    .dispatchEvent('click')
  expect(await page.locator('#Howto_tab h3').count()).toBeGreaterThanOrEqual(11)
  await expect(page.locator('#Howto_tab')).toContainText('Upload node VALUES')

  const broken = await page.evaluate(async () => {
    const imgs = [
      ...document.querySelectorAll<HTMLImageElement>('#helpDiv img'),
    ]
    // lazy images in hidden pages never load on their own: force them
    for (const i of imgs) i.loading = 'eager'
    await Promise.all(
      imgs.map((i) =>
        i.complete
          ? Promise.resolve()
          : new Promise<void>((r) => {
              i.onload = () => r()
              i.onerror = () => r()
            })
      )
    )
    return imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'))
  })
  expect(broken).toEqual([])
  const links = await page
    .locator('#helpDiv a[download]')
    .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))
  expect(links.length).toBeGreaterThan(20)
  for (const href of links)
    expect((await page.request.get(href)).ok()).toBe(true)
})
