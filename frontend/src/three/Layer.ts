import * as THREE from 'three'
import {
  PLANE_WIDTHSEGMENTS,
  PLANE_HEIGHTSEGMENTS,
  LAYER_DEFAULT_COLOR,
} from './constants'
import { ctx } from './runtime'
import type { Axis } from './Node'
import {
  DEFAULT_AXES_OPACITY,
  disposeAxes,
  makeAxes,
  setAxesOpacity,
} from './axes'

export interface LayerOptions {
  id?: number
  name?: string
  position_x?: number
  position_y?: number
  position_z?: number
  last_layer_scale?: number
  rotation_x?: number
  rotation_y?: number
  rotation_z?: number
  floor_current_color?: string
  geometry_parameters_width?: number
  floor_shape?: FloorShape
  floor_style?: FloorStyle
  container?: LayerContainer
}

// Square = the v2 floor; disk = a round floor of the same width (Phase 18)
// a hive plot axis floor is this fraction of the floor width thick
const AXIS_THICKNESS = 0.012

export type FloorShape = 'square' | 'disk' | 'axis'
// How a floor is drawn: the plane itself, its wireframe, or a faint plane
// under a grid, a dotted grid or just the outline
export type FloorStyle = 'solid' | 'wireframe' | 'grid' | 'dots' | 'outline'
export const FLOOR_STYLES: FloorStyle[] = [
  'solid',
  'wireframe',
  'grid',
  'dots',
  'outline',
]
const GRID_DIVISIONS = 10
const DISK_SEGMENTS = 64

// How a layer holds its nodes (Phases 19-20): the v2 floor, nothing at all,
// or a 3D volume — nodes are then laid out in 3D inside it.
export type LayerContainer = 'floor' | 'none' | 'cube' | 'sphere' | 'cloud'
export const VOLUME_CONTAINERS: LayerContainer[] = ['cube', 'sphere', 'cloud']
export const DEFAULT_CONTAINER_OPACITY = 0.3

export class Layer {
  plane!: THREE.Mesh
  sphere!: THREE.Mesh

  id: number
  name: string
  last_layer_scale: number
  geometry_parameters_width: number
  importedColor: string
  color: string

  showNodeLabels = false
  isSelected = false
  isVisible = true
  floorVisible = true
  floorShape: FloorShape = 'square'
  // 3D container look: own colour (null = the floor colour) and opacity
  // (0-1; DEFAULT_CONTAINER_OPACITY gives the standard look)
  containerColor: string | null = null
  containerOpacity = DEFAULT_CONTAINER_OPACITY
  container: LayerContainer = 'floor'
  volume: THREE.Object3D | null = null // cube/sphere/cloud drawing
  coordSystem: THREE.Object3D[] = []
  coordsShown = false // Edit → Layers / Layer selection → Axes
  axesOpacity = DEFAULT_AXES_OPACITY
  floorStyle: FloorStyle = 'solid'
  floorOpacity = 0.6
  floorLines: THREE.Object3D | null = null // grid / dots / outline drawing

  constructor({
    id = 1,
    name = 'Layer1',
    position_x = 0,
    position_y = 0,
    position_z = 0,
    last_layer_scale = 1,
    rotation_x = 0,
    rotation_y = 0,
    rotation_z = 0,
    floor_current_color = LAYER_DEFAULT_COLOR,
    geometry_parameters_width = 2 * ctx.yBoundMax,
    floor_shape = 'square',
    floor_style = 'solid',
    container = 'floor',
  }: LayerOptions) {
    this.id = id
    this.name = name
    this.last_layer_scale = last_layer_scale
    this.geometry_parameters_width = geometry_parameters_width
    this.importedColor = floor_current_color
    this.color = floor_current_color

    this.floorShape = floor_shape
    this.createPlane(geometry_parameters_width, floor_current_color)
    this.appendCoordSystem()
    this.addLabelSphere(geometry_parameters_width, last_layer_scale)
    this.setFloorStyle(floor_style)
    this.initTranslate(position_x, position_y, position_z)
    this.initRotate(rotation_x, rotation_y, rotation_z)
    this.initScale(last_layer_scale)
    this.setContainer(container)
  }

  // inits
  createPlane(width: number, color: string): void {
    const planeGeometry = this.floorGeometry(width)
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: color,
      alphaTest: 0.05,
      wireframe: false,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    })
    this.plane = new THREE.Mesh(planeGeometry, planeMaterial)
  }

  // Floor in the layer's y-z plane (normal = local x), unscaled.
  floorGeometry(width: number): THREE.BufferGeometry {
    const g =
      this.floorShape === 'disk'
        ? new THREE.CircleGeometry(width / 2, DISK_SEGMENTS)
        : this.floorShape === 'axis'
          ? // a hive plot axis: a thin bar along the floor's own y
            new THREE.PlaneGeometry(Math.max(4, width * AXIS_THICKNESS), width)
          : new THREE.PlaneGeometry(
              width,
              width,
              PLANE_WIDTHSEGMENTS,
              PLANE_HEIGHTSEGMENTS
            )
    g.rotateY(THREE.MathUtils.degToRad(90))
    return g
  }

  // Swap the floor geometry in place (children — nodes, edges — untouched),
  // keeping the current layer scale.
  setFloorShape(shape: FloorShape): void {
    if (shape === this.floorShape) return
    this.floorShape = shape
    const g = this.floorGeometry(this.geometry_parameters_width)
    g.scale(1, this.last_layer_scale, this.last_layer_scale)
    this.plane.geometry.dispose()
    this.plane.geometry = g
    this.rebuildFloorLines()
  }

  // the layer's own X/Y/Z arrows at its centre (three/axes.ts), hidden until
  // Edit → Layers → Show Layer Coord Systems
  appendCoordSystem(): void {
    disposeAxes(this.coordSystem)
    // sized by the floor, with thick shafts, big letters and an origin
    // marker, so each layer's frame reads as a coordinate system
    const length = Math.max(150, this.geometry_parameters_width * 0.45)
    this.coordSystem = makeAxes(length, this.axesOpacity, {
      radius: Math.max(2.4, length / 110),
      letter: Math.max(36, length / 7),
      origin: true,
    })
    for (const axis of this.coordSystem) this.plane.add(axis)
    this.toggleCoords(this.coordsShown)
  }

  addLabelSphere(width: number, scale: number): void {
    // label will be attached here
    const threeSphere = this.createSphere()
    this.plane.add(threeSphere)
    threeSphere.translateY(-width / 2)
    threeSphere.translateZ(width / 2)
    threeSphere.position.y = threeSphere.position.y * scale
    threeSphere.position.z = threeSphere.position.z * scale
    this.sphere = threeSphere
  }

  createSphere(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry()
    const material = new THREE.MeshBasicMaterial({
      color: 'white',
      transparent: true,
      opacity: 0,
    })
    return new THREE.Mesh(geometry, material)
  }

  initTranslate(x: number, y: number, z: number): void {
    this.setPosition('x', x)
    this.setPosition('y', y)
    this.setPosition('z', z)
  }

  initRotate(x: number, y: number, z: number): void {
    this.setRotation('x', x)
    this.setRotation('y', y)
    this.setRotation('z', z)
  }

  initScale(value: number): void {
    this.plane.geometry.scale(1, Number(value), Number(value))
  }

  addNode(sphere: THREE.Object3D): void {
    this.plane.add(sphere)
  }

  addEdge(line: THREE.Object3D): void {
    this.plane.add(line)
  }

  removeEdge(line: THREE.Object3D): void {
    this.plane.remove(line)
  }

  // toggle functions
  toggleSelection(): void {
    this.isSelected = !this.isSelected
  }

  toggleVisibility(flag: boolean): void {
    this.plane.visible = flag
    this.isVisible = flag
  }

  // Hides only the floor mesh's own material — nodes/edges are children of the
  // plane, so plane.visible would hide them too.
  toggleFloor(flag: boolean): void {
    this.floorVisible = flag
    this.syncFloorVisibility()
  }

  // the floor only shows in 'floor' mode; other containers keep the (invisible)
  // plane for raycasting and as the parent of nodes and edges
  private syncFloorVisibility(): void {
    const shown = this.floorVisible && this.container === 'floor'
    ;(this.plane.material as THREE.MeshBasicMaterial).visible = shown
    if (this.floorLines) this.floorLines.visible = shown
  }

  // Floor style: solid and wireframe are the plane material itself; grid,
  // dots and outline fade the plane and draw lines or points over it.
  setFloorStyle(style: FloorStyle): void {
    this.floorStyle = style
    ;(this.plane.material as THREE.MeshBasicMaterial).wireframe =
      style === 'wireframe'
    this.rebuildFloorLines()
    this.syncFloorOpacity()
  }

  private syncFloorOpacity(): void {
    const factor =
      this.floorStyle === 'outline'
        ? 0.12
        : this.floorStyle === 'grid' || this.floorStyle === 'dots'
          ? 0.4
          : 1
    ;(this.plane.material as THREE.MeshBasicMaterial).opacity =
      this.floorOpacity * factor
    const lines = Math.min(1, 0.45 + this.floorOpacity)
    this.floorLines?.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined
      if (m) m.opacity = lines
    })
  }

  private rebuildFloorLines(): void {
    if (this.floorLines) {
      this.plane.remove(this.floorLines)
      this.floorLines.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        ;(m.material as THREE.Material | undefined)?.dispose()
      })
      this.floorLines = null
    }
    if (!['grid', 'dots', 'outline'].includes(this.floorStyle)) return
    // the floor spans local y and z; the drawing sits a hair above it
    const w = this.geometry_parameters_width
    const h = w / 2
    const P = (y: number, z: number) => new THREE.Vector3(0.6, y, z)
    const disk = this.floorShape === 'disk'
    const color = new THREE.Color(this.color)
    const points: THREE.Vector3[] = []
    const seg = (a: THREE.Vector3, b: THREE.Vector3) => points.push(a, b)
    const ring = (r: number, n = 64) => {
      const c = Array.from({ length: n }, (_, k) => {
        const t = (k / n) * Math.PI * 2
        return P(r * Math.cos(t), r * Math.sin(t))
      })
      c.forEach((p, k) => seg(p, c[(k + 1) % n]))
    }
    let object: THREE.Object3D
    if (this.floorStyle === 'dots') {
      if (disk) {
        points.push(P(0, 0))
        for (let k = 1; k <= 4; k++) {
          const r = (h * k) / 4
          const n = 8 * k
          for (let j = 0; j < n; j++) {
            const t = (j / n) * Math.PI * 2
            points.push(P(r * Math.cos(t), r * Math.sin(t)))
          }
        }
      } else
        for (let i = 0; i <= GRID_DIVISIONS; i++)
          for (let j = 0; j <= GRID_DIVISIONS; j++)
            points.push(
              P(-h + (i * w) / GRID_DIVISIONS, -h + (j * w) / GRID_DIVISIONS)
            )
      object = new THREE.Points(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.PointsMaterial({
          color,
          size: 4,
          sizeAttenuation: false,
          transparent: true,
        })
      )
    } else {
      if (this.floorStyle === 'outline') {
        if (disk) ring(h)
        else {
          const c = [P(-h, -h), P(h, -h), P(h, h), P(-h, h)]
          c.forEach((p, k) => seg(p, c[(k + 1) % 4]))
        }
      } else if (disk) {
        for (let k = 1; k <= 4; k++) ring((h * k) / 4)
        for (let k = 0; k < 12; k++) {
          const t = (k / 12) * Math.PI
          seg(
            P(h * Math.cos(t), h * Math.sin(t)),
            P(-h * Math.cos(t), -h * Math.sin(t))
          )
        }
      } else
        for (let k = 0; k <= GRID_DIVISIONS; k++) {
          const v = -h + (k * w) / GRID_DIVISIONS
          seg(P(v, -h), P(v, h))
          seg(P(-h, v), P(h, v))
        }
      object = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color, transparent: true })
      )
    }
    object.visible = this.floorVisible && this.container === 'floor'
    object.renderOrder = 1
    this.floorLines = object
    this.plane.add(object)
  }

  setContainer(kind: LayerContainer): void {
    this.container = kind
    this.syncFloorVisibility()
    this.rebuildVolume()
  }

  // Half-extent of the container in layer-local units (scale included).
  containerRadius(): number {
    return (this.geometry_parameters_width / 2) * this.last_layer_scale
  }

  rebuildVolume(): void {
    if (this.volume) {
      this.plane.remove(this.volume)
      this.volume.traverse((o) => {
        if (o instanceof THREE.Sprite) {
          // sprites share one static geometry; only the material and its
          // canvas texture are ours
          o.material.map?.dispose()
          o.material.dispose()
          return
        }
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        ;(m.material as THREE.Material | undefined)?.dispose()
      })
      this.volume = null
    }
    if (!VOLUME_CONTAINERS.includes(this.container)) return
    const r = this.containerRadius()
    const color = new THREE.Color(
      this.containerColor ?? ctx.containerDefaultColor
    )
    // every part's opacity scales with the container opacity, capped at 1
    const k = this.containerOpacity / DEFAULT_CONTAINER_OPACITY
    const op = (base: number) => Math.min(1, base * k)
    const group = new THREE.Group()
    if (this.container === 'cube') {
      const box = new THREE.BoxGeometry(2 * r, 2 * r, 2 * r)
      group.add(
        new THREE.Mesh(
          box,
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: op(0.08),
            depthWrite: false,
          })
        ),
        new THREE.LineSegments(
          new THREE.EdgesGeometry(box),
          new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: op(0.7),
          })
        )
      )
    } else if (this.container === 'sphere') {
      group.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(r, 48, 32),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: op(0.07),
            depthWrite: false,
          })
        )
      )
      // three great circles read as a sphere without a dense wireframe
      for (const axis of [0, 1, 2]) {
        const ring = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(
            Array.from({ length: 96 }, (_, i) => {
              const a = (2 * Math.PI * i) / 96
              const [u, v] = [r * Math.cos(a), r * Math.sin(a)]
              return axis === 0
                ? new THREE.Vector3(0, u, v)
                : axis === 1
                  ? new THREE.Vector3(u, 0, v)
                  : new THREE.Vector3(u, v, 0)
            })
          ),
          new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: op(0.6),
          })
        )
        group.add(ring)
      }
    } else {
      // fog cloud (as in NORMA): soft tinted puffs filling the volume, no hard
      // boundary; a fixed seed keeps the same cloud on every redraw
      const size = 128
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const g = canvas.getContext('2d')
      if (g) {
        const grad = g.createRadialGradient(
          size / 2,
          size / 2,
          0,
          size / 2,
          size / 2,
          size / 2
        )
        grad.addColorStop(0, 'rgba(255,255,255,1)')
        grad.addColorStop(0.4, 'rgba(255,255,255,0.4)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, size, size)
      }
      const map = new THREE.CanvasTexture(canvas)
      let seed = 7
      const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
      const puff = (at: THREE.Vector3, scale: number, opacity: number) => {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map,
            color,
            transparent: true,
            opacity,
            depthWrite: false,
          })
        )
        sprite.position.copy(at)
        sprite.scale.set(scale, scale, 1)
        group.add(sprite)
      }
      puff(new THREE.Vector3(), 2.4 * r, op(0.25)) // the haze
      for (let k = 0; k < 36; k++) {
        // denser towards the centre, so the edge fades out
        const dir = new THREE.Vector3(
          rand() * 2 - 1,
          rand() * 2 - 1,
          rand() * 2 - 1
        ).normalize()
        puff(
          dir.multiplyScalar(r * Math.sqrt(rand()) * 0.85),
          r * (0.5 + 0.5 * rand()),
          op(0.12)
        )
      }
    }
    group.userData.layerVolume = this.container
    this.volume = group
    this.plane.add(group)
  }

  toggleCoords(layerCoordsSwitch: boolean): void {
    this.coordsShown = layerCoordsSwitch
    for (const axis of this.coordSystem) axis.visible = layerCoordsSwitch
  }

  setAxesOpacity(opacity: number): void {
    this.axesOpacity = opacity
    setAxesOpacity(this.coordSystem, opacity)
  }

  toggleWireframe(flag: boolean): void {
    ;(this.plane.material as THREE.MeshBasicMaterial).wireframe = flag
  }

  // transformations
  translateX(x: number): void {
    this.plane.translateX(x)
  }
  translateY(y: number): void {
    this.plane.translateY(y)
  }
  translateZ(z: number): void {
    this.plane.translateZ(z)
  }

  rotateX(x: number): void {
    this.plane.rotateX(x)
  }
  rotateY(y: number): void {
    this.plane.rotateY(y)
  }
  rotateZ(z: number): void {
    this.plane.rotateZ(z)
  }

  // setters and getters
  getName(): string {
    return this.name
  }

  setPosition(axis: Axis, value: number): void {
    this.plane.position[axis] = value
  }

  getPosition(axis: Axis): number {
    return this.plane.position[axis]
  }

  setRotation(axis: Axis, value: number): void {
    this.plane.rotation[axis] = value
  }

  getRotation(axis: Axis): number {
    return this.plane.rotation[axis]
  }

  // unscaled floor width (a disk's diameter)
  getWidth(): number {
    return this.geometry_parameters_width
  }

  setScale(value: number | string): void {
    const newScaleValue = parseFloat(String(value)) / this.getScale()
    this.plane.geometry.scale(1, newScaleValue, newScaleValue)
    this.last_layer_scale = parseFloat(String(value))
    if (this.volume) this.rebuildVolume()
  }

  getScale(): number {
    return this.last_layer_scale
  }

  setContainerStyle(color: string | null, opacity: number): void {
    this.containerColor = color
    this.containerOpacity = Math.min(1, Math.max(0, opacity))
    this.rebuildVolume()
  }

  setColor(color: string): void {
    const changed = color !== this.color
    this.color = color
    if (changed && this.volume) this.rebuildVolume()
    ;(this.plane.material as THREE.MeshBasicMaterial).color = new THREE.Color(
      color
    )
    this.floorLines?.traverse((o) => {
      const m = (o as THREE.Mesh).material as
        THREE.LineBasicMaterial | THREE.PointsMaterial | undefined
      if (m?.color) m.color.set(color)
    })
  }

  getColor(): string {
    let color = LAYER_DEFAULT_COLOR
    if (this.isSelected) {
      if (ctx.layerColorPrioritySource === 'default') color = this.importedColor
      else if (ctx.layerColorPrioritySource === 'picker')
        // ponytail: DOM picker read; the input only exists in the browser UI
        // (Phase 13). Guarded so headless/tests fall back to the stored color.
        color =
          (typeof document !== 'undefined' &&
            (document.getElementById('floor_color') as HTMLInputElement | null)
              ?.value) ||
          this.color
    } else color = this.color
    return color
  }

  setOpacity(value: number): void {
    this.floorOpacity = value
    this.syncFloorOpacity()
  }
}
