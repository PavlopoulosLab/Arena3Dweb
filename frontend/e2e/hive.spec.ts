import { expect, test, type Page } from './fixtures'
import os from 'node:os'
import path from 'node:path'

// Layout → Layer Arrangement → Hive plot (Krzywinski et al. 2012): every
// layer an axis, nodes placed on it by a network property, links curving
// between the axes; undoable, kept in sessions, and ready-made examples.

type V3 = {
  x: number
  y: number
  z: number
  clone: () => V3
  length: () => number
}
type Seg = {
  geometry?: { attributes?: { instanceStart?: { count: number } } }
}
type Arena = {
  __arena: {
    ctx: {
      layers: {
        name: string
        floorShape: string
        geometry_parameters_width: number
      }[]
      nodeObjects: {
        getPosition: (a: string) => number
        getWorldPosition: () => V3
      }[]
      nodeLayerNames: string[]
      nodeGroups: Record<string, string>
      layerGroups: Record<string, number>
      edgeObjects: {
        interLayer: boolean
        source: string
        target: string
        THREE_Object: Seg & { children: Seg[] }
      }[]
      hive: { curved: boolean } | null
      scene: { sphere: { worldToLocal: (v: V3) => V3 } }
    }
  }
}

const tab = (page: Page, name: string) =>
  page
    .getByRole('tab', { name, includeHidden: true, exact: true })
    .dispatchEvent('click')

async function load(page: Page, file: string): Promise<void> {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  await page.locator('#input_network_file').setInputFiles(`public/data/${file}`)
  await expect(page.locator('#file_status')).toContainText('Loaded network')
}

async function arrange(
  page: Page,
  options: { property?: string; scale?: string; curved?: boolean } = {}
): Promise<void> {
  await tab(page, 'Layout')
  await page
    .locator('#arrangementCard')
    .evaluate((el) => ((el as HTMLDetailsElement).open = true))
  await expect(page.locator('#hiveOptions')).toBeHidden()
  await page.locator('#layerArrangement').selectOption('hive')
  await expect(page.locator('#hiveOptions')).toBeVisible()
  if (options.property)
    await page.locator('#hiveProperty').selectOption(options.property)
  if (options.scale)
    await page.locator('#hiveScale').selectOption(options.scale)
  if (options.curved === false) await page.locator('#hiveCurved').uncheck()
  await page.locator('#applyArrangement').click()
  await expect(page.locator('#layouts_status')).toContainText('Hive plot')
}

// per layer: its floor shape, how far its nodes stray from the axis bar, and
// each node's distance from the hive centre with its degree
const read = (page: Page) =>
  page.evaluate(() => {
    const c = (window as unknown as Arena).__arena.ctx
    // every node's connections (one edge object per linked pair here)
    const degree: Record<string, number> = {}
    for (const e of c.edgeObjects) {
      degree[e.source] = (degree[e.source] ?? 0) + 1
      degree[e.target] = (degree[e.target] ?? 0) + 1
    }
    const sphere = c.scene.sphere
    // segments of the edge's line (a channel edge: its first channel's)
    const segments = (e: (typeof c.edgeObjects)[number] | undefined) => {
      const o = e?.THREE_Object
      const line = o?.geometry
        ? o
        : o?.children.find((ch) => ch.geometry?.attributes?.instanceStart)
      return line?.geometry?.attributes?.instanceStart?.count ?? null
    }
    const layers = c.layers.map((l, li) => {
      const nodes = c.nodeObjects
        .map((n, i) => ({ n, id: c.nodeLayerNames[i] }))
        .filter(({ id }) => c.layerGroups[c.nodeGroups[id]] === li)
      return {
        shape: l.floorShape,
        offAxis: Math.max(
          ...nodes.map(({ n }) => Math.abs(n.getPosition('z')))
        ),
        radii: nodes.map(({ n, id }) => ({
          r: sphere.worldToLocal(n.getWorldPosition().clone()).length(),
          degree: degree[id] ?? 0,
        })),
      }
    })
    return {
      hive: c.hive,
      layers,
      width: Math.max(...c.layers.map((l) => l.geometry_parameters_width)),
      inter: segments(c.edgeObjects.find((e) => e.interLayer)),
      intra: segments(c.edgeObjects.find((e) => !e.interLayer)),
    }
  })

test('hive plot: layers become axes, nodes by degree, curved links, undo', async ({
  page,
}) => {
  await load(page, 'GPCRs_data.tsv') // 4 layers, links within and between
  await arrange(page)
  await expect(page.locator('#layouts_status')).toContainText(
    'Hive plot: 4 axes, nodes by degree (connections)'
  )
  const hive = await read(page)
  expect(hive.hive?.curved).toBe(true)
  const inner = hive.width * 0.15
  for (const layer of hive.layers) {
    expect(layer.shape).toBe('axis') // the floor is a thin axis bar
    expect(layer.offAxis).toBeLessThan(1e-6) // every node on its axis
    for (const { r } of layer.radii) {
      expect(r).toBeGreaterThan(inner - 1)
      expect(r).toBeLessThan(inner + hive.width + 1)
    }
    // the best-connected node of each axis sits at its outer end, and more
    // connections never sit further in
    expect(Math.max(...layer.radii.map((x) => x.r))).toBeCloseTo(
      inner + hive.width,
      0
    )
    const byDegree = [...layer.radii].sort((a, b) => a.degree - b.degree)
    for (let k = 1; k < byDegree.length; k++)
      if (byDegree[k].degree > byDegree[k - 1].degree)
        expect(byDegree[k].r).toBeGreaterThan(byDegree[k - 1].r)
  }
  expect(hive.inter).toBe(24) // links between axes: curves
  expect(hive.intra).toBe(24) // links within an axis: arcs beside it
  await page.screenshot({ path: 'test-results/hive-gpcr.png' })

  // one undo takes the arrangement and its view back: square floors, straight
  // links
  await page.locator('#undoButton').dispatchEvent('click')
  const back = await read(page)
  expect(back.hive).toBeNull()
  expect(back.layers.every((l) => l.shape === 'square')).toBe(true)
  expect(back.inter).toBe(1)
})

test('hive plot by rank, straight links; another arrangement ends it', async ({
  page,
}) => {
  await load(page, 'prego.tsv') // 3 layers: the classic three axes
  await arrange(page, { property: 'name', scale: 'rank', curved: false })
  const hive = await read(page)
  expect(hive.hive?.curved).toBe(false)
  expect(hive.inter).toBe(1)
  // rank: evenly spaced along each axis
  for (const layer of hive.layers) {
    const r = layer.radii.map((x) => x.r).sort((a, b) => a - b)
    if (r.length < 3) continue
    const steps = r.slice(1).map((v, i) => v - r[i])
    for (const s of steps) expect(s).toBeCloseTo(steps[0], 3)
  }
  await page.locator('#layerArrangement').selectOption('parallel')
  await page.locator('#applyArrangement').click()
  const parallel = await read(page)
  expect(parallel.hive).toBeNull()
  expect(parallel.layers.every((l) => l.shape === 'square')).toBe(true)
})

test('hive examples open as hive plots, and sessions keep them', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  await tab(page, 'File')
  const choice = page.locator('#exampleChoice')
  await expect(choice.locator('option', { hasText: 'Hive plot' })).toHaveCount(
    3
  )
  await choice.selectOption({
    label: 'Hive plot: PREGO, three layers as three axes',
  })
  await page.locator('#exampleButton').click()
  await expect(page.locator('#file_status')).toContainText('as a hive plot')
  const hive = await read(page)
  expect(hive.layers).toHaveLength(3)
  expect(hive.layers.every((l) => l.shape === 'axis')).toBe(true)
  expect(hive.inter).toBe(24)
  await page.screenshot({ path: 'test-results/hive-prego.png' })

  // save the session and open it again: still a hive plot
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#save_network_object').dispatchEvent('click'),
  ])
  // outside frontend/: files written under the Vite root can trigger a reload
  const saved = path.join(os.tmpdir(), 'arena3d-e2e-hive-session.json')
  await download.saveAs(saved)
  await page.locator('#load_network_file').setInputFiles(saved)
  await expect(page.locator('#file_status')).toContainText('Session loaded')
  const again = await read(page)
  expect(again.hive?.curved).toBe(true)
  expect(again.layers.every((l) => l.shape === 'axis')).toBe(true)
  expect(again.inter).toBe(24)
})
