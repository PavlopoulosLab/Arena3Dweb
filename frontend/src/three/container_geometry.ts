// Drawings of the layer containers (three/containers.ts): unit shapes,
// outlines and wire cages, plus the rim-light (glow) shader. Geometries and
// materials are shared between layers through a reference-counted pool — a
// layer scales the unit drawing by its half-width — and the last layer to
// let go of one disposes it, so 20 layers of any container cost one set.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  DISC_HALF_THICKNESS,
  DISC_LEVELS,
  DOME_BASE,
  ELLIPSOID,
  TORUS,
  type V3,
  type VolumeKind,
} from './containers'

type Disposable = { dispose(): void }

class SharedPool {
  private items = new Map<string, { value: Disposable; refs: number }>()

  acquire<T extends Disposable>(key: string, make: () => T): T {
    let item = this.items.get(key)
    if (!item) this.items.set(key, (item = { value: make(), refs: 0 }))
    item.refs++
    return item.value as T
  }

  release(key: string): void {
    const item = this.items.get(key)
    if (!item || --item.refs > 0) return
    item.value.dispose()
    this.items.delete(key)
  }

  // for tests and the performance check
  get size(): number {
    return this.items.size
  }
  refs(key: string): number {
    return this.items.get(key)?.refs ?? 0
  }
}

export const containerPool = new SharedPool()

// ------------------------------------------------------------ line helpers
type Points = number[] // x, y, z of segment ends, pairwise

function polyline(out: Points, pts: V3[], closed = false): void {
  for (let i = 0; i + 1 < pts.length + (closed ? 1 : 0); i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    out.push(...a, ...b)
  }
}

// a horizontal circle (round the y axis) of radius r at height y
const ringY = (r: number, y: number, n = 64): V3[] =>
  Array.from({ length: n }, (_, k) => {
    const t = (2 * Math.PI * k) / n
    return [r * Math.sin(t), y, r * Math.cos(t)]
  })

// a polygon round the y axis (vertices from +z, as CylinderGeometry's)
const polygonY = (r: number, y: number, sides: number, phase = 0): V3[] =>
  Array.from({ length: sides }, (_, k) => {
    const t = phase + (2 * Math.PI * k) / sides
    return [r * Math.sin(t), y, r * Math.cos(t)]
  })

// a vertical great circle (through the poles) at angle t round y
const meridian = (t: number, from = 0, to = 2 * Math.PI, n = 64): V3[] =>
  Array.from({ length: n + 1 }, (_, k) => {
    const a = from + ((to - from) * k) / n
    return [Math.sin(a) * Math.sin(t), Math.cos(a), Math.sin(a) * Math.cos(t)]
  })

const scaled = (pts: V3[], s: V3): V3[] =>
  pts.map(([x, y, z]) => [x * s[0], y * s[1], z * s[2]])
const moved = (pts: V3[], dy: number): V3[] =>
  pts.map(([x, y, z]) => [x, y + dy, z])

// a circle in the x-y plane (round the z axis), as the torus stands, at z
const ringZ = (r: number, z: number, n = 96): V3[] =>
  Array.from({ length: n }, (_, k) => {
    const t = (2 * Math.PI * k) / n
    return [r * Math.cos(t), r * Math.sin(t), z]
  })

function lines(points: Points): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return g
}

function edgesOf(g: THREE.BufferGeometry, angle = 1): THREE.BufferGeometry {
  const e = new THREE.EdgesGeometry(g, angle)
  g.dispose()
  return e
}

// ----------------------------------------------------------------- shapes
const pyramid = () =>
  new THREE.ConeGeometry(Math.SQRT2, 2, 4).rotateY(Math.PI / 4)

export function fillGeometry(kind: VolumeKind): THREE.BufferGeometry {
  switch (kind) {
    case 'cube':
      return new THREE.BoxGeometry(2, 2, 2)
    case 'cylinder':
      return new THREE.CylinderGeometry(1, 1, 2, 48)
    case 'cone':
      return new THREE.ConeGeometry(1, 2, 48)
    case 'pyramid':
      return pyramid()
    case 'hexprism':
      return new THREE.CylinderGeometry(1, 1, 2, 6)
    case 'geodesic':
      return new THREE.IcosahedronGeometry(1, 1)
    case 'ellipsoid':
      return new THREE.SphereGeometry(1, 48, 32).scale(...ELLIPSOID)
    case 'torus':
      // round the z axis: the ring stands across the floor
      return new THREE.TorusGeometry(TORUS.ring, TORUS.tube, 24, 72)
    case 'dome': {
      const sky = new THREE.SphereGeometry(
        1,
        48,
        16,
        0,
        2 * Math.PI,
        0,
        Math.PI / 2
      )
      const base = new THREE.CircleGeometry(1, 48).rotateX(Math.PI / 2)
      const g = mergeGeometries([sky, base]).translate(0, DOME_BASE, 0)
      sky.dispose()
      base.dispose()
      return g
    }
    case 'discs': {
      const plates = DISC_LEVELS.map((y) =>
        new THREE.CylinderGeometry(1, 1, 2 * DISC_HALF_THICKNESS, 48).translate(
          0,
          y,
          0
        )
      )
      const g = mergeGeometries(plates)
      for (const p of plates) p.dispose()
      return g
    }
    default:
      return new THREE.SphereGeometry(1, 48, 32) // sphere, bubble
  }
}

// The few lines that say which shape it is.
export function outlineGeometry(kind: VolumeKind): THREE.BufferGeometry {
  const pts: Points = []
  switch (kind) {
    case 'cube':
      return edgesOf(new THREE.BoxGeometry(2, 2, 2))
    case 'pyramid':
      return edgesOf(pyramid())
    case 'hexprism':
      return edgesOf(new THREE.CylinderGeometry(1, 1, 2, 6))
    case 'geodesic':
      return edgesOf(new THREE.IcosahedronGeometry(1, 1))
    case 'cylinder':
      polyline(pts, ringY(1, -1), true)
      polyline(pts, ringY(1, 1), true)
      for (const t of [0, 1, 2, 3])
        polyline(pts, [
          [Math.sin((t * Math.PI) / 2), -1, Math.cos((t * Math.PI) / 2)],
          [Math.sin((t * Math.PI) / 2), 1, Math.cos((t * Math.PI) / 2)],
        ])
      break
    case 'cone':
      polyline(pts, ringY(1, -1), true)
      for (const t of [0, 1, 2, 3])
        polyline(pts, [
          [Math.sin((t * Math.PI) / 2), -1, Math.cos((t * Math.PI) / 2)],
          [0, 1, 0],
        ])
      break
    case 'dome':
      polyline(pts, ringY(1, DOME_BASE), true)
      for (const t of [0, Math.PI / 2])
        polyline(pts, moved(meridian(t, -Math.PI / 2, Math.PI / 2), DOME_BASE))
      break
    case 'torus':
      for (const r of [TORUS.ring - TORUS.tube, TORUS.ring + TORUS.tube])
        polyline(pts, ringZ(r, 0), true)
      for (const z of [-TORUS.tube, TORUS.tube])
        polyline(pts, ringZ(TORUS.ring, z), true)
      break
    case 'discs':
      for (const y of DISC_LEVELS) polyline(pts, ringY(1, y), true)
      break
    default: {
      // sphere, ellipsoid, bubble: three great circles read as a ball
      const s: V3 = kind === 'ellipsoid' ? ELLIPSOID : [1, 1, 1]
      polyline(pts, scaled(ringY(1, 0, 96), s), true)
      polyline(pts, scaled(meridian(0, 0, 2 * Math.PI, 96), s))
      polyline(pts, scaled(meridian(Math.PI / 2, 0, 2 * Math.PI, 96), s))
    }
  }
  return lines(pts)
}

// A light cage over the whole surface (the Wireframe option).
export function wireGeometry(kind: VolumeKind): THREE.BufferGeometry {
  const pts: Points = []
  const levels = [-0.5, 0, 0.5]
  switch (kind) {
    case 'cube':
      for (const axis of [0, 1, 2])
        for (const side of [-1, 1])
          for (const c of [-0.5, 0, 0.5]) {
            // two lines across each face, along its other two axes
            const [a, b] = [0, 1, 2].filter((k) => k !== axis)
            for (const [along, at] of [
              [a, b],
              [b, a],
            ]) {
              const p: V3 = [0, 0, 0]
              const q: V3 = [0, 0, 0]
              p[axis] = q[axis] = side
              p[at] = q[at] = c
              p[along] = -1
              q[along] = 1
              polyline(pts, [p, q])
            }
          }
      break
    case 'geodesic':
      return edgesOf(new THREE.IcosahedronGeometry(1, 2))
    case 'cylinder':
    case 'hexprism': {
      const sides = kind === 'hexprism' ? 6 : 64
      for (const y of [-1, ...levels, 1])
        polyline(pts, polygonY(1, y, sides), true)
      for (let k = 0; k < 12; k++) {
        const t = (2 * Math.PI * k) / 12
        // the prism's are its edges and the middles of its faces
        const r = kind === 'hexprism' && k % 2 ? Math.cos(Math.PI / 6) : 1
        polyline(pts, [
          [r * Math.sin(t), -1, r * Math.cos(t)],
          [r * Math.sin(t), 1, r * Math.cos(t)],
        ])
      }
      break
    }
    case 'cone':
    case 'pyramid': {
      const pyr = kind === 'pyramid'
      for (const y of [-1, ...levels]) {
        const r = (1 - y) / 2
        polyline(
          pts,
          pyr ? polygonY(r * Math.SQRT2, y, 4, Math.PI / 4) : ringY(r, y),
          true
        )
      }
      const slants = pyr ? 8 : 12
      for (let k = 0; k < slants; k++) {
        const t = (2 * Math.PI * k) / slants
        // the pyramid's: its edges and the middles of its faces
        const r = pyr ? (k % 2 ? 1 : Math.SQRT2) : 1
        const a = t + (pyr ? Math.PI / 4 : 0)
        polyline(pts, [
          [r * Math.sin(a), -1, r * Math.cos(a)],
          [0, 1, 0],
        ])
      }
      break
    }
    case 'dome':
      for (const lat of [0, Math.PI / 6, Math.PI / 3])
        polyline(pts, ringY(Math.cos(lat), DOME_BASE + Math.sin(lat)), true)
      for (let k = 0; k < 12; k++)
        polyline(
          pts,
          moved(meridian((2 * Math.PI * k) / 12, 0, Math.PI / 2, 24), DOME_BASE)
        )
      break
    case 'torus':
      for (let k = 0; k < 18; k++) {
        // a circle round the tube at angle t on the ring
        const t = (2 * Math.PI * k) / 18
        const c = Array.from({ length: 32 }, (_, j): V3 => {
          const a = (2 * Math.PI * j) / 32
          const radial = TORUS.ring + TORUS.tube * Math.cos(a)
          return [
            radial * Math.cos(t),
            radial * Math.sin(t),
            TORUS.tube * Math.sin(a),
          ]
        })
        polyline(pts, c, true)
      }
      for (const r of [TORUS.ring - TORUS.tube, TORUS.ring + TORUS.tube])
        polyline(pts, ringZ(r, 0), true)
      for (const z of [-TORUS.tube, TORUS.tube])
        polyline(pts, ringZ(TORUS.ring, z), true)
      break
    case 'discs':
      for (const y of DISC_LEVELS) {
        polyline(pts, ringY(1, y), true)
        polyline(pts, ringY(0.5, y), true)
        for (let k = 0; k < 6; k++) {
          const t = (Math.PI * k) / 6
          polyline(pts, [
            [Math.sin(t), y, Math.cos(t)],
            [-Math.sin(t), y, -Math.cos(t)],
          ])
        }
      }
      break
    case 'cloud':
      break
    default: {
      // sphere, ellipsoid, bubble: meridians and parallels
      const s: V3 = kind === 'ellipsoid' ? ELLIPSOID : [1, 1, 1]
      for (let k = 0; k < 6; k++)
        polyline(
          pts,
          scaled(meridian((Math.PI * k) / 6, 0, 2 * Math.PI, 72), s)
        )
      for (const lat of [-60, -30, 0, 30, 60].map((d) => (d * Math.PI) / 180))
        polyline(pts, scaled(ringY(Math.cos(lat), Math.sin(lat)), s), true)
    }
  }
  return lines(pts)
}

// ------------------------------------------------------------- materials
// Rim light: brighter where the surface turns away from the viewer, like the
// edge of a glass or a soap bubble. Works with the orthographic camera.
const GLOW_VERTEX = `
  uniform float power;
  varying float vRim;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vec3 v = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-mv.xyz);
    vRim = pow(1.0 - abs(dot(n, v)), power);
    gl_Position = projectionMatrix * mv;
  }
`
const GLOW_FRAGMENT = `
  uniform vec3 color;
  uniform float intensity;
  varying float vRim;
  void main() {
    gl_FragColor = vec4(color, clamp(vRim * intensity, 0.0, 1.0));
    #include <colorspace_fragment>
  }
`

export function glowMaterial(
  color: string,
  intensity: number,
  power: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(color) },
      intensity: { value: intensity },
      power: { value: power },
    },
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
  })
}

// one soft round puff, shared by every fog-cloud sprite
export function puffTexture(): THREE.Texture {
  if (typeof document === 'undefined') return new THREE.Texture() // headless
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  if (g) {
    const h = size / 2
    const grad = g.createRadialGradient(h, h, 0, h, h, h)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.4, 'rgba(255,255,255,0.4)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, size, size)
  }
  return new THREE.CanvasTexture(canvas)
}

// Where the fog cloud's puffs go (unit sphere; [x, y, z, size]): denser
// towards the centre so the edge fades out, the same cloud every time.
let puffs: [number, number, number, number][] | null = null
export function puffLayout(): [number, number, number, number][] {
  if (puffs) return puffs
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  puffs = []
  for (let k = 0; k < 36; k++) {
    const d = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1)
      .normalize()
      .multiplyScalar(Math.sqrt(rand()) * 0.85)
    puffs.push([d.x, d.y, d.z, 0.5 + 0.5 * rand()])
  }
  return puffs
}
