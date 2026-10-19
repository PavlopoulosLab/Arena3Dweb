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
        plane: { position: { x: number; y: number; z: number } }
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
      hive: { curved: boolean; axes?: string } | null
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
  options: {
    property?: string
    scale?: string
    curved?: boolean
    axes?: 'flat' | '3d'
    height?: string
  } = {}
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
  if (options.axes) await page.locator('#hiveAxes').selectOption(options.axes)
  if (options.height)
    await page.locator('#hiveHeight').selectOption(options.height)
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
      const p = l.plane.position
      const r = Math.hypot(p.x, p.y, p.z)
      return {
        shape: l.floorShape,
        // the axis's direction from the hive centre (the floor's centre)
        dir: [p.x / r, p.y / r, p.z / r],
        offAxis: Math.max(
          ...nodes.map(({ n }) => Math.abs(n.getPosition('z')))
        ),
        // lift off a flat hive's plane (the floor's normal): per node
        lifts: nodes.map(({ n, id }) => ({
          lift: n.getPosition('x'),
          degree: degree[id] ?? 0,
        })),
        radii: nodes.map(({ n, id }) => ({
          r: sphere.worldToLocal(n.getWorldPosition().clone()).length(),
          degree: degree[id] ?? 0,
        })),
      }
    })
    // a link between two axes pointing opposite ways, if any
    const layerOf = (id: string) => c.layerGroups[c.nodeGroups[id]]
    const opposite = c.edgeObjects.find((e) => {
      if (!e.interLayer) return false
      const a = layers[layerOf(e.source)].dir
      const b = layers[layerOf(e.target)].dir
      return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] < -0.99
    })
    return {
      hive: c.hive,
      layers,
      opposite: opposite ? segments(opposite) : null,
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
  // the inter-layer links are rebuilt on the next frame
  await expect.poll(async () => (await read(page)).inter).toBe(1)
  const back = await read(page)
  expect(back.hive).toBeNull()
  expect(back.layers.every((l) => l.shape === 'square')).toBe(true)
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
  await expect(choice.locator('option', { hasText: /^Hive plot/ })).toHaveCount(
    3
  )
  await expect(
    choice.locator('option', { hasText: /^3D hive plot/ })
  ).toHaveCount(3)
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

// degrees between two axes' directions
const angle = (a: number[], b: number[]) =>
  (Math.acos(
    Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
  ) *
    180) /
  Math.PI

test('hive plot with axes spread in 3D: a tetrahedron for four layers', async ({
  page,
}) => {
  await load(page, 'GPCRs_data.tsv')
  await tab(page, 'Layout')
  await page
    .locator('#arrangementCard')
    .evaluate((el) => ((el as HTMLDetailsElement).open = true))
  await page.locator('#layerArrangement').selectOption('hive')
  // a height is for flat axes only
  await page.locator('#hiveAxes').selectOption('3d')
  await expect(page.locator('#hiveHeight')).toBeDisabled()
  await expect(page.locator('#hiveHeightNote')).toBeVisible()
  await page.locator('#hiveAxes').selectOption('flat')
  await expect(page.locator('#hiveHeight')).toBeEnabled()
  await page.locator('#hiveAxes').selectOption('3d')
  await page.locator('#applyArrangement').click()
  await expect(page.locator('#layouts_status')).toContainText(
    'Hive plot: 4 axes spread in 3D'
  )
  const hive = await read(page)
  expect(hive.hive?.axes).toBe('3d')
  for (const layer of hive.layers) {
    expect(layer.shape).toBe('axis')
    expect(layer.offAxis).toBeLessThan(1e-6) // on the axis bar …
    for (const { lift } of layer.lifts)
      expect(Math.abs(lift)).toBeLessThan(1e-6) // … not off it
  }
  // every two axes 109.47° apart: all neighbours, no link crosses an axis
  const dirs = hive.layers.map((l) => l.dir)
  for (let i = 0; i < dirs.length; i++)
    for (let j = i + 1; j < dirs.length; j++)
      expect(angle(dirs[i], dirs[j])).toBeCloseTo(109.47, 0)
  expect(hive.inter).toBe(24)
  expect(hive.intra).toBe(24)
  await page.screenshot({ path: 'test-results/hive-3d.png' })
})

test('hive plot in 3D with six layers: links between opposite axes curve round', async ({
  page,
}) => {
  test.setTimeout(120_000)
  await load(page, 'figure1_data.tsv') // six layers; links only between 5 and 6
  await arrange(page, { axes: '3d' })
  const hive = await read(page)
  // six axes: three opposite pairs (±x, ±y, ±z)
  const dirs = hive.layers.map((l) => l.dir)
  const opposites = dirs.flatMap((a, i) =>
    dirs.slice(i + 1).filter((b) => angle(a, b) > 179)
  )
  expect(opposites).toHaveLength(3)
  expect(hive.opposite).toBe(24) // a curve, not a line through the centre
})

test('flat hive plot with a height: nodes rise off the plane by a second property', async ({
  page,
}) => {
  await load(page, 'GPCRs_data.tsv')
  await arrange(page, { height: 'degree' })
  await expect(page.locator('#layouts_status')).toContainText(
    'height by degree'
  )
  const hive = await read(page)
  expect(hive.hive?.axes).toBe('flat')
  const most = hive.width * 0.6 // the highest lift: the axis's best-connected node
  for (const layer of hive.layers) {
    expect(layer.offAxis).toBeLessThan(1e-6)
    const lifts = layer.lifts
    for (const { lift } of lifts) {
      expect(lift).toBeGreaterThanOrEqual(-1e-6)
      expect(lift).toBeLessThanOrEqual(most + 1e-6)
    }
    const top = Math.max(...lifts.map((x) => x.degree))
    for (const x of lifts.filter((x) => x.degree === top))
      expect(x.lift).toBeCloseTo(most, 3)
  }
  expect(hive.inter).toBe(24) // the curves carry the lift from end to end
  await page.screenshot({ path: 'test-results/hive-height.png' })
})

test('flat hive plot: links between opposite axes curve round the centre', async ({
  page,
}) => {
  await load(page, 'GPCRs_data.tsv') // GPCRs (up) and G-proteins (down) linked
  await arrange(page)
  const hive = await read(page)
  const [up, , down] = hive.layers.map((l) => l.dir)
  expect(angle(up, down)).toBeCloseTo(180, 3)
  expect(hive.opposite).toBe(24) // not straight through the centre, over the axes
})

test('3D hive examples open with the axes spread in 3D', async ({ page }) => {
  test.setTimeout(150_000)
  await page.goto('/')
  await page.waitForFunction(
    () => '__arena' in (window as unknown as Record<string, unknown>)
  )
  for (const [label, file, axes, shot] of [
    [
      '3D hive plot: GPCR signalling, four axes as a tetrahedron',
      'GPCRs_data.tsv',
      4,
      'gpcr',
    ],
    [
      '3D hive plot: SARS-CoV-2 host–virus network, five axes on a sphere',
      'covid19_data.tsv',
      5,
      'covid',
    ],
    [
      '3D hive plot: six layers along ±X, ±Y and ±Z',
      'figure1_data.tsv',
      6,
      'six',
    ],
  ] as const) {
    await tab(page, 'File')
    await page.locator('#exampleChoice').selectOption({ label })
    await page.locator('#exampleButton').click()
    await expect(page.locator('#file_status')).toContainText(
      `Loaded ${file} as a 3D hive plot`,
      { timeout: 30_000 }
    )
    const hive = await read(page)
    expect(hive.hive?.axes).toBe('3d')
    expect(hive.layers).toHaveLength(axes)
    expect(hive.layers.every((l) => l.shape === 'axis')).toBe(true)
    // not in one plane: some axis leaves the plane of the first two
    // non-parallel ones
    const dirs = hive.layers.map((l) => l.dir)
    const cross = (a: number[], b: number[]) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ]
    const n = dirs
      .slice(1)
      .map((d) => cross(dirs[0], d))
      .find((c) => Math.hypot(...c) > 0.5)!
    const off = (d: number[]) =>
      Math.abs(d[0] * n[0] + d[1] * n[1] + d[2] * n[2]) / Math.hypot(...n)
    expect(Math.max(...dirs.map(off))).toBeGreaterThan(0.3)
    await page.screenshot({ path: `test-results/hive-3d-example-${shot}.png` })
  }
})
