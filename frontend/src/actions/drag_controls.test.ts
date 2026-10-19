import * as THREE from 'three'
import { beforeEach, describe, expect, it } from 'vitest'
import { bus } from '../bus'
import { ctx, Layer, resetContext, Scene } from '../three'
import { setCamera } from './screen'
import {
  attachLayerDragControls,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  type DragSurface,
} from './drag_controls'

function fakeSurface(): DragSurface {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }),
    addEventListener: () => {},
    style: { cursor: '', touchAction: '' },
  }
}

let surface: DragSurface

beforeEach(() => {
  resetContext()
  ctx.scene = new Scene()
  setCamera() // orthographic, ±ctx.xBoundMax (=400 headless), at z=100
  ctx.layers = [new Layer({ id: 0, name: 'L1' })]
  // Layer planes face +x (geometry baked rotateY(90°)); turn this one toward
  // the camera so a screen-center ray hits it.
  ctx.layers[0].plane.rotation.y = THREE.MathUtils.degToRad(-90)
  ctx.scene.addLayer(ctx.layers[0].plane)
  ctx.scene.THREE_Object.updateMatrixWorld(true)

  surface = fakeSurface()
  attachLayerDragControls(surface)
  onPointerCancel() // clear selection state left over from previous tests
})

describe('layer drag', () => {
  it('pointer-down over a plane selects it and sets the move cursor', () => {
    ctx.lastHoveredLayerIndex = 0 // hover pass resolved the plane
    onPointerDown({ clientX: 400, clientY: 400 }) // screen center -> origin
    expect(surface.style.cursor).toBe('move')
  })

  it('leaves the floor alone when Shift + Drag selects an area', () => {
    ctx.lastHoveredLayerIndex = 0
    onPointerDown({ clientX: 400, clientY: 400, shiftKey: true })
    ctx.scene!.leftClickPressed = true
    onPointerMove({ clientX: 500, clientY: 400, pointerType: 'mouse' })
    expect(ctx.layers[0].plane.position.x).toBe(0)
    expect(surface.style.cursor).not.toBe('move')
  })

  it('drags the hovered plane while the left button is held', () => {
    ctx.lastHoveredLayerIndex = 0
    onPointerDown({ clientX: 400, clientY: 400 })
    ctx.scene!.leftClickPressed = true

    onPointerMove({ clientX: 500, clientY: 400, pointerType: 'mouse' })
    // NDC +0.25 on an 800px-wide ortho frustum (±400) -> world x = 100
    expect(ctx.layers[0].plane.position.x).toBeCloseTo(100)
    expect(ctx.renderLayerLabelsFlag).toBe(true)
    expect(ctx.renderNodeLabelsFlag).toBe(true)
  })

  it('drags a plane sitting behind the ortho ray origin (zoomed-in regression)', () => {
    // Zooming in pushes a tilted layer's world z past the ortho ray origin
    // (~camera z=100). THREE.Ray.intersectPlane rejects t<0, which used to
    // silently freeze the drag even though hover still highlighted the plane.
    ctx.layers[0].plane.position.z = 300 // behind the origin
    ctx.scene!.THREE_Object.updateMatrixWorld(true)
    ctx.lastHoveredLayerIndex = 0
    onPointerDown({ clientX: 400, clientY: 400 })
    ctx.scene!.leftClickPressed = true
    onPointerMove({ clientX: 500, clientY: 400, pointerType: 'mouse' })
    expect(ctx.layers[0].plane.position.x).toBeCloseTo(100)
  })

  it('does not engage while a node is hovered (v2 gate)', () => {
    ctx.lastHoveredLayerIndex = 0
    ctx.lastHoveredNodeIndex = 3
    onPointerDown({ clientX: 400, clientY: 400 })
    expect(surface.style.cursor).not.toBe('move')
    ctx.scene!.leftClickPressed = true
    onPointerMove({ clientX: 500, clientY: 400, pointerType: 'mouse' })
    expect(ctx.layers[0].plane.position.x).toBe(0)
  })

  it('does not drag when no layer is hovered (v2 gate)', () => {
    ctx.lastHoveredLayerIndex = 0
    onPointerDown({ clientX: 400, clientY: 400 })
    ctx.lastHoveredLayerIndex = null
    ctx.scene!.leftClickPressed = true
    onPointerMove({ clientX: 500, clientY: 400, pointerType: 'mouse' })
    expect(ctx.layers[0].plane.position.x).toBe(0)
  })

  it('release emits layer:moved and raises the inter-edge render flag', () => {
    let moved = -1
    const off = bus.on('layer:moved', ({ layerIndex }) => (moved = layerIndex))
    ctx.lastHoveredLayerIndex = 0
    onPointerDown({ clientX: 400, clientY: 400 })
    onPointerCancel()
    expect(moved).toBe(0)
    expect(ctx.renderInterLayerEdgesFlag).toBe(true)
    expect(surface.style.cursor).toBe('auto')
    off()
  })
})
