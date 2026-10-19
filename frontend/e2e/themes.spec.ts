import fs from 'node:fs'
import { expect, test, type Page } from './fixtures'

// Theme picker (top bar): usable before a network loads (the next network
// takes the theme's colours); with a network on screen every switch asks
// whether to keep its colours or apply the theme's (nodes, floors, channels,
// edges — distinct and readable on the background); undo restores the
// previous theme, its colours and the picker; sessions keep the theme. The
// canvas is opaque to the DOM, so assertions read window.__arena.ctx.

type Ctx = {
  edgeDefaultColor: string
  edgeFileColorPriority: boolean
  labelColor: string
  channelColors: Record<string, string>
  nodeObjects: { getColor(): string; layer: string }[]
  renderer: { getClearColor(c: unknown): void }
}

const scene = (page: Page) =>
  page.evaluate(() => {
    const ctx = (window as unknown as { __arena: { ctx: Ctx } }).__arena.ctx
    const c = {
      r: 0,
      g: 0,
      b: 0,
      copy(o: { r: number; g: number; b: number }) {
        Object.assign(this, { r: o.r, g: o.g, b: o.b })
        return this
      },
    }
    ctx.renderer.getClearColor(c)
    // the renderer keeps the clear colour linear: back to sRGB hex
    const hex = (v: number) => {
      const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055
      return Math.round(srgb * 255)
        .toString(16)
        .padStart(2, '0')
    }
    return {
      background: `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`,
      edge: ctx.edgeDefaultColor,
      label: ctx.labelColor,
      nodes: ctx.nodeObjects.map((n) => n.getColor().toLowerCase()),
      channels: Object.values(ctx.channelColors),
      edgeFile: ctx.edgeFileColorPriority,
    }
  })

// WCAG contrast ratio, as actions/palette.ts computes it
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const s = parseInt(hex.slice(i, i + 2), 16) / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const start = async (page: Page) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
}

const loadExample = async (page: Page, label?: string) => {
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  if (label) await page.locator('#exampleChoice').selectOption({ label })
  await page.locator('#exampleButton').click()
  await expect(page.locator('#file_status')).toContainText(
    label ? 'Session loaded' : 'Loaded network',
    { timeout: 30_000 }
  )
}

// the question a switch asks with a network on screen; the switch lands once
// the popup's close event has run, so wait for the theme's background
const answer = async (
  page: Page,
  choice: 'keep' | 'apply' | 'cancel',
  background = ''
) => {
  const dialog = page.locator('#themeDialog')
  await expect(dialog).toBeVisible()
  if (choice === 'cancel') return page.locator('#themeDialogCancel').click()
  await page.locator(`#themeColours_${choice}`).check()
  await page.locator('#themeDialogOk').click()
  await expect(dialog).toBeHidden()
  if (background)
    await expect
      .poll(async () => (await scene(page)).background)
      .toBe(background)
}

test('theme picker switches scene theme (undoable)', async ({ page }) => {
  await start(page)

  // usable before a network exists, grouped; no question: the scene's
  // background follows at once
  const picker = page.locator('#themeSelect')
  await expect(picker).toBeEnabled()
  await expect(picker.locator('optgroup')).toHaveCount(3)
  expect(await picker.locator('option').count()).toBeGreaterThanOrEqual(25)
  await picker.selectOption('light')
  await expect(page.locator('#themeDialog')).toHaveCount(0)
  expect((await scene(page)).background).toBe('#ffffff')

  // the network loaded next takes the theme: its node and channel colours,
  // labels, edges and floors all read on white
  await loadExample(page)
  const light = await scene(page)
  expect(light.background).toBe('#ffffff')
  expect(light.edge).toBe('#5c5c5c')
  expect(light.label).toBe('#000000')
  for (const c of [...light.nodes, ...light.channels])
    expect(contrast(c, '#ffffff'), c).toBeGreaterThanOrEqual(3)
  expect(new Set(light.nodes).size).toBeGreaterThan(1) // distinct layers
  // Regression: floor_color input is the picker-path source of truth, so a
  // theme must update it — otherwise hover-exit repaint reverts layers to the
  // stale (dark) color.
  await expect(page.locator('#floor_color')).toHaveValue('#8aa185')

  // with a network every switch asks: apply the theme's colours
  await picker.selectOption('gray')
  await expect(page.locator('#themeDialogTitle')).toHaveText('Switch to Gray')
  await expect(page.locator('#themeColours_apply')).toBeChecked()
  await answer(page, 'apply', '#999999')
  const gray = await scene(page)
  expect(gray.edge).toBe('#6e2a5a')
  for (const c of gray.nodes)
    expect(contrast(c, '#999999'), c).toBeGreaterThanOrEqual(3)

  // or keep them: only the background and the labels change
  await picker.selectOption('blueprint')
  await answer(page, 'keep', '#0d2b52')
  const kept = await scene(page)
  expect(kept.background).toBe('#0d2b52')
  expect(kept.label).toBe('#ffffff')
  expect(kept.edge).toBe(gray.edge)
  expect(kept.nodes).toEqual(gray.nodes)

  // cancel: no switch, the picker shows the theme on screen
  await picker.selectOption('paper')
  await answer(page, 'cancel')
  await expect(picker).toHaveValue('blueprint')
  expect((await scene(page)).background).toBe('#0d2b52')

  // Undo walks back blueprint → gray, colours and picker too
  await page.locator('#undoButton').dispatchEvent('click')
  expect(await scene(page)).toEqual(gray)
  await expect(picker).toHaveValue('gray')
})

test("applying a theme recolours the session's own nodes and every channel, distinctly", async ({
  page,
}) => {
  test.setTimeout(120_000)
  await start(page)
  await loadExample(page, 'Neural network: variational autoencoder, 8 layers')
  const own = await scene(page)
  expect(own.edgeFile).toBe(true) // a session shows its own edge colours
  const picker = page.locator('#themeSelect')

  await picker.selectOption('universe')
  await answer(page, 'apply', '#0a0a23')
  const themed = await scene(page)
  const bg = themed.background
  for (const c of [...themed.nodes, ...themed.channels])
    expect(contrast(c, bg), c).toBeGreaterThanOrEqual(3)
  expect(new Set(themed.channels).size).toBe(themed.channels.length)
  const layers = await page.evaluate(() =>
    (
      window as unknown as { __arena: { ctx: Ctx } }
    ).__arena.ctx.nodeObjects.map((n) => n.layer)
  )
  expect(new Set(themed.nodes).size).toBe(new Set(layers).size)
  // the session's own edge colours give way to the channels'
  expect(themed.edgeFile).toBe(false)
  await expect(page.locator('#edgeFileColorPriority')).not.toBeChecked()

  // undo brings the session's colours back
  await page.locator('#undoButton').dispatchEvent('click')
  const back = await scene(page)
  expect(back.nodes).toEqual(own.nodes)
  expect(back.channels).toEqual(own.channels)
  expect(back.edgeFile).toBe(true)
})

test('a session keeps its theme and whether its colours were applied', async ({
  page,
}, info) => {
  test.setTimeout(120_000)
  await start(page)
  await loadExample(page)
  const picker = page.locator('#themeSelect')
  await picker.selectOption('okabe')
  await answer(page, 'keep', '#1c1c1c')

  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  const download = page.waitForEvent('download')
  await page.locator('#save_network_object').click()
  const file = info.outputPath('themed.json')
  await (await download).saveAs(file)
  const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    theme: unknown
  }
  expect(saved.theme).toEqual({ name: 'okabe', applied: false })

  await start(page)
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#load_network_file').setInputFiles(file)
  await expect(page.locator('#file_status')).toContainText('Session loaded')
  await expect(picker).toHaveValue('okabe')
  // the next switch offers the session's answer first
  await picker.selectOption('light')
  await expect(page.locator('#themeColours_keep')).toBeChecked()
})
