import { expect, test } from '@playwright/test'

// Theme picker (top bar): enabled once a network loads; choosing a preset
// recolours the scene; undo restores the previous theme and the picker. The canvas
// is opaque to the DOM, so assertions read window.__arena.ctx (applyTheme
// sets ctx.edgeDefaultColor, distinct per theme).

function edgeColor() {
  return () =>
    (window as unknown as { __arena: { ctx: { edgeDefaultColor: string } } })
      .__arena.ctx.edgeDefaultColor
}

test('theme picker switches scene theme (undoable)', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )

  // Disabled before a network exists.
  await expect(page.locator('#themeSelect')).toBeDisabled()

  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.getByRole('button', { name: 'Load Example' }).click()
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  await expect(page.locator('#themeSelect')).toBeEnabled()
  expect(
    await page.locator('#themeSelect option').count()
  ).toBeGreaterThanOrEqual(8)

  await page.locator('#themeSelect').selectOption('light')
  expect(await page.evaluate(edgeColor())).toBe('#5c5c5c')
  // Regression: floor_color input is the picker-path source of truth, so a
  // theme toggle must update it — otherwise hover-exit repaint reverts layers
  // to the stale (dark) color.
  await expect(page.locator('#floor_color')).toHaveValue('#8aa185')

  await page.locator('#themeSelect').selectOption('gray')
  expect(await page.evaluate(edgeColor())).toBe('#6e2a5a')

  await page.locator('#themeSelect').selectOption('blueprint')
  expect(await page.evaluate(edgeColor())).toBe('#d6e6ff')

  // Undo walks back blueprint → gray, and the picker follows.
  await page.locator('#undoButton').dispatchEvent('click')
  expect(await page.evaluate(edgeColor())).toBe('#6e2a5a')
  await expect(page.locator('#themeSelect')).toHaveValue('gray')
})
