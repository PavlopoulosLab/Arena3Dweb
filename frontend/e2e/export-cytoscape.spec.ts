import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// Export → Cytoscape: Send to Cytoscape posts a Cytoscape.js network to
// cyREST (mocked here), and the .cyjs and SIF + tables downloads carry the
// same nodes, edges, layers and positions.

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

test('Send to Cytoscape posts a .cyjs network; the files match it', async ({
  page,
}) => {
  let posted: {
    elements: {
      nodes: {
        data: Record<string, unknown>
        position: { x: number; y: number }
      }[]
      edges: { data: Record<string, unknown> }[]
    }
  } | null = null
  let fitted = ''
  await page.route('http://localhost:1234/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/v1/networks')) {
      posted = route.request().postDataJSON() as typeof posted
      await route.fulfill({ json: { networkSUID: 1234 } })
    } else {
      fitted = url
      await route.fulfill({ json: {} })
    }
  })
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
  await page.locator('#export_cytoscape').click()
  await expect(page.locator('#export_status')).toContainText(
    `Opened in Cytoscape: ${counts.nodes} nodes, ${counts.edges} edges`
  )
  expect(posted).not.toBeNull()
  const net = posted!
  expect(net.elements.nodes).toHaveLength(counts.nodes)
  expect(net.elements.edges).toHaveLength(counts.edges)
  const first = net.elements.nodes[0]
  expect(typeof first.data.name).toBe('string')
  expect(typeof first.data.layer).toBe('string')
  expect(String(first.data.color)).toMatch(/^#[0-9a-f]{6}$/i)
  // layers side by side: four distinct x bands
  const bands = new Set(
    net.elements.nodes.map((n) => Math.round(n.position.x / 500))
  )
  expect(bands.size).toBeGreaterThanOrEqual(3)
  expect(fitted).toContain('/v1/apply/fit/1234')

  // the downloads carry the same network
  const cyjs = JSON.parse(
    await readFile(await exportFile(page, '#export_cyjs'), 'utf8')
  ) as typeof net
  expect(cyjs.elements.nodes).toHaveLength(counts.nodes)
  expect(cyjs.elements.edges).toHaveLength(counts.edges)
  const sif = await readFile(await exportFile(page, '#export_sif'))
  const text = sif.toString('latin1')
  for (const name of [
    'arena3d_network.sif',
    'arena3d_node_attributes.csv',
    'arena3d_edge_attributes.csv',
  ])
    expect(text).toContain(name)
  expect(text).toContain('source,interaction,target,weight,source_layer')
  await expect(page.locator('#export_status')).toContainText(
    'SIF and attribute tables exported.'
  )

  // no Cytoscape running: a plain message, no crash
  await page.unroute('http://localhost:1234/**')
  await page.route('http://localhost:1234/**', (route) => route.abort())
  await page.locator('#export_cytoscape').click()
  await expect(page.locator('#export_status')).toContainText(
    'Cytoscape is not answering'
  )
})
