// Import as (popup) → "New layer(s)": the fetched network joins the loaded
// one as extra layers, and every copy of a node already present in another
// layer gets an inter-layer edge to it (as the database comparison does).
// Pure data merge; the panel reloads the result and restores the transforms.

import type { EdgeModel, NetworkData, NodeModel } from '../api/client'

export const LINK_CHANNEL = 'same node'
const MAX_CHANNELS = 10 // backend config.MAX_CHANNELS

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

// `link` = false leaves copies of a node unlinked (Import as popup)
export function mergeAsLayers(
  current: NetworkData,
  incoming: NetworkData,
  link = true
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
  if (link)
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

export interface ExpandResult {
  network: NetworkData
  added: string[] // ids of the nodes that were not there yet
  edges: number // edges that were not there yet
}

// Import as → "Expand the existing view" (a single 3D network): the fetched
// network joins the loaded graph itself. A node whose name is already there is
// that node — no copies, no links — and new nodes join the first layer.
export function expandNetwork(
  current: NetworkData,
  incoming: NetworkData
): ExpandResult {
  const target = current.layers[0]
  const known = new Map<string, NodeModel>()
  for (const n of current.nodes) if (!known.has(n.label)) known.set(n.label, n)
  const added: NodeModel[] = []
  const nodeOf = (label: string): NodeModel => {
    let n = known.get(label)
    if (!n) {
      n = { id: `${label}_${target}`, label, layer: target }
      known.set(label, n)
      added.push(n)
    }
    return n
  }
  for (const n of incoming.nodes) nodeOf(n.label)

  let currentEdges = current.edges
  let edges: EdgeModel[] = incoming.edges.map((e) => {
    const s = nodeOf(e.source_node)
    const t = nodeOf(e.target_node)
    return {
      ...e,
      src: s.id,
      trg: t.id,
      source_layer: s.layer,
      target_layer: t.layer,
    }
  })
  // channels are all-or-nothing, as when adding layers
  let channels = [...new Set([...current.channels, ...incoming.channels])]
  if (
    channels.length > MAX_CHANNELS ||
    (current.channels.length === 0) !== (incoming.channels.length === 0)
  ) {
    currentEdges = stripChannels(currentEdges)
    edges = stripChannels(edges)
    channels = []
  }
  // an edge already drawn (either way round, same channel) is not added again
  const key = (a: string, b: string, c: string | null | undefined) =>
    `${a}\u0000${b}\u0000${c ?? ''}`
  const seen = new Set(currentEdges.map((e) => key(e.src, e.trg, e.channel)))
  const fresh = edges.filter((e) => {
    if (
      seen.has(key(e.src, e.trg, e.channel)) ||
      seen.has(key(e.trg, e.src, e.channel))
    )
      return false
    seen.add(key(e.src, e.trg, e.channel))
    return true
  })
  return {
    network: {
      layers: current.layers,
      channels,
      nodes: [...current.nodes, ...added],
      edges: [...currentEdges, ...fresh],
      warnings: [...current.warnings, ...incoming.warnings],
    },
    added: added.map((n) => n.id),
    edges: fresh.length,
  }
}

// A link between copies of a node: an inter-layer edge joining one name
const isSameNameLink = (e: EdgeModel) =>
  e.source_layer !== e.target_layer && e.source_node === e.target_node

// Import as → "Link nodes with the same name across layers": every name in
// several layers gets inter-layer edges between its copies in consecutive
// layers (in layer order), unless those copies are already joined.
export function linkSameNames(net: NetworkData): {
  network: NetworkData
  links: number
} {
  const order = new Map(net.layers.map((l, i) => [l, i]))
  const copies = new Map<string, NodeModel[]>()
  for (const n of net.nodes)
    copies.set(n.label, [...(copies.get(n.label) ?? []), n])
  const joined = new Set(
    net.edges.flatMap((e) => [
      `${e.src}\u0000${e.trg}`,
      `${e.trg}\u0000${e.src}`,
    ])
  )
  const withChannels = net.channels.length > 0
  if (
    withChannels &&
    !net.channels.includes(LINK_CHANNEL) &&
    net.channels.length >= MAX_CHANNELS
  )
    return {
      network: {
        ...net,
        warnings: [
          ...net.warnings,
          `No room for a “${LINK_CHANNEL}” channel (${MAX_CHANNELS} at most): copies of a node were not linked.`,
        ],
      },
      links: 0,
    }
  const links: EdgeModel[] = []
  for (const list of copies.values()) {
    if (list.length < 2) continue
    const sorted = [...list].sort(
      (a, b) => (order.get(a.layer) ?? 0) - (order.get(b.layer) ?? 0)
    )
    for (let k = 1; k < sorted.length; k++) {
      const [a, b] = [sorted[k - 1], sorted[k]]
      if (a.layer === b.layer || joined.has(`${a.id}\u0000${b.id}`)) continue
      links.push({
        src: a.id,
        trg: b.id,
        source_node: a.label,
        source_layer: a.layer,
        target_node: b.label,
        target_layer: b.layer,
        weight: 1,
        scaled_weight: 1,
        channel: withChannels ? LINK_CHANNEL : null,
      })
    }
  }
  const channels =
    withChannels && links.length > 0 && !net.channels.includes(LINK_CHANNEL)
      ? [...net.channels, LINK_CHANNEL]
      : net.channels
  return {
    network: { ...net, channels, edges: [...net.edges, ...links] },
    links: links.length,
  }
}

// The opposite, for importers that link copies themselves (Reactome, Gene
// Ontology, Compare databases) when the user asked for no links.
export function unlinkSameNames(net: NetworkData): {
  network: NetworkData
  links: number
} {
  const edges = net.edges.filter((e) => !isSameNameLink(e))
  const used = new Set(edges.map((e) => e.channel))
  return {
    network: {
      ...net,
      edges,
      channels: net.channels.filter((c) => used.has(c)),
    },
    links: net.edges.length - edges.length,
  }
}
