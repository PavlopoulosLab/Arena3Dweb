import { expect, test, type Page } from './fixtures'
import { readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// PLAN-ROADMAP Phase 8: every export downloads; GraphML and CX2 round-trip
// through the upload (new import formats); GLB is a binary glTF.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

async function upload(page: Page, file: string) {
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#input_network_file').setInputFiles(file)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  // an upload switches to Main View; come back to the File panel
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
}

async function exportFile(page: Page, button: string): Promise<string> {
  await page
    .getByRole('tab', { name: 'Export', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#panel-export details')
    .evaluateAll((ds) =>
      ds.forEach((d) => ((d as HTMLDetailsElement).open = true))
    )
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator(button).click(),
  ])
  // outside frontend/: files written under the Vite root can trigger a reload
  const file = path.join(os.tmpdir(), `arena3d-e2e-${dl.suggestedFilename()}`)
  await dl.saveAs(file)
  return file
}

const counts = (page: Page) =>
  page.evaluate(() => {
    const ctx = (
      window as unknown as {
        __arena: {
          ctx: {
            nodeObjects: unknown[]
            layers: unknown[]
            edgeObjects: unknown[]
          }
        }
      }
    ).__arena.ctx
    return [ctx.nodeObjects.length, ctx.layers.length, ctx.edgeObjects.length]
  })

test('exports download and GraphML/CX2 round-trip', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await upload(page, FIGURE_2A)
  const original = await counts(page)

  const svg = await readFile(await exportFile(page, '#export_svg'), 'utf8')
  expect(svg).toContain('<svg')
  expect((svg.match(/<circle/g) ?? []).length).toBe(original[0])

  const glb = await readFile(await exportFile(page, '#export_glb'))
  expect(glb.subarray(0, 4).toString()).toBe('glTF')
  // the model carries the edges as lines with a material (Line2 edges use a
  // shader material the exporter cannot write, so they are stood in for)
  const gltf = JSON.parse(
    glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')
  ) as { meshes?: { primitives: { mode?: number; material?: number }[] }[] }
  const lines = (gltf.meshes ?? [])
    .flatMap((m) => m.primitives)
    .filter((p) => p.mode === 3) // LINE_STRIP
  expect(lines.length).toBeGreaterThanOrEqual(original[2] * 0.9)
  expect(lines.every((p) => p.material !== undefined)).toBe(true)

  const png = await readFile(await exportFile(page, '#export_png_sized'))
  expect(png.subarray(1, 4).toString()).toBe('PNG')

  const mux = await readFile(await exportFile(page, '#export_muxviz'))
  expect(mux.subarray(0, 2).toString()).toBe('PK')
  expect(mux.toString('latin1')).toContain('arena3d_edges.edges')

  const graphml = await exportFile(page, '#export_graphml')
  const cx2 = await exportFile(page, '#export_cx2')

  for (const file of [graphml, cx2]) {
    await upload(page, file)
    await page.waitForFunction(
      (n) =>
        (window as unknown as { __arena: { ctx: { nodeObjects: unknown[] } } })
          .__arena.ctx.nodeObjects.length === n,
      original[0]
    )
    expect(await counts(page), path.basename(file)).toEqual(original)
  }

  // video: start, stop early, get a WebM
  await page
    .getByRole('tab', { name: 'Export', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#panel-export details')
    .evaluateAll((ds) =>
      ds.forEach((d) => ((d as HTMLDetailsElement).open = true))
    )
  await page.locator('#export_video').dispatchEvent('click')
  await expect(page.locator('#export_video')).toHaveText('Stop Recording')
  await page.waitForTimeout(1500)
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#export_video').dispatchEvent('click'),
  ])
  expect(dl.suggestedFilename()).toBe('arena3d_rotation.webm')
})
