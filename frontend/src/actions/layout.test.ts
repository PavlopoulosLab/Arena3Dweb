import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Node, Layer, Scene, ctx, resetContext } from '../three'
import { api } from '../api/client'
import { history } from '../commands/base'
import {
  normalizeLayoutPositions,
  fitToContainers,
  applyLayout,
  applyTopology,
  applyPredefinedLayout,
} from './layout'

// Two layers of different widths; one node each.
function seed(): void {
  ctx.scene = new Scene()
  ctx.layers = [
    new Layer({ id: 0, name: 'L1', geometry_parameters_width: 100 }),
    new Layer({ id: 1, name: 'L2', geometry_parameters_width: 400 }),
  ]
  ctx.layerGroups = { L1: 0, L2: 1 }
  ctx.nodeGroups = { 'A::L1': 'L1', 'B::L1': 'L1', 'C::L2': 'L2' }
  ctx.nodeLayerNames = ['A::L1', 'B::L1', 'C::L2']
  ctx.nodeObjects = [
    new Node({ name: 'A', nodeLayerName: 'A::L1', layer: 'L1' }),
    new Node({ name: 'B', nodeLayerName: 'B::L1', layer: 'L1' }),
    new Node({ name: 'C', nodeLayerName: 'C::L2', layer: 'L2' }),
  ]
  ctx.edgeObjects = []
}

beforeEach(() => {
  resetContext()
  seed()
})

describe('normalizeLayoutPositions', () => {
  it('maps coords into [-minWidth/2, minWidth/2] (minWidth = 100 -> [-50, 50])', () => {
    // Two L1 nodes span the full y range -> min maps to -50, max to +50.
    const out = normalizeLayoutPositions({ 'A::L1': [0, 0], 'B::L1': [10, 10] })
    expect(out['A::L1']).toEqual([-50, -50])
    expect(out['B::L1']).toEqual([50, 50])
  })

  it('collapses a degenerate (single-value) axis to 0', () => {
    const out = normalizeLayoutPositions({ 'A::L1': [5, 5] })
    expect(out['A::L1']).toEqual([0, 0])
  })

  it('maps a 3D layout depth into the same range', () => {
    const out = normalizeLayoutPositions({
      'A::L1': [0, 0, -4],
      'B::L1': [10, 10, 4],
    })
    expect(out['A::L1']).toEqual([-50, -50, -50])
    expect(out['B::L1']).toEqual([50, 50, 50])
  })

  it('multiplies by the node layer scale', () => {
    ctx.layers[0].setScale(2)
    const out = normalizeLayoutPositions({ 'A::L1': [0, 0], 'B::L1': [10, 10] })
    expect(out['B::L1']).toEqual([100, 100]) // 50 * scale 2
  })
})

describe('fitToContainers', () => {
  it('pulls nodes on a disk floor inside its rim, leaves squares alone', () => {
    ctx.layers[0].setFloorShape('disk') // width 100 -> rim 46
    const out = fitToContainers({
      'A::L1': [50, 50],
      'B::L1': [0, 10],
      'C::L2': [150, 150],
    })
    expect(Math.hypot(...(out['A::L1'] as [number, number]))).toBeCloseTo(46)
    expect(out['C::L2']).toEqual([150, 150])
  })
})

describe('fitToContainers (3D)', () => {
  it('brings sphere and cube nodes back inside, towards the centre', () => {
    ctx.layers[0].setContainer('sphere') // width 100 -> inner wall 45
    ctx.layers[1].setContainer('cube') // width 400 -> inner wall 180
    const out = fitToContainers({
      'A::L1': [40, 40, 40],
      'B::L1': [10, -5, 3], // inside: stays
      'C::L2': [300, 0, -500],
    })
    expect(Math.hypot(...(out['A::L1'] as number[]))).toBeCloseTo(45)
    out['B::L1'].forEach((v, k) => expect(v).toBeCloseTo([10, -5, 3][k]))
    // along the same direction to the inset wall
    const [y, z, x] = out['C::L2'] as number[]
    expect(Math.max(Math.abs(y), Math.abs(z), Math.abs(x))).toBeCloseTo(180)
    expect(y / x).toBeCloseTo(300 / -500)
    expect(z).toBeCloseTo(0)
  })
})

describe('applyLayout', () => {
  it('fetches, normalizes, and pushes one ApplyLayoutCommand', async () => {
    const spy = vi.spyOn(api, 'layout').mockResolvedValue({
      positions: { 'A::L1': [0, 0], 'B::L1': [10, 10] },
      clusters: null,
    })
    await applyLayout({
      nodes: [],
      edges: [],
      algorithm: 'DrL',
      selected_layers: ['L1'],
    })
    expect(spy).toHaveBeenCalledOnce()
    expect(ctx.nodeObjects[0].getPosition('y')).toBe(-50)
    expect(ctx.nodeObjects[1].getPosition('y')).toBe(50)
    expect(history.canUndo).toBe(true)
    spy.mockRestore()
  })
})

describe('applyPredefinedLayout', () => {
  it('parallel spreads layers along x from a reset position', () => {
    applyPredefinedLayout('parallel')
    const xs = ctx.layers.map((l) => l.getPosition('x'))
    expect(xs[0]).toBeLessThan(0)
    expect(xs[0]).toBeCloseTo(-xs[1])
    expect(ctx.layers.every((l) => l.getPosition('y') === 0)).toBe(true)
    expect(ctx.renderInterLayerEdgesFlag).toBe(true)
  })

  it('zigZag lifts every other layer by 500', () => {
    applyPredefinedLayout('zigZag')
    expect(ctx.layers[0].getPosition('y')).toBe(0)
    expect(ctx.layers[1].getPosition('y')).toBe(500)
  })

  it('starLike rotates layers around the origin and pushes them outward', () => {
    applyPredefinedLayout('starLike')
    // layer 0 (width 100): rotZ 0°, translateY(-150) -> y = -150
    expect(ctx.layers[0].getPosition('y')).toBeCloseTo(-150)
    // layer 1 (width 400): rotZ 180°, translateY(-300) -> y = +300
    expect(ctx.layers[1].getPosition('y')).toBeCloseTo(300)
  })

  it('cube arranges layers as box sides', () => {
    applyPredefinedLayout('cube')
    // side 0 (width 100): rotZ 90° then translateX(+150) -> (0, 150, 0)
    expect(ctx.layers[0].getPosition('y')).toBeCloseTo(150)
    // side 1 (width 400): no rotation, translateX(+300) -> (300, 0, 0)
    expect(ctx.layers[1].getPosition('x')).toBeCloseTo(300)
  })

  it('needs more than one layer', () => {
    ctx.layers = [ctx.layers[0]]
    ctx.layers[0].translateX(42)
    applyPredefinedLayout('parallel')
    expect(ctx.layers[0].getPosition('x')).toBe(42) // untouched
  })
})

describe('applyTopology', () => {
  it('fetches and applies scales verbatim (already mapped server-side)', async () => {
    const spy = vi
      .spyOn(api, 'topology')
      .mockResolvedValue({ scales: { 'A::L1': 1.7 }, raw: { 'A::L1': 12 } })
    await applyTopology({
      nodes: [],
      edges: [],
      metric: 'Degree',
      selected_layers: ['L1'],
    })
    expect(spy).toHaveBeenCalledOnce()
    expect(ctx.nodeObjects[0].getScale()).toBe(1.7)
    spy.mockRestore()
  })
})
