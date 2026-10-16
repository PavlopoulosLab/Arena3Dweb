import { beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { Edge, Layer, Node, Scene, ctx, resetContext } from '../three'
import {
  SearchError,
  findEdges,
  findNodes,
  fitTarget,
  focusTarget,
  nodeMatcher,
  selectEdges,
  selectNodes,
} from './search'

const NAMES = ['TP53', 'TP53BP1', 'MDM2', 'mdm4', 'ATM']

beforeEach(() => {
  resetContext()
  ctx.scene = new Scene()
  const layer = new Layer({ name: 'L', geometry_parameters_width: 100 })
  ctx.layers = [layer]
  ctx.scene.addLayer(layer.plane)
  ctx.nodeObjects = NAMES.map((name, i) => {
    const n = new Node({ id: i, name, nodeLayerName: `${name}::L`, layer: 'L' })
    n.setPosition('y', i * 10)
    n.setPosition('z', i * 5)
    layer.addNode(n.sphere)
    return n
  })
  ctx.nodeLayerNames = NAMES.map((n) => `${n}::L`)
  ctx.layerGroups = { L: 0 }
  ctx.nodeGroups = Object.fromEntries(NAMES.map((n) => [`${n}::L`, 'L']))
})

describe('nodeMatcher / findNodes', () => {
  it('supports exact, contains, prefix, suffix (case-insensitive by default)', () => {
    expect(findNodes('tp53', 'exact')).toEqual([0])
    expect(findNodes('tp53', 'contains')).toEqual([0, 1])
    expect(findNodes('MDM', 'prefix')).toEqual([2, 3])
    expect(findNodes('bp1, m2', 'suffix')).toEqual([1, 2])
    expect(findNodes('MDM', 'prefix', true)).toEqual([2])
  })

  it('supports regular expressions and reports bad ones', () => {
    expect(findNodes('^MDM\\d$', 'regex')).toEqual([2, 3])
    expect(findNodes('^TP53$|ATM', 'regex')).toEqual([0, 4])
    expect(() => nodeMatcher('(', 'regex')).toThrow(SearchError)
    expect(findNodes('   ', 'regex')).toEqual([])
  })

  it('selectNodes replaces or extends the selection', () => {
    selectNodes([0], true)
    selectNodes([2], false)
    expect(ctx.nodeObjects.map((n) => n.isSelected)).toEqual([
      true,
      false,
      true,
      false,
      false,
    ])
    selectNodes([4], true)
    expect(ctx.nodeObjects.filter((n) => n.isSelected).length).toBe(1)
  })
})

describe('focusTarget', () => {
  it('centres the matched nodes (pan = -scale x centre)', () => {
    const [px, py, s] = focusTarget([2])!
    ctx.scene!.setPosition('x', px)
    ctx.scene!.setPosition('y', py)
    ctx.scene!.setScale(s)
    ctx.scene!.THREE_Object.updateMatrixWorld(true)
    const w = ctx.nodeObjects[2].getWorldPosition()
    expect(w.x).toBeCloseTo(0, 3)
    expect(w.y).toBeCloseTo(0, 3)
    expect(s).toBeGreaterThanOrEqual(2)
  })

  it('returns null without matches', () => {
    expect(focusTarget([])).toBeNull()
  })
})

describe('fitTarget', () => {
  it('brings every node and floor into the window, centred', () => {
    ctx.xBoundMax = 400
    ctx.yBoundMax = 300
    ctx.scene!.setPosition('x', 123)
    ctx.scene!.setPosition('y', -45)
    ctx.scene!.setScale(7)
    const [px, py, s] = fitTarget()!
    ctx.scene!.setPosition('x', px)
    ctx.scene!.setPosition('y', py)
    ctx.scene!.setScale(s)
    ctx.scene!.THREE_Object.updateMatrixWorld(true)
    const box = new THREE.Box3()
    for (const n of ctx.nodeObjects) box.expandByPoint(n.getWorldPosition())
    const plane = ctx.layers[0].plane
    plane.geometry.computeBoundingBox()
    box.union(
      plane.geometry.boundingBox!.clone().applyMatrix4(plane.matrixWorld)
    )
    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 3)
    expect((box.min.y + box.max.y) / 2).toBeCloseTo(0, 3)
    const w = box.max.x - box.min.x
    const h = box.max.y - box.min.y
    expect(w).toBeLessThanOrEqual(0.85 * 800 + 1e-6)
    expect(h).toBeLessThanOrEqual(0.85 * 600 + 1e-6)
    // a tight fit: one side touches the margin
    expect(Math.max(w / 800, h / 600)).toBeCloseTo(0.85, 3)
  })

  it('returns null without a network', () => {
    ctx.nodeObjects = []
    expect(fitTarget()).toBeNull()
  })
})

describe('findEdges / selectEdges', () => {
  beforeEach(() => {
    ctx.channelColors = { phys: '#123456' }
    ctx.channelVisibility = { phys: true }
    ctx.edgeObjects = [
      new Edge({ id: 0, source: 'TP53::L', target: 'MDM2::L', weights: [1] }),
      new Edge({
        id: 1,
        source: 'MDM2::L',
        target: 'ATM::L',
        weights: [0.5],
        channels: ['phys'],
      }),
    ]
  })

  it('matches either end, one end, both ends or the channel', () => {
    expect(findEdges('TP53', 'any', 'exact')).toEqual([0])
    expect(findEdges('MDM2', 'any', 'exact')).toEqual([0, 1])
    expect(findEdges('MDM2', 'source', 'exact')).toEqual([1])
    expect(findEdges('MDM2', 'target', 'exact')).toEqual([0])
    expect(findEdges('^(TP53|MDM2)$', 'both', 'regex')).toEqual([0])
    expect(findEdges('phys', 'channel', 'exact')).toEqual([1])
    expect(findEdges('tp53', 'any', 'exact', true)).toEqual([])
    expect(findEdges('', 'any', 'exact')).toEqual([])
  })

  it('selectEdges replaces or extends the selection', () => {
    selectEdges([0], true)
    expect(ctx.edgeObjects.map((e) => e.isSelected)).toEqual([true, false])
    selectEdges([1], false)
    expect(ctx.edgeObjects.map((e) => e.isSelected)).toEqual([true, true])
    selectEdges([1], true)
    expect(ctx.edgeObjects.map((e) => e.isSelected)).toEqual([false, true])
  })
})
