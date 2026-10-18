import { expect, test } from './fixtures'

// The Home page's example picker loads any bundled example — here the GPCR
// session whose layers are spheres.
test('Home page loads a chosen example', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .locator('#homeExampleChoice')
    .selectOption({ label: 'GPCR signalling, layers as spheres' })
  await page.locator('#homeLoadExample').click()
  await expect(page.locator('#file_status')).toContainText('Session loaded')
  const containers = await page.evaluate(() =>
    (
      window as unknown as {
        __arena: { ctx: { layers: { container: string }[] } }
      }
    ).__arena.ctx.layers.map((l) => l.container)
  )
  expect(containers.length).toBe(4)
  expect(new Set(containers)).toEqual(new Set(['sphere']))
})

test('the SARS-CoV-2 example opens undirected: no arrows', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#exampleChoice')
    .selectOption({ label: 'SARS-CoV-2 host–virus network (5 layers)' })
  await page.locator('#exampleButton').click()
  await expect(page.locator('#file_status')).toContainText('Session loaded', {
    timeout: 30_000,
  })
  const directed = await page.evaluate(
    () =>
      (
        window as unknown as {
          __arena: { ctx: { isDirectionEnabled: boolean } }
        }
      ).__arena.ctx.isDirectionEnabled
  )
  expect(directed).toBe(false)
})
