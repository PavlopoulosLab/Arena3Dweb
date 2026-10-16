import { expect, test } from '@playwright/test'
import path from 'node:path'

// PLAN-ROADMAP Phase 13: single-layer networks load without a floor, and a 3D
// layout lifts nodes off the plane.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const EDGELIST = path.resolve('public/data/edgelist_2columns.tsv')
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

type Arena = {
  __arena: {
    ctx: {
      layers: { floorVisible: boolean }[]
      nodeObjects: { getPosition: (a: string) => number }[]
    }
  }
}

async function upload(page: import('@playwright/test').Page, file: string) {
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#input_network_file').setInputFiles(file)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
}

test('single layer: no floor, 3D layout adds depth', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await upload(page, EDGELIST)

  const floors = () =>
    page.evaluate(() =>
      (window as unknown as Arena).__arena.ctx.layers.map((l) => l.floorVisible)
    )
  expect(await floors()).toEqual([false])
  await expect(page.locator('#showFloors')).not.toBeChecked()

  await page
    .getByRole('tab', { name: 'Layout', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#selectAllLayersCheckbox').dispatchEvent('click')
  await page.locator('#layout3dCheckbox').dispatchEvent('click')
  await page.locator('#layoutAlgorithmChoice').evaluate((el) => {
    ;(el as HTMLSelectElement).value = 'Fruchterman-Reingold'
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.locator('#runLayout').dispatchEvent('click')
  await expect(page.locator('#layouts_status')).toHaveText('Layout applied.')

  const depths = await page.evaluate(() =>
    (window as unknown as Arena).__arena.ctx.nodeObjects.map((n) =>
      n.getPosition('x')
    )
  )
  expect(depths.some((x) => Math.abs(x) > 1)).toBe(true)
  await page.screenshot({ path: 'test-results/single-layer-3d.png' })

  // a multilayer network gets its floors back
  await upload(page, FIGURE_2A)
  // #file_status already says "Loaded network" — wait for the new layers
  await page.waitForFunction(
    () => (window as unknown as Arena).__arena.ctx.layers.length > 1
  )
  expect((await floors()).every(Boolean)).toBe(true)
  await expect(page.locator('#showFloors')).toBeChecked()
})
