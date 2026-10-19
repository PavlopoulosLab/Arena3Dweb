import { describe, expect, it } from 'vitest'
import {
  CONTAINERS,
  DISC_LEVELS,
  ELLIPSOID,
  TORUS,
  VOLUME_CONTAINERS,
  assignTiers,
  insideContainer,
  isVolume,
  placeInContainer,
  tierLevels,
  toBox,
  type V3,
  type VolumeKind,
} from './containers'

const KINDS = VOLUME_CONTAINERS as VolumeKind[]

// a deterministic spread of points over the box [-1, 1]³: a grid with its
// corners, faces and centre, plus pseudo-random points
function boxPoints(): V3[] {
  const pts: V3[] = []
  const g = [-1, -0.6, -0.2, 0, 0.3, 0.7, 1]
  for (const x of g) for (const y of g) for (const z of g) pts.push([x, y, z])
  let seed = 11
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  for (let i = 0; i < 300; i++)
    pts.push([rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1])
  return pts
}
const degrees = (n: number) => Array.from({ length: n }, (_, i) => (i * 7) % 13)
const names = (n: number) => Array.from({ length: n }, (_, i) => `n${i}`)
const place = (kind: VolumeKind, pts: V3[], mode: 'inside' | 'surface') =>
  placeInContainer(kind, pts, {
    mode,
    values: degrees(pts.length),
    keys: names(pts.length),
  })

// how far a point is from the shape's surface (its wall, for the columns)
function offSurface(kind: VolumeKind, [x, y, z]: V3): number {
  const r = Math.hypot(x, z)
  switch (kind) {
    case 'cube':
      return Math.abs(Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) - 1)
    case 'sphere':
    case 'bubble':
      return Math.abs(Math.hypot(x, y, z) - 1)
    case 'ellipsoid':
      return Math.abs(
        Math.hypot(x / ELLIPSOID[0], y / ELLIPSOID[1], z / ELLIPSOID[2]) - 1
      )
    case 'cylinder':
    case 'discs':
      return Math.abs(r - 1)
    case 'cone':
      return Math.abs(r - (1 - y) / 2)
    case 'pyramid':
      return Math.abs(Math.max(Math.abs(x), Math.abs(z)) - (1 - y) / 2)
    case 'dome':
      return Math.abs(Math.hypot(x, y + 0.5, z) - 1)
    case 'torus':
      return Math.abs(Math.hypot(Math.hypot(x, y) - TORUS.ring, z) - TORUS.tube)
    default: {
      // hexprism, geodesic: on the boundary — a step out leaves the shape
      const out: V3 =
        kind === 'hexprism'
          ? [x * 1.001, y, z * 1.001]
          : [x * 1.001, y * 1.001, z * 1.001]
      return insideContainer(kind, out, 0) ? 1 : 0
    }
  }
}

describe('container catalogue', () => {
  it('groups flat, solid and soft containers; every volume is one', () => {
    expect(CONTAINERS.floor.group).toBe('flat')
    expect(CONTAINERS.none.group).toBe('flat')
    expect(CONTAINERS.cloud.group).toBe('soft')
    expect(CONTAINERS.bubble.group).toBe('soft')
    expect(KINDS).toContain('cube')
    expect(KINDS).toContain('torus')
    expect(KINDS).not.toContain('floor')
    for (const k of KINDS) expect(isVolume(k)).toBe(true)
    expect(isVolume('none')).toBe(false)
    expect(CONTAINERS.cloud.surface).toBe(false) // no hard boundary
  })
})

describe('placing nodes in containers', () => {
  const pts = boxPoints()

  it.each(KINDS)('%s: every node inside', (kind) => {
    const placed = place(kind, pts, 'inside')
    expect(placed).toHaveLength(pts.length)
    for (const p of placed) {
      expect(p.every(Number.isFinite)).toBe(true)
      expect(insideContainer(kind, p)).toBe(true)
    }
  })

  it.each(KINDS.filter((k) => CONTAINERS[k].surface))(
    '%s: on the surface, every node on it',
    (kind) => {
      for (const p of place(kind, pts, 'surface')) {
        expect(insideContainer(kind, p)).toBe(true)
        expect(offSurface(kind, p)).toBeLessThan(1e-6)
      }
    }
  )

  it('inside keeps clear of the walls (sphere)', () => {
    for (const p of place('sphere', pts, 'inside'))
      expect(Math.hypot(...p)).toBeLessThanOrEqual(0.9 + 1e-9)
  })

  it('a fresh layout fills the volume, not just its middle', () => {
    for (const kind of [
      'sphere',
      'cylinder',
      'ellipsoid',
      'geodesic',
    ] as const) {
      const placed = place(kind, pts, 'inside')
      const far = Math.max(...placed.map((p) => Math.hypot(p[0], p[2])))
      expect(far).toBeGreaterThan(0.5)
    }
  })

  it.each(KINDS)('%s: the same input gives the same placement', (kind) => {
    expect(place(kind, pts, 'inside')).toEqual(place(kind, pts, 'inside'))
  })

  it.each(KINDS.filter((k) => !CONTAINERS[k].tiers))(
    '%s: back to the box and in again lands in the same place',
    (kind) => {
      const placed = place(kind, pts, 'inside')
      const again = place(
        kind,
        placed.map((p) => toBox(kind, p)),
        'inside'
      )
      again.forEach((p, i) =>
        p.forEach((v, k) => expect(v).toBeCloseTo(placed[i][k], 6))
      )
    }
  )

  it('switching shapes keeps nodes in the new one', () => {
    for (const from of KINDS)
      for (const to of KINDS) {
        const there = place(from, pts, 'inside').map((p) => toBox(from, p))
        for (const p of place(to, there, 'inside'))
          expect(insideContainer(to, p)).toBe(true)
      }
  })

  it('a flat (2D) layout stays on the floor plane (the torus wraps it)', () => {
    const flat = pts.map(([, y, z]): V3 => [0, y, z])
    for (const kind of KINDS.filter((k) => k !== 'torus'))
      for (const p of place(kind, flat, 'inside'))
        expect(Math.abs(p[0])).toBeLessThan(1e-9)
    // the ring stands across the floor: no depth, the middle of the tube
    for (const p of place('torus', flat, 'inside'))
      expect(Math.abs(p[2])).toBeLessThan(1e-9)
  })

  it('points outside a shape come back to its wall', () => {
    const far: V3 = [3, 3, 3]
    for (const kind of KINDS)
      expect(
        insideContainer(kind, place(kind, [toBox(kind, far)], 'inside')[0])
      ).toBe(true)
  })

  it('the torus wraps the floor round its ring', () => {
    // opposite sides of the floor land on opposite sides of the ring
    const [a, b] = place(
      'torus',
      [
        [0, 0, 1],
        [0, 0, -1],
      ],
      'inside'
    )
    expect(Math.sign(a[0])).toBe(1)
    expect(Math.sign(b[0])).toBe(-1)
    expect(Math.abs(Math.hypot(a[0], a[1]) - TORUS.ring)).toBeLessThan(
      TORUS.tube
    )
    // the floor's top goes to the ring's top
    const [top] = place('torus', [[0, 1, 0]], 'inside')
    expect(top[1]).toBeGreaterThan(TORUS.ring - TORUS.tube)
  })
})

describe('tiers (cone, pyramid, disc stack)', () => {
  it('ranks nodes by value, ties together, a wide base', () => {
    const values = [5, 1, 1, 3, 9, 1, 2, 2, 7, 1]
    const keys = names(values.length)
    const tier = assignTiers(values, keys, [9, 4, 1])
    for (let i = 0; i < values.length; i++)
      for (let j = 0; j < values.length; j++)
        if (values[i] < values[j]) expect(tier[i]).toBeLessThanOrEqual(tier[j])
        else if (values[i] === values[j]) expect(tier[i]).toBe(tier[j])
    const count = (t: number) => tier.filter((x) => x === t).length
    expect(count(0)).toBeGreaterThan(count(2))
  })

  it('hubs at the top of the cone, every tier a level', () => {
    const n = 60
    const values = Array.from({ length: n }, (_, i) => (i === 17 ? 50 : i % 4))
    const pts = boxPoints().slice(0, n)
    const placed = placeInContainer('cone', pts, {
      values,
      keys: names(n),
    })
    const top = Math.max(...placed.map((p) => p[1]))
    expect(placed[17][1]).toBe(top)
    // five distinct degrees: five levels (a level may stay empty)
    const levels = new Set(placed.map((p) => p[1]))
    expect(levels.size).toBeLessThanOrEqual(5)
    for (const y of levels) expect(tierLevels('cone', 5)).toContain(y)
  })

  it('the disc stack puts each slice on a plate', () => {
    const pts = boxPoints().slice(0, 40)
    const placed = placeInContainer('discs', pts, {
      values: degrees(40),
      keys: names(40),
    })
    for (const p of placed) expect(DISC_LEVELS).toContain(p[1])
  })

  it('round the rim, nodes of a tier are evenly spaced', () => {
    const pts: V3[] = [
      [0.1, 0, 0.9],
      [0.12, 0, 0.88],
      [-0.5, 0, 0.1],
      [0.3, 0, -0.7],
    ]
    const placed = placeInContainer('cylinder', pts, { mode: 'surface' })
    expect(
      placed.every((p) => Math.abs(Math.hypot(p[0], p[2]) - 1) < 1e-9)
    ).toBe(true)
    const discs = placeInContainer('discs', pts, {
      mode: 'surface',
      values: [1, 1, 1, 1],
      keys: names(4),
    })
    const angles = discs
      .map((p) => Math.atan2(p[0], p[2]))
      .sort((a, b) => a - b)
    const gaps = angles.map(
      (a, i) => (angles[(i + 1) % 4] - a + 2 * Math.PI) % (2 * Math.PI)
    )
    for (const g of gaps) expect(g).toBeCloseTo(Math.PI / 2, 9)
  })
})
