import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// The Networks menu in the top bar: it says which network and annotation are
// on screen, lists every loaded network with its annotation sets, and picks
// a network, a set, or both — in step with File and View → Annotations. Networks and
// sets are renamed in place and deleted for good, after a question.

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')
const upload = async (page: Page, file: string) => {
  await tab(page, 'File')
  await page
    .locator('#input_network_file')
    .setInputFiles(path.resolve('public/data', file))
  await expect(page.locator('#file_status')).toContainText('Loaded network')
}
const groups = async (page: Page, name: string, text: string) => {
  await tab(page, 'File')
  await page.locator('#groups_file').setInputFiles({
    name,
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from(text),
  })
}
type Ctx = {
  layers: { name: string }[]
  nodeObjects: { annotations: string[] }[]
}
const read = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    return {
      layers: c.layers.map((l) => l.name),
      annotated: c.nodeObjects.filter((n) => n.annotations.length > 0).length,
    }
  })

test('Networks menu: what is on screen, switch networks and annotation sets', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  const toggle = page.locator('#menu-networks')
  const now = page.locator('#networksNow')
  const menu = page.locator('#networksMenu')
  const rows = menu.locator('.networks-net')
  const open = async () => {
    if (!(await menu.isVisible())) await toggle.click()
    await expect(menu).toBeVisible()
  }

  // nothing loaded: the button says Networks, the menu says so
  await expect(now).toBeHidden()
  await open()
  await expect(menu).toContainText('Nothing loaded yet.')
  await toggle.click()

  // a network, then an annotation (group) file for it
  await upload(page, 'figure2A_data.tsv')
  await expect(now).toHaveText('figure2A_data.tsv · no annotation')
  const a = await read(page)
  await page.locator('#groups_file').setInputFiles({
    name: 'alpha-beta.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from('Alpha\t1, 2, 3\nBeta\t3;4;5;6\n'),
  })
  await expect(page.locator('#file_status')).toContainText('2 groups applied')
  await expect(now).toHaveText('figure2A_data.tsv · alpha-beta.tsv')
  await expect(page).toHaveTitle('figure2A_data.tsv · Arena3D')

  // a second network: now on screen, without annotation
  await upload(page, 'aspirin_3channels.tsv')
  await expect(now).toHaveText('aspirin_3channels.tsv · no annotation')
  const b = await read(page)
  expect(b.layers).not.toEqual(a.layers)

  await open()
  await expect(menu.locator('.networks-now')).toContainText(
    'aspirin_3channels.tsv'
  )
  await expect(menu.locator('.networks-now')).toContainText(
    'No annotation shown'
  )
  await expect(rows).toHaveCount(2)
  const first = rows.nth(0)
  const second = rows.nth(1)
  await expect(first.locator('.networks-net__name')).toHaveText(
    'figure2A_data.tsv'
  )
  await expect(first.locator('.networks-net__meta')).toContainText(
    `File · ${a.layers.length} layers ·`
  )
  await expect(second).toHaveClass(/is-active/)
  await expect(second.locator('.networks-net__badge')).toHaveText('on screen')
  await expect(second.locator('.networks-net__meta')).toContainText(
    `File · ${b.layers.length} layers ·`
  )
  // the first network keeps its annotation file, still marked as its own
  await expect(
    first.locator('.networks-set[aria-pressed="true"]')
  ).toContainText('alpha-beta.tsv')
  await expect(second.locator('.networks-set')).toHaveCount(0)
  await expect(second).toContainText('No annotation sets yet')

  // pick the first network without its annotation: one click does both
  await first.locator('.networks-set', { hasText: 'No annotation' }).click()
  await expect(menu).toBeHidden()
  await expect(now).toHaveText('figure2A_data.tsv · no annotation')
  await expect.poll(async () => (await read(page)).layers).toEqual(a.layers)
  expect((await read(page)).annotated).toBe(0)

  // and its annotation file back
  await open()
  await rows
    .nth(0)
    .locator('.networks-set', { hasText: 'alpha-beta.tsv' })
    .click()
  await expect(now).toHaveText('figure2A_data.tsv · alpha-beta.tsv')
  expect((await read(page)).annotated).toBeGreaterThan(0)

  // View → Annotations shows the same set, and a change there shows here
  await tab(page, 'Annotations')
  await expect(page.locator('#annotationSet')).toHaveValue('0')
  await page.locator('#annotationSet').selectOption('-1')
  await expect(now).toHaveText('figure2A_data.tsv · no annotation')
  await page.locator('#annotationSet').selectOption('0')
  await expect(now).toHaveText('figure2A_data.tsv · alpha-beta.tsv')

  // back to the second network by its name
  await open()
  await rows.nth(1).locator('.networks-net__switch').click()
  await expect(now).toHaveText('aspirin_3channels.tsv · no annotation')
  await expect.poll(async () => (await read(page)).layers).toEqual(b.layers)

  // the top bar still fits the window
  const fit = await page.evaluate(() => {
    const bar = document.getElementById('navbarTabs')!
    const right = Math.max(
      ...[...bar.querySelectorAll<HTMLElement>('button, select')]
        .filter((el) => el.offsetParent)
        .map((el) => el.getBoundingClientRect().right)
    )
    return {
      scroll: bar.scrollWidth - bar.clientWidth,
      right,
      width: window.innerWidth,
    }
  })
  expect(fit.scroll).toBe(0)
  expect(fit.right).toBeLessThanOrEqual(fit.width)
})

test('Networks menu: rename and delete networks and annotation sets', async ({
  page,
}) => {
  test.setTimeout(150_000)
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  const toggle = page.locator('#menu-networks')
  const now = page.locator('#networksNow')
  const menu = page.locator('#networksMenu')
  const rows = menu.locator('.networks-net')
  const box = page.locator('.inline-edit__input')
  const ask = page.locator('#confirmDialog')
  const open = async () => {
    if (!(await menu.isVisible())) await toggle.click()
    await expect(menu).toBeVisible()
  }
  const setRow = (net: number, name: string) =>
    rows.nth(net).locator('.networks-set-row', { hasText: name })

  // a network with three annotation files, then a second network
  await upload(page, 'figure2A_data.tsv')
  const a = await read(page)
  await groups(page, 'alpha-beta.tsv', 'Alpha\t1, 2, 3\nBeta\t3;4;5;6\n')
  await expect(now).toHaveText('figure2A_data.tsv · alpha-beta.tsv')
  await groups(page, 'gamma.tsv', 'Gamma\t7, 8\n')
  await expect(now).toHaveText('figure2A_data.tsv · gamma.tsv')
  await groups(page, 'delta.tsv', 'Delta\t1, 2\n')
  await expect(now).toHaveText('figure2A_data.tsv · delta.tsv')
  await upload(page, 'aspirin_3channels.tsv')
  const b = await read(page)

  // rename the network on screen in place: the button, the menu and File follow
  await open()
  await rows.nth(1).locator('.networks-net__rename').click()
  await expect(box).toBeFocused()
  await box.fill('Aspirin targets')
  await box.press('Enter')
  await expect(now).toHaveText('Aspirin targets · no annotation')
  await expect(menu).toBeVisible()
  await expect(rows.nth(1).locator('.networks-net__meta')).toContainText(
    'File (aspirin_3channels.tsv) ·'
  )
  // Esc leaves the name as it was, and the menu open
  await rows.nth(0).locator('.networks-net__rename').click()
  await box.fill('Not this')
  await box.press('Escape')
  await expect(box).toHaveCount(0)
  await expect(menu).toBeVisible()
  await expect(rows.nth(0).locator('.networks-net__name')).toHaveText(
    'figure2A_data.tsv'
  )

  // rename a set: a name the network already has is refused, with the reason
  await setRow(0, 'gamma.tsv').locator('.networks-set__rename').click()
  await box.fill('alpha-beta.tsv')
  await box.press('Enter')
  await expect(page.locator('.inline-edit__msg')).toHaveText(
    'This network already has an annotation set named “alpha-beta.tsv”.'
  )
  await box.fill('Gamma group')
  await box.press('Enter')
  await expect(setRow(0, 'Gamma group')).toHaveCount(1)
  await expect(setRow(0, 'gamma.tsv')).toHaveCount(0)

  // delete a set: asked first, then gone
  await setRow(0, 'alpha-beta.tsv').locator('.networks-set__delete').click()
  await expect(ask).toBeVisible()
  await expect(page.locator('#confirmDialogText')).toContainText(
    'Delete the annotation set “alpha-beta.tsv” of “figure2A_data.tsv”?'
  )
  await page.locator('#confirmDialogOk').click()
  await expect(ask).toBeHidden()
  await open()
  await expect(rows.nth(0).locator('.networks-set-row')).toHaveCount(2)

  // switch to the first network with its renamed set
  await setRow(0, 'Gamma group').locator('.networks-set').click()
  await expect(now).toHaveText('figure2A_data.tsv · Gamma group')
  await expect.poll(async () => (await read(page)).layers).toEqual(a.layers)

  // View → Annotations renames and deletes the set shown, too
  await tab(page, 'Annotations')
  await page.locator('#annotationSetRename').click()
  await box.fill('Gamma')
  await box.press('Enter')
  await expect(now).toHaveText('figure2A_data.tsv · Gamma')
  await expect(page.locator('#annotationSet option:checked')).toContainText(
    'Gamma'
  )
  await page.locator('#annotationSetDelete').click()
  await expect(page.locator('#confirmDialogText')).toContainText(
    'It is shown now; the network will show no annotation.'
  )
  await page.locator('#confirmDialogOk').click()
  await expect(now).toHaveText('figure2A_data.tsv · no annotation')
  await expect(page.locator('#annotationSet')).toHaveValue('-1')
  await expect(page.locator('#annotationSetDelete')).toBeDisabled()
  expect((await read(page)).annotated).toBe(0)

  // delete the network on screen: Cancel keeps it; Delete shows the other one
  await open()
  await rows.nth(0).locator('.networks-net__delete').click()
  await expect(page.locator('#confirmDialogText')).toHaveText(
    'Delete “figure2A_data.tsv” and its 1 annotation set? Another loaded network is shown in its place. The undo history is cleared too; this cannot be undone.'
  )
  await page.locator('#confirmDialogCancel').click()
  await open()
  await expect(rows).toHaveCount(2)
  await rows.nth(0).locator('.networks-net__delete').click()
  await page.locator('#confirmDialogOk').click()
  await expect(now).toHaveText('Aspirin targets · no annotation')
  await expect.poll(async () => (await read(page)).layers).toEqual(b.layers)
  await expect(page.locator('#undoButton')).toBeDisabled()
  await open()
  await expect(rows).toHaveCount(1)

  // delete the last one: the empty start, the Home page
  await rows.nth(0).locator('.networks-net__delete').click()
  await expect(page.locator('#confirmDialogText')).toContainText(
    'The scene will be empty.'
  )
  await page.locator('#confirmDialogOk').click()
  await expect(now).toBeHidden()
  await expect(page.locator('#panel-home')).toHaveClass(/show/)
  await expect(page).toHaveTitle('Arena3D')
  expect(await read(page)).toEqual({ layers: [], annotated: 0 })
  await open()
  await expect(menu).toContainText('Nothing loaded yet.')
  await tab(page, 'File')
  await expect(page.locator('#workspaceList')).toContainText('Nothing loaded')
})
