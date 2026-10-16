import { expect, test } from '@playwright/test'
import path from 'node:path'

// PLAN-ROADMAP Phase 2: "Align Nodes Across Selected Layers". After a coupled
// layout every node label shared by several layers sits at the same in-plane
// (y, z) position in each of them.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

test('coupled layout aligns shared nodes across layers', async ({ page }) => {
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
  await page.locator('#subgraph_coupled').dispatchEvent('click')
  await page.locator('#selectAllLayersCheckbox').dispatchEvent('click')
  await page.locator('#layoutAlgorithmChoice').evaluate((el) => {
    ;(el as HTMLSelectElement).value = 'Fruchterman-Reingold'
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.locator('#runLayout').dispatchEvent('click')
  await expect(page.locator('#layouts_status')).toHaveText('Layout applied.')

  // label -> distinct rounded (y, z) positions across its layers
  const spread = await page.evaluate(() => {
    const ctx = (
      window as unknown as {
        __arena: {
          ctx: {
            nodeObjects: {
              name: string
              getPosition: (a: string) => number
            }[]
          }
        }
      }
    ).__arena.ctx
    const byLabel: Record<string, Set<string>> = {}
    const copies: Record<string, number> = {}
    for (const n of ctx.nodeObjects) {
      const key = `${n.getPosition('y').toFixed(3)},${n.getPosition('z').toFixed(3)}`
      ;(byLabel[n.name] ??= new Set()).add(key)
      copies[n.name] = (copies[n.name] ?? 0) + 1
    }
    const shared = Object.keys(copies).filter((k) => copies[k] > 1)
    return {
      shared: shared.length,
      misaligned: shared.filter((k) => byLabel[k].size > 1),
    }
  })
  expect(spread.shared).toBeGreaterThan(0)
  expect(spread.misaligned).toEqual([])
})
