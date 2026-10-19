import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// Network mode (top bar): a one-layer network imported as a single 3D network
// opens with the layer-only controls hidden; a multilayer network can be switched to one
// graph (layers stacked, laid out at once) and back; undo keeps the switch
// truthful.

const D = (f: string) => path.resolve('public/data', f)
const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')
const load = async (page: Page, f: string) => {
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(D(f))
  await expect(page.locator('#file_status')).toContainText('Loaded network')
}
const answer = (page: Page, mode: 'replace' | 'single') =>
  page.evaluate((m) => {
    ;(window as unknown as { __arenaImportAs?: string }).__arenaImportAs = m
  }, mode)
const scene = (page: Page) =>
  page.evaluate(() => {
    const c = (
      window as unknown as {
        __arena: {
          ctx: {
            networkMode: string
            layers: {
              floorVisible: boolean
              plane: { position: { x: number } }
            }[]
          }
        }
      }
    ).__arena.ctx
    return {
      mode: c.networkMode,
      floors: c.layers.map((l) => l.floorVisible),
      xs: new Set(c.layers.map((l) => Math.round(l.plane.position.x))).size,
    }
  })

test('one layer opens as a single network; the switch brings the floor back', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await expect(page.locator('#modeSingle')).toBeDisabled()
  // Import as "Single 3D network": the one-layer graph is laid out in 3D,
  // and the one-layer prompt does not ask again
  await answer(page, 'single')
  await load(page, 'edgelist_2columns.tsv')
  await expect(page.locator('#oneLayerPrompt')).toBeHidden()
  await expect(page.locator('body')).toHaveClass(/mode-single/)
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (
            window as unknown as {
              __arena: {
                ctx: { nodeObjects: { getPosition: (a: string) => number }[] }
              }
            }
          ).__arena.ctx.nodeObjects.some(
            (n) => Math.abs(n.getPosition('x')) > 1
          )
        ),
      { timeout: 30_000 }
    )
    .toBe(true)
  await expect(page.locator('#layout3dCheckbox')).toBeChecked()
  await expect(page.locator('#modeSingle')).toHaveClass(/active/)
  expect(await scene(page)).toMatchObject({ mode: 'single', floors: [false] })
  // layer-only controls step aside
  await expect(page.locator('#interLayerEdgesRenderPauseButton')).toBeHidden()
  await tab(page, 'Layout')
  await expect(page.locator('#alignmentCard')).toBeHidden()
  await expect(
    page.locator('[data-bs-target="#panel-layer-selection"]')
  ).toBeHidden()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.locator('[data-bs-target="#panel-layer"]')).toBeHidden()
  await page.keyboard.press('Escape')

  await page.locator('#modeMultilayer').dispatchEvent('click')
  await expect(page.locator('body')).not.toHaveClass(/mode-single/)
  expect(await scene(page)).toMatchObject({
    mode: 'multilayer',
    floors: [true],
  })
  await expect(page.locator('#alignmentCard')).toBeVisible()
})

test('a multilayer network becomes one graph and back, with undo in step', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await load(page, 'figure2A_data.tsv')
  expect((await scene(page)).mode).toBe('multilayer')
  expect((await scene(page)).xs).toBe(4) // four floors side by side

  await page.locator('#modeSingle').dispatchEvent('click')
  await expect(page.locator('body')).toHaveClass(/mode-single/, {
    timeout: 30000,
  })
  expect(await scene(page)).toMatchObject({ mode: 'single', xs: 1 }) // stacked
  // a layout in single mode covers the whole network without a layer choice
  await tab(page, 'Layout')
  await page.locator('#layoutAlgorithmChoice').selectOption('Kamada-Kawai')
  await page.locator('#runLayout').dispatchEvent('click')
  await expect(page.locator('#layouts_status')).toHaveText('Layout applied.', {
    timeout: 30000,
  })

  await page.locator('#modeMultilayer').dispatchEvent('click')
  await expect(page.locator('body')).not.toHaveClass(/mode-single/, {
    timeout: 30000,
  })
  expect((await scene(page)).xs).toBe(4) // floors back where they were

  // switching to single is undoable; the switch follows the scene
  await page.locator('#modeSingle').dispatchEvent('click')
  await expect(page.locator('body')).toHaveClass(/mode-single/, {
    timeout: 30000,
  })
  await page.locator('#undoButton').dispatchEvent('click') // the 3D layout
  await page.locator('#undoButton').dispatchEvent('click') // the stacking
  await expect(page.locator('body')).not.toHaveClass(/mode-single/)
  expect((await scene(page)).xs).toBe(4)
})

test('one layer as a new network keeps the floor and the multilayer controls', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  // Import as "New network": a one-layer network sits on its floor
  await load(page, 'edgelist_2columns.tsv')
  await expect(page.locator('#oneLayerPrompt')).toBeHidden()
  await expect(page.locator('body')).not.toHaveClass(/mode-single/)
  expect(await scene(page)).toMatchObject({
    mode: 'multilayer',
    floors: [true],
  })
  // a session does not ask
  await load(page, 'figure2A_data.tsv')
  await expect(page.locator('#oneLayerPrompt')).toBeHidden()
})
