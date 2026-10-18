import { beforeEach, describe, expect, it } from 'vitest'
import type { EdgeModel, NetworkData } from '../api/client'
import { store } from '../store'
import { hivePositions, nodeDegrees } from './hive'

const edge = (s: string, sl: string, t: string, tl: string): EdgeModel => ({
  src: `${s}_${sl}`,
  trg: `${t}_${tl}`,
  source_node: s,
  source_layer: sl,
  target_node: t,
  target_layer: tl,
  weight: 1,
  scaled_weight: 1,
  channel: null,
})

// axis A: hub (3 links), b (2), c (1); axis B: x (2 links), y (0)
const network: NetworkData = {
  layers: ['A', 'B'],
  channels: [],
  nodes: [
    ['hub', 'A'],
    ['b', 'A'],
    ['c', 'A'],
    ['x', 'B'],
    ['y', 'B'],
  ].map(([label, layer]) => ({ id: `${label}_${layer}`, label, layer })),
  edges: [
    edge('hub', 'A', 'b', 'A'),
    edge('hub', 'A', 'c', 'A'),
    edge('hub', 'A', 'x', 'B'),
    edge('b', 'A', 'x', 'B'),
  ],
  warnings: [],
}

beforeEach(() => store.update({ network }))

describe('hive plot positions', () => {
  it('counts every connection, inter-layer links included', () => {
    expect(nodeDegrees()).toEqual({
      hub_A: 3,
      b_A: 2,
      c_A: 1,
      x_B: 2,
      y_B: 0,
    })
  })

  it('each axis full length: value ÷ that axis maximum', () => {
    const p = hivePositions(nodeDegrees(), 'axis')
    expect(p.hub_A).toBe(1)
    expect(p.b_A).toBeCloseTo(2 / 3)
    expect(p.x_B).toBe(1) // the best-connected node of its axis
    expect(p.y_B).toBe(0)
  })

  it('one scale for all axes: value ÷ the overall maximum', () => {
    const p = hivePositions(nodeDegrees(), 'shared')
    expect(p.hub_A).toBe(1)
    expect(p.x_B).toBeCloseTo(2 / 3) // comparable across axes
  })

  it('rank: evenly spaced in value order, ties by name', () => {
    const p = hivePositions(
      { hub_A: 5, b_A: 5, c_A: 1, x_B: 1, y_B: 1 },
      'rank'
    )
    expect([p.c_A, p.b_A, p.hub_A]).toEqual([0, 0.5, 1]) // b before hub
    expect([p.x_B, p.y_B]).toEqual([0, 1])
  })
})
