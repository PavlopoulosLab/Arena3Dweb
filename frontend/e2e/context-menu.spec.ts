import { expect, test } from './fixtures'

// Regression: the right-click node menu must survive the mouse leaving the
// canvas on its way to the menu. mouseleave routes through clickUp; before the
// fix it called removeContextMenu and the menu vanished before it was usable.
test('context menu survives canvas mouseleave', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )

  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.getByRole('button', { name: 'Load Example' }).click()
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  // layerX/layerY the menu builder expects for node 0 (mirrors its own math).
  const at = await page.evaluate(() => {
    const ctx = (
      window as unknown as {
        __arena: {
          ctx: {
            xBoundMax: number
            yBoundMax: number
            nodeObjects: { getWorldPosition: (a: string) => number }[]
          }
        }
      }
    ).__arena.ctx
    const n = ctx.nodeObjects[0]
    return {
      x: ctx.xBoundMax + n.getWorldPosition('x'),
      y: ctx.yBoundMax - n.getWorldPosition('y'),
    }
  })

  const canvas = page.locator('#app canvas')
  await canvas.dispatchEvent('contextmenu', { layerX: at.x, layerY: at.y })
  await expect(page.locator('select.optionsBox')).toHaveCount(1)

  // The buggy trigger: moving toward the menu leaves the canvas.
  await canvas.dispatchEvent('mouseleave', { button: 0 })
  await expect(page.locator('select.optionsBox')).toHaveCount(1)

  // A real left-click on the canvas still dismisses it.
  await canvas.dispatchEvent('mouseup', { button: 0 })
  await expect(page.locator('select.optionsBox')).toHaveCount(0)
})
