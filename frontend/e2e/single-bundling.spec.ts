import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// Edit → Edges in Single network mode: one Edge Bundling slider bundles every
// edge of the graph as one set, the former inter-layer edges included; back
// in Multilayered mode the intra/inter pair returns with its own strengths.

const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

// edges drawn as more than one segment, by their original kind
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
          ctx: { edgeObjects: { interLayer: boolean; THREE_Object: Obj }[] }
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

test('single network mode bundles every edge as one set', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  await page.locator('#modeSingle').dispatchEvent('click')
  await expect(page.locator('body')).toHaveClass(/mode-single/, {
    timeout: 15000,
  })
  await tab(page, 'Edges')
  await expect(page.locator('#interBundling')).toBeHidden()
  await expect(page.locator('label[for="intraBundling"]')).toHaveText(
    /^Edge Bundling/,
    { useInnerText: true }
  )

  // one slider bends the former inter-layer edges along with the rest
  await slide(page, 'intraBundling', '0.8')
  await expect.poll(async () => (await curved(page)).intra).toBeGreaterThan(20)
  await expect.poll(async () => (await curved(page)).inter).toBeGreaterThan(20)
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as {
            __arena: { history: { undoStack: { description: string }[] } }
          }
        ).__arena.history.undoStack.at(-1)?.description
    )
  ).toBe('Edge bundling 0.8')

  // back to layers: the inter-layer edges straighten (their slider is 0),
  // the intra-layer ones bundle per layer again
  await page.locator('#modeMultilayer').dispatchEvent('click')
  await expect(page.locator('body')).not.toHaveClass(/mode-single/, {
    timeout: 15000,
  })
  await expect.poll(async () => (await curved(page)).inter).toBe(0)
  await expect.poll(async () => (await curved(page)).intra).toBeGreaterThan(20)
  await expect(page.locator('#interBundling')).toBeVisible()
  await expect(page.locator('#interBundling')).toHaveValue('0')
  await expect(page.locator('label[for="intraBundling"]')).toHaveText(
    /^Intra-Layer Edge Bundling/,
    { useInnerText: true }
  )
})
