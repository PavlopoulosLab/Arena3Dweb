import { expect, test, type Page } from './fixtures'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// Export → Visualizations: chord diagram, heatmap and matrix downloads, Circos
// input files, and the hand-offs to the Vega editor (spec in the link), Gephi
// Lite (GraphML hosted by /api/share) and STRING (identifiers in the link);
// the interactive Circos alternatives — Gosling.js, NGCircos.js, CircosJS and
// JBrowse 2 — as downloads and, for Gosling and JBrowse, hosted hand-offs.

const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

async function exportFile(page: Page, button: string): Promise<string> {
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator(button).click(),
  ])
  const file = path.join(os.tmpdir(), `arena3d-e2e-${dl.suggestedFilename()}`)
  await dl.saveAs(file)
  return file
}

test('chord, heatmap, matrix and Circos exports; Vega, Gephi Lite and STRING hand-offs', async ({
  page,
  context,
}) => {
  // the external tools are not contacted: their pages are stubbed
  for (const host of ['vega.github.io', 'gephi.org', 'string-db.org'])
    await context.route(`https://${host}/**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html>stub</html>' })
    )
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  const counts = await page.evaluate(() => {
    const c = (
      window as unknown as {
        __arena: { ctx: { nodeObjects: unknown[]; edgeObjects: unknown[] } }
      }
    ).__arena.ctx
    return { nodes: c.nodeObjects.length, edges: c.edgeObjects.length }
  })
  await tab(page, 'Export')
  await page
    .locator('#panel-export details')
    .evaluateAll((ds) =>
      ds.forEach((d) => ((d as HTMLDetailsElement).open = true))
    )

  const chord = await readFile(await exportFile(page, '#export_chord'), 'utf8')
  expect(chord).toContain('<svg')
  expect(chord).toContain('Arena3D chord diagram: 4 layers')
  // four arcs plus one chord per edge
  expect((chord.match(/<path /g) ?? []).length).toBe(4 + counts.edges)

  const heat = await readFile(await exportFile(page, '#export_heatmap'), 'utf8')
  expect(heat).toContain(`Arena3D adjacency heatmap: ${counts.nodes} nodes`)
  expect((heat.match(/<rect /g) ?? []).length).toBeGreaterThan(counts.edges)

  const csv = await readFile(await exportFile(page, '#export_matrix'), 'utf8')
  expect(csv.trim().split('\n')).toHaveLength(counts.nodes + 1)

  // Sankey: layers as columns, inter-layer edges as flows — per node, then
  // per layer; SankeyMATIC lines and a Plotly figure carry the same flows
  const sankey = await readFile(
    await exportFile(page, '#export_sankey'),
    'utf8'
  )
  expect(sankey).toContain('Arena3D Sankey diagram (nodes): 4 layers')
  const flowsOfNodes = (sankey.match(/<path /g) ?? []).length
  expect(flowsOfNodes).toBeGreaterThan(10)
  await expect(page.locator('#export_status')).toContainText(
    'Sankey diagram exported (nodes)'
  )
  await page.locator('#sankey_level').selectOption('layers')
  const perLayer = await readFile(
    await exportFile(page, '#export_sankey'),
    'utf8'
  )
  expect(perLayer).toContain(
    'Arena3D Sankey diagram (layers): 4 layers, 4 bands'
  )
  expect((perLayer.match(/<path /g) ?? []).length).toBeLessThan(flowsOfNodes)
  const matic = await readFile(
    await exportFile(page, '#export_sankey_matic'),
    'utf8'
  )
  expect(matic).toMatch(/^Layer\d \[[\d.]+\] Layer\d$/m)
  expect(matic).toMatch(/^:Layer1 #[0-9a-f]{6}$/im)
  const plotly = JSON.parse(
    await readFile(await exportFile(page, '#export_sankey_plotly'), 'utf8')
  ) as {
    data: {
      type: string
      node: { label: string[] }
      link: { value: number[] }
    }[]
  }
  expect(plotly.data[0].type).toBe('sankey')
  expect(plotly.data[0].node.label).toHaveLength(4)
  expect(plotly.data[0].link.value.length).toBeGreaterThan(0)
  await page.locator('#sankey_level').selectOption('nodes')

  const circos = (
    await readFile(await exportFile(page, '#export_circos'))
  ).toString('latin1')
  for (const name of [
    'karyotype.txt',
    'links.txt',
    'circos.conf',
    'README.txt',
  ])
    expect(circos).toContain(name)
  expect(circos).toContain('chr - L1 Layer1 0')
  await expect(page.locator('#export_status')).toContainText(
    'Circos files exported.'
  )

  // Vega editor: the spec rides in the URL hash
  const [vega] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('#open_vega').click(),
  ])
  expect(vega.url()).toContain('vega.github.io/editor/#/url/vega-lite/')
  expect(vega.url().length).toBeGreaterThan(200)
  await vega.close()

  // Gephi Lite: the GraphML is hosted here first, then handed over by URL
  const [gephi] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('#open_gephi').click(),
  ])
  await expect
    .poll(() => gephi.url(), { timeout: 15_000 })
    .toContain('gephi.org/gephi-lite/?file=')
  const hosted = decodeURIComponent(gephi.url().split('?file=')[1])
  expect(hosted).toContain('/api/share/')
  const served = await page.request.get(hosted)
  expect(served.ok()).toBe(true)
  expect(await served.text()).toContain('<graphml')
  await gephi.close()
  await expect(page.locator('#export_status')).toContainText(
    'Opened in Gephi Lite'
  )

  // STRING: the protein names and the organism in the link
  await page.locator('#string_species').selectOption('10090')
  const [str] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('#open_string').click(),
  ])
  expect(str.url()).toContain('string-db.org/cgi/network?identifiers=')
  expect(str.url()).toContain('species=10090')
  await str.close()
})

// the JSON inside a downloaded page's <script type="application/json">
const pageData = (html: string) =>
  JSON.parse(
    html.match(
      /<script type="application\/json" id="arena3d-data">([^]*?)<\/script>/
    )![1]
  ) as Record<string, unknown>

test('Gosling, NGCircos, CircosJS and JBrowse 2 exports and hand-offs', async ({
  page,
  context,
}) => {
  // no internet: the tools' sites and the CDNs the pages name are stubbed
  for (const host of [
    'gosling.js.org',
    'jbrowse.org',
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
  ])
    await context.route(`https://${host}/**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<html>stub</html>' })
    )
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  const counts = await page.evaluate(() => {
    const c = (
      window as unknown as {
        __arena: { ctx: { nodeObjects: unknown[]; edgeObjects: unknown[] } }
      }
    ).__arena.ctx
    return { nodes: c.nodeObjects.length, edges: c.edgeObjects.length }
  })
  await tab(page, 'Export')
  // each tool is its own folded sub-section with a hint
  for (const id of ['gosling', 'ngcircos', 'circosjs', 'jbrowse'])
    await expect(
      page.locator(`#exportSub_${id} > summary .lp-hint`)
    ).not.toBeEmpty()
  await page
    .locator('#panel-export details')
    .evaluateAll((ds) =>
      ds.forEach((d) => ((d as HTMLDetailsElement).open = true))
    )

  // Gosling: a circular spec, the layers as the assembly, every edge a link
  type Spec = {
    layout: string
    assembly: [string, number][]
    tracks: { id: string; data: { values?: unknown[]; url?: string } }[]
  }
  const spec = JSON.parse(
    await readFile(await exportFile(page, '#export_gosling'), 'utf8')
  ) as Spec
  expect(spec.layout).toBe('circular')
  expect(spec.assembly.map(([name]) => name)).toEqual([
    'Layer1',
    'Layer2',
    'Layer3',
    'Layer4',
  ])
  const links = spec.tracks.find((t) => t.id === 'edges')!
  expect(links.data.values).toHaveLength(counts.edges)
  await expect(page.locator('#export_status')).toContainText(
    `Gosling spec exported: 4 layers, ${counts.nodes} nodes, ${counts.edges} edges`
  )

  // NGCircos: a page loading the library from a CDN, and its modules
  const ngPage = await readFile(
    await exportFile(page, '#export_ngcircos_html'),
    'utf8'
  )
  expect(ngPage).toContain(
    '<script src="https://cdn.jsdelivr.net/gh/mrcuizhe/interacCircos@v1.2.0/inst/htmlwidgets/lib/NGCircos.js"></script>'
  )
  type Module = [string, unknown, unknown[]]
  const linkRows = (modules: Module[]) =>
    modules.filter(([n]) => n.startsWith('LINK')).flatMap(([, , rows]) => rows)
  expect(linkRows(pageData(ngPage).modules as Module[])).toHaveLength(
    counts.edges
  )
  await page.locator('#ngcircos_track').selectOption('heatmap:-1')
  const ngJson = JSON.parse(
    await readFile(await exportFile(page, '#export_ngcircos_json'), 'utf8')
  ) as { modules: Module[]; genome: [string, number][][] }
  expect(ngJson.genome[0]).toHaveLength(4)
  expect(ngJson.modules.map(([n]) => n)).toContain('HEATMAP01')
  expect(linkRows(ngJson.modules)).toHaveLength(counts.edges)

  // CircosJS: a page and its data, one chord per edge
  const cjPage = await readFile(
    await exportFile(page, '#export_circosjs_html'),
    'utf8'
  )
  expect(cjPage).toContain(
    '<script src="https://cdn.jsdelivr.net/npm/circos@2.1.0/dist/circos.min.js"></script>'
  )
  expect(pageData(cjPage).chords).toHaveLength(counts.edges)
  await page.locator('#circosjs_track').selectOption('none:-1')
  const cjData = JSON.parse(
    await readFile(await exportFile(page, '#export_circosjs_json'), 'utf8')
  ) as { layout: unknown[]; chords: unknown[]; track: unknown }
  expect(cjData.layout).toHaveLength(4)
  expect(cjData.chords).toHaveLength(counts.edges)
  expect(cjData.track).toBeNull()

  // JBrowse 2: config, VCF breakends (one per edge), FASTA and README
  const jb = (
    await readFile(await exportFile(page, '#export_jbrowse'))
  ).toString('utf8')
  for (const name of [
    'config.json',
    'arena3d_edges.vcf',
    'arena3d_layers.fa',
    'arena3d_layers.fa.fai',
    'README.txt',
  ])
    expect(jb).toContain(name)
  expect(jb.match(/\tSVTYPE=BND;/g) ?? []).toHaveLength(counts.edges)

  // Open in Gosling Editor: the tables hosted here, a spec reading them in
  // the link (JSONCrush: drop the closing "_", swap the characters back)
  const [gosling] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('#open_gosling').click(),
  ])
  await expect
    .poll(() => gosling.url(), { timeout: 15_000 })
    .toContain('gosling.js.org/?spec=')
  const crushed = new URL(gosling.url()).searchParams.get('spec')!
  const unswap = (t: string) =>
    [
      ['{', '(', '\\', '\\'],
      ['}', ')', '\\', '\\'],
      [",'", '~'],
      ["':", '!'],
      ['"', "'"],
    ].reduce(
      (s, g) =>
        s.replace(
          new RegExp(`${(g[2] ?? '') + g[0]}|${(g[3] ?? '') + g[1]}`, 'g'),
          (m) => (m === g[0] ? g[1] : g[0])
        ),
      t
    )
  const hosted = JSON.parse(unswap(crushed.slice(0, -1))) as Spec
  const urlOf = (id: string) =>
    hosted.tracks.find((t) => t.id === id)!.data.url!
  expect(urlOf('edges')).toContain('/api/share/')
  const edgesCsv = await (await page.request.get(urlOf('edges'))).text()
  expect(edgesCsv.trim().split('\n')).toHaveLength(counts.edges + 1)
  const nodesCsv = await (await page.request.get(urlOf('nodes'))).text()
  expect(nodesCsv.trim().split('\n')).toHaveLength(counts.nodes + 1)
  await gosling.close()
  await expect(page.locator('#export_status')).toContainText(
    'Opened in the Gosling editor'
  )

  // Open in JBrowse 2: the VCF and a config reading it hosted here, opened in
  // JBrowse Web's circular view
  const [jbrowse] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('#open_jbrowse').click(),
  ])
  await expect
    .poll(() => jbrowse.url(), { timeout: 15_000 })
    .toContain('jbrowse.org/code/jb2/v4.3.0/?config=')
  const jbUrl = new URL(jbrowse.url())
  expect(jbUrl.searchParams.get('session')).toContain('"type":"CircularView"')
  const config = (await (
    await page.request.get(jbUrl.searchParams.get('config')!)
  ).json()) as {
    tracks: { adapter: { vcfLocation: { uri: string } } }[]
  }
  const vcf = await (
    await page.request.get(config.tracks[0].adapter.vcfLocation.uri)
  ).text()
  expect(vcf.match(/\tSVTYPE=BND;/g) ?? []).toHaveLength(counts.edges)
  await jbrowse.close()
  await expect(page.locator('#export_status')).toContainText(
    'Opened in JBrowse 2'
  )
})
