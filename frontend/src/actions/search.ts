// Node search (NORMA-style) and camera focus — PLAN-ROADMAP Phase 23.
// Modes: contains, exact, prefix, suffix, regular expression; several
// comma-separated terms (except regex). Focus pans + zooms the scene so the
// matches fill the view, animated, as one undoable step.

import * as THREE from 'three'
import { clampScale, ctx } from '../three'
import { history } from '../commands/base'
import { TransformCommand, captureTransforms } from '../commands/scene'
import { registerAnimateHook } from './screen'
import {
  decideNodeLabelFlags,
  repaintNode,
  updateSelectedNodesStore,
} from './node'

export type SearchMode = 'contains' | 'exact' | 'prefix' | 'suffix' | 'regex'

export class SearchError extends Error {}

export function nodeMatcher(
  query: string,
  mode: SearchMode,
  caseSensitive = false
): (name: string) => boolean {
  if (mode === 'regex') {
    let re: RegExp
    try {
      re = new RegExp(query.trim(), caseSensitive ? '' : 'i')
    } catch (err) {
      throw new SearchError(
        `Invalid regular expression: ${(err as Error).message}`
      )
    }
    return (name) => re.test(name)
  }
  const fold = (s: string) => (caseSensitive ? s : s.toLowerCase())
  const terms = query
    .split(',')
    .map((t) => fold(t.trim()))
    .filter(Boolean)
  const test = {
    contains: (n: string, t: string) => n.includes(t),
    exact: (n: string, t: string) => n === t,
    prefix: (n: string, t: string) => n.startsWith(t),
    suffix: (n: string, t: string) => n.endsWith(t),
  }[mode]
  return (name) => terms.some((t) => test(fold(name), t))
}

export type EdgeField = 'any' | 'source' | 'target' | 'both' | 'channel'

// Edge indexes whose end names (or channel) match.
export function findEdges(
  query: string,
  field: EdgeField,
  mode: SearchMode,
  caseSensitive = false
): number[] {
  if (!query.trim()) return []
  const match = nodeMatcher(query, mode, caseSensitive)
  const name = (i: number) => ctx.nodeObjects[i]?.name ?? ''
  return ctx.edgeObjects.flatMap((e, i) => {
    const s = name(e.sourceNodeIndex)
    const t = name(e.targetNodeIndex)
    const hit =
      field === 'source'
        ? match(s)
        : field === 'target'
          ? match(t)
          : field === 'both'
            ? match(s) && match(t)
            : field === 'channel'
              ? e.channels.some(match)
              : match(s) || match(t)
    return hit ? [i] : []
  })
}

export function selectEdges(indices: number[], replace: boolean): void {
  const keep = new Set(indices)
  let changed = false
  ctx.edgeObjects.forEach((e, i) => {
    const sel = keep.has(i) || (!replace && e.isSelected)
    if (sel === e.isSelected) return
    if (sel) e.select()
    else e.deselect()
    e.redrawEdge()
    changed = true
  })
  if (changed) ctx.renderInterLayerEdgesFlag = true
}

// Node indexes whose name matches.
export function findNodes(
  query: string,
  mode: SearchMode,
  caseSensitive = false
): number[] {
  if (!query.trim()) return []
  const match = nodeMatcher(query, mode, caseSensitive)
  return ctx.nodeObjects.flatMap((n, i) => (match(n.name) ? [i] : []))
}

export function selectNodes(indices: number[], replace: boolean): void {
  const keep = new Set(indices)
  ctx.nodeObjects.forEach((n, i) => {
    const sel = keep.has(i) || (!replace && n.isSelected)
    if (sel !== n.isSelected) {
      n.isSelected = sel
      repaintNode(i)
    }
  })
  decideNodeLabelFlags()
  updateSelectedNodesStore()
}

// ---------------------------------------------------------------- focus
const FOCUS_MS = 350 // time-based, so slow frames do not stretch it
let anim: {
  from: [number, number, number]
  to: [number, number, number]
  start: number
  done: () => void
} | null = null

registerAnimateHook(() => {
  if (!anim || !ctx.scene?.exists()) return
  const t = Math.min(1, (performance.now() - anim.start) / FOCUS_MS)
  const e = t * t * (3 - 2 * t) // smoothstep
  const [x0, y0, s0] = anim.from
  const [x1, y1, s1] = anim.to
  ctx.scene.setPosition('x', x0 + (x1 - x0) * e)
  ctx.scene.setPosition('y', y0 + (y1 - y0) * e)
  ctx.scene.setScale(s0 + (s1 - s0) * e)
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderLayerLabelsFlag = true
  ctx.renderNodeLabelsFlag = true
  if (t >= 1) {
    const done = anim.done
    anim = null
    done()
  }
})

// Pan/zoom target that centres the nodes and fits them in the view.
// World = pan + scale * v, so with v = (world - pan) / scale the target pan
// for scale s is -s * centre(v).
export function focusTarget(
  indices: number[]
): [number, number, number] | null {
  const scene = ctx.scene
  if (!scene?.exists() || indices.length === 0) return null
  scene.THREE_Object.updateMatrixWorld(true)
  const s = scene.getScale()
  const px = scene.getPosition('x')
  const py = scene.getPosition('y')
  const vs = indices.map((i) => {
    const w = ctx.nodeObjects[i].getWorldPosition()
    return [(w.x - px) / s, (w.y - py) / s]
  })
  const xs = vs.map((v) => v[0])
  const ys = vs.map((v) => v[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2
  const spanX = Math.max(...xs) - Math.min(...xs)
  const spanY = Math.max(...ys) - Math.min(...ys)
  const fit = Math.min(
    spanX > 0 ? (1.6 * ctx.xBoundMax) / spanX : Infinity,
    spanY > 0 ? (1.6 * ctx.yBoundMax) / spanY : Infinity
  )
  // one node (or a tight group): zoom in, but never out from the current view
  const target = Math.min(6, Number.isFinite(fit) ? fit : Math.max(s * 1.5, 2))
  return [-target * cx, -target * cy, target]
}

// Jump a running focus to its end (and record it), so a new focus starts
// from a settled view and each focus is its own clean undo step.
function settle(): void {
  if (!anim || !ctx.scene) return
  const { to, done } = anim
  anim = null
  ctx.scene.setPosition('x', to[0])
  ctx.scene.setPosition('y', to[1])
  ctx.scene.setScale(to[2])
  done()
}

// Pan/zoom target that brings the whole network — every visible floor and
// node — into the window, centred, with a margin: the double-click on the
// background and Recenter Network.
export function fitTarget(): [number, number, number] | null {
  const scene = ctx.scene
  if (!scene?.exists() || ctx.nodeObjects.length === 0) return null
  scene.THREE_Object.updateMatrixWorld(true)
  const box = new THREE.Box3()
  for (const n of ctx.nodeObjects)
    if (n.sphere.visible) box.expandByPoint(n.getWorldPosition())
  // the layer names too (a hive plot's sit beyond its axes' ends)
  for (const l of ctx.layers)
    if (l.sphere && l.plane.visible)
      box.expandByPoint(l.sphere.getWorldPosition(new THREE.Vector3()))
  const floor = new THREE.Box3()
  for (const l of ctx.layers) {
    const plane = l.plane
    if (!plane.visible || !(plane.material as THREE.Material).visible) continue
    if (!plane.geometry.boundingBox) plane.geometry.computeBoundingBox()
    floor.copy(plane.geometry.boundingBox!).applyMatrix4(plane.matrixWorld)
    box.union(floor)
  }
  if (box.isEmpty()) return null
  const s = scene.getScale()
  const px = scene.getPosition('x')
  const py = scene.getPosition('y')
  // to pan-space: world = pan + s * v
  const x0 = (box.min.x - px) / s
  const x1 = (box.max.x - px) / s
  const y0 = (box.min.y - py) / s
  const y1 = (box.max.y - py) / s
  const fit = Math.min(
    x1 > x0 ? (1.7 * ctx.xBoundMax) / (x1 - x0) : Infinity,
    y1 > y0 ? (1.7 * ctx.yBoundMax) / (y1 - y0) : Infinity
  )
  const target = clampScale(Number.isFinite(fit) ? fit : 1)
  return [(-target * (x0 + x1)) / 2, (-target * (y0 + y1)) / 2, target]
}

// Animate pan + scale to a target as one undoable step; false when there is
// nothing to do (no target, or the view is already there).
function flyTo(
  to: [number, number, number] | null,
  label: string,
  animate: boolean
): boolean {
  settle()
  if (!to || !ctx.scene) return false
  const before = captureTransforms()
  const from: [number, number, number] = [
    ctx.scene.getPosition('x'),
    ctx.scene.getPosition('y'),
    ctx.scene.getScale(),
  ]
  if (from.every((v, i) => Math.abs(v - to[i]) < 1e-6)) return false
  const commit = () =>
    history.execute(new TransformCommand(label, before, captureTransforms()))
  anim = { from, to, start: performance.now(), done: commit }
  if (!animate) settle()
  return true
}

export function focusOnNodes(indices: number[], animate = true): boolean {
  return flyTo(focusTarget(indices), 'Focus on nodes', animate)
}

export function fitView(animate = true): boolean {
  return flyTo(fitTarget(), 'Fit network to view', animate)
}

// The same fit at once and without an undo step of its own, for a command
// that already records the view (layer arrangements: one undo takes both
// back). `margin` < 1 leaves room around the network.
export function fitViewNow(margin = 1): void {
  settle()
  const t = fitTarget()
  if (!t || !ctx.scene) return
  ctx.scene.setPosition('x', t[0] * margin)
  ctx.scene.setPosition('y', t[1] * margin)
  ctx.scene.setScale(clampScale(t[2] * margin))
}
