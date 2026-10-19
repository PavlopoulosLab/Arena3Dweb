// Navigation Controls → Redraw: puts the scene right when something gets
// stuck — a drag, a held key or an area outline left half done (the mouse
// released outside the window), the loading veil left up by a failed
// request, a floor still grabbed — and redraws nodes, edges, bundles and
// labels at the window's size. The view, the selection and undo stay.

import { bus } from '../bus'
import { ctx } from '../three'
import { bundleStrength } from '../three/bundling'
import { checkHullsSoon } from './annotations'
import { computeBundles } from './bundling'
import { cancelPointerState } from './canvas_controls'
import { onPointerCancel } from './drag_controls'
import { redrawIntraLayerEdges } from './edge'
import { decideNodeLabelFlags, repaintNodes } from './node'
import { finishLoader, registerAnimateHook, resetScreen } from './screen'

export function redrawScene(): void {
  onPointerCancel() // a grabbed floor: dropped where it is (one undo step)
  cancelPointerState()
  finishLoader()
  resetScreen() // renderer and camera to the window's size
  repaintNodes()
  decideNodeLabelFlags()
  for (const kind of ['intra', 'inter'] as const)
    if (bundleStrength(kind) > 0) computeBundles(kind)
  redrawIntraLayerEdges()
  ctx.renderInterLayerEdgesFlag = true // unless paused: that stays the user's
  ctx.renderNodeLabelsFlag = true
  ctx.renderLayerLabelsFlag = true
}

// Every change shows at once. After any undoable step (run, undo, redo) and
// every layout, the edges between layers and the labels are drawn again on
// the next frame — what moving the scene used to be needed for — and a light
// check every few frames catches anything that moved nodes or layers without
// saying so: nodes moved within their layers redraw the edges there too.
let pending = false
export function requestSceneRedraw(): void {
  pending = true
  checkHullsSoon() // hulls and fog clouds follow without waiting their turn
}

function flagSceneSpace(): void {
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderNodeLabelsFlag = true
  ctx.renderLayerLabelsFlag = true
}

// node positions within their layers, and nodes and floors in the scene
// (the world matrices the last frame drew)
export function positionSignatures(): [string, string] {
  let lx = 0
  let ly = 0
  let lz = 0
  let wx = 0
  let wy = 0
  let wz = 0
  for (const n of ctx.nodeObjects) {
    const p = n.sphere.position
    lx += p.x
    ly += p.y * 1.3
    lz += p.z * 1.7
    const e = n.sphere.matrixWorld.elements
    wx += e[12]
    wy += e[13] * 1.3
    wz += e[14] * 1.7
  }
  for (const l of ctx.layers) {
    const e = l.plane.matrixWorld.elements
    wx += e[12]
    wy += e[13] * 1.3
    wz += e[14] * 1.7
  }
  const n = ctx.nodeObjects.length
  return [
    `${n}|${lx.toFixed(2)}|${ly.toFixed(2)}|${lz.toFixed(2)}`,
    `${n}|${wx.toFixed(2)}|${wy.toFixed(2)}|${wz.toFixed(2)}`,
  ]
}

const CHECK_EVERY = 10 // frames
let frame = 0
let lastLocal = ''
let lastWorld = ''

export function sceneRedrawStep(): void {
  if (pending) {
    pending = false
    flagSceneSpace()
  }
  if (++frame % CHECK_EVERY) return
  // a drag redraws as it goes; what it leaves is checked once it ends
  if (ctx.scene?.dragging) return
  const [local, world] = positionSignatures()
  if (local !== lastLocal) {
    if (lastLocal) redrawIntraLayerEdges()
    lastLocal = local
  }
  if (world !== lastWorld) {
    if (lastWorld) flagSceneSpace()
    lastWorld = world
  }
}

registerAnimateHook(sceneRedrawStep)
bus.on('history:changed', requestSceneRedraw)
bus.on('layout:applied', requestSceneRedraw)
