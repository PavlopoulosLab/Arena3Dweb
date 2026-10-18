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

test('with nodes selected, the menu offers actions on the selection', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#input_network_file')
    .setInputFiles('public/data/figure2A_data.tsv')
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  type Ctx = {
    xBoundMax: number
    yBoundMax: number
    nodeObjects: {
      name: string
      isSelected: boolean
      getWorldPosition: (a: string) => number
    }[]
  }
  const selectedCount = () =>
    page.evaluate(
      () =>
        (
          window as unknown as { __arena: { ctx: Ctx } }
        ).__arena.ctx.nodeObjects.filter((n) => n.isSelected).length
    )
  // a point on the canvas itself, at least 40px from every node
  const background = await page.evaluate(() => {
    const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    const canvas = document.querySelector('#app canvas')!
    const r = canvas.getBoundingClientRect()
    const pts = c.nodeObjects.map((n) => [
      r.left + c.xBoundMax + n.getWorldPosition('x'),
      r.top + c.yBoundMax - n.getWorldPosition('y'),
    ])
    for (let y = r.top + 120; y < r.bottom - 120; y += 20)
      for (let x = r.left + r.width * 0.3; x < r.right - 300; x += 20)
        if (
          document.elementFromPoint(x, y) === canvas &&
          pts.every(([px, py]) => Math.hypot(px - x, py - y) > 40)
        )
          return { x, y }
    return null
  })
  expect(background).not.toBeNull()
  const menu = page.locator('select.optionsBox')

  // nothing selected: the background has no menu
  await page.mouse.click(background!.x, background!.y, { button: 'right' })
  await expect(menu).toHaveCount(0)

  // two nodes selected: the background menu holds the selection's actions
  await page.evaluate(() => {
    const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    c.nodeObjects[0].isSelected = true
    c.nodeObjects[1].isSelected = true
  })
  await page.mouse.click(background!.x, background!.y, { button: 'right' })
  await expect(menu).toHaveCount(1)
  await expect(menu.locator('optgroup')).toHaveAttribute(
    'label',
    'Selected nodes (2)'
  )
  await expect(
    menu.locator('option', { hasText: 'Copy Names (2)' })
  ).toHaveCount(1)
  await expect(
    menu.locator('option', { hasText: 'Select Shortest Path Between the 2' })
  ).toHaveCount(1)
  await menu.selectOption({ label: 'Expand Selection by 1 Hop' })
  expect(await selectedCount()).toBeGreaterThan(2)
  await expect(menu).toHaveValue('-')
})
