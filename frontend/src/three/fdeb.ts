// Force-directed edge bundling (Holten & van Wijk 2009, "Force-Directed
// Edge Bundling for Graph Visualization"), in 3D. Pure: segments in, paths
// out, so it runs on layer-local (intra-layer) or scene-local (inter-layer)
// coordinates alike.
//
// Each edge becomes a chain of subdivision points held together by springs;
// points of compatible edges (similar direction, length and position, and in
// view of each other) attract, so related edges merge into shared bundles.
// Neighbours come from a grid over edge midpoints instead of all pairs, and
// each edge keeps its most compatible partners only, so the cost stays near
// linear in the number of edges.

export type Vec3 = [number, number, number]
export type Segment = [Vec3, Vec3]

export interface BundleOptions {
  cycles?: number // subdivision doublings (final points = 2^(cycles-1) + 1)
  iterations?: number // iterations of the first cycle; later ones shrink
  step?: number // first step size, as a fraction of the drawing's diagonal
  stiffness?: number // spring constant K
  threshold?: number // minimum compatibility (0-1)
  maxNeighbours?: number
}

const DEFAULTS: Required<BundleOptions> = {
  cycles: 5,
  iterations: 50,
  step: 0.004,
  stiffness: 0.1,
  threshold: 0.6,
  maxNeighbours: 40,
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: Vec3) => Math.sqrt(dot(a, a))
const mid = (s: Segment): Vec3 => [
  (s[0][0] + s[1][0]) / 2,
  (s[0][1] + s[1][1]) / 2,
  (s[0][2] + s[1][2]) / 2,
]

// Projection of p onto the line through s, as a point.
function project(p: Vec3, s: Segment): Vec3 {
  const d = sub(s[1], s[0])
  const l2 = dot(d, d) || 1
  const t = dot(sub(p, s[0]), d) / l2
  return [s[0][0] + t * d[0], s[0][1] + t * d[1], s[0][2] + t * d[2]]
}

// How much of q is "seen" from p (Holten & van Wijk's visibility term).
function visibility(p: Segment, q: Segment): number {
  const i0 = project(q[0], p)
  const i1 = project(q[1], p)
  const im: Vec3 = [
    (i0[0] + i1[0]) / 2,
    (i0[1] + i1[1]) / 2,
    (i0[2] + i1[2]) / 2,
  ]
  const span = len(sub(i0, i1))
  if (span === 0) return 0
  return Math.max(0, 1 - (2 * len(sub(mid(p), im))) / span)
}

export function compatibility(p: Segment, q: Segment): number {
  const dp = sub(p[1], p[0])
  const dq = sub(q[1], q[0])
  const lp = len(dp)
  const lq = len(dq)
  if (lp === 0 || lq === 0) return 0
  const angle = Math.abs(dot(dp, dq) / (lp * lq))
  const avg = (lp + lq) / 2
  const scale = 2 / (avg / Math.min(lp, lq) + Math.max(lp, lq) / avg)
  const position = avg / (avg + len(sub(mid(p), mid(q))))
  const c = angle * scale * position
  if (c === 0) return 0
  return c * Math.min(visibility(p, q), visibility(q, p))
}

// Compatible partners of every edge, found through a grid of midpoints.
function neighbours(segs: Segment[], o: Required<BundleOptions>): number[][] {
  const lengths = segs.map((s) => len(sub(s[1], s[0]))).sort((a, b) => a - b)
  const cell = Math.max(lengths[Math.floor(lengths.length * 0.75)] ?? 1, 1e-9)
  const key = (v: Vec3) =>
    `${Math.floor(v[0] / cell)},${Math.floor(v[1] / cell)},${Math.floor(v[2] / cell)}`
  const grid = new Map<string, number[]>()
  const mids = segs.map(mid)
  mids.forEach((m, i) => {
    const k = key(m)
    const list = grid.get(k)
    if (list) list.push(i)
    else grid.set(k, [i])
  })
  return segs.map((s, i) => {
    const [cx, cy, cz] = mids[i].map((v) => Math.floor(v / cell))
    const found: [number, number][] = []
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++)
          for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
            if (j === i) continue
            const c = compatibility(s, segs[j])
            if (c >= o.threshold) found.push([j, c])
          }
    found.sort((a, b) => b[1] - a[1])
    return found.slice(0, o.maxNeighbours).map(([j]) => j)
  })
}

// Insert points so every edge has `count` interior points, evenly spaced
// along its current polyline.
function subdivide(path: Vec3[], count: number): Vec3[] {
  const segLens: number[] = []
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const l = len(sub(path[i], path[i - 1]))
    segLens.push(l)
    total += l
  }
  const out: Vec3[] = [path[0]]
  if (total === 0) {
    for (let k = 0; k < count; k++) out.push([...path[0]])
    out.push(path[path.length - 1])
    return out
  }
  const stepLen = total / (count + 1)
  let seg = 0
  let walked = 0
  for (let k = 1; k <= count; k++) {
    const target = k * stepLen
    while (seg < segLens.length - 1 && walked + segLens[seg] < target) {
      walked += segLens[seg]
      seg++
    }
    const t = segLens[seg] ? (target - walked) / segLens[seg] : 0
    const a = path[seg]
    const b = path[seg + 1]
    out.push([
      a[0] + t * (b[0] - a[0]),
      a[1] + t * (b[1] - a[1]),
      a[2] + t * (b[2] - a[2]),
    ])
  }
  out.push(path[path.length - 1])
  return out
}

/**
 * Bundled polylines, one per segment, each starting and ending at the
 * segment's endpoints. Edges with no compatible partner stay straight.
 */
export function bundleEdges(
  segments: Segment[],
  options: BundleOptions = {}
): Vec3[][] {
  const o = { ...DEFAULTS, ...options }
  if (segments.length === 0) return []
  const all = segments.flat()
  const span = len(
    sub(
      [0, 1, 2].map((a) => Math.max(...all.map((p) => p[a]))) as Vec3,
      [0, 1, 2].map((a) => Math.min(...all.map((p) => p[a]))) as Vec3
    )
  )
  const near = neighbours(segments, o)
  let paths: Vec3[][] = segments.map((s) => [s[0], s[1]])
  let step = o.step * (span || 1)
  let iterations = o.iterations
  let points = 1
  for (let cycle = 0; cycle < o.cycles; cycle++) {
    paths = paths.map((p) => subdivide(p, points))
    for (let it = 0; it < iterations; it++) {
      const next = paths.map((path, e) => {
        if (near[e].length === 0) return path
        const s = segments[e]
        const kP = o.stiffness / ((len(sub(s[1], s[0])) || 1) * (points + 1))
        const out: Vec3[] = [path[0]]
        for (let i = 1; i <= points; i++) {
          const p = path[i]
          const prev = path[i - 1]
          const nxt = path[i + 1]
          // springs to the neighbouring points of the same edge
          const f: Vec3 = [
            kP * (prev[0] - p[0] + nxt[0] - p[0]),
            kP * (prev[1] - p[1] + nxt[1] - p[1]),
            kP * (prev[2] - p[2] + nxt[2] - p[2]),
          ]
          // attraction to the matching point of every compatible edge
          for (const q of near[e]) {
            const d = sub(paths[q][i], p)
            const l = len(d)
            if (l > 1e-9) {
              f[0] += d[0] / l
              f[1] += d[1] / l
              f[2] += d[2] / l
            }
          }
          const fl = len(f)
          // capped, so a crowded bundle can't fling a point across the view
          const k = fl > 1 ? step / fl : step
          out.push([p[0] + f[0] * k, p[1] + f[1] * k, p[2] + f[2] * k])
        }
        out.push(path[path.length - 1])
        return out
      })
      paths = next
    }
    step /= 2
    iterations = Math.max(1, Math.round((iterations * 2) / 3))
    points *= 2
  }
  // edges without partners stay a plain 2-point line
  return paths.map((p, e) =>
    near[e].length ? smooth(p) : [segments[e][0], segments[e][1]]
  )
}

// Light smoothing of the interior points; endpoints stay put.
function smooth(path: Vec3[]): Vec3[] {
  if (path.length < 3) return path
  return path.map((p, i) =>
    i === 0 || i === path.length - 1
      ? p
      : ([0, 1, 2].map(
          (a) => 0.25 * path[i - 1][a] + 0.5 * p[a] + 0.25 * path[i + 1][a]
        ) as Vec3)
  )
}
