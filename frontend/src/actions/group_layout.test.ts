import { beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { Layer, Node, Scene, ctx, resetContext } from '../three'
import { groupsFor, layerPlacements } from './group_layout'

beforeEach(() => {
  resetContext()
  ctx.scene = new Scene()
  ctx.layers = ['L1', 'L2'].map(
    (name, id) => new Layer({ id, name, geometry_parameters_width: 100 })
  )
  ctx.layerGroups = { L1: 0, L2: 1 }
  const nodes: [string, string][] = [
    ['A', 'L1'],
    ['B', 'L1'],
    ['A', 'L2'],
    ['C', 'L2'],
  ]
  ctx.nodeLayerNames = nodes.map(([n, l]) => `${n}_${l}`)
  ctx.nodeGroups = Object.fromEntries(nodes.map(([n, l]) => [`${n}_${l}`, l]))
  ctx.nodeObjects = nodes.map(
    ([n, l], i) =>
      new Node({ id: i, name: n, nodeLayerName: `${n}_${l}`, layer: l })
  )
})

describe('groupsFor', () => {
  it('reads clusters, annotations or layers', () => {
    ctx.nodeObjects[0].cluster = '3'
    ctx.nodeObjects[1].annotations = ['x', 'y']
    const all = new Set(['L1', 'L2'])
    expect(groupsFor('clusters', all)).toMatchObject({
      A_L1: ['Cluster 3'],
      B_L1: [],
    })
    expect(groupsFor('annotations', all).B_L1).toEqual(['x', 'y'])
    expect(groupsFor('layers', new Set(['L2']))).toEqual({
      A_L2: ['L2'],
      C_L2: ['L2'],
    })
  })
})

describe('layerPlacements', () => {
  // two layer clusters on either side of the origin along x
  const raw = {
    A_L1: [-10, 1, 0],
    B_L1: [-10, -1, 0],
    A_L2: [10, 0, 1],
    C_L2: [10, 0, -1],
  }

  it('faces floors outward, spreads them apart and fits nodes inside', () => {
    const [p1, p2] = layerPlacements(raw, ['L1', 'L2'])
    const n1 = new THREE.Vector3(1, 0, 0).applyQuaternion(p1.quaternion)
    const n2 = new THREE.Vector3(1, 0, 0).applyQuaternion(p2.quaternion)
    expect(n1.x).toBeCloseTo(-1) // L1 sits at -x and faces -x
    expect(n2.x).toBeCloseTo(1)
    expect(p1.position.distanceTo(p2.position)).toBeGreaterThanOrEqual(
      120 - 1e-6
    ) // 0.6 * (100 + 100)
    for (const p of [p1, p2])
      for (const [y, z, depth] of Object.values(p.nodes)) {
        expect(Math.hypot(y, z)).toBeLessThanOrEqual(45 + 1e-6) // 0.9 * half width
        expect(depth).toBe(0) // flat floors drop depth
      }
  })

  it('keeps depth inside 3D layer shapes', () => {
    ctx.layers[1].setContainer('sphere')
    const [, p2] = layerPlacements(
      { ...raw, A_L2: [11, 0, 0.5], C_L2: [9, 0.3, -0.5] },
      ['L1', 'L2']
    )
    expect(Object.values(p2.nodes).some(([, , d]) => Math.abs(d) > 1)).toBe(
      true
    )
  })
})
