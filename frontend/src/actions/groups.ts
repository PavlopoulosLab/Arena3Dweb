// Groups as NORMA's group list: annotation terms (from attribute or group
// files, or enrichment) and clusters, with their colour, members per layer and
// a hidden flag; what the Groups card, the legend and the super-node view read.

import type { GroupRow } from '../api/client'
import { bus } from '../bus'
import { history } from '../commands/base'
import { ctx } from '../three'
import {
  groupColor,
  isGroupHidden,
  piesEnabled,
  redrawHulls,
  showAnnotationPies,
} from './annotations'
import { loadNetwork } from './network'
import { collapseGroups } from './restructure'
import { store } from '../store'
import { NodeStyleCommand } from './style'
import { updateSelectedNodesStore } from './node'

export type GroupSource = 'annotation' | 'cluster'

export interface GroupInfo {
  name: string
  color: string
  members: number[] // node indices
  perLayer: Record<string, number>
  hidden: boolean
}

const keysOf = (i: number, source: GroupSource): string[] => {
  const n = ctx.nodeObjects[i]
  if (source === 'cluster') return n.cluster ? [`Cluster ${n.cluster}`] : []
  return n.annotations
}

export function listGroups(source: GroupSource): GroupInfo[] {
  const groups = new Map<string, GroupInfo>()
  ctx.nodeObjects.forEach((n, i) => {
    for (const key of keysOf(i, source)) {
      let g = groups.get(key)
      if (!g) {
        g = {
          name: key,
          color: source === 'cluster' ? n.clusterColor : groupColor(key),
          members: [],
          perLayer: {},
          hidden: isGroupHidden(key),
        }
        groups.set(key, g)
      }
      g.members.push(i)
      g.perLayer[n.layer] = (g.perLayer[n.layer] ?? 0) + 1
    }
  })
  return [...groups.values()].sort(
    (a, b) =>
      b.members.length - a.members.length || a.name.localeCompare(b.name)
  )
}

// A group file names nodes, not copies: every copy of the node gets the groups.
// @return nodes (copies) annotated
export function applyGroups(rows: GroupRow[]): number {
  const byName = new Map(rows.map((r) => [r.node, r.groups]))
  let n = 0
  for (const node of ctx.nodeObjects) {
    const groups = byName.get(node.name)
    if (!groups) continue
    node.annotations = [...groups]
    n++
  }
  if (piesEnabled()) showAnnotationPies(true)
  redrawHulls()
  bus.emit('groups:changed', { source: 'annotation' })
  return n
}

export function selectGroup(name: string, source: GroupSource): number {
  for (const n of ctx.nodeObjects) n.isSelected = false
  const g = listGroups(source).find((g) => g.name === name)
  for (const i of g?.members ?? []) ctx.nodeObjects[i].isSelected = true
  updateSelectedNodesStore()
  return g?.members.length ?? 0
}

// Recolour a group's members (undoable); annotation groups also recolour
// their pies and hulls through setGroupColor in the caller.
export function colorGroup(
  name: string,
  source: GroupSource,
  color: string
): void {
  const g = listGroups(source).find((g) => g.name === name)
  if (!g) return
  history.execute(
    new NodeStyleCommand(`Colour group ${name}`, g.members, () => ({ color }))
  )
}

// Jaccard overlap of every pair of groups (members as Node_Layer ids), with
// the member sets themselves for the UpSet plot.
export function groupOverlap(source: GroupSource): {
  names: string[]
  jaccard: number[][]
  members: string[][]
  colors: string[]
} {
  const groups = listGroups(source)
  const sets = groups.map((g) => new Set(g.members))
  const jaccard = sets.map((a) =>
    sets.map((b) => {
      let both = 0
      for (const x of a) if (b.has(x)) both++
      const union = a.size + b.size - both
      return union ? both / union : 0
    })
  )
  return {
    names: groups.map((g) => g.name),
    jaccard,
    members: groups.map((g) => g.members.map((i) => ctx.nodeLayerNames[i])),
    colors: groups.map((g) => g.color),
  }
}

// NORMA's super-node view as a restructuring: every group becomes one node
// per layer, member edges are summed, ungrouped nodes stay; super nodes are
// then sized by their member count and coloured like the group. Undo
// restores the original network.
export function collapseToSuperNodes(source: GroupSource): number {
  const net = store.get().network
  if (!net) throw new Error('Load a network first.')
  const groupOf: Record<string, string | null> = {}
  ctx.nodeObjects.forEach((n, i) => {
    groupOf[n.nodeLayerName] = keysOf(i, source)[0] ?? null
  })
  const sizes = new Map<string, number>() // super node id -> members
  for (const [id, g] of Object.entries(groupOf))
    if (g) {
      const layer = id.slice(id.lastIndexOf('_') + 1)
      sizes.set(`${g}_${layer}`, (sizes.get(`${g}_${layer}`) ?? 0) + 1)
    }
  const colors = new Map(listGroups(source).map((g) => [g.name, g.color]))
  const collapsed = collapseGroups(net, groupOf)
  loadNetwork(collapsed)
  const ids: number[] = []
  const style = new Map<number, { color?: string; scale?: number }>()
  ctx.nodeObjects.forEach((n, i) => {
    const members = sizes.get(n.nodeLayerName)
    if (!members) return
    ids.push(i)
    style.set(i, {
      color: colors.get(n.name),
      scale: Math.min(4, 1 + Math.sqrt(members) / 2),
    })
  })
  if (ids.length)
    history.execute(
      new NodeStyleCommand('Super node look', ids, (i) => style.get(i) ?? {})
    )
  bus.emit('groups:changed', { source: 'all' })
  return ids.length
}

// NORMA-style statistics per group: members, the edges among them, density,
// mean degree inside the group, share of the network's edges, and how many
// members belong to other groups too.
export function groupStats(source: GroupSource): (string | number)[][] {
  const groups = listGroups(source)
  const total = ctx.edgeObjects.length || 1
  const inGroups = (i: number) => keysOf(i, source).length
  return groups.map((g) => {
    const members = new Set(g.members)
    let intra = 0
    let inter = 0
    for (const e of ctx.edgeObjects)
      if (members.has(e.sourceNodeIndex) && members.has(e.targetNodeIndex)) {
        if (e.interLayer) inter++
        else intra++
      }
    const edges = intra + inter
    const n = members.size
    const density = n > 1 ? (2 * edges) / (n * (n - 1)) : 0
    const shared = g.members.filter((i) => inGroups(i) > 1).length
    return [
      g.name,
      n,
      Object.keys(g.perLayer).length,
      edges,
      intra,
      inter,
      density.toFixed(3),
      n ? ((2 * edges) / n).toFixed(2) : '0',
      ((100 * edges) / total).toFixed(1),
      shared,
    ]
  })
}
