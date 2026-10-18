import { describe, expect, it } from 'vitest'
import type { EdgeModel, NetworkData, SessionData } from '../api/client'
import {
  exactIntersection,
  inducedSubnetwork,
  intersectionOf,
  memberSets,
  pickMembers,
  selectionNodes,
  selectionSubnetwork,
  sessionNetwork,
  sortBars,
  unionOf,
  upsetBars,
  upsetSvg,
  type UpsetSet,
} from './upset'

const edge = (
  s: string,
  sl: string,
  t: string,
  tl: string,
  channel: string | null = null
): EdgeModel => ({
  src: `${s}_${sl}`,
  trg: `${t}_${tl}`,
  source_node: s,
  source_layer: sl,
  target_node: t,
  target_layer: tl,
  weight: 1,
  scaled_weight: 1,
  channel,
})

// L1: a b c d; L2: b c e; L3: c e f
const NET: NetworkData = {
  nodes: [
    ...['a', 'b', 'c', 'd'].map((n) => ({
      id: `${n}_L1`,
      label: n,
      layer: 'L1',
    })),
    ...['b', 'c', 'e'].map((n) => ({ id: `${n}_L2`, label: n, layer: 'L2' })),
    ...['c', 'e', 'f'].map((n) => ({ id: `${n}_L3`, label: n, layer: 'L3' })),
  ],
  edges: [
    edge('a', 'L1', 'b', 'L1', 'ppi'),
    edge('b', 'L1', 'c', 'L1', 'ppi'),
    edge('c', 'L1', 'd', 'L1', 'coexp'),
    edge('b', 'L2', 'c', 'L2', 'coexp'),
    edge('c', 'L2', 'e', 'L2', 'ppi'),
    edge('b', 'L1', 'b', 'L2', 'ppi'),
    edge('c', 'L2', 'c', 'L3', 'ppi'),
    edge('e', 'L3', 'f', 'L3', 'lit'),
  ],
  layers: ['L1', 'L2', 'L3'],
  channels: ['ppi', 'coexp', 'lit'],
  warnings: [],
}

const layerSets = (net: NetworkData, label?: string): UpsetSet[] =>
  net.layers.map((layer) => ({
    name: layer,
    members: net.nodes.filter((n) => n.layer === layer).map((n) => n.label),
    origin: { network: net, layer, label },
  }))

const SETS = layerSets(NET)
const M = memberSets(SETS)

describe('UpSet set logic', () => {
  it('bars are the exact intersections and partition the union', () => {
    const bars = upsetBars(SETS)
    const byKey = Object.fromEntries(bars.map((b) => [b.key, b.members.sort()]))
    expect(byKey).toEqual({
      '0': ['a', 'd'],
      '0,1': ['b'],
      '0,1,2': ['c'],
      '1,2': ['e'],
      '2': ['f'],
    })
    expect(bars.reduce((n, b) => n + b.count, 0)).toBe(6)
    // largest first; ties: fewer sets first
    expect(bars.map((b) => b.key)).toEqual(['0', '2', '0,1', '1,2', '0,1,2'])
  })

  it('sorts by degree either way and keeps the largest bars', () => {
    const bars = upsetBars(SETS)
    expect(sortBars(bars, 'degree').map((b) => b.sets.length)).toEqual([
      1, 1, 2, 2, 3,
    ])
    expect(sortBars(bars, 'degree-desc')[0].key).toBe('0,1,2')
    // the 3 largest ('0', '2', '0,1'), most sets first
    expect(upsetBars(SETS, 3, 'degree-desc').map((b) => b.key)).toEqual([
      '0,1',
      '0',
      '2',
    ])
  })

  it('exact intersection: in those sets and no other', () => {
    expect(exactIntersection(M, [0, 1])).toEqual(['b'])
    expect(exactIntersection(M, [1, 2])).toEqual(['e'])
    expect(exactIntersection(M, [0, 1, 2])).toEqual(['c'])
    expect(exactIntersection(M, [0, 2])).toEqual([])
    expect(exactIntersection(M, [])).toEqual([])
  })

  it('union and intersection of chosen sets', () => {
    expect(unionOf(M, [1, 2])).toEqual(['b', 'c', 'e', 'f'])
    expect(intersectionOf(M, [1, 2])).toEqual(['c', 'e'])
    expect(intersectionOf(M, [0, 1, 2])).toEqual(['c'])
    expect(intersectionOf(M, [])).toEqual([])
  })

  it('a pick of bars or of sets gives members and where they were picked', () => {
    expect(pickMembers(M, { bars: [[0], [1, 2]] })).toEqual({
      members: ['a', 'd', 'e'],
      sets: [0, 1, 2],
    })
    expect(pickMembers(M, { sets: [2, 0], op: 'intersection' })).toEqual({
      members: ['c'],
      sets: [0, 2],
    })
    expect(pickMembers(M, { sets: [0, 1], op: 'union' }).members).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ])
  })

  it('maps the selection to every copy in the picked sets', () => {
    // b in exactly L1 and L2: both copies
    const bar = pickMembers(M, { bars: [[0, 1]] })
    const [part] = selectionNodes(SETS, bar, M)
    expect([...part.ids].sort()).toEqual(['b_L1', 'b_L2'])
    // L2 ∩ L3 = c, e: their copies in L2 and L3, not c in L1
    const both = pickMembers(M, { sets: [1, 2], op: 'intersection' })
    expect([...selectionNodes(SETS, both, M)[0].ids].sort()).toEqual([
      'c_L2',
      'c_L3',
      'e_L2',
      'e_L3',
    ])
    // members that are node ids already (group sets)
    const groups: UpsetSet[] = [
      { name: 'g1', members: ['a_L1', 'b_L2'], origin: { network: NET } },
      { name: 'g2', members: ['b_L2', 'f_L3'], origin: { network: NET } },
    ]
    const g = pickMembers(memberSets(groups), { sets: [0, 1], op: 'union' })
    expect([...selectionNodes(groups, g)[0].ids].sort()).toEqual([
      'a_L1',
      'b_L2',
      'f_L3',
    ])
  })

  it('cuts the induced subnetwork: the nodes, every edge among them', () => {
    const sub = inducedSubnetwork(
      NET,
      new Set(['b_L1', 'c_L1', 'b_L2', 'c_L2'])
    )
    expect(sub.nodes.map((n) => n.id)).toEqual(['b_L1', 'c_L1', 'b_L2', 'c_L2'])
    expect(sub.edges.map((e) => `${e.src}-${e.trg}`)).toEqual([
      'b_L1-c_L1',
      'b_L2-c_L2',
      'b_L1-b_L2',
    ])
    expect(sub.layers).toEqual(['L1', 'L2'])
    expect(sub.channels).toEqual(['ppi', 'coexp'])
    expect(sub.warnings).toEqual([])
    // the source is left as it was
    expect(NET.nodes).toHaveLength(10)
  })

  it('keeps two networks apart, each layer named after its network', () => {
    const other: NetworkData = {
      nodes: [
        { id: 'c_L1', label: 'c', layer: 'L1' },
        { id: 'z_L1', label: 'z', layer: 'L1' },
      ],
      edges: [edge('c', 'L1', 'z', 'L1')],
      layers: ['L1'],
      channels: [],
      warnings: [],
    }
    const sets = [...layerSets(NET, 'A'), ...layerSets(other, 'B')]
    const members = memberSets(sets)
    // c and z in B: L1 ∪ A: L1 — nodes of both networks
    const sel = pickMembers(members, { sets: [0, 3], op: 'union' })
    const parts = selectionNodes(sets, sel, members)
    expect(parts).toHaveLength(2)
    const sub = selectionSubnetwork(parts)
    expect(sub.layers).toEqual(['A: L1', 'B: L1'])
    expect(sub.nodes.map((n) => n.id)).toContain('z_B: L1')
    expect(sub.edges.map((e) => `${e.src}-${e.trg}`)).toContain(
      'c_B: L1-z_B: L1'
    )
    expect(sub.edges.every((e) => sub.layers.includes(e.source_layer))).toBe(
      true
    )
  })

  it('reads another loaded network from its session', () => {
    const session = {
      layers: [{ name: 'L1' }],
      nodes: [
        { name: 'x', layer: 'L1' },
        { name: 'y', layer: 'L1' },
      ],
      edges: [
        { src: 'x_L1', trg: 'y_L1', opacity: 0.5, color: '', channel: 'k' },
      ],
    } as unknown as SessionData
    const net = sessionNetwork(session)
    expect(net.nodes.map((n) => n.id)).toEqual(['x_L1', 'y_L1'])
    expect(net.edges[0]).toMatchObject({
      source_node: 'x',
      target_layer: 'L1',
      weight: 0.5,
      channel: 'k',
    })
    expect(net.channels).toEqual(['k'])
  })

  it('draws focusable bars and set rows only when interactive', () => {
    const live = upsetSvg(SETS, { element: 'nodes', interactive: true })
    expect(live.match(/class="up-col"/g)).toHaveLength(5)
    expect(live.match(/class="up-set"/g)).toHaveLength(3)
    expect(live).toContain('tabindex="0"')
    expect(live).not.toContain('<title>')
    const plain = upsetSvg(SETS, { element: 'nodes' })
    expect(plain).not.toContain('tabindex')
    expect(plain).toContain('<title>')
  })
})
