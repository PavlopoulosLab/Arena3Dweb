import { expect, test, type CDPSession, type Page } from '@playwright/test'

// Phones and tablets (projects "phone" and "tablet"): the menu folds into ☰,
// panels open as bottom sheets, and touch gestures drive the scene — one-finger
// orbit, two-finger pinch, double tap to select, long press for the node menu.

type P = { x: number; y: number }
type Ctx = {
  scene: {
    getScale: () => number
    getQuaternion: () => { x: number; y: number; z: number; w: number }
  }
  nodeObjects: {
    isSelected: boolean
    getWorldPosition: () => { x: number; y: number }
  }[]
  xBoundMax: number
  yBoundMax: number
}

async function touch(
  cdp: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  pts: P[],
  timestamp?: number // seconds; the event's own time (see tap)
) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: pts.map((p, id) => ({ x: p.x, y: p.y, id })),
    ...(timestamp === undefined ? {} : { timestamp }),
  })
}

// A tap with explicit event times. DevTools only sends the touch-end after the
// page handled the touch-start, so on a busy headless page a quick tap would
// otherwise look like a long press; real devices stamp events in hardware.
async function tap(cdp: CDPSession, p: P, at: number) {
  await touch(cdp, 'touchStart', [p], at)
  await touch(cdp, 'touchEnd', [], at + 0.06)
}

async function drag(cdp: CDPSession, from: P[], to: P[], steps = 8) {
  await touch(cdp, 'touchStart', from)
  for (let i = 1; i <= steps; i++)
    await touch(
      cdp,
      'touchMove',
      from.map((f, k) => ({
        x: f.x + ((to.at(k)!.x - f.x) * i) / steps,
        y: f.y + ((to.at(k)!.y - f.y) * i) / steps,
      }))
    )
  await touch(cdp, 'touchEnd', [])
}

const undo = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { __arena: { history: { undo: () => void } } }
    ).__arena.history.undo()
  )

test('phone/tablet: menu, bottom sheet, touch gestures', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  const vw = page.viewportSize()!
  const phone = vw.width <= 768
  const cdp = await page.context().newCDPSession(page)

  // menu: ☰ on phones; choosing a panel closes it
  if (phone) {
    await expect(page.locator('.navbar-toggler')).toBeVisible()
    await page.locator('.navbar-toggler').tap()
    await expect(page.locator('#navbarTabs')).toHaveClass(/show/)
  }
  await page.getByRole('tab', { name: 'File', exact: true }).tap()
  if (phone) await expect(page.locator('#navbarTabs')).not.toHaveClass(/show/)
  await expect(page.locator('#panel-file')).toHaveClass(/show/)

  // panel = bottom sheet on phones (full width, lower part of the screen)
  const box = (await page.locator('#panel-file').boundingBox())!
  if (phone) {
    expect(box.width).toBeGreaterThan(vw.width - 2)
    expect(box.y).toBeGreaterThan(vw.height * 0.3)
  }
  await page.locator('#exampleButton').tap()
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  if (phone) {
    await expect(page.locator('#info')).toBeHidden() // nav table starts closed
    await expect(page.locator('#minimap')).toBeHidden()
  }
  await page.waitForTimeout(500)

  const c = { x: vw.width / 2, y: vw.height / 2 }
  const quat = () =>
    page.evaluate(() =>
      JSON.stringify(
        (
          window as unknown as { __arena: { ctx: Ctx } }
        ).__arena.ctx.scene.getQuaternion()
      )
    )
  const scale = () =>
    page.evaluate(() =>
      (
        window as unknown as { __arena: { ctx: Ctx } }
      ).__arena.ctx.scene.getScale()
    )

  // one finger: orbit, one undo step
  const q0 = await quat()
  await drag(cdp, [c], [{ x: c.x + 120, y: c.y + 40 }])
  const q1 = await quat()
  expect(q1).not.toEqual(q0)
  await undo(page)
  expect(await quat()).toEqual(q0)

  // two fingers: pinch out zooms in, one undo step
  const s0 = await scale()
  await drag(
    cdp,
    [
      { x: c.x - 30, y: c.y },
      { x: c.x + 30, y: c.y },
    ],
    [
      { x: c.x - 110, y: c.y },
      { x: c.x + 110, y: c.y },
    ]
  )
  const s1 = await scale()
  expect(s1).toBeGreaterThan(s0 * 2)
  await page.screenshot({
    path: `test-results/${info.project.name}-pinched.png`,
  })
  await undo(page)
  expect(await scale()).toBeCloseTo(s0, 5)

  // the node nearest the middle of the screen, projected through the camera
  // exactly as the raycaster does
  const node = await page.evaluate(() => {
    type V = { x: number; y: number; project: (c: unknown) => V }
    type Scene3D = {
      camera: unknown
      nodeObjects: { getWorldPosition: () => V }[]
    }
    const ctx = (window as unknown as { __arena: { ctx: Scene3D } }).__arena.ctx
    const pts = ctx.nodeObjects.map((n, i) => {
      const p = n.getWorldPosition().project(ctx.camera)
      return {
        i,
        x: ((p.x + 1) / 2) * innerWidth,
        y: ((1 - p.y) / 2) * innerHeight,
      }
    })
    const cx = innerWidth / 2
    const cy = innerHeight / 2
    pts.sort(
      (a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy)
    )
    return { ...pts[0], iw: innerWidth }
  })
  expect(node.iw).toBe(vw.width) // nothing widens the page
  // long press on it: the node menu
  await touch(cdp, 'touchStart', [node])
  await page.waitForTimeout(800)
  await touch(cdp, 'touchEnd', [])
  await expect(page.locator('#labelDiv .optionsBox')).toHaveCount(1)
  // a tap elsewhere closes it
  await tap(cdp, { x: vw.width - 24, y: vw.height - 40 }, Date.now() / 1000)
  await expect(page.locator('#labelDiv .optionsBox')).toHaveCount(0)
  await page.waitForTimeout(400) // so the next taps aren't read as a double tap with it

  // double tap on it: selected
  const t0 = Date.now() / 1000
  await tap(cdp, node, t0)
  await tap(cdp, node, t0 + 0.18)
  // the node in front at that spot is selected (floors overlap in 3D, so it
  // need not be the one whose centre we aimed at)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as { __arena: { ctx: Ctx } }
          ).__arena.ctx.nodeObjects.filter((n) => n.isSelected).length
      )
    )
    .toBe(1)

  // a panel over the scene, as people will see it
  if (phone) {
    await page.locator('.navbar-toggler').tap()
    // let the ☰ menu finish opening before tapping into it
    await expect(page.locator('#navbarTabs')).toHaveClass(/\bshow\b/)
    await expect(page.locator('#navbarTabs')).not.toHaveClass(/collapsing/)
    await page.getByRole('button', { name: 'Edit', exact: true }).tap()
    await page.getByRole('tab', { name: 'Style', exact: true }).tap()
    await expect(page.locator('#panel-style')).toHaveClass(/show/)
  }
  await page.screenshot({ path: `test-results/${info.project.name}-sheet.png` })
})
