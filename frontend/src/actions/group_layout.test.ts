import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { Layer, Node, Scene, ctx, resetContext } from '../three'
import { api } from '../api/client'
import { store } from '../store'
import {
  GroupLayoutError,
  groupAlgorithmProblem,
  groupLayoutRuns3D,
  groupLocalProblem,
  groupsFor,
  layerPlacements,
  runGroupLayout,
  type GroupLayoutOptions,
} from './group_layout'

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

describe('what each strategy can run', () => {
  it('group gravity needs an algorithm that reads edge weights', () => {
    // the reported combination: Annotations + Group gravity + Reingold-Tilford
    expect(groupAlgorithmProblem('gravity', 'Reingold-Tilford', false)).toMatch(
      /edge weights, which Reingold-Tilford ignores/
    )
    for (const a of ['Sugiyama', 'Circle', 'Graphopt'])
      expect(groupAlgorithmProblem('gravity', a, false)).not.toBeNull()
    for (const a of ['Fruchterman-Reingold', 'Kamada-Kawai', 'DrL'])
      expect(groupAlgorithmProblem('gravity', a, false)).toBeNull()
  })

  it('virtual nodes need an algorithm that reads edges; super nodes take any', () => {
    expect(groupAlgorithmProblem('virtual', 'Circle', false)).toMatch(
      /without reading edges/
    )
    expect(groupAlgorithmProblem('virtual', 'Reingold-Tilford', false)).toBe(
      null
    )
    for (const a of ['Circle', 'Reingold-Tilford', 'Sugiyama'])
      expect(groupAlgorithmProblem('supernodes', a, false)).toBeNull()
  })

  it('3D group layouts take 3D algorithms only', () => {
    for (const s of ['virtual', 'gravity', 'supernodes'] as const)
      expect(groupAlgorithmProblem(s, 'Reingold-Tilford', true)).toMatch(
        /no 3D version/
      )
    expect(groupAlgorithmProblem('supernodes', 'Circle', true)).toBeNull()
    expect(groupLocalProblem('virtual', 'Sugiyama', true)).toMatch(
      /no 3D version/
    )
    expect(groupLocalProblem('virtual', 'Kamada-Kawai', true)).toMatch(
      /igraph bug/
    )
    expect(groupLocalProblem('virtual', 'Kamada-Kawai', false)).toBeNull()
    expect(groupLocalProblem('virtual', 'keep', true)).toBeNull()
    expect(groupLocalProblem('supernodes', 'keep', false)).not.toBeNull()
  })

  it('runs in 3D for layers as groups or volume layers only', () => {
    expect(groupLayoutRuns3D('layers', ['L1', 'L2'])).toBe(true)
    expect(groupLayoutRuns3D('clusters', ['L1', 'L2'])).toBe(false)
    ctx.layers[0].setContainer('sphere')
    expect(groupLayoutRuns3D('annotations', ['L1'])).toBe(true)
    expect(groupLayoutRuns3D('annotations', ['L1', 'L2'])).toBe(false)
    expect(groupLayoutRuns3D('annotations', ['gone'])).toBe(false)
  })
})

describe('runGroupLayout after clustering', () => {
  const run = (o: Partial<GroupLayoutOptions>) =>
    runGroupLayout({
      source: 'annotations',
      strategy: 'gravity',
      algorithm: 'Reingold-Tilford',
      local: 'Fruchterman-Reingold',
      force: 10,
      scale: 1,
      layers: [],
      ...o,
    })

  beforeEach(() => {
    store.update({
      network: {
        layers: ['L1', 'L2'],
        channels: [],
        nodes: ctx.nodeObjects.map((n, i) => ({
          id: ctx.nodeLayerNames[i],
          label: n.name,
          layer: n.layer,
        })),
        edges: [],
        warnings: [],
      },
    })
    // Clustering section + "Use Clusters as Annotations"
    ctx.nodeObjects.forEach((n, i) => {
      n.cluster = String(i % 2)
      n.annotations = [`Cluster ${n.cluster}`]
    })
  })

  it('refuses impossible combinations with the reason, before the server', async () => {
    const layout = vi.spyOn(api, 'layout')
    await expect(run({})).rejects.toThrow(GroupLayoutError)
    await expect(run({})).rejects.toThrow(/Reingold-Tilford ignores/)
    await expect(
      run({ source: 'layers', strategy: 'supernodes' })
    ).rejects.toThrow(/no 3D version/)
    expect(layout).not.toHaveBeenCalled()
    layout.mockRestore()
  })
})

describe('runGroupLayout in Single network mode', () => {
  beforeEach(() => {
    store.update({
      network: {
        layers: ['L1', 'L2'],
        channels: [],
        nodes: ctx.nodeObjects.map((n, i) => ({
          id: ctx.nodeLayerNames[i],
          label: n.name,
          layer: n.layer,
        })),
        edges: [],
        warnings: [],
      },
    })
    ctx.nodeObjects.forEach((n) => (n.cluster = n.name === 'C' ? '2' : '1'))
    ctx.networkMode = 'single'
  })

  it('lays the stacked layers out as one graph, fitted as one', async () => {
    // the server puts group 1 (A_L1, B_L1, A_L2) on the left, group 2 (C_L2) right
    const layout = vi.spyOn(api, 'layout').mockResolvedValue({
      positions: { A_L1: [0, 0], B_L1: [1, 0], A_L2: [0.5, 1], C_L2: [10, 0] },
      clusters: null,
      misalignment: null,
    })
    await runGroupLayout({
      source: 'clusters',
      strategy: 'supernodes',
      algorithm: 'Fruchterman-Reingold',
      local: 'Circle',
      force: 10,
      scale: 1,
      layers: ['L1', 'L2'],
    })
    expect(layout.mock.calls[0][0]).toMatchObject({
      scope: 'allLayers',
      selected_layers: ['L1', 'L2'],
    })
    // a per-layer fit would stretch L1's two nodes over the whole floor,
    // away from A_L2 in the same group
    const y = (i: number) => ctx.nodeObjects[i].getPosition('y')
    expect(Math.abs(y(1) - y(2))).toBeLessThan(Math.abs(y(3) - y(2)))
    layout.mockRestore()
  })

  it('has no floors to arrange as groups', async () => {
    await expect(
      runGroupLayout({
        source: 'layers',
        strategy: 'supernodes',
        algorithm: 'Fruchterman-Reingold',
        local: 'Circle',
        force: 10,
        scale: 1,
        layers: [],
      })
    ).rejects.toThrow(/Single network mode/)
  })
})
