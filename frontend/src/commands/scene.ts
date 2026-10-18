// Scene-mutation commands (SPEC §4). Each captures before/after state on the
// Phase 9 Three.js object model (via ctx) so CommandHistory can undo/redo.
//
// Commands are thin: they apply/reverse already-decided values. Fetching from
// the API and computing final positions/scales is the job of the Phase 11
// actions, which construct these commands with the results.

import { Color } from 'three'
import {
  applyLabelStyle,
  labelStylesSnapshot,
  restoreLabelStyles,
  type LabelStyle,
} from '../actions/labels'
import { bus } from '../bus'
import type { Command } from './base'
import {
  redrawIntraLayerEdges,
  redrawInterLayerEdges,
  setChannelColor,
} from '../actions/edge'
import { setRendererColor } from '../actions/screen'
import { repaintLayers, getLastFloorColor } from '../actions/layer'
import { createLabels } from '../actions/labels'
import type { NodeGeometryType } from '../three/Node'
import type { FloorShape, FloorStyle, LayerContainer } from '../three/Layer'
import type { LayoutPosition } from '../api/client'
import { store, type AppState } from '../store'
import {
  ctx,
  COLOR_VECTOR_280,
  snapshotRegistries,
  restoreRegistries,
  disposeSnapshot,
  type RegistrySnapshot,
} from '../three'

type Vec3 = { x: number; y: number; z: number }

function clusterColor(id: number): string {
  return COLOR_VECTOR_280[id % COLOR_VECTOR_280.length]
}

export class ChangeNodeColorCommand implements Command {
  description: string
  private readonly oldColor: string

  constructor(
    private readonly nodeIndex: number,
    private readonly newColor: string
  ) {
    this.oldColor = ctx.nodeObjects[nodeIndex].color
    this.description = `Change node color to ${newColor}`
  }

  private apply(color: string): void {
    const node = ctx.nodeObjects[this.nodeIndex]
    node.setColor(color)
    bus.emit('node:color-changed', { nodeId: node.nodeLayerName, color })
  }

  execute(): void {
    this.apply(this.newColor)
  }
  undo(): void {
    this.apply(this.oldColor)
  }
}

// Low -> high: blue, pale yellow, red (ColorBrewer RdYlBu, reversed).
const METRIC_STOPS = [
  new Color('#2c7bb6'),
  new Color('#ffffbf'),
  new Color('#d7191c'),
]

export function metricColor(t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (METRIC_STOPS.length - 1)
  const i = Math.min(METRIC_STOPS.length - 2, Math.floor(x))
  return METRIC_STOPS[i]
    .clone()
    .lerp(METRIC_STOPS[i + 1], x - i)
    .getHexString()
}

// Colour nodes along a low->high gradient by a value (e.g. a topology metric).
export class ColorNodesByValueCommand implements Command {
  description = 'Color nodes by metric'
  private readonly before: Record<string, string> = {}
  private readonly after: Record<string, string> = {}

  constructor(values: Record<string, number>) {
    const vs = Object.values(values)
    const lo = Math.min(...vs)
    const span = Math.max(...vs) - lo
    for (const [name, v] of Object.entries(values)) {
      const node = ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)]
      if (!node) continue
      this.before[name] = node.color
      this.after[name] = `#${metricColor(span > 0 ? (v - lo) / span : 0.5)}`
    }
  }

  private apply(colors: Record<string, string>): void {
    for (const [name, color] of Object.entries(colors)) {
      const node = ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)]
      node.setColor(color)
      bus.emit('node:color-changed', { nodeId: name, color })
    }
  }

  execute(): void {
    this.apply(this.after)
  }
  undo(): void {
    this.apply(this.before)
  }
}

export class ChangeNodeSizeCommand implements Command {
  description: string
  private readonly oldSize: number

  constructor(
    private readonly nodeIndex: number,
    private readonly newSize: number
  ) {
    this.oldSize = ctx.nodeObjects[nodeIndex].getScale()
    this.description = `Change node size to ${newSize}`
  }

  private apply(size: number): void {
    const node = ctx.nodeObjects[this.nodeIndex]
    node.setScale(size)
    bus.emit('node:size-changed', { nodeId: node.nodeLayerName, size })
  }

  execute(): void {
    this.apply(this.newSize)
  }
  undo(): void {
    this.apply(this.oldSize)
  }
}

export class ChangeEdgeColorCommand implements Command {
  description: string
  private readonly oldColors: string[]
  private readonly oldImported: string[]
  private readonly oldPriority: boolean

  constructor(
    private readonly edgeIndex: number,
    private readonly newColor: string
  ) {
    const edge = ctx.edgeObjects[edgeIndex]
    this.oldColors = edge.colors.slice()
    this.oldImported = edge.importedColors.slice()
    this.oldPriority = ctx.edgeFileColorPriority
    this.description = `Change edge color to ${newColor}`
  }

  execute(): void {
    const edge = ctx.edgeObjects[this.edgeIndex]
    edge.colors = edge.colors.map(() => this.newColor)
    edge.importedColors = edge.importedColors.map(() => this.newColor)
    // v2: recolouring an edge switches the scene into file-colour-priority mode.
    ctx.edgeFileColorPriority = true
    edge.redrawEdge()
    bus.emit('edge:color-changed', { edgeId: edge.name, color: this.newColor })
  }

  undo(): void {
    const edge = ctx.edgeObjects[this.edgeIndex]
    edge.colors = this.oldColors.slice()
    edge.importedColors = this.oldImported.slice()
    ctx.edgeFileColorPriority = this.oldPriority
    edge.redrawEdge()
    bus.emit('edge:color-changed', {
      edgeId: edge.name,
      color: this.oldColors[0],
    })
  }
}

export interface LayerTransform {
  position?: Partial<Vec3>
  rotation?: Partial<Vec3>
  scale?: number
}

export class MoveLayerCommand implements Command {
  description: string
  private readonly before: Required<
    Omit<LayerTransform, 'position' | 'rotation'>
  > & {
    position: Vec3
    rotation: Vec3
  }

  constructor(
    private readonly layerIndex: number,
    private readonly after: LayerTransform
  ) {
    const l = ctx.layers[layerIndex]
    this.before = {
      position: {
        x: l.getPosition('x'),
        y: l.getPosition('y'),
        z: l.getPosition('z'),
      },
      rotation: {
        x: l.getRotation('x'),
        y: l.getRotation('y'),
        z: l.getRotation('z'),
      },
      scale: l.getScale(),
    }
    this.description = `Move layer ${l.getName()}`
  }

  private applyTransform(t: LayerTransform): void {
    const l = ctx.layers[this.layerIndex]
    if (t.position)
      for (const [axis, v] of Object.entries(t.position))
        l.setPosition(axis as 'x' | 'y' | 'z', v)
    if (t.rotation)
      for (const [axis, v] of Object.entries(t.rotation))
        l.setRotation(axis as 'x' | 'y' | 'z', v)
    if (t.scale !== undefined) l.setScale(t.scale)
    redrawInterLayerEdges()
    bus.emit('layer:moved', { layerIndex: this.layerIndex })
  }

  execute(): void {
    this.applyTransform(this.after)
  }
  undo(): void {
    this.applyTransform(this.before)
  }
}

// Nodes moved: the edges between layers (drawn in scene space) and the labels
// follow on the next frame, as when the scene itself moves
function flagMovedNodes(): void {
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderNodeLabelsFlag = true
  ctx.renderLayerLabelsFlag = true
}

export class ApplyLayoutCommand implements Command {
  description = 'Apply layout'
  private readonly beforePos: Record<string, LayoutPosition> = {}
  private readonly beforeCluster: Record<
    string,
    { cluster: string; color: string }
  > = {}
  private readonly beforePriority = ctx.nodeColorPrioritySource

  constructor(
    private readonly positions: Record<string, LayoutPosition>,
    private readonly clusters: Record<string, number> | null = null
  ) {
    for (const name of Object.keys(positions)) {
      const node = ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)]
      this.beforePos[name] = [
        node.getPosition('y'),
        node.getPosition('z'),
        node.getPosition('x'),
      ]
      if (clusters)
        this.beforeCluster[name] = {
          cluster: node.cluster,
          color: node.clusterColor,
        }
    }
  }

  // 2D layouts flatten nodes back onto the plane (x = 0); 3D ones set depth
  private place(positions: Record<string, LayoutPosition>): void {
    for (const [name, [y, z, x]] of Object.entries(positions)) {
      const node = ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)]
      node.setPosition('x', x ?? 0)
      node.setPosition('y', y)
      node.setPosition('z', z)
    }
  }

  execute(): void {
    this.place(this.positions)
    if (this.clusters) {
      for (const [name, id] of Object.entries(this.clusters)) {
        const node = ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)]
        node.setCluster(String(id))
        node.setColor(clusterColor(id), false, true /* clusterMode */)
      }
      ctx.nodeColorPrioritySource = 'cluster'
      bus.emit('clustering:applied', { clusters: this.clusters })
    }
    redrawIntraLayerEdges()
    flagMovedNodes()
    bus.emit('layout:applied', { positions: this.positions })
  }

  undo(): void {
    this.place(this.beforePos)
    if (this.clusters) {
      for (const [name, prev] of Object.entries(this.beforeCluster)) {
        const node = ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)]
        node.setCluster(prev.cluster)
        node.setColor(prev.color, false, true)
      }
      ctx.nodeColorPrioritySource = this.beforePriority
    }
    redrawIntraLayerEdges()
    flagMovedNodes()
    bus.emit('layout:applied', { positions: this.beforePos })
  }
}

export class ApplyTopologyCommand implements Command {
  description = 'Apply topology metric'
  private readonly before: Record<string, number> = {}

  constructor(
    private readonly metric: string,
    private readonly scales: Record<string, number>,
    private readonly raw: Record<string, number> = {}
  ) {
    for (const name of Object.keys(scales))
      this.before[name] =
        ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)].getScale()
  }

  private apply(
    scales: Record<string, number>,
    raw?: Record<string, number>
  ): void {
    for (const [name, s] of Object.entries(scales))
      ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)].setScale(s)
    bus.emit('topology:applied', { metric: this.metric, scales, raw })
  }

  execute(): void {
    this.apply(this.scales, this.raw)
  }
  undo(): void {
    this.apply(this.before)
  }
}

export class ChangeThemeCommand implements Command {
  description: string
  private readonly oldTheme: string

  // Store-only: the concrete recolour (renderer clear color, floor/edge/label
  // colors) is applied by the Phase 11 themes action listening to theme:changed.
  constructor(
    private readonly newTheme: string,
    getTheme: () => string,
    private readonly setTheme: (t: string) => void
  ) {
    this.oldTheme = getTheme()
    this.description = `Change theme to ${newTheme}`
  }

  private apply(theme: string): void {
    this.setTheme(theme)
    bus.emit('theme:changed', { theme })
  }

  execute(): void {
    this.apply(this.newTheme)
  }
  undo(): void {
    this.apply(this.oldTheme)
  }
}

export class LoadNetworkCommand implements Command {
  description = 'Load network'
  private prev: RegistrySnapshot | null = null
  private next: RegistrySnapshot | null = null
  // store.network goes with the scene, or panels would keep sending the
  // undone network's nodes/edges to the API
  private prevNetwork: AppState['network'] = null
  private nextNetwork: AppState['network'] = null

  // `build` populates ctx with the new scene graph (concrete builder lands in
  // Phase 11 network action). The command wraps it with a reversible snapshot.
  constructor(private readonly build: () => void) {}

  private emitLoaded(): void {
    bus.emit('network:loaded', {
      nodeCount: ctx.nodeObjects.length,
      edgeCount: ctx.edgeObjects.length,
      session: ctx.lastLoadSource === 'session',
    })
  }

  execute(): void {
    if (this.next === null) {
      this.prev = snapshotRegistries()
      this.prevNetwork = store.get().network
      this.build() // build() rebuilds the label divs itself
      this.next = snapshotRegistries()
      this.nextNetwork = store.get().network
    } else {
      restoreRegistries(this.next)
      store.update({ network: this.nextNetwork })
      createLabels() // restore only swaps the 3D registries — relabel the DOM
    }
    this.emitLoaded()
  }

  undo(): void {
    if (this.prev) restoreRegistries(this.prev)
    store.update({ network: this.prevNetwork })
    createLabels() // clears the label divs when rewinding to the empty scene
    this.emitLoaded()
  }

  dispose(): void {
    // Only `next` is exclusively ours (built by this command); `prev` may be
    // shared with earlier history entries. disposeSnapshot no-ops if the
    // scene is still the live one.
    if (this.next) disposeSnapshot(this.next)
  }
}

// --- DOM sync helpers (undo/redo must reflect back into the panels) --------

function syncRadio(name: string, value: string | null): void {
  if (typeof document === 'undefined') return
  for (const radio of document.querySelectorAll<HTMLInputElement>(
    `input[name="${name}"]`
  ))
    radio.checked = radio.value === value
}

function checkedRadio(name: string): string | null {
  if (typeof document === 'undefined') return null
  return (
    document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)
      ?.value ?? null
  )
}

function syncInput(id: string, value: string): void {
  if (typeof document === 'undefined') return
  const el = document.getElementById(id) as HTMLInputElement | null
  if (el) el.value = value
}

// --- Whole-scene transform snapshot (nav controls, predefined layouts) -----

type Quat = [number, number, number, number]

export interface TransformSnapshot {
  scene: { pan: Vec3; quaternion: Quat; scale: number } | null
  // `labelPos` is the layer's label sphere (layer.sphere) position — scaleLayers
  // moves it along with the node meshes, so it must be restored too.
  layers: {
    position: Vec3
    quaternion: Quat
    scale: number
    labelPos: Vec3 | null
  }[]
  nodes: { position: Vec3; scale: number }[]
}

export function captureTransforms(): TransformSnapshot {
  const s = ctx.scene?.exists() ? ctx.scene : null
  return {
    scene: s
      ? {
          pan: {
            x: s.getPosition('x'),
            y: s.getPosition('y'),
            z: s.getPosition('z'),
          },
          quaternion: s.getQuaternion().toArray(),
          scale: s.getScale(),
        }
      : null,
    layers: ctx.layers.map((l) => ({
      position: l.plane.position.clone(),
      quaternion: l.plane.quaternion.toArray(),
      scale: l.getScale(),
      labelPos: l.sphere ? l.sphere.position.clone() : null,
    })),
    nodes: ctx.nodeObjects.map((n) => ({
      position: {
        x: n.getPosition('x'),
        y: n.getPosition('y'),
        z: n.getPosition('z'),
      },
      scale: n.getScale(),
    })),
  }
}

function applyTransforms(t: TransformSnapshot): void {
  if (t.scene && ctx.scene?.exists()) {
    ctx.scene.setPosition('x', t.scene.pan.x)
    ctx.scene.setPosition('y', t.scene.pan.y)
    ctx.scene.setPosition('z', t.scene.pan.z)
    ctx.scene.getQuaternion().fromArray(t.scene.quaternion)
    ctx.scene.setScale(t.scene.scale)
  }
  t.layers.forEach((l, i) => {
    const layer = ctx.layers[i]
    if (!layer) return
    layer.plane.position.set(l.position.x, l.position.y, l.position.z)
    layer.plane.quaternion.fromArray(l.quaternion)
    layer.setScale(l.scale)
    if (l.labelPos && layer.sphere)
      layer.sphere.position.set(l.labelPos.x, l.labelPos.y, l.labelPos.z)
  })
  t.nodes.forEach((n, i) => {
    const node = ctx.nodeObjects[i]
    if (!node) return
    node.setPosition('x', n.position.x)
    node.setPosition('y', n.position.y)
    node.setPosition('z', n.position.z)
    node.setScale(n.scale)
  })
  redrawIntraLayerEdges()
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderLayerLabelsFlag = true
  ctx.renderNodeLabelsFlag = true
}

// Generic before/after transform command. The mutation has already run when
// the command is pushed (hold-to-repeat buttons, sliders), so execute() is a
// re-apply of `after` — idempotent on first push, the redo path afterwards.
export class TransformCommand implements Command {
  // `onApply` runs after undo/redo to re-sync DOM the snapshot doesn't cover
  // (e.g. the scale sliders + their value labels).
  constructor(
    public description: string,
    private readonly before: TransformSnapshot,
    private readonly after: TransformSnapshot,
    private readonly onApply?: () => void
  ) {}

  execute(): void {
    applyTransforms(this.after)
    this.onApply?.()
  }
  undo(): void {
    applyTransforms(this.before)
    this.onApply?.()
  }
}

// The scene's coordinate axes (Scene & Camera → Show Scene Coord System)
// — whether they are on screen: a newly loaded network draws them whatever
// the checkbox says
export const sceneCoordsShown = (): boolean =>
  ctx.scene?.coordSystem[0]?.visible ??
  (document.getElementById('toggleSceneCoords') as HTMLInputElement | null)
    ?.checked ??
  true
export function showSceneCoords(show: boolean): void {
  const box = document.getElementById(
    'toggleSceneCoords'
  ) as HTMLInputElement | null
  if (box) box.checked = show
  ctx.scene?.toggleCoords(show)
}

export class PredefinedLayoutCommand implements Command {
  description: string
  private readonly before = captureTransforms()
  private readonly oldRadio = checkedRadio('predefined_layout')
  // a hive plot turns floors into axes and links into curves: both come back
  private readonly floors = ctx.layers.map((l) => l.floorShape)
  // …and sets 3D containers aside while it is on
  private readonly containers = ctx.layers.map((l) => l.container)
  private readonly hive = ctx.hive
  private readonly coords = sceneCoordsShown() // a hive plot hides them

  constructor(
    private readonly layout: string,
    private readonly applyFn: () => void
  ) {
    this.description = `Apply ${layout} layout`
  }

  execute(): void {
    this.applyFn()
    syncRadio('predefined_layout', this.layout)
    syncSelect('layerArrangement', this.layout)
  }

  undo(): void {
    ctx.layers.forEach((l, i) => {
      l.setFloorShape(this.floors[i] ?? 'square')
      if (this.containers[i] && l.container !== this.containers[i])
        l.setContainer(this.containers[i])
    })
    ctx.hive = this.hive
    showSceneCoords(this.coords)
    applyTransforms(this.before)
    syncRadio('predefined_layout', this.oldRadio)
    syncSelect('layerArrangement', this.oldRadio ?? 'parallel')
  }
}

export class ChangeBackgroundColorCommand implements Command {
  description: string
  private readonly oldColor: string

  constructor(private readonly newColor: string) {
    this.oldColor = `#${ctx.renderer!.getClearColor(new Color()).getHexString()}`
    this.description = `Change background color to ${newColor}`
  }

  private apply(color: string): void {
    setRendererColor(color)
    syncInput('scene_color', color)
  }

  execute(): void {
    this.apply(this.newColor)
  }
  undo(): void {
    this.apply(this.oldColor)
  }
}

export class ChangeFloorColorCommand implements Command {
  description: string
  private readonly oldColors = ctx.layers.map((l) => l.color)
  private readonly oldPriority = ctx.layerColorPrioritySource
  private readonly oldRadio = checkedRadio('layerColorPriorityRadio')
  // The DOM color input already holds newColor when its 'change' event fires,
  // so the previous picker value is read from the tracked last-applied color.
  private readonly oldPicker = getLastFloorColor()

  constructor(private readonly newColor: string) {
    this.description = `Change floor color to ${newColor}`
  }

  execute(): void {
    // v2 repaintLayersFromPicker: picking a color switches priority to picker.
    ctx.layerColorPrioritySource = 'picker'
    syncInput('floor_color', this.newColor)
    syncRadio('layerColorPriorityRadio', 'picker')
    repaintLayers(this.newColor)
  }

  undo(): void {
    ctx.layerColorPrioritySource = this.oldPriority
    syncInput('floor_color', this.oldPicker)
    syncRadio('layerColorPriorityRadio', this.oldRadio)
    if (this.oldPriority === 'picker') {
      // Re-apply the previous picker color through repaintLayers so the tracked
      // last-floor-color rewinds too (keeps a following undo consistent).
      repaintLayers(this.oldPicker)
    } else {
      ctx.layers.forEach((l, i) => {
        if (this.oldColors[i] !== undefined) l.setColor(this.oldColors[i])
      })
    }
  }
}

// Node geometry for every node, or for the nodes of some layers (indexes),
// so each layer can have its own shape; undo restores each node's own shape.
// Clustering card: communities without a layout; the nodes keep their spots
export class ApplyClustersCommand implements Command {
  description = 'Find communities'
  private readonly before: Record<string, { cluster: string; color: string }> =
    {}
  private readonly beforePriority = ctx.nodeColorPrioritySource

  constructor(private readonly clusters: Record<string, number>) {
    for (const name of Object.keys(clusters)) {
      const node = ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)]
      if (node)
        this.before[name] = { cluster: node.cluster, color: node.clusterColor }
    }
  }

  execute(): void {
    for (const [name, id] of Object.entries(this.clusters)) {
      const node = ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)]
      if (!node) continue
      node.setCluster(String(id))
      node.setColor(clusterColor(id), false, true /* clusterMode */)
    }
    ctx.nodeColorPrioritySource = 'cluster'
    bus.emit('clustering:applied', { clusters: this.clusters })
    redrawIntraLayerEdges()
  }

  undo(): void {
    for (const [name, prev] of Object.entries(this.before)) {
      const node = ctx.nodeObjects[ctx.nodeLayerNames.indexOf(name)]
      node.setCluster(prev.cluster)
      node.setColor(prev.color, false, true)
    }
    ctx.nodeColorPrioritySource = this.beforePriority
    redrawIntraLayerEdges()
  }
}

// The clusters become annotation terms ("Cluster 3"), so pies, hulls, fog
// clouds and the Groups card can use them like any annotation file
export class ClustersAsAnnotationsCommand implements Command {
  description = 'Use clusters as annotations'
  private readonly before = ctx.nodeObjects.map((n) => [...n.annotations])

  execute(): void {
    for (const node of ctx.nodeObjects)
      if (node.cluster !== '') node.annotations = [`Cluster ${node.cluster}`]
    bus.emit('groups:changed', { source: 'annotation' })
  }

  undo(): void {
    ctx.nodeObjects.forEach((n, i) => (n.annotations = [...this.before[i]]))
    bus.emit('groups:changed', { source: 'annotation' })
  }
}

// Edit → Nodes → Label Style, for every node or the selected layers
export class LabelStyleCommand implements Command {
  description = 'Change label style'
  private readonly before = labelStylesSnapshot()

  constructor(
    private readonly style: LabelStyle,
    private readonly layers: string[] | null
  ) {}

  execute(): void {
    applyLabelStyle(this.style, this.layers)
  }
  undo(): void {
    restoreLabelStyles(this.before)
  }
}

export class ChangeNodeGeometryCommand implements Command {
  description: string
  private readonly nodes: number[]
  private readonly before: NodeGeometryType[]

  constructor(
    private readonly shape: NodeGeometryType,
    layerIds: number[] | null = null
  ) {
    const wanted = layerIds ? new Set(layerIds) : null
    this.nodes = ctx.nodeObjects.flatMap((_, i) => {
      if (!wanted) return [i]
      const layer = ctx.layerGroups[ctx.nodeGroups[ctx.nodeLayerNames[i]]]
      return wanted.has(layer) ? [i] : []
    })
    this.before = this.nodes.map((i) => ctx.nodeObjects[i].shape)
    this.description = `Change node geometry to ${shape}`
  }

  execute(): void {
    for (const i of this.nodes) ctx.nodeObjects[i].setGeometry(this.shape)
    syncSelect('nodeGeometry', this.shape)
  }
  undo(): void {
    this.nodes.forEach((i, k) => ctx.nodeObjects[i].setGeometry(this.before[k]))
  }
}

function syncSelect(id: string, value: string): void {
  if (typeof document === 'undefined') return
  const el = document.getElementById(id) as HTMLSelectElement | null
  if (el) el.value = value
}

export class ChangeChannelColorCommand implements Command {
  description: string
  private readonly oldColor: string

  constructor(
    private readonly channel: string,
    private readonly newColor: string
  ) {
    this.oldColor = ctx.channelColors[channel] ?? '#cfcfcf'
    this.description = `Change ${channel} channel color to ${newColor}`
  }

  private apply(color: string): void {
    setChannelColor(this.channel, color)
    syncInput(`color${this.channel}`, color)
  }

  execute(): void {
    this.apply(this.newColor)
  }
  undo(): void {
    this.apply(this.oldColor)
  }
}

// Square/disk floors for the given layer indexes (Phase 18).
export class ChangeFloorStyleCommand implements Command {
  description: string
  private readonly before: FloorStyle[]

  constructor(
    private readonly layerIds: number[],
    private readonly style: FloorStyle
  ) {
    this.before = layerIds.map((i) => ctx.layers[i].floorStyle)
    this.description = `Floor style: ${style}`
  }

  execute(): void {
    for (const i of this.layerIds) ctx.layers[i].setFloorStyle(this.style)
  }
  undo(): void {
    this.layerIds.forEach((i, k) => ctx.layers[i].setFloorStyle(this.before[k]))
  }
}

export class ChangeFloorShapeCommand implements Command {
  description: string
  private readonly before: FloorShape[]

  constructor(
    private readonly layerIds: number[],
    private readonly shape: FloorShape
  ) {
    this.before = layerIds.map((i) => ctx.layers[i].floorShape)
    this.description = `Floor shape: ${shape}`
  }

  execute(): void {
    for (const i of this.layerIds) ctx.layers[i].setFloorShape(this.shape)
  }
  undo(): void {
    this.layerIds.forEach((i, k) => ctx.layers[i].setFloorShape(this.before[k]))
  }
}

// Floor / none / cube / sphere / cloud per layer (Phase 20).
// Container colour (null = follow the floor colour) and opacity, per layer.
export class ChangeContainerStyleCommand implements Command {
  description = 'Container colour and opacity'
  private readonly before: [string | null, number][]

  constructor(
    private readonly layerIds: number[],
    private readonly color: string | null,
    private readonly opacity: number
  ) {
    this.before = layerIds.map((i) => [
      ctx.layers[i].containerColor,
      ctx.layers[i].containerOpacity,
    ])
  }

  execute(): void {
    for (const i of this.layerIds)
      ctx.layers[i].setContainerStyle(this.color, this.opacity)
  }
  undo(): void {
    this.layerIds.forEach((i, k) =>
      ctx.layers[i].setContainerStyle(...this.before[k])
    )
  }
}

export class ChangeContainerCommand implements Command {
  description: string
  private readonly before: LayerContainer[]

  constructor(
    private readonly layerIds: number[],
    private readonly kind: LayerContainer
  ) {
    this.before = layerIds.map((i) => ctx.layers[i].container)
    this.description = `Layer container: ${kind}`
  }

  execute(): void {
    for (const i of this.layerIds) ctx.layers[i].setContainer(this.kind)
  }
  undo(): void {
    this.layerIds.forEach((i, k) => ctx.layers[i].setContainer(this.before[k]))
  }
}
