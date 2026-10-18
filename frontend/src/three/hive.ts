// Hive plot links (Krzywinski et al. 2012): while the hive arrangement is on
// (ctx.hive), links run as curves between the axes instead of straight lines —
// each leaves its axis at the node's distance from the centre and swings round
// to the other axis, in the plane the two axes span — and links between two
// nodes of one axis arc beside it, where the paper draws them between the axis
// and its clone. Axes may lie in one plane or spread through 3D; nodes of a
// flat hive may be lifted off its plane (a second property), and the curve
// carries that lift from one end to the other.

import * as THREE from 'three'
import { ctx } from './runtime'
import type { Edge } from './Edge'

const SAMPLES = 24
// how far beside its axis a same-axis link swings (the clone's angle)
const CLONE_ANGLE = THREE.MathUtils.degToRad(18)

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
  const up = new THREE.Vector3(...hive.up)
  // the plane's normal, towards the viewer
  const normal = new THREE.Vector3(...hive.right).cross(up).normalize()
  const flat = hive.axes !== '3d'
  // a point = its axis's direction × its distance from the centre, plus (flat
  // hive) its lift off the plane
  const split = (p: THREE.Vector3) => {
    const lift = flat
      ? normal.clone().multiplyScalar(p.dot(normal))
      : new THREE.Vector3()
    const onAxis = p.clone().sub(lift)
    const r = onAxis.length()
    return { d: onAxis.divideScalar(r || 1), r, lift }
  }
  // a direction across d: within the plane (flat), or across the view
  const across = (d: THREE.Vector3) => {
    const ref = flat || Math.abs(d.dot(normal)) < 0.99 ? normal : up
    return ref.clone().cross(d).normalize()
  }
  const a = toHive(points[0])
  const b = toHive(points[points.length - 1])
  const A = split(a)
  const B = split(b)
  if (A.r < 1e-6 || B.r < 1e-6) return null
  const cos = THREE.MathUtils.clamp(A.d.dot(B.d), -1, 1)
  let dir1: THREE.Vector3 // the curve's directions at one and two thirds
  let dir2: THREE.Vector3
  if (cos > 1 - 1e-6) {
    // one axis: an arc beside it, as between an axis and its clone
    if (Math.abs(A.r - B.r) < 1e-6 && A.lift.distanceTo(B.lift) < 1e-6)
      return null
    dir1 = A.d
      .clone()
      .multiplyScalar(Math.cos(CLONE_ANGLE))
      .addScaledVector(across(A.d), Math.sin(CLONE_ANGLE))
    dir2 = dir1
  } else if (cos < -1 + 1e-6) {
    // opposite axes: round the centre rather than through it
    const side = across(A.d)
    const turn = (t: number) =>
      A.d
        .clone()
        .multiplyScalar(Math.cos(Math.PI * t))
        .addScaledVector(side, Math.sin(Math.PI * t))
    dir1 = turn(1 / 3)
    dir2 = turn(2 / 3)
  } else {
    // the shorter way round, in the plane of the two axes
    const angle = Math.acos(cos)
    const slerp = (t: number) =>
      A.d
        .clone()
        .multiplyScalar(Math.sin((1 - t) * angle))
        .addScaledVector(B.d, Math.sin(t * angle))
        .divideScalar(Math.sin(angle))
    dir1 = slerp(1 / 3)
    dir2 = slerp(2 / 3)
  }
  const path = new THREE.CubicBezierCurve3(
    a,
    dir1.clone().multiplyScalar(A.r).add(A.lift),
    dir2.clone().multiplyScalar(B.r).add(B.lift),
    b
  ).getPoints(SAMPLES)
  return path.map(fromHive)
}
