import { describe, expect, it } from 'vitest'
import type { SessionData } from '../api/client'
import { withoutNodes } from './delete_nodes'

const node = (name: string, layer: string) =>
  ({ name, layer }) as SessionData['nodes'][number]
const edge = (src: string, trg: string, channel?: string) =>
  ({ src, trg, channel }) as SessionData['edges'][number]

describe('withoutNodes', () => {
  const session = {
    layers: [],
    nodes: [node('A', 'L1'), node('B', 'L1'), node('A', 'L2'), node('C', 'L2')],
    edges: [
      edge('A_L1', 'B_L1'),
      edge('A_L1', 'A_L2', 'x'),
      edge('A_L1', 'A_L2', 'y'),
      edge('A_L2', 'C_L2'),
    ],
  } as unknown as SessionData

  it('drops the nodes and every edge row touching them', () => {
    const left = withoutNodes(session, new Set(['A_L1']))
    expect(left.nodes.map((n) => `${n.name}_${n.layer}`)).toEqual([
      'B_L1',
      'A_L2',
      'C_L2',
    ])
    expect(left.edges).toEqual([edge('A_L2', 'C_L2')])
  })

  it('removes one copy of a name, not the same name in another layer', () => {
    const left = withoutNodes(session, new Set(['A_L2']))
    expect(left.nodes.some((n) => n.name === 'A' && n.layer === 'L1')).toBe(
      true
    )
    expect(left.edges).toEqual([edge('A_L1', 'B_L1')])
  })

  it('leaves the session it was given alone', () => {
    withoutNodes(session, new Set(['B_L1']))
    expect(session.nodes).toHaveLength(4)
  })
})
