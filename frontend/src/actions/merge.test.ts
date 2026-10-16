import { describe, expect, it } from 'vitest'
import type { EdgeModel, NetworkData } from '../api/client'
import { LINK_CHANNEL, mergeAsLayers } from './merge'

const edge = (
  s: string,
  sl: string,
  t: string,
  tl: string,
  weight = 1,
  channel: string | null = null
): EdgeModel => ({
  src: `${s}_${sl}`,
  trg: `${t}_${tl}`,
  source_node: s,
  source_layer: sl,
  target_node: t,
  target_layer: tl,
  weight,
  scaled_weight: weight,
  channel,
})
const net = (
  layers: string[],
  nodes: [string, string][],
  edges: EdgeModel[],
  channels: string[] = []
): NetworkData => ({
  layers,
  channels,
  nodes: nodes.map(([label, layer]) => ({
    id: `${label}_${layer}`,
    label,
    layer,
  })),
  edges,
  warnings: [],
})

describe('mergeAsLayers', () => {
  it('adds the layers, renames clashes and links copies of a node', () => {
    const current = net(
      ['PPI', 'STRING'],
      [
        ['TP53', 'PPI'],
        ['MDM2', 'PPI'],
        ['TP53', 'STRING'],
      ],
      [edge('TP53', 'PPI', 'MDM2', 'PPI')]
    )
    const incoming = net(
      ['STRING'],
      [
        ['TP53', 'STRING'],
        ['ATM', 'STRING'],
      ],
      [edge('TP53', 'STRING', 'ATM', 'STRING', 0.7)]
    )
    const r = mergeAsLayers(current, incoming)
    expect(r.layers).toEqual(['STRING (2)'])
    expect(r.network.layers).toEqual(['PPI', 'STRING', 'STRING (2)'])
    expect(r.network.nodes.map((n) => n.id)).toContain('ATM_STRING (2)')
    // TP53 has copies in PPI and STRING: two links to the new copy
    expect(r.links).toBe(2)
    const links = r.network.edges.filter((e) => e.trg === 'TP53_STRING (2)')
    expect(links.map((e) => e.source_layer).sort()).toEqual(['PPI', 'STRING'])
    expect(r.network.edges).toHaveLength(1 + 1 + 2)
    expect(r.network.channels).toEqual([])
  })

  it('keeps channels when both sides have them and files the links under one', () => {
    const current = net(
      ['A'],
      [['X', 'A']],
      [edge('X', 'A', 'X', 'A', 1, 'exp')],
      ['exp']
    )
    const incoming = net(
      ['B'],
      [
        ['X', 'B'],
        ['Y', 'B'],
      ],
      [edge('X', 'B', 'Y', 'B', 1, 'text')],
      ['text']
    )
    const r = mergeAsLayers(current, incoming)
    expect(r.network.channels).toEqual(['exp', 'text', LINK_CHANNEL])
    expect(
      r.network.edges.find((e) => e.src === 'X_A' && e.trg === 'X_B')?.channel
    ).toBe(LINK_CHANNEL)
  })

  it('drops channels from the side that would mix them in', () => {
    const current = net(['A'], [['X', 'A']], [edge('X', 'A', 'X', 'A')])
    const incoming = net(
      ['B'],
      [
        ['X', 'B'],
        ['Y', 'B'],
      ],
      [
        edge('X', 'B', 'Y', 'B', 0.2, 'c1'),
        edge('X', 'B', 'Y', 'B', 0.9, 'c2'),
      ],
      ['c1', 'c2']
    )
    const r = mergeAsLayers(current, incoming)
    expect(r.network.channels).toEqual([])
    const xy = r.network.edges.filter((e) => e.src === 'X_B')
    expect(xy).toHaveLength(1)
    expect(xy[0].weight).toBe(0.9)
    expect(xy[0].channel).toBeNull()
  })
})
