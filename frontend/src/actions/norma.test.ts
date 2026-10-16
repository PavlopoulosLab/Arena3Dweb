import { beforeEach, describe, expect, it } from 'vitest'
import { store } from '../store'
import { NormaError, normaLink, normaPayload } from './norma'

const edge = (
  s: string,
  sl: string,
  t: string,
  tl: string,
  channel: string | null = null
) => ({
  src: `${s}_${sl}`,
  trg: `${t}_${tl}`,
  source_node: s,
  source_layer: sl,
  target_node: t,
  target_layer: tl,
  weight: 2,
  scaled_weight: 1,
  channel,
})

beforeEach(() => {
  store.update({
    network: {
      nodes: [
        { id: 'A_L1', label: 'A', layer: 'L1' },
        { id: 'B_L1', label: 'B', layer: 'L1' },
        { id: 'A_L2', label: 'A', layer: 'L2' },
        { id: 'C_L2', label: 'C', layer: 'L2' },
      ],
      edges: [
        edge('A', 'L1', 'B', 'L1', 'ppi'),
        edge('B', 'L1', 'A', 'L1', 'ppi'), // same pair twice
        edge('A', 'L2', 'C', 'L2'),
        edge('A', 'L1', 'A', 'L2'), // copies of A -> dropped
        edge('B', 'L1', 'C', 'L2'), // inter-layer between different nodes -> kept
      ],
      layers: ['L1', 'L2'],
      channels: ['ppi'],
      warnings: [],
    },
  })
})

describe('normaPayload', () => {
  it('makes one group per layer and merges node copies', () => {
    const p = normaPayload('x')
    expect(p.groups).toEqual({ L1: ['A', 'B'], L2: ['A', 'C'] })
    expect(p.edges).toEqual([
      { source: 'A', target: 'B', type: 'ppi', weight: 2 },
      { source: 'A', target: 'C', type: 'L2', weight: 2 },
      { source: 'B', target: 'C', type: 'inter-layer', weight: 2 },
    ])
    expect(p.settings.showGroupHulls).toBe(true)
  })

  it('limits to the given layers and refuses an empty result', () => {
    expect(Object.keys(normaPayload('x', ['L2']).groups)).toEqual(['L2'])
    store.update({
      network: { nodes: [], edges: [], layers: [], channels: [], warnings: [] },
    })
    expect(() => normaPayload('x')).toThrow(NormaError)
  })

  it('builds a #json link that decodes back to the payload', () => {
    const p = normaPayload('x')
    const link = normaLink('https://normaviz.org', p)
    expect(link.startsWith('https://normaviz.org/norma.html#json=')).toBe(true)
    const code = link.split('#json=')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(code), (c) => c.charCodeAt(0))
    )
    expect(JSON.parse(json)).toEqual(p)
  })
})
