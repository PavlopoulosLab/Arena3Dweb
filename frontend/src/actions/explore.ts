// Exploration tools — PLAN-ROADMAP Phase 7: k-hop neighbourhood expansion
// (within a layer or across layers), shortest paths that may hop layers,
// attribute search, and the edge weight filter; also whole-selection tools
// (all / invert / clear, connected components, the selected layers' nodes,
// hubs) and a live highlight of the paths joining the selected nodes.
//
// Graph walks use the scene registries directly: an edge links its two node
// indices; "across layers" also links copies of the same node name (the
// multiplex coupling), so a walk can change layer at any shared node.

import { ctx, type Edge, type Node } from '../three'
import { redrawIntraLayerEdges, unselectAllEdges } from './edge'
import {
  decideNodeLabelFlags,
  repaintNode,
  selectAllNodes,
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
  for (let h = 0; h < hops && frontier.length; h++) {
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

// Every node connected to the selection (its connected components, in the
// walk mode). @return number of nodes added
export const selectComponents = (mode: WalkMode): number =>
  expandSelection(Infinity, mode)

export function selectAll(): void {
  selectAllNodes(true)
}

// Selected nodes become unselected and the rest selected. @return selected
export function invertSelection(): number {
  ctx.nodeObjects.forEach((n, i) => {
    n.isSelected = !n.isSelected
    repaintNode(i)
  })
  decideNodeLabelFlags()
  updateSelectedNodesStore()
  return ctx.nodeObjects.filter((n) => n.isSelected).length
}

// Nothing selected: nodes, edges and highlighted paths
export function clearSelection(): void {
  forgetPathHighlight()
  selectAllNodes(false)
  unselectAllEdges()
}

// Every node on the selected layers (multilayered view). @return nodes added
export function selectNodesOfSelectedLayers(): number {
  const layers = new Set(
    ctx.layers.filter((l) => l.isSelected).map((l) => l.name)
  )
  if (!layers.size)
    throw new Error('Select a layer first (double-click its floor).')
  const hits = ctx.nodeObjects.flatMap((n, i) =>
    layers.has(n.layer) && !n.isSelected ? [i] : []
  )
  setSelected(hits)
  return hits.length
}

// Hubs: nodes with at least `min` links — within their layer, or counting
// inter-layer links too. @return number of such nodes
export function selectByLinks(min: number, mode: WalkMode): number {
  const links = ctx.nodeObjects.map(() => 0)
  for (const e of ctx.edgeObjects) {
    if (mode === 'within' && e.interLayer) continue
    links[e.sourceNodeIndex]++
    links[e.targetNodeIndex]++
  }
  const hits = links.flatMap((k, i) => (k >= min ? [i] : []))
  setSelected(hits)
  return hits.length
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

// Live path highlight: the shortest paths joining every pair of selected
// nodes, their edges drawn in the selection colour and, optionally, the nodes
// along them selected too. What the highlight added is remembered (as
// objects, so a reloaded network can't be mistaken for it) and taken back
// before each update, so its own nodes never count as path ends and edges or
// nodes the user selected stay put.
export const MAX_PATH_ENDS = 25
const pathEdges = new Set<Edge>()
const pathNodes = new Set<Node>()

export interface PathHighlight {
  ends: number // selected nodes the paths join
  pairs: number // pairs of them
  joined: number // pairs a path joins
  edges: number // edges highlighted
  nodes: number // nodes the paths added to the selection
}

// Take back what the highlight added. @return whether anything changed
function takeBackPathHighlight(): boolean {
  const changed = pathEdges.size > 0 || pathNodes.size > 0
  for (const e of pathEdges) e.deselect()
  if (pathNodes.size) {
    const index = new Map(ctx.nodeObjects.map((n, i) => [n, i]))
    for (const n of pathNodes) {
      const i = index.get(n)
      if (i === undefined || !n.isSelected) continue
      n.isSelected = false
      repaintNode(i)
    }
  }
  pathEdges.clear()
  pathNodes.clear()
  return changed
}

function redrawEdges(): void {
  redrawIntraLayerEdges()
  ctx.renderInterLayerEdgesFlag = true
}

// The highlight switched off: take everything back
export function clearPathHighlight(): void {
  const hadNodes = pathNodes.size > 0
  if (!takeBackPathHighlight()) return
  if (hadNodes) {
    decideNodeLabelFlags()
    updateSelectedNodesStore()
  }
  redrawEdges()
}

// Forget the highlight without touching the scene (cleared or replaced)
export function forgetPathHighlight(): void {
  pathEdges.clear()
  pathNodes.clear()
}

// Highlight the paths between the selected nodes (at most MAX_PATH_ENDS of
// them; one BFS per end). Throws when more are selected.
export function highlightPathsBetweenSelected(
  mode: WalkMode,
  selectNodes: boolean
): PathHighlight {
  const hadNodes = pathNodes.size > 0
  takeBackPathHighlight()
  const ends = ctx.nodeObjects.flatMap((n, i) => (n.isSelected ? [i] : []))
  const result: PathHighlight = {
    ends: ends.length,
    pairs: (ends.length * (ends.length - 1)) / 2,
    joined: 0,
    edges: 0,
    nodes: 0,
  }
  const finish = () => {
    if (hadNodes || result.nodes) {
      decideNodeLabelFlags()
      updateSelectedNodesStore()
    }
    redrawEdges()
    return result
  }
  if (ends.length > MAX_PATH_ENDS) {
    finish()
    throw new Error(
      `Paths are highlighted between at most ${MAX_PATH_ENDS} selected nodes (${ends.length} are selected).`
    )
  }
  if (ends.length < 2) return finish()

  const adj = adjacency(mode)
  const isEnd = new Set(ends)
  const steps = new Set<string>()
  const along = new Set<number>()
  ends.forEach((a, k) => {
    // BFS from a reaches every later end it can
    const prev = new Map<number, number>([[a, a]])
    const queue = [a]
    for (let q = 0; q < queue.length; q++)
      for (const j of adj[queue[q]])
        if (!prev.has(j)) {
          prev.set(j, queue[q])
          queue.push(j)
        }
    for (const b of ends.slice(k + 1)) {
      if (!prev.has(b)) continue
      result.joined++
      for (let i = b; i !== a; i = prev.get(i)!) {
        const p = prev.get(i)!
        steps.add(p < i ? `${p}-${i}` : `${i}-${p}`)
        if (!isEnd.has(p)) along.add(p)
      }
    }
  })
  for (const e of ctx.edgeObjects) {
    const [s, t] = [e.sourceNodeIndex, e.targetNodeIndex]
    if (!steps.has(s < t ? `${s}-${t}` : `${t}-${s}`)) continue
    result.edges++
    if (e.isSelected) continue // the user's own: left as it is
    e.select()
    pathEdges.add(e)
  }
  if (selectNodes)
    for (const i of along) {
      const n = ctx.nodeObjects[i]
      if (n.isSelected) continue
      n.isSelected = true
      repaintNode(i)
      pathNodes.add(n)
    }
  result.nodes = pathNodes.size
  return finish()
}
