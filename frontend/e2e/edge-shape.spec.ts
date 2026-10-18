import { expect, test, type Page } from './fixtures'

// Edit → Edges → Edge Shape: multi-channel edges are parallel lines side by
// side by default (as STRING draws them); Bézier curves or one shared
// straight line on request, in both network modes.

// the first edge with two or more channels: segments per channel line and
// each line's first point
const channelLines = (page: Page) =>
  page.evaluate(() => {
    type Line = {
      geometry: {
        attributes: {
          instanceStart: {
            count: number
            getX: (i: number) => number
            getY: (i: number) => number
            getZ: (i: number) => number
          }
        }
      }
    }
    const edges = (
      window as unknown as {
        __arena: {
          ctx: {
            edgeObjects: {
              channels: string[]
              THREE_Object: { children: Line[] }
            }[]
          }
        }
      }
    ).__arena.ctx.edgeObjects
    const e = edges.find((x) => x.channels.length > 1)!
    return e.THREE_Object.children.slice(0, 2).map((l) => {
      const a = l.geometry.attributes.instanceStart
      return {
        segments: a.count,
        start: [a.getX(0), a.getY(0), a.getZ(0)].map((v) => Math.round(v)),
      }
    })
  })

const pick = (page: Page, shape: string) =>
  page.locator('#edgeShape').evaluate((el, value) => {
    ;(el as HTMLSelectElement).value = value
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, shape)

test('channels are parallel lines by default; Bézier curves or straight on request', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page
    .locator('#input_network_file')
    .setInputFiles('public/data/aspirin_3channels.tsv')
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  // parallel: one straight segment per channel, the lanes side by side
  await expect(page.locator('#edgeShape')).toHaveValue('parallel')
  let lines = await channelLines(page)
  expect(lines.map((l) => l.segments)).toEqual([1, 1])
  expect(lines[0].start).not.toEqual(lines[1].start)
  await expect(page.locator('#intraChannelCurvatureWrap')).toHaveClass(/d-none/)

  // Bézier curves: 50 segments each, with their curvature slider
  await pick(page, 'curved')
  await expect.poll(async () => (await channelLines(page))[0].segments).toBe(50)
  await expect(page.locator('#intraChannelCurvatureWrap')).not.toHaveClass(
    /d-none/
  )

  // straight: the channels share one line
  await pick(page, 'straight')
  await expect.poll(async () => (await channelLines(page))[0].segments).toBe(1)
  lines = await channelLines(page)
  expect(lines[0].start).toEqual(lines[1].start)

  // the choice holds in the 3D view of one network too
  await pick(page, 'parallel')
  await page.locator('#modeSingle').dispatchEvent('click')
  await expect(page.locator('body')).toHaveClass(/mode-single/)
  await expect(page.locator('#edgeShape')).toHaveValue('parallel')
  await expect
    .poll(async () => (await channelLines(page)).map((l) => l.segments))
    .toEqual([1, 1])
})

test('the channel colours line up in columns, and Hide hides a channel', async ({
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
    .setInputFiles('public/data/aspirin_3channels.tsv')
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  await page
    .getByRole('tab', { name: 'Edges', includeHidden: true, exact: true })
    .dispatchEvent('click')

  // every swatch and every Hide box starts at the same x, whatever the name
  const rows = page.locator('#channelColorPicker .channel_subcontainer')
  await expect(rows).toHaveCount(3)
  const lefts = async (selector: string) =>
    page
      .locator(`#channelColorPicker ${selector}`)
      .evaluateAll((els) =>
        els.map((el) => Math.round(el.getBoundingClientRect().left))
      )
  for (const selector of ['.channel_colorPicker', '.channel_checkbox'])
    expect(new Set(await lefts(selector)).size).toBe(1)

  // the label wraps its box: clicking "Hide" hides that channel
  await rows.nth(1).getByText('Hide').click()
  const hidden = await page.evaluate(
    () =>
      (
        window as unknown as {
          __arena: { ctx: { channelVisibility: Record<string, boolean> } }
        }
      ).__arena.ctx.channelVisibility
  )
  expect(Object.values(hidden)).toContain(false)
})
