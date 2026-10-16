// Exploration tools — PLAN-ROADMAP Phase 7: k-hop neighbourhood expansion
// (within a layer or across layers), shortest paths that may hop layers,
// attribute search, and the edge weight filter.
//
// Graph walks use the scene registries directly: an edge links its two node
// indices; "across layers" also links copies of the same node name (the
// multiplex coupling), so a walk can change layer at any shared node.

import { ctx } from '../three'
import { redrawIntraLayerEdges } from './edge'
import {
  decideNodeLabelFlags,
  repaintNode,
  updateSelectedNodesStore,
} from './node'

export type WalkMode = 'within' | 'across'

function adjacency(mode: WalkMode): number[][] {
  const adj: number[][] = ctx.nodeObjects.map(() => [])
  for (const e of ctx.edgeObjects) {
    if (mode === 'within' && e.interLayer) continue
    adj[e.sourceNodeIndex].push(e.targetNodeIndex)
    adj[e.targetNodeIndex].push(e.sourceNodeIndex)
  }
  if (mode === 'across') {
    const copies = new Map<string, number[]>()
    ctx.nodeObjects.forEach((n, i) =>
      copies.set(n.name, [...(copies.get(n.name) ?? []), i])
    )
    for (const ids of copies.values())
      for (const a of ids) for (const b of ids) if (a !== b) adj[a].push(b)
  }
  return adj
}

function setSelected(indices: Iterable<number>): void {
  for (const i of indices) {
    if (ctx.nodeObjects[i].isSelected) continue
    ctx.nodeObjects[i].isSelected = true
    repaintNode(i)
  }
  decideNodeLabelFlags()
  updateSelectedNodesStore()
}

// Grow the current selection by `hops` steps. @return number of nodes added
export function expandSelection(hops: number, mode: WalkMode): number {
  const adj = adjacency(mode)
  let frontier = ctx.nodeObjects.flatMap((n, i) => (n.isSelected ? [i] : []))
  const seen = new Set(frontier)
  for (let h = 0; h < hops; h++) {
    const next: number[] = []
    for (const i of frontier)
      for (const j of adj[i])
        if (!seen.has(j)) {
          seen.add(j)
          next.push(j)
        }
    frontier = next
  }
  const added = seen.size - ctx.nodeObjects.filter((n) => n.isSelected).length
  setSelected(seen)
  return added
}

// Unweighted shortest path between node indices a and b (BFS).
export function shortestPath(
  a: number,
  b: number,
  mode: WalkMode
): number[] | null {
  const adj = adjacency(mode)
  const prev = new Map<number, number>([[a, a]])
  const queue = [a]
  while (queue.length) {
    const i = queue.shift()!
    if (i === b) break
    for (const j of adj[i])
      if (!prev.has(j)) {
        prev.set(j, i)
        queue.push(j)
      }
  }
  if (!prev.has(b)) return null
  const path = [b]
  while (path[0] !== a) path.unshift(prev.get(path[0])!)
  return path
}

// Path between the two selected nodes: select its nodes and edges (drawn in
// the selection colours). @return the path, or null if unreachable.
export function selectPathBetweenSelected(mode: WalkMode): number[] | null {
  const ends = ctx.nodeObjects.flatMap((n, i) => (n.isSelected ? [i] : []))
  if (ends.length !== 2) throw new Error('Select exactly two nodes.')
  const path = shortestPath(ends[0], ends[1], mode)
  if (!path) return null
  const steps = new Set(
    path.slice(1).map((j, k) => [path[k], j].sort((x, y) => x - y).join('-'))
  )
  for (const e of ctx.edgeObjects) {
    const key = [e.sourceNodeIndex, e.targetNodeIndex]
      .sort((x, y) => x - y)
      .join('-')
    if (steps.has(key)) e.select()
  }
  setSelected(path)
  redrawIntraLayerEdges()
  ctx.renderInterLayerEdgesFlag = true
  return path
}

// Select nodes whose description, annotations or URL contain `text`.
export function selectByAttribute(text: string): number {
  const q = text.trim().toLowerCase()
  if (!q) return 0
  const hits = ctx.nodeObjects.flatMap((n, i) =>
    [n.descr, n.url, ...n.annotations].some((v) => v?.toLowerCase().includes(q))
      ? [i]
      : []
  )
  setSelected(hits)
  return hits.length
}

export function setEdgeWeightThreshold(t: number): void {
  ctx.edgeWeightThreshold = t
  redrawIntraLayerEdges()
  ctx.renderInterLayerEdgesFlag = true
}

// Edges (or channels) currently hidden by the weight filter
export function edgesBelowThreshold(): number {
  return ctx.edgeObjects.reduce(
    (s, e) => s + e.weights.filter((w) => w < ctx.edgeWeightThreshold).length,
    0
  )
}
