import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// Each layer's coordinate system: Edit → Layers → Layer Coord Systems (All /
// Selected, following the selection / None), or one layer at a time with
// Layer selection → Axes.

const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

// per layer: the flag, and whether its axes are drawn
const axes = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as {
        __arena: {
          ctx: {
            layers: {
              coordsShown: boolean
              coordSystem: { visible: boolean }[]
            }[]
          }
        }
      }
    ).__arena.ctx.layers.map((l) => {
      if (l.coordSystem.some((a) => a.visible !== l.coordsShown))
        throw new Error('flag and axes disagree')
      return l.coordsShown
    })
  )

const pick = (page: Page, id: string) =>
  page.locator(id).evaluate((el) => (el as HTMLInputElement).click())

test('layer coordinate systems: all, selected, none, or one by one', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  expect(await axes(page)).toEqual([false, false, false, false])

  await pick(page, '#layerCoords_all')
  expect(await axes(page)).toEqual([true, true, true, true])
  await expect(page.locator('#checkbox4_2')).toBeChecked()
  await pick(page, '#layerCoords_none')
  expect(await axes(page)).toEqual([false, false, false, false])

  // Selected follows the layer selection
  await pick(page, '#layerCoords_selected')
  await pick(page, '#checkbox_1')
  await expect.poll(() => axes(page)).toEqual([false, true, false, false])
  await pick(page, '#checkbox_3')
  await expect.poll(() => axes(page)).toEqual([false, true, false, true])
  await expect(page.locator('#checkbox4_3')).toBeChecked()
  await pick(page, '#checkbox_1')
  await expect.poll(() => axes(page)).toEqual([false, false, false, true])

  // one layer at a time: the radio shows no mode, the selection no longer
  // drives the axes
  await pick(page, '#checkbox4_0')
  expect(await axes(page)).toEqual([true, false, false, true])
  for (const id of ['all', 'selected', 'none'])
    await expect(page.locator(`#layerCoords_${id}`)).not.toBeChecked()
  await pick(page, '#checkbox_2')
  expect(await axes(page)).toEqual([true, false, false, true])

  // a new network: each layer's own choice does not carry over
  await tab(page, 'File')
  await page.locator('#file_status').evaluate((el) => (el.textContent = ''))
  await page
    .locator('#input_network_file')
    .setInputFiles(path.resolve('public/data/aspirin_3channels.tsv'))
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  await expect.poll(async () => (await axes(page)).some(Boolean)).toBe(false)
  await expect(page.locator('#layerCoords_none')).toBeChecked()
})
