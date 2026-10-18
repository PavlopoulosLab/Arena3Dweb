// Canvas mouse/keyboard scene controls — port of the canvas half of v2
// www/js/event_listeners.js plus the held-key/lasso helpers it pulled from
// node.js/layer.js. Shiny syncs and the 100ms update debounces dropped.
// Deferred: DragControls layer dragging, nav-button/slider control table
// (Phase 13 UI).

import * as THREE from 'three'
import { bus } from '../bus'
import { clampScale, ctx } from '../three'
import { registerAnimateHook } from './screen'
import { history } from '../commands/base'
import {
  captureTransforms,
  TransformCommand,
  type TransformSnapshot,
} from '../commands/scene'
import { redrawIntraLayerEdges, unselectAllEdges } from './edge'
import {
  checkHoverOverLayer,
  getSelectedLayers,
  repaintLayers,
  performDoubleClickLayerSelection,
} from './layer'
import {
  checkHoverOverNode,
  decideNodeLabelFlags,
  getSelectedNodes,
  performDoubleClickNodeSelection,
  repaintNode,
  unselectAllNodes,
  updateSelectedNodesStore,
} from './node'
import {
  removeContextMenu,
  replaceContextMenuOverNode,
} from './right_click_menu'
import { lastPointerWasTouch, registerTouchControls } from './touch_controls'
import { fitView } from './search'

// v2 globals: lasso anchor (shift+click) and the selection outline.
// Node indices the current selection outline covers. Tracked explicitly so
// selection doesn't rely on the opacity-0.5 sentinel, which hover also sets
// (a node hovered at mouse-up would otherwise be selected too).
const lassoHits = new Set<number>()
let shiftX: number | null = null
let shiftY: number | null = null
let lasso: THREE.Line | null = null

// Shift + drag selects an area: a rectangle (v2) or a freehand lasso, as
// chosen in the Navigation Controls; the choice is remembered in the browser.
export type SelectShape = 'rectangle' | 'lasso'
const SHAPE_KEY = 'arena3d.selectShape'
let selectShape: SelectShape = (() => {
  try {
    return localStorage.getItem(SHAPE_KEY) === 'lasso' ? 'lasso' : 'rectangle'
  } catch {
    return 'rectangle'
  }
})()
export const getSelectShape = (): SelectShape => selectShape
export function setSelectShape(shape: SelectShape): void {
  selectShape = shape
  try {
    localStorage.setItem(SHAPE_KEY, shape)
  } catch {
    /* private mode: the choice lasts for this visit */
  }
}
// What the area does to the selection: replaces it, adds to it (v2), or takes
// its nodes out of it — remembered too. Alt / Option held when the mouse is
// released takes them out whatever the choice.
export type SelectCombine = 'new' | 'add' | 'remove'
const COMBINE_KEY = 'arena3d.selectCombine'
let selectCombine: SelectCombine = (() => {
  try {
    const v = localStorage.getItem(COMBINE_KEY)
    return v === 'new' || v === 'remove' ? v : 'add'
  } catch {
    return 'add'
  }
})()
export const getSelectCombine = (): SelectCombine => selectCombine
export function setSelectCombine(combine: SelectCombine): void {
  selectCombine = combine
  try {
    localStorage.setItem(COMBINE_KEY, combine)
  } catch {
    /* private mode: the choice lasts for this visit */
  }
}
// the freehand lasso's points (scene x, y), from the press onwards
let lassoPath: [number, number][] = []
// above this many node × point tests, the lasso selects on release only, so
// drawing stays smooth on big networks
const LIVE_LASSO_WORK = 2_000_000

// Ray casting: is (x, y) inside the polygon?
export function pointInPolygon(
  x: number,
  y: number,
  polygon: readonly (readonly [number, number])[]
): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

type CanvasMouseEvent = MouseEvent & { layerX: number; layerY: number }

// Mouse drags (pan, orbit, held-key node/layer transforms) register one undo
// entry per drag: snapshot on press, command pushed on release if a transform
// branch actually ran (lasso/selection drags don't count).
let dragBefore: TransformSnapshot | null = null
let transformDragged = false

// Smooth wheel zoom: the wheel sets a target scale (same bounds as
// Scene.zoom) and easeZoomStep lerps toward it each frame. Users with
// prefers-reduced-motion get the old instant zoom.
let zoomTarget: number | null = null
// World point (pan-space) under the cursor to keep fixed while zooming.
let zoomAnchorX = 0
let zoomAnchorY = 0
const reducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Shift pan so the anchor stays under the cursor as scale goes from -> to.
// Ortho camera + full-window frustum means world units == centered pixels,
// and the pan node scales about its own origin, so anchoring is pure math.
function anchorZoom(from: number, to: number): void {
  const ratio = to / from
  for (const axis of ['x', 'y'] as const) {
    const anchor = axis === 'x' ? zoomAnchorX : zoomAnchorY
    const pos = ctx.scene!.getPosition(axis)
    ctx.scene!.setPosition(axis, anchor + (pos - anchor) * ratio)
  }
}

// on mouse wheel scroll
export function sceneZoom(event: WheelEvent): void {
  if (!ctx.scene?.exists()) return
  event.preventDefault() // keep the page from scrolling (v2 initializeCanvasDiv)
  zoomAnchorX = (event.offsetX ?? ctx.xBoundMax) - ctx.xBoundMax
  zoomAnchorY = ctx.yBoundMax - (event.offsetY ?? ctx.yBoundMax)
  if (reducedMotion()) {
    const from = ctx.scene.getScale()
    ctx.scene.zoom(event.deltaY)
    anchorZoom(from, ctx.scene.getScale())
    return
  }
  const current = zoomTarget ?? ctx.scene.getScale()
  const factor = event.deltaY < 0 ? 1.1 : 0.9
  zoomTarget = clampScale(current * factor)
}

export function easeZoomStep(): void {
  if (zoomTarget === null || !ctx.scene?.exists()) return
  const scale = ctx.scene.getScale()
  let next = scale + (zoomTarget - scale) * 0.25
  const done = Math.abs(next - zoomTarget) < 0.001
  if (done) next = zoomTarget
  anchorZoom(scale, next)
  ctx.scene.setScale(next)
  if (done) zoomTarget = null
}

export function resetZoomTarget(): void {
  zoomTarget = null
}

const ARROW_CODES: Record<string, number> = {
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
}

// on z/x/c axis select (held-key layer/node transforms) or arrow-key pan
export function keyPressed(event: KeyboardEvent): void {
  if (!ctx.scene?.exists()) return
  if (event.ctrlKey || event.metaKey) return // Ctrl+Z etc. aren't axis holds
  const key = event.key.toLowerCase()
  if (key === 'z' || key === 'x' || key === 'c') ctx.scene.axisPressed = key
  else if (event.key in ARROW_CODES) {
    event.preventDefault()
    ctx.scene.translatePanWithArrow(ARROW_CODES[event.key])
  }
}

export function axisRelease(): void {
  if (ctx.scene?.exists()) ctx.scene.axisPressed = ''
}

// mouse: 0 left, 1 middle, 2 right click
export function clickDown(event: CanvasMouseEvent): void {
  if (!ctx.scene?.exists()) return
  if (event.button === 0 || event.button === 1) {
    dragBefore = captureTransforms()
    transformDragged = false
  }
  if (event.button === 0) {
    ctx.scene.leftClickPressed = true
    ctx.scene.middleClickPressed = false
    if (event.shiftKey && shiftX === null) {
      shiftX = event.layerX - ctx.xBoundMax
      shiftY = ctx.yBoundMax - event.layerY // used in drag
    }
  } else if (event.button === 1) {
    event.preventDefault() // no middle-click autoscroll
    ctx.scene.middleClickPressed = true
    ctx.scene.leftClickPressed = false
  } else {
    ctx.scene.middleClickPressed = false
    ctx.scene.leftClickPressed = false
  }
}

// while mouse button held, drag event
export function clickDrag(event: CanvasMouseEvent): void {
  if (!ctx.scene?.exists()) return
  const distance = Math.hypot(
    ctx.mousePreviousX - event.screenX,
    ctx.mousePreviousY - event.screenY
  )

  // Held-key node/layer transforms apply a fixed step per processed event, so
  // they keep the v2 10px granularity; pan/orbit/lasso use deltas and get a
  // finer 2px threshold for smoother motion (v2's 10px gate made orbit jump
  // in ~10-degree increments).
  const heldKeyTransform =
    ctx.scene.leftClickPressed &&
    !event.shiftKey &&
    ctx.scene.axisPressed !== ''
  const threshold = heldKeyTransform ? 10 : 2

  if (distance > threshold) {
    const x = event.screenX
    const y = event.screenY

    if (ctx.scene.leftClickPressed) {
      ctx.scene.dragging = true
      if (event.shiftKey) {
        ctx.lastHoveredLayerIndex = null // to be able to lasso inside a layer
        lassoSelectNodes(
          event.layerX - ctx.xBoundMax,
          ctx.yBoundMax - event.layerY
        )
      } else if (
        ctx.scene.axisPressed !== '' &&
        getSelectedNodes().length > 0
      ) {
        translateNodesWithHeldKey(event)
        transformDragged = true
      } else if (ctx.scene.axisPressed !== '') {
        if (ctx.networkMode === 'single') rotateSceneWithHeldKey(event)
        else rotateLayersWithHeldKey(event)
        transformDragged = true
      } else if (ctx.networkMode === 'single') {
        // one graph, no layers to drag: the left button turns it
        ctx.scene.orbitSphereWithMouse(x, y)
        transformDragged = true
      } else if (
        ctx.lastHoveredLayerIndex === null &&
        ctx.lastHoveredNodeIndex === null
      ) {
        ctx.scene.translatePanWithMouse(x, y)
        transformDragged = true
      }
    } else if (ctx.scene.middleClickPressed) {
      ctx.scene.dragging = true
      event.preventDefault()
      if (ctx.networkMode === 'single') ctx.scene.translatePanWithMouse(x, y)
      else ctx.scene.orbitSphereWithMouse(x, y)
      transformDragged = true
    }

    ctx.mousePreviousX = x
    ctx.mousePreviousY = y
  }

  // Coalesce hover raycasts to one per rendered frame — raycasting every
  // node sphere per mousemove gets expensive on large networks.
  if (!ctx.scene.leftClickPressed && !ctx.scene.middleClickPressed)
    pendingHover = { clientX: event.clientX, clientY: event.clientY }
}

let pendingHover: { clientX: number; clientY: number } | null = null

export function processPendingHover(): void {
  if (!pendingHover || !ctx.scene?.exists()) return
  const event = pendingHover
  pendingHover = null
  if (checkHoverOverNode(event)) return
  if (ctx.networkMode === 'single') {
    // no floors to hover or drag in single-network mode
    if (ctx.hoveredLayerPaintedFlag) {
      repaintLayers()
      ctx.hoveredLayerPaintedFlag = false
    }
    ctx.lastHoveredLayerIndex = null
  } else checkHoverOverLayer(event)
}

export function clickUp(event: MouseEvent): void {
  if (!ctx.scene?.exists()) return
  ctx.scene.dragging = false
  if (dragBefore && transformDragged) {
    history.execute(
      new TransformCommand('Drag scene', dragBefore, captureTransforms())
    )
  }
  dragBefore = null
  transformDragged = false
  if (event.button === 0) {
    ctx.scene.leftClickPressed = false
    // Only a real left-click on the canvas dismisses the menu. mouseleave also
    // routes here (to release drag state), but firing removeContextMenu on it
    // killed the just-opened menu the instant the mouse moved off the canvas
    // toward it — so the options were never reachable.
    if (event.type === 'mouseup') removeContextMenu() // v2 removed the right-click options list here
    if (lasso) {
      // a big network's freehand lasso is tested once, now
      if (selectShape === 'lasso') lassoHitTest(lassoPath)
      // the nodes the outline covered: the selection, added, or taken out
      const combine = event.altKey ? 'remove' : selectCombine
      ctx.nodeObjects.forEach((node, i) => {
        const hit = lassoHits.has(i)
        if (hit) node.setOpacity(1)
        const selected =
          combine === 'remove'
            ? node.isSelected && !hit
            : hit || (combine === 'add' && node.isSelected)
        if (selected === node.isSelected) return
        node.isSelected = selected
        repaintNode(i)
      })
      decideNodeLabelFlags()
      updateSelectedNodesStore()
      ctx.scene.remove(lasso)
      lasso.geometry.dispose()
      lasso = null
      lassoHits.clear()
    }
    lassoPath = []
    shiftX = null
    shiftY = null
  } else if (event.button === 1) ctx.scene.middleClickPressed = false
}

// double click: select node -> select layer -> unselect everything
export function dblClick(event: CanvasMouseEvent): void {
  if (!ctx.scene?.exists()) return
  // a browser's own double-tap dblclick: touch_controls already sent ours
  if (event.isTrusted && lastPointerWasTouch()) return
  if (performDoubleClickNodeSelection(event)) return
  if (ctx.lastHoveredLayerIndex !== null) performDoubleClickLayerSelection()
  else {
    // the background: clear the selection and bring the whole network back
    // into the window (the way out of a deep zoom)
    unselectAllNodes()
    unselectAllEdges()
    redrawIntraLayerEdges()
    resetZoomTarget() // a wheel zoom still easing would pull the view back
    fitView()
  }
}

// v2 node.js translateNodesWithHeldKey — z/c + drag moves selected nodes.
export function translateNodesWithHeldKey(event: {
  screenX: number
  screenY: number
}): void {
  const step =
    event.screenX - event.screenY >= ctx.mousePreviousX - ctx.mousePreviousY
      ? 20
      : -20

  for (const i of getSelectedNodes()) {
    if (ctx.scene!.axisPressed === 'z') ctx.nodeObjects[i].translateZ(step)
    else if (ctx.scene!.axisPressed === 'c') ctx.nodeObjects[i].translateY(step)
  }
  redrawIntraLayerEdges()
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderNodeLabelsFlag = true // labels follow the moved nodes
}

// v2 layer.js rotateLayersWithHeldKey — z/x/c + drag rotates selected layers.
export function rotateLayersWithHeldKey(event: {
  screenX: number
  screenY: number
}): void {
  const rads =
    event.screenX - event.screenY >= ctx.mousePreviousX - ctx.mousePreviousY
      ? 0.05
      : -0.05

  for (const i of getSelectedLayers()) {
    if (ctx.scene!.axisPressed === 'z') ctx.layers[i].rotateZ(rads)
    else if (ctx.scene!.axisPressed === 'x') ctx.layers[i].rotateX(rads)
    else if (ctx.scene!.axisPressed === 'c') ctx.layers[i].rotateY(rads)
  }
  ctx.renderInterLayerEdgesFlag = true
}

// Single-network mode: z/x/c + drag turns the whole network about that axis
// (there are no layers to rotate).
export function rotateSceneWithHeldKey(event: {
  screenX: number
  screenY: number
}): void {
  const rads =
    event.screenX - event.screenY >= ctx.mousePreviousX - ctx.mousePreviousY
      ? 0.05
      : -0.05
  const axis = ctx.scene!.axisPressed
  if (axis === 'z') ctx.scene!.rotateZ(rads)
  else if (axis === 'x') ctx.scene!.rotateX(rads)
  else if (axis === 'c') ctx.scene!.rotateY(rads)
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderLayerLabelsFlag = true
  ctx.renderNodeLabelsFlag = true
}

// v2 node.js lassoSelectNodes — shift + left-drag area select: a rectangle
// from the press to the pointer, or a freehand lasso along the pointer's path.
export function lassoSelectNodes(x: number, y: number): void {
  if (shiftX === null || shiftY === null) return
  if (selectShape === 'rectangle') {
    const outline: [number, number][] = [
      [shiftX, shiftY],
      [x, shiftY],
      [x, y],
      [shiftX, y],
    ]
    drawOutline(outline)
    lassoHitTest(outline)
    return
  }
  if (lassoPath.length === 0) lassoPath.push([shiftX, shiftY])
  const [lx, ly] = lassoPath[lassoPath.length - 1]
  if (Math.hypot(x - lx, y - ly) >= 3) lassoPath.push([x, y])
  drawOutline(lassoPath)
  if (ctx.nodeObjects.length * lassoPath.length <= LIVE_LASSO_WORK)
    lassoHitTest(lassoPath)
}

// The nodes inside the outline: half-faded as feedback, kept in lassoHits
function lassoHitTest(outline: [number, number][]): void {
  lassoHits.clear()
  if (outline.length < 3) {
    ctx.nodeObjects.forEach((node) => node.setOpacity(1))
    return
  }
  const xs = outline.map(([px]) => px)
  const ys = outline.map(([, py]) => py)
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)]
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)]
  ctx.nodeObjects.forEach((node, i) => {
    const nx = node.getWorldPosition('x')
    const ny = node.getWorldPosition('y')
    const inside =
      nx > minX &&
      nx < maxX &&
      ny > minY &&
      ny < maxY &&
      pointInPolygon(nx, ny, outline)
    node.setOpacity(inside ? 0.5 : 1) // visual feedback only
    if (inside) lassoHits.add(i)
  })
}

const lassoMaterial = new THREE.LineBasicMaterial({ color: '#eef1b6' })

// The outline, closed back to its first point
function drawOutline(outline: [number, number][]): void {
  if (lasso) {
    ctx.scene!.remove(lasso)
    lasso.geometry.dispose() // rebuilt every pointer move — don't accumulate
  }
  const points = [...outline, outline[0]].map(
    ([px, py]) => new THREE.Vector3(px, py, 0)
  )
  lasso = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    lassoMaterial
  )
  ctx.scene!.add(lasso)
}

// Called once from main.ts, after the canvas is mounted.
export function registerCanvasControls(): void {
  const canvas = ctx.renderer?.domElement
  if (!canvas) return
  registerAnimateHook(easeZoomStep)
  registerAnimateHook(processPendingHover)
  bus.on('network:loaded', resetZoomTarget) // new scene -> stale zoom target
  canvas.tabIndex = 1 // focusable, so it receives keydown events (v2)
  canvas.addEventListener('wheel', sceneZoom)
  canvas.addEventListener('keydown', keyPressed)
  canvas.addEventListener('keyup', axisRelease)
  canvas.addEventListener('mousedown', clickDown as EventListener)
  canvas.addEventListener('mousemove', clickDrag as EventListener)
  canvas.addEventListener('mouseup', clickUp)
  canvas.addEventListener('dblclick', dblClick as EventListener)
  canvas.addEventListener('mouseleave', clickUp) // release buttons on exit (v2)
  canvas.addEventListener(
    'contextmenu',
    replaceContextMenuOverNode as unknown as EventListener
  )
  registerTouchControls(canvas) // phones/tablets: orbit, pinch, taps
}
