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
