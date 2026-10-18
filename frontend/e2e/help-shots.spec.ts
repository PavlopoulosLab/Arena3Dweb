import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from './fixtures'

// Refreshes the interface screenshots embedded in the Help pages
// (public/images/help/ui/*). Skipped in the normal run; after a panel
// changes, refresh them with `npm run help:shots` (the backend must be on
// :8000 like for every e2e spec) and check the images before committing.

const OUT = path.resolve('public/images/help/ui')
const D = (f: string) => path.resolve('public/data', f)

test.skip(
  !process.env.HELP_SHOTS,
  'set HELP_SHOTS=1 (npm run help:shots) to refresh the Help screenshots'
)
test.use({
  locale: 'en-US',
  viewport: { width: 1440, height: 1500 },
  deviceScaleFactor: 2,
})
test.setTimeout(300_000)

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

async function session(page: Page, file: string) {
  await tab(page, 'File')
  await page.locator('#load_network_file').setInputFiles(D(file))
  await expect(page.locator('#file_status')).toContainText('Session loaded')
}

// a drawer panel, once it has slid in
async function panel(
  page: Page,
  name: string,
  pane: string,
  file: string,
  prepare?: () => Promise<void>
) {
  await tab(page, name)
  await expect(page.locator(pane)).toHaveClass(/show/)
  await prepare?.()
  await page.waitForTimeout(700)
  // a session that is still settling (a 3D layout coming back from the
  // server) switches to the 3D view on its own: open the panel again
  if (!(await page.locator(pane).isVisible())) {
    await tab(page, name)
    await page.waitForTimeout(700)
  }
  await expect(page.locator(pane)).toBeVisible()
  // the drawer is as tall as the window: crop it under its last visible
  // control (leaf elements only, clipped to their scrolling parents); number
  // inputs are shown as text so the OS locale does not swap the decimal point
  const clip = await page.locator(pane).evaluate((el) => {
    for (const input of el.querySelectorAll<HTMLInputElement>(
      'input[type="number"]'
    )) {
      const v = input.value
      input.type = 'text'
      input.value = v
    }
    const r = el.getBoundingClientRect()
    let bottom = r.top
    const leaf = (c: Element) =>
      c.children.length === 0 ||
      /^(SELECT|BUTTON|TEXTAREA|svg|SUMMARY|LABEL)$/.test(c.tagName)
    for (const c of el.querySelectorAll<HTMLElement>('*')) {
      if (!leaf(c)) continue
      const b = c.getBoundingClientRect()
      if (b.height <= 0 || b.width <= 0) continue
      let limit = b.bottom
      for (let p = c.parentElement; p && p !== el; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY
        if (o === 'auto' || o === 'scroll' || o === 'hidden')
          limit = Math.min(limit, p.getBoundingClientRect().bottom)
      }
      if (limit > bottom && limit <= r.bottom) bottom = limit
    }
    return {
      x: r.left,
      y: r.top,
      width: r.width,
      height: Math.min(r.height, bottom - r.top + 28),
    }
  })
  await page.screenshot({
    path: `${OUT}/${file}.png`,
    clip,
    animations: 'disabled',
  })
}

test('capture the interface screenshots for the Help pages', async ({
  page,
}) => {
  fs.mkdirSync(OUT, { recursive: true })
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  // Home: the example picker
  await page.waitForTimeout(600)
  await page.screenshot({
    path: `${OUT}/home.jpg`,
    type: 'jpeg',
    quality: 90,
    clip: { x: 0, y: 0, width: 1440, height: 900 },
  })
  // the top bar with a grouped menu open
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.waitForTimeout(300)
  await page.screenshot({
    path: `${OUT}/topbar.png`,
    clip: { x: 0, y: 0, width: 1440, height: 320 },
  })
  await page.keyboard.press('Escape')

  await session(page, 'figure2A_export.json')
  await panel(page, 'File', '#panel-file', 'file')
  // the Reactome search is mocked so the shot does not depend on the network
  await page.route('**/api/import/reactome/search**', (route) =>
    route.fulfill({
      json: [
        { id: 'R-HSA-109581', name: 'Apoptosis', detail: 'Homo sapiens' },
        {
          id: 'R-HSA-5357801',
          name: 'Programmed Cell Death',
          detail: 'Homo sapiens',
        },
        {
          id: 'R-HSA-111457',
          name: 'Release of apoptotic factors from the mitochondria',
          detail: 'Homo sapiens',
        },
      ],
    })
  )
  await panel(
    page,
    'Database Importers',
    '#panel-databases',
    'databases',
    async () => {
      await page.locator('#card_string > summary').click()
      await page
        .locator('#db_identifiers')
        .fill('TP53 MDM2 CDKN1A ATM CHEK2 BAX')
      await page.locator('#card_reactome summary').click()
      await page.locator('#reactome_query').fill('apoptosis')
      await page.locator('#reactome_search').click()
      await expect(page.locator('#reactome_results .db-hit')).toHaveCount(3)
      await page.locator('#reactome_results .db-hit').first().click()
    }
  )
  await page.unroute('**/api/import/reactome/search**')
  await panel(page, 'Find', '#panel-find', 'find', async () => {
    await page.locator('#nodeSearchBar').fill('^CDK')
    await page.locator('#nodeSearchMode').selectOption('regex')
    await page.locator('#nodeSearchButton').click()
  })
  await panel(page, 'Export', '#panel-export', 'export', async () => {
    await page
      .locator('#panel-export details')
      .evaluateAll((ds) =>
        ds.forEach((d) => ((d as HTMLDetailsElement).open = true))
      )
  })
  await panel(
    page,
    'Layer selection',
    '#panel-layer-selection',
    'layer_selection'
  )
  await panel(page, 'Layout', '#panel-layouts', 'layout')
  await panel(page, 'Scene & Camera', '#panel-scene', 'scene')
  await panel(page, 'Layers', '#panel-layer', 'layers')
  await panel(page, 'Nodes', '#panel-node', 'nodes')
  await panel(page, 'Edges', '#panel-edge', 'edges')
  await panel(page, 'Style', '#panel-style', 'style')

  // the navigation controls box (#info) in full, then the 3D view at a
  // usual window size
  await tab(page, '3D View')
  await page.waitForTimeout(1500)
  await page.locator('#info').screenshot({ path: `${OUT}/navcontrols.png` })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/view.jpg`, type: 'jpeg', quality: 90 })
  await page.setViewportSize({ width: 1440, height: 1500 })

  // a session with annotations fills the Groups card and the tables
  await session(page, 'covid19_3d_network.json')
  await expect(page.locator('#panel-main-view')).toHaveClass(/active/)
  await page.waitForTimeout(3000)
  await panel(page, 'Analysis', '#panel-analyze', 'analyze')
  await panel(page, 'Data Tables', '#panel-data', 'data')
  await panel(page, 'Performance', '#panel-fps', 'performance')
})
