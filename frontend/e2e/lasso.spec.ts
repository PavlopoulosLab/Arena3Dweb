import { expect, test, type Page } from './fixtures'

// Shift + Drag selects an area: a rectangle, or a freehand lasso chosen in
// the Navigation Controls (remembered in the browser).

type P = [number, number]
type Arena = {
  __arena: {
    ctx: {
      xBoundMax: number
      yBoundMax: number
      nodeObjects: {
        isSelected: boolean
        getWorldPosition: (a: string) => number
      }[]
    }
  }
}

// every node's position on the page, and whether it is selected
const nodes = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as Arena).__arena.ctx
    const r = document.querySelector('#app canvas')!.getBoundingClientRect()
    return c.nodeObjects.map((n) => ({
      x: r.left + n.getWorldPosition('x') + c.xBoundMax,
      y: r.top + c.yBoundMax - n.getWorldPosition('y'),
      selected: n.isSelected,
    }))
  })

function inside([x, y]: P, polygon: P[]): boolean {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      hit = !hit
  }
  return hit
}

// distance from a point to the polygon's outline
function toOutline([x, y]: P, polygon: P[]): number {
  return Math.min(
    ...polygon.map(([ax, ay], i) => {
      const [bx, by] = polygon[(i + 1) % polygon.length]
      const t = Math.max(
        0,
        Math.min(
          1,
          ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) /
            ((bx - ax) ** 2 + (by - ay) ** 2)
        )
      )
      return Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay))
    })
  )
}

// Shift held, the mouse pressed at the first corner and led round the rest
async function drawArea(page: Page, outline: P[]): Promise<void> {
  await page.keyboard.down('Shift')
  await page.mouse.move(...outline[0])
  await page.mouse.down()
  for (const p of [...outline.slice(1), outline[0]])
    await page.mouse.move(...p, { steps: 12 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
}

async function load(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#input_network_file')
    .setInputFiles('public/data/figure2A_data.tsv')
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  // loading returns to the 3D view: the scene has the whole window
}

// what the area selected must match, away from its outline
function expectSelection(
  all: { x: number; y: number; selected: boolean }[],
  outline: P[]
): void {
  const clear = all.filter((n) => toOutline([n.x, n.y], outline) > 6)
  const within = clear.filter((n) => inside([n.x, n.y], outline))
  expect(within.length).toBeGreaterThan(3)
  for (const n of clear) expect(n.selected).toBe(inside([n.x, n.y], outline))
}

test('a freehand lasso selects the nodes inside it, and the choice is kept', async ({
  page,
}) => {
  await load(page)
  const shape = page.locator('#info [data-shape="lasso"]')
  await expect(shape).toBeVisible()
  await shape.click()
  await expect(shape).toHaveAttribute('aria-pressed', 'true')

  // a triangle round the middle of the network
  const all = await nodes(page)
  const cx = all.reduce((s, n) => s + n.x, 0) / all.length
  const cy = all.reduce((s, n) => s + n.y, 0) / all.length
  const triangle: P[] = [
    [cx, cy - 170],
    [cx + 190, cy + 130],
    [cx - 190, cy + 130],
  ]
  await drawArea(page, triangle)
  expectSelection(await nodes(page), triangle)

  // remembered: the lasso is still chosen after a reload
  await page.reload()
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#input_network_file')
    .setInputFiles('public/data/figure2A_data.tsv')
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  await expect(page.locator('#info [data-shape="lasso"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
})

test('the rectangle still selects a box', async ({ page }) => {
  await load(page)
  await page.locator('#info [data-shape="rectangle"]').click()
  const all = await nodes(page)
  const cx = all.reduce((s, n) => s + n.x, 0) / all.length
  const cy = all.reduce((s, n) => s + n.y, 0) / all.length
  // a rectangle is drawn from the press to the release: two corners (the
  // path between them is never read in rectangle mode — see the other
  // test's drag() comment)
  await page.keyboard.down('Shift')
  await page.mouse.move(cx - 150, cy - 120)
  await page.mouse.down()
  await page.mouse.move(cx + 150, cy + 120, { steps: 2 })
  await page.mouse.up()
  await page.keyboard.up('Shift')
  expectSelection(await nodes(page), [
    [cx - 150, cy - 120],
    [cx + 150, cy - 120],
    [cx + 150, cy + 120],
    [cx - 150, cy + 120],
  ])
})

test('the area can replace the selection or take nodes out of it', async ({
  page,
}) => {
  // four drag-select cycles, each followed by a full scene evaluation —
  // the heaviest test in this file even after trimming unnecessary mouse
  // steps (see drag() below).
  test.setTimeout(120_000)
  await load(page)
  await page.locator('#info [data-shape="rectangle"]').click()
  await page.locator('#info [data-combine="new"]').click()
  await expect(page.locator('#info [data-combine="new"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  const all = await nodes(page)
  const cx = all.reduce((s, n) => s + n.x, 0) / all.length
  const cy = all.reduce((s, n) => s + n.y, 0) / all.length
  const box = (x0: number, y0: number, x1: number, y1: number): P[] => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
  async function drag(outline: P[], alt = false): Promise<void> {
    await page.keyboard.down('Shift')
    if (alt) await page.keyboard.down('Alt')
    await page.mouse.move(...outline[0])
    await page.mouse.down()
    // rectangle mode computes the box from the press point and the current
    // cursor only (canvas_controls.ts's lassoSelectNodes) — the path in
    // between is never read, so a couple of steps (one live-redraw sanity
    // check) covers it exactly as well as many, for a fraction of the cost.
    await page.mouse.move(...outline[2], { steps: 2 })
    await page.mouse.up()
    if (alt) await page.keyboard.up('Alt')
    await page.keyboard.up('Shift')
  }
  // selected exactly where `want` says, for nodes clear of every outline
  async function expectWhere(
    outlines: P[][],
    want: (p: P) => boolean
  ): Promise<void> {
    const clear = (await nodes(page)).filter((n) =>
      outlines.every((o) => toOutline([n.x, n.y], o) > 6)
    )
    expect(clear.filter((n) => want([n.x, n.y])).length).toBeGreaterThan(0)
    for (const n of clear)
      expect(n.selected, `node at ${n.x - cx}, ${n.y - cy}`).toBe(
        want([n.x, n.y])
      )
  }

  // the layers stand side by side round the middle; the areas stay clear of
  // the Navigation Controls on the left
  // New: a second area replaces the first
  const left = box(cx - 230, cy - 140, cx + 20, cy + 140)
  await drag(left)
  await expectWhere([left], (p) => inside(p, left))
  const right = box(cx - 20, cy - 140, cx + 250, cy + 140)
  await drag(right)
  await expectWhere([left, right], (p) => inside(p, right))

  // Remove: the area's nodes are taken out
  await page.locator('#info [data-combine="remove"]').click()
  const top = box(cx - 260, cy - 170, cx + 260, cy - 10)
  await drag(top)
  await expectWhere(
    [left, right, top],
    (p) => inside(p, right) && !inside(p, top)
  )

  // Add, with Alt / Option held: taken out all the same
  await page.locator('#info [data-combine="add"]').click()
  const count = async () => (await nodes(page)).filter((n) => n.selected).length
  const before = await count()
  const corner = box(cx + 170, cy - 30, cx + 270, cy + 170)
  await drag(corner, true)
  expect(await count()).toBeLessThan(before)
  await expectWhere(
    [left, right, top, corner],
    (p) => inside(p, right) && !inside(p, top) && !inside(p, corner)
  )
})
