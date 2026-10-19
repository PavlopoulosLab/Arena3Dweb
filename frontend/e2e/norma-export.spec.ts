import { expect, test } from './fixtures'
import path from 'node:path'

// Export to NORMA: the payload goes to <server>/api/external and the
// returned link opens in a new tab. normaviz.org is intercepted — the test
// never sends data to the real server.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

test('Open in NORMA posts the layers as groups and opens the link', async ({
  page,
  context,
}) => {
  let body: { groups: Record<string, string[]>; edges: unknown[] } | null = null
  await context.route('https://normaviz.org/**', async (route) => {
    if (route.request().url().endsWith('/api/external')) {
      body = route.request().postDataJSON() as typeof body
      return route.fulfill({
        json: {
          token: 'tok123',
          url: 'https://normaviz.org/norma.html?session=tok123',
          expiresInHours: 24,
        },
      })
    }
    return route.fulfill({
      contentType: 'text/html',
      body: '<title>NORMA</title>',
    })
  })
  await page.goto('/')
  await page.getByRole('tab', { name: 'File', exact: true }).click()
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  await page
    .getByRole('tab', { name: 'Export', exact: true })
    .dispatchEvent('click')
  await page
    .locator('#panel-export details')
    .evaluateAll((ds) =>
      ds.forEach((d) => ((d as HTMLDetailsElement).open = true))
    )

  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('#export_norma').click(),
  ])
  await expect(page.locator('#export_status')).toContainText(
    'Opened in NORMA (4 groups'
  )
  await popup.waitForURL('**/norma.html?session=tok123')
  expect(Object.keys(body!.groups)).toEqual([
    'Layer1',
    'Layer2',
    'Layer3',
    'Layer4',
  ])
  expect(body!.edges.length).toBeGreaterThan(100)

  // server errors are shown, the blank tab is closed
  await context.unroute('https://normaviz.org/**')
  await context.route('https://normaviz.org/**', (route) =>
    route.fulfill({
      status: 413,
      json: { message: 'The payload is larger than 50 MB.' },
    })
  )
  await page.locator('#export_norma').click()
  await expect(page.locator('#export_status')).toHaveText(
    'The payload is larger than 50 MB.'
  )
})
