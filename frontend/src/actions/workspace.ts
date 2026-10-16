// Several loaded networks side by side. Every load from a file, example,
// database or link adds a slot; switching snapshots the current scene as a
// session and rebuilds the chosen one, so each network keeps its layout,
// colours, shapes, annotations and mode. A slot also keeps every annotation
// set it received (attribute or group file, enrichment, clusters), and the
// Annotations card switches between them. Networks can be compared.

import { bus } from '../bus'
import { ctx } from '../three'
import type { SessionData } from '../api/client'
import { collectSession } from './session'
import { loadSession } from './network'
import { piesEnabled, redrawHulls, showAnnotationPies } from './annotations'
import { layerSwatchColor } from './legend'

export interface AnnotationSet {
  name: string
  byNode: Record<string, string[]> // Node_Layer id -> terms
}

export interface Slot {
  id: number
  name: string
  layers: number
  nodes: number
  edges: number
  session: SessionData | null // snapshot while another slot is active
  annotationSets: AnnotationSet[]
  activeSet: number // index into annotationSets, -1 = none
}

const slots: Slot[] = []
let activeId = 0
let nextId = 1

export const listSlots = (): Slot[] => slots.slice()
export const activeSlot = (): Slot | null =>
  slots.find((s) => s.id === activeId) ?? null

const announce = () => bus.emit('workspace:changed', { active: activeId })

// Snapshot the scene into the active slot, before anything replaces it.
export function snapshotActive(): void {
  const slot = activeSlot()
  if (!slot || !ctx.scene?.exists() || ctx.nodeObjects.length === 0) return
  slot.session = collectSession()
  slot.layers = ctx.layers.length
  slot.nodes = ctx.nodeObjects.length
  slot.edges = ctx.edgeObjects.length
}

// A fresh load: a new slot, now active (the scene already holds it).
export function registerLoad(name: string): Slot {
  const slot: Slot = {
    id: nextId++,
    name: name || `Network ${nextId - 1}`,
    layers: ctx.layers.length,
    nodes: ctx.nodeObjects.length,
    edges: ctx.edgeObjects.length,
    session: null,
    annotationSets: [],
    activeSet: -1,
  }
  slots.push(slot)
  activeId = slot.id
  announce()
  return slot
}

export function switchTo(id: number): boolean {
  const target = slots.find((s) => s.id === id)
  if (!target || id === activeId || !target.session) return false
  snapshotActive()
  activeId = id
  loadSession(target.session)
  announce()
  return true
}

export function removeSlot(id: number): boolean {
  const i = slots.findIndex((s) => s.id === id)
  if (i < 0 || id === activeId) return false
  slots.splice(i, 1)
  announce()
  return true
}

export function renameSlot(id: number, name: string): void {
  const slot = slots.find((s) => s.id === id)
  if (slot && name.trim()) {
    slot.name = name.trim()
    announce()
  }
}

// ---------------------------------------------------------------- annotation sets
// The annotations the nodes carry right now — of the nodes `include` names,
// or of all nodes — kept under a name (an upload, an enrichment, a cluster
// run). The new set becomes the active one and is the only one shown.
export function registerAnnotationSet(
  name: string,
  include: (nodeName: string, nodeId: string) => boolean = () => true
): void {
  const slot = activeSlot()
  if (!slot) return
  const byNode: Record<string, string[]> = {}
  ctx.nodeObjects.forEach((n, i) => {
    if (n.annotations.length && include(n.name, ctx.nodeLayerNames[i]))
      byNode[ctx.nodeLayerNames[i]] = [...n.annotations]
  })
  if (Object.keys(byNode).length === 0) return
  const existing = slot.annotationSets.findIndex((a) => a.name === name)
  const set = { name, byNode }
  if (existing >= 0) slot.annotationSets[existing] = set
  else slot.annotationSets.push(set)
  applyAnnotationSet(existing >= 0 ? existing : slot.annotationSets.length - 1)
}

// Put one of the stored sets (or none) on the nodes.
export function applyAnnotationSet(index: number): void {
  const slot = activeSlot()
  if (!slot) return
  const set = slot.annotationSets[index]
  ctx.nodeObjects.forEach((n, i) => {
    n.annotations = set ? [...(set.byNode[ctx.nodeLayerNames[i]] ?? [])] : []
  })
  slot.activeSet = set ? index : -1
  if (piesEnabled()) showAnnotationPies(true)
  redrawHulls()
  bus.emit('groups:changed', { source: 'annotation' })
  announce()
}

// ---------------------------------------------------------------- comparison
// The node names of every layer of both networks, as sets for an UpSet plot:
// which layers, of either network, share nodes.
export function compareSets(
  other: Slot
): { name: string; members: string[]; color?: string }[] | null {
  const session = other.id === activeId ? collectSession() : other.session
  if (!session || !ctx.scene?.exists()) return null
  const a = activeSlot()?.name ?? 'active'
  const sets: { name: string; members: string[]; color?: string }[] = []
  for (const layer of ctx.layers)
    sets.push({
      name: `${a}: ${layer.name}`,
      color: layerSwatchColor(layer.name),
      members: ctx.nodeObjects.flatMap((n, i) =>
        ctx.nodeGroups[ctx.nodeLayerNames[i]] === layer.name ? [n.name] : []
      ),
    })
  for (const layer of session.layers)
    sets.push({
      name: `${other.name}: ${layer.name}`,
      members: session.nodes
        .filter((n) => n.layer === layer.name)
        .map((n) => n.name),
    })
  return sets
}

export interface CompareRow {
  measure: string
  a: number
  b: number
  both: number
  onlyA: number
  onlyB: number
  jaccard: number | null
}

function setRow(measure: string, A: Set<string>, B: Set<string>): CompareRow {
  let both = 0
  for (const x of A) if (B.has(x)) both++
  const union = A.size + B.size - both
  return {
    measure,
    a: A.size,
    b: B.size,
    both,
    onlyA: A.size - both,
    onlyB: B.size - both,
    jaccard: union ? both / union : null,
  }
}

const pair = (x: string, y: string) =>
  x < y ? `${x}\u0000${y}` : `${y}\u0000${x}`

// The active network against another slot's snapshot: shared layers, nodes
// by name and by copy, edges by name pair and by copy pair, and the nodes of
// every shared layer.
export function compareWith(other: Slot): CompareRow[] | null {
  const session = other.id === activeId ? collectSession() : other.session
  if (!session || !ctx.scene?.exists()) return null
  // A: the scene
  const aLayers = new Set(ctx.layers.map((l) => l.name))
  const aNames = new Set(ctx.nodeObjects.map((n) => n.name))
  const aCopies = new Set(ctx.nodeLayerNames)
  const aEdgeNames = new Set<string>()
  const aEdgeCopies = new Set<string>()
  for (const e of ctx.edgeObjects) {
    const s = ctx.nodeObjects[e.sourceNodeIndex]
    const t = ctx.nodeObjects[e.targetNodeIndex]
    if (!s || !t) continue
    aEdgeNames.add(pair(s.name, t.name))
    aEdgeCopies.add(
      pair(
        ctx.nodeLayerNames[e.sourceNodeIndex],
        ctx.nodeLayerNames[e.targetNodeIndex]
      )
    )
  }
  // B: the snapshot
  const bLayers = new Set(session.layers.map((l) => l.name))
  const bNames = new Set(session.nodes.map((n) => n.name))
  const bCopies = new Set(session.nodes.map((n) => `${n.name}_${n.layer}`))
  const nameOf = new Map(
    session.nodes.map((n) => [`${n.name}_${n.layer}`, n.name])
  )
  const bEdgeNames = new Set<string>()
  const bEdgeCopies = new Set<string>()
  for (const e of session.edges) {
    bEdgeCopies.add(pair(e.src, e.trg))
    const s = nameOf.get(e.src)
    const t = nameOf.get(e.trg)
    if (s && t) bEdgeNames.add(pair(s, t))
  }
  const rows: CompareRow[] = [
    setRow('Layers (by name)', aLayers, bLayers),
    setRow('Nodes (by name)', aNames, bNames),
    setRow('Node copies (name + layer)', aCopies, bCopies),
    setRow('Edges (between names)', aEdgeNames, bEdgeNames),
    setRow('Edges (between copies)', aEdgeCopies, bEdgeCopies),
  ]
  for (const layer of aLayers)
    if (bLayers.has(layer))
      rows.push(
        setRow(
          `Nodes of layer ${layer}`,
          new Set(
            ctx.nodeObjects.flatMap((n, i) =>
              ctx.nodeGroups[ctx.nodeLayerNames[i]] === layer ? [n.name] : []
            )
          ),
          new Set(
            session.nodes.filter((n) => n.layer === layer).map((n) => n.name)
          )
        )
      )
  return rows
}
