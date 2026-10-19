import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// Navigation Controls → Scene → Spread, in Single network mode: the network
// takes more or less room — every node's distance from the centre scales,
// node sizes and the layout's shape stay — one undo step per drag, and the
// slider starts again from 1× after any other change.

const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

type Ctx = {
  nodeObjects: {
    getPosition: (a: string) => number
    getScale: () => number
  }[]
}
const undo = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { __arena: { history: { undo: () => void } } }
    ).__arena.history.undo()
  )

// each node's offset from the centre, and its size
const read = (page: Page) =>
  page.evaluate(() => {
    const { ctx } = (window as unknown as { __arena: { ctx: Ctx } }).__arena
    const p = ctx.nodeObjects.map((n) => [
      n.getPosition('x'),
      n.getPosition('y'),
      n.getPosition('z'),
    ])
    const c = [0, 1, 2].map((k) => p.reduce((s, q) => s + q[k], 0) / p.length)
    return {
      offsets: p.map((q) => q.map((v, k) => v - c[k])),
      centre: c,
      sizes: ctx.nodeObjects.map((n) => n.getScale()),
    }
  })

async function slide(page: Page, value: string): Promise<void> {
  await page.locator('#networkSpreadSlider').evaluate((el, v) => {
    const input = el as HTMLInputElement
    input.value = v
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

test('Spread gives a single network more or less room, same layout', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  // a layer control only: hidden while the network has layers
  await expect(page.locator('#networkSpreadSlider')).toBeHidden()

  await page.locator('#modeSingle').dispatchEvent('click')
  await expect(page.locator('body')).toHaveClass(/mode-single/, {
    timeout: 15000,
  })
  await expect(page.locator('#networkSpreadSlider')).toBeVisible()
  await expect(page.locator('#networkSpreadValue')).toHaveText('x1')
  const before = await read(page)

  // twice the room: every offset from the centre doubles, sizes stay
  await slide(page, '1')
  await expect(page.locator('#networkSpreadValue')).toHaveText('x2')
  const wide = await read(page)
  wide.offsets.forEach((o, i) =>
    o.forEach((v, k) => expect(v).toBeCloseTo(before.offsets[i][k] * 2, 4))
  )
  wide.centre.forEach((v, k) => expect(v).toBeCloseTo(before.centre[k], 4))
  expect(wide.sizes).toEqual(before.sizes)

  // the slider is relative to where it started: back to 0.5× of that
  await slide(page, '-1')
  await expect(page.locator('#networkSpreadValue')).toHaveText('x0.5')
  const narrow = await read(page)
  narrow.offsets.forEach((o, i) =>
    o.forEach((v, k) => expect(v).toBeCloseTo(before.offsets[i][k] / 2, 4))
  )

  // one undo per drag: undo returns to 2×, then to the layout; the slider
  // starts again from 1×
  await undo(page)
  await expect(page.locator('#networkSpreadValue')).toHaveText('x1')
  const undone = await read(page)
  undone.offsets.forEach((o, i) =>
    o.forEach((v, k) => expect(v).toBeCloseTo(before.offsets[i][k] * 2, 4))
  )
  await undo(page)
  const back = await read(page)
  back.offsets.forEach((o, i) =>
    o.forEach((v, k) => expect(v).toBeCloseTo(before.offsets[i][k], 4))
  )

  // a new 1× after any other change: spreading again doubles today's offsets
  await slide(page, '1')
  const again = await read(page)
  again.offsets.forEach((o, i) =>
    o.forEach((v, k) => expect(v).toBeCloseTo(back.offsets[i][k] * 2, 4))
  )
  await page.screenshot({ path: 'test-results/network-spread.png' })
})
