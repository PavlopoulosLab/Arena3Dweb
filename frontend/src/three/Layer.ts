import * as THREE from 'three'
import { safeColor } from '../utils'
import {
  PLANE_WIDTHSEGMENTS,
  PLANE_HEIGHTSEGMENTS,
  LAYER_DEFAULT_COLOR,
} from './constants'
import { ctx } from './runtime'
import type { Axis, LabelLook } from './Node'
import {
  DEFAULT_AXES_OPACITY,
  disposeAxes,
  makeAxes,
  setAxesOpacity,
} from './axes'
import {
  isVolume,
  type ContainerPlacement,
  type LayerContainer,
} from './containers'
import {
  containerPool,
  fillGeometry,
  glowMaterial,
  outlineGeometry,
  puffLayout,
  puffTexture,
  wireGeometry,
} from './container_geometry'

export { VOLUME_CONTAINERS } from './containers'
export type { ContainerPlacement, LayerContainer } from './containers'

// Edit → Layers → Labels & axes: the layer label's font, and where it sits —
// at the floor's outer corner (as always), centred above the floor or under it
export type LayerLabelFont = 'sans' | 'serif' | 'mono' | 'condensed'
export const LAYER_LABEL_FONTS: Record<LayerLabelFont, string> = {
  sans: 'Sans-serif',
  serif: 'Serif',
  mono: 'Monospace',
  condensed: 'Condensed',
}
export type LayerLabelPosition = 'corner' | 'above' | 'below'
export const LAYER_LABEL_POSITIONS: Record<LayerLabelPosition, string> = {
  corner: 'Outer corner',
  above: 'Above the floor',
  below: 'Under the floor',
}
const ANCHOR = new THREE.Vector3()
const FLOOR_BOX = new THREE.Box3()

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
// or a 3D volume (three/containers.ts) — nodes are then laid out in 3D inside
// it or on its surface.
export const DEFAULT_CONTAINER_OPACITY = 0.3

// How a container is drawn (Edit → Layers → Shape & container): its colour
// (null = the theme's container colour) and opacity, its outline (colour null =
// the container's), a wire cage, a rim light, and the floor kept under it.
export interface ContainerLook {
  color: string | null
  opacity: number
  outline: boolean
  outlineColor: string | null
  wireframe: boolean
  glow: boolean
  floor: boolean
}
export const DEFAULT_CONTAINER_LOOK: ContainerLook = {
  color: null,
  opacity: DEFAULT_CONTAINER_OPACITY,
  outline: true,
  outlineColor: null,
  wireframe: false,
  glow: false,
  floor: false,
}

// each part's opacity at the default container opacity (scaled with it)
const PART_OPACITY = { fill: 0.08, outline: 0.65, wire: 0.3, glow: 0.9 }

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
  // 3D container look (ContainerLook): own colour (null = the theme's) and
  // opacity (0-1; DEFAULT_CONTAINER_OPACITY gives the standard look) …
  containerColor: string | null = null
  containerOpacity = DEFAULT_CONTAINER_OPACITY
  containerOutline = true
  containerOutlineColor: string | null = null
  containerWireframe = false
  containerGlow = false
  containerFloor = false // the floor stays under the container
  container: LayerContainer = 'floor'
  // nodes inside the volume or on its surface (three/containers.ts)
  containerPlacement: ContainerPlacement = 'inside'
  // selection / hover colour over the container's own (null = none)
  private volumeTint: string | null = null
  private volumeKeys: string[] = [] // what the drawing holds in the pool
  // the layer label's look (null: the default halo), font ('' = the app's),
  // bold, italic, colour ('' = the theme's label colour) and place
  labelLook: LabelLook | null = null
  labelFont: LayerLabelFont | '' = ''
  labelBold = false
  labelItalic = false
  labelColor = ''
  labelPosition: LayerLabelPosition = 'corner'
  volume: THREE.Object3D | null = null // the container's drawing
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
    // from a file or session: CSS colour forms only (utils.ts)
    floor_current_color = safeColor(floor_current_color, LAYER_DEFAULT_COLOR)
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

  /** World x, y the label hangs from: the floor's outer corner, or the middle
   * of the floor's top or bottom edge as seen (the camera has no roll, so
   * world x/y are the screen's). */
  labelAnchor(): [number, number] {
    if (this.labelPosition === 'corner') {
      const w = this.sphere.getWorldPosition(ANCHOR)
      return [w.x, w.y]
    }
    const g = this.plane.geometry
    if (!g.boundingBox) g.computeBoundingBox()
    this.plane.updateWorldMatrix(true, false)
    FLOOR_BOX.copy(g.boundingBox!).applyMatrix4(this.plane.matrixWorld)
    return [
      (FLOOR_BOX.min.x + FLOOR_BOX.max.x) / 2,
      this.labelPosition === 'above' ? FLOOR_BOX.max.y : FLOOR_BOX.min.y,
    ]
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

  // the floor shows in 'floor' mode, and under a 3D container when asked;
  // otherwise the (invisible) plane stays for raycasting and as the parent of
  // nodes and edges
  private floorShown(): boolean {
    return (
      this.floorVisible &&
      (this.container === 'floor' ||
        (isVolume(this.container) && this.containerFloor))
    )
  }

  private syncFloorVisibility(): void {
    const shown = this.floorShown()
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
    object.visible = this.floorShown()
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

  // The container's drawing: unit shapes from the shared pool, scaled to the
  // layer. Rebuilt on a change of kind, look, tint or theme; cheap, since
  // geometries and materials are shared between layers. What the old drawing
  // held goes back to the pool only after the new one took its share, so a
  // layer alone with its shape does not dispose and rebuild it.
  rebuildVolume(): void {
    const held = this.volumeKeys
    if (this.volume) this.plane.remove(this.volume)
    this.volume = null
    this.volumeKeys = []
    try {
      this.drawVolume()
    } finally {
      for (const key of held) containerPool.release(key)
    }
  }

  private drawVolume(): void {
    const kind = this.container
    if (!isVolume(kind)) return
    const use = <T extends { dispose(): void }>(key: string, make: () => T) => {
      this.volumeKeys.push(key)
      return containerPool.acquire(key, make)
    }
    const base = this.containerColor ?? ctx.containerDefaultColor
    const fill = this.volumeTint ?? base
    const line = this.volumeTint ?? this.containerOutlineColor ?? base
    // every part's opacity scales with the container opacity, capped at 1
    const k = this.containerOpacity / DEFAULT_CONTAINER_OPACITY
    const op = (part: number) => Math.round(Math.min(1, part * k) * 1000) / 1000
    const basic = (color: string, opacity: number) =>
      use(
        `mat:fill|${color}|${opacity}`,
        () =>
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
          })
      )
    const lineMat = (color: string, opacity: number) =>
      use(
        `mat:line|${color}|${opacity}`,
        () => new THREE.LineBasicMaterial({ color, transparent: true, opacity })
      )
    const group = new THREE.Group()
    if (kind === 'cloud') {
      // fog cloud (as in NORMA): soft tinted puffs filling the volume, no
      // hard boundary; the same cloud on every redraw
      const map = use('tex:puff', puffTexture)
      const puff = (opacity: number) =>
        use(
          `mat:puff|${fill}|${opacity}`,
          () =>
            new THREE.SpriteMaterial({
              map,
              color: fill,
              transparent: true,
              opacity,
              depthWrite: false,
            })
        )
      const add = (m: THREE.SpriteMaterial, at: number[], size: number) => {
        const sprite = new THREE.Sprite(m)
        sprite.position.set(at[0], at[1], at[2])
        sprite.scale.set(size, size, 1)
        group.add(sprite)
      }
      add(puff(op(0.25)), [0, 0, 0], 2.4) // the haze
      const puffMat = puff(op(0.12))
      for (const [x, y, z, size] of puffLayout()) add(puffMat, [x, y, z], size)
    } else {
      const shape = (key: string) =>
        use(`geo:${key}:${kind}`, () =>
          key === 'fill'
            ? fillGeometry(kind)
            : key === 'outline'
              ? outlineGeometry(kind)
              : wireGeometry(kind)
        )
      const bubble = kind === 'bubble'
      group.add(
        new THREE.Mesh(
          shape('fill'),
          basic(fill, op(PART_OPACITY.fill * (bubble ? 0.5 : 1)))
        )
      )
      if (bubble || this.containerGlow) {
        // a rim light: a bubble always has one, other shapes on request
        const intensity = op(PART_OPACITY.glow * (bubble ? 1.2 : 0.8))
        const power = bubble ? 2.2 : 3
        const glow = new THREE.Mesh(
          shape('fill'),
          use(`mat:glow|${line}|${intensity}|${power}`, () =>
            glowMaterial(line, intensity, power)
          )
        )
        // glTF cannot carry the shader: the GLB export leaves it out, like
        // the node outlines (actions/export.ts)
        glow.userData.outline = true
        group.add(glow)
      }
      if (this.containerOutline && !bubble)
        group.add(
          new THREE.LineSegments(
            shape('outline'),
            lineMat(line, op(PART_OPACITY.outline))
          )
        )
      if (this.containerWireframe)
        group.add(
          new THREE.LineSegments(
            shape('wire'),
            lineMat(line, op(PART_OPACITY.wire))
          )
        )
    }
    group.scale.setScalar(this.containerRadius())
    group.userData.layerVolume = kind
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
    this.volume?.scale.setScalar(this.containerRadius())
  }

  getScale(): number {
    return this.last_layer_scale
  }

  setContainerStyle(color: string | null, opacity: number): void {
    this.setContainerLook({ color, opacity })
  }

  containerLook(): ContainerLook {
    return {
      color: this.containerColor,
      opacity: this.containerOpacity,
      outline: this.containerOutline,
      outlineColor: this.containerOutlineColor,
      wireframe: this.containerWireframe,
      glow: this.containerGlow,
      floor: this.containerFloor,
    }
  }

  setContainerLook(look: Partial<ContainerLook>): void {
    const l = { ...this.containerLook(), ...look }
    this.containerColor = l.color
    this.containerOpacity = Math.min(1, Math.max(0, l.opacity))
    this.containerOutline = l.outline
    this.containerOutlineColor = l.outlineColor
    this.containerWireframe = l.wireframe
    this.containerGlow = l.glow
    this.containerFloor = l.floor
    this.syncFloorVisibility()
    this.rebuildVolume()
  }

  // A hovered or selected layer's container takes the highlight colour.
  private setVolumeTint(tint: string | null): void {
    if (tint === this.volumeTint) return
    this.volumeTint = tint
    if (this.volume) this.rebuildVolume()
  }

  // hover (actions/layer.ts): the floor and the container turn red until
  // the next repaint (setColor)
  paintHover(color: string): void {
    ;(this.plane.material as THREE.MeshBasicMaterial).color.set(color)
    this.setVolumeTint(color)
  }

  setColor(value: string): void {
    const color = safeColor(value) // CSS colour forms only (utils.ts)
    this.color = color
    // repaintLayers gives a selected layer the selection colour
    this.setVolumeTint(this.isSelected ? color : null)
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
