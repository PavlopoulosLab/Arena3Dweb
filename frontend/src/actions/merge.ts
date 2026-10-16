// Databases → Import as "new layer(s)": the fetched network joins the loaded
// one as extra layers, and every copy of a node already present in another
// layer gets an inter-layer edge to it (as the database comparison does).
// Pure data merge; the panel reloads the result and restores the transforms.

import type { EdgeModel, NetworkData, NodeModel } from '../api/client'

export const LINK_CHANNEL = 'same node'
const MAX_CHANNELS = 9

export interface MergeResult {
  network: NetworkData
  layers: string[] // the names the new layers got
  links: number // inter-layer edges to copies in the loaded network
}

// Edges without channels: one edge per pair, the heaviest channel wins
function stripChannels(edges: EdgeModel[]): EdgeModel[] {
  const best = new Map<string, EdgeModel>()
  for (const e of edges) {
    const key = `${e.src}\u0000${e.trg}`
    const seen = best.get(key)
    if (!seen || e.weight > seen.weight) best.set(key, { ...e, channel: null })
  }
  return [...best.values()]
}

export function mergeAsLayers(
  current: NetworkData,
  incoming: NetworkData
): MergeResult {
  // new layer names must not clash with the loaded ones
  const taken = new Set(current.layers)
  const rename = new Map<string, string>()
  for (const name of incoming.layers) {
    let candidate = name
    for (let k = 2; taken.has(candidate); k++) candidate = `${name} (${k})`
    taken.add(candidate)
    rename.set(name, candidate)
  }
  const layerOf = (l: string) => rename.get(l) ?? l
  const id = (label: string, layer: string) => `${label}_${layer}`

  const nodes: NodeModel[] = incoming.nodes.map((n) => ({
    id: id(n.label, layerOf(n.layer)),
    label: n.label,
    layer: layerOf(n.layer),
  }))
  let edges: EdgeModel[] = incoming.edges.map((e) => ({
    ...e,
    src: id(e.source_node, layerOf(e.source_layer)),
    trg: id(e.target_node, layerOf(e.target_layer)),
    source_layer: layerOf(e.source_layer),
    target_layer: layerOf(e.target_layer),
  }))

  // channels are all-or-nothing in a network: drop them from the side that
  // would mix channel and plain edges
  let currentEdges = current.edges
  let channels = [...new Set([...current.channels, ...incoming.channels])]
  if (current.channels.length === 0 && incoming.channels.length > 0) {
    edges = stripChannels(edges)
    channels = []
  } else if (current.channels.length > 0 && incoming.channels.length === 0) {
    currentEdges = stripChannels(currentEdges)
    channels = []
  }

  // link each new node to the copies of the same node in the loaded layers
  const copies = new Map<string, NodeModel[]>()
  for (const n of current.nodes) {
    const list = copies.get(n.label) ?? []
    list.push(n)
    copies.set(n.label, list)
  }
  const links: EdgeModel[] = []
  for (const n of nodes)
    for (const copy of copies.get(n.label) ?? [])
      links.push({
        src: copy.id,
        trg: n.id,
        source_node: copy.label,
        source_layer: copy.layer,
        target_node: n.label,
        target_layer: n.layer,
        weight: 1,
        scaled_weight: 1,
        channel: null,
      })
  if (channels.length > 0 && links.length > 0) {
    if (channels.includes(LINK_CHANNEL) || channels.length < MAX_CHANNELS) {
      if (!channels.includes(LINK_CHANNEL)) channels.push(LINK_CHANNEL)
      for (const l of links) l.channel = LINK_CHANNEL
    } else {
      // no room for a link channel: the whole network goes channel-less
      currentEdges = stripChannels(currentEdges)
      edges = stripChannels(edges)
      channels = []
    }
  }

  const warnings = [...current.warnings, ...incoming.warnings]
  return {
    network: {
      layers: [...current.layers, ...incoming.layers.map(layerOf)],
      channels,
      nodes: [...current.nodes, ...nodes],
      edges: [...currentEdges, ...edges, ...links],
      warnings,
    },
    layers: incoming.layers.map(layerOf),
    links: links.length,
  }
}
