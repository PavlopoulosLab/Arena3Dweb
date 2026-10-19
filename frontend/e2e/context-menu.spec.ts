import { expect, test, type Page } from './fixtures'

type Ctx = {
  xBoundMax: number
  yBoundMax: number
  nodeObjects: {
    name: string
    nodeLayerName: string
    isSelected: boolean
    getWorldPosition: (a: string) => number
    getPosition: (a: string) => number
  }[]
  edgeObjects: { sourceNodeIndex: number; targetNodeIndex: number }[]
}

async function loadFigure2A(page: Page) {
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
}

// a point on the canvas itself, at least 40px from every node and 12px
// from every edge (an edge has a menu of its own)
const backgroundPoint = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    const canvas = document.querySelector('#app canvas')!
    const r = canvas.getBoundingClientRect()
    const pts = c.nodeObjects.map((n) => [
      r.left + c.xBoundMax + n.getWorldPosition('x'),
      r.top + c.yBoundMax - n.getWorldPosition('y'),
    ])
    const toEdge = (x: number, y: number, a: number[], b: number[]) => {
      const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
      const len = dx * dx + dy * dy
      const t = len
        ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len))
        : 0
      return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)
    }
    for (let y = r.top + 120; y < r.bottom - 120; y += 20)
      for (let x = r.left + r.width * 0.3; x < r.right - 300; x += 20)
        if (
          document.elementFromPoint(x, y) === canvas &&
          pts.every(([px, py]) => Math.hypot(px - x, py - y) > 40) &&
          c.edgeObjects.every(
            (e) =>
              toEdge(x, y, pts[e.sourceNodeIndex], pts[e.targetNodeIndex]) > 12
          )
        )
          return { x, y }
    return null
  })

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
  await loadFigure2A(page)
  const selectedCount = () =>
    page.evaluate(
      () =>
        (
          window as unknown as { __arena: { ctx: Ctx } }
        ).__arena.ctx.nodeObjects.filter((n) => n.isSelected).length
    )
  const background = await backgroundPoint(page)
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

test('Delete Nodes removes the selection and its edges, after asking; undo restores', async ({
  page,
}) => {
  await loadFigure2A(page)
  const read = () =>
    page.evaluate(() => {
      const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
      return {
        nodes: c.nodeObjects.map((n) => n.nodeLayerName),
        edges: c.edgeObjects.length,
        y: Object.fromEntries(
          c.nodeObjects.map((n) => [n.nodeLayerName, n.getPosition('y')])
        ),
      }
    })
  const before = await read()
  const doomed = before.nodes.slice(0, 2)
  const touching = await page.evaluate(() => {
    const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    return c.edgeObjects.filter(
      (e) => e.sourceNodeIndex < 2 || e.targetNodeIndex < 2
    ).length
  })
  expect(touching).toBeGreaterThan(0)
  const background = await backgroundPoint(page)
  expect(background).not.toBeNull()
  const menu = page.locator('select.optionsBox')
  const select = (all = false) =>
    page.evaluate((all) => {
      const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
      c.nodeObjects.forEach((n, i) => (n.isSelected = all || i < 2))
    }, all)

  // every node selected: no Delete (a network keeps at least one node)
  await select(true)
  await page.mouse.click(background!.x, background!.y, { button: 'right' })
  await expect(menu).toHaveCount(1)
  await expect(menu.locator('option', { hasText: 'Delete' })).toHaveCount(0)
  // a left click on the canvas closes the menu
  await page.locator('#app canvas').dispatchEvent('mouseup', { button: 0 })
  await expect(menu).toHaveCount(0)

  // two: asked first; Cancel keeps them
  await select()
  await page.mouse.click(background!.x, background!.y, { button: 'right' })
  await menu.selectOption({ label: 'Delete 2 Nodes…' })
  await expect(page.locator('#confirmDialogText')).toContainText(
    `Delete the 2 selected nodes and ${touching} edges touching them`
  )
  await page.locator('#confirmDialogCancel').click()
  expect((await read()).nodes).toHaveLength(before.nodes.length)

  // Delete: the nodes and their edges go; the rest stays where it was
  await page.mouse.click(background!.x, background!.y, { button: 'right' })
  await menu.selectOption({ label: 'Delete 2 Nodes…' })
  await page.locator('#confirmDialogOk').click()
  const after = await read()
  expect(after.nodes).toHaveLength(before.nodes.length - 2)
  expect(after.nodes).not.toContain(doomed[0])
  expect(after.nodes).not.toContain(doomed[1])
  expect(after.edges).toBe(before.edges - touching)
  for (const id of after.nodes) expect(after.y[id]).toBeCloseTo(before.y[id], 3)

  // one undo brings them back
  await page.locator('#undoButton').click()
  const undone = await read()
  expect(undone.nodes).toEqual(before.nodes)
  expect(undone.edges).toBe(before.edges)
})

test('the selection menu keeps their labels on screen, or lets them go', async ({
  page,
}) => {
  await loadFigure2A(page)
  type Pin = { labelShown: boolean; isSelected: boolean }
  const pinned = () =>
    page.evaluate(() =>
      (
        window as unknown as { __arena: { ctx: { nodeObjects: Pin[] } } }
      ).__arena.ctx.nodeObjects
        .map((n, i) => (n.labelShown ? i : -1))
        .filter((i) => i >= 0)
    )
  const background = await backgroundPoint(page)
  expect(background).not.toBeNull()
  const menu = page.locator('select.optionsBox')
  await page.evaluate(() => {
    const c = (
      window as unknown as { __arena: { ctx: { nodeObjects: Pin[] } } }
    ).__arena.ctx
    c.nodeObjects[0].isSelected = true
    c.nodeObjects[1].isSelected = true
  })
  await page.mouse.click(background!.x, background!.y, { button: 'right' })
  await expect(
    menu.locator('option', { hasText: 'Hide Their Labels' })
  ).toHaveCount(0) // none chosen yet
  await menu.selectOption({ label: 'Show Their Labels' })
  expect(await pinned()).toEqual([0, 1])
  // Show Labels moved to Chosen, keeping the selection's labels
  await expect(page.locator('#nodeLabels_chosen')).toBeChecked()
  // the menu stays open for another action; a left click on the canvas (its
  // mouseup) closes it, so the next right-click builds it afresh
  await page.evaluate(() =>
    document
      .querySelector('#app canvas')!
      .dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }))
  )
  await expect(menu).toHaveCount(0)
  await page.mouse.click(background!.x, background!.y, { button: 'right' })
  await expect(
    menu.locator('option', { hasText: 'Show Their Labels' })
  ).toHaveCount(0) // both chosen already
  await menu.selectOption({ label: 'Hide Their Labels' })
  expect(await pinned()).toEqual([])
})
