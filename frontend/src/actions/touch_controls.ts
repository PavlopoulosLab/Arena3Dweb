// Touch gestures for phones and tablets.
//
//   one finger drag   orbit the scene (the mouse's middle-drag)
//   two fingers       pinch to zoom around the fingers, move to pan
//   double tap        select / unselect a node or layer (the double-click)
//   long press        node menu (the right-click menu)
//
// One-finger orbit and double tap are replayed as the mouse events the canvas
// already handles, so they behave — and undo — exactly like the mouse. The
// pinch is applied directly and recorded as one undo step per gesture.

import { SCALE_MAX, SCALE_MIN, ctx } from '../three'
import { history } from '../commands/base'
import {
  TransformCommand,
  captureTransforms,
  type TransformSnapshot,
} from '../commands/scene'
import {
  removeContextMenu,
  replaceContextMenuOverNode,
} from './right_click_menu'

const LONG_PRESS_MS = 550
const TAP_SLOP = 10 // px a finger may wander and still be a tap / long press
const DOUBLE_TAP_MS = 450
const TAP_MS = 450 // a press shorter than this (and than the long press) is a tap
const TOUCH_HIT_RADIUS = 24 // px around a node centre for the long-press menu
export const PINCH_MIN = SCALE_MIN
// Browsers differ in whether they add their own dblclick after a double tap
// (Chrome on Android does, iOS Safari often not), so the canvas ignores the
// browser's dblclick whenever the last pointer down was a finger and takes
// only the one this controller sends.
let lastPointerTouch = false
export const lastPointerWasTouch = () => lastPointerTouch
export const PINCH_MAX = SCALE_MAX

type Pt = { x: number; y: number }

// Pinch maths, exported for tests: new pan + scale that keep the world point
// under the fingers' midpoint where the midpoint now is.
export function pinchStep(
  pan: Pt,
  scale: number,
  mid0: Pt,
  mid1: Pt,
  ratio: number
): { pan: Pt; scale: number } {
  const next = Math.min(PINCH_MAX, Math.max(PINCH_MIN, scale * ratio))
  const k = next / scale
  return {
    // zoom about mid0, then follow the midpoint's move
    pan: {
      x: mid0.x + (pan.x - mid0.x) * k + (mid1.x - mid0.x),
      y: mid0.y + (pan.y - mid0.y) * k + (mid1.y - mid0.y),
    },
    scale: next,
  }
}

export function registerTouchControls(canvas: HTMLCanvasElement): void {
  canvas.style.touchAction = 'none' // no browser scroll / zoom on the canvas
  const fingers = new Map<number, Pt>()
  let mode: 'idle' | 'orbit' | 'pinch' | 'done' = 'idle'
  let start: Pt & { t: number } = { x: 0, y: 0, t: 0 }
  let moved = false
  let longPress: number | null = null
  let longPressed = false
  let lastTap: (Pt & { t: number }) | null = null
  let pinch: { dist: number; mid: Pt; before: TransformSnapshot } | null = null

  const rect = () => canvas.getBoundingClientRect()
  // canvas pixels -> scene world units (orthographic, origin at the centre)
  const world = (p: Pt): Pt => {
    const r = rect()
    return { x: p.x - r.left - ctx.xBoundMax, y: ctx.yBoundMax - (p.y - r.top) }
  }
  const mouse = (type: string, p: Pt, button = 1) =>
    canvas.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button,
        buttons: type === 'mouseup' ? 0 : 4,
        clientX: p.x,
        clientY: p.y,
        screenX: p.x,
        screenY: p.y,
      })
    )
  const cancelLongPress = () => {
    if (longPress !== null) window.clearTimeout(longPress)
    longPress = null
  }
  const endOrbit = (p: Pt) => {
    if (mode === 'orbit') mouse('mouseup', p)
  }
  const raise = () => {
    ctx.renderInterLayerEdgesFlag = true
    ctx.renderLayerLabelsFlag = true
    ctx.renderNodeLabelsFlag = true
  }
  const two = () => [...fingers.values()].slice(0, 2)
  const midOf = ([a, b]: Pt[]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
  const distOf = ([a, b]: Pt[]) => Math.hypot(a.x - b.x, a.y - b.y)

  // capture phase on window: sees every pointer, mouse included
  window.addEventListener(
    'pointerdown',
    (e) => {
      lastPointerTouch = e.pointerType === 'touch'
    },
    true
  )
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || !ctx.scene?.exists()) return
    e.preventDefault() // no compatibility mouse events from the browser
    canvas.setPointerCapture?.(e.pointerId)
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (fingers.size === 1) {
      mode = 'orbit'
      moved = false
      longPressed = false
      // event.timeStamp = when the touch happened, not when a busy page got
      // round to it: taps stay taps while a heavy frame renders
      start = { x: e.clientX, y: e.clientY, t: e.timeStamp }
      ctx.mousePreviousX = e.clientX
      ctx.mousePreviousY = e.clientY
      mouse('mousedown', start)
      cancelLongPress()
      longPress = window.setTimeout(() => {
        longPress = null
        if (moved || fingers.size !== 1) return
        longPressed = true
        endOrbit(start)
        mode = 'done'
        const r = rect()
        replaceContextMenuOverNode({
          layerX: start.x - r.left,
          layerY: start.y - r.top,
          preventDefault: () => undefined,
          hitRadius: TOUCH_HIT_RADIUS,
        })
      }, LONG_PRESS_MS)
    } else if (fingers.size === 2) {
      cancelLongPress()
      endOrbit(start)
      const pts = two()
      mode = 'pinch'
      pinch = {
        dist: distOf(pts),
        mid: midOf(pts),
        before: captureTransforms(),
      }
    }
  })

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch' || !fingers.has(e.pointerId)) return
    e.preventDefault()
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (mode === 'orbit') {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP) {
        moved = true
        cancelLongPress()
      }
      mouse('mousemove', { x: e.clientX, y: e.clientY })
    } else if (mode === 'pinch' && pinch && fingers.size >= 2 && ctx.scene) {
      const pts = two()
      const dist = distOf(pts)
      const mid = midOf(pts)
      const s = ctx.scene
      const step = pinchStep(
        { x: s.getPosition('x'), y: s.getPosition('y') },
        s.getScale(),
        world(pinch.mid),
        world(mid),
        pinch.dist > 0 ? dist / pinch.dist : 1
      )
      s.setScale(step.scale)
      s.setPosition('x', step.pan.x)
      s.setPosition('y', step.pan.y)
      pinch.dist = dist
      pinch.mid = mid
      raise()
    }
  })

  const lift = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !fingers.has(e.pointerId)) return
    e.preventDefault()
    const p = fingers.get(e.pointerId)!
    fingers.delete(e.pointerId)
    if (mode === 'pinch' && fingers.size < 2) {
      if (pinch)
        history.execute(
          new TransformCommand('Pinch zoom', pinch.before, captureTransforms())
        )
      pinch = null
      mode = 'done' // the last finger lifting ends the gesture, no orbit jump
    }
    if (fingers.size > 0) return
    cancelLongPress()
    if (mode === 'orbit') {
      endOrbit(p)
      const now = e.timeStamp
      const tap = !moved && !longPressed && now - start.t < TAP_MS
      if (tap) {
        removeContextMenu() // like a left click: a tap closes the node menu
        if (
          lastTap &&
          now - lastTap.t < DOUBLE_TAP_MS &&
          Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 30
        ) {
          canvas.dispatchEvent(
            new MouseEvent('dblclick', {
              bubbles: true,
              cancelable: true,
              clientX: p.x,
              clientY: p.y,
            })
          )
          lastTap = null
        } else lastTap = { x: p.x, y: p.y, t: now }
      }
    }
    mode = 'idle'
  }
  canvas.addEventListener('pointerup', lift)
  canvas.addEventListener('pointercancel', lift)
}
