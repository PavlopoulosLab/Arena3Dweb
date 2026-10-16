import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

// PLAN-ROADMAP Phase 6: pie-chart nodes from an Annotation column, convex
// hulls (clusters / annotations), STRING enrichment of a selection
// (intercepted — no internet in CI).

// Playwright runs from frontend/ (playwright.config.ts lives there)
const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

type Obj = { children: Obj[]; type: string; userData: Record<string, unknown> }
type Ctx = {
  layers: { plane: Obj }[]
  nodeObjects: { name: string; sphere: Obj; annotations: string[] }[]
}
const counts = () => {
  const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
  return {
    pies: ctx.nodeObjects.reduce(
      (s, n) => s + n.sphere.children.filter((c) => c.type === 'Sprite').length,
      0
    ),
    hulls: ctx.layers.reduce(
      (s, l) => s + l.plane.children.filter((c) => c.userData.hullGroup).length,
      0
    ),
  }
}

async function load(page: Page) {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
}

test('annotation pies and hulls from a node attribute file', async ({
  page,
}) => {
  await load(page)
  const names = await page.evaluate(() =>
    (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx.nodeObjects
      .slice(0, 3)
      .map((n) => n.name + '\t' + (n as unknown as { layer: string }).layer)
  )
  const tsv =
    'Node\tLayer\tAnnotation\n' +
    `${names[0]}\tTermA;TermB\n${names[1]}\tTermA\n${names[2]}\tTermB;TermC;TermA\n`
  await page.locator('#node_attributes_file').setInputFiles({
    name: 'ann.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from(tsv),
  })
  await expect(page.locator('#file_status')).toContainText('attributes')

  await page
    .getByRole('tab', { name: 'Analysis', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#annotation_card summary').click()
  await page.locator('#showPies').check()
  expect((await page.evaluate(counts)).pies).toBe(3)
  await page.locator('#hull_annotation').check()
  const hulls = (await page.evaluate(counts)).hulls
  expect(hulls).toBeGreaterThanOrEqual(3) // TermA/B/C (per layer they occur in)
  await page
    .getByRole('tab', { name: '3D View', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/annotation-hulls.png' })
  await page
    .getByRole('tab', { name: 'Analysis', includeHidden: true, exact: true })
    .dispatchEvent('click')
  // NORMA-style fog clouds: one cloud (of soft sprites) per group
  await page.locator('#hullStyle_fog').check()
  const fog = await page.evaluate(() => {
    const ctx = (
      window as unknown as {
        __arena: {
          ctx: {
            layers: {
              plane: {
                children: {
                  userData: Record<string, unknown>
                  children: { type: string }[]
                }[]
              }
            }[]
          }
        }
      }
    ).__arena.ctx
    const clouds = ctx.layers.flatMap((l) =>
      l.plane.children.filter((c) => c.userData.hullGroup)
    )
    return {
      clouds: clouds.length,
      sprites: clouds.every(
        (c) =>
          c.children.length > 0 && c.children.every((s) => s.type === 'Sprite')
      ),
    }
  })
  expect(fog.clouds).toBe(hulls)
  expect(fog.sprites).toBe(true)
  await page
    .getByRole('tab', { name: '3D View', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/annotation-fog.png' })
  await page
    .getByRole('tab', { name: 'Analysis', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#hull_none').check()
  expect((await page.evaluate(counts)).hulls).toBe(0)
})

test('enrichment of selected nodes annotates them', async ({ page }) => {
  await load(page)
  const picked = await page.evaluate(() =>
    (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx.nodeObjects
      .slice(0, 4)
      .map((n) => n.name)
  )
  let body: { genes: string[] } | null = null
  await page.route('**/api/enrichment', async (route) => {
    body = route.request().postDataJSON() as { genes: string[] }
    await route.fulfill({
      json: [
        {
          category: 'KEGG',
          term: 'k1',
          description: 'Pathway one',
          fdr: 1e-6,
          p_value: 1e-7,
          genes: picked.slice(0, 2),
        },
        {
          category: 'Process',
          term: 'GO:1',
          description: 'Process two',
          fdr: 1e-3,
          p_value: 1e-4,
          genes: picked.slice(1, 4),
        },
      ],
    })
  })

  await page
    .getByRole('tab', { name: 'Analysis', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#annotation_card summary').click()
  await page.locator('#runEnrichment').click()
  await expect(page.locator('#enrich_status')).toContainText(
    'Select some nodes'
  )

  await page.evaluate((names) => {
    const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    for (const n of ctx.nodeObjects)
      (n as unknown as { isSelected: boolean }).isSelected = names.includes(
        n.name
      )
  }, picked)
  await page.locator('#runEnrichment').click()
  await expect(page.locator('#enrich_results tbody tr')).toHaveCount(2)
  expect(new Set(body!.genes)).toEqual(new Set(picked))

  await page.locator('#annotateTopTerms').click()
  const annotated = await page.evaluate(
    (first) =>
      (
        window as unknown as { __arena: { ctx: Ctx } }
      ).__arena.ctx.nodeObjects.find((n) => n.name === first)!.annotations,
    picked[1]
  )
  expect(annotated).toEqual(['Pathway one', 'Process two'])
  expect((await page.evaluate(counts)).pies).toBeGreaterThan(0)
})
