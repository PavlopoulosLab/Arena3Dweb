// Coordinate-system axes for the scene and for each layer: an arrow per axis
// (shaft, arrowhead, tick marks and a letter) in the classic red X / green Y
// / blue Z, with an opacity that the Scene & Camera and Layers panels set.
// v2 drew three bare lines.

import * as THREE from 'three'

export const AXIS_COLORS = ['#FB3D2A', '#46FB2A', '#2AC2FB'] as const
export const AXIS_LETTERS = ['X', 'Y', 'Z'] as const
export const DEFAULT_AXES_OPACITY = 0.85

const UP = new THREE.Vector3(0, 1, 0)
const DIRS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 0, 1),
]

// The letter past the tip, as a sprite (it always faces the camera). jsdom
// has no 2D canvas (nor does node), so under vitest the sprite is blank.
function letterMaterial(
  letter: string,
  color: string,
  opacity: number
): THREE.SpriteMaterial {
  // vitest runs without a DOM (or with jsdom, which has no 2D canvas)
  const noCanvas =
    typeof document === 'undefined' ||
    (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent))
  let map: THREE.Texture
  if (noCanvas) {
    map = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
  } else {
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const g = canvas.getContext('2d')
    if (g) {
      g.font = 'bold 46px system-ui, -apple-system, "Segoe UI", sans-serif'
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillStyle = color
      g.fillText(letter, size / 2, size / 2 + 2)
    }
    map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
  }
  map.needsUpdate = true
  return new THREE.SpriteMaterial({
    map,
    transparent: true,
    opacity,
    depthWrite: false,
  })
}

export interface AxesLook {
  radius?: number // shaft radius (world units)
  letter?: number // letter size (world units)
  origin?: boolean // a small sphere where the axes meet
}

export function makeAxis(
  i: 0 | 1 | 2,
  length: number,
  opacity = DEFAULT_AXES_OPACITY,
  look: AxesLook = {}
): THREE.Group {
  const color = new THREE.Color(AXIS_COLORS[i])
  const dir = DIRS[i]
  const group = new THREE.Group()
  group.name = `axis ${AXIS_LETTERS[i]}`
  const radius = look.radius ?? Math.max(0.8, length / 160)
  const head = Math.min(length * 0.14, radius * 9)
  const solid = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
  })
  const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir)

  // the positive half: a shaft with an arrowhead
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length - head, 12),
    solid
  )
  shaft.quaternion.copy(quat)
  shaft.position.copy(dir).multiplyScalar((length - head) / 2)
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 3, head, 16),
    solid
  )
  cone.quaternion.copy(quat)
  cone.position.copy(dir).multiplyScalar(length - head / 2)

  // the negative half: a dashed line
  const negative = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      dir.clone().multiplyScalar(-length),
    ]),
    new THREE.LineDashedMaterial({
      color,
      transparent: true,
      opacity,
      dashSize: length / 30,
      gapSize: length / 45,
    })
  )
  negative.computeLineDistances()

  // tick marks every tenth of the length, on both halves
  const across = i === 1 ? DIRS[0] : DIRS[1]
  const tick = radius * 3
  const points: THREE.Vector3[] = []
  for (let k = -9; k <= 9; k++) {
    if (k === 0) continue
    const at = dir.clone().multiplyScalar((k * length) / 10)
    points.push(
      at.clone().addScaledVector(across, -tick),
      at.clone().addScaledVector(across, tick)
    )
  }
  const ticks = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  )

  // the letter past the tip
  const letter = new THREE.Sprite(
    letterMaterial(AXIS_LETTERS[i], AXIS_COLORS[i], opacity)
  )
  const s = look.letter ?? Math.max(12, length / 10)
  letter.scale.set(s, s, 1)
  letter.position.copy(dir).multiplyScalar(length + s * 0.75)

  group.add(shaft, cone, negative, ticks, letter)
  if (look.origin && i === 0)
    group.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(radius * 2.2, 14, 10),
        new THREE.MeshBasicMaterial({
          color: '#e8e8e8',
          transparent: true,
          opacity,
        })
      )
    )
  return group
}

export function makeAxes(
  length: number,
  opacity = DEFAULT_AXES_OPACITY,
  look: AxesLook = {}
): THREE.Group[] {
  return ([0, 1, 2] as const).map((i) => makeAxis(i, length, opacity, look))
}

export function setAxesOpacity(axes: THREE.Object3D[], opacity: number): void {
  const o = Math.min(1, Math.max(0, opacity))
  for (const axis of axes)
    axis.traverse((obj) => {
      const m = (obj as THREE.Mesh).material as THREE.Material | undefined
      if (m) {
        m.opacity = o
        m.transparent = true
      }
    })
}

export function disposeAxes(axes: THREE.Object3D[]): void {
  for (const axis of axes) {
    axis.traverse((obj) => {
      // sprites share one static geometry; only their material is ours
      if (!(obj instanceof THREE.Sprite))
        (obj as THREE.Mesh).geometry?.dispose()
      const m = (obj as THREE.Mesh).material as THREE.Material | undefined
      if (m) {
        ;(m as THREE.SpriteMaterial).map?.dispose()
        m.dispose()
      }
    })
    axis.parent?.remove(axis)
  }
}
