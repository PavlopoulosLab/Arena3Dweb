// Several loaded networks side by side. Every load from a file, example,
// database or link adds a slot; switching snapshots the current scene as a
// session and rebuilds the chosen one, so each network keeps its layout,
// colours, shapes, annotations and mode. A slot also keeps every annotation
// set it received (attribute or group file, enrichment, clusters), and the
// Annotations card switches between them. Networks can be compared. The
// Networks menu in the top bar lists them all and says what is on screen;
// networks and sets can be renamed, and deleted for good.

import { bus } from '../bus'
import { ctx, resetContext, Scene } from '../three'
import { store } from '../store'
import type { SessionData } from '../api/client'
import { history } from '../commands/base'
import { LoadNetworkCommand } from '../commands/scene'
import { collectSession } from './session'
import { loadSession } from './network'
import { createLabels } from './labels'
import { resetNetworkMode } from './modes'
import { piesEnabled, redrawHulls, showAnnotationPies } from './annotations'
import { layerSwatchColor } from './legend'
import { sessionNetwork, type UpsetSet } from './upset'

export interface AnnotationSet {
  name: string
  byNode: Record<string, string[]> // Node_Layer id -> terms
}

// where a network came from
export type SlotSource = 'file' | 'session' | 'example' | 'database' | 'link'

export const SOURCE_LABEL: Record<SlotSource, string> = {
  file: 'File',
  session: 'Session file',
  example: 'Example',
  database: 'Database',
  link: 'Shared link',
}

export interface Slot {
  id: number
  name: string
  origin: string // the file (or import) it was loaded from; a rename keeps it
  source: SlotSource
  added: string[] // networks added to it later (as layers, or into the graph)
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

// the name of the annotation set a saved session brings with it, when the
// session does not name it
export const SESSION_SET = 'Saved with the session'

// the longest name a network or annotation set may have
export const MAX_NAME = 120

// A fresh load: a new slot, now active (the scene already holds it). `origin`
// is the file or import it came from; a saved session may bring the
// network's own name and its annotation set's name. The annotations a
// session brings are kept as a set of their own, already shown.
export function registerLoad(
  origin: string,
  source: SlotSource = 'file',
  saved?: { name?: string | null; annotationSet?: string | null }
): Slot {
  const slot: Slot = {
    id: nextId++,
    name: saved?.name || origin || `Network ${nextId - 1}`,
    origin,
    source,
    added: [],
    layers: ctx.layers.length,
    nodes: ctx.nodeObjects.length,
    edges: ctx.edgeObjects.length,
    session: null,
    annotationSets: [],
    activeSet: -1,
  }
  const byNode: Record<string, string[]> = {}
  ctx.nodeObjects.forEach((n, i) => {
    if (n.annotations.length) byNode[ctx.nodeLayerNames[i]] = [...n.annotations]
  })
  if (Object.keys(byNode).length) {
    slot.annotationSets.push({
      name: saved?.annotationSet || SESSION_SET,
      byNode,
    })
    slot.activeSet = 0
  }
  slots.push(slot)
  activeId = slot.id
  announce()
  return slot
}

// Another network went into the one on screen (new layers, or the graph
// expanded): the active slot names it.
export function noteAddition(name: string): void {
  const slot = activeSlot()
  if (!slot) return
  slot.added.push(name)
  announce()
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

// A name as typed, or why it cannot be one.
function checkName(name: string): string | null {
  if (!name) return 'Type a name.'
  if (name.length > MAX_NAME)
    return `A name has at most ${MAX_NAME} characters.`
  return null
}

// @return why the name was refused, or null once renamed
export function renameSlot(id: number, name: string): string | null {
  const slot = slots.find((s) => s.id === id)
  if (!slot) return 'That network is no longer loaded.'
  const value = name.trim()
  const problem = checkName(value)
  if (problem) return problem
  slot.name = value
  announce()
  return null
}

// The empty scene the app starts with (the last network was deleted).
function showNothing(): void {
  history.execute(
    new LoadNetworkCommand(() => {
      const edgeDefaultColor = ctx.edgeDefaultColor
      resetContext()
      resetNetworkMode()
      ctx.edgeDefaultColor = edgeDefaultColor
      const scene = new Scene()
      scene.tiltDefault()
      scene.setScale(0.9)
      ctx.scene = scene
      store.update({ network: null, selectedChannels: [] })
      createLabels()
    })
  )
}

// Delete a network for good, with its annotation sets. The one on screen
// gives way to the loaded network before it (or after it), or to the empty
// scene. Undo history goes too — its steps hold the scenes of earlier
// networks and could bring this one back — and every scene it held is freed.
export function deleteSlot(id: number): boolean {
  const i = slots.findIndex((s) => s.id === id)
  if (i < 0) return false
  const [gone] = slots.splice(i, 1)
  gone.session = null
  gone.annotationSets = []
  if (gone.id === activeId) {
    const next = [...slots.slice(0, i).reverse(), ...slots.slice(i)].find(
      (s) => s.session
    )
    activeId = next?.id ?? 0
    if (next?.session) loadSession(next.session)
    else showNothing()
  }
  history.clear()
  announce()
  return true
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

// @return why the name was refused (empty, too long, taken in this
// network), or null once renamed
export function renameAnnotationSet(
  slotId: number,
  index: number,
  name: string
): string | null {
  const sets = slots.find((s) => s.id === slotId)?.annotationSets
  if (!sets?.[index]) return 'That annotation set is gone.'
  const value = name.trim()
  const problem = checkName(value)
  if (problem) return problem
  if (sets.some((a, i) => i !== index && a.name === value))
    return `This network already has an annotation set named “${value}”.`
  sets[index].name = value
  announce()
  return null
}

// Delete one annotation set of a network; if it was the one shown, the
// network shows none.
export function deleteAnnotationSet(slotId: number, index: number): boolean {
  const slot = slots.find((s) => s.id === slotId)
  if (!slot?.annotationSets[index]) return false
  const shown = slot.activeSet === index
  slot.annotationSets.splice(index, 1)
  if (slot.activeSet > index) slot.activeSet--
  if (!shown) announce()
  else if (slot.id === activeId) applyAnnotationSet(-1)
  else {
    // its snapshot carries the set's terms: take them off too
    slot.activeSet = -1
    slot.session?.nodes.forEach((n) => (n.annotations = []))
    announce()
  }
  return true
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

// ---------------------------------------------------------------- overview
// What the Networks menu shows: every loaded network with its source, size
// (live for the one on screen) and annotation sets, and which are shown.

export interface SetRow {
  index: number // into the slot's annotationSets
  name: string
  nodes: number
}

export interface SlotRow {
  id: number
  name: string
  origin: string // what it was loaded from, when renamed since
  source: string
  added: string[]
  layers: number
  nodes: number
  edges: number
  active: boolean
  sets: SetRow[]
  activeSet: number // -1 = none
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`

export const sizeText = (layers: number, nodes: number, edges: number) =>
  `${plural(layers, 'layer')} · ${plural(nodes, 'node')} · ${plural(edges, 'edge')}`

export function describeSlots(): SlotRow[] {
  const live = ctx.scene?.exists() ?? false
  return slots.map((s) => {
    const active = s.id === activeId
    return {
      id: s.id,
      name: s.name,
      origin: s.origin !== s.name ? s.origin : '',
      source: SOURCE_LABEL[s.source],
      added: [...s.added],
      layers: active && live ? ctx.layers.length : s.layers,
      nodes: active && live ? ctx.nodeObjects.length : s.nodes,
      edges: active && live ? ctx.edgeObjects.length : s.edges,
      active,
      sets: s.annotationSets.map((a, index) => ({
        index,
        name: a.name,
        nodes: Object.keys(a.byNode).length,
      })),
      activeSet: s.activeSet,
    }
  })
}

// The network on screen and its annotation set (null: none), in a line.
export function onScreen(): {
  network: string
  annotation: string | null
} | null {
  const slot = activeSlot()
  if (!slot) return null
  const network = [slot.name, ...slot.added].join(' + ')
  return {
    network,
    annotation: slot.annotationSets[slot.activeSet]?.name ?? null,
  }
}

// ---------------------------------------------------------------- comparison
// The node names of every layer of both networks, as sets for an UpSet plot:
// which layers, of either network, share nodes. Each set knows its network,
// so a pick in the plot can be selected or cut out as a subnetwork.
export function compareSets(other: Slot): UpsetSet[] | null {
  const session = other.id === activeId ? collectSession() : other.session
  if (!session || !ctx.scene?.exists()) return null
  const a = activeSlot()?.name ?? 'active'
  const current = store.get().network
  const theirs = sessionNetwork(session)
  const sets: UpsetSet[] = []
  for (const layer of ctx.layers)
    sets.push({
      name: `${a}: ${layer.name}`,
      color: layerSwatchColor(layer.name),
      members: ctx.nodeObjects.flatMap((n, i) =>
        ctx.nodeGroups[ctx.nodeLayerNames[i]] === layer.name ? [n.name] : []
      ),
      origin: current
        ? { network: current, label: a, layer: layer.name }
        : undefined,
    })
  for (const layer of session.layers)
    sets.push({
      name: `${other.name}: ${layer.name}`,
      members: session.nodes
        .filter((n) => n.layer === layer.name)
        .map((n) => n.name),
      origin: { network: theirs, label: other.name, layer: layer.name },
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
