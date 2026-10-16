import { describe, expect, it } from 'vitest'
import { bundleEdges, compatibility, type Segment } from './fdeb'

const dist = (a: number[], b: number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]))

describe('force-directed edge bundling', () => {
  it('rates parallel, nearby edges compatible and crossing ones not', () => {
    const a: Segment = [
      [0, 0, 0],
      [0, 100, 0],
    ]
    const b: Segment = [
      [0, 0, 10],
      [0, 100, 10],
    ]
    const c: Segment = [
      [0, 50, -50],
      [0, 50, 50],
    ]
    expect(compatibility(a, b)).toBeGreaterThan(0.9)
    expect(compatibility(a, c)).toBe(0)
  })

  it('pulls parallel edges together and keeps their endpoints', () => {
    const segs: Segment[] = [0, 10, 20, 30].map((z) => [
      [0, 0, z],
      [0, 300, z],
    ])
    const paths = bundleEdges(segs)
    expect(paths).toHaveLength(4)
    paths.forEach((p, i) => {
      expect(p[0]).toEqual(segs[i][0])
      expect(p[p.length - 1]).toEqual(segs[i][1])
      expect(p.length).toBeGreaterThan(2)
    })
    // the outer edges' middles move toward each other
    const m = (p: number[][]) => p[Math.floor(p.length / 2)]
    const before = dist([0, 150, 0], [0, 150, 30])
    expect(dist(m(paths[0]), m(paths[3]))).toBeLessThan(before * 0.6)
  })

  it('leaves a lone edge straight', () => {
    const [p] = bundleEdges([
      [
        [0, 0, 0],
        [0, 100, 0],
      ],
    ])
    expect(p).toHaveLength(2)
  })
})
