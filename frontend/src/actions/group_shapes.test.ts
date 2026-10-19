import { describe, expect, it } from 'vitest'
import {
  boundingEllipsoid,
  boundingSphere,
  outlineRing,
  paddedBox,
  seededRandom,
  type Point3,
} from './group_shapes'

// a group on a flat layer (x = 0) and one laid out in 3D
const FLAT: Point3[] = [
  [0, 0, 0],
  [0, 10, 0],
  [0, 10, 4],
  [0, 2, 6],
]
const SOLID: Point3[] = [
  [-3, 1, 1],
  [5, 2, -4],
  [0, 9, 3],
  [2, -6, 7],
]

const inside = (
  p: Point3,
  center: Point3,
  radii: Point3,
  slack = 1e-9
): boolean =>
  Math.hypot(
    (p[0] - center[0]) / radii[0],
    (p[1] - center[1]) / radii[1],
    (p[2] - center[2]) / radii[2]
  ) <=
  1 + slack

describe('paddedBox', () => {
  it('is the members’ box, the padding wider on every side', () => {
    expect(paddedBox(FLAT, 2)).toEqual({
      min: [-2, -2, -2],
      max: [2, 12, 8],
    })
  })
})

describe('boundingSphere', () => {
  it('holds every member with the padding to spare', () => {
    for (const points of [FLAT, SOLID]) {
      const { center, radius } = boundingSphere(points, 3)
      for (const p of points)
        expect(
          Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2])
        ).toBeLessThanOrEqual(radius - 3 + 1e-9)
    }
  })

  it('is a padded ball around a single member', () => {
    expect(boundingSphere([[1, 2, 3]], 4)).toEqual({
      center: [1, 2, 3],
      radius: 4,
    })
  })
})

describe('boundingEllipsoid', () => {
  it('holds every member, and at least the padding past the box on each axis', () => {
    for (const points of [FLAT, SOLID]) {
      const pad = 2
      const { center, radii } = boundingEllipsoid(points, pad)
      for (const p of points) expect(inside(p, center, radii)).toBe(true)
      const box = paddedBox(points, pad)
      for (let i = 0; i < 3; i++)
        expect(radii[i]).toBeGreaterThanOrEqual(
          (box.max[i] - box.min[i]) / 2 - 1e-9
        )
    }
  })

  it('is a flat lens on a flat layer', () => {
    const { radii } = boundingEllipsoid(FLAT, 1)
    expect(radii[0]).toBeLessThan(radii[1] / 3)
    expect(radii[0]).toBeLessThan(radii[2] / 3)
  })
})

describe('outlineRing', () => {
  const square: [number, number][] = [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ]
  const dist = ([y, z]: [number, number]) => Math.hypot(y - 2, z - 2)

  it('runs from the padding out to the padding less its width', () => {
    const { outer, inner } = outlineRing(square, 3, 1)
    const corner = Math.hypot(2, 2)
    for (const p of outer) expect(dist(p)).toBeCloseTo(corner + 3)
    for (const p of inner) expect(dist(p)).toBeCloseTo(corner + 2)
  })

  it('never turns inside out when the width passes the corners', () => {
    const { inner } = outlineRing(square, 0, 10)
    for (const p of inner) expect(dist(p)).toBeCloseTo(0)
  })
})

describe('seededRandom', () => {
  it('repeats for the same group and differs between groups', () => {
    const a = seededRandom('Cluster 1')
    const b = seededRandom('Cluster 1')
    const c = seededRandom('Cluster 2')
    const first = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(first)
    expect([c(), c(), c()]).not.toEqual(first)
    for (const v of first) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
