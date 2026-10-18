// Layout + topology actions — port of v2 www/js/object_actions/layout.js
// (executeLayout / scaleTopology). Fetches from the API, normalizes the raw
// igraph coordinates into each node's layer plane, and dispatches the Phase 10
// commands so the change is one undo step.

import { MathUtils, Quaternion, Vector3 } from 'three'
import {
  api,
  type LayoutPosition,
  type LayoutRequest,
  type TopologyRequest,
} from '../api/client'
import type { UploadProgress } from '../api/client'
import { ctx } from '../three'
import { history } from '../commands/base'
import {
  ApplyLayoutCommand,
  ApplyTopologyCommand,
  ColorNodesByValueCommand,
  sceneCoordsShown,
  showSceneCoords,
} from '../commands/scene'
import { initialSpreadLayers } from './layer'
import { defaultHiveInput, type HiveInput } from './hive'
import { redrawIntraLayerEdges } from './edge'

// v2 executeLayout: the backend returns raw 2D [y, z] coords; map them into the
// layer plane, target range [-minWidth/2, minWidth/2], then scale by the node's
// own layer scale. x is always 0 (position on the floor).
//
// ponytail: implements the allLayers scope (one global min/max + the narrowest
// layer width as target). The perLayer / local-layout refinements (v2's
// perLayerLayoutFLag / localLayoutFlag, which re-run per layer or preserve the
// current sub-region) are deferred until Phase 13 wires the scope UI.
//
// A 3D layout's third coordinate (depth off the plane, x) is mapped into the
// same [-t, t] range.
export function normalizeLayoutPositions(
  raw: Record<string, LayoutPosition>,
  perLayer = false
): Record<string, LayoutPosition> {
  const names = Object.keys(raw)
  if (names.length === 0) return {}
  // independent per-layer layouts (e.g. group layouts) each fill their floor
  if (perLayer) {
    const byLayer = new Map<string, Record<string, LayoutPosition>>()
    for (const n of names) {
      const layer = ctx.nodeGroups[n]
      byLayer.set(layer, { ...(byLayer.get(layer) ?? {}), [n]: raw[n] })
    }
    return Object.assign(
      {},
      ...[...byLayer.values()].map((part) => normalizeLayoutPositions(part))
    ) as Record<string, LayoutPosition>
  }

  const ys = names.map((n) => raw[n][0])
  const zs = names.map((n) => raw[n][1])
  const yMin = Math.min(...ys)
  const yMax = Math.max(...ys)
  const zMin = Math.min(...zs)
  const zMax = Math.max(...zs)
  const xs = names.map((n) => raw[n][2] ?? 0)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)

  const minWidth = Math.min(
    ...ctx.layers.map((l) => l.geometry_parameters_width)
  )
  const t = minWidth / 2 // target range is [-t, t]

  const out: Record<string, LayoutPosition> = {}
  for (const name of names) {
    const [y, z, x] = raw[name]
    const scale = ctx.layers[ctx.layerGroups[ctx.nodeGroups[name]]].getScale()
    const ny =
      yMax - yMin !== 0 ? ((y - yMin) * (2 * t)) / (yMax - yMin) - t : 0
    const nz =
      zMax - zMin !== 0 ? ((z - zMin) * (2 * t)) / (zMax - zMin) - t : 0
    if (x === undefined) out[name] = [ny * scale, nz * scale]
    else {
      const nx =
        xMax - xMin !== 0 ? ((x - xMin) * (2 * t)) / (xMax - xMin) - t : 0
      out[name] = [ny * scale, nz * scale, nx * scale]
    }
  }
  return out
}

// Keep nodes inside their layer's shape: disk floors (Phase 18) pull nodes in
// radially in the plane; sphere/cloud containers (Phase 20) radially in 3D;
// cube containers clamp each axis. A layout normalised into the square would
// otherwise poke out of round shapes.
export function fitToContainers(
  positions: Record<string, LayoutPosition>
): Record<string, LayoutPosition> {
  const out = { ...positions }
  for (const layer of ctx.layers) {
    const round3d = layer.container === 'sphere' || layer.container === 'cloud'
    const disk = layer.container === 'floor' && layer.floorShape === 'disk'
    const cube = layer.container === 'cube'
    if (!round3d && !disk && !cube) continue
    const names = Object.keys(out).filter(
      (n) => ctx.nodeGroups[n] === layer.name
    )
    const rim = (layer.geometry_parameters_width / 2) * layer.getScale() * 0.92
    if (cube) {
      const c = (v: number) => Math.max(-rim, Math.min(rim, v))
      for (const n of names) {
        const [y, z, x] = out[n]
        out[n] = x === undefined ? [c(y), c(z)] : [c(y), c(z), c(x)]
      }
      continue
    }
    const len = (p: LayoutPosition) =>
      round3d ? Math.hypot(p[0], p[1], p[2] ?? 0) : Math.hypot(p[0], p[1])
    const far = Math.max(0, ...names.map((n) => len(out[n])))
    if (far <= rim) continue
    const k = rim / far
    for (const n of names) {
      const [y, z, x] = out[n]
      out[n] =
        x === undefined ? [y * k, z * k] : [y * k, z * k, round3d ? x * k : x]
    }
  }
  return out
}

// @return the cross-layer misalignment score (null if not applicable)
export async function applyLayout(
  req: LayoutRequest,
  perLayerFit = false,
  onProgress?: UploadProgress
): Promise<number | null> {
  const res = await api.layout(req, onProgress)
  onProgress?.('server', 1) // applying
  const positions = fitToContainers(
    normalizeLayoutPositions(res.positions, perLayerFit)
  )
  history.execute(new ApplyLayoutCommand(positions, res.clusters))
  return res.misalignment ?? null
}

export async function applyTopology(
  req: TopologyRequest,
  colorByMetric = false
): Promise<void> {
  // scales are already mapped into the target range server-side (SPEC §6).
  const res = await api.topology(req)
  history.execute(new ApplyTopologyCommand(req.metric, res.scales, res.raw))
  if (colorByMetric && Object.keys(res.raw).length > 0)
    history.execute(new ColorNodesByValueCommand(res.raw))
}

// Predefined layer arrangements (v2 applyPredefinedLayout). Direct layer
// transforms, not undoable — as in v2. Needs > 1 layer.
export type PredefinedLayout =
  | 'parallel'
  | 'zigZag'
  | 'starLike'
  | 'cube'
  | 'helix'
  | 'sphere'
  | 'grid'
  | 'circle'
  | 'chord'
  | 'stack'
  | 'fan'
  | 'connectivity'
  | 'hive'

// the arrangements with their labels, in menu order (Layout and Scene panels)
export const PREDEFINED_LAYOUTS: [PredefinedLayout, string][] = [
  ['parallel', 'Parallel Coordinates'],
  ['zigZag', 'Zig Zag'],
  ['starLike', 'Star'],
  ['cube', 'Cube'],
  ['helix', 'Helix (spiral staircase)'],
  ['sphere', 'Sphere'],
  ['grid', 'Grid'],
  ['circle', 'Circle (floors facing the centre)'],
  ['chord', 'Chord diagram (arcs on a ring, chords across)'],
  ['stack', 'Stack (shelves)'],
  ['fan', 'Fan (pages around a spine)'],
  ['connectivity', 'By Inter-Layer Links'],
  ['hive', 'Hive plot (layers as axes)'],
]

// `hive`: where each node sits on its axis (actions/hive.ts); the default
// (degree, each axis full length) when not given
export function applyPredefinedLayout(
  name: PredefinedLayout,
  hive?: HiveInput
): void {
  if (ctx.layers.length <= 1) return
  leaveHive()
  resetSceneAndLayerPositions()

  if (name === 'parallel') initialSpreadLayers(1)
  else if (name === 'zigZag') {
    for (let i = 1; i < ctx.layers.length; i += 2) ctx.layers[i].translateY(500)
    initialSpreadLayers(1)
  } else if (name === 'starLike') applyStarLayout()
  else if (name === 'cube') applyCubeLayout()
  else if (name === 'helix') applyHelixLayout()
  else if (name === 'sphere') applySphereLayout()
  else if (name === 'grid') applyGridLayout()
  else if (name === 'circle') applyCircleLayout()
  else if (name === 'chord') applyChordLayout()
  else if (name === 'stack') applyStackLayout()
  else if (name === 'fan') applyFanLayout()
  else if (name === 'connectivity') applyConnectivityLayout()
  else if (name === 'hive') applyHiveLayout(hive ?? defaultHiveInput())

  // replaces the v2 Shiny syncs: displaced layers need edge + label redraw
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderLayerLabelsFlag = true
  ctx.renderNodeLabelsFlag = true
}

function resetSceneAndLayerPositions(): void {
  ctx.scene!.tiltDefault()
  for (const layer of ctx.layers) {
    layer.plane.position.set(0, 0, 0)
    if (ctx.camera) layer.plane.quaternion.copy(ctx.camera.quaternion)
  }
}

// Petals around the origin: each layer rotated by its share of 360° and
// pushed outward by half its width + 100.
function applyStarLayout(): void {
  const degree = 360 / ctx.layers.length
  ctx.layers.forEach((layer, i) => {
    layer.plane.rotateZ(MathUtils.degToRad(degree * i))
    layer.plane.translateY(-layer.geometry_parameters_width / 2 - 100)
  })
}

// Up to 6 layers form a cube's sides; additional cubes line up along x.
function applyCubeLayout(): void {
  const layersPerCube = 6
  const cubes = Math.ceil(ctx.layers.length / layersPerCube)
  const largest = Math.max(
    ...ctx.layers.map((l) => l.geometry_parameters_width)
  )
  const distance = cubes * (largest + 400)

  for (let j = 0; j < cubes; j++) {
    let cubeSideCode = 0
    const maxI = Math.min(j * layersPerCube + layersPerCube, ctx.layers.length)

    for (let i = j * layersPerCube; i < maxI; i++) {
      const plane = ctx.layers[i].plane
      if (cubes > 1)
        plane.position.set(decideCubeStartingX(j, cubes, distance), 0, 0)

      if (!(cubeSideCode % 2)) plane.rotateZ(MathUtils.degToRad(90))
      if (cubeSideCode >= 4) plane.rotateY(MathUtils.degToRad(90))

      const offset = ctx.layers[i].geometry_parameters_width / 2 + 100
      if (cubeSideCode === 0 || cubeSideCode === 1 || cubeSideCode === 5)
        plane.translateX(offset)
      else plane.translateX(-offset)

      cubeSideCode++
    }
  }
}

function decideCubeStartingX(
  j: number,
  cubes: number,
  distance: number
): number {
  const half = Math.floor(cubes / 2)
  if (cubes % 2 && j === half) return 0
  return j < half ? -distance / cubes : distance / cubes
}

const largestWidth = () =>
  Math.max(...ctx.layers.map((l) => l.geometry_parameters_width))

// Hive plot (Krzywinski et al. 2012): every layer is an axis radiating from
// one centre in the plane facing the viewer — evenly spread, or 120° apart
// for two — its floor a thin bar, and each node on its layer's axis at its
// place (0 = inner end, 1 = outer end). Links curve between the axes
// (three/hive.ts).
function applyHiveLayout(input: HiveInput): void {
  const n = ctx.layers.length
  // a hive plot is read face on, without the scene's own axes at its centre
  ctx.scene!.getQuaternion().identity()
  if (sceneCoordsShown()) {
    showSceneCoords(false)
    hidSceneCoords = true
  }
  const length = largestWidth() // of every axis
  const inner = length * 0.15 // the empty middle
  const base = ctx.layers[0].plane.quaternion.clone() // the reset frame
  const right = new Vector3(1, 0, 0).applyQuaternion(base)
  const up = new Vector3(0, 1, 0).applyQuaternion(base)
  const at = (theta: number, r: number) =>
    right
      .clone()
      .multiplyScalar(r * Math.cos(theta))
      .addScaledVector(up, r * Math.sin(theta))
  const angle = (i: number) =>
    n === 2
      ? Math.PI / 2 + ((i === 0 ? 1 : -1) * Math.PI) / 3
      : Math.PI / 2 - (2 * Math.PI * i) / n
  // as in the chord diagram: the floor faces the viewer, its y along the radius
  const faceOn = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    Math.PI / 2
  )
  const frames = ctx.layers.map((layer, li) => {
    const theta = angle(li)
    const centre = at(theta, inner + length / 2)
    const q = base
      .clone()
      .multiply(
        new Quaternion().setFromAxisAngle(
          new Vector3(0, 0, 1),
          theta - Math.PI / 2
        )
      )
      .multiply(faceOn)
    layer.setFloorShape('axis')
    layer.plane.position.copy(centre)
    layer.plane.quaternion.copy(q)
    const inv = q.clone().invert()
    // the layer's name at the outer end of its axis
    layer.sphere?.position.copy(
      at(theta, inner + length * 1.06)
        .sub(centre)
        .applyQuaternion(inv)
    )
    return { theta, centre, inv }
  })
  ctx.nodeObjects.forEach((node, i) => {
    const id = ctx.nodeLayerNames[i]
    const li = ctx.layerGroups[ctx.nodeGroups[id]]
    const f = frames[li]
    if (!f) return
    const t = Math.min(1, Math.max(0, input.position[id] ?? 0))
    const p = at(f.theta, inner + t * length)
      .sub(f.centre)
      .applyQuaternion(f.inv)
    node.setPosition('x', 0)
    node.setPosition('y', p.y)
    node.setPosition('z', p.z)
  })
  ctx.hive = {
    curved: input.curved,
    right: right.toArray(),
    up: up.toArray(),
  }
  redrawIntraLayerEdges()
}

// whether the hive plot hid the scene's axes (they come back after it)
let hidSceneCoords = false

// Any other arrangement ends the hive plot: square floors, straight links
function leaveHive(): void {
  if (!ctx.hive) return
  ctx.hive = null
  for (const layer of ctx.layers)
    if (layer.floorShape === 'axis') layer.setFloorShape('square')
  if (hidSceneCoords) showSceneCoords(true)
  hidSceneCoords = false
}

// Spiral staircase: spread along x like Parallel, each layer a further step
// around the x axis, so neighbours stay readable while the stack is compact.
function applyHelixLayout(): void {
  const n = ctx.layers.length
  const radius = largestWidth() * 0.6
  const spacing = (ctx.xBoundMax * 2) / n
  ctx.layers.forEach((layer, i) => {
    const angle = (2 * Math.PI * i) / Math.min(n, 6)
    layer.plane.position.set(
      (i - (n - 1) / 2) * spacing,
      radius * Math.cos(angle),
      radius * Math.sin(angle)
    )
  })
}

// Layers tangent to a sphere (Fibonacci points), floors facing outwards.
function applySphereLayout(): void {
  const n = ctx.layers.length
  // just enough for neighbouring floors not to cut through each other
  const radius = largestWidth() * 0.6 * Math.max(1, Math.sqrt(n) / 2)
  const golden = Math.PI * (3 - Math.sqrt(5))
  const normal = new Vector3(1, 0, 0) // a floor's normal is its local x
  ctx.layers.forEach((layer, i) => {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    const dir = new Vector3(
      Math.cos(golden * i) * r,
      y,
      Math.sin(golden * i) * r
    )
    layer.plane.position.copy(dir.clone().multiplyScalar(radius))
    layer.plane.quaternion.copy(
      new Quaternion().setFromUnitVectors(normal, dir)
    )
  })
}

// Layers on a ring around the vertical axis, every floor facing the centre:
// a panorama of the layers, read by orbiting.
function applyCircleLayout(): void {
  const n = ctx.layers.length
  const w = largestWidth()
  const radius = Math.max(w * 0.9, (n * (w + 150)) / (2 * Math.PI))
  const normal = new Vector3(1, 0, 0) // a floor's normal is its local x
  ctx.layers.forEach((layer, i) => {
    const t = (2 * Math.PI * i) / n
    const dir = new Vector3(Math.sin(t), 0, Math.cos(t))
    layer.plane.position.copy(dir.clone().multiplyScalar(radius))
    layer.plane.quaternion.copy(
      new Quaternion().setFromUnitVectors(normal, dir.clone().negate())
    )
  })
}

// A chord diagram in 3D: the floors lie flat on one ring facing the viewer,
// each a sector with its nodes strung along the arc, so intra-layer edges
// hug the ring and inter-layer edges cross it as chords. The nodes move with
// the floors (undo brings both back); the ring is wide enough for the floors
// not to overlap and for the nodes to sit apart.
function applyChordLayout(): void {
  const n = ctx.layers.length
  const w = largestWidth()
  const base = ctx.layers[0].plane.quaternion.clone() // the reset frame
  const right = new Vector3(1, 0, 0).applyQuaternion(base)
  const up = new Vector3(0, 1, 0).applyQuaternion(base)
  const perLayer: number[][] = ctx.layers.map(() => [])
  ctx.nodeObjects.forEach((_, i) => {
    const li = ctx.layerGroups[ctx.nodeGroups[ctx.nodeLayerNames[i]]]
    if (li !== undefined && perLayer[li]) perLayer[li].push(i)
  })
  const spacing = 28 // along the arc, between nodes
  const R = Math.max(
    w / (2 * Math.sin(Math.PI / n)) + 20,
    (ctx.nodeObjects.length * spacing) / (2 * Math.PI),
    w * 0.9
  )
  const span = (2 * Math.PI) / n
  const gap = span * 0.08 // between neighbouring sectors
  // a floor's normal is its local x: turned onto the ring's normal, then the
  // floor's own y axis is pointed outward along the sector's radius
  const faceOn = new Quaternion().setFromAxisAngle(
    new Vector3(0, 1, 0),
    Math.PI / 2
  )
  ctx.layers.forEach((layer, li) => {
    const theta = Math.PI / 2 - span * li // clockwise from the top
    const centre = right
      .clone()
      .multiplyScalar(R * Math.cos(theta))
      .addScaledVector(up, R * Math.sin(theta))
    const q = base
      .clone()
      .multiply(
        new Quaternion().setFromAxisAngle(
          new Vector3(0, 0, 1),
          theta - Math.PI / 2
        )
      )
      .multiply(faceOn)
    layer.plane.position.copy(centre)
    layer.plane.quaternion.copy(q)
    const inv = q.clone().invert()
    const ids = perLayer[li]
    ids.forEach((ni, k) => {
      const phi =
        theta - span / 2 + gap + ((span - 2 * gap) * (k + 0.5)) / ids.length
      const p = right
        .clone()
        .multiplyScalar(R * Math.cos(phi))
        .addScaledVector(up, R * Math.sin(phi))
        .sub(centre)
        .applyQuaternion(inv)
      const node = ctx.nodeObjects[ni]
      node.setPosition('x', 0)
      node.setPosition('y', p.y)
      node.setPosition('z', p.z)
    })
  })
  redrawIntraLayerEdges()
}

// Floors stacked one above the other, flat like shelves, inter-layer links
// running straight up and down.
function applyStackLayout(): void {
  const n = ctx.layers.length
  const step = largestWidth() * 0.45 + 60
  const normal = new Vector3(1, 0, 0)
  const up = new Vector3(0, 1, 0)
  ctx.layers.forEach((layer, i) => {
    layer.plane.position.set(0, ((n - 1) / 2 - i) * step, 0)
    layer.plane.quaternion.copy(new Quaternion().setFromUnitVectors(normal, up))
  })
}

// Layers fanned out like the pages of a book around a vertical spine.
function applyFanLayout(): void {
  const n = ctx.layers.length
  const total = Math.min(150, 25 * (n - 1)) // degrees the fan spans
  ctx.layers.forEach((layer, i) => {
    const deg = n > 1 ? -total / 2 + (total * i) / (n - 1) : 0
    layer.plane.position.set(0, 0, 0)
    layer.plane.rotateY(MathUtils.degToRad(deg))
    // push each page out along its own width, so the spine is shared
    layer.plane.translateZ(layer.geometry_parameters_width / 2)
  })
}

// Floors side by side in rows (all facing the same way) — many layers fit on
// screen at once.
function applyGridLayout(): void {
  const n = ctx.layers.length
  const cols = Math.ceil(Math.sqrt(n))
  const rows = Math.ceil(n / cols)
  const step = largestWidth() + 100
  ctx.layers.forEach((layer, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
    layer.plane.position.set(
      0,
      ((rows - 1) / 2 - row) * step,
      (col - (cols - 1) / 2) * step
    )
  })
}

// Layer adjacency weights from inter-layer edges.
export function layerLinkCounts(): number[][] {
  const n = ctx.layers.length
  const w = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (const e of ctx.edgeObjects) {
    if (!e.interLayer) continue
    const a =
      ctx.layerGroups[ctx.nodeGroups[ctx.nodeLayerNames[e.sourceNodeIndex]]]
    const b =
      ctx.layerGroups[ctx.nodeGroups[ctx.nodeLayerNames[e.targetNodeIndex]]]
    if (a === b || a === undefined || b === undefined) continue
    w[a][b]++
    w[b][a]++
  }
  return w
}

// Force-directed placement of whole layers (each layer one point): strongly
// linked layers end up next to each other. Deterministic (circle start),
// spring length = one floor width + gap, so floors never overlap much.
export function connectivityPositions(
  w: number[][],
  spacing: number,
  iterations = 300
): [number, number][] {
  const n = w.length
  const pos: [number, number][] = Array.from({ length: n }, (_, i) => [
    spacing * Math.cos((2 * Math.PI * i) / n),
    spacing * Math.sin((2 * Math.PI * i) / n),
  ])
  const maxW = Math.max(1, ...w.flat())
  for (let it = 0; it < iterations; it++) {
    const step = spacing * 0.1 * (1 - it / iterations)
    const disp = pos.map(() => [0, 0])
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        const dx = pos[i][0] - pos[j][0]
        const dy = pos[i][1] - pos[j][1]
        const d = Math.max(1e-6, Math.hypot(dx, dy))
        // repulsion keeps floors apart; attraction scales with shared links
        const f =
          (spacing * spacing) / (d * d) - (w[i][j] / maxW) * (d / spacing)
        disp[i][0] += (dx / d) * f
        disp[i][1] += (dy / d) * f
      }
    for (let i = 0; i < n; i++) {
      const len = Math.max(1e-6, Math.hypot(disp[i][0], disp[i][1]))
      pos[i][0] += (disp[i][0] / len) * Math.min(len, step)
      pos[i][1] += (disp[i][1] / len) * Math.min(len, step)
    }
  }
  return pos
}

function applyConnectivityLayout(): void {
  const spacing = largestWidth() + 200
  const pos = connectivityPositions(layerLinkCounts(), spacing)
  ctx.layers.forEach((layer, i) =>
    layer.plane.position.set(pos[i][0], 0, pos[i][1])
  )
}

// NORMA "height by metric": lift every node off its floor by its degree
// (0 .. maxHeight, along the floor normal). Undoable via ApplyLayoutCommand;
// any 2D layout flattens the nodes again.
export function liftNodesByDegree(maxHeight: number): void {
  const degree = new Array<number>(ctx.nodeObjects.length).fill(0)
  for (const e of ctx.edgeObjects) {
    degree[e.sourceNodeIndex]++
    degree[e.targetNodeIndex]++
  }
  const top = Math.max(1, ...degree)
  const positions: Record<string, LayoutPosition> = {}
  ctx.nodeObjects.forEach((node, i) => {
    positions[ctx.nodeLayerNames[i]] = [
      node.getPosition('y'),
      node.getPosition('z'),
      (degree[i] / top) * maxHeight,
    ]
  })
  history.execute(new ApplyLayoutCommand(positions))
}
