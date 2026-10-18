import { expect, test, type Page } from './fixtures'
import fs from 'node:fs'
import path from 'node:path'

// Sessions keep the 3D state: layer shapes (spheres), hidden floors and
// 3D-network mode — a session saved in that mode reloads in it and can still
// be turned back into layers.

const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

const snap = (page: Page) =>
  page.evaluate(() => {
    const ctx = (
      window as unknown as {
        __arena: {
          ctx: {
            layers: {
              container: string
              containerColor: string | null
              containerOpacity: number
              floorVisible: boolean
              plane: { position: { x: number } }
            }[]
          }
        }
      }
    ).__arena.ctx
    return {
      containers: ctx.layers.map((l) => l.container),
      looks: ctx.layers.map((l) => `${l.containerColor}/${l.containerOpacity}`),
      floors: ctx.layers.map((l) => l.floorVisible),
      xs: ctx.layers.map((l) => Math.round(l.plane.position.x)),
    }
  })

async function saveAndReload(page: Page, out: string): Promise<void> {
  await tab(page, 'File')
  const download = page.waitForEvent('download')
  await page.locator('#save_network_object').click()
  await (await download).saveAs(out)
  await page.reload()
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#load_network_file').setInputFiles(out)
  await expect(page.locator('#file_status')).toContainText('Session loaded')
}

test('sessions keep sphere layers, their look, hidden floors and 3D-network mode', async ({
  page,
}, info) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  // first layer hidden floor, all layers spheres
  await tab(page, 'Layers')
  await page.locator('#layerContainer').selectOption('sphere')
  await page.locator('#applyLayerContainer').click()
  await expect(page.locator('#layer_status')).toContainText('sphere')
  await page.evaluate(() => {
    const w = window as unknown as {
      __arena: { ctx: { layers: { toggleFloor: (f: boolean) => void }[] } }
    }
    w.__arena.ctx.layers[0].toggleFloor(false)
  })
  // container colour and opacity (all layers: none selected)
  await page.locator('#containerFollowFloor').uncheck()
  await page.locator('#containerColor').fill('#ff3366')
  await page.locator('#containerOpacity').fill('0.8')
  await page.locator('#applyContainerStyle').click()
  await expect(page.locator('#layer_status')).toHaveText(
    'Container look applied.'
  )
  const layered = await snap(page)
  expect(layered.containers).toEqual(['sphere', 'sphere', 'sphere', 'sphere'])
  expect(new Set(layered.looks)).toEqual(new Set(['#ff3366/0.8']))

  const file1 = info.outputPath('spheres.json')
  await saveAndReload(page, file1)
  const back = await snap(page)
  expect(back.containers).toEqual(layered.containers)
  expect(back.looks).toEqual(layered.looks)
  expect(back.floors).toEqual(layered.floors)
  expect(back.xs).toEqual(layered.xs)

  // 3D-network mode survives a save/load and can still be undone
  await tab(page, 'Scene & Camera')
  await page.locator('#modeSingle').dispatchEvent('click')
  await expect(page.locator('body')).toHaveClass(/mode-single/, {
    timeout: 30000,
  })
  const stacked = await snap(page)
  expect(new Set(stacked.xs).size).toBe(1)

  const file2 = info.outputPath('network3d.json')
  await saveAndReload(page, file2)
  const saved = JSON.parse(fs.readFileSync(file2, 'utf8')) as {
    layers: { layered?: unknown }[]
  }
  expect(saved.layers.every((l) => l.layered)).toBe(true)
  expect((await snap(page)).xs).toEqual(stacked.xs)
  await tab(page, 'Scene & Camera')
  await expect(page.locator('#modeSingle')).toHaveClass(/active/)
  await page.locator('#modeMultilayer').dispatchEvent('click')
  await expect(page.locator('body')).not.toHaveClass(/mode-single/)
  const restored = await snap(page)
  expect(restored.containers).toEqual(layered.containers)
  expect(restored.xs).toEqual(layered.xs)
})
