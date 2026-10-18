import { describe, expect, it } from 'vitest'
import type { EdgeModel, NetworkData } from '../api/client'
import {
  LINK_CHANNEL,
  expandNetwork,
  linkSameNames,
  mergeAsLayers,
  unlinkSameNames,
} from './merge'

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

describe('expandNetwork', () => {
  it('joins nodes by name into the loaded graph, new ones in the first layer', () => {
    const current = net(
      ['A', 'B'],
      [
        ['TP53', 'A'],
        ['MDM2', 'B'],
      ],
      [edge('TP53', 'A', 'MDM2', 'B')]
    )
    const incoming = net(
      ['STRING'],
      [
        ['MDM2', 'STRING'],
        ['TP53', 'STRING'],
        ['ATM', 'STRING'],
      ],
      [
        edge('MDM2', 'STRING', 'TP53', 'STRING'), // already there, other way round
        edge('ATM', 'STRING', 'TP53', 'STRING'),
      ]
    )
    const { network, added, edges } = expandNetwork(current, incoming)
    expect(network.layers).toEqual(['A', 'B']) // no new layer
    expect(added).toEqual(['ATM_A'])
    expect(edges).toBe(1)
    expect(network.edges.at(-1)).toMatchObject({
      src: 'ATM_A',
      trg: 'TP53_A',
      source_layer: 'A',
      target_layer: 'A',
    })
    expect(network.nodes).toHaveLength(3)
  })

  it('keeps channels on both sides and drops them when only one side has them', () => {
    const current = net(
      ['L'],
      [
        ['X', 'L'],
        ['Y', 'L'],
      ],
      [edge('X', 'L', 'Y', 'L', 1, 'Experiments')],
      ['Experiments']
    )
    const withChannels = net(
      ['S'],
      [
        ['X', 'S'],
        ['Y', 'S'],
      ],
      [
        edge('X', 'S', 'Y', 'S', 1, 'Experiments'),
        edge('X', 'S', 'Y', 'S', 1, 'Text mining'),
      ],
      ['Experiments', 'Text mining']
    )
    const kept = expandNetwork(current, withChannels)
    expect(kept.network.channels).toEqual(['Experiments', 'Text mining'])
    expect(kept.edges).toBe(1) // the Experiments edge was already there
    const plain = net(
      ['S'],
      [
        ['Y', 'S'],
        ['Z', 'S'],
      ],
      [edge('Y', 'S', 'Z', 'S')]
    )
    const dropped = expandNetwork(current, plain)
    expect(dropped.network.channels).toEqual([])
    expect(dropped.network.edges.every((e) => e.channel === null)).toBe(true)
  })
})

describe('linkSameNames / unlinkSameNames', () => {
  const layered = net(
    ['A', 'B', 'C'],
    [
      ['X', 'A'],
      ['X', 'B'],
      ['X', 'C'],
      ['Y', 'A'],
      ['Y', 'C'],
      ['Z', 'B'],
    ],
    [edge('X', 'A', 'X', 'B')] // already joined
  )

  it('joins copies of a name in consecutive layers, once', () => {
    const { network, links } = linkSameNames(layered)
    expect(links).toBe(2) // X B-C, Y A-C; X A-B was there
    const pairs = network.edges.map((e) => `${e.src}>${e.trg}`)
    expect(pairs).toEqual(['X_A>X_B', 'X_B>X_C', 'Y_A>Y_C'])
    expect(network.channels).toEqual([])
  })

  it('files the links under one channel when the network has channels', () => {
    const withChannels = { ...layered, channels: ['ppi'] }
    const { network } = linkSameNames(withChannels)
    expect(network.channels).toEqual(['ppi', LINK_CHANNEL])
    expect(network.edges.at(-1)?.channel).toBe(LINK_CHANNEL)
  })

  it('removes the links an importer drew, and their channel', () => {
    const linked = {
      ...net(
        ['A', 'B'],
        [
          ['X', 'A'],
          ['X', 'B'],
          ['Y', 'A'],
        ],
        [
          edge('X', 'A', 'Y', 'A', 1, 'ppi'),
          edge('X', 'A', 'X', 'B', 1, 'same protein'),
        ]
      ),
      channels: ['ppi', 'same protein'],
    }
    const { network, links } = unlinkSameNames(linked)
    expect(links).toBe(1)
    expect(network.edges).toHaveLength(1)
    expect(network.channels).toEqual(['ppi'])
  })

  it('adds layers without linking copies when asked', () => {
    const current = net(['L'], [['X', 'L']], [])
    const incoming = net(['S'], [['X', 'S']], [])
    expect(mergeAsLayers(current, incoming, false).links).toBe(0)
    expect(mergeAsLayers(current, incoming).links).toBe(1)
  })
})
