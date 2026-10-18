// Hive plot links (Krzywinski et al. 2012): while the hive arrangement is on
// (ctx.hive), links run as curves between the radial axes instead of straight
// lines — each leaves its axis at the node's radius and swings round to the
// other axis — and links between two nodes of one axis arc beside it, where
// the paper draws them between the axis and its clone.

import * as THREE from 'three'
import { ctx } from './runtime'
import type { Edge } from './Edge'

const SAMPLES = 24
// how far beside its axis a same-axis link swings (the clone's angle)
const CLONE_ANGLE = THREE.MathUtils.degToRad(18)

function cubic(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3
): THREE.Vector3[] {
  return new THREE.CubicBezierCurve3(p0, p1, p2, p3).getPoints(SAMPLES)
}

/** The edge's hive curve in its own frame, or null for a straight line. */
export function hivePath(
  edge: Edge,
  points: THREE.Vector3[]
): THREE.Vector3[] | null {
  const hive = ctx.hive
  const frame = ctx.scene?.sphere
  if (!hive?.curved || !frame || points.length < 2) return null
  // into the frame of the hive (the scene sphere) — inter-layer points come
  // in world space, intra-layer ones in their floor's own frame
  const own = edge.interLayer
    ? null
    : (ctx.layers[edge.sourceLayerIndex]?.plane ?? null)
  const toHive = (p: THREE.Vector3) =>
    frame.worldToLocal(own ? own.localToWorld(p.clone()) : p.clone())
  const fromHive = (p: THREE.Vector3) => {
    const w = frame.localToWorld(p)
    return own ? own.worldToLocal(w) : w
  }
  const right = new THREE.Vector3(...hive.right)
  const up = new THREE.Vector3(...hive.up)
  const polar = (p: THREE.Vector3): [number, number] => [
    Math.atan2(p.dot(up), p.dot(right)),
    Math.hypot(p.dot(right), p.dot(up)),
  ]
  const at = (angle: number, radius: number) =>
    right
      .clone()
      .multiplyScalar(radius * Math.cos(angle))
      .addScaledVector(up, radius * Math.sin(angle))
  const a = toHive(points[0])
  const b = toHive(points[points.length - 1])
  const [aa, ra] = polar(a)
  const [ab, rb] = polar(b)
  if (ra < 1e-6 || rb < 1e-6) return null
  // the shorter way round between the two axes
  let delta = ab - aa
  while (delta > Math.PI) delta -= 2 * Math.PI
  while (delta < -Math.PI) delta += 2 * Math.PI
  let path: THREE.Vector3[]
  if (Math.abs(delta) < 1e-3) {
    // one axis: an arc beside it, as between an axis and its clone
    if (Math.abs(ra - rb) < 1e-6) return null
    path = cubic(a, at(aa + CLONE_ANGLE, ra), at(ab + CLONE_ANGLE, rb), b)
  } else if (Math.abs(Math.abs(delta) - Math.PI) < 1e-3) {
    return null // opposite axes: straight through the centre
  } else path = cubic(a, at(aa + delta / 3, ra), at(ab - delta / 3, rb), b)
  return path.map(fromHive)
}
