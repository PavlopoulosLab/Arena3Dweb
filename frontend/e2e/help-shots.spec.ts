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
// some twenty panels at 2×, with a knockout and two attacks: minutes on a busy
// machine
test.setTimeout(900_000)

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
      // a folded card's contents still have boxes: only its title shows
      const shut = c.closest('details:not([open])')
      if (shut && !(c.tagName === 'SUMMARY' && c.parentElement === shut))
        continue
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

// Edit → Attributes: eight ticked rows listed alone, so the shot is short
// and shows the bulk-edit line
async function attributeRows(page: Page) {
  const tick = (k: number) =>
    page.locator(
      `#attrNodeTable .attr-row[aria-rowindex="${k + 2}"] [data-f="tick"]`
    )
  await tick(0).check()
  await tick(7).click({ modifiers: ['Shift'] })
  await page.locator('#attrNodeSelectedOnly').check()
}

test('capture the interface screenshots for the Help pages', async ({
  page,
}) => {
  fs.mkdirSync(OUT, { recursive: true })
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  // Home: the featured examples and the picker with every example
  const examples = page.locator('.home-section', {
    has: page.locator('.home-examples'),
  })
  await examples.scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  const box = await examples.boundingBox()
  if (!box) throw new Error('the Home examples are not shown')
  await page.screenshot({
    path: `${OUT}/home.jpg`,
    type: 'jpeg',
    quality: 90,
    clip: {
      x: box.x - 24,
      y: box.y - 24,
      width: box.width + 48,
      height: box.height + 48,
    },
  })
  await page.locator('#panel-home').evaluate((el) => el.scrollTo(0, 0))
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
  // the cards open, their tools listed (sub-sections folded)
  await panel(page, 'Export', '#panel-export', 'export', async () => {
    await page
      .locator('#panel-export details.lp-section')
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
  await panel(page, 'Attributes', '#panel-attributes', 'attributes', () =>
    attributeRows(page)
  )
  // untick them again: the 3D view shot shows no selection
  await page.locator('#attrNodeTickAll').uncheck()
  await page.locator('#attrNodeSelectedOnly').uncheck()
  // a degree histogram, the four layers overlaid, with its summary table
  await panel(page, 'Plots', '#panel-plots', 'plots', async () => {
    await page.locator('#plotKind').selectOption('histogram')
    await page.locator('#plotSource').selectOption('metric:Degree')
    await page.locator('#plotDraw').click()
    await expect(page.locator('#plot_status')).toContainText(
      'Drawn: Histogram',
      { timeout: 60_000 }
    )
  })
  // the top 5 nodes by degree knocked out, and a degree attack against
  // random failure on the robustness chart; with both cards open the panel
  // is taller than the window
  await panel(
    page,
    'Perturbation',
    '#panel-perturbation',
    'perturbation',
    async () => {
      await page.setViewportSize({ width: 1440, height: 1900 })
      await page.locator('#koNodes').selectOption('top')
      await page.locator('#runKnockout').click()
      await expect(page.locator('#perturb_status')).toContainText(
        'Knocked out 5 nodes',
        { timeout: 60_000 }
      )
      await page.locator('#attackStrategy').selectOption('degree')
      await page.locator('#runAttack').click()
      const attack = page.locator('#attack_status')
      await expect(attack).toContainText('robustness R =', { timeout: 120_000 })
      await page.locator('#attackKeep').check()
      await page.locator('#attackStrategy').selectOption('random')
      await page.locator('#runAttack').click()
      await expect(attack).toContainText('random failure', { timeout: 120_000 })
    }
  )
  await page.setViewportSize({ width: 1440, height: 1500 })
  // the nodes as they were, for the 3D view shot
  await page.locator('#koRestore').click()

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
  await panel(page, 'Metrics', '#panel-metrics', 'analyze')
  await panel(page, 'Data Tables', '#panel-data', 'data')
  await panel(page, 'Performance', '#panel-fps', 'performance')
  // at the end, as it recolours the nodes: communities found, so the panel
  // shows its summary
  await panel(
    page,
    'Clustering',
    '#panel-clustering',
    'clustering',
    async () => {
      await page.locator('#runClustering').dispatchEvent('click')
      await expect(page.locator('#cluster_status')).toContainText(
        'nodes coloured by community',
        { timeout: 60_000 }
      )
    }
  )
  // the communities kept as an annotation set, drawn as fog clouds, and the
  // group list
  await page.locator('#clustersToAnnotations').dispatchEvent('click')
  await panel(
    page,
    'Annotations',
    '#panel-annotation-view',
    'annotations',
    async () => {
      await page.locator('#hull_annotation').check()
      await page.locator('#hullStyle_fog').check()
    }
  )
})
