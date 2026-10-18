import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// Zoom has no practical limit (the old 0.2–2x clamp is gone), and a
// double-click on the background fits the whole network back into the
// window, centred, as one undoable step.

type Ctx = {
  scene: {
    getScale: () => number
    getPosition: (a: string) => number
    THREE_Object: { updateMatrixWorld: (force: boolean) => void }
  }
  nodeObjects: { getWorldPosition: () => { x: number; y: number } }[]
  xBoundMax: number
  yBoundMax: number
}

const read = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    c.scene.THREE_Object.updateMatrixWorld(true)
    const xs = c.nodeObjects.map((n) => n.getWorldPosition().x)
    const ys = c.nodeObjects.map((n) => n.getWorldPosition().y)
    return {
      scale: c.scene.getScale(),
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      w: 2 * c.xBoundMax,
      h: 2 * c.yBoundMax,
    }
  })

test('wheel zoom goes far past 2x; a double-click on the background fits the network', async ({
  page,
}) => {
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
    .getByRole('tab', { name: '3D View', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.waitForTimeout(500)

  // The stack is wider than the window at the load zoom, so zoom out first
  // (pointer in the middle) until it sits in the centre; then zoom in with
  // the pointer in the top-right corner: the world point under the pointer
  // stays put, so the corner stays empty background.
  const size = page.viewportSize()!
  await page.mouse.move(size.width / 2, size.height / 2)
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 100)
  await expect
    .poll(async () => (await read(page)).scale, { timeout: 10_000 })
    .toBeLessThan(0.3)
  const x = size.width - 12
  const y = 80
  await page.mouse.move(x, y)
  for (let i = 0; i < 60; i++) await page.mouse.wheel(0, -100)
  await expect
    .poll(async () => (await read(page)).scale, { timeout: 10_000 })
    .toBeGreaterThan(10)

  await page.mouse.dblclick(x, y)
  await expect
    .poll(async () => (await read(page)).scale, { timeout: 10_000 })
    .toBeLessThan(5)
  await page.waitForTimeout(600) // the fly-to settles
  const s = await read(page)
  // every node inside the 85% box, and the network near the centre
  expect(s.maxX - s.minX).toBeLessThanOrEqual(0.85 * s.w + 1)
  expect(s.maxY - s.minY).toBeLessThanOrEqual(0.85 * s.h + 1)
  expect(Math.abs((s.minX + s.maxX) / 2)).toBeLessThan(0.2 * s.w)
  expect(Math.abs((s.minY + s.maxY) / 2)).toBeLessThan(0.2 * s.h)

  // the fit is one undo step: undo brings the deep zoom back
  await page.locator('#undoButton').dispatchEvent('click')
  await expect
    .poll(async () => (await read(page)).scale, { timeout: 10_000 })
    .toBeGreaterThan(10)
})
