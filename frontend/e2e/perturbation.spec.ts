import { expect, test, type Page } from './fixtures'
import path from 'node:path'

// Analyze → Perturbation (ui/perturbation.ts): knock out the top 3 nodes by
// degree on a bundled example (faded in the scene, undoable, coloured by
// change, restored, applied as a new network), a multiplex knockout of a
// selected node, and the robustness curves of a targeted and a random attack.

const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')

type Ctx = {
  nodeObjects: {
    name: string
    layer: string
    nodeLayerName: string
    isSelected: boolean
    alpha: number
    color: string
  }[]
  edgeObjects: { source: string; target: string; opacityFactor: number }[]
}
type Win = {
  __arena: { ctx: Ctx; history: { undo(): void; redo(): void } }
}

const nodes = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as Win).__arena.ctx.nodeObjects.map((n) => ({
      id: n.nodeLayerName,
      name: n.name,
      alpha: n.alpha,
      color: n.color,
    }))
  )

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

async function readDownload(page: Page, click: () => Promise<void>) {
  const download = page.waitForEvent('download')
  await click()
  const file = await download
  const text = await new Promise<string>((resolve, reject) => {
    void file.createReadStream().then((s) => {
      let t = ''
      s.on('data', (c: Buffer) => (t += c.toString()))
      s.on('end', () => resolve(t))
      s.on('error', reject)
    }, reject)
  })
  return { name: file.suggestedFilename(), text }
}

test('knockout and attack curves', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  const before = await nodes(page)

  await tab(page, 'Perturbation')
  const card = page.locator('#panel-perturbation')
  await expect(page.locator('#runKnockout')).toBeVisible()

  // ---- knock out the top 3 by degree in the whole network
  await page.locator('#koNodes').selectOption('top')
  await page.locator('#koTopMetric').selectOption('degree')
  await page.locator('#koTopK').fill('3')
  await page.locator('#runKnockout').click()
  const status = page.locator('#perturb_status')
  await expect(status).toContainText('Knocked out 3 nodes')
  // the bar ends green with a summary
  await expect(page.locator('#perturbProgress .progress-bar')).toHaveClass(
    /bg-success/
  )
  await expect(page.locator('#perturbProgress')).toContainText(
    'largest component'
  )
  await expect(page.locator('#koCancel')).toBeHidden()
  await expect(status).toContainText('Whole network: largest component')
  await expect(status).toHaveClass(/text-success/)

  // faded in the scene, with the edges that went with them
  const faded = (await nodes(page)).filter((n) => n.alpha < 1)
  expect(faded).toHaveLength(3)
  const gone = faded.map((n) => n.id)
  expect(
    await page.evaluate(
      (ids) =>
        (window as unknown as Win).__arena.ctx.edgeObjects
          .filter((e) => ids.includes(e.source) || ids.includes(e.target))
          .every((e) => e.opacityFactor < 1),
      gone
    )
  ).toBe(true)
  // the preview is one undo step
  await page.evaluate(() => (window as unknown as Win).__arena.history.undo())
  expect((await nodes(page)).every((n) => n.alpha === 1)).toBe(true)
  await page.evaluate(() => (window as unknown as Win).__arena.history.redo())
  expect((await nodes(page)).filter((n) => n.alpha < 1)).toHaveLength(3)
  // hidden instead
  await page.locator('#koShow').selectOption('hide')
  expect(
    (await nodes(page)).filter((n) => gone.includes(n.id)).map((n) => n.alpha)
  ).toEqual([0, 0, 0])

  // the reports: 4 layers + the whole network, 9 measures each; every node
  await tab(page, 'Data Tables')
  await expect(page.locator('#dataPane-knockout table tbody tr')).toHaveCount(
    5 * 9
  )
  await expect(page.locator('#dataPane-knockout table')).toContainText(
    'Global efficiency'
  )
  const nodeRows = page.locator('#dataPane-knockoutNodes table tbody tr')
  await expect(nodeRows).toHaveCount(before.length)
  await expect(
    page.locator('#dataPane-knockoutNodes table tbody tr', {
      hasText: 'knocked out',
    })
  ).toHaveCount(3)
  await expect(page.locator('#dataPane-knockoutNodes thead')).toContainText(
    'Δ Betweenness'
  )

  // colour by change: a diverging legend; knocked-out nodes grey
  await tab(page, 'Perturbation')
  await page.locator('#koColourBy').selectOption('betweenness')
  await page.locator('#koColour').click()
  await expect(page.locator('#legend')).toContainText('Change in betweenness')
  await expect(page.locator('#legend')).toContainText('Knocked out')
  const coloured = await nodes(page)
  expect(
    coloured
      .filter((n) => gone.includes(n.id))
      .every((n) => n.color === '#8a8a86')
  ).toBe(true)
  expect(new Set(coloured.map((n) => n.color)).size).toBeGreaterThan(3)

  // restore: colours and opacities as before the knockout
  await page.locator('#koRestore').click()
  await expect(status).toContainText('Restored')
  const restored = await nodes(page)
  expect(restored.map((n) => [n.alpha, n.color])).toEqual(
    before.map((n) => [n.alpha, n.color])
  )

  // apply as a new network: the Networks menu lists it, without the three
  await page.locator('#koApply').click()
  await expect(status).toContainText('Loaded network')
  const applied = await nodes(page)
  expect(applied).toHaveLength(before.length - 3)
  expect(applied.some((n) => gone.includes(n.id))).toBe(false)
  await expect(
    page.locator('#workspaceList .workspace-row', { hasText: 'Knockout:' })
  ).toHaveCount(1)

  // ---- a multiplex knockout: every copy of a selected node
  const hub = await page.evaluate(() => {
    const c = (window as unknown as Win).__arena.ctx
    const copies = new Map<string, number>()
    for (const n of c.nodeObjects)
      copies.set(n.name, (copies.get(n.name) ?? 0) + 1)
    const [name, count] = [...copies].sort((a, b) => b[1] - a[1])[0]
    const node = c.nodeObjects.find((n) => n.name === name)!
    node.isSelected = true
    return { name, count }
  })
  expect(hub.count).toBeGreaterThan(1)
  await tab(page, 'Perturbation')
  await page.locator('#koNodes').selectOption('selected')
  await page.locator('#koEveryCopy').check()
  await page.locator('#runKnockout').click()
  await expect(status).toContainText(
    `Knocked out ${hub.count} nodes (${hub.name})`
  )

  // ---- attack: by degree, recalculated; then random runs on the same chart
  await page.locator('#attackStrategy').selectOption('degree')
  await expect(page.locator('#attackRanking')).toBeEnabled()
  await page.locator('#attackSteps').fill('10')
  // Cancel: the first curve's request is held back, so the run is still going
  await page.route('**/api/perturbation/attack', async (route) => {
    await new Promise((r) => setTimeout(r, 8000))
    await route.continue().catch(() => {}) // cancelled meanwhile
  })
  await page.locator('#runAttack').click()
  const bar = page.locator('#attackProgress .progress-bar')
  await expect(bar).toContainText('Curve 1 of 5: Whole network')
  await page.locator('#attackCancel').click()
  const attack = page.locator('#attack_status')
  await expect(attack).toContainText('Attack cancelled')
  await expect(page.locator('#attackCancel')).toBeHidden()
  await page.unroute('**/api/perturbation/attack')
  // a full run: one curve per request, the bar ends green
  await page.locator('#runAttack').click()
  await expect(attack).toContainText('robustness R =')
  await expect(bar).toHaveClass(/bg-success/)
  await expect(bar).toContainText('5 curves ready')
  const lines = page.locator('#attackChart path.ch-line')
  await expect(lines).toHaveCount(5) // 4 layers + the whole network
  await page.locator('#attackKeep').check()
  await page.locator('#attackStrategy').selectOption('random')
  await page.locator('#attackRuns').fill('3')
  await page.locator('#runAttack').click()
  await expect(attack).toContainText('random failure')
  await expect(lines).toHaveCount(10)
  const chart = page.locator('#attackChart')
  await expect(chart).toContainText('Whole network · degree attack')
  await chart.scrollIntoViewIfNeeded()
  await card.screenshot({ path: 'test-results/perturbation-card.png' })

  // the targeted attack breaks the whole network sooner than random failure
  const r = await chart.locator('text').allTextContents()
  const robustness = (what: string) =>
    Number(
      r.find((t) => t.startsWith(`Whole network · ${what}`))!.split('R = ')[1]
    )
  expect(robustness('degree attack')).toBeLessThan(robustness('random failure'))

  // downloads and the points in Data Tables
  const svg = await readDownload(page, () => page.locator('#attackSvg').click())
  expect(svg.name).toBe('robustness.svg')
  expect(svg.text).toContain('<svg')
  expect(svg.text).toContain('fill="#fff"')
  const csv = await readDownload(page, () => page.locator('#attackCsv').click())
  expect(csv.name).toBe('robustness.csv')
  expect(csv.text.split('\n')[0]).toContain('Largest component')
  await tab(page, 'Data Tables')
  await expect(page.locator('#dataPane-robustness table tbody tr')).toHaveCount(
    csv.text.trim().split('\n').length - 1
  )
})
