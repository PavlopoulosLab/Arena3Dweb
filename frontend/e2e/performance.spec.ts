import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// View → Performance: render resolution, node detail, presets and the live
// stats readout change what the renderer does.

type Ctx = {
  fps: number
  pauseInterWhileMoving: boolean
  hideLabelsWhileMoving: boolean
  minimapEvery: number
  renderer: { getPixelRatio: () => number }
  nodeObjects: {
    sphere: { geometry: { parameters: { widthSegments?: number } } }
  }[]
}
const read = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    return {
      fps: c.fps,
      pauseInter: c.pauseInterWhileMoving,
      hideLabels: c.hideLabelsWhileMoving,
      minimapEvery: c.minimapEvery,
      ratio: c.renderer.getPixelRatio(),
      segments: c.nodeObjects[0]?.sphere.geometry.parameters.widthSegments,
      nodes: c.nodeObjects.length,
    }
  })

test('resolution, node detail, presets and live stats', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#input_network_file')
    .setInputFiles(path.resolve('public/data/figure2A_data.tsv'))
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  await page
    .getByRole('tab', { name: 'Performance', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await expect(page.locator('#panel-fps')).toHaveClass(/show/)

  await page.locator('#perf_scale').selectOption('0.5')
  await expect.poll(async () => (await read(page)).ratio).toBe(0.5)
  await page.locator('#perf_detail').selectOption('high')
  expect((await read(page)).segments).toBe(18)

  await page.locator('#perf_fast').click()
  await expect(page.locator('#fps_15')).toBeChecked()
  const fast = await read(page)
  expect(fast.fps).toBe(15)
  expect(fast.pauseInter).toBe(true)
  expect(fast.hideLabels).toBe(true)
  expect(fast.minimapEvery).toBe(0)
  expect(fast.ratio).toBe(0.75)
  expect(fast.segments).toBe(6)

  // the readout fills in while the panel is open
  await expect(page.locator('#perf_counts')).toContainText(
    `${fast.nodes.toLocaleString()} ·`,
    { timeout: 5000 }
  )
  await expect(page.locator('#perf_triangles')).not.toHaveText('–', {
    timeout: 5000,
  })

  await page.locator('#perf_quality').click()
  const quality = await read(page)
  expect(quality.fps).toBe(60)
  expect(quality.hideLabels).toBe(false)
  expect(quality.minimapEvery).toBe(1)
  expect(quality.segments).toBe(18)
})
