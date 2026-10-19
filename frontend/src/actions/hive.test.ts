import { beforeEach, describe, expect, it } from 'vitest'
import type { EdgeModel, NetworkData } from '../api/client'
import { store } from '../store'
import { hiveDirections, hivePositions, nodeDegrees } from './hive'

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

describe('hive plot axis directions', () => {
  type Dir = [number, number, number]
  const len = (d: Dir) => Math.hypot(...d)
  const angle = (a: Dir, b: Dir) =>
    (Math.acos(
      Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
    ) *
      180) /
    Math.PI
  const pairs = (ds: Dir[]) =>
    ds.flatMap((a, i) => ds.slice(i + 1).map((b) => angle(a, b)))

  it('flat: in the plane, evenly round it; two axes 120° apart', () => {
    for (const n of [2, 3, 4, 5, 7]) {
      const ds = hiveDirections(n, 'flat')
      expect(ds).toHaveLength(n)
      for (const d of ds) {
        expect(len(d)).toBeCloseTo(1)
        expect(d[2]).toBeCloseTo(0)
      }
    }
    expect(angle(...(hiveDirections(2, 'flat') as [Dir, Dir]))).toBeCloseTo(120)
    expect(pairs(hiveDirections(3, 'flat'))).toEqual(
      expect.arrayContaining([
        expect.closeTo(120, 5),
        expect.closeTo(120, 5),
        expect.closeTo(120, 5),
      ])
    )
    expect(hiveDirections(4, 'flat')[0]).toEqual([
      expect.closeTo(0, 9),
      expect.closeTo(1, 9),
      0,
    ]) // the first axis points up
  })

  it('3D: tripod at right angles, tetrahedron at 109.47°, six on ±x ±y ±z', () => {
    for (const a of pairs(hiveDirections(3, '3d'))) expect(a).toBeCloseTo(90)
    for (const a of pairs(hiveDirections(4, '3d')))
      expect(a).toBeCloseTo((Math.acos(-1 / 3) * 180) / Math.PI)
    const six = hiveDirections(6, '3d').map((d) => d.map(Math.round).join())
    expect(new Set(six)).toEqual(
      new Set(['0,1,0', '0,-1,0', '1,0,0', '-1,0,0', '0,0,1', '0,0,-1'])
    )
  })

  it('3D: any other number spread over a sphere, unit length, none twice', () => {
    for (const n of [5, 8, 18]) {
      const ds = hiveDirections(n, '3d')
      expect(ds).toHaveLength(n)
      for (const d of ds) expect(len(d)).toBeCloseTo(1)
      // spread: no two axes closer than 25°
      expect(Math.min(...pairs(ds))).toBeGreaterThan(25)
    }
    // two axes stay as in the plane (120°): nothing to spread into 3D
    expect(hiveDirections(2, '3d')).toEqual(hiveDirections(2, 'flat'))
  })
})
