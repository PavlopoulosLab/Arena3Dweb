import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// Export → Visualizations: chord diagram, heatmap and matrix downloads, Circos
// input files, and the hand-offs to the Vega editor (spec in the link), Gephi
// Lite (GraphML hosted by /api/share) and STRING (identifiers in the link).

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
