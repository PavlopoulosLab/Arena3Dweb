import { expect, test, type Page } from './fixtures'

// Navigation Controls: a click is always one step (taken on press), and a
// button held down keeps going — through small mouse movements — until it is
// released; one undo step per press.

type Quat = { clone: () => Quat; angleTo: (q: Quat) => number }
type Arena = {
  __arena: { ctx: { scene: { sphere: { quaternion: Quat } } } }
  __q?: Quat
}

// degrees the scene turned since the last mark()
const mark = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as Arena
    w.__q = w.__arena.ctx.scene.sphere.quaternion.clone()
  })
const turned = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as Arena
    const rad = w.__arena.ctx.scene.sphere.quaternion.angleTo(w.__q!)
    return Math.round((rad * 180) / Math.PI)
  })

test('a click is one step; holding keeps rotating until released', async ({
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
  // the scene's +Y rotation button (the first +Y in the table)
  const plusY = page.locator('#canvasControls_table [data-nav="plusY"]').first()
  await expect(plusY).toBeVisible()

  // a quick click: exactly one 5° step, at once
  await mark(page)
  await plusY.click()
  expect(await turned(page)).toBe(5)

  // held for a second, with the hand moving a little: it keeps turning
  await mark(page)
  const box = (await plusY.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  for (let k = 0; k < 10; k++) {
    await page.mouse.move(
      box.x + box.width / 2 + (k % 2 ? 3 : -3),
      box.y + box.height / 2
    )
    await page.waitForTimeout(100)
  }
  await page.mouse.up()
  const held = await turned(page)
  expect(held).toBeGreaterThan(30) // a dozen steps or so, not one
  // and stops once released
  await page.waitForTimeout(400)
  expect(await turned(page)).toBe(held)

  // the whole hold is one undo step
  await page.locator('#undoButton').dispatchEvent('click')
  expect(await turned(page)).toBe(0)
})

test('Redraw lets go of a half-drawn area and a stuck loading veil', async ({
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
  const redraw = page.locator('#redrawSceneButton')
  await expect(redraw).toBeVisible()

  type Stuck = {
    __arena: {
      ctx: {
        scene: { leftClickPressed: boolean; dragging: boolean }
        nodeObjects: { isSelected: boolean; getOpacity: () => number }[]
      }
    }
  }
  const state = () =>
    page.evaluate(() => {
      const c = (window as unknown as Stuck).__arena.ctx
      return {
        pressed: c.scene.leftClickPressed,
        dragging: c.scene.dragging,
        dimmed: c.nodeObjects.filter((n) => n.getOpacity() < 1).length,
        selected: c.nodeObjects.filter((n) => n.isSelected).length,
      }
    })

  // an area outline left half drawn: the button is pressed, nodes dimmed
  const box = (await page.locator('#app canvas').boundingBox())!
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2]
  await page.keyboard.down('Shift')
  await page.mouse.move(cx - 200, cy - 150)
  await page.mouse.down()
  await page.mouse.move(cx + 200, cy + 150, { steps: 10 })
  await page.keyboard.up('Shift')
  expect((await state()).dimmed).toBeGreaterThan(0)

  await redraw.dispatchEvent('click')
  expect(await state()).toMatchObject({
    pressed: false,
    dragging: false,
    dimmed: 0,
  })
  // the outline is gone: the late release selects nothing
  await page.mouse.up()
  expect((await state()).selected).toBe(0)

  // a loading veil left up by a failed request comes down
  await page.evaluate(() => {
    document.getElementById('app')!.style.opacity = '0.5'
    document.getElementById('loader')!.style.display = 'inline-block'
  })
  await redraw.dispatchEvent('click')
  await expect(page.locator('#loader')).toBeHidden()
  await expect(page.locator('#app')).toHaveCSS('opacity', '1')
})
