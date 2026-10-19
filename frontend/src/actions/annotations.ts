// Annotation overlays — PLAN-ROADMAP Phase 6: pie-chart nodes for nodes with
// annotations, and a shape around every cluster or annotation group on each
// layer (View → Annotations, Draw as): a hull or an outline on the floor, a
// fog cloud or a cloud, or a sphere, ellipsoid or box (actions/group_shapes.ts).

import * as THREE from 'three'
import type { AnnotationView } from '../api/client'
import { ctx } from '../three'
import { COLOR_VECTOR_280, SPHERE_RADIUS } from '../three/constants'
import { registerAnimateHook } from './screen'
import { bus } from '../bus'
import { redrawIntraLayerEdges } from './edge'
import {
  boundingEllipsoid,
  boundingSphere,
  outlineRing,
  paddedBox,
  seededRandom,
  type Point3,
} from './group_shapes'

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

// Groups switched off in the Groups card or the Clustering summary: their
// shape is not drawn, and their nodes fade (applyGroupFade).
const hiddenGroups = new Set<string>()
export const isGroupHidden = (key: string) => hiddenGroups.has(key)
export type GroupKind = 'annotation' | 'cluster'
export function setGroupHidden(
  key: string,
  hidden: boolean,
  kind?: GroupKind
): void {
  setGroupsHidden([key], hidden, kind)
}
// many at once (Show: All / None), drawn once; `kind`: the list they were
// switched in, whose groups decide what fades
export function setGroupsHidden(
  keys: string[],
  hidden: boolean,
  kind?: GroupKind
): void {
  if (kind) fadeKind = kind
  for (const key of keys)
    if (hidden) hiddenGroups.add(key)
    else hiddenGroups.delete(key)
  redrawHulls()
  applyGroupFade()
  bus.emit('groups:shown', { source: fadeKind })
}

// ---------------------------------------------------------------- fade
// Show only the chosen groups: once some groups of a kind (clusters, or
// annotation terms) are switched off, a node in none of the groups still
// shown — in no group at all, too — fades, and so do the edges touching it.
let fadeKind: GroupKind = 'cluster'
let anyFaded = false

const groupKeys = (n: (typeof ctx.nodeObjects)[number]): string[] =>
  fadeKind === 'cluster'
    ? n.cluster
      ? [`Cluster ${n.cluster}`]
      : []
    : n.annotations

export function applyGroupFade(): void {
  const keys = ctx.nodeObjects.map(groupKeys)
  const active = keys.some((k) => k.some((key) => hiddenGroups.has(key)))
  const faded = new Set<string>()
  ctx.nodeObjects.forEach((node, i) => {
    const fade = active && keys[i].every((key) => hiddenGroups.has(key))
    if (fade) faded.add(node.nodeLayerName)
    if (fade !== node.faded) {
      node.faded = fade
      node.setOpacity(1)
    }
  })
  let redraw = false
  for (const edge of ctx.edgeObjects) {
    const fade = faded.has(edge.source) || faded.has(edge.target)
    if (fade !== edge.faded) {
      edge.faded = fade
      redraw = true
    }
  }
  anyFaded = faded.size > 0
  if (redraw) {
    redrawIntraLayerEdges()
    ctx.renderInterLayerEdgesFlag = true
  }
}

// new communities take the place of the old: their switches start on
bus.on('clustering:applied', () => {
  for (const key of [...hiddenGroups])
    if (key.startsWith('Cluster ')) hiddenGroups.delete(key)
  redrawHulls()
  applyGroupFade()
})
// the groups' members changed (a file, an enrichment, undo of a run)
bus.on('groups:changed', applyGroupFade)
bus.on('history:changed', () => {
  if (anyFaded || hiddenGroups.size > 0) applyGroupFade()
})

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
// on the floor (hull, outline), soft (fog: NORMA-style haze over the members;
// cloud: a round volume of puffs) or a 3D container (sphere, ellipsoid, box)
export const HULL_STYLES = [
  'hull',
  'outline',
  'fog',
  'cloud',
  'sphere',
  'ellipsoid',
  'box',
] as const
export type HullStyle = (typeof HULL_STYLES)[number]
let hullSource: HullSource = 'none'
let hullStyle: HullStyle = 'hull'
const hulls: { plane: THREE.Object3D; mesh: THREE.Object3D }[] = []
let frame = 0
// clearly wider than a node, so a tightly packed cluster still shows its hull
const HULL_PAD = SPHERE_RADIUS * 3
// View → Annotations' Opacity and Padding (× HULL_PAD) of every shape
export const HULL_OPACITY = 0.35
let hullOpacity = HULL_OPACITY
let hullPadding = 1

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

// The members' convex hull on the floor; 1-2 nodes get a square around them.
function floorHull(points: [number, number][]): [number, number][] {
  const hull = convexHull(points)
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
    return [
      [y0, z0],
      [y1, z0],
      [y1, z1],
      [y0, z1],
    ]
  }
  return hull
}

// Hull pushed `pad` outwards from its centroid, as a triangle fan lying just
// above the floor (local x = ±1).
function hullGeometry(
  points: [number, number][],
  pad: number
): THREE.BufferGeometry {
  const hull = floorHull(points)
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

// A band along the padded hull's edge, on both faces of the floor as the
// hull is: a line would be one pixel wide.
function outlineGeometry(
  points: [number, number][],
  pad: number
): THREE.BufferGeometry {
  const { outer, inner } = outlineRing(floorHull(points), pad, HULL_PAD * 0.3)
  const pos: number[] = []
  for (const x of [1, -1])
    for (let i = 0; i < outer.length; i++) {
      const j = (i + 1) % outer.length
      const [a, b, c, d] = [outer[i], outer[j], inner[j], inner[i]]
      pos.push(x, ...a, x, ...b, x, ...c, x, ...a, x, ...c, x, ...d)
    }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return geo
}

function clearHulls(): void {
  for (const { plane, mesh } of hulls) {
    plane.remove(mesh)
    mesh.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
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
  const pad = HULL_PAD * hullPadding
  const dim = hullOpacity / HULL_OPACITY
  const puff = (at: THREE.Vector3, size: number, opacity: number) => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map,
        color: tint,
        transparent: true,
        opacity: Math.min(1, opacity * dim),
        depthWrite: false,
      })
    )
    sprite.position.copy(at)
    sprite.scale.set(size, size, 1)
    sprite.renderOrder = 2
    group.add(sprite)
  }
  puff(centre, 2 * spread + pad * 4, 0.22)
  const step = Math.max(1, Math.ceil(points.length / FOG_PUFFS))
  for (let i = 0; i < points.length; i += step) puff(points[i], pad * 5, 0.3)
  return group
}

// every part's opacity follows the Opacity slider, capped at 1
const shade = (base: number) => Math.min(1, (base * hullOpacity) / HULL_OPACITY)

const fill = (color: THREE.Color, base: number) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: shade(base),
    depthWrite: false,
  })

const lines = (color: THREE.Color, base: number) =>
  new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: shade(base),
  })

// three great circles of a unit sphere: they read as a sphere without a
// dense wireframe (as a layer's sphere container)
function greatCircles(color: THREE.Color): THREE.LineLoop[] {
  return [0, 1, 2].map(
    (axis) =>
      new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(
          Array.from({ length: 64 }, (_, i) => {
            const a = (2 * Math.PI * i) / 64
            const [u, v] = [Math.cos(a), Math.sin(a)]
            return axis === 0
              ? new THREE.Vector3(0, u, v)
              : axis === 1
                ? new THREE.Vector3(u, 0, v)
                : new THREE.Vector3(u, v, 0)
          })
        ),
        lines(color, 0.6)
      )
  )
}

const CLOUD_PUFFS = 36 // as a layer's cloud container, plus one per member up to 80

// Sphere, ellipsoid, box or cloud around a group's members (3D, so groups in
// 3D layouts and volume layers are held whole).
function container(
  style: 'cloud' | 'sphere' | 'ellipsoid' | 'box',
  points: Point3[],
  color: string,
  key: string
): THREE.Group {
  const group = new THREE.Group()
  const tint = new THREE.Color(color)
  const pad = HULL_PAD * hullPadding
  if (style === 'box') {
    const { min, max } = paddedBox(points, pad)
    const geo = new THREE.BoxGeometry(
      max[0] - min[0],
      max[1] - min[1],
      max[2] - min[2]
    )
    group.add(
      new THREE.Mesh(geo, fill(tint, 0.12)),
      new THREE.LineSegments(new THREE.EdgesGeometry(geo), lines(tint, 0.7))
    )
    group.position.set(
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      (min[2] + max[2]) / 2
    )
  } else if (style === 'cloud') {
    const { center, radius } = boundingSphere(points, pad)
    const map = fogMap()
    const rand = seededRandom(key) // the same cloud on every redraw
    const puff = (at: THREE.Vector3, size: number, base: number) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map,
          color: tint,
          transparent: true,
          opacity: shade(base),
          depthWrite: false,
        })
      )
      sprite.position.copy(at)
      sprite.scale.set(size, size, 1)
      sprite.renderOrder = 2
      group.add(sprite)
    }
    puff(new THREE.Vector3(), 2.4 * radius, 0.25) // the haze
    const count = CLOUD_PUFFS + Math.min(points.length, 44)
    for (let k = 0; k < count; k++) {
      // denser towards the centre, so the edge fades out
      const dir = new THREE.Vector3(
        rand() * 2 - 1,
        rand() * 2 - 1,
        rand() * 2 - 1
      ).normalize()
      puff(
        dir.multiplyScalar(radius * Math.sqrt(rand()) * 0.85),
        radius * (0.5 + 0.5 * rand()),
        0.12
      )
    }
    group.position.set(...center)
  } else {
    const { center, radii } =
      style === 'sphere'
        ? (({ center, radius }) => ({
            center,
            radii: [radius, radius, radius] as Point3,
          }))(boundingSphere(points, pad))
        : boundingEllipsoid(points, pad)
    group.add(
      new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), fill(tint, 0.12)),
      ...greatCircles(tint)
    )
    group.position.set(...center)
    group.scale.set(...radii)
  }
  group.traverse((o) => (o.renderOrder = 2))
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
      const color = colors.get(key) ?? groupColor(key)
      const members = points3d.get(key)!
      let mesh: THREE.Object3D
      if (hullStyle === 'fog') mesh = fogCloud(members, color)
      else if (hullStyle === 'hull' || hullStyle === 'outline') {
        mesh = new THREE.Mesh(
          hullStyle === 'hull'
            ? hullGeometry(points, HULL_PAD * hullPadding)
            : outlineGeometry(points, HULL_PAD * hullPadding),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: hullStyle === 'hull' ? hullOpacity : shade(0.85),
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        )
        mesh.renderOrder = 2 // after the (transparent) floor, so it isn't washed out
      } else
        mesh = container(
          hullStyle,
          members.map((p) => [p.x, p.y, p.z]),
          color,
          key
        )
      mesh.userData.hullGroup = key
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

// 0–1; a fog cloud scales its own (softer) opacities by the same amount
export function setHullOpacity(opacity: number): void {
  hullOpacity = opacity
  redrawHulls()
}

// × the default margin around the members
export function setHullPadding(padding: number): void {
  hullPadding = padding
  redrawHulls()
}

export const hullCount = () => hulls.length

// How the groups are drawn, for the session file (actions/session.ts)
export function annotationView(): AnnotationView {
  return {
    source: hullSource,
    style: hullStyle,
    opacity: hullOpacity,
    padding: hullPadding,
    pies: piesOn,
    hidden: [...hiddenGroups],
  }
}

// A loading session's drawing settings wait for the new scene: the reset on
// network:loaded clears the hidden groups (ui/annotations.ts applies them).
let pendingView: AnnotationView | null = null
export function stashAnnotationView(view?: AnnotationView | null): void {
  pendingView = view ?? null
}
export function takeAnnotationView(): AnnotationView | null {
  const view = pendingView
  pendingView = null
  return view
}

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
  applyGroupFade()
}
