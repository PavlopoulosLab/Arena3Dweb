// Edge bundling (Edit → Edges): intra-layer edges bundle within their own
// layer, inter-layer edges across the whole stack; in single-network mode
// every edge bundles in one set over the whole graph. The paths are computed
// once at full strength (three/fdeb.ts) and cached (three/bundling.ts); the
// sliders only blend between straight and bundled.

import * as THREE from 'three'
import { bus } from '../bus'
import { ctx } from '../three'
import type { Edge } from '../three/Edge'
import {
  bundleStrength,
  bundlesStale,
  clearBundle,
  clearBundles,
  frameEndpoints,
  msSinceBundleChange,
  onBundlesStale,
  setBundles,
  singleGraph,
  type Bundle,
  type BundleKind,
} from '../three/bundling'
import { bundleEdges, type Segment, type Vec3 } from '../three/fdeb'
import { history } from '../commands/base'
import type { Command } from '../commands/base'
import { redrawInterLayerEdges, redrawIntraLayerEdges } from './edge'

const SETTLE_MS = 400 // recompute once nodes have stopped moving this long

const toVec = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z]

// The edges of a kind: in a single network all of them are 'intra'.
function edgesOfKind(kind: BundleKind): Edge[] {
  if (singleGraph()) return kind === 'intra' ? ctx.edgeObjects.slice() : []
  return ctx.edgeObjects.filter((e) => e.interLayer === (kind === 'inter'))
}

export function computeBundles(kind: BundleKind): void {
  const edges = edgesOfKind(kind)
  // intra-layer edges bundle per layer; inter-layer edges, and every edge of
  // a single network, all together
  const perLayer = kind === 'intra' && !singleGraph()
  const groups = new Map<number, Edge[]>()
  for (const e of edges) {
    const key = perLayer ? e.sourceLayerIndex : 0
    const list = groups.get(key)
    if (list) list.push(e)
    else groups.set(key, [e])
  }
  const map = new Map<string, Bundle>()
  for (const group of groups.values()) {
    const ends = group.map((e) => frameEndpoints(e).map((v) => v.clone()))
    const paths = bundleEdges(
      ends.map(([a, b]) => [toVec(a), toVec(b)] as Segment)
    )
    group.forEach((e, i) => {
      const pts = paths[i].map((p) => new THREE.Vector3(...p))
      map.set(e.name, {
        a: ends[i][0],
        b: ends[i][1],
        // a smooth curve through the subdivision points
        path:
          pts.length > 2 ? new THREE.CatmullRomCurve3(pts).getPoints(32) : pts,
      })
    })
  }
  setBundles(kind, map)
}

// The former inter-layer edges of a single network draw through the intra
// strength, so they redraw with it.
const touchesInter = (kind: BundleKind): boolean =>
  kind === 'inter' || singleGraph()

export function redrawBundled(kind: BundleKind): void {
  if (kind === 'intra') redrawIntraLayerEdges()
  if (touchesInter(kind)) ctx.renderInterLayerEdgesFlag = true
}

function applyStrength(kind: BundleKind, strength: number): void {
  if (kind === 'intra') ctx.intraEdgeBundling = strength
  else ctx.interEdgeBundling = strength
  if (strength > 0 && bundlesStale(kind)) computeBundles(kind)
  else if (strength <= 0) clearBundle(kind) // free the paths; recomputed on demand
  if (touchesInter(kind)) redrawInterLayerEdges()
  redrawBundled(kind)
}

export class SetEdgeBundlingCommand implements Command {
  description: string
  constructor(
    private readonly kind: BundleKind,
    private readonly from: number,
    private readonly to: number
  ) {
    this.description = singleGraph()
      ? `Edge bundling ${to}`
      : `${kind === 'intra' ? 'Intra' : 'Inter'}-layer edge bundling ${to}`
  }
  execute(): void {
    applyStrength(this.kind, this.to)
  }
  undo(): void {
    applyStrength(this.kind, this.from)
  }
}

export function setEdgeBundling(kind: BundleKind, strength: number): void {
  const from = bundleStrength(kind)
  if (from === strength) return
  history.execute(new SetEdgeBundlingCommand(kind, from, strength))
}

// Session load / new network: drop old paths, and bundle again straight away
// if the session had bundling on.
export function resetBundles(): void {
  clearBundles()
  for (const kind of ['intra', 'inter'] as const)
    if (bundleStrength(kind) > 0 && ctx.edgeObjects.length > 0) {
      computeBundles(kind)
      if (touchesInter(kind)) redrawInterLayerEdges()
      redrawBundled(kind)
    }
}

// Nodes moved (layouts, drags, undo): recompute once they have settled.
export function initBundling(): void {
  onBundlesStale((kind) => {
    const wait = (): void => {
      const idle = msSinceBundleChange()
      if (idle < SETTLE_MS) {
        setTimeout(wait, SETTLE_MS - idle)
        return
      }
      if (bundleStrength(kind) <= 0 || ctx.edgeObjects.length === 0) {
        clearBundle(kind) // the other kind keeps its paths
        return
      }
      if (!bundlesStale(kind)) return // rebuilt meanwhile (a mode switch)
      computeBundles(kind)
      redrawBundled(kind)
    }
    setTimeout(wait, SETTLE_MS)
  })
  // A mode switch changes what bundles together and in which frame: drop
  // the paths and bundle again under the new mode. Inter-layer edges redraw
  // either way, bundled with the rest or straight again.
  bus.on('mode:changed', () => {
    resetBundles()
    ctx.renderInterLayerEdgesFlag = true
  })
}
