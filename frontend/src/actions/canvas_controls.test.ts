import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ctx, Layer, Node, resetContext, Scene } from '../three'
import {
  axisRelease,
  cancelPointerState,
  clickDown,
  clickDrag,
  clickUp,
  dblClick,
  keyPressed,
  lassoSelectNodes,
  pointInPolygon,
  rotateLayersWithHeldKey,
  sceneZoom,
  easeZoomStep,
} from './canvas_controls'

type AnyEvent = Parameters<typeof clickDown>[0]

function fakeEvent(partial: Partial<AnyEvent>): AnyEvent {
  return {
    button: 0,
    shiftKey: false,
    screenX: 0,
    screenY: 0,
    layerX: 0,
    layerY: 0,
    preventDefault: () => {},
    ...partial,
  } as AnyEvent
}

beforeEach(() => {
  resetContext()
  ctx.scene = new Scene()
  ctx.layers = [new Layer({ id: 0, name: 'L1' })]
  ctx.layerGroups = { L1: 0 }
  ctx.nodeGroups = { A_L1: 'L1', B_L1: 'L1' }
  ctx.nodeLayerNames = ['A_L1', 'B_L1']
  ctx.nodeObjects = [
    new Node({ id: 0, name: 'A', nodeLayerName: 'A_L1', layer: 'L1' }),
    new Node({
      id: 1,
      name: 'B',
      nodeLayerName: 'B_L1',
      layer: 'L1',
      position_x: 50,
      position_y: 50,
    }),
  ]
})

describe('keyboard', () => {
  it('z/x/c set the pressed axis; keyup releases it', () => {
    keyPressed({ key: 'z', preventDefault: () => {} } as KeyboardEvent)
    expect(ctx.scene!.axisPressed).toBe('z')
    axisRelease()
    expect(ctx.scene!.axisPressed).toBe('')
  })

  it('arrow keys pan the scene', () => {
    const spy = vi.spyOn(ctx.scene!, 'translatePanWithArrow')
    keyPressed({
      key: 'ArrowRight',
      preventDefault: () => {},
    } as KeyboardEvent)
    expect(spy).toHaveBeenCalledWith(39)
  })
})

describe('zoom', () => {
  it('wheel scroll eases the scene scale toward the target', () => {
    const before = ctx.scene!.getScale()
    sceneZoom({ deltaY: -1, preventDefault: () => {} } as WheelEvent)
    for (let i = 0; i < 60; i++) easeZoomStep()
    expect(ctx.scene!.getScale()).toBeCloseTo(before * 1.1)
  })
})

describe('drag', () => {
  it('left-drag with nothing hovered pans the scene', () => {
    const spy = vi.spyOn(ctx.scene!, 'translatePanWithMouse')
    clickDown(fakeEvent({ button: 0 }))
    clickDrag(fakeEvent({ screenX: 50, screenY: 0 }))
    expect(ctx.scene!.dragging).toBe(true)
    expect(spy).toHaveBeenCalledWith(50, 0)
    expect(ctx.mousePreviousX).toBe(50)
  })

  it('middle-drag orbits the scene sphere', () => {
    const spy = vi.spyOn(ctx.scene!, 'orbitSphereWithMouse')
    clickDown(fakeEvent({ button: 1 }))
    clickDrag(fakeEvent({ screenX: 0, screenY: 50 }))
    expect(spy).toHaveBeenCalled()
  })

  it('held axis key rotates selected layers instead of panning', () => {
    ctx.layers[0].isSelected = true
    ctx.scene!.axisPressed = 'z'
    const before = ctx.layers[0].getRotation('z')
    rotateLayersWithHeldKey({ screenX: 50, screenY: 0 })
    expect(ctx.layers[0].getRotation('z')).toBeCloseTo(before + 0.05)
  })
})

describe('lasso', () => {
  it('shift-click anchors, drag dims inside nodes, mouse-up selects them', () => {
    // anchor at (-5, 5): layerX = xBoundMax - 5, layerY = yBoundMax - 5
    clickDown(
      fakeEvent({
        shiftKey: true,
        layerX: ctx.xBoundMax - 5,
        layerY: ctx.yBoundMax - 5,
      })
    )
    lassoSelectNodes(5, -5) // rectangle (-5..5) x (-5..5)
    expect(ctx.nodeObjects[0].getOpacity()).toBe(0.5) // A at origin: inside
    expect(ctx.nodeObjects[1].getOpacity()).toBe(1) // B at (50,50): outside

    clickUp(fakeEvent({}))
    expect(ctx.nodeObjects[0].isSelected).toBe(true)
    expect(ctx.nodeObjects[1].isSelected).toBe(false)
    expect(ctx.scene!.dragging).toBe(false)
  })
})

describe('cancelPointerState (Redraw)', () => {
  it('lets go of a half-drawn area, a held key and a drag', () => {
    clickDown(
      fakeEvent({
        shiftKey: true,
        layerX: ctx.xBoundMax - 5,
        layerY: ctx.yBoundMax - 5,
      })
    )
    lassoSelectNodes(5, -5)
    expect(ctx.nodeObjects[0].getOpacity()).toBe(0.5)
    ctx.scene!.dragging = true
    ctx.scene!.axisPressed = 'z'

    cancelPointerState()
    expect(ctx.nodeObjects[0].getOpacity()).toBe(1)
    expect(ctx.scene!.dragging).toBe(false)
    expect(ctx.scene!.leftClickPressed).toBe(false)
    expect(ctx.scene!.axisPressed).toBe('')
    // the outline is gone: a later release selects nothing
    clickUp(fakeEvent({}))
    expect(ctx.nodeObjects[0].isSelected).toBe(false)
  })
})

describe('dblClick', () => {
  it('with nothing hovered unselects all nodes', () => {
    ctx.nodeObjects[0].isSelected = true
    dblClick(fakeEvent({ clientX: 0, clientY: 0 }))
    expect(ctx.nodeObjects[0].isSelected).toBe(false)
  })
})

describe('pointInPolygon (freehand lasso)', () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]
  // a "C": its mouth (x 4..10, y 4..6) is outside
  const c: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 4],
    [4, 4],
    [4, 6],
    [10, 6],
    [10, 10],
    [0, 10],
  ]

  it('tells inside from outside', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true)
    expect(pointInPolygon(11, 5, square)).toBe(false)
    expect(pointInPolygon(-1, -1, square)).toBe(false)
  })

  it('follows a concave outline', () => {
    expect(pointInPolygon(2, 5, c)).toBe(true) // the back of the C
    expect(pointInPolygon(8, 5, c)).toBe(false) // inside its mouth
    expect(pointInPolygon(8, 2, c)).toBe(true) // the upper arm
  })
})
