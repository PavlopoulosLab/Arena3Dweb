import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// Export → Other tools → Send to Flame: the node names of the layers go to
// Flame as gene lists in the link (its url_genes GET API), one list per layer
// or the selected layers combined; the lists can also be copied as text. The
// Flame server is intercepted — nothing reaches it.

const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

test('Open in Flame carries one gene list per layer, or one combined list', async ({
  page,
  context,
}) => {
  await context.route('https://pavlopoulos-lab-services.org/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Flame</title>' })
  )
  // the clipboard is stubbed: the copied text is kept on the window
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (t: string) => {
          ;(window as unknown as { __copied: string }).__copied = t
          return Promise.resolve()
        },
      },
    })
  })
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  await tab(page, 'Export')
  await page
    .locator('#panel-export details')
    .evaluateAll((ds) =>
      ds.forEach((d) => ((d as HTMLDetailsElement).open = true))
    )

  // one list per layer: four lists, ';' between them, ',' between genes
  const [perLayer] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('#open_flame').click(),
  ])
  const url = decodeURIComponent(perLayer.url())
  expect(url).toContain(
    'pavlopoulos-lab-services.org/shiny/app/flame?url_genes='
  )
  const lists = url.split('url_genes=')[1].split(';')
  expect(lists).toHaveLength(4)
  expect(lists[0].split(',').length).toBeGreaterThan(5)
  await expect(page.locator('#export_status')).toContainText(
    'Opened in Flame: 4 gene lists'
  )
  await perLayer.close()

  // two layers ticked and combined: one list, no duplicate names
  await tab(page, 'Layer selection')
  await page.locator('#checkbox_0').click()
  await page.locator('#checkbox_1').click()
  await tab(page, 'Export')
  await page.locator('#flame_mode').selectOption('combined')
  const [combined] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('#open_flame').click(),
  ])
  const one = decodeURIComponent(combined.url()).split('url_genes=')[1]
  expect(one).not.toContain(';')
  const genes = one.split(',')
  expect(new Set(genes).size).toBe(genes.length)
  await expect(page.locator('#export_status')).toContainText(
    'Opened in Flame: 1 gene list,'
  )
  await combined.close()

  // the same lists as text
  await page.locator('#flame_mode').selectOption('perLayer')
  await page.locator('#copy_flame').click()
  await expect(page.locator('#export_status')).toContainText(
    '2 gene lists copied'
  )
  const copied = await page.evaluate(
    () => (window as unknown as { __copied: string }).__copied
  )
  expect(copied).toContain('# Layer1\n')
  expect(copied).toContain('# Layer2\n')
})
