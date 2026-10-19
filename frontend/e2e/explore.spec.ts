import { expect, test } from './fixtures'
import path from 'node:path'

// PLAN-ROADMAP Phase 7: hop expansion, shortest path, attribute search,
// edge weight filter.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const ASPIRIN = path.resolve('public/data/aspirin_3channels.tsv')

type Ctx = {
  nodeObjects: { name: string; isSelected: boolean; descr: string }[]
  edgeObjects: { isSelected: boolean }[]
}
const selectedCount = () =>
  (
    window as unknown as { __arena: { ctx: Ctx } }
  ).__arena.ctx.nodeObjects.filter((n) => n.isSelected).length

test('expand, shortest path, attribute search, weight filter', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.locator('#input_network_file').setInputFiles(ASPIRIN)
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  await page.evaluate(() => {
    const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    ctx.nodeObjects.find((n) => n.name === 'aspirin')!.isSelected = true
  })
  await page
    .getByRole('tab', { name: 'Explore', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#explore_card')
    .evaluate((d) => ((d as HTMLDetailsElement).open = true))
  await page.locator('#walk_across').check()
  await page.locator('#expand1').click()
  await expect(page.locator('#explore_status')).toContainText('Added')
  const afterOne = await page.evaluate(selectedCount)
  expect(afterOne).toBeGreaterThan(1)

  // shortest path between aspirin and one of its 2-hop neighbours
  await page.evaluate(() => {
    const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    for (const n of ctx.nodeObjects) n.isSelected = false
    ctx.nodeObjects.find((n) => n.name === 'aspirin')!.isSelected = true
    ctx.nodeObjects.find((n) => n.name === 'PTGS1')!.isSelected = true
  })
  await page.locator('#shortestPath').click()
  await expect(page.locator('#explore_status')).toContainText('Path of')
  const pathEdges = await page.evaluate(
    () =>
      (
        window as unknown as { __arena: { ctx: Ctx } }
      ).__arena.ctx.edgeObjects.filter((e) => e.isSelected).length
  )
  expect(pathEdges).toBeGreaterThan(0)

  await page.evaluate(() => {
    const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    ctx.nodeObjects.find((n) => n.name === 'PTGS1')!.descr = 'Cyclooxygenase-1'
  })
  await page.locator('#attributeSearch').fill('cyclooxygenase')
  await page.locator('#attributeSearch').press('Enter')
  await expect(page.locator('#explore_status')).toHaveText(
    'Selected 1 matching node.'
  )

  await page
    .getByRole('tab', { name: 'Edges', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#edgeWeightThreshold').evaluate((el) => {
    ;(el as HTMLInputElement).value = '0.9'
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(page.locator('#edgeWeightThresholdValue')).toContainText(
    '0.90 ('
  )
  const hidden = Number(
    (await page.locator('#edgeWeightThresholdValue').textContent())!.match(
      /\((\d+) hidden/
    )![1]
  )
  expect(hidden).toBeGreaterThan(0)
})

test('whole-selection tools and the live path highlight', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.locator('#input_network_file').setInputFiles(ASPIRIN)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  await page
    .getByRole('tab', { name: 'Explore', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#explore_card')
    .evaluate((d) => ((d as HTMLDetailsElement).open = true))
  await page.locator('#walk_across').check()
  const total = await page.evaluate(
    () =>
      (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx.nodeObjects
        .length
  )
  const selectedEdges = () =>
    page.evaluate(
      () =>
        (
          window as unknown as { __arena: { ctx: Ctx } }
        ).__arena.ctx.edgeObjects.filter((e) => e.isSelected).length
    )

  await page.locator('#selectEverything').click()
  expect(await page.evaluate(selectedCount)).toBe(total)
  await page.locator('#clearSelection').click()
  expect(await page.evaluate(selectedCount)).toBe(0)
  await page.locator('#invertSelection').click()
  expect(await page.evaluate(selectedCount)).toBe(total)
  await page.locator('#clearSelection').click()

  // hubs, then everything connected to aspirin
  await page.locator('#minLinks').fill('3')
  await page.locator('#selectHubs').click()
  await expect(page.locator('#explore_status')).toContainText(
    'with at least 3 links'
  )
  await page.locator('#clearSelection').click()
  await page.evaluate(() => {
    const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    ctx.nodeObjects.find((n) => n.name === 'aspirin')!.isSelected = true
  })
  await page.locator('#selectComponent').click()
  await expect(page.locator('#explore_status')).toContainText('connected node')
  expect(await page.evaluate(selectedCount)).toBeGreaterThan(1)
  await page.locator('#clearSelection').click()

  // two selected nodes, not linked: the path between them (through aspirin)
  // lights up as the switch goes on
  await page.evaluate(() => {
    const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    ctx.nodeObjects.find((n) => n.name === 'PTGS1')!.isSelected = true
    ctx.nodeObjects.find((n) => n.name === 'SELP')!.isSelected = true
  })
  await expect(page.locator('#pathNodes')).toBeDisabled()
  await page.locator('#highlightPaths').check()
  await expect(page.locator('#path_status')).toContainText('1 of 1 pair joined')
  expect(await selectedEdges()).toBeGreaterThan(1)
  expect(await page.evaluate(selectedCount)).toBe(2)
  await page.locator('#pathNodes').check()
  await expect(page.locator('#path_status')).toContainText('along the paths')
  expect(await page.evaluate(selectedCount)).toBeGreaterThan(2)

  // the selection changes: the highlight follows it
  await page.locator('#clearSelection').click()
  await expect(page.locator('#path_status')).toContainText(
    'Select two or more nodes'
  )
  expect(await selectedEdges()).toBe(0)
  await page.locator('#selectEverything').click()
  await expect(page.locator('#path_status')).toContainText(
    total > 25 ? 'at most 25' : 'joined'
  )
  // switched off: everything it added is taken back
  await page.locator('#highlightPaths').uncheck()
  await expect(page.locator('#path_status')).toBeEmpty()
  expect(await selectedEdges()).toBe(0)
  expect(await page.evaluate(selectedCount)).toBe(total)
})
