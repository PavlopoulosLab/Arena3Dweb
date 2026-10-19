import { expect, openCard, test, type Page } from './fixtures'
import path from 'node:path'

// The Clustering panel, then the Group Layout card: the card offers only what
// each strategy can run (and says why), and the run pulls the communities
// apart — per layer in Multilayered mode, over the whole stacked network in
// Single network mode.

const FIGURE_2A = path.resolve('public/data/figure2A_data.tsv')
const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

// mean distance between groups / mean distance inside groups (> 1 = apart),
// per layer, or over every node when the layers share one space
const separation = (page: Page, perLayer: boolean) =>
  page.evaluate((perLayer) => {
    type N = {
      layer: string
      cluster: string
      getPosition: (a: string) => number
    }
    const nodes = (
      window as unknown as { __arena: { ctx: { nodeObjects: N[] } } }
    ).__arena.ctx.nodeObjects
    const parts = new Map<string, N[]>()
    for (const n of nodes) {
      const key = perLayer ? n.layer : 'all'
      parts.set(key, [...(parts.get(key) ?? []), n])
    }
    const out: number[] = []
    for (const ns of parts.values()) {
      let inside = 0
      let insideN = 0
      let between = 0
      let betweenN = 0
      for (let i = 0; i < ns.length; i++)
        for (let j = i + 1; j < ns.length; j++) {
          const d = Math.hypot(
            ...['x', 'y', 'z'].map(
              (a) => ns[i].getPosition(a) - ns[j].getPosition(a)
            )
          )
          if (ns[i].cluster === ns[j].cluster) {
            inside += d
            insideN++
          } else {
            between += d
            betweenN++
          }
        }
      if (insideN && betweenN) out.push(between / betweenN / (inside / insideN))
    }
    return Math.min(...out)
  }, perLayer)

async function findCommunities(page: Page) {
  await tab(page, 'Clustering')
  await page.locator('#clusterAlgorithm').selectOption('Louvain')
  await page.locator('#runClustering').dispatchEvent('click')
  await expect(page.locator('#cluster_status')).toContainText(
    'nodes coloured by community',
    { timeout: 60_000 }
  )
  await tab(page, 'Layout')
}

async function runGroups(page: Page, expected: string | RegExp) {
  await page.locator('#layouts_status').evaluate((e) => (e.textContent = ''))
  await page.locator('#runGroupLayout').dispatchEvent('click')
  await expect(page.locator('#layouts_status')).toContainText(expected, {
    timeout: 60_000,
  })
}

test('after clustering, every offered group layout groups the nodes', async ({
  page,
}) => {
  test.setTimeout(180_000)
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(FIGURE_2A)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
  await findCommunities(page)
  await page.locator('#clustersToAnnotations').dispatchEvent('click')
  const before = await separation(page, true)
  await openCard(page, '#groupLayoutCard')
  await expect(page.locator('#groupLayoutCard')).toHaveAttribute('open', '')

  const source = page.locator('#groupSource')
  const strategy = page.locator('#groupStrategy')
  const algorithm = page.locator('#groupAlgorithm')
  const note = page.locator('#groupCompat')
  const rt = algorithm.locator('option[value="Reingold-Tilford"]')

  // the reported settings: Annotations, Group gravity, Reingold-Tilford —
  // gravity works through edge weights, which Reingold-Tilford ignores
  await source.selectOption('annotations')
  await strategy.selectOption('virtual')
  await algorithm.selectOption('Reingold-Tilford')
  await page.locator('#groupLocal').selectOption('Fruchterman-Reingold')
  await strategy.selectOption('gravity')
  await expect(algorithm).toHaveValue('Fruchterman-Reingold')
  await expect(rt).toBeDisabled()
  await expect(note).toContainText('edge weights')
  await expect(note).toContainText(
    'Reingold-Tilford was switched to Fruchterman-Reingold'
  )
  await runGroups(page, 'Groups laid out')
  const gravity = await separation(page, true)
  expect(gravity).toBeGreaterThan(before)
  expect(gravity).toBeGreaterThan(3)

  // virtual nodes and super nodes still run Reingold-Tilford
  for (const s of ['virtual', 'supernodes']) {
    await strategy.selectOption(s)
    await expect(rt).toBeEnabled()
    await algorithm.selectOption('Reingold-Tilford')
    await runGroups(page, 'Groups laid out')
    expect(await separation(page, true)).toBeGreaterThan(before)
  }

  // layers as groups run in 3D: no Reingold-Tilford, and the run works
  await source.selectOption('layers')
  await expect(rt).toBeDisabled()
  await expect(algorithm).toHaveValue('Fruchterman-Reingold')
  await expect(note).toContainText('laid out in 3D')
  await runGroups(page, '4 layers placed and angled')

  // Single network mode: the stacked layers are laid out as one graph, so a
  // community that spans layers stays together
  await page.locator('#modeSingle').dispatchEvent('click')
  await expect(page.locator('body')).toHaveClass(/mode-single/)
  await expect(source).toHaveValue('clusters')
  await findCommunities(page) // one graph now: communities across layers
  const plain = await separation(page, false)
  for (const s of ['virtual', 'gravity', 'supernodes']) {
    await strategy.selectOption(s)
    await runGroups(page, 'Groups laid out')
    expect(await separation(page, false)).toBeGreaterThan(Math.max(3, plain))
  }
})
