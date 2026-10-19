import { expect, test, type Page } from './fixtures'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// Export → Other tools → Cosmograph: the links and nodes CSVs, and "Open in
// Cosmograph", which hosts both on this server (POST /api/share) and opens
// cosmograph.app/run/?data=…&meta=…. window.open is stubbed: the real site is
// never contacted.

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

test('Cosmograph CSVs and the Open in Cosmograph link', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  const counts = await page.evaluate(() => {
    const a = (
      window as unknown as {
        __arena: { ctx: { nodeObjects: unknown[]; edgeObjects: unknown[] } }
      }
    ).__arena.ctx
    return { nodes: a.nodeObjects.length, edges: a.edgeObjects.length }
  })
  await tab(page, 'Export')
  // Other tools, and its Cosmograph sub-section
  await page
    .locator('#exportCard_tools, #exportSub_cosmograph')
    .evaluateAll((ds) =>
      ds.forEach((d) => ((d as HTMLDetailsElement).open = true))
    )

  const links = (
    await readFile(await exportFile(page, '#export_cosmograph_links'), 'utf8')
  )
    .trim()
    .split('\n')
  expect(links[0]).toBe(
    'source,target,weight,channel,source_layer,target_layer'
  )
  expect(links.length - 1).toBe(counts.edges)
  expect(links[1]).toMatch(/^\w+_Layer\d,\w+_Layer\d,/) // node_layer ids

  const nodes = (
    await readFile(await exportFile(page, '#export_cosmograph_nodes'), 'utf8')
  )
    .trim()
    .split('\n')
  expect(nodes[0]).toBe('id,label,layer,color,size,cluster,annotations')
  expect(nodes.length - 1).toBe(counts.nodes)
  const ids = nodes.slice(1).map((r) => r.split(',')[0])
  expect(new Set(ids).size).toBe(ids.length) // unique across layers
  const [id, label, layer, color] = nodes[1].split(',')
  expect(id).toBe(`${label}_${layer}`)
  expect(color).toMatch(/^#[0-9a-f]{6}$/i)

  // stub the new tab: record where it is sent
  await page.evaluate(() => {
    const w = window as unknown as {
      open: () => unknown
      __tabs: { location: { href: string }; close: () => void }[]
    }
    w.__tabs = []
    w.open = () => {
      const fake = { location: { href: '' }, close: () => undefined }
      w.__tabs.push(fake)
      return fake
    }
  })
  await page.locator('#open_cosmograph').click()
  await expect(page.locator('#export_status')).toContainText(
    `Opened in Cosmograph: ${counts.nodes} nodes`
  )
  const href = await page.evaluate(
    () =>
      (window as unknown as { __tabs: { location: { href: string } }[] })
        .__tabs[0].location.href
  )
  const url = new URL(href)
  expect(`${url.origin}${url.pathname}`).toBe('https://cosmograph.app/run/')
  expect(url.searchParams.get('nodeColor')).toBe('color')
  expect(url.searchParams.get('nodeLabel')).toBe('label')
  // the hosted files are the same CSVs, served as downloads with CORS
  for (const [param, header] of [
    ['data', links[0]],
    ['meta', nodes[0]],
  ]) {
    const hosted = await page.request.get(url.searchParams.get(param)!, {
      headers: { Origin: 'https://cosmograph.app' },
    })
    expect(hosted.status()).toBe(200)
    expect((await hosted.text()).split('\n')[0]).toBe(header)
    const h = hosted.headers()
    expect(h['content-type']).toContain('text/csv')
    expect(h['access-control-allow-origin']).toBe('*')
    expect(h['content-disposition']).toMatch(/^attachment/)
    expect(h['x-content-type-options']).toBe('nosniff')
  }
})
