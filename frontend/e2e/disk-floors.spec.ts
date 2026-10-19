import { expect, test } from './fixtures'
import path from 'node:path'

// PLAN-ROADMAP Phase 18: round (disk) floors for selected layers, undoable.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

type Ctx = {
  layers: { floorShape: string; plane: { geometry: { type: string } } }[]
}
const shapes = () =>
  (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx.layers.map(
    (l) => `${l.floorShape}:${l.plane.geometry.type}`
  )

test('disk floors for the selected layer, then all, undoable', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  await page
    .getByRole('tab', { name: 'Layout', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#checkbox_1').dispatchEvent('click')
  await page
    .getByRole('tab', { name: 'Layers', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#floorShape_disk').check()
  expect((await page.evaluate(shapes))[1]).toBe('disk:CircleGeometry')
  expect((await page.evaluate(shapes))[0]).toBe('square:PlaneGeometry')

  await page
    .getByRole('tab', { name: 'Layout', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#checkbox_1').dispatchEvent('click') // none selected -> all
  await page
    .getByRole('tab', { name: 'Layers', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#floorShape_square').check()
  await page.locator('#floorShape_disk').check()
  expect(
    (await page.evaluate(shapes)).every((s) => s === 'disk:CircleGeometry')
  ).toBe(true)
  await page
    .getByRole('tab', { name: '3D View', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/disk-floors.png' })

  // every node now sits inside its disk
  const outside = await page.evaluate(() => {
    const ctx = (
      window as unknown as {
        __arena: {
          ctx: {
            layers: {
              name: string
              geometry_parameters_width: number
              getScale: () => number
            }[]
            nodeObjects: { layer: string; getPosition: (a: string) => number }[]
          }
        }
      }
    ).__arena.ctx
    return ctx.nodeObjects.filter((n) => {
      const l = ctx.layers.find((x) => x.name === n.layer)!
      return (
        Math.hypot(n.getPosition('y'), n.getPosition('z')) >
        (l.geometry_parameters_width / 2) * l.getScale()
      )
    }).length
  })
  expect(outside).toBe(0)

  await page.evaluate(() => {
    const h = (
      window as unknown as { __arena: { history: { undo: () => void } } }
    ).__arena.history
    h.undo() // the fit
    h.undo() // the shape
  })
  expect(
    (await page.evaluate(shapes)).every((s) => s.startsWith('square'))
  ).toBe(true)
})
