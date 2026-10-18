import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// The interactive UpSet plot (ui/upset.ts) under Analyze → Compare Layers:
// pick a bar (exactly those layers), add a bar, pick set rows as a union or
// intersection, select the pick in the scene, and load it as a new network
// through the "Import as" path (preset to replace by fixtures.ts, then Add).

const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

type Ctx = {
  layers: { name: string }[]
  nodeObjects: {
    name: string
    layer: string
    nodeLayerName: string
    isSelected: boolean
  }[]
  edgeObjects: { source: string; target: string }[]
}
type Win = { __arena: { ctx: Ctx }; __arenaImportAs?: string }

const scene = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as Win).__arena.ctx
    return {
      layers: c.layers.map((l) => l.name),
      ids: c.nodeObjects.map((n) => n.nodeLayerName).sort(),
      names: [...new Set(c.nodeObjects.map((n) => n.name))].sort(),
      selected: c.nodeObjects
        .filter((n) => n.isSelected)
        .map((n) => n.nodeLayerName)
        .sort(),
      edges: c.edgeObjects.length,
    }
  })

// names in exactly `layers` (of the compared ones), their copies there, and
// the edges among those copies — worked out from the scene itself
const exactly = (page: Page, layers: string[], compared: string[]) =>
  page.evaluate(
    ([want, all]) => {
      const c = (window as unknown as Win).__arena.ctx
      const inLayers = new Map<string, Set<string>>()
      for (const n of c.nodeObjects)
        if (all.includes(n.layer)) {
          if (!inLayers.has(n.name)) inLayers.set(n.name, new Set())
          inLayers.get(n.name)!.add(n.layer)
        }
      const names = [...inLayers]
        .filter(
          ([, ls]) => ls.size === want.length && want.every((l) => ls.has(l))
        )
        .map(([name]) => name)
        .sort()
      const ids = new Set(
        c.nodeObjects
          .filter((n) => names.includes(n.name) && want.includes(n.layer))
          .map((n) => n.nodeLayerName)
      )
      const edges = c.edgeObjects.filter(
        (e) => ids.has(e.source) && ids.has(e.target)
      ).length
      return { names, ids: [...ids].sort(), edges }
    },
    [layers, compared] as const
  )

// "12 nodes in Layer1 and Layer3 only" -> its count and layers
async function barOf(page: Page, i: number) {
  const label = await page
    .locator('#dataPane-similarity .up-col')
    .nth(i)
    .getAttribute('aria-label')
  const m = /^(\d+) nodes? in (.+) only$/.exec(label ?? '')
  expect(m).not.toBeNull()
  return { count: Number(m![1]), layers: m![2].split(' and ') }
}

test('UpSet plot: pick bars and sets, select them, load them as a network', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await page
    .getByRole('tab', { name: 'File', includeHidden: true, exact: true })
    .click()
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')

  await page
    .getByRole('tab', { name: 'Analysis', includeHidden: true, exact: true })
    .dispatchEvent('click')
  await page.locator('#compareLayers').dispatchEvent('click')
  await expect(page.locator('#analyze_status')).toContainText(
    'Layer Similarity'
  )
  await page
    .getByRole('tab', { name: 'Data Tables', includeHidden: true, exact: true })
    .dispatchEvent('click')
  const box = page.locator('#dataPane-similarity .upset-box')
  await expect(box).toBeVisible()
  const cols = box.locator('.up-col')
  const rows = box.locator('.up-set')
  const count = box.locator('.upset-count')
  const compared = await rows.evaluateAll((gs) =>
    gs.map((g) => g.getAttribute('aria-label')!.replace(/: \d+ nodes?$/, ''))
  )
  expect(compared.length).toBeGreaterThan(1)

  // hover: the tooltip names the sets, the count and members
  const first = await barOf(page, 0)
  await cols.first().hover()
  const tip = box.locator('.upset-tip')
  await expect(tip).toBeVisible()
  await expect(tip).toContainText(`${first.layers.join(' ∩ ')} only`)
  await expect(tip).toContainText(`${first.count} node`)
  await expect(box.locator('.up-set.is-related')).toHaveCount(
    first.layers.length
  )

  // click a bar: exactly those layers
  await cols.first().click()
  await expect(cols.first()).toHaveAttribute('aria-pressed', 'true')
  const want = await exactly(page, first.layers, compared)
  expect(want.names.length).toBe(first.count)
  await expect(count).toHaveText(String(first.count))
  await expect(box.locator('.upset-members')).toContainText(want.names[0])

  // ... selected in the scene: every copy in those layers
  await box.locator('.upset-select').click()
  await expect(box.locator('.upset-status')).toContainText(
    `Selected ${want.ids.length} node`
  )
  expect((await scene(page)).selected).toEqual(want.ids)

  // Shift-click adds a second bar
  const second = await barOf(page, 1)
  await cols.nth(1).click({ modifiers: ['Shift'] })
  await expect(count).toHaveText(String(first.count + second.count))
  await expect(box.locator('.up-col.is-picked')).toHaveCount(2)

  // the keyboard: Escape clears, Enter picks the focused bar
  await cols.nth(1).focus()
  await page.keyboard.press('Escape')
  await expect(box.locator('.up-col.is-picked')).toHaveCount(0)
  await expect(box.locator('.upset-what')).toHaveText('Nothing picked yet.')
  await page.keyboard.press('Enter')
  await expect(count).toHaveText(String(second.count))

  // set rows: union, then intersection, of the first two sets
  await rows.nth(0).click()
  await rows.nth(1).click()
  const [a, b] = await rows.evaluateAll((gs) =>
    gs.slice(0, 2).map((g) => g.getAttribute('aria-label')!.split(': ')[0])
  )
  const union = await page.evaluate(
    ([a, b]) => {
      const c = (window as unknown as Win).__arena.ctx
      const inA = new Set(
        c.nodeObjects.filter((n) => n.layer === a).map((n) => n.name)
      )
      const inB = new Set(
        c.nodeObjects.filter((n) => n.layer === b).map((n) => n.name)
      )
      return {
        union: new Set([...inA, ...inB]).size,
        both: [...inA].filter((x) => inB.has(x)).length,
      }
    },
    [a, b] as const
  )
  await expect(box.locator('.upset-op')).toBeVisible()
  await expect(count).toHaveText(String(union.union))
  await expect(box.locator('.upset-what')).toContainText(`${a} ∪ ${b}`)
  await box.locator('.upset-op label', { hasText: 'Intersection' }).click()
  await expect(count).toHaveText(String(union.both))
  await expect(box.locator('.upset-what')).toContainText(`${a} ∩ ${b}`)
  await cols.nth(2).hover()
  await box.screenshot({ path: 'test-results/upset-interactive.png' })

  // the download stays a static SVG
  const download = page.waitForEvent('download')
  await box.locator('.upset-download').click()
  const file = await download
  expect(file.suggestedFilename()).toBe('layerSimilarity_upset.svg')
  const svg = await new Promise<string>((resolve, reject) => {
    void file.createReadStream().then((s) => {
      let text = ''
      s.on('data', (c: Buffer) => (text += c.toString()))
      s.on('end', () => resolve(text))
      s.on('error', reject)
    }, reject)
  })
  expect(svg).toContain('<svg')
  expect(svg).not.toContain('tabindex')

  // sorting by degree puts the bars of most sets first
  await box.locator('.upset-sort').selectOption('degree-desc')
  const top = await barOf(page, 0)
  const last = await barOf(page, (await cols.count()) - 1)
  expect(top.layers.length).toBeGreaterThanOrEqual(last.layers.length)
  await box.locator('.upset-sort').selectOption('size')

  // load the first bar as a new network (Import as: replace)
  await cols.first().click()
  await expect(count).toHaveText(String(first.count))
  await box.locator('.upset-load').click()
  // the status comes once the load is done, just before the scene is shown
  await expect(box.locator('.upset-status')).toContainText('Loaded network')
  const loaded = await scene(page)
  expect(loaded.ids).toEqual(want.ids)
  expect(loaded.names).toEqual(want.names)
  expect(loaded.edges).toBe(want.edges)
  expect([...loaded.layers].sort()).toEqual([...first.layers].sort())
  await expect(
    page.locator('#workspaceList .workspace-row', { hasText: 'UpSet:' })
  ).toHaveCount(1)
  await expect(page.locator('#workspaceList .workspace-row')).toHaveCount(2)

  // Add: the pick comes in as new layers next to the loaded ones
  await page.evaluate(() => {
    ;(window as unknown as Win).__arenaImportAs = 'layer'
  })
  await page
    .getByRole('tab', { name: 'Data Tables', includeHidden: true, exact: true })
    .dispatchEvent('click')
  // a load brings Network Data up; the plot stays under Layer Similarity
  await page.getByRole('tab', { name: 'Layer Similarity', exact: true }).click()
  await expect(box).toBeVisible()
  await box.locator('.upset-load').click()
  await expect(box.locator('.upset-status')).toContainText('Added layer')
  expect((await scene(page)).layers.length).toBe(first.layers.length * 2)
  expect((await scene(page)).ids.length).toBe(want.ids.length * 2)
})
