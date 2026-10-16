// Layer restructuring — PLAN-ROADMAP Phase 4 ("split a layer by cluster") and
// Phase 16 ("merge layers"). Both are pure NetworkData -> NetworkData
// transforms; the caller reloads the result as one undoable network load.
// Node ids follow the parser's `${label}_${layer}` convention.

import type { EdgeModel, NetworkData, NodeModel } from '../api/client'

export class RestructureError extends Error {}

const nodeId = (label: string, layer: string) => `${label}_${layer}`

// Rebuild a network after moving nodes between layers. `layerOf(node)` gives
// each node's new layer; nodes that land on the same (label, layer) merge.
// Edges whose two ends become the same node (coupling edges between merged
// copies) are dropped, and duplicate edges keep their first row.
function relayer(
  net: NetworkData,
  layerOf: (n: NodeModel) => string,
  layers: string[],
  maxLayers: number
): NetworkData {
  if (layers.length > maxLayers)
    throw new RestructureError(
      `That would make ${layers.length} layers; the limit is ${maxLayers}.`
    )
  const newLayer = new Map(net.nodes.map((n) => [n.id, layerOf(n)]))
  const nodes = new Map<string, NodeModel>()
  for (const n of net.nodes) {
    const layer = newLayer.get(n.id)!
    const id = nodeId(n.label, layer)
    if (!nodes.has(id)) nodes.set(id, { id, label: n.label, layer })
  }
  const edges: EdgeModel[] = []
  const seen = new Set<string>()
  for (const e of net.edges) {
    const sl = newLayer.get(e.src) ?? e.source_layer
    const tl = newLayer.get(e.trg) ?? e.target_layer
    const src = nodeId(e.source_node, sl)
    const trg = nodeId(e.target_node, tl)
    if (src === trg) continue
    const key = `${src}\t${trg}\t${e.channel ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push({ ...e, src, trg, source_layer: sl, target_layer: tl })
  }
  return { ...net, nodes: [...nodes.values()], edges, layers }
}

// NORMA "Groups on stacked layers": each cluster of `layer` becomes its own
// layer (named `layer · C<id>`); edges between clusters become inter-layer
// edges. `clusterOf` maps Node_Layer id -> cluster id (from a clustered layout).
export function splitLayerByCluster(
  net: NetworkData,
  layer: string,
  clusterOf: Record<string, string>,
  maxLayers: number
): NetworkData {
  const members = net.nodes.filter((n) => n.layer === layer)
  const clusters = [
    ...new Set(members.map((n) => clusterOf[n.id]).filter((c) => c !== '')),
  ].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
  if (members.length === 0)
    throw new RestructureError(`Layer ${layer} has no nodes.`)
  if (clusters.length === 0 || members.some((n) => !clusterOf[n.id]))
    throw new RestructureError(
      `Run a layout with clustering on ${layer} first, so every node has a cluster.`
    )
  if (clusters.length < 2)
    throw new RestructureError(
      `${layer} has a single cluster — nothing to split.`
    )
  const name = (c: string) => `${layer} · C${c}`
  const layers = net.layers.flatMap((l) =>
    l === layer ? clusters.map(name) : [l]
  )
  return relayer(
    net,
    (n) => (n.layer === layer ? name(clusterOf[n.id]) : n.layer),
    layers,
    maxLayers
  )
}

// NORMA's super nodes as a network: nodes with a group collapse into one node
// per (group, layer), labelled with the group; ungrouped nodes stay. Edges
// between two members of one super node disappear, parallel edges between
// super nodes are summed into one whose weight is the number of member edges.
export function collapseGroups(
  net: NetworkData,
  groupOf: Record<string, string | null | undefined>
): NetworkData {
  const label = (n: NodeModel) => groupOf[n.id] ?? n.label
  const idOf = new Map(net.nodes.map((n) => [n.id, nodeId(label(n), n.layer)]))
  if (![...idOf.values()].some((id, i) => id !== net.nodes[i].id))
    throw new RestructureError('No node belongs to a group yet.')
  const nodes = new Map<string, NodeModel>()
  for (const n of net.nodes) {
    const id = idOf.get(n.id)!
    if (!nodes.has(id)) nodes.set(id, { id, label: label(n), layer: n.layer })
  }
  const edges = new Map<string, EdgeModel & { count: number }>()
  for (const e of net.edges) {
    const src = idOf.get(e.src) ?? e.src
    const trg = idOf.get(e.trg) ?? e.trg
    if (src === trg) continue
    const [a, b] = src < trg ? [src, trg] : [trg, src]
    const key = `${a}\t${b}\t${e.channel ?? ''}`
    const prev = edges.get(key)
    if (prev) prev.count++
    else
      edges.set(key, {
        ...e,
        src,
        trg,
        source_node: nodes.get(src)!.label,
        target_node: nodes.get(trg)!.label,
        count: 1,
      })
  }
  const max = Math.max(1, ...[...edges.values()].map((e) => e.count))
  return {
    ...net,
    nodes: [...nodes.values()],
    edges: [...edges.values()].map(({ count, ...e }) => ({
      ...e,
      weight: count,
      scaled_weight: 0.1 + (0.9 * count) / max,
    })),
  }
}

// Flatten `merge` layers into one named `into` (placed where the first merged
// layer was). Copies of the same node collapse into one; links between them
// disappear.
export function mergeLayers(
  net: NetworkData,
  merge: string[],
  into: string,
  maxLayers: number
): NetworkData {
  const chosen = new Set(merge)
  if (chosen.size < 2)
    throw new RestructureError('Select at least two layers to merge.')
  if (net.layers.some((l) => l === into && !chosen.has(l)))
    throw new RestructureError(`A layer named ${into} already exists.`)
  const first = net.layers.findIndex((l) => chosen.has(l))
  const layers = net.layers.filter((l, i) => i === first || !chosen.has(l))
  layers[layers.indexOf(net.layers[first])] = into
  return relayer(
    net,
    (n) => (chosen.has(n.layer) ? into : n.layer),
    layers,
    maxLayers
  )
}
