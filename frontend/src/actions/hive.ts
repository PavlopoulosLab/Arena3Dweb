// Hive plot positions (Krzywinski et al. 2012, "Hive plots — rational approach
// to visualizing networks"): in the multilayered view every layer is an axis,
// and a node's place on its axis comes from a structural property instead of
// an aesthetic layout — degree (the paper's default), betweenness, clustering
// coefficient, or its name. Scales: each axis full length (value ÷ that axis's
// maximum, "absolute connectivity with normalized axis length", the paper's
// most revealing variant), one scale for all axes (value ÷ overall maximum),
// or rank (even spacing in value order).

import { api, type TopologyRequest } from '../api/client'
import { store } from '../store'

export type HiveProperty = 'degree' | 'betweenness' | 'clustering' | 'name'
export type HiveScale = 'axis' | 'shared' | 'rank'

// a hive plot fills less of the window than other views (actions/search.ts
// fitView), so the axes' ends and names stay clear of the top bar
export const HIVE_FIT = 0.8

export interface HiveInput {
  // Node_Layer id -> place on its axis, 0 = inner end, 1 = outer end
  position: Record<string, number>
  curved: boolean // links as hive curves (three/hive.ts)
}

export const HIVE_PROPERTIES: [HiveProperty, string][] = [
  ['degree', 'Degree (connections)'],
  ['betweenness', 'Betweenness centrality'],
  ['clustering', 'Clustering coefficient'],
  ['name', 'Name (A→Z)'],
]
export const HIVE_SCALES: [HiveScale, string][] = [
  ['axis', 'Value, each axis full length'],
  ['shared', 'Value, one scale for all axes'],
  ['rank', 'Rank (evenly spaced)'],
]

// Every node's connections, inter-layer links included
export function nodeDegrees(): Record<string, number> {
  const net = store.get().network
  const degree: Record<string, number> = {}
  for (const n of net?.nodes ?? []) degree[n.id] = 0
  for (const e of net?.edges ?? []) {
    degree[e.src] = (degree[e.src] ?? 0) + 1
    degree[e.trg] = (degree[e.trg] ?? 0) + 1
  }
  return degree
}

// The property's value per node; betweenness and clustering coefficient are
// computed by the server within each layer (POST /api/topology).
export async function hiveValues(
  property: HiveProperty
): Promise<Record<string, number>> {
  const net = store.get().network
  if (!net) return {}
  if (property === 'degree') return nodeDegrees()
  if (property === 'name') {
    const order = [...net.nodes].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true })
    )
    return Object.fromEntries(order.map((n, i) => [n.id, i]))
  }
  const req: TopologyRequest = {
    nodes: net.nodes,
    edges: net.edges,
    metric:
      property === 'betweenness'
        ? 'Betweenness Centrality'
        : 'Clustering Coefficient',
    scope: 'perLayer',
    selected_layers: net.layers,
    selected_channels: store.get().selectedChannels,
  }
  const { raw } = await api.topology(req)
  // nodes without edges in their layer get no score: they sit at the inner end
  return Object.fromEntries(net.nodes.map((n) => [n.id, raw[n.id] ?? 0]))
}

// Values -> places on the axes (0..1), per the chosen scale. Ties in rank
// keep name order, so the plot is the same every time.
export function hivePositions(
  values: Record<string, number>,
  scale: HiveScale
): Record<string, number> {
  const net = store.get().network
  const byLayer = new Map<string, { id: string; label: string }[]>()
  for (const n of net?.nodes ?? [])
    byLayer.set(n.layer, [
      ...(byLayer.get(n.layer) ?? []),
      { id: n.id, label: n.label },
    ])
  const position: Record<string, number> = {}
  const overall = Math.max(0, ...Object.values(values))
  for (const nodes of byLayer.values()) {
    if (scale === 'rank') {
      const sorted = [...nodes].sort(
        (a, b) =>
          (values[a.id] ?? 0) - (values[b.id] ?? 0) ||
          a.label.localeCompare(b.label)
      )
      sorted.forEach(
        (n, i) =>
          (position[n.id] = sorted.length > 1 ? i / (sorted.length - 1) : 0.5)
      )
      continue
    }
    const max =
      scale === 'shared'
        ? overall
        : Math.max(0, ...nodes.map((n) => values[n.id] ?? 0))
    for (const n of nodes)
      position[n.id] = max > 0 ? Math.max(0, values[n.id] ?? 0) / max : 0
  }
  return position
}

// The arrangement's default (Scene panel, examples): degree, each axis full
// length, curved links
export function defaultHiveInput(): HiveInput {
  return { position: hivePositions(nodeDegrees(), 'axis'), curved: true }
}
