// NORMA-2.0 group layouts (Karatzas et al. 2022) — PLAN-ROADMAP Phase 26.
//
// Groups come from clusters, annotations, or the layers themselves:
// - clusters / annotations: each selected layer is laid out with its groups
//   kept apart (3D inside sphere/cube/cloud layers). In Single network mode
//   the layers are stacked into one space, so the whole network is laid out
//   at once instead — a group spanning layers stays in one place.
// - layers: the whole multilayer network is laid out once in 3D with every
//   layer as a group; each layer's floor then moves to its group's centre,
//   turns to face outward (its angle), and its nodes are laid out within it
//   (keeping depth inside 3D layer shapes). One undo step.

import * as THREE from 'three'
import {
  api,
  type LayoutPosition,
  type LayoutRequest,
  type UploadProgress,
} from '../api/client'
import { store } from '../store'
import { ctx } from '../three'
import { VOLUME_CONTAINERS } from '../three/Layer'
import { history } from '../commands/base'
import { ApplyLayoutCommand } from '../commands/scene'
import { applyLayout, fitToContainers } from './layout'
import { LayerStateCommand, captureLayers, type LayerState } from './modes'
import { redrawIntraLayerEdges } from './edge'
import { focusOnNodes } from './search'

export type GroupSource = 'clusters' | 'annotations' | 'layers'
export type GroupStrategy = 'virtual' | 'gravity' | 'supernodes'

export interface GroupLayoutOptions {
  source: GroupSource
  strategy: GroupStrategy
  algorithm: string
  local: string // layout name or 'keep'
  force: number
  scale: number
  layers: string[] // layers to lay out (all when empty)
  useWeights?: boolean
  onProgress?: UploadProgress // sent / computing / applying, for a progress bar
}

export class GroupLayoutError extends Error {}

// igraph's C core can abort() the whole server on 3D Kamada-Kawai for certain
// weighted graphs (src/layout/align.c) — reachable here because a group's
// real edges plus its synthetic clique-completing padding edges can land on
// exactly that pattern. Mirrors backend services/group_layouts.py's own
// guard. Remove once igraph fixes this upstream.
export const UNSAFE_3D_LOCAL_LAYOUTS = ['Kamada-Kawai']
// backend services/layouts.py LAYOUTS_3D / WEIGHTED_LAYOUTS, config NO_EDGE_LAYOUTS
export const LAYOUTS_3D = [
  'Fruchterman-Reingold',
  'Kamada-Kawai',
  'DrL',
  'Random',
  'Grid',
  'Circle', // on a sphere in 3D
]
export const WEIGHTED_ALGORITHMS = [
  'Fruchterman-Reingold',
  'Kamada-Kawai',
  'DrL',
]
const EDGE_BLIND_ALGORITHMS = ['Circle', 'Grid', 'Random']

// Layers as groups always run in 3D; clusters and annotations do when every
// chosen layer is a sphere/cube/cloud. A layer name that no longer exists
// (right after a split/merge) counts as "not volume".
export function groupLayoutRuns3D(
  source: GroupSource,
  layers: string[]
): boolean {
  if (source === 'layers') return true
  return (
    layers.length > 0 &&
    layers.every((l) => {
      const container = ctx.layers[ctx.layerGroups[l]]?.container
      return container !== undefined && VOLUME_CONTAINERS.includes(container)
    })
  )
}

// Why the strategy cannot run this algorithm (backend group_layouts.py
// check_combination), or null: group gravity acts only through edge weights,
// virtual nodes pull only through edges, and a 3D group layout needs 3D
// algorithms. The card hides these choices and shows the reason.
export function groupAlgorithmProblem(
  strategy: GroupStrategy,
  algorithm: string,
  three: boolean
): string | null {
  if (three && !LAYOUTS_3D.includes(algorithm))
    return `${algorithm} has no 3D version, and this group layout runs in 3D.`
  if (strategy === 'gravity' && !WEIGHTED_ALGORITHMS.includes(algorithm))
    return `Group gravity works through edge weights, which ${algorithm} ignores.`
  if (strategy === 'virtual' && EDGE_BLIND_ALGORITHMS.includes(algorithm))
    return `${algorithm} places nodes without reading edges, so virtual nodes cannot pull the groups together.`
  return null
}

// The same for "Layout inside each group".
export function groupLocalProblem(
  strategy: GroupStrategy,
  local: string,
  three: boolean
): string | null {
  if (local === 'keep')
    return strategy === 'supernodes'
      ? 'Super nodes always lay groups out locally.'
      : null
  if (three && !LAYOUTS_3D.includes(local))
    return `${local} has no 3D version, and this group layout runs in 3D.`
  if (three && UNSAFE_3D_LOCAL_LAYOUTS.includes(local))
    return (
      `${local} is disabled for 3D group layouts (a known igraph bug can crash the ` +
      'layout engine) — pick a different layout for groups inside sphere/cube containers.'
    )
  return null
}

// Node_Layer id -> groups, for the chosen source.
export function groupsFor(
  source: GroupSource,
  layers: Set<string>
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  ctx.nodeObjects.forEach((n, i) => {
    if (!layers.has(n.layer)) return
    const id = ctx.nodeLayerNames[i]
    if (source === 'layers') out[id] = [n.layer]
    else if (source === 'clusters')
      out[id] = n.cluster ? [`Cluster ${n.cluster}`] : []
    else out[id] = [...n.annotations]
  })
  return out
}

export async function runGroupLayout(o: GroupLayoutOptions): Promise<string> {
  const net = store.get().network
  if (!net) throw new GroupLayoutError('Load a network first.')
  const layers = o.layers.length ? o.layers : net.layers
  const chosen = new Set(layers)
  const groups = groupsFor(o.source, chosen)
  const grouped = Object.values(groups).filter((g) => g.length).length
  if (o.source !== 'layers' && grouped === 0)
    throw new GroupLayoutError(
      o.source === 'clusters'
        ? 'No clusters yet — find communities in the Clustering panel first.'
        : 'No annotations — upload a node attribute file with an Annotation column, or annotate from enrichment.'
    )
  if (o.source === 'layers' && layers.length < 2)
    throw new GroupLayoutError(
      'Arranging layers as groups needs at least two layers.'
    )
  const single = ctx.networkMode === 'single'
  if (o.source === 'layers' && single)
    throw new GroupLayoutError(
      'Single network mode has no floors to arrange — switch to Multilayered to place layers as groups.'
    )
  const three = groupLayoutRuns3D(o.source, layers)
  const problem =
    groupAlgorithmProblem(o.strategy, o.algorithm, three) ??
    groupLocalProblem(o.strategy, o.local, three)
  if (problem) throw new GroupLayoutError(problem)
  const req: LayoutRequest = {
    nodes: net.nodes,
    edges: net.edges,
    algorithm: o.algorithm,
    scope: o.source === 'layers' || single ? 'allLayers' : 'perLayer',
    selected_layers: layers,
    dimensions: three ? 3 : 2,
    use_weights: o.useWeights ?? false,
    group_strategy: o.strategy,
    groups,
    group_local: o.local,
    group_force: o.force,
    group_scale: o.scale,
  }
  if (o.source !== 'layers') {
    await applyLayout(req, !single, o.onProgress) // one graph: fit it as one
    return `Groups laid out (${new Set(Object.values(groups).flat()).size} groups${three ? ', in 3D' : ''}).`
  }
  const res = await api.layout(req)
  placeLayersAsGroups(res.positions, layers)
  focusOnNodes(ctx.nodeObjects.map((_, i) => i)) // the floors moved: fit them in view
  return `${layers.length} layers placed and angled as groups.`
}

// ---------------------------------------------------------------- layers
type Vec3 = THREE.Vector3

// Layer placements from one 3D layout of the whole network. Exported for tests.
export function layerPlacements(
  raw: Record<string, number[]>,
  layers: string[]
): {
  layer: string
  position: Vec3
  quaternion: THREE.Quaternion
  nodes: Record<string, [number, number, number]>
}[] {
  const byLayer = new Map<string, [string, Vec3][]>()
  for (const [id, p] of Object.entries(raw)) {
    const layer = ctx.nodeGroups[id]
    if (!layers.includes(layer)) continue
    const list = byLayer.get(layer) ?? []
    list.push([id, new THREE.Vector3(p[0], p[1], p[2] ?? 0)])
    byLayer.set(layer, list)
  }
  const used = layers.filter((l) => byLayer.has(l))
  const centroid = (pts: Vec3[]) =>
    pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(pts.length)
  const centers = new Map(
    used.map((l) => [l, centroid(byLayer.get(l)!.map(([, p]) => p))])
  )
  const G = centroid([...centers.values()])
  const width = (l: string) => {
    const layer = ctx.layers[ctx.layerGroups[l]]
    return layer.geometry_parameters_width * layer.getScale()
  }
  // spread layer centres so floors (their widths) clear each other
  let s = 1
  used.forEach((a, i) =>
    used.slice(i + 1).forEach((b) => {
      const d = centers.get(a)!.distanceTo(centers.get(b)!)
      const need = 0.6 * (width(a) + width(b))
      if (d > 1e-9) s = Math.max(s, need / d)
    })
  )
  const xAxis = new THREE.Vector3(1, 0, 0) // a floor's normal is its local x
  return used.map((layer) => {
    const c = centers.get(layer)!
    const out = c.clone().sub(G)
    // angle: the floor faces away from the middle of the arrangement
    const normal = out.length() > 1e-9 ? out.clone().normalize() : xAxis.clone()
    const quaternion = new THREE.Quaternion().setFromUnitVectors(xAxis, normal)
    const inverse = quaternion.clone().invert()
    const local = byLayer.get(layer)!.map(([id, p]) => {
      const d = p.clone().sub(c).applyQuaternion(inverse) // into the floor's frame
      return [id, d] as const
    })
    const container = ctx.layers[ctx.layerGroups[layer]].container
    const keepDepth = VOLUME_CONTAINERS.includes(container)
    const reach = Math.max(
      1e-9,
      ...local.map(([, d]) => (keepDepth ? d.length() : Math.hypot(d.y, d.z)))
    )
    const k = ((width(layer) / 2) * 0.9) / reach // fill the floor / volume
    const nodes: Record<string, [number, number, number]> = {}
    for (const [id, d] of local)
      nodes[id] = [d.y * k, d.z * k, keepDepth ? d.x * k : 0]
    return { layer, position: out.multiplyScalar(s), quaternion, nodes }
  })
}

function placeLayersAsGroups(
  raw: Record<string, LayoutPosition>,
  layers: string[]
): void {
  const placements = layerPlacements(raw, layers)
  const before: LayerState[] = captureLayers()
  const after: LayerState[] = captureLayers()
  const positions: Record<string, LayoutPosition> = {}
  for (const p of placements) {
    const i = ctx.layerGroups[p.layer]
    after[i] = { ...after[i], position: p.position, quaternion: p.quaternion }
    Object.assign(positions, p.nodes)
  }
  const stack = new LayerStateCommand('Layers as groups', before, after)
  // into each layer's container shape (cylinder, torus, …), as layouts are
  const nodes = new ApplyLayoutCommand(fitToContainers(positions, true))
  history.execute({
    description: 'Layers as groups (NORMA-2.0)',
    execute: () => {
      stack.execute()
      nodes.execute()
    },
    undo: () => {
      nodes.undo()
      stack.undo()
    },
  })
  redrawIntraLayerEdges()
}
