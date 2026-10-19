// Layer containers: which there are, how they are grouped in Edit → Layers →
// Shape & container, and where nodes go inside them (or on their surface).
//
// Pure maths on unit shapes in a layer's own frame — x is depth (the floor's
// normal), y the floor's up, z its width. Every shape fits the box [-1, 1]³
// centred on the floor and is scaled by the layer's half-width, so spacing,
// fitting the view and the hive hand-off treat all of them like the cube.
// Axial shapes (cylinder, cone, pyramid, dome, prism, discs) stand along y,
// upright in the Parallel arrangement; the torus stands across the floor,
// facing the viewer there (its axis along the floor's width, z), and the
// floor's layout wraps round its ring.
//
// Placement maps a point of the box onto the shape and back (fromBox / toBox):
// a fresh layout, spread over the box, is mapped in; switching containers maps
// the nodes back to the box and into the new shape, so the layout keeps its
// structure. Every map is deterministic (no randomness; ties by name).

import { IcosahedronGeometry, Vector3 } from 'three'

export type LayerContainer =
  | 'floor'
  | 'none'
  | 'cube'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'pyramid'
  | 'dome'
  | 'ellipsoid'
  | 'torus'
  | 'hexprism'
  | 'geodesic'
  | 'discs'
  | 'cloud'
  | 'bubble'
export type VolumeKind = Exclude<LayerContainer, 'floor' | 'none'>
export type ContainerGroup = 'flat' | 'solid' | 'soft'
export type ContainerPlacement = 'inside' | 'surface'
export type V3 = [number, number, number] // [x (depth), y (up), z]

export interface ContainerInfo {
  label: string
  group: ContainerGroup
  surface: boolean // "On the surface" makes sense
  tiers: boolean // nodes sit in levels by degree
  hint: string // the select's tooltip and Help
}

// In menu order within each group.
export const CONTAINERS: Record<LayerContainer, ContainerInfo> = {
  floor: {
    label: 'Floor (2D)',
    group: 'flat',
    surface: false,
    tiers: false,
    hint: 'the flat floor, nodes laid out on it',
  },
  none: {
    label: 'None',
    group: 'flat',
    surface: false,
    tiers: false,
    hint: 'no floor and no container',
  },
  cube: {
    label: 'Cube',
    group: 'solid',
    surface: true,
    tiers: false,
    hint: 'a box as deep as the floor is wide',
  },
  sphere: {
    label: 'Sphere',
    group: 'solid',
    surface: true,
    tiers: false,
    hint: 'a ball; on the surface, a globe of nodes',
  },
  cylinder: {
    label: 'Cylinder',
    group: 'solid',
    surface: true,
    tiers: false,
    hint: 'an upright column; on the surface, nodes on its wall',
  },
  cone: {
    label: 'Cone',
    group: 'solid',
    surface: true,
    tiers: true,
    hint: 'a hierarchy: nodes in tiers by degree, hubs at the narrow top',
  },
  pyramid: {
    label: 'Pyramid',
    group: 'solid',
    surface: true,
    tiers: true,
    hint: 'a square hierarchy: tiers by degree, hubs at the top',
  },
  dome: {
    label: 'Dome',
    group: 'solid',
    surface: true,
    tiers: false,
    hint: 'a hemisphere, a sky over a round base',
  },
  ellipsoid: {
    label: 'Ellipsoid',
    group: 'solid',
    surface: true,
    tiers: false,
    hint: 'an upright egg, for elongated layouts',
  },
  torus: {
    label: 'Torus',
    group: 'solid',
    surface: true,
    tiers: false,
    hint: 'a ring facing the viewer, for cycles and periodic data',
  },
  hexprism: {
    label: 'Hexagonal prism',
    group: 'solid',
    surface: true,
    tiers: false,
    hint: 'a honeycomb cell; prisms side by side tile',
  },
  geodesic: {
    label: 'Geodesic sphere',
    group: 'solid',
    surface: true,
    tiers: false,
    hint: 'a faceted globe (a subdivided icosahedron)',
  },
  discs: {
    label: 'Disc stack',
    group: 'solid',
    surface: true,
    tiers: true,
    hint: 'five thin plates; nodes sorted by degree into slices',
  },
  cloud: {
    label: 'Fog cloud',
    group: 'soft',
    surface: false,
    tiers: false,
    hint: 'soft puffs of fog filling the volume, no hard boundary',
  },
  bubble: {
    label: 'Bubble',
    group: 'soft',
    surface: true,
    tiers: false,
    hint: 'a soft glowing sphere with a bright rim, no outline',
  },
}

export const CONTAINER_KINDS = Object.keys(CONTAINERS) as LayerContainer[]
export const VOLUME_CONTAINERS: LayerContainer[] = CONTAINER_KINDS.filter(
  (k) => CONTAINERS[k].group !== 'flat'
)
export const CONTAINER_GROUP_LABELS: Record<ContainerGroup, string> = {
  flat: 'Flat',
  solid: 'Solid (3D)',
  soft: 'Soft (3D)',
}

export const isContainer = (v: unknown): v is LayerContainer =>
  typeof v === 'string' && v in CONTAINERS
export const isVolume = (k: LayerContainer): k is VolumeKind =>
  CONTAINERS[k].group !== 'flat'

// ------------------------------------------------------------ unit shapes
// Nodes placed inside keep this far from the walls (as the old 0.92 rim).
export const INSET = 0.9
export const ELLIPSOID: V3 = [0.6, 1, 0.6] // semi-axes
export const TORUS = { ring: 0.68, tube: 0.3 } // outer radius 0.98
export const DOME_BASE = -0.5 // the flat base; the top is at 0.5
export const DISC_LEVELS = [-0.8, -0.4, 0, 0.4, 0.8]
export const DISC_HALF_THICKNESS = 0.02
const TIERS = { bottom: -0.8, top: 0.5, max: 5 } // cone and pyramid levels

const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const EPS = 1e-9
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v))
const norm = (v: V3) => Math.hypot(v[0], v[1], v[2])
const linf = (v: V3) => Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]))
export const clampBox = (u: V3): V3 => [
  clamp1(u[0]),
  clamp1(u[1]),
  clamp1(u[2]),
]
// angle round the y axis, 0 along +z towards +x (CylinderGeometry's vertices)
const around = (x: number, z: number) => Math.atan2(x, z)

// a direction for a node with none of its own (e.g. at the very centre on a
// surface): points of a Fibonacci sphere, the same every time
function fallbackDirection(i: number): V3 {
  const y = 1 - 2 * (((i + 0.5) * 0.618033988749895) % 1)
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  return [r * Math.sin(i * GOLDEN), y, r * Math.cos(i * GOLDEN)]
}

// The geodesic sphere's facets as (unit normal, distance from the centre).
let facetCache: [Vector3, number][] | null = null
function facets(): [Vector3, number][] {
  if (facetCache) return facetCache
  const pos = new IcosahedronGeometry(1, 1).getAttribute('position')
  const out: [Vector3, number][] = []
  const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()]
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize()
    let h = n.dot(a)
    if (h < 0) {
      n.negate()
      h = -h
    }
    out.push([n, h])
  }
  return (facetCache = out)
}

// Distance from the shape's centre to its surface along the unit direction d
// (the star-shaped bodies; the dome measures from its base centre).
function reach(kind: VolumeKind, d: V3): number {
  if (kind === 'cube') return 1 / Math.max(linf(d), EPS)
  if (kind === 'ellipsoid')
    return (
      1 /
      Math.hypot(d[0] / ELLIPSOID[0], d[1] / ELLIPSOID[1], d[2] / ELLIPSOID[2])
    )
  if (kind === 'geodesic') {
    let best = Infinity
    for (const [n, h] of facets()) {
      const c = n.x * d[0] + n.y * d[1] + n.z * d[2]
      if (c > EPS) best = Math.min(best, h / c)
    }
    return best
  }
  return 1 // sphere, bubble, cloud, dome
}

// Distance from the axis to the wall of a cross-section, at angle θ.
function reach2(kind: VolumeKind, theta: number): number {
  if (kind === 'hexprism') {
    const s = Math.PI / 3 // a vertex every 60°, starting on +z
    const delta = (((theta % s) + s) % s) - s / 2
    return Math.cos(s / 2) / Math.cos(delta)
  }
  if (kind === 'pyramid')
    return 1 / Math.max(Math.abs(Math.sin(theta)), Math.abs(Math.cos(theta)))
  return 1
}

// Half-width of the cross-section at height y.
const radiusAt = (kind: VolumeKind, y: number) =>
  kind === 'cone' || kind === 'pyramid' ? (1 - y) / 2 : 1

// ------------------------------------------------- box → shape (per node)
const DOME_CENTRE: V3 = [0, DOME_BASE, 0]

function radialOut(
  kind: VolumeKind,
  u: V3,
  centre: V3,
  surface: boolean,
  i: number
): V3 {
  const n = norm(u)
  let d: V3
  let t: number
  if (n < EPS) {
    if (!surface) return [...centre]
    d = fallbackDirection(i)
    if (kind === 'dome') d[1] = Math.abs(d[1])
    t = 1
  } else {
    d = [u[0] / n, u[1] / n, u[2] / n]
    t = surface ? 1 : linf(u)
  }
  const k = t * (surface ? 1 : INSET) * reach(kind, d)
  return [centre[0] + d[0] * k, centre[1] + d[1] * k, centre[2] + d[2] * k]
}

function columnOut(kind: VolumeKind, u: V3, surface: boolean, i: number): V3 {
  const n = Math.hypot(u[0], u[2])
  let theta: number
  let t: number
  if (n < EPS) {
    if (!surface) return [0, u[1] * INSET, 0]
    theta = i * GOLDEN
    t = 1
  } else {
    theta = around(u[0], u[2])
    t = surface ? 1 : Math.max(Math.abs(u[0]), Math.abs(u[2]))
  }
  const r = t * (surface ? 1 : INSET) * reach2(kind, theta)
  return [
    r * Math.sin(theta),
    u[1] * (surface ? 1 : INSET),
    r * Math.cos(theta),
  ]
}

// The floor's square (z, y) wraps round the ring, which stands in the x-y
// plane: the angle on the floor is the angle on the ring, the distance from
// the floor's centre runs from the tube's inner to its outer side, and depth
// goes across the tube (along z).
function torusOut(u: V3, surface: boolean, i: number): V3 {
  const rho = Math.max(Math.abs(u[1]), Math.abs(u[2]))
  const phi = rho < EPS ? i * GOLDEN : Math.atan2(u[1], u[2])
  const s = 2 * rho - 1
  const v = u[0]
  const n = Math.hypot(s, v)
  let ds = 0
  let dv = 0
  if (surface) [ds, dv] = n < EPS ? [1, 0] : [s / n, v / n]
  else if (n >= EPS) {
    const t = Math.max(Math.abs(s), Math.abs(v)) * INSET
    ;[ds, dv] = [(s / n) * t, (v / n) * t]
  }
  const radial = TORUS.ring + TORUS.tube * ds
  return [radial * Math.cos(phi), radial * Math.sin(phi), TORUS.tube * dv]
}

function pointOut(kind: VolumeKind, u: V3, surface: boolean, i: number): V3 {
  switch (kind) {
    case 'cylinder':
    case 'hexprism':
      return columnOut(kind, u, surface, i)
    case 'torus':
      return torusOut(u, surface, i)
    case 'dome':
      // the box's lower half is the base, its upper half the sky
      return radialOut(
        kind,
        [u[0], (u[1] + 1) / 2, u[2]],
        DOME_CENTRE,
        surface,
        i
      )
    default:
      return radialOut(kind, u, [0, 0, 0], surface, i)
  }
}

// ------------------------------------------------- shape → box (per node)
function radialIn(kind: VolumeKind, p: V3, centre: V3): V3 {
  const q: V3 = [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]]
  const n = norm(q)
  if (n < EPS) return [0, 0, 0]
  const d: V3 = [q[0] / n, q[1] / n, q[2] / n]
  const t = Math.min(1, n / (INSET * reach(kind, d))) / linf(d)
  return [d[0] * t, d[1] * t, d[2] * t]
}

// back from a cross-section of half-width `half` (column, tier)
function sectionIn(kind: VolumeKind, p: V3, half: number): [number, number] {
  const n = Math.hypot(p[0], p[2])
  if (n < EPS) return [0, 0]
  const theta = around(p[0], p[2])
  const t = Math.min(1, n / (INSET * half * reach2(kind, theta)))
  const m = Math.max(Math.abs(Math.sin(theta)), Math.abs(Math.cos(theta)))
  return [(Math.sin(theta) / m) * t, (Math.cos(theta) / m) * t]
}

function torusIn(p: V3): V3 {
  const phi = Math.atan2(p[1], p[0])
  const ds = (Math.hypot(p[0], p[1]) - TORUS.ring) / (TORUS.tube * INSET)
  const dv = p[2] / (TORUS.tube * INSET)
  const n = Math.hypot(ds, dv)
  let s = 0
  let v = 0
  if (n >= EPS) {
    const m = Math.max(Math.abs(ds), Math.abs(dv)) / n
    ;[s, v] = [(ds / n / m) * Math.min(1, n), (dv / n / m) * Math.min(1, n)]
  }
  const rho = (s + 1) / 2
  const m = Math.max(Math.abs(Math.cos(phi)), Math.abs(Math.sin(phi)))
  return [v, (Math.sin(phi) / m) * rho, (Math.cos(phi) / m) * rho]
}

// Where a point of a layer's container came from in the box (unit units).
// Points outside the shape land on the box's surface; floors have no shape.
export function toBox(kind: LayerContainer, p: V3): V3 {
  if (!isVolume(kind)) return clampBox(p)
  switch (kind) {
    case 'cylinder':
    case 'hexprism': {
      const [x, z] = sectionIn(kind, p, 1)
      return [x, clamp1(p[1] / INSET), z]
    }
    case 'cone':
    case 'pyramid':
    case 'discs': {
      const y = clamp1(p[1])
      const [x, z] = sectionIn(kind, p, Math.max(0.05, radiusAt(kind, y)))
      return [x, y, z]
    }
    case 'torus':
      return torusIn(p)
    case 'dome': {
      const q = radialIn(kind, p, DOME_CENTRE)
      return [q[0], 2 * Math.max(0, q[1]) - 1, q[2]]
    }
    default:
      return radialIn(kind, p, [0, 0, 0])
  }
}

// ----------------------------------------------------------------- tiers
// The heights of `count` levels (cone, pyramid: base up to near the tip;
// discs: the plates, spread out when fewer are needed).
export function tierLevels(kind: VolumeKind, count: number): number[] {
  if (kind === 'discs') {
    if (count <= 1) return [DISC_LEVELS[2]]
    return Array.from(
      { length: count },
      (_, k) =>
        DISC_LEVELS[Math.round((k * (DISC_LEVELS.length - 1)) / (count - 1))]
    )
  }
  if (count <= 1) return [TIERS.bottom]
  return Array.from(
    { length: count },
    (_, k) => TIERS.bottom + (k * (TIERS.top - TIERS.bottom)) / (count - 1)
  )
}

// Nodes ranked by value (then key) fill the levels from the bottom, each level
// holding a share of the nodes in proportion to its weight (its area for the
// cone and pyramid: a wide base, a narrow top); equal values share a level.
export function assignTiers(
  values: number[],
  keys: string[],
  weights: number[]
): number[] {
  const n = values.length
  const order = values
    .map((_, i) => i)
    .sort(
      (a, b) =>
        values[a] - values[b] ||
        (keys[a] < keys[b] ? -1 : keys[a] > keys[b] ? 1 : a - b)
    )
  const total = weights.reduce((s, w) => s + w, 0) || 1
  const caps: number[] = []
  weights.reduce((s, w, k) => ((caps[k] = (n * (s + w)) / total), s + w), 0)
  const tier = new Array<number>(n).fill(0)
  let k = 0
  order.forEach((i, rank) => {
    if (rank > 0 && values[i] === values[order[rank - 1]]) {
      tier[i] = tier[order[rank - 1]]
      return
    }
    while (k < weights.length - 1 && rank + 0.5 > caps[k]) k++
    tier[i] = k
  })
  return tier
}

function placeInTiers(
  kind: VolumeKind,
  us: V3[],
  surface: boolean,
  values: number[],
  keys: string[]
): V3[] {
  const distinct = new Set(values).size
  const count = Math.max(1, Math.min(TIERS.max, distinct, us.length))
  const levels = tierLevels(kind, count)
  const weights = levels.map((y) =>
    kind === 'discs' ? 1 : radiusAt(kind, y) ** 2
  )
  const tier = assignTiers(values, keys, weights)
  const out: V3[] = new Array<V3>(us.length)
  levels.forEach((y, t) => {
    const members = us.map((_, i) => i).filter((i) => tier[i] === t)
    const half = radiusAt(kind, y)
    if (surface) {
      // round the rim in the layout's own angular order, evenly spaced
      const angle = (i: number) =>
        Math.hypot(us[i][0], us[i][2]) < EPS
          ? i * GOLDEN
          : around(us[i][0], us[i][2])
      const sorted = members
        .map((i) => [i, angle(i)] as const)
        .sort((a, b) => a[1] - b[1] || a[0] - b[0])
      const start = sorted.length ? sorted[0][1] : 0
      sorted.forEach(([i], k) => {
        const theta = start + (2 * Math.PI * k) / sorted.length
        const r = half * reach2(kind, theta)
        out[i] = [r * Math.sin(theta), y, r * Math.cos(theta)]
      })
    } else
      for (const i of members) {
        const [a, , b] = us[i]
        const n = Math.hypot(a, b)
        if (n < EPS) {
          out[i] = [0, y, 0]
          continue
        }
        const theta = around(a, b)
        const r =
          Math.max(Math.abs(a), Math.abs(b)) *
          INSET *
          half *
          reach2(kind, theta)
        out[i] = [r * Math.sin(theta), y, r * Math.cos(theta)]
      }
  })
  return out
}

// ------------------------------------------------------------------- API
export interface PlaceOptions {
  mode?: ContainerPlacement
  values?: number[] // tiers (cone, pyramid, discs): e.g. degrees
  keys?: string[] // tie-breakers, e.g. node names
}

// Points of the box [-1, 1]³ into the unit shape, inside or on its surface.
export function placeInContainer(
  kind: VolumeKind,
  us: V3[],
  { mode = 'inside', values, keys }: PlaceOptions = {}
): V3[] {
  const surface = mode === 'surface' && CONTAINERS[kind].surface
  const box = us.map(clampBox)
  if (CONTAINERS[kind].tiers)
    return placeInTiers(
      kind,
      box,
      surface,
      values ?? box.map(() => 0),
      keys ?? box.map((_, i) => String(i))
    )
  return box.map((u, i) => pointOut(kind, u, surface, i))
}

// Whether a point (unit units) is inside the shape or on it, within eps.
export function insideContainer(kind: VolumeKind, p: V3, eps = 1e-6): boolean {
  const [x, y, z] = p
  const r2 = Math.hypot(x, z)
  const height = Math.abs(y) <= 1 + eps
  switch (kind) {
    case 'cube':
      return linf(p) <= 1 + eps
    case 'sphere':
    case 'bubble':
    case 'cloud':
      return norm(p) <= 1 + eps
    case 'ellipsoid':
      return (
        Math.hypot(x / ELLIPSOID[0], y / ELLIPSOID[1], z / ELLIPSOID[2]) <=
        1 + eps
      )
    case 'geodesic':
      return facets().every(([n, h]) => n.x * x + n.y * y + n.z * z <= h + eps)
    case 'cylinder':
      return height && r2 <= 1 + eps
    case 'hexprism':
      return height && r2 <= reach2(kind, around(x, z)) + eps
    case 'cone':
      return height && r2 <= (1 - y) / 2 + eps
    case 'pyramid':
      return height && Math.max(Math.abs(x), Math.abs(z)) <= (1 - y) / 2 + eps
    case 'dome':
      return y >= DOME_BASE - eps && norm([x, y - DOME_BASE, z]) <= 1 + eps
    case 'torus':
      return Math.hypot(Math.hypot(x, y) - TORUS.ring, z) <= TORUS.tube + eps
    case 'discs':
      return (
        r2 <= 1 + eps &&
        DISC_LEVELS.some(
          (level) => Math.abs(y - level) <= DISC_HALF_THICKNESS + eps
        )
      )
  }
}
