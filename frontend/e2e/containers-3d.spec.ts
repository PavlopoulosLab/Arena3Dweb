import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// PLAN-ROADMAP Phases 19-20: layers as cubes/spheres/clouds with 3D layouts
// inside, and the "3D network (ignore layers)" mode.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

type Ctx = {
  layers: {
    name: string
    container: string
    plane: { position: { x: number; y: number; z: number } }
    containerRadius: () => number
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

async function load(page: Page) {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
}

test('sphere and cube layers get 3D layouts inside', async ({ page }) => {
  await load(page)
  await page
    .getByRole('tab', { name: 'Layers', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#layerContainer').selectOption('sphere')
  await page.locator('#applyLayerContainer').click()
  await expect(page.locator('#layer_status')).toContainText(
    'laid out in 3D inside'
  )
  const s = await arena(page)
  expect(s.containers.every((c) => c === 'sphere')).toBe(true)
  expect(s.deep).toBeGreaterThan(100)
  expect(s.outside).toBe(0)
  await page
    .getByRole('tab', { name: '3D View', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/containers-sphere.png' })

  // nodes already 3D -> switching to cube keeps them (no new layout)
  await page
    .getByRole('tab', { name: 'Layers', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#layerContainer').selectOption('cube')
  await page.locator('#applyLayerContainer').click()
  await expect(page.locator('#layer_status')).toHaveText('Layers set to cube.')
})

test('3D network mode stacks layers and restores them', async ({ page }) => {
  await load(page)
  const before = await arena(page)
  await page
    .getByRole('tab', {
      name: 'Scene & Camera',
      includeHidden: true,
      exact: true,
    })
    .dispatchEvent('click')
  await page.locator('#modeSingle').dispatchEvent('click')
  await expect(page.locator('body')).toHaveClass(/mode-single/, {
    timeout: 30000,
  })
  const on = await arena(page)
  expect(on.positions.every((p) => p.join() === '0,0,0')).toBe(true)
  expect(on.containers.every((c) => c === 'none')).toBe(true)
  expect(on.deep).toBeGreaterThan(100)
  await page
    .getByRole('tab', { name: '3D View', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/network-3d.png' })

  await page
    .getByRole('tab', {
      name: 'Scene & Camera',
      includeHidden: true,
      exact: true,
    })
    .dispatchEvent('click')
  await page.locator('#modeMultilayer').dispatchEvent('click')
  await expect(page.locator('body')).not.toHaveClass(/mode-single/)
  const off = await arena(page)
  expect(off.positions).toEqual(before.positions)
  expect(off.containers).toEqual(before.containers)
  expect(off.deep).toBe(before.deep)
})
