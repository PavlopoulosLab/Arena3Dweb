import { expect, test, type Page } from './fixtures'
import fs from 'node:fs'
import path from 'node:path'

// Sessions keep how the annotation groups are drawn: Draw around, Draw as,
// Opacity, Padding, pie charts and the groups whose cloud is switched off.

const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

const scene = (page: Page) =>
  page.evaluate(() => {
    type Obj = {
      type: string
      userData: Record<string, unknown>
      children: Obj[]
      material?: { opacity: number }
    }
    const ctx = (
      window as unknown as {
        __arena: {
          ctx: { layers: { plane: Obj }[]; nodeObjects: { sphere: Obj }[] }
        }
      }
    ).__arena.ctx
    const clouds = ctx.layers.flatMap((l) =>
      l.plane.children.filter((c) => c.userData.hullGroup)
    )
    return {
      groups: [...new Set(clouds.map((c) => String(c.userData.hullGroup)))],
      fog:
        clouds.length > 0 &&
        clouds.every(
          (c) =>
            c.children.length > 0 &&
            c.children.every((s) => s.type === 'Sprite')
        ),
      // a cloud's first puff is its broad haze
      haze: clouds[0]?.children[0]?.material?.opacity ?? 0,
      pies: ctx.nodeObjects.reduce(
        (s, n) =>
          s + n.sphere.children.filter((c) => c.type === 'Sprite').length,
        0
      ),
    }
  })

test('a session keeps fog clouds, their opacity and padding, pies and hidden groups', async ({
  page,
}, info) => {
  test.setTimeout(90_000)
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  await page.locator('#groups_file').setInputFiles({
    name: 'groups.tsv',
    mimeType: 'text/tab-separated-values',
    buffer: Buffer.from('Alpha\t1, 2, 3\nBeta\t3;4;5;6\n'),
  })
  await expect(page.locator('#file_status')).toContainText('2 groups applied')

  // fog clouds around the annotations at 0.6, padding 1.5, pies, Beta off
  await tab(page, 'Annotations')
  await page.locator('#hull_annotation').check()
  await page.locator('#hullStyle_fog').check()
  await page.locator('#hullOpacity').fill('0.6')
  await page.locator('#hullPadding').fill('1.5')
  await page.locator('#showPies').check()
  await page
    .locator('#groups_card')
    .evaluate((d) => ((d as HTMLDetailsElement).open = true))
  const beta = page.locator('#groupsList .group-row[data-group="Beta"]')
  await beta.locator('.group-hull input').evaluate((el) => {
    ;(el as HTMLInputElement).click()
  })
  const before = await scene(page)
  expect(before.groups).toEqual(['Alpha'])
  expect(before.fog).toBe(true)
  expect(before.haze).toBeCloseTo((0.22 * 0.6) / 0.35, 3)
  expect(before.pies).toBeGreaterThan(0)

  // save, reload the page (defaults again), load the session back
  await tab(page, 'File')
  const download = page.waitForEvent('download')
  await page.locator('#save_network_object').click()
  const file = info.outputPath('annotation-view.json')
  await (await download).saveAs(file)
  const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    annotationView: unknown
  }
  expect(saved.annotationView).toEqual({
    source: 'annotation',
    style: 'fog',
    opacity: 0.6,
    padding: 1.5,
    pies: true,
    hidden: ['Beta'],
  })
  await page.reload()
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#load_network_file').setInputFiles(file)
  await expect(page.locator('#file_status')).toContainText('Session loaded')

  // the controls show it and the scene draws it
  await tab(page, 'Annotations')
  await expect(page.locator('#hull_annotation')).toBeChecked()
  await expect(page.locator('#hullStyle_fog')).toBeChecked()
  await expect(page.locator('#hullOpacity')).toHaveValue('0.6')
  await expect(page.locator('#hullOpacityValue')).toHaveText('0.60')
  await expect(page.locator('#hullPadding')).toHaveValue('1.5')
  await expect(page.locator('#hullPaddingValue')).toHaveText('1.50')
  await expect(page.locator('#showPies')).toBeChecked()
  await page
    .locator('#groups_card')
    .evaluate((d) => ((d as HTMLDetailsElement).open = true))
  await expect(
    page.locator('#groupsList .group-row[data-group="Beta"] .group-hull input')
  ).not.toBeChecked()
  await expect(
    page.locator('#groupsList .group-row[data-group="Alpha"] .group-hull input')
  ).toBeChecked()
  const after = await scene(page)
  expect(after.groups).toEqual(before.groups)
  expect(after.fog).toBe(true)
  expect(after.haze).toBeCloseTo(before.haze, 5)
  expect(after.pies).toBe(before.pies)
})
