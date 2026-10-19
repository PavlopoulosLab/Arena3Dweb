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

// Both example pickers (File → Example and the Home page's) group the
// examples by category, in one order, and keep the four weighted layers as
// the default choice; Help → Examples has a section per category.
test('the example pickers and Help list the examples by category', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  const categories = [
    'Biological networks',
    'Layer geometry and 3D',
    'Hive plots',
    'Neural networks',
    'Small examples and file formats',
  ]
  const pickers = await page.evaluate(() =>
    ['#exampleChoice', '#homeExampleChoice'].map((id) => {
      const select = document.querySelector<HTMLSelectElement>(id)!
      return {
        groups: [...select.querySelectorAll('optgroup')].map((g) => ({
          label: g.label,
          options: [...g.querySelectorAll('option')].map((o) => o.text),
        })),
        options: select.options.length,
        chosen: select.selectedOptions[0]?.text,
      }
    })
  )
  const [file, home] = pickers
  expect(file.groups.map((g) => g.label)).toEqual(categories)
  expect(home.groups).toEqual(file.groups)
  expect(file.groups.every((g) => g.options.length > 0)).toBe(true)
  // every option sits in a group
  expect(file.groups.flatMap((g) => g.options)).toHaveLength(file.options)
  expect(file.chosen).toBe('Four weighted layers')
  expect(home.chosen).toBe('Four weighted layers')
  expect(
    file.groups.find((g) => g.label === 'Hive plots')!.options
  ).toHaveLength(6)
  expect(
    file.groups
      .find((g) => g.label === 'Neural networks')!
      .options.every((o) => o.startsWith('Neural network:'))
  ).toBe(true)
  const sections = await page
    .locator('#Examples_tab h3')
    .evaluateAll((hs) => hs.map((h) => h.textContent))
  expect(sections).toEqual([...categories, 'Scripts'])
})
