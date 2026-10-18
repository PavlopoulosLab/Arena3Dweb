// Annotation overlays — PLAN-ROADMAP Phase 6: pie-chart nodes for nodes with
// annotations, and translucent convex hulls around clusters or annotation
// groups, drawn per layer on the floor.

import * as THREE from 'three'
import { ctx } from '../three'
import { COLOR_VECTOR_280, SPHERE_RADIUS } from '../three/constants'
import { registerAnimateHook } from './screen'

// ---------------------------------------------------------------- colours
// Stable colour per term/cluster, in first-seen order.
const groupColors = new Map<string, string>()
export function groupColor(key: string): string {
  let c = groupColors.get(key)
  if (!c) {
    c = COLOR_VECTOR_280[(groupColors.size * 7 + 3) % COLOR_VECTOR_280.length]
    groupColors.set(key, c)
  }
  return c
}

// The Groups card recolours a group: pies and hulls follow.
export function setGroupColor(key: string, color: string): void {
  groupColors.set(key, color)
  if (piesOn) showAnnotationPies(true)
  redrawHulls()
}

// Groups whose hull / fog cloud is switched off in the Groups card.
const hiddenGroups = new Set<string>()
export const isGroupHidden = (key: string) => hiddenGroups.has(key)
export function setGroupHidden(key: string, hidden: boolean): void {
  if (hidden) hiddenGroups.add(key)
  else hiddenGroups.delete(key)
  redrawHulls()
}

// ---------------------------------------------------------------- pies
const pies = new Map<number, THREE.Sprite>() // node index -> sprite
let piesOn = false

function pieTexture(terms: string[]): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  const r = size / 2 - 2
  terms.forEach((t, i) => {
    g.beginPath()
    g.moveTo(size / 2, size / 2)
    g.arc(
      size / 2,
      size / 2,
      r,
      -Math.PI / 2 + (2 * Math.PI * i) / terms.length,
      -Math.PI / 2 + (2 * Math.PI * (i + 1)) / terms.length
    )
    g.closePath()
    g.fillStyle = groupColor(t)
    g.fill()
  })
  g.lineWidth = 3
  g.strokeStyle = 'rgba(255,255,255,0.85)'
  g.beginPath()
  g.arc(size / 2, size / 2, r, 0, 2 * Math.PI)
  g.stroke()
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function clearPies(): void {
  for (const [i, sprite] of pies) {
    ctx.nodeObjects[i]?.sphere.remove(sprite)
    sprite.material.map?.dispose()
    sprite.material.dispose()
  }
  pies.clear()
}

// A sprite child of each annotated node's sphere, so it follows the node and
// always faces the camera. Sized relative to the sphere's own geometry.
export function showAnnotationPies(flag: boolean): void {
  piesOn = flag
  clearPies()
  if (!flag) return
  ctx.nodeObjects.forEach((node, i) => {
    if (node.annotations.length === 0) return
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: pieTexture(node.annotations),
        depthWrite: false,
      })
    )
    node.sphere.geometry.computeBoundingSphere()
    const d = (node.sphere.geometry.boundingSphere?.radius ?? 5) * 3
    sprite.scale.set(d, d, 1)
    node.sphere.add(sprite)
    pies.set(i, sprite)
  })
}

export const piesEnabled = () => piesOn

// ---------------------------------------------------------------- hulls
export type HullSource = 'none' | 'cluster' | 'annotation'
// 'fog': NORMA-style soft clouds instead of hard outlines
export type HullStyle = 'hull' | 'fog'
let hullSource: HullSource = 'none'
let hullStyle: HullStyle = 'hull'
const hulls: { plane: THREE.Object3D; mesh: THREE.Object3D }[] = []
let frame = 0
// clearly wider than a node, so a tightly packed cluster still shows its hull
const HULL_PAD = SPHERE_RADIUS * 3

// Andrew's monotone chain; points as [y, z] in the layer plane.
export function convexHull(points: [number, number][]): [number, number][] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (pts.length < 3) return pts
  const cross = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: [number, number][] = []
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    )
      lower.pop()
    lower.push(p)
  }
  const upper: [number, number][] = []
  for (const p of [...pts].reverse()) {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    )
      upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

// Hull pushed `pad` outwards from its centroid, as a triangle fan lying just
// above the floor (local x = ±1). Points/segments get a small disc/strip.
function hullGeometry(
  points: [number, number][],
  pad: number
): THREE.BufferGeometry {
  let hull = convexHull(points)
  if (hull.length < 3) {
    // 1-2 nodes: a padded square around them still shows the group
    const ys = points.map((p) => p[0])
    const zs = points.map((p) => p[1])
    const [y0, y1, z0, z1] = [
      Math.min(...ys),
      Math.max(...ys),
      Math.min(...zs),
      Math.max(...zs),
    ]
    hull = [
      [y0, z0],
      [y1, z0],
      [y1, z1],
      [y0, z1],
    ]
  }
  const cy = hull.reduce((s, p) => s + p[0], 0) / hull.length
  const cz = hull.reduce((s, p) => s + p[1], 0) / hull.length
  const out = hull.map(([y, z]) => {
    const len = Math.hypot(y - cy, z - cz) || 1
    return [y + ((y - cy) / len) * pad, z + ((z - cz) / len) * pad]
  })
  // one fan on each face of the floor: the floor writes depth, so a single
  // fan would vanish whenever the camera looks at the other face
  const pos: number[] = []
  for (const x of [1, -1])
    for (let i = 0; i < out.length; i++) {
      const [ay, az] = out[i]
      const [by, bz] = out[(i + 1) % out.length]
      pos.push(x, cy, cz, x, ay, az, x, by, bz)
    }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return geo
}

function clearHulls(): void {
  for (const { plane, mesh } of hulls) {
    plane.remove(mesh)
    mesh.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        ;(o.geometry as THREE.BufferGeometry).dispose()
        ;(o.material as THREE.Material).dispose()
      } else if (o instanceof THREE.Sprite) o.material.dispose()
    })
  }
  hulls.length = 0
}

// White radial falloff, tinted per group through the sprite colour.
let fogTexture: THREE.Texture | null = null
function fogMap(): THREE.Texture | null {
  if (fogTexture) return fogTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  if (!g) return null
  const grad = g.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  )
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  fogTexture = new THREE.CanvasTexture(canvas)
  return fogTexture
}

const FOG_PUFFS = 120 // per group; larger groups are sampled evenly

// A fog cloud: one broad haze over the group plus a puff on its members, so
// the cloud follows the group's shape (also in 3D layouts).
function fogCloud(points: THREE.Vector3[], color: string): THREE.Group {
  const group = new THREE.Group()
  const map = fogMap()
  const tint = new THREE.Color(color)
  const centre = new THREE.Vector3()
  for (const p of points) centre.add(p)
  centre.divideScalar(points.length)
  const spread = Math.max(...points.map((p) => p.distanceTo(centre)))
  const puff = (at: THREE.Vector3, size: number, opacity: number) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map,
        color: tint,
        transparent: true,
        opacity,
        depthWrite: false,
      })
    )
    sprite.position.copy(at)
    sprite.scale.set(size, size, 1)
    sprite.renderOrder = 2
    group.add(sprite)
  }
  puff(centre, 2 * spread + HULL_PAD * 4, 0.22)
  const step = Math.max(1, Math.ceil(points.length / FOG_PUFFS))
  for (let i = 0; i < points.length; i += step)
    puff(points[i], HULL_PAD * 5, 0.3)
  return group
}

// group key(s) of a node for the current source
function groupsOf(i: number): string[] {
  const node = ctx.nodeObjects[i]
  if (hullSource === 'cluster')
    return node.cluster ? [`Cluster ${node.cluster}`] : []
  return node.annotations
}

export function redrawHulls(): void {
  clearHulls()
  lastSignature = positionSignature()
  if (hullSource === 'none') return
  ctx.layers.forEach((layer) => {
    const groups = new Map<string, [number, number][]>()
    const points3d = new Map<string, THREE.Vector3[]>()
    const colors = new Map<string, string>()
    ctx.nodeObjects.forEach((node, i) => {
      if (node.layer !== layer.name) return
      for (const key of groupsOf(i)) {
        // cluster hulls match the nodes' cluster colour
        if (hullSource === 'cluster') colors.set(key, node.clusterColor)
        const list = groups.get(key) ?? []
        list.push([node.getPosition('y'), node.getPosition('z')])
        groups.set(key, list)
        const pts = points3d.get(key) ?? []
        pts.push(
          new THREE.Vector3(
            node.getPosition('x'),
            node.getPosition('y'),
            node.getPosition('z')
          )
        )
        points3d.set(key, pts)
      }
    })
    for (const [key, points] of groups) {
      if (hiddenGroups.has(key)) continue
      if (hullStyle === 'fog') {
        const cloud = fogCloud(
          points3d.get(key)!,
          colors.get(key) ?? groupColor(key)
        )
        cloud.userData.hullGroup = key
        layer.plane.add(cloud)
        hulls.push({ plane: layer.plane, mesh: cloud })
        continue
      }
      const mesh = new THREE.Mesh(
        hullGeometry(points, HULL_PAD),
        new THREE.MeshBasicMaterial({
          color: colors.get(key) ?? groupColor(key),
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      )
      mesh.userData.hullGroup = key
      mesh.renderOrder = 2 // after the (transparent) floor, so it isn't washed out
      layer.plane.add(mesh)
      hulls.push({ plane: layer.plane, mesh })
    }
  })
}

export function setHullSource(source: HullSource): void {
  hullSource = source
  redrawHulls()
}

export function setHullStyle(style: HullStyle): void {
  hullStyle = style
  redrawHulls()
}

export const hullCount = () => hulls.length

// Nodes move (layouts, drags, undo): check a few times a second while on,
// and rebuild only when positions changed — a fog cloud is hundreds of
// sprites, so a blind redraw would churn through them even in a still scene.
let lastSignature = ''
function positionSignature(): string {
  let x = 0
  let y = 0
  let z = 0
  let q = 0
  for (const n of ctx.nodeObjects) {
    const [a, b, c] = [
      n.getPosition('x'),
      n.getPosition('y'),
      n.getPosition('z'),
    ]
    x += a
    y += b
    z += c
    q += a * a + b * b + c * c
  }
  return `${ctx.nodeObjects.length}|${x.toFixed(1)}|${y.toFixed(1)}|${z.toFixed(1)}|${q.toFixed(0)}`
}

// a change just made (a layout, an arrangement, undo): look on the next frame
export function checkHullsSoon(): void {
  frame = 19
}

registerAnimateHook(() => {
  if (hullSource === 'none') return
  if (++frame % 20 !== 0) return
  const sig = positionSignature()
  if (sig === lastSignature) return
  lastSignature = sig
  redrawHulls()
})

// New network: old meshes belong to a discarded scene; colours restart.
export function resetAnnotationOverlays(): void {
  hulls.length = 0
  pies.clear()
  groupColors.clear()
  hiddenGroups.clear()
  if (piesOn) showAnnotationPies(true)
  redrawHulls()
}
