// Shared mutable runtime state for the Three.js object model.
// Replaces the ambient globals from v2 www/js/config/static_variables.js
// (registries, screen bounds, edge-render tunables, color-priority flags).
//
// The four classes read from this singleton instead of window globals, which
// keeps them unit-testable: a test populates `ctx` before constructing objects.
// Later phases (actions/commands/UI) mutate these fields in response to events.
//
// v2 declared nodeGroups/layerGroups as `new Map()` but only ever used bracket
// notation on them (`layerGroups[name] = i`), i.e. plain dictionaries — typed
// here as records accordingly.

import type { Scene } from './Scene'
import type * as THREE from 'three'
import { Vector2 } from 'three'
import type { Layer } from './Layer'
import type { Node } from './Node'
import type { Edge } from './Edge'

export type NetworkMode = 'multilayer' | 'single'

export type ColorPrioritySource = 'default' | 'picker' | 'cluster'

export interface RuntimeContext {
  // Renderer + camera (Phase 12; persist across network reloads, so NOT reset
  // by resetContext). null until main.ts sets up the screen.
  renderer: THREE.WebGLRenderer | null
  camera: THREE.OrthographicCamera | null
  fps: number
  // Performance panel (ui/fps.ts)
  renderScale: number | null // pixel ratio, null = the device's (capped)
  nodeDetail: 'low' | 'medium' | 'high'
  hideLabelsWhileMoving: boolean
  pauseInterWhileMoving: boolean
  minimapEvery: number // draw the navigator every Nth frame; 0 = off

  // Screen bounds (v2 screen.js; yBoundMax = window.innerHeight / 2)
  xBoundMin: number
  xBoundMax: number
  yBoundMin: number
  yBoundMax: number
  zBoundMin: number
  zBoundMax: number
  mousePreviousX: number
  mousePreviousY: number

  // Registries — populated when a network loads
  scene: Scene | null
  layers: Layer[]
  nodeObjects: Node[]
  edgeObjects: Edge[]
  nodeLayerNames: string[]
  nodeGroups: Record<string, string> // nodeLayerName -> layerName
  layerGroups: Record<string, number> // layerName -> layer index

  // Channels
  channelColors: Record<string, string>
  channelVisibility: Record<string, boolean>

  // Edge render config (config-driven; defaults from v2 static_variables.js)
  edgeDefaultColor: string
  containerDefaultColor: string // themes.ts: cube/sphere/cloud colour when a layer has none
  selectedEdgeColorFlag: boolean
  edgeFileColorPriority: boolean
  isDirectionEnabled: boolean
  // The two weight encodings are independent; the Edge Actions radio is just a
  // view over this pair (none / opacity / width / both).
  edgeOpacityByWeight: boolean
  edgeWidthByWeight: boolean
  // Edge Actions weight filter: edges/channels with a scaled weight below it
  // are not drawn (0 = show all)
  edgeWeightThreshold: number
  interLayerEdgeOpacity: number
  intraLayerEdgeOpacity: number
  interLayerEdgeWidth: number
  intraLayerEdgeWidth: number
  interDirectionArrowSize: number
  intraDirectionArrowSize: number
  interChannelCurvature: number
  intraChannelCurvature: number
  // 'single' treats the data as one graph: layers stacked, floors off, layer
  // controls hidden (actions/modes.ts, ui/mode.ts)
  networkMode: NetworkMode
  lastLoadSource: 'network' | 'session' // what the last load came from
  // edge bundling strength, 0 = straight edges (three/bundling.ts)
  intraEdgeBundling: number
  interEdgeBundling: number

  // Color-priority sources
  layerColorPrioritySource: ColorPrioritySource
  nodeColorPrioritySource: ColorPrioritySource

  // Node hover/selection/label state (v2 node.js globals)
  lastHoveredNodeIndex: number | null
  selectedNodeColorFlag: boolean
  showAllNodeLabelsFlag: boolean
  showSelectedNodeLabelsFlag: boolean
  renderNodeLabelsFlag: boolean
  showAllLayerLabelsFlag: boolean
  showSelectedLayerLabelsFlag: boolean

  // Inter-layer edge render machinery (v2 edge.js globals)
  renderInterLayerEdgesFlag: boolean
  waitEdgeRenderFlag: boolean
  interEdgesRemoved: boolean
  interLayerEdgesRenderPauseFlag: boolean

  // Layer hover/label state (v2 layer.js globals)
  lastHoveredLayerIndex: number | null
  hoveredLayerPaintedFlag: boolean
  renderLayerLabelsFlag: boolean

  // Universal label color (v2 globalLabelColor; read by labels.ts)
  labelColor: string
}

const winW = typeof window !== 'undefined' ? window.innerWidth : 800
const winH = typeof window !== 'undefined' ? window.innerHeight : 800

// Shared resolution uniform for every edge LineMaterial. Screen-space fat
// lines divide linewidth by this, so it must track the camera frustum size in
// world units: every material references this single Vector2, so resize
// (screen.ts resetScreen) and PNG export retarget all edges by mutating it —
// no scene traversal. worldUnits is not an option: its shader assumes a
// perspective view ray and shreds lines under this app's orthographic camera.
export const edgeResolution = new Vector2(winW, winH)

export const ctx: RuntimeContext = {
  renderer: null,
  camera: null,
  fps: 60,
  renderScale: null,
  nodeDetail: 'medium',
  hideLabelsWhileMoving: false,
  pauseInterWhileMoving: false,
  minimapEvery: 1,

  xBoundMin: -winW / 2,
  xBoundMax: winW / 2,
  yBoundMin: -winH / 2,
  yBoundMax: winH / 2,
  zBoundMin: -winH / 2.5,
  zBoundMax: winH / 2.5,
  mousePreviousX: 0,
  mousePreviousY: 0,

  scene: null,
  layers: [],
  nodeObjects: [],
  edgeObjects: [],
  nodeLayerNames: [],
  nodeGroups: {},
  layerGroups: {},

  channelColors: {},
  channelVisibility: {},

  edgeDefaultColor: '#000000',
  containerDefaultColor: '#5b8def',
  selectedEdgeColorFlag: true,
  edgeFileColorPriority: false,
  isDirectionEnabled: false,
  edgeOpacityByWeight: true,
  edgeWidthByWeight: false,
  edgeWeightThreshold: 0,
  interLayerEdgeOpacity: 0.4,
  intraLayerEdgeOpacity: 1,
  interLayerEdgeWidth: 1,
  intraLayerEdgeWidth: 1,
  interDirectionArrowSize: 5,
  intraDirectionArrowSize: 5,
  interChannelCurvature: 5,
  intraChannelCurvature: 15,
  networkMode: 'multilayer',
  lastLoadSource: 'network',
  intraEdgeBundling: 0,
  interEdgeBundling: 0,

  layerColorPrioritySource: 'default',
  nodeColorPrioritySource: 'default',

  lastHoveredNodeIndex: null,
  selectedNodeColorFlag: true,
  showAllNodeLabelsFlag: false,
  showSelectedNodeLabelsFlag: true,
  renderNodeLabelsFlag: false,
  showAllLayerLabelsFlag: true,
  showSelectedLayerLabelsFlag: false,

  renderInterLayerEdgesFlag: false,
  waitEdgeRenderFlag: true,
  interEdgesRemoved: false,
  interLayerEdgesRenderPauseFlag: false,

  lastHoveredLayerIndex: null,
  hoveredLayerPaintedFlag: false,
  renderLayerLabelsFlag: false,

  labelColor: '#ffffff',
}

// Reset registries + tunables to defaults (used by tests and network reload).
export function resetContext(): void {
  ctx.mousePreviousX = 0
  ctx.mousePreviousY = 0
  ctx.scene = null
  ctx.layers = []
  ctx.nodeObjects = []
  ctx.edgeObjects = []
  ctx.nodeLayerNames = []
  ctx.nodeGroups = {}
  ctx.layerGroups = {}
  ctx.channelColors = {}
  ctx.channelVisibility = {}
  ctx.edgeDefaultColor = '#000000'
  ctx.selectedEdgeColorFlag = true
  ctx.edgeFileColorPriority = false
  ctx.isDirectionEnabled = false
  ctx.edgeOpacityByWeight = true
  ctx.edgeWidthByWeight = false
  ctx.interLayerEdgeOpacity = 0.4
  ctx.intraLayerEdgeOpacity = 1
  ctx.interLayerEdgeWidth = 1
  ctx.intraLayerEdgeWidth = 1
  ctx.interDirectionArrowSize = 5
  ctx.intraDirectionArrowSize = 5
  ctx.interChannelCurvature = 5
  ctx.intraChannelCurvature = 15
  ctx.networkMode = 'multilayer'
  ctx.intraEdgeBundling = 0
  ctx.interEdgeBundling = 0
  ctx.layerColorPrioritySource = 'default'
  ctx.nodeColorPrioritySource = 'default'
  ctx.lastHoveredNodeIndex = null
  ctx.selectedNodeColorFlag = true
  ctx.showAllNodeLabelsFlag = false
  ctx.showSelectedNodeLabelsFlag = true
  ctx.renderNodeLabelsFlag = false
  ctx.showAllLayerLabelsFlag = true
  ctx.showSelectedLayerLabelsFlag = false
  ctx.renderInterLayerEdgesFlag = false
  ctx.waitEdgeRenderFlag = true
  ctx.interEdgesRemoved = false
  ctx.interLayerEdgesRenderPauseFlag = false
  ctx.lastHoveredLayerIndex = null
  ctx.hoveredLayerPaintedFlag = false
  ctx.renderLayerLabelsFlag = false
  ctx.labelColor = '#ffffff'
}

// Registry snapshot — the mutable scene-graph state a network load replaces.
// LoadNetworkCommand snapshots before/after so a load is one undo step.
export interface RegistrySnapshot {
  scene: Scene | null
  layers: Layer[]
  nodeObjects: Node[]
  edgeObjects: Edge[]
  nodeLayerNames: string[]
  nodeGroups: Record<string, string>
  layerGroups: Record<string, number>
  channelColors: Record<string, string>
  channelVisibility: Record<string, boolean>
}

export function snapshotRegistries(): RegistrySnapshot {
  return {
    scene: ctx.scene,
    layers: ctx.layers,
    nodeObjects: ctx.nodeObjects,
    edgeObjects: ctx.edgeObjects,
    nodeLayerNames: ctx.nodeLayerNames,
    nodeGroups: ctx.nodeGroups,
    layerGroups: ctx.layerGroups,
    channelColors: ctx.channelColors,
    channelVisibility: ctx.channelVisibility,
  }
}

// Free GPU resources of a snapshot whose scene graph became unreachable
// (e.g. a redo entry discarded by a new command). Never call on a snapshot
// whose scene is still live (ctx.scene) or still reachable from undo history.
export function disposeSnapshot(snapshot: RegistrySnapshot): void {
  const scene = snapshot.scene
  if (!scene || scene === ctx.scene) return
  disposeObject3D(scene.THREE_Object)
}

// Free the GPU buffers of an object and everything under it. Only ever call
// this on objects that nothing else can still reach — see disposeSnapshot's
// contract above, and Edge.redrawEdge, which discards the object it replaces.
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Partial<THREE.Mesh> & THREE.Object3D
    if (mesh.geometry) mesh.geometry.dispose()
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : []
    for (const mat of materials) {
      const tex = (mat as THREE.Material & { map?: THREE.Texture }).map
      tex?.dispose()
      mat.dispose()
    }
  })
}

export function restoreRegistries(s: RegistrySnapshot): void {
  ctx.scene = s.scene
  ctx.layers = s.layers
  ctx.nodeObjects = s.nodeObjects
  ctx.edgeObjects = s.edgeObjects
  ctx.nodeLayerNames = s.nodeLayerNames
  ctx.nodeGroups = s.nodeGroups
  ctx.layerGroups = s.layerGroups
  ctx.channelColors = s.channelColors
  ctx.channelVisibility = s.channelVisibility
}
