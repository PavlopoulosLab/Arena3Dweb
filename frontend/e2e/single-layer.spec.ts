import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// PLAN-ROADMAP Phase 13: a single-layer network imported as a single 3D
// network has no floor, and its 3D layout lifts nodes off the plane.

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

async function upload(page: Page, file: string) {
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#input_network_file').setInputFiles(file)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
}

const answer = (page: Page, mode: 'replace' | 'single') =>
  page.evaluate((m) => {
    ;(window as unknown as { __arenaImportAs?: string }).__arenaImportAs = m
  }, mode)

test('single layer as a single 3D network: no floor, 3D layout adds depth', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await answer(page, 'single')
  await upload(page, EDGELIST)

  const floors = () =>
    page.evaluate(() =>
      (window as unknown as Arena).__arena.ctx.layers.map((l) => l.floorVisible)
    )
  expect(await floors()).toEqual([false])
  await expect(page.locator('#showFloors')).not.toBeChecked()
  // the import runs a 3D layout: nodes leave the plane
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          (window as unknown as Arena).__arena.ctx.nodeObjects.some(
            (n) => Math.abs(n.getPosition('x')) > 1
          )
        ),
      { timeout: 30_000 }
    )
    .toBe(true)
  await page.screenshot({ path: 'test-results/single-layer-3d.png' })

  // a multilayer network as a new network gets its floors back
  await answer(page, 'replace')
  await upload(page, FIGURE_2A)
  // #file_status already says "Loaded network" — wait for the new layers
  await page.waitForFunction(
    () => (window as unknown as Arena).__arena.ctx.layers.length > 1
  )
  expect((await floors()).every(Boolean)).toBe(true)
  await expect(page.locator('#showFloors')).toBeChecked()
})
