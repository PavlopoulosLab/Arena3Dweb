import * as THREE from 'three'
import {
  SPHERE_RADIUS,
  NODE_DETAIL,
  BOX_SIZE,
  DIAMOND_RADIUS,
  CONE_RADIUS,
  CONE_HEIGHT,
  BLOOM_LAYER,
} from './constants'
import { ctx } from './runtime'

export type Axis = 'x' | 'y' | 'z'
export type NodeGeometryType =
  | 'sphere'
  | 'box'
  | 'diamond'
  | 'cone'
  | 'cylinder'
  | 'tetrahedron'
  | 'capsule'
  | 'torus'
  | 'icosahedron'
  | 'dodecahedron'
  | 'pyramid'
  | 'disc'
  | 'hexagon'
  | 'ring'

// every shape with its label, in menu order
export const NODE_SHAPE_LABELS: Record<NodeGeometryType, string> = {
  sphere: 'Sphere',
  box: 'Cube',
  diamond: 'Diamond',
  cone: 'Cone',
  cylinder: 'Cylinder',
  tetrahedron: 'Tetrahedron',
  capsule: 'Capsule',
  torus: 'Torus',
  icosahedron: 'Icosahedron',
  dodecahedron: 'Dodecahedron',
  pyramid: 'Pyramid',
  disc: 'Disc',
  hexagon: 'Hexagonal prism',
  ring: 'Ring',
}
export const NODE_SHAPES = Object.keys(NODE_SHAPE_LABELS) as NodeGeometryType[]

export interface NodeOptions {
  id?: number
  name?: string
  layer?: string
  nodeLayerName?: string
  position_x?: number
  position_y?: number
  position_z?: number
  scale?: number
  color?: string
  url?: string
  descr?: string
}

export class Node {
  sphere!: THREE.Mesh

  id: number
  name: string
  layer: string
  nodeLayerName: string
  color: string
  importedColor: string
  clusterColor: string
  url: string
  descr: string

  isSelected = false
  showLabel = false
  cluster = ''
  annotations: string[] = [] // attribute-file / enrichment terms (pies, hulls)
  shape: NodeGeometryType = 'sphere'

  // Edit → Style, per node: opacity, an outline (none at width 0), a
  // stretch along the layer's z / y / x (width, height, depth) on top of the
  // size, and label overrides ('' / 0 = the name / the label style)
  alpha = 1
  borderColor = '#ffffff'
  borderWidth = 0
  outline: THREE.Mesh | null = null
  stretch: [number, number, number] = [1, 1, 1]
  label = ''
  labelColor = ''
  labelSize = 0
  private size = 1

  constructor({
    id = 0,
    name = '',
    layer = '',
    nodeLayerName = '',
    position_x = 0,
    position_y = 0,
    position_z = 0,
    scale = 1,
    color = '#FFFFFF',
    url = '',
    descr = '',
  }: NodeOptions) {
    this.id = id
    this.name = name
    this.layer = layer
    this.nodeLayerName = nodeLayerName
    this.color = color
    this.importedColor = color
    this.clusterColor = color
    this.url = url
    this.descr = descr

    this.createSphere(color)
    this.initTranslate(position_x, position_y, position_z)
    this.setScale(scale)
  }

  createSphere(nodeColor: string): void {
    const geometry = new THREE.SphereGeometry(
      SPHERE_RADIUS,
      NODE_DETAIL.width,
      NODE_DETAIL.height
    )
    const material = new THREE.MeshStandardMaterial({
      color: nodeColor,
      transparent: true,
    })
    this.sphere = new THREE.Mesh(geometry, material)
    // Nodes are the only thing that glows. enable(), not set(): the sphere
    // stays on layer 0 so the default-masked raycaster still picks it.
    this.sphere.layers.enable(BLOOM_LAYER)
  }

  initTranslate(x: number, y: number, z: number): void {
    this.setPosition('x', x)
    this.setPosition('y', y)
    this.setPosition('z', z)
  }

  // transformations
  translateX(x: number): void {
    this.sphere.translateX(x)
  }
  translateY(y: number): void {
    this.sphere.translateY(y)
  }
  translateZ(z: number): void {
    this.sphere.translateZ(z)
  }

  // setters and getters
  getName(): string {
    return this.name
  }

  getLayer(): string {
    return this.layer
  }

  getNodeLayerName(): string {
    return this.nodeLayerName
  }

  getPosition(): THREE.Vector3
  getPosition(axis: Axis): number
  getPosition(axis?: Axis): THREE.Vector3 | number {
    return axis === undefined
      ? this.sphere.position
      : this.sphere.position[axis]
  }

  getWorldPosition(): THREE.Vector3
  getWorldPosition(axis: Axis): number
  getWorldPosition(axis?: Axis): THREE.Vector3 | number {
    const world = this.sphere.getWorldPosition(new THREE.Vector3())
    return axis === undefined ? world : world[axis]
  }

  getOpacity(): number {
    return (this.sphere.material as THREE.MeshStandardMaterial).opacity
  }

  getLabel(): string {
    return this.label || this.name
  }

  getColor(): string {
    let color = this.color
    if (ctx.nodeColorPrioritySource === 'default') color = this.importedColor
    else if (ctx.nodeColorPrioritySource === 'cluster')
      color = this.clusterColor
    return color
  }

  getScale(): number {
    return this.size
  }

  getCluster(): string {
    return this.cluster
  }

  setPosition(axis: Axis, value: number): void {
    this.sphere.position[axis] = value
  }

  // hover / lasso feedback: a fraction of the node's own opacity
  setOpacity(value: number): void {
    ;(this.sphere.material as THREE.MeshStandardMaterial).opacity =
      value * this.alpha
    if (this.outline)
      (this.outline.material as THREE.MeshBasicMaterial).opacity =
        value * this.alpha
  }

  setAlpha(value: number): void {
    this.alpha = value
    this.setOpacity(1)
  }

  // An inverted hull: the node's geometry drawn back faces only, a little
  // larger, so only its rim shows around the node. Not pickable.
  setBorder(color: string, width: number): void {
    this.borderColor = color
    this.borderWidth = width
    if (width <= 0) {
      if (this.outline) {
        this.sphere.remove(this.outline)
        ;(this.outline.material as THREE.Material).dispose()
        this.outline = null
      }
      return
    }
    if (!this.outline) {
      this.outline = new THREE.Mesh(
        this.sphere.geometry,
        new THREE.MeshBasicMaterial({
          side: THREE.BackSide,
          transparent: true,
          opacity: this.alpha,
        })
      )
      this.outline.raycast = () => {}
      this.outline.userData.outline = true
      this.sphere.add(this.outline)
    }
    ;(this.outline.material as THREE.MeshBasicMaterial).color.set(color)
    this.outline.scale.setScalar(1 + width / SPHERE_RADIUS)
  }

  setStretch(stretch: [number, number, number]): void {
    this.stretch = [...stretch]
    this.setScale(this.size)
  }

  setGeometry(type: NodeGeometryType): void {
    let geometry: THREE.BufferGeometry
    switch (type) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(
          SPHERE_RADIUS,
          NODE_DETAIL.width,
          NODE_DETAIL.height
        )
        break
      case 'box':
        geometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE)
        break
      case 'diamond':
        geometry = new THREE.OctahedronGeometry(DIAMOND_RADIUS, 0)
        break
      case 'cone':
        geometry = new THREE.ConeGeometry(CONE_RADIUS, CONE_HEIGHT, CONE_RADIUS)
        break
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          CONE_RADIUS,
          CONE_RADIUS,
          CONE_HEIGHT,
          16
        )
        break
      case 'tetrahedron':
        geometry = new THREE.TetrahedronGeometry(DIAMOND_RADIUS, 0)
        break
      case 'capsule':
        geometry = new THREE.CapsuleGeometry(
          CONE_RADIUS * 0.75,
          CONE_HEIGHT * 0.8,
          4,
          12
        )
        break
      case 'torus':
        geometry = new THREE.TorusGeometry(
          SPHERE_RADIUS * 0.8,
          SPHERE_RADIUS * 0.35,
          10,
          24
        )
        break
      case 'icosahedron':
        geometry = new THREE.IcosahedronGeometry(DIAMOND_RADIUS, 0)
        break
      case 'dodecahedron':
        geometry = new THREE.DodecahedronGeometry(DIAMOND_RADIUS, 0)
        break
      case 'pyramid':
        geometry = new THREE.ConeGeometry(CONE_RADIUS * 1.2, CONE_HEIGHT, 4)
        break
      case 'disc':
        geometry = new THREE.CylinderGeometry(
          SPHERE_RADIUS * 1.1,
          SPHERE_RADIUS * 1.1,
          2,
          24
        )
        break
      case 'hexagon':
        geometry = new THREE.CylinderGeometry(
          SPHERE_RADIUS,
          SPHERE_RADIUS,
          CONE_HEIGHT * 0.6,
          6
        )
        break
      case 'ring':
        geometry = new THREE.TorusGeometry(
          SPHERE_RADIUS * 0.9,
          SPHERE_RADIUS * 0.18,
          8,
          28
        )
        break
      default:
        console.error(`Unknown geometry type: ${type as string}`)
        return
    }
    this.sphere.geometry.dispose()
    this.sphere.geometry = geometry
    if (this.outline) this.outline.geometry = geometry
    this.shape = type
  }

  setColor(hexColor: string, importMode = false, clusterMode = false): void {
    ;(this.sphere.material as THREE.MeshStandardMaterial).color =
      new THREE.Color(hexColor)
    this.color = hexColor
    if (importMode) this.importedColor = hexColor
    if (clusterMode) this.clusterColor = hexColor
  }

  setScale(value: number): void {
    this.size = value
    const [w, h, d] = this.stretch
    this.sphere.scale.set(value * d, value * h, value * w)
  }

  setCluster(clusterName: string): void {
    this.cluster = clusterName
  }
}
