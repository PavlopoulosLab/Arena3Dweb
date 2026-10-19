// The geometry of the shapes View → Annotations draws around a group's
// members (actions/annotations.ts builds the meshes): bounding sphere, box and
// ellipsoid, the outline ring on the floor, and a seeded random source so a
// cloud looks the same on every redraw. Points are [x, y, z] in the layer
// plane's coordinates (x is the height above the floor).

export type Point3 = [number, number, number]

function bounds(points: Point3[]): { min: Point3; max: Point3 } {
  const min: Point3 = [Infinity, Infinity, Infinity]
  const max: Point3 = [-Infinity, -Infinity, -Infinity]
  for (const p of points)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p[i])
      max[i] = Math.max(max[i], p[i])
    }
  return { min, max }
}

const middle = (min: Point3, max: Point3): Point3 => [
  (min[0] + max[0]) / 2,
  (min[1] + max[1]) / 2,
  (min[2] + max[2]) / 2,
]

/** The members' box, `pad` wider on every side. */
export function paddedBox(
  points: Point3[],
  pad: number
): { min: Point3; max: Point3 } {
  const { min, max } = bounds(points)
  return {
    min: [min[0] - pad, min[1] - pad, min[2] - pad],
    max: [max[0] + pad, max[1] + pad, max[2] + pad],
  }
}

/** A sphere round the members' box centre holding every member, `pad` clear. */
export function boundingSphere(
  points: Point3[],
  pad: number
): { center: Point3; radius: number } {
  const { min, max } = bounds(points)
  const center = middle(min, max)
  let far = 0
  for (const p of points)
    far = Math.max(
      far,
      Math.hypot(p[0] - center[0], p[1] - center[1], p[2] - center[2])
    )
  return { center, radius: far + pad }
}

/**
 * An axis-aligned ellipsoid holding every member: the box's half-extents plus
 * `pad` on each axis, grown evenly until the corners' members are inside. A
 * group on a flat layer gives a flat lens, `pad` high.
 */
export function boundingEllipsoid(
  points: Point3[],
  pad: number
): { center: Point3; radii: Point3 } {
  const { min, max } = bounds(points)
  const center = middle(min, max)
  const radii = [0, 1, 2].map((i) => (max[i] - min[i]) / 2 + pad) as Point3
  let grow = 1
  for (const p of points) {
    const d = Math.hypot(
      (p[0] - center[0]) / radii[0],
      (p[1] - center[1]) / radii[1],
      (p[2] - center[2]) / radii[2]
    )
    grow = Math.max(grow, d)
  }
  return { center, radii: radii.map((r) => r * grow) as Point3 }
}

/**
 * The ring an outline draws on the floor: the hull pushed `pad` out from its
 * centroid (outer edge) and `width` back in (inner edge), as [y, z] points.
 */
export function outlineRing(
  hull: [number, number][],
  pad: number,
  width: number
): { outer: [number, number][]; inner: [number, number][] } {
  const cy = hull.reduce((s, p) => s + p[0], 0) / hull.length
  const cz = hull.reduce((s, p) => s + p[1], 0) / hull.length
  const push = (by: number) =>
    hull.map(([y, z]): [number, number] => {
      const len = Math.hypot(y - cy, z - cz) || 1
      // never past the centroid: a thin ring on a tiny group stays a ring
      const step = Math.max(by, -len)
      return [y + ((y - cy) / len) * step, z + ((z - cz) / len) * step]
    })
  return { outer: push(pad), inner: push(pad - width) }
}

/** A repeatable stream in [0, 1) for one group (the same name, the same cloud). */
export function seededRandom(key: string): () => number {
  let seed = 7
  for (let i = 0; i < key.length; i++)
    seed = (seed * 31 + key.charCodeAt(i)) % 2147483647
  if (seed <= 0) seed += 2147483646
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}
