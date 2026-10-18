import { expect, test, type Page } from './fixtures'
import os from 'node:os'
import path from 'node:path'

// Edit → Edges: intra- and inter-layer bundling sliders bend edges into
// shared bundles; 0 straightens them again, and each change is one undo step.

const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

// edges drawn as more than one segment, per kind
const curved = (page: Page) =>
  page.evaluate(() => {
    type Obj = {
      type: string
      geometry?: { attributes: { instanceStart?: { count: number } } }
      children: Obj[]
    }
    const ctx = (
      window as unknown as {
        __arena: {
          ctx: {
            edgeObjects: { interLayer: boolean; THREE_Object: Obj }[]
            intraEdgeBundling: number
          }
        }
      }
    ).__arena.ctx
    const segments = (o: Obj): number =>
      o.type === 'Line2'
        ? (o.geometry?.attributes.instanceStart?.count ?? 0)
        : Math.max(0, ...o.children.map(segments))
    const out = { intra: 0, inter: 0 }
    for (const e of ctx.edgeObjects)
      if (segments(e.THREE_Object) > 1) out[e.interLayer ? 'inter' : 'intra']++
    return out
  })

async function slide(page: Page, id: string, value: string): Promise<void> {
  await page.locator(`#${id}`).evaluate((el, v) => {
    const input = el as HTMLInputElement
    input.value = v
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

test('edge bundling sliders bundle intra- and inter-layer edges', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  expect(await curved(page)).toEqual({ intra: 0, inter: 0 })

  await tab(page, 'Edges')
  await slide(page, 'intraBundling', '0.8')
  await expect.poll(async () => (await curved(page)).intra).toBeGreaterThan(20)
  await expect(page.locator('#intraBundlingValue')).toHaveText('0.80')

  await slide(page, 'interBundling', '1')
  await expect.poll(async () => (await curved(page)).inter).toBeGreaterThan(20)

  await tab(page, '3D View')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/edge-bundling.png' })

  // undo the inter-layer step: those edges go straight, the slider follows
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect.poll(async () => (await curved(page)).inter).toBe(0)
  expect((await curved(page)).intra).toBeGreaterThan(20)
  await tab(page, 'Edges')
  await expect(page.locator('#interBundling')).toHaveValue('0')

  // strengths are saved in sessions and the bundles come back on load
  await slide(page, 'interBundling', '0.6')
  await expect.poll(async () => (await curved(page)).inter).toBeGreaterThan(20)
  await tab(page, 'File')
  const download = page.waitForEvent('download')
  await page.locator('#save_network_object').dispatchEvent('click')
  const file = path.join(os.tmpdir(), 'arena3d-e2e-bundled-session.json')
  await (await download).saveAs(file)
  await page.reload()
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#load_network_file').setInputFiles(file)
  await expect(page.locator('#file_status')).toContainText('Session loaded')
  await expect
    .poll(async () => (await curved(page)).intra, { timeout: 15000 })
    .toBeGreaterThan(20)
  await expect
    .poll(async () => (await curved(page)).inter, { timeout: 15000 })
    .toBeGreaterThan(20)
  await tab(page, 'Edges')
  await expect(page.locator('#intraBundling')).toHaveValue('0.8')
  await expect(page.locator('#interBundling')).toHaveValue('0.6')
})
