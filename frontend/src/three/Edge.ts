import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import {
  EDGE_MIN_VISIBLE_OPACITY,
  EDGE_WIDTH_MAX,
  EDGE_WIDTH_MIN,
  FADED_EDGE,
  SELECTED_DEFAULT_COLOR,
} from './constants'
import { ctx, disposeObject3D, edgeResolution } from './runtime'
import { bundledPoints } from './bundling'
import { hivePath } from './hive'

// Parallel channel lanes: this many line widths apart
const PARALLEL_SPACING = 1.6

export type LineType = 'solid' | 'dashed' | 'dotted'
export const LINE_TYPE_LABELS: Record<LineType, string> = {
  solid: 'Solid',
  dashed: 'Dashed',
  dotted: 'Dotted',
}
// dash and gap, in line widths, with a floor for hairlines
const DASHES: Record<Exclude<LineType, 'solid'>, [number, number]> = {
  dashed: [6, 4],
  dotted: [1.5, 3],
}

// A unit vector across the line p1→p2 in the layer's plane (local x is the
// layer normal), or across it some other way when the line runs along x.
function sideways(p1: THREE.Vector3, p2: THREE.Vector3): THREE.Vector3 {
  const d = p2.clone().sub(p1)
  const across = d.clone().cross(new THREE.Vector3(1, 0, 0))
  if (across.lengthSq() < 1e-9 * Math.max(1, d.lengthSq()))
    across.copy(d).cross(new THREE.Vector3(0, 1, 0))
  return across.lengthSq() > 0 ? across.normalize() : across
}

export interface EdgeOptions {
  id?: number
  source?: string
  target?: string
  colors?: string[]
  weights?: number[]
  channels?: string[]
  interLayer?: boolean
}

export class Edge {
  THREE_Object!: THREE.Object3D
  sourceNodeIndex = -1
  targetNodeIndex = -1
  sourceLayerIndex = -1
  targetLayerIndex = -1

  id: number
  source: string
  target: string
  name: string
  colors: string[]
  importedColors: string[]
  weights: number[]
  channels: string[]
  interLayer: boolean

  isSelected = false
  widthFactor = 1 // per-edge width multiplier (Style panel)
  opacityFactor = 1 // per-edge opacity multiplier (Style panel)
  faded = false // an end outside the chosen groups (actions/annotations.ts)
  lineType: LineType = 'solid'
  arrowColor = '' // '' = the edge's colour

  // in single-network mode every edge follows the intra-layer settings
  private get asInter(): boolean {
    return this.interLayer && ctx.networkMode !== 'single'
  }

  // an arrowhead when Show Direction is on and the edge is where arrowheads
  // are drawn: a link between layers by its own switch, any other edge by
  // the layer of its source (Edges → Direction → Arrowheads in)
  private get showsArrow(): boolean {
    if (!ctx.isDirectionEnabled) return false
    if (this.asInter) return ctx.interLayerArrows
    if (ctx.arrowLayers === null) return true
    const layer = ctx.layers[this.sourceLayerIndex]?.name
    return layer !== undefined && ctx.arrowLayers.includes(layer)
  }

  constructor({
    id = 0,
    source = '',
    target = '',
    colors,
    weights = [],
    channels = [],
    interLayer = false,
  }: EdgeOptions) {
    this.id = id
    this.source = source
    this.target = target
    this.name = this.source.concat('---').concat(this.target)
    this.colors = colors ?? [ctx.edgeDefaultColor]
    this.importedColors = [...this.colors] // distinct array: baseline for file-color priority
    this.weights = weights
    this.channels = channels
    this.interLayer = interLayer

    this.initIndexVariables()
    this.drawEdge()
  }

  initIndexVariables(): void {
    this.sourceNodeIndex = ctx.nodeLayerNames.indexOf(this.source)
    this.targetNodeIndex = ctx.nodeLayerNames.indexOf(this.target)
    this.sourceLayerIndex =
      ctx.layerGroups[ctx.nodeGroups[ctx.nodeLayerNames[this.sourceNodeIndex]]]
    this.targetLayerIndex =
      ctx.layerGroups[ctx.nodeGroups[ctx.nodeLayerNames[this.targetNodeIndex]]]
  }

  drawEdge(): void {
    const points = this.decidePoints()

    if (this.channels.length === 0) this.createEdge(points)
    else this.createChannels(points)

    if (this.interLayer) ctx.scene!.add(this.THREE_Object)
    else ctx.layers[this.sourceLayerIndex].addEdge(this.THREE_Object)
  }

  decidePoints(): THREE.Vector3[] {
    const points: THREE.Vector3[] = []
    if (this.interLayer)
      points.push(
        ctx.nodeObjects[this.sourceNodeIndex].getWorldPosition(),
        ctx.nodeObjects[this.targetNodeIndex].getWorldPosition()
      )
    else
      points.push(
        ctx.nodeObjects[this.sourceNodeIndex].getPosition(),
        ctx.nodeObjects[this.targetNodeIndex].getPosition()
      )
    return points
  }

  createEdge(points: THREE.Vector3[]): void {
    const color = this.decideColor()
    const opacity = this.decideOpacity()

    // Too faint to see: an empty Group keeps every add/remove/traverse call
    // site working while costing no geometry, material or draw call. v2 got
    // this from alphaTest, which LineMaterial doesn't implement.
    if (opacity < EDGE_MIN_VISIBLE_OPACITY) {
      this.THREE_Object = new THREE.Group()
      return
    }

    // bundled edges follow their bundle's path (three/bundling.ts), hive
    // links their hive curve (three/hive.ts)
    const path = bundledPoints(this) ?? hivePath(this, points) ?? points
    this.THREE_Object = this.createLine(
      path,
      color,
      opacity,
      this.decideWidth()
    )

    if (this.showsArrow)
      this.createArrow(path.slice(-2), this.decideArrowColor(color))
  }

  // a custom arrow colour, unless the selection highlight shows
  decideArrowColor(edgeColor: string): string {
    return this.arrowColor && !(this.isSelected && ctx.selectedEdgeColorFlag)
      ? this.arrowColor
      : edgeColor
  }

  // Thick lines: WebGL renders every line primitive at exactly 1px, so real
  // widths need Line2, which expands each segment into an instanced quad.
  // Widths are screen-space (LineMaterial's worldUnits shader assumes a
  // perspective view ray and breaks curved lines into dots under this app's
  // orthographic camera) — with the frustum-sized resolution uniform below,
  // linewidth is effectively world units, constant on screen and scaled
  // correctly into the higher-resolution PNG export.
  // ponytail: one material per line, same count as the LineBasicMaterial it
  // replaces. Quantise into a shared cache if material churn ever shows up.
  createLine(
    points: THREE.Vector3[],
    color: string,
    opacity: number,
    width: number
  ): Line2 {
    const geometry = new LineGeometry().setFromPoints(points)
    const material = new LineMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      linewidth: width,
    })
    // Screen-space widths, sized against the shared frustum-tracking
    // resolution (see runtime.edgeResolution) so linewidth stays in world
    // units. Assign the uniform's value directly: the `resolution` setter
    // copies, and we need every edge to share the one mutable Vector2.
    material.uniforms.resolution.value = edgeResolution
    const line = new Line2(geometry, material)
    if (this.lineType !== 'solid') {
      const [dash, gap] = DASHES[this.lineType]
      const w = Math.max(width, 1)
      material.dashed = true
      material.dashSize = dash * w
      material.gapSize = gap * w
      line.computeLineDistances()
    }
    return line
  }

  decideColor(i = 0, forExport = false): string {
    let color = ctx.edgeDefaultColor

    if (!forExport && this.isSelected && ctx.selectedEdgeColorFlag)
      color = SELECTED_DEFAULT_COLOR
    else if (this.channels.length > 0 && !ctx.edgeFileColorPriority)
      // a channel missing from the registry would make THREE.Color throw/white
      color = ctx.channelColors[this.channels[i]] ?? ctx.edgeDefaultColor
    else if (ctx.edgeFileColorPriority) color = this.importedColors[i]

    return color
  }

  decideOpacity(i = 0): number {
    // below the weight filter -> 0, which the faintness skip leaves undrawn
    if (this.weights[i] < ctx.edgeWeightThreshold) return 0
    let opacity: number
    if (ctx.edgeOpacityByWeight) opacity = this.weights[i]
    else
      opacity = this.asInter
        ? ctx.interLayerEdgeOpacity
        : ctx.intraLayerEdgeOpacity
    return opacity * this.opacityFactor * (this.faded ? FADED_EDGE : 1)
  }

  // Mirrors decideOpacity. Weights arrive scaled to [0-1] by the backend, so
  // they map onto the width range rather than being used raw — a raw weight
  // near 0 would be a sub-pixel, invisible line.
  decideWidth(i = 0): number {
    const base = ctx.edgeWidthByWeight
      ? EDGE_WIDTH_MIN + this.weights[i] * (EDGE_WIDTH_MAX - EDGE_WIDTH_MIN)
      : this.asInter
        ? ctx.interLayerEdgeWidth
        : ctx.intraLayerEdgeWidth
    return base * this.widthFactor
  }

  createArrow(points: THREE.Vector3[], arrowColor: string): void {
    const THREE_arrowHelper = this.createArrowHelper(points, arrowColor)
    const THREE_Group = new THREE.Group()
    THREE_Group.add(this.THREE_Object)
    THREE_Group.add(THREE_arrowHelper)
    this.THREE_Object = THREE_Group
  }

  createArrowHelper(
    points: THREE.Vector3[],
    edgeColor: string
  ): THREE.ArrowHelper {
    const direction = points[1].clone().sub(points[0])
    const origin = points[1]
    const length = 1
    let headLength = this.asInter
      ? ctx.interDirectionArrowSize
      : ctx.intraDirectionArrowSize
    headLength = headLength * 6
    const headWidth = headLength / 4

    return new THREE.ArrowHelper(
      direction.normalize(),
      origin,
      length,
      edgeColor,
      headLength,
      headWidth
    )
  }

  // Channels ======
  createChannels(points: THREE.Vector3[]): void {
    let THREE_curveGroup = new THREE.Group()
    let pushForce = 0
    let pushForceFlag = false
    let direction = 1
    const curveFactor = this.asInter
      ? ctx.interChannelCurvature
      : ctx.intraChannelCurvature

    const verticalPushConstant =
      (points[0].distanceTo(points[1]) * curveFactor) / 400
    const path = bundledPoints(this) ?? hivePath(this, points)
    if (this.channels.length % 2 == 0) pushForce = 1 // skip straight line

    for (let i = 0; i < this.channels.length; i++) {
      direction = -1 * direction // flipping direction

      if (pushForceFlag) pushForce = pushForce + 1
      pushForceFlag = !pushForceFlag // flipping flag to increase pushForce next round

      const verticalPush = direction * (verticalPushConstant * pushForce)
      const color = this.decideColor(i)
      const opacity = this.decideOpacity(i)

      // parallel: lanes side by side across the pair, centred on it
      const lane =
        (i - (this.channels.length - 1) / 2) *
        PARALLEL_SPACING *
        Math.max(...this.channels.map((_, k) => this.decideWidth(k)))
      THREE_curveGroup = this.createCurve(
        THREE_curveGroup,
        points[0],
        points[1],
        verticalPush,
        color,
        this.channels[i],
        opacity,
        this.decideWidth(i),
        path,
        lane
      )
    }

    this.THREE_Object = THREE_curveGroup
  }

  createCurve(
    curveGroup: THREE.Group,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    verticalPush: number,
    color: string,
    channelName: string,
    opacity: number,
    width: number,
    bundled: THREE.Vector3[] | null = null,
    lane = 0
  ): THREE.Group {
    const shape = ctx.edgeShape
    let curvePoints: THREE.Vector3[]
    if (shape === 'parallel') {
      // STRING-style: a straight line per channel, shifted sideways
      const shift = sideways(p1, p2).multiplyScalar(lane)
      curvePoints = (bundled ?? [p1, p2]).map((p) => p.clone().add(shift))
    } else if (bundled) {
      // bundled: each channel runs alongside the bundle's path, pushed out
      // most in the middle, as the plain curves are
      const push =
        shape === 'straight'
          ? new THREE.Vector3() // straight: channels follow the bundle itself
          : new THREE.Vector3(
              this.interLayer ? verticalPush : 0,
              verticalPush,
              verticalPush
            )
      curvePoints = bundled.map((p, k) =>
        p
          .clone()
          .addScaledVector(push, Math.sin((Math.PI * k) / (bundled.length - 1)))
      )
    } else if (shape === 'straight') {
      // straight: the channels of a pair share one line (Edit → Edge Shape)
      curvePoints = [p1, p2]
    } else {
      const p3 = p1.clone()
      const p4 = p2.clone()
      p3.addScalar(verticalPush)
      p4.addScalar(verticalPush)
      let curve: THREE.CubicBezierCurve3
      if (!this.interLayer)
        curve = new THREE.CubicBezierCurve3(
          p1,
          this.transformMiddlePointOnLayer(p3),
          this.transformMiddlePointOnLayer(p4),
          p2
        )
      else curve = new THREE.CubicBezierCurve3(p1, p3, p4, p2)
      curvePoints = curve.getPoints(50)
    }
    const points = curvePoints.length - 1
    // Same faintness skip as createEdge — leave the channel out of the group
    // entirely rather than rasterising an invisible one.
    if (opacity < EDGE_MIN_VISIBLE_OPACITY) return curveGroup

    const curveLine = this.createLine(curvePoints, color, opacity, width)
    curveLine.userData.tag = channelName
    curveLine.visible = ctx.channelVisibility[channelName]
    curveGroup.add(curveLine)

    if (this.showsArrow)
      curveGroup = this.createCurvedArrow(
        curveGroup,
        curvePoints,
        points,
        this.decideArrowColor(color),
        channelName
      )

    return curveGroup
  }

  // Helps place arrow lines onto the layer instead of through it.
  transformMiddlePointOnLayer(point: THREE.Vector3): THREE.Vector3 {
    point.x = 0
    return point
  }

  createCurvedArrow(
    curveGroup: THREE.Group,
    curvePoints: THREE.Vector3[],
    points: number,
    color: string,
    channelName: string
  ): THREE.Group {
    // a curve points the arrow along its last stretch; a straight (parallel)
    // line has only its two ends
    const arrowHelper = this.createArrowHelper(
      points >= 4
        ? [curvePoints[points - 4], curvePoints[points - 1]]
        : curvePoints.slice(-2),
      color
    )
    arrowHelper.userData.tag = channelName
    arrowHelper.visible = ctx.channelVisibility[channelName]
    curveGroup.add(arrowHelper)
    return curveGroup
  }

  // On animate ======
  redrawEdge(): void {
    if (this.interLayer) ctx.scene!.remove(this.THREE_Object)
    else ctx.layers[this.sourceLayerIndex].removeEdge(this.THREE_Object)

    // drawEdge() replaces THREE_Object outright, so the old one is
    // unreachable: undo snapshots hold this same Edge instance (which will
    // point at the new object), and no command retains a THREE_Object.
    // Inter-layer edges redraw every frame the scene moves, and Line2's
    // interleaved instance buffers are far bigger than the old Line's.
    disposeObject3D(this.THREE_Object)
    // A hidden inter-layer edge isn't redrawn below, so drop to an empty
    // placeholder rather than leaving THREE_Object on disposed buffers.
    this.THREE_Object = new THREE.Group()

    if (!this.interLayer || (this.interLayer && this.areLayersNotHidden()))
      this.drawEdge()
  }

  areLayersNotHidden(): boolean {
    return (
      ctx.layers[this.sourceLayerIndex].isVisible &&
      ctx.layers[this.targetLayerIndex].isVisible
    )
  }

  select(): void {
    this.isSelected = true
  }

  deselect(): void {
    this.isSelected = false
  }
}
