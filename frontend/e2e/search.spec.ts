import { expect, test } from '@playwright/test'
import path from 'node:path'

// PLAN-ROADMAP Phase 23: search modes (regex, suffix, ...) and camera focus.

// Playwright runs from frontend/ (playwright.config.ts lives there)
const ASPIRIN = path.resolve('public/data/aspirin_3channels.tsv')

type Ctx = {
  scene: { getScale: () => number; getPosition: (a: string) => number }
  nodeObjects: { name: string; isSelected: boolean }[]
}
const view = () => {
  const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
  return {
    scale: ctx.scene.getScale(),
    x: ctx.scene.getPosition('x'),
    selected: ctx.nodeObjects.filter((n) => n.isSelected).map((n) => n.name),
  }
}

test('regex and suffix search select matches and focus the camera', async ({
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
  const before = await page.evaluate(view)

  await page
    .getByRole('tab', { name: 'Find', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#nodeSearchMode').selectOption('regex')
  await page.locator('#nodeSearchBar').fill('^PTGS[12]$')
  await page.locator('#nodeSearchBar').press('Enter')
  await expect(page.locator('#nodeSearchStatus')).toHaveText('2 matches.')
  expect((await page.evaluate(view)).selected.sort()).toEqual([
    'PTGS1',
    'PTGS2',
  ])
  // camera animates to the matches
  await page.waitForFunction((b) => {
    const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    return (
      ctx.scene.getPosition('x') !== b.x || ctx.scene.getScale() !== b.scale
    )
  }, before)

  await page.locator('#nodeSearchBar').fill('(')
  await page.locator('#nodeSearchButton').click()
  await expect(page.locator('#nodeSearchStatus')).toContainText(
    'Invalid regular expression'
  )

  await page.locator('#nodeSearchMode').selectOption('suffix')
  await page.locator('#nodeSearchBar').fill('s1')
  await page.locator('#nodeSearchButton').click()
  await expect(page.locator('#nodeSearchStatus')).toContainText('match')
  const sel = (await page.evaluate(view)).selected
  expect(sel.length).toBeGreaterThan(0)
  expect(sel.every((n) => n.toLowerCase().endsWith('s1'))).toBe(true)

  // clicking a result focuses that node; undo restores the previous view
  await page.waitForTimeout(700) // let the search's own focus finish
  const scaleBefore = (await page.evaluate(view)).scale
  await page.locator('#nodeSearchResults [data-node]').first().click()
  await page.waitForTimeout(700)
  await page
    .getByRole('tab', { name: '3D View', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.screenshot({ path: 'test-results/search-focus.png' })
  await page.evaluate(() =>
    (
      window as unknown as { __arena: { history: { undo: () => void } } }
    ).__arena.history.undo()
  )
  expect((await page.evaluate(view)).scale).toBeCloseTo(scaleBefore, 5)
})
