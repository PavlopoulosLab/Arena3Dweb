import { expect, test } from './fixtures'

// Full flow from PLAN Phase 14: upload (example) network → apply layout →
// apply clustered layout → export session. The WebGL canvas is opaque to the
// DOM, so scene assertions read window.__arena.ctx (the Phase 12 test hook).

// Set a <select> value and fire change directly — Playwright's selectOption
// waits for actionability, which times out under the post-load render-loop
// main-thread starvation on headless CI.
async function selectOption(
  page: import('@playwright/test').Page,
  selector: string,
  value: string
) {
  await page.locator(selector).evaluate((el, v) => {
    ;(el as HTMLSelectElement).value = v
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

type NodeSnapshot = { pos: [number, number, number]; cluster: string }

function readNodes() {
  // Runs inside page.evaluate, which accepts a sync function just as happily.
  return (): NodeSnapshot[] => {
    const ctx = (
      window as unknown as { __arena: { ctx: { nodeObjects: unknown[] } } }
    ).__arena.ctx
    return (
      ctx.nodeObjects as {
        getPosition: (a: string) => number
        cluster: string
      }[]
    ).map((n) => ({
      pos: [n.getPosition('x'), n.getPosition('y'), n.getPosition('z')],
      cluster: n.cluster,
    }))
  }
}

test('load example → layout → clustering → export', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )

  // --- Upload: Load Example -----------------------------------------------
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.getByRole('button', { name: 'Load Example' }).click()
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  const nodeCount = await page.evaluate(
    () =>
      (window as unknown as { __arena: { ctx: { nodeObjects: unknown[] } } })
        .__arena.ctx.nodeObjects.length
  )
  expect(nodeCount).toBe(255)

  const before = await page.evaluate(readNodes())

  // --- Apply layout (all layers, Fruchterman-Reingold) --------------------
  // dispatchEvent, not click()/check(): once a network loads the WebGL render
  // loop saturates the main thread on headless CI, so Playwright's actionability
  // wait times out (and force-clicks land on drawer overlays, never toggling
  // the input). Firing the handler directly on the element sidesteps both.
  await page
    .getByRole('tab', { name: 'Layout', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#subgraph_allLayers').dispatchEvent('click')
  await page.locator('#selectAllLayersCheckbox').dispatchEvent('click')
  await selectOption(page, '#layoutAlgorithmChoice', 'Fruchterman-Reingold')
  await page.locator('#runLayout').dispatchEvent('click')
  // The #layouts_status text is identical after every run, so wait on the
  // actual scene change (a moved node) rather than the status string.
  const beforeJson = JSON.stringify(before.map((n) => n.pos))
  await page.waitForFunction(
    (prev) => {
      const ctx = (
        window as unknown as {
          __arena: {
            ctx: { nodeObjects: { getPosition: (a: string) => number }[] }
          }
        }
      ).__arena.ctx
      const now = JSON.stringify(
        ctx.nodeObjects.map((n) => [
          n.getPosition('x'),
          n.getPosition('y'),
          n.getPosition('z'),
        ])
      )
      return now !== prev
    },
    beforeJson,
    { timeout: 15_000 }
  )

  // --- Find communities (Clustering panel, Louvain) ------------------------
  await page
    .getByRole('tab', { name: 'Clustering', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await selectOption(page, '#clusterAlgorithm', 'Louvain')
  await page.locator('#runClustering').dispatchEvent('click')
  // Wait for clustering to assign ids (status text is unchanged between runs).
  await page.waitForFunction(
    () => {
      const ctx = (
        window as unknown as {
          __arena: { ctx: { nodeObjects: { cluster: string }[] } }
        }
      ).__arena.ctx
      return ctx.nodeObjects.some((n) => n.cluster !== '')
    },
    undefined,
    { timeout: 15_000 }
  )

  // --- Export session ------------------------------------------------------
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  const downloadPromise = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Save Session' })
    .dispatchEvent('click')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.json$/)
})
