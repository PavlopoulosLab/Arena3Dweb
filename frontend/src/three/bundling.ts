// Edge bundling state, read by Edge.drawEdge. Bundled paths (three/fdeb.ts,
// computed by actions/bundling.ts) are cached at full strength in a frame
// that the camera does not move: layer-local for intra-layer edges, the
// scene sphere's local frame for inter-layer ones. Drawing only blends each
// cached path with the straight edge by the slider strength, so rotating,
// panning and zooming cost nothing extra. When nodes move, the cached path
// is stretched to the new endpoints and a recompute is requested once the
// scene has settled.

import * as THREE from 'three'
import { ctx } from './runtime'
import type { Edge } from './Edge'

export type BundleKind = 'intra' | 'inter'

export interface Bundle {
  a: THREE.Vector3 // endpoints when the path was computed (frame-local)
  b: THREE.Vector3
  path: THREE.Vector3[] // full-strength path, endpoints included
}

const bundles: Record<BundleKind, Map<string, Bundle>> = {
  intra: new Map(),
  inter: new Map(),
}
const stale: Record<BundleKind, boolean> = { intra: true, inter: true }
// a recompute has been requested and not yet run
const pending: Record<BundleKind, boolean> = { intra: false, inter: false }
let lastChange = 0
let scheduler: ((kind: BundleKind) => void) | null = null

// Single-network mode (actions/modes.ts) stacks every layer on one
// transform, so the graph is one space: every edge bundles as 'intra', in
// one set, and the inter-layer kind stands empty until the layers return.
export const singleGraph = (): boolean => ctx.networkMode === 'single'

export const kindOf = (edge: Edge): BundleKind =>
  edge.interLayer && !singleGraph() ? 'inter' : 'intra'

export const bundleStrength = (kind: BundleKind): number =>
  kind === 'intra' ? ctx.intraEdgeBundling : ctx.interEdgeBundling

export function onBundlesStale(fn: (kind: BundleKind) => void): void {
  scheduler = fn
}

export const bundlesStale = (kind: BundleKind) => stale[kind]
export const msSinceBundleChange = () => performance.now() - lastChange

export function setBundles(kind: BundleKind, map: Map<string, Bundle>): void {
  bundles[kind] = map
  stale[kind] = false
  pending[kind] = false
}

export function clearBundle(kind: BundleKind): void {
  bundles[kind] = new Map()
  stale[kind] = true
  pending[kind] = false
}

export function clearBundles(): void {
  for (const kind of ['intra', 'inter'] as const) clearBundle(kind)
}

function markStale(kind: BundleKind): void {
  lastChange = performance.now()
  stale[kind] = true
  if (pending[kind] || !scheduler) return
  pending[kind] = true
  scheduler(kind)
}

// The edge's endpoints in the frame its bundle lives in: layer-local for
// intra-layer edges (and for every edge of a single network, whose stacked
// layers share one frame), the scene sphere's for inter-layer edges.
export function frameEndpoints(edge: Edge): [THREE.Vector3, THREE.Vector3] {
  const src = ctx.nodeObjects[edge.sourceNodeIndex]
  const trg = ctx.nodeObjects[edge.targetNodeIndex]
  if (!edge.interLayer || singleGraph())
    return [src.getPosition(), trg.getPosition()]
  const frame = ctx.scene!.sphere!
  return [
    frame.worldToLocal(src.getWorldPosition()),
    frame.worldToLocal(trg.getWorldPosition()),
  ]
}

/** The edge's polyline at the current strength, or null for a straight line. */
export function bundledPoints(edge: Edge): THREE.Vector3[] | null {
  const kind = kindOf(edge)
  const s = bundleStrength(kind)
  if (s <= 0 || !ctx.scene?.sphere) return null
  const b = bundles[kind].get(edge.name)
  if (!b) {
    markStale(kind)
    return null
  }
  if (b.path.length <= 2) return null
  const [A, B] = frameEndpoints(edge)
  const da = A.clone().sub(b.a)
  const db = B.clone().sub(b.b)
  if (Math.max(da.length(), db.length()) > 1e-3 * (b.a.distanceTo(b.b) + 1))
    markStale(kind)
  const n = b.path.length - 1
  const out = b.path.map((p, k) => {
    const t = k / n
    const deformed = p
      .clone()
      .addScaledVector(da, 1 - t)
      .addScaledVector(db, t)
    return A.clone().lerp(B, t).lerp(deformed, s)
  })
  // inter-layer edges are drawn in world space: out of the bundle's frame
  if (edge.interLayer) {
    const frame = singleGraph()
      ? ctx.layers[edge.sourceLayerIndex].plane
      : ctx.scene.sphere
    frame.updateWorldMatrix(true, false)
    for (const p of out) frame.localToWorld(p)
  }
  return out
}
