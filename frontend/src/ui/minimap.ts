// 2D navigator (satellite view), Cytoscape-style. A small canvas in the
// bottom-right showing the whole network's current 2D projection: node dots +
// edges, plus a rectangle marking what the main view currently sees. Click /
// drag the map to pan the 3D view there.
//
// Why it tracks scene rotation for free: node.getWorldPosition() already carries
// pan-translate, pan-scale and sphere-rotation. Stripping only the pan
// transform (pan has no rotation) leaves rotation-only coords — the exact
// monitor XY projection, but stable under pan/zoom so the thumbnail doesn't
// drift while you navigate.

import * as THREE from 'three'
import { ctx } from '../three'
import { registerAnimateHook } from '../actions/screen'
import { bus } from '../bus'
import { history } from '../commands/base'
import { captureTransforms, TransformCommand } from '../commands/scene'
import type { TransformSnapshot } from '../commands/scene'

const W = 200
const H = 150
const PAD = 8

// --- pure projection math (unit-tested) ----------------------------------

export interface Fit {
  scale: number
  cx: number
  cy: number
}

interface Pt {
  x: number
  y: number
}

// Map local-space points into the W×H canvas: uniform scale to fit the bbox
// with PAD margin, centered. Empty/degenerate input -> scale 1 at origin.
export function computeFit(points: Pt[]): Fit {
  if (points.length === 0) return { scale: 1, cx: 0, cy: 0 }
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const spanX = maxX - minX || 1
  const spanY = maxY - minY || 1
  const scale = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY)
  return { scale, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

// local -> canvas px (canvas Y grows downward, world Y upward -> flip).
export function project(x: number, y: number, f: Fit): Pt {
  return { x: W / 2 + (x - f.cx) * f.scale, y: H / 2 - (y - f.cy) * f.scale }
}

// canvas px -> local (inverse of project).
export function unproject(px: number, py: number, f: Fit): Pt {
  return { x: f.cx + (px - W / 2) / f.scale, y: f.cy - (py - H / 2) / f.scale }
}

// --- module state --------------------------------------------------------

let enabled = true
let container: HTMLDivElement | null = null
let canvas: HTMLCanvasElement | null = null
let g: CanvasRenderingContext2D | null = null
let hasNetwork = false

let dragging = false
let dragBefore: TransformSnapshot | null = null

// --- rendering -----------------------------------------------------------

const _v = new THREE.Vector3()
const _inv = new THREE.Matrix4()

function layerVisible(nodeLayerName: string): boolean {
  const i = ctx.layerGroups[ctx.nodeGroups[nodeLayerName]]
  return ctx.layers[i]?.isVisible ?? true
}

// Project every node to pan-local (rotation-only) space, keyed by node index
// so edges can reuse the points. Nodes on hidden layers become null: they drop
// out of the fit, the dot loop, and (via the guard) any edge touching them.
// Refreshes pan.matrixWorld into _inv as a side effect. ponytail: O(nodes)
// every frame; fine for typical nets, gate behind a dirty-flag if huge.
function projectNodes(): (Pt | null)[] {
  ctx.scene!.pan!.updateWorldMatrix(true, false)
  _inv.copy(ctx.scene!.pan!.matrixWorld).invert()
  return ctx.nodeObjects.map((n) => {
    if (!layerVisible(n.nodeLayerName)) return null
    _v.copy(n.getWorldPosition()).applyMatrix4(_inv)
    return { x: _v.x, y: _v.y }
  })
}

let frame = 0
function draw(): void {
  if (!enabled || !hasNetwork || !g || !canvas) return
  // Performance panel: every Nth frame, or never
  if (ctx.minimapEvery <= 0) return
  if (ctx.minimapEvery > 1 && frame++ % ctx.minimapEvery !== 0) return
  const scene = ctx.scene
  if (!scene?.pan || ctx.nodeObjects.length === 0) return

  const local = projectNodes()
  const fit = computeFit(local.filter((p): p is Pt => p !== null))

  g.clearRect(0, 0, W, H)

  // edges (faint) first, dots on top
  g.strokeStyle = 'rgba(128,128,128,0.35)'
  g.lineWidth = 0.5
  g.beginPath()
  for (const e of ctx.edgeObjects) {
    const a = local[e.sourceNodeIndex]
    const b = local[e.targetNodeIndex]
    if (!a || !b) continue
    const pa = project(a.x, a.y, fit)
    const pb = project(b.x, b.y, fit)
    g.moveTo(pa.x, pa.y)
    g.lineTo(pb.x, pb.y)
  }
  g.stroke()

  for (let i = 0; i < ctx.nodeObjects.length; i++) {
    const pt = local[i]
    if (!pt) continue
    const p = project(pt.x, pt.y, fit)
    g.fillStyle = ctx.nodeObjects[i].getColor()
    g.beginPath()
    g.arc(p.x, p.y, 1.5, 0, Math.PI * 2)
    g.fill()
  }

  drawViewportBox(fit)
}

// The visible world window is [-xBoundMax,xBoundMax]×[-yBoundMax,yBoundMax].
// In pan-local space it stays axis-aligned (pan has no rotation), so two
// opposite corners define the rectangle.
function drawViewportBox(fit: Fit): void {
  if (!g) return
  const c1 = _v.set(ctx.xBoundMin, ctx.yBoundMin, 0).applyMatrix4(_inv).clone()
  const c2 = _v.set(ctx.xBoundMax, ctx.yBoundMax, 0).applyMatrix4(_inv).clone()
  const p1 = project(c1.x, c1.y, fit)
  const p2 = project(c2.x, c2.y, fit)
  const x = Math.min(p1.x, p2.x)
  const y = Math.min(p1.y, p2.y)
  g.strokeStyle = 'rgba(230,180,60,0.9)'
  g.lineWidth = 1
  g.strokeRect(x, y, Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y))
}

// --- interaction: click/drag the map -> pan the 3D view ------------------

// Pan so the clicked local point lands at screen center (world origin):
// localToWorld(l) = panPos + panScale*l, set = 0 -> panPos = -panScale*l.
function panToCanvasPoint(px: number, py: number): void {
  const scene = ctx.scene
  if (!scene?.pan) return
  const fit = computeFit(projectNodes().filter((p): p is Pt => p !== null))
  const l = unproject(px, py, fit)
  const s = scene.getScale()
  scene.setPosition('x', -s * l.x)
  scene.setPosition('y', -s * l.y)
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderLayerLabelsFlag = true
  ctx.renderNodeLabelsFlag = true
}

function canvasPoint(e: MouseEvent): { px: number; py: number } {
  const r = canvas!.getBoundingClientRect()
  return {
    px: ((e.clientX - r.left) / r.width) * W,
    py: ((e.clientY - r.top) / r.height) * H,
  }
}

function onDown(e: MouseEvent): void {
  if (!hasNetwork || !ctx.scene?.exists()) return
  e.preventDefault()
  dragging = true
  dragBefore = captureTransforms()
  const { px, py } = canvasPoint(e)
  panToCanvasPoint(px, py)
}

function onMove(e: MouseEvent): void {
  if (!dragging) return
  const { px, py } = canvasPoint(e)
  panToCanvasPoint(px, py)
}

function onUp(): void {
  if (!dragging) return
  dragging = false
  if (dragBefore) {
    history.execute(
      new TransformCommand(
        'Navigate (minimap)',
        dragBefore,
        captureTransforms()
      )
    )
    dragBefore = null
  }
}

// --- setup ---------------------------------------------------------------

function applyVisibility(): void {
  if (container)
    container.style.display = enabled && hasNetwork ? 'block' : 'none'
}

export function setMinimapVisible(on: boolean): void {
  enabled = on
  applyVisibility()
}

export function initMinimap(): void {
  container = document.createElement('div')
  container.id = 'minimap'
  container.style.display = 'none'
  canvas = document.createElement('canvas')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  container.appendChild(canvas)
  document.body.appendChild(container)

  g = canvas.getContext('2d')
  g?.scale(dpr, dpr)

  canvas.addEventListener('mousedown', onDown)
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)

  bus.on('network:loaded', () => {
    hasNetwork = true
    applyVisibility()
  })

  registerAnimateHook(draw)
}
