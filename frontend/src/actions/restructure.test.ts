import { describe, expect, it } from 'vitest'
import type { EdgeModel, NetworkData } from '../api/client'
import {
  RestructureError,
  mergeLayers,
  splitLayerByCluster,
  collapseGroups,
} from './restructure'
import { connectivityPositions } from './layout'

function edge(s: string, sl: string, t: string, tl: string): EdgeModel {
  return {
    src: `${s}_${sl}`,
    trg: `${t}_${tl}`,
    source_node: s,
    source_layer: sl,
    target_node: t,
    target_layer: tl,
    weight: 1,
    scaled_weight: 1,
    channel: null,
  }
}

// L1: A-B (cluster 0), C-D (cluster 1), B-C bridge; L2: A, B with A-B; A coupled.
const NET: NetworkData = {
  nodes: [
    ...['A', 'B', 'C', 'D'].map((l) => ({
      id: `${l}_L1`,
      label: l,
      layer: 'L1',
    })),
    ...['A', 'B'].map((l) => ({ id: `${l}_L2`, label: l, layer: 'L2' })),
  ],
  edges: [
    edge('A', 'L1', 'B', 'L1'),
    edge('C', 'L1', 'D', 'L1'),
    edge('B', 'L1', 'C', 'L1'),
    edge('A', 'L2', 'B', 'L2'),
    edge('A', 'L1', 'A', 'L2'),
  ],
  layers: ['L1', 'L2'],
  channels: [],
  warnings: [],
}
const CLUSTERS = {
  A_L1: '0',
  B_L1: '0',
  C_L1: '1',
  D_L1: '1',
  A_L2: '',
  B_L2: '',
}

describe('splitLayerByCluster', () => {
  it('turns each cluster into a layer and bridges into inter-layer edges', () => {
    const out = splitLayerByCluster(NET, 'L1', CLUSTERS, 18)
    expect(out.layers).toEqual(['L1 · C0', 'L1 · C1', 'L2'])
    expect(out.nodes.map((n) => n.id).sort()).toEqual(
      [
        'A_L1 · C0',
        'B_L1 · C0',
        'C_L1 · C1',
        'D_L1 · C1',
        'A_L2',
        'B_L2',
      ].sort()
    )
    const bridge = out.edges.find(
      (e) => e.source_node === 'B' && e.target_node === 'C'
    )!
    expect([bridge.source_layer, bridge.target_layer]).toEqual([
      'L1 · C0',
      'L1 · C1',
    ])
    const coupling = out.edges.find(
      (e) => e.target_layer === 'L2' && e.source_layer !== 'L2'
    )!
    expect(coupling.src).toBe('A_L1 · C0')
  })

  it('needs clusters, more than one, and respects the layer limit', () => {
    expect(() => splitLayerByCluster(NET, 'L2', CLUSTERS, 18)).toThrow(
      RestructureError
    )
    const one = { ...CLUSTERS, C_L1: '0', D_L1: '0' }
    expect(() => splitLayerByCluster(NET, 'L1', one, 18)).toThrow(
      /single cluster/
    )
    expect(() => splitLayerByCluster(NET, 'L1', CLUSTERS, 2)).toThrow(
      /limit is 2/
    )
  })
})

describe('mergeLayers', () => {
  it('collapses copies, drops coupling edges and duplicate edges', () => {
    const out = mergeLayers(NET, ['L1', 'L2'], 'All', 18)
    expect(out.layers).toEqual(['All'])
    expect(out.nodes.map((n) => n.label).sort()).toEqual(['A', 'B', 'C', 'D'])
    // A-B existed in both layers -> once; A_L1-A_L2 coupling disappears
    expect(
      out.edges.map((e) => `${e.source_node}-${e.target_node}`).sort()
    ).toEqual(['A-B', 'B-C', 'C-D'])
  })

  it('keeps unmerged layers in place and validates input', () => {
    const three = { ...NET, layers: ['L1', 'L2', 'L3'] }
    expect(mergeLayers(three, ['L2', 'L3'], 'M', 18).layers).toEqual([
      'L1',
      'M',
    ])
    expect(() => mergeLayers(NET, ['L1'], 'X', 18)).toThrow(/at least two/)
    expect(() => mergeLayers(three, ['L1', 'L2'], 'L3', 18)).toThrow(
      /already exists/
    )
  })
})

describe('connectivityPositions', () => {
  it('puts strongly linked layers closer than unlinked ones', () => {
    // 0-1 heavily linked, 2 linked to nobody
    const w = [
      [0, 50, 0],
      [50, 0, 0],
      [0, 0, 0],
    ]
    const p = connectivityPositions(w, 100)
    const d = (a: number, b: number) =>
      Math.hypot(p[a][0] - p[b][0], p[a][1] - p[b][1])
    expect(d(0, 1)).toBeLessThan(d(0, 2))
    expect(d(0, 1)).toBeLessThan(d(1, 2))
  })
})

describe('collapseGroups (super-node view)', () => {
  const net: NetworkData = {
    layers: ['L1'],
    channels: [],
    warnings: [],
    nodes: ['A', 'B', 'C', 'D', 'E'].map((label) => ({
      id: `${label}_L1`,
      label,
      layer: 'L1',
    })),
    edges: [
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'C'],
      ['C', 'D'],
      ['D', 'E'],
    ].map(([s, t]) => ({
      src: `${s}_L1`,
      trg: `${t}_L1`,
      source_node: s,
      source_layer: 'L1',
      target_node: t,
      target_layer: 'L1',
      weight: 1,
      scaled_weight: 1,
      channel: null,
    })),
  }

  it('collapses members into one node per group, sums member edges, keeps the rest', () => {
    const out = collapseGroups(net, {
      A_L1: 'G1',
      B_L1: 'G1',
      C_L1: 'G1',
      D_L1: 'G2',
      E_L1: null,
    })
    expect(out.nodes.map((n) => n.id).sort()).toEqual([
      'E_L1',
      'G1_L1',
      'G2_L1',
    ])
    const byKey = Object.fromEntries(
      out.edges.map((e) => [[e.src, e.trg].sort().join('-'), e.weight])
    )
    // C–D is the only edge between the groups; D–E stays as it was
    expect(byKey).toEqual({ 'G1_L1-G2_L1': 1, 'E_L1-G2_L1': 1 })
  })

  it('refuses when nothing is grouped', () => {
    expect(() => collapseGroups(net, {})).toThrow(RestructureError)
  })
})
