// Renderer, camera, window bounds, raycaster and the render loop.
// Port of v2 www/js/object_actions/screen.js. Shiny sync calls dropped.

import * as THREE from 'three'
import { SCALE_MAX, ctx, edgeResolution } from '../three'
import {
  onBackgroundColor,
  renderFrame,
  resizePostprocessing,
} from '../three/postprocessing'
import { renderInterLayerEdges } from './edge'

// v2 global raycaster (config/global_variables.js). Reused each frame.
const RAYCASTER = new THREE.Raycaster()
const RAYVECTOR = new THREE.Vector3()
const RAYDIR = new THREE.Vector3()

// Phones/tablets (coarse pointer) render at most 1.5x: a 3x phone screen
// would otherwise push four times the pixels for little visible gain.
function maxPixelRatio(): number {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
    ? 1.5
    : 2
}

// The device's ratio (capped at 2: full retina sharpness without the 3x+
// fill-rate cost on mobile) unless the Performance panel set a render scale.
function pixelRatio(): number {
  return ctx.renderScale ?? Math.min(window.devicePixelRatio, maxPixelRatio())
}

export function setRenderer(): void {
  ctx.renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  })
  ctx.renderer.setPixelRatio(pixelRatio())
}

// Performance panel: render at a fixed pixel ratio (null = the device's)
export function applyRenderScale(scale: number | null): void {
  ctx.renderScale = scale
  resizeRenderer()
}

export function resetScreen(): void {
  setWindowBounds()
  setCamera()
  resizeRenderer()
  // Bounds changed — label divs are positioned off xBoundMax/yBoundMax.
  ctx.renderLayerLabelsFlag = true
  ctx.renderNodeLabelsFlag = true
}

export function setWindowBounds(): void {
  ctx.xBoundMin = -window.innerWidth / 2
  ctx.xBoundMax = window.innerWidth / 2
  ctx.yBoundMin = -window.innerHeight / 2
  ctx.yBoundMax = window.innerHeight / 2
  ctx.zBoundMin = -window.innerHeight / 2.5
  ctx.zBoundMax = window.innerHeight / 2.5
  // Every edge LineMaterial shares this uniform; keep it on the frustum size
  // so screen-space linewidths keep reading as world units.
  edgeResolution.set(window.innerWidth, window.innerHeight)
}

export function setCamera(): void {
  // orthographic: left, right, top, bottom, near, far. The depth range grows
  // with the zoom range: a stack zoomed in SCALE_MAX times is still inside.
  ctx.camera = new THREE.OrthographicCamera(
    ctx.xBoundMin,
    ctx.xBoundMax,
    ctx.yBoundMax,
    ctx.yBoundMin,
    -4 * ctx.xBoundMax * SCALE_MAX,
    4 * ctx.xBoundMax * SCALE_MAX
  )
  ctx.camera.position.set(0, 0, 100)
  ctx.camera.lookAt(0, 0, 0)
}

export function resizeRenderer(): void {
  // Re-read DPR too: the window may have moved between monitors.
  ctx.renderer?.setPixelRatio(pixelRatio())
  ctx.renderer?.setSize(2 * ctx.xBoundMax, 2 * ctx.yBoundMax)
  resizePostprocessing(2 * ctx.xBoundMax, 2 * ctx.yBoundMax)
}

export function setRendererColor(hexColor: string): void {
  if (ctx.scene?.exists()) {
    ctx.renderer?.setClearColor(hexColor)
    onBackgroundColor(hexColor) // bloom only stays on over dark backgrounds
  }
}

// Publication image export: render the scene into an offscreen renderer with
// an orthographic frustum fitted to the visible layers/nodes, at a fixed
// long-edge resolution, composite the visible DOM-overlay labels on top,
// then download as PNG.
const EXPORT_LONG_EDGE = 4096 // safe max renderbuffer size on all GPUs

// `longEdge` > 4096 (print/poster sizes) is capped at what this GPU's
// renderbuffers allow.
export function exportSceneImage(longEdge = EXPORT_LONG_EDGE): boolean {
  if (!ctx.scene?.exists() || !ctx.renderer || !ctx.camera) return false

  ctx.scene.THREE_Object.updateMatrixWorld(true)
  const box = new THREE.Box3()
  const meshBox = new THREE.Box3()
  for (const layer of ctx.layers) {
    if (!layer.isVisible) continue
    // traverseVisible skips individually hidden nodes (channel toggles etc.)
    layer.plane.traverseVisible((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
        meshBox.setFromObject(obj)
        box.union(meshBox)
      }
    })
  }
  if (box.isEmpty()) return false

  // Grow the box so visible labels fit too. Label divs render at 1 CSS px per
  // world unit in the main view, so offsetWidth/Height are world sizes.
  const zMid = (box.min.z + box.max.z) / 2
  const corner = new THREE.Vector3()
  forEachVisibleLabel((div, worldX, worldY, offsetX, offsetY) => {
    const left = worldX + offsetX
    const top = worldY - offsetY
    box.expandByPoint(corner.set(left, top, zMid))
    box.expandByPoint(
      corner.set(left + div.offsetWidth, top - div.offsetHeight, zMid)
    )
  })

  // Camera sits at (0,0,100) looking down -z with no roll, so world x/y map
  // straight onto the frustum sides. 5% margin around the fitted box.
  const size = box.getSize(new THREE.Vector3())
  const pad = 0.05 * Math.max(size.x, size.y)
  const camera = ctx.camera.clone()
  camera.left = box.min.x - pad
  camera.right = box.max.x + pad
  camera.top = box.max.y + pad
  camera.bottom = box.min.y - pad
  camera.updateProjectionMatrix()

  const w = camera.right - camera.left
  const h = camera.top - camera.bottom
  const maxEdge = Math.min(
    longEdge,
    ctx.renderer.capabilities.maxTextureSize,
    ctx.renderer
      .getContext()
      .getParameter(ctx.renderer.getContext().MAX_RENDERBUFFER_SIZE) as number
  )
  const scale = maxEdge / Math.max(w, h)
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  })
  renderer.setSize(Math.round(w * scale), Math.round(h * scale), false)
  renderer.setClearColor(ctx.renderer.getClearColor(new THREE.Color()), 1)
  // Edge linewidths are screen-space against the shared frustum-sized
  // resolution; point it at the export frustum for this render so widths
  // scale with the PNG, then hand it back to the live view.
  edgeResolution.set(w, h)
  renderer.render(ctx.scene.THREE_Object, camera)
  edgeResolution.set(2 * ctx.xBoundMax, 2 * ctx.yBoundMax)

  // Composite onto a 2D canvas so the DOM-overlay labels can be drawn on top.
  const out = document.createElement('canvas')
  out.width = renderer.domElement.width
  out.height = renderer.domElement.height
  const g = out.getContext('2d')
  if (!g) return false
  g.drawImage(renderer.domElement, 0, 0)
  drawExportLabels(g, camera, scale)

  out.toBlob((blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'arena3d_scene.png'
      a.click()
      URL.revokeObjectURL(url)
    }
    renderer.dispose()
    renderer.forceContextLoss()
  }, 'image/png')
  return true
}

// Draw the currently visible label divs (#labelDiv, kept in sync by the
// animate loop) into the export canvas. Read from the DOM rather than
// labels.ts — importing labels here would recreate the screen -> labels ->
// node -> screen cycle the animate hooks exist to avoid. Positions come from
// the same world coords the divs use; offsets/fonts scale with the export.
function drawExportLabels(
  g: CanvasRenderingContext2D,
  camera: THREE.OrthographicCamera,
  scale: number
): void {
  g.textBaseline = 'top'
  forEachVisibleLabel((div, worldX, worldY, offsetX, offsetY) => {
    const cs = getComputedStyle(div)
    g.font = `${parseFloat(cs.fontSize) * scale}px ${cs.fontFamily}`
    g.fillStyle = cs.color
    g.fillText(
      div.textContent ?? '',
      (worldX - camera.left + offsetX) * scale,
      (camera.top - worldY + offsetY) * scale
    )
  })
}

// Iterate the currently visible label divs with their world-space anchor and
// screen-px nudge (same +7/-10 renderNodeLabels applies; layers anchor at
// their sphere). Shared by the fit box and the label drawing above.
function forEachVisibleLabel(
  cb: (
    div: HTMLDivElement,
    worldX: number,
    worldY: number,
    offsetX: number,
    offsetY: number
  ) => void
): void {
  const container = document.getElementById('labelDiv')
  if (!container) return

  // div order matches ctx registries: createLabels appends one div per
  // nodeObjects entry, then one per layer.
  container.querySelectorAll<HTMLDivElement>('.labels').forEach((div, i) => {
    const node = ctx.nodeObjects[i]
    if (!node || div.style.display === 'none') return
    cb(div, node.getWorldPosition('x'), node.getWorldPosition('y'), 7, -10)
  })
  container
    .querySelectorAll<HTMLDivElement>('.layer-labels')
    .forEach((div, i) => {
      const layer = ctx.layers[i]
      if (!layer || div.style.display === 'none') return
      const world = layer.sphere.getWorldPosition(RAYVECTOR)
      cb(div, world.x, world.y, 0, 0)
    })
}

// Loading spinner (v2 handler_startLoader/finishLoader): show #loader and dim
// the canvas while a backend call is in flight.
export function startLoader(): void {
  const app = document.getElementById('app')
  const loader = document.getElementById('loader')
  if (app) app.style.opacity = '0.5'
  if (loader) loader.style.display = 'inline-block'
}

export function finishLoader(): void {
  const app = document.getElementById('app')
  const loader = document.getElementById('loader')
  if (app) app.style.opacity = '1'
  if (loader) loader.style.display = 'none'
}

// Build the raycaster from a mouse event (used by node/layer hover — Phase 12+).
export function setRaycaster(event: {
  clientX: number
  clientY: number
}): void {
  if (!ctx.camera) return
  RAYVECTOR.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1,
    -1 // z = -1 important!
  )
  RAYVECTOR.unproject(ctx.camera)
  RAYDIR.set(0, 0, -1).transformDirection(ctx.camera.matrixWorld)
  RAYCASTER.set(RAYVECTOR, RAYDIR)
}

export function raycaster(): THREE.Raycaster {
  return RAYCASTER
}

// Per-tick hooks (labels.ts registers its render fns here; avoids an
// import cycle screen -> labels -> node -> screen).
const animateHooks: Array<() => void> = []
export function registerAnimateHook(fn: () => void): void {
  animateHooks.push(fn)
}

// Labels are DOM overlays positioned from world coordinates, and inter-layer
// edges bake world coordinates into their geometry (they hang off the scene
// root, not the pan/sphere hierarchy) — neither follows scene transforms on
// its own. Any scene-level transform (pan, orbit, zoom, auto-rotate) moves
// everything under the scene sphere, so watch its world matrix and re-flag
// both when it changes.
const lastSphereMatrix = new THREE.Matrix4()
function flagWorldSpaceRedrawsOnSceneMove(): void {
  const sphere = ctx.scene?.sphere
  if (!sphere) return
  sphere.updateWorldMatrix(true, false)
  if (!lastSphereMatrix.equals(sphere.matrixWorld)) {
    lastSphereMatrix.copy(sphere.matrixWorld)
    ctx.renderLayerLabelsFlag = true
    ctx.renderNodeLabelsFlag = true
    ctx.renderInterLayerEdgesFlag = true
  }
}

// FPS-limited render loop. Pure rAF (no setTimeout) so the browser can
// align frames with vsync and auto-pause when the tab is hidden; the
// timestamp check enforces ctx.fps as an upper bound.
// each distinct frame error is logged once, not 60 times a second
const reportedFrameErrors = new Set<string>()
function reportFrameError(err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err)
  if (reportedFrameErrors.has(msg)) return
  reportedFrameErrors.add(msg)
  console.error('Arena3D frame step failed:', err)
}

let lastFrameTime = 0
export function animate(now = 0): void {
  requestAnimationFrame(animate)
  const interval = 1000 / ctx.fps
  if (now - lastFrameTime < interval) return
  // Snap to the frame grid so throttled rates stay even (e.g. 30 on 60Hz).
  lastFrameTime = now - ((now - lastFrameTime) % interval)

  // a step that throws must not freeze the picture: report it, draw anyway
  try {
    flagWorldSpaceRedrawsOnSceneMove()
    renderInterLayerEdges()
    for (const fn of animateHooks) fn()
  } catch (err) {
    reportFrameError(err)
  }
  renderFrame()
  // measured frame rate for the Performance panel
  frames++
  if (now - statStart >= 1000) {
    measuredFps = (frames * 1000) / (now - statStart)
    frames = 0
    statStart = now
  }
}

let frames = 0
let statStart = 0
let measuredFps = 0

export interface PerfStats {
  fps: number
  calls: number
  triangles: number
  lines: number
  geometries: number
  textures: number
  nodes: number
  edges: number
  pixelRatio: number
}

// What the renderer did in the last frame, for the Performance panel
export function perfStats(): PerfStats {
  const info = ctx.renderer?.info
  return {
    fps: measuredFps,
    calls: info?.render.calls ?? 0,
    triangles: info?.render.triangles ?? 0,
    lines: info?.render.lines ?? 0,
    geometries: info?.memory.geometries ?? 0,
    textures: info?.memory.textures ?? 0,
    nodes: ctx.nodeObjects.length,
    edges: ctx.edgeObjects.length,
    pixelRatio: ctx.renderer?.getPixelRatio() ?? 1,
  }
}
