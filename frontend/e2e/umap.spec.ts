import { expect, test, type Page } from './fixtures'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// UMAP: a layout algorithm in the Layout panel (topology, attribute or hybrid
// mode; backend services/umap_layout.py) and a view in Export → Other tools
// (scatter SVG/PNG, coordinates CSV, the Vega editor). The first UMAP run in a
// server worker compiles numba kernels (~20 s), hence the long timeouts.

const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')
const SLOW = { timeout: 75_000 }

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

async function loadFigure2A(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
}

// node id -> [y, z] in its layer plane
const positions = (page: Page) =>
  page.evaluate(() => {
    const a = (
      window as unknown as {
        __arena: {
          ctx: {
            nodeLayerNames: string[]
            nodeObjects: { getPosition: (axis: string) => number }[]
          }
        }
      }
    ).__arena.ctx
    return Object.fromEntries(
      a.nodeObjects.map((n, i) => [
        a.nodeLayerNames[i],
        [n.getPosition('y'), n.getPosition('z')],
      ])
    )
  })

// sets a <select> as a user would (the panel may sit in a closed drawer)
const choose = (page: Page, id: string, value: string) =>
  page.locator(id).evaluate((el, v) => {
    ;(el as HTMLSelectElement).value = v
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)

async function chooseUmap(page: Page, mode: string): Promise<void> {
  await tab(page, 'Layout')
  await page.locator('#selectAllLayersCheckbox').dispatchEvent('click')
  await choose(page, '#layoutAlgorithmChoice', 'UMAP')
  await expect(page.locator('#umapOptionsBox')).not.toHaveClass(/d-none/)
  await choose(page, '#umapMode', mode)
}

async function exportFile(page: Page, button: string): Promise<string> {
  const [dl] = await Promise.all([
    page.waitForEvent('download', SLOW),
    page.locator(button).click(),
  ])
  const file = path.join(os.tmpdir(), `arena3d-e2e-${dl.suggestedFilename()}`)
  await dl.saveAs(file)
  return file
}

test('Topology UMAP layout (undoable) and the UMAP view in Export → Other tools', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000)
  await context.route('https://vega.github.io/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html>stub</html>' })
  )
  await loadFigure2A(page)
  await chooseUmap(page, 'topology')
  await expect(page.locator('#umapFeatureBox')).toHaveClass(/d-none/)
  const before = await positions(page)
  const [request] = await Promise.all([
    page.waitForRequest('**/api/layout'),
    page.locator('#runLayout').dispatchEvent('click'),
  ])
  expect(request.postDataJSON()).toMatchObject({
    algorithm: 'UMAP',
    seed: 42,
    umap: { mode: 'topology', n_neighbors: 15, min_dist: 0.1 },
  })
  await expect(page.locator('#layouts_status')).toHaveText(
    'Layout applied.',
    SLOW
  )
  const after = await positions(page)
  const ids = Object.keys(before)
  expect(ids.some((id) => after[id][0] !== before[id][0])).toBe(true)
  expect(ids.every((id) => after[id].every(Number.isFinite))).toBe(true)
  // one undo step puts every node back
  await page.evaluate(() =>
    (
      window as unknown as { __arena: { history: { undo: () => void } } }
    ).__arena.history.undo()
  )
  expect(await positions(page)).toEqual(before)

  await tab(page, 'Export')
  // Other tools, and its UMAP view and Cosmograph sub-sections
  await page
    .locator('#exportCard_tools, #exportSub_umap, #exportSub_cosmograph')
    .evaluateAll((ds) =>
      ds.forEach((d) => ((d as HTMLDetailsElement).open = true))
    )
  await expect(page.locator('#umapxMode')).toHaveValue('topology')
  const csv = (
    await readFile(await exportFile(page, '#export_umap_csv'), 'utf8')
  ).trim()
  const rows = csv.split('\n')
  expect(rows[0]).toBe('node_id,node,layer,umap_1,umap_2,cluster,annotation')
  expect(rows.length - 1).toBe(ids.length)
  await expect(page.locator('#export_status')).toContainText(
    `UMAP coordinates exported: ${ids.length} points.`
  )
  // the Cosmograph node table carries the computed UMAP view
  const cosmo = await readFile(
    await exportFile(page, '#export_cosmograph_nodes'),
    'utf8'
  )
  expect(cosmo.split('\n')[0]).toMatch(/,umap_x,umap_y$/)
  // the same options again: no second computation
  await choose(page, '#umapxColour', 'layer')
  const svg = await readFile(await exportFile(page, '#export_umap_svg'), 'utf8')
  expect(svg).toContain('<svg')
  expect(svg).toContain('Arena3D Topology UMAP (n_neighbors 15')
  expect(svg).toContain('Layer1 (')
  const png = await exportFile(page, '#export_umap_png')
  expect((await readFile(png)).subarray(1, 4).toString()).toBe('PNG')

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('#open_umap_vega').click(),
  ])
  await popup.waitForURL(/vega\.github\.io\/editor\/#\/url\/vega-lite\//, SLOW)
  await expect(page.locator('#export_status')).toContainText(
    'Opened the UMAP scatter in the Vega editor'
  )
})

test('Attribute UMAP from a values file', async ({ page }) => {
  test.setTimeout(180_000)
  await loadFigure2A(page)
  const rows = Array.from({ length: 20 }, (_, i) => `${i + 1}\t${i}\t${i - 10}`)
  await page.locator('#values_file').setInputFiles({
    name: 'values.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from(['Node\tscore\tlog2fc', ...rows].join('\n') + '\n'),
  })
  await expect(page.locator('#file_status')).toContainText('Values loaded')

  await chooseUmap(page, 'attributes')
  // value columns are ticked as they arrive; metrics are offered too
  const features = page.locator('#umapFeatures')
  await expect(features.locator('[data-key="value:score"]')).toBeChecked()
  await expect(features.locator('[data-key="value:log2fc"]')).toBeChecked()
  await expect(features.locator('[data-key="metric:Degree"]')).not.toBeChecked()
  await features.locator('[data-key="metric:Degree"]').dispatchEvent('click')

  const before = await positions(page)
  const [request] = await Promise.all([
    page.waitForRequest('**/api/layout'),
    page.locator('#runLayout').dispatchEvent('click'),
  ])
  const body = request.postDataJSON() as {
    umap: {
      mode: string
      feature_names: string[]
      features: Record<string, (number | null)[]>
      metrics: string[]
    }
  }
  expect(body.umap.mode).toBe('attributes')
  expect(body.umap.feature_names).toEqual(['score', 'log2fc'])
  expect(body.umap.metrics).toEqual(['Degree'])
  // by name: every copy of node 5 carries its values
  const fives = Object.entries(body.umap.features).filter(([id]) =>
    id.startsWith('5_')
  )
  expect(fives.length).toBeGreaterThan(0)
  expect(fives.every(([, v]) => v[0] === 4 && v[1] === -6)).toBe(true)
  await expect(page.locator('#layouts_status')).toHaveText(
    'Layout applied.',
    SLOW
  )
  const after = await positions(page)
  expect(Object.keys(before).some((id) => after[id][0] !== before[id][0])).toBe(
    true
  )

  // with nothing ticked, the panel says what is missing instead of running
  await features
    .locator('input:checked')
    .evaluateAll((boxes) =>
      boxes.forEach((b) => ((b as HTMLInputElement).checked = false))
    )
  await page.locator('#runLayout').dispatchEvent('click')
  await expect(page.locator('#layouts_status')).toContainText(
    'Attribute and Hybrid UMAP need features'
  )
})
