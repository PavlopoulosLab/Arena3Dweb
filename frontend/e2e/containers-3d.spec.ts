import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// PLAN-ROADMAP Phases 19-20: layers as 3D containers (cube, sphere, cylinder,
// cone, … fog cloud, bubble) with 3D layouts inside, and the "3D network
// (ignore layers)" mode.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

// every container, Flat / Solid / Soft, in an order that crosses each kind of
// switch: flat → volume (a layout), volume → volume (nodes moved over), tiers
// → no tiers (a new layout), volume → flat
const ALL = [
  'cube',
  'sphere',
  'cylinder',
  'cone',
  'pyramid',
  'dome',
  'ellipsoid',
  'torus',
  'hexprism',
  'geodesic',
  'discs',
  'cloud',
  'bubble',
  'none',
  'floor',
]

type Ctx = {
  layers: {
    name: string
    container: string
    containerPlacement: string
    plane: { position: { x: number; y: number; z: number } }
    containerRadius: () => number
    volume: {
      traverse: (f: (o: { type: string; material?: unknown }) => void) => void
    } | null
  }[]
  nodeObjects: { layer: string; getPosition: (a: string) => number }[]
}
const arena = (page: Page) =>
  page.evaluate(() => {
    const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    return {
      containers: ctx.layers.map((l) => l.container),
      positions: ctx.layers.map((l) =>
        [l.plane.position.x, l.plane.position.y, l.plane.position.z].map(
          Math.round
        )
      ),
      deep: ctx.nodeObjects.filter((n) => Math.abs(n.getPosition('x')) > 1)
        .length,
      outside: ctx.nodeObjects.filter((n) => {
        const l = ctx.layers.find((x) => x.name === n.layer)!
        if (l.container !== 'sphere') return false
        const r = Math.hypot(
          n.getPosition('x'),
          n.getPosition('y'),
          n.getPosition('z')
        )
        return r > l.containerRadius() + 0.01
      }).length,
    }
  })

// nodes outside their layer's container, by the shapes' own test
// (three/containers.ts, loaded from the dev server)
const outsideShapes = (page: Page) =>
  page.evaluate(async () => {
    const { insideContainer, isVolume } = (await import(
      /* @vite-ignore */ '/src/three/containers.ts'
    )) as {
      insideContainer: (k: string, p: number[], eps?: number) => boolean
      isVolume: (k: string) => boolean
    }
    const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    return ctx.nodeObjects.filter((n) => {
      const l = ctx.layers.find((x) => x.name === n.layer)!
      if (!isVolume(l.container)) return false
      const r = l.containerRadius()
      const p = ['x', 'y', 'z'].map((a) => n.getPosition(a) / r)
      return !insideContainer(l.container, p, 1e-4)
    }).length
  })

const undoDepth = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __arena: { history: { undoStack: unknown[] } }
        }
      ).__arena.history.undoStack.length
  )

// the menu items carry a hint after their name, so panels open by target
const panel = (page: Page, id: string) =>
  page.locator(`[data-bs-target="#panel-${id}"]`).first().dispatchEvent('click')

async function load(page: Page) {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await panel(page, 'file')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
}

async function setContainer(page: Page, kind: string, surface = false) {
  await panel(page, 'layer')
  await page.locator('#layerContainer').selectOption(kind)
  if (surface) await page.locator('#containerPlacement_surface').check()
  else await page.locator('#containerPlacement_inside').check()
  await page.locator('#layer_status').evaluate((el) => (el.textContent = ''))
  await page.locator('#applyLayerContainer').click()
  await expect(page.locator('#layer_status')).toContainText('Layers set to', {
    timeout: 60_000,
  })
}

test('sphere and cube layers get 3D layouts inside', async ({ page }) => {
  await load(page)
  await panel(page, 'layer')
  await page.locator('#layerContainer').selectOption('sphere')
  await page.locator('#applyLayerContainer').click()
  await expect(page.locator('#layer_status')).toContainText(
    'laid out in 3D inside'
  )
  const s = await arena(page)
  expect(s.containers.every((c) => c === 'sphere')).toBe(true)
  expect(s.deep).toBeGreaterThan(100)
  expect(s.outside).toBe(0)
  await panel(page, 'main-view')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/containers-sphere.png' })

  // nodes already 3D -> switching to cube moves them over (no new layout)
  await panel(page, 'layer')
  await page.locator('#layerContainer').selectOption('cube')
  await page.locator('#applyLayerContainer').click()
  await expect(page.locator('#layer_status')).toHaveText(
    'Layers set to cube; nodes moved inside.'
  )
  expect(await outsideShapes(page)).toBe(0)
})

test('every container in turn, nodes inside each, then undo all the way back', async ({
  page,
}) => {
  // 15 switches, some with a new layout: slow when the whole suite runs
  test.setTimeout(360_000)
  await load(page)
  const steps: { kind: string; depth: number; containers: string[] }[] = []
  let before = await arena(page)
  for (const kind of ALL) {
    const depth = await undoDepth(page)
    await setContainer(page, kind)
    const now = await arena(page)
    expect(now.containers.every((c) => c === kind)).toBe(true)
    expect(await outsideShapes(page)).toBe(0)
    if (kind !== 'none' && kind !== 'floor')
      expect(now.deep).toBeGreaterThan(50) // the volume is used
    steps.push({ kind, depth, containers: before.containers })
    before = now
    await panel(page, 'main-view')
    await page.waitForTimeout(400)
    await page.screenshot({ path: `test-results/containers-${kind}.png` })
  }

  // undo, one switch at a time: each brings back the container before it
  for (const step of steps.reverse()) {
    await page.evaluate((depth) => {
      const h = (
        window as unknown as {
          __arena: { history: { undoStack: unknown[]; undo: () => void } }
        }
      ).__arena.history
      while (h.undoStack.length > depth) h.undo()
    }, step.depth)
    expect((await arena(page)).containers).toEqual(step.containers)
    expect(await outsideShapes(page)).toBe(0)
  }
  expect((await arena(page)).containers.every((c) => c === 'floor')).toBe(true)
})

test('on the surface, and the container look options', async ({ page }) => {
  await load(page)
  await setContainer(page, 'sphere', true)
  await expect(page.locator('#layer_status')).toContainText('on the surface')
  const onShell = await page.evaluate(() => {
    const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    return ctx.nodeObjects.every((n) => {
      const l = ctx.layers.find((x) => x.name === n.layer)!
      const d = Math.hypot(
        n.getPosition('x'),
        n.getPosition('y'),
        n.getPosition('z')
      )
      return Math.abs(d - l.containerRadius()) < 0.5
    })
  })
  expect(onShell).toBe(true)
  // cylinder, on its wall: moved over without a new layout
  await setContainer(page, 'cylinder', true)
  await expect(page.locator('#layer_status')).toContainText(
    'nodes moved onto the surface'
  )
  expect(await outsideShapes(page)).toBe(0)

  // the look: no outline, a wire cage, a rim light, the floor under it
  const parts = () =>
    page.evaluate(() => {
      const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
      const l = ctx.layers[0]
      const kinds: string[] = []
      l.volume?.traverse((o) => kinds.push(o.type))
      const floor = (
        l as unknown as { plane: { material: { visible: boolean } } }
      ).plane.material.visible
      return { lines: kinds.filter((k) => k === 'LineSegments').length, floor }
    })
  expect(await parts()).toEqual({ lines: 1, floor: false })
  await page.locator('#containerOutline').uncheck()
  await page.locator('#containerWireframe').check()
  await page.locator('#containerGlow').check()
  await page.locator('#containerShowFloor').check()
  await page.locator('#applyContainerStyle').click()
  await expect(page.locator('#layer_status')).toHaveText(
    'Container look applied.'
  )
  expect(await parts()).toEqual({ lines: 1, floor: true })
  await panel(page, 'main-view')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/containers-look.png' })
  await page.evaluate(() =>
    (
      window as unknown as { __arena: { history: { undo: () => void } } }
    ).__arena.history.undo()
  )
  expect(await parts()).toEqual({ lines: 1, floor: false })
})

test('3D network mode stacks layers and restores them', async ({ page }) => {
  await load(page)
  const before = await arena(page)
  await panel(page, 'scene')
  await page.locator('#modeSingle').dispatchEvent('click')
  await expect(page.locator('body')).toHaveClass(/mode-single/, {
    timeout: 30000,
  })
  const on = await arena(page)
  expect(on.positions.every((p) => p.join() === '0,0,0')).toBe(true)
  expect(on.containers.every((c) => c === 'none')).toBe(true)
  expect(on.deep).toBeGreaterThan(100)
  await panel(page, 'main-view')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/network-3d.png' })

  await panel(page, 'scene')
  await page.locator('#modeMultilayer').dispatchEvent('click')
  await expect(page.locator('body')).not.toHaveClass(/mode-single/)
  const off = await arena(page)
  expect(off.positions).toEqual(before.positions)
  expect(off.containers).toEqual(before.containers)
  expect(off.deep).toBe(before.deep)
})
