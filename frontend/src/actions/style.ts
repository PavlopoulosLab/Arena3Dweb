// Rich editing — PLAN-ROADMAP Phase 24. Style a target set of nodes or edges
// (colour, size, shape, width, after Cytoscape's Style panel also opacity,
// border, stretch, label text/colour/size, description, line type and arrow
// colour) or colour them by a palette; every change is one undoable command
// and persists in sessions.

import * as THREE from 'three'
import { ctx } from '../three'
import type { NodeGeometryType } from '../three/Node'
import type { LineType } from '../three/Edge'
import type { Command } from '../commands/base'
import { history } from '../commands/base'
import { setLegend, type Legend, type LegendEntry } from './legend'
import { bus } from '../bus'
import {
  categoricalColors,
  sequentialColor,
  surfaceOf,
  type CategoricalPalette,
  type SequentialPalette,
} from './palettes'
import { redrawIntraLayerEdges } from './edge'
import { restyleNodeLabels } from './labels'

// ---------------------------------------------------------------- targets
export type NodeTarget = 'selected' | 'all' | `layer:${string}`
export type EdgeTarget = 'selected' | 'all' | 'intra' | 'inter'

export function nodeTargets(target: NodeTarget): number[] {
  return ctx.nodeObjects.flatMap((n, i) =>
    target === 'all' ||
    (target === 'selected' && n.isSelected) ||
    (target.startsWith('layer:') && n.layer === target.slice(6))
      ? [i]
      : []
  )
}

export function edgeTargets(target: EdgeTarget): number[] {
  return ctx.edgeObjects.flatMap((e, i) =>
    target === 'all' ||
    (target === 'selected' && e.isSelected) ||
    (target === 'intra' && !e.interLayer) ||
    (target === 'inter' && e.interLayer)
      ? [i]
      : []
  )
}

// ---------------------------------------------------------------- nodes
export type NodeStyle = {
  color: string
  imported: string
  scale: number
  shape: NodeGeometryType
  alpha: number
  border: { color: string; width: number }
  stretch: [number, number, number]
  label: string
  labelColor: string
  labelSize: number
  descr: string
}

export const nodeStyle = (i: number): NodeStyle => {
  const n = ctx.nodeObjects[i]
  return {
    color: n.color,
    imported: n.importedColor,
    scale: n.getScale(),
    shape: n.shape,
    alpha: n.alpha,
    border: { color: n.borderColor, width: n.borderWidth },
    stretch: [...n.stretch],
    label: n.label,
    labelColor: n.labelColor,
    labelSize: n.labelSize,
    descr: n.descr,
  }
}

export class NodeStyleCommand implements Command {
  private readonly before: NodeStyle[]
  private readonly beforePriority = ctx.nodeColorPrioritySource
  constructor(
    public description: string,
    private readonly indices: number[],
    private readonly after: (i: number, k: number) => Partial<NodeStyle>
  ) {
    this.before = indices.map(nodeStyle)
  }

  private apply(
    styles: (k: number) => Partial<NodeStyle>,
    priority = ctx.nodeColorPrioritySource
  ): void {
    this.indices.forEach((i, k) => {
      const n = ctx.nodeObjects[i]
      const s = styles(k)
      if (s.color !== undefined) {
        // imported colour too, so the default colour priority shows it
        n.setColor(s.color, true)
        if (s.imported !== undefined) n.importedColor = s.imported
        bus.emit('node:color-changed', {
          nodeId: n.nodeLayerName,
          color: s.color,
        })
      }
      if (s.scale !== undefined) n.setScale(s.scale)
      if (s.shape !== undefined && s.shape !== n.shape) n.setGeometry(s.shape)
      if (s.alpha !== undefined) n.setAlpha(s.alpha)
      if (s.border !== undefined) n.setBorder(s.border.color, s.border.width)
      if (s.stretch !== undefined) n.setStretch(s.stretch)
      if (s.label !== undefined) n.label = s.label
      if (s.labelColor !== undefined) n.labelColor = s.labelColor
      if (s.labelSize !== undefined) n.labelSize = s.labelSize
      if (s.descr !== undefined) n.descr = s.descr
    })
    ctx.nodeColorPrioritySource = priority
    restyleNodeLabels()
    ctx.renderNodeLabelsFlag = true
  }

  execute(): void {
    const changesColor = this.indices.some(
      (_, k) => this.after(this.indices[k], k).color
    )
    this.apply(
      (k) => this.after(this.indices[k], k),
      changesColor ? 'default' : ctx.nodeColorPrioritySource
    )
  }
  undo(): void {
    this.apply((k) => this.before[k], this.beforePriority)
  }
}

export type NodePatch = Partial<Omit<NodeStyle, 'imported'>>

export function styleNodes(target: NodeTarget, patch: NodePatch): number {
  return styleNodeIndices(nodeTargets(target), patch)
}

// The same for given nodes (Edit → Attributes: a row, the ticked rows or the
// inspector's node). One undo step. @return nodes changed
export function styleNodeIndices(
  ids: number[],
  patch: NodePatch,
  description = 'Style nodes'
): number {
  if (ids.length)
    history.execute(new NodeStyleCommand(description, ids, () => patch))
  return ids.length
}

// ---------------------------------------------------------------- edges
export type EdgePatch = {
  color?: string
  widthFactor?: number
  opacityFactor?: number
  lineType?: LineType
  arrowColor?: string // '' = the edge's colour
}
type EdgeStyle = {
  colors: string[]
  imported: string[]
  widthFactor: number
  opacityFactor: number
  lineType: LineType
  arrowColor: string
}

export class EdgeStyleCommand implements Command {
  private readonly before: EdgeStyle[]
  private readonly beforePriority = ctx.edgeFileColorPriority
  constructor(
    public description: string,
    private readonly indices: number[],
    private readonly patch: EdgePatch
  ) {
    this.before = indices.map((i) => {
      const e = ctx.edgeObjects[i]
      return {
        colors: e.colors.slice(),
        imported: e.importedColors.slice(),
        widthFactor: e.widthFactor,
        opacityFactor: e.opacityFactor,
        lineType: e.lineType,
        arrowColor: e.arrowColor,
      }
    })
  }

  private redraw(): void {
    redrawIntraLayerEdges()
    ctx.renderInterLayerEdgesFlag = true
  }

  execute(): void {
    for (const i of this.indices) {
      const e = ctx.edgeObjects[i]
      if (this.patch.color) {
        // per channel too; a single-colour edge has one slot
        const n = Math.max(1, e.channels.length)
        e.colors = Array<string>(n).fill(this.patch.color)
        e.importedColors = e.colors.slice()
      }
      if (this.patch.widthFactor !== undefined)
        e.widthFactor = this.patch.widthFactor
      if (this.patch.opacityFactor !== undefined)
        e.opacityFactor = this.patch.opacityFactor
      if (this.patch.lineType !== undefined) e.lineType = this.patch.lineType
      if (this.patch.arrowColor !== undefined)
        e.arrowColor = this.patch.arrowColor
    }
    if (this.patch.color) ctx.edgeFileColorPriority = true
    this.redraw()
  }
  undo(): void {
    this.indices.forEach((i, k) => {
      const e = ctx.edgeObjects[i]
      e.colors = this.before[k].colors.slice()
      e.importedColors = this.before[k].imported.slice()
      e.widthFactor = this.before[k].widthFactor
      e.opacityFactor = this.before[k].opacityFactor
      e.lineType = this.before[k].lineType
      e.arrowColor = this.before[k].arrowColor
    })
    ctx.edgeFileColorPriority = this.beforePriority
    this.redraw()
  }
}

export function styleEdges(target: EdgeTarget, patch: EdgePatch): number {
  return styleEdgeIndices(edgeTargets(target), patch)
}

// The same for given edges. One undo step. @return edges changed
export function styleEdgeIndices(
  ids: number[],
  patch: EdgePatch,
  description = 'Style edges'
): number {
  if (ids.length) history.execute(new EdgeStyleCommand(description, ids, patch))
  return ids.length
}

// ---------------------------------------------------------------- palettes
export type ColorBy = 'layer' | 'cluster' | 'annotation' | 'degree'

// The legend for a colouring: one entry per group among the coloured nodes
// (clicking selects it), or the degree gradient.
function legendFor(
  by: ColorBy,
  ids: number[],
  colorOf: (i: number) => string,
  ramp: SequentialPalette
): Legend {
  if (by === 'degree') {
    const degree = new Map<number, number>()
    for (const e of ctx.edgeObjects) {
      degree.set(e.sourceNodeIndex, (degree.get(e.sourceNodeIndex) ?? 0) + 1)
      degree.set(e.targetNodeIndex, (degree.get(e.targetNodeIndex) ?? 0) + 1)
    }
    const vals = ids.map((i) => degree.get(i) ?? 0)
    const sf = surface()
    return {
      title: 'Degree',
      gradient: {
        min: Math.min(...vals),
        max: Math.max(...vals),
        stops: [0, 0.25, 0.5, 0.75, 1].map((t) => sequentialColor(t, sf, ramp)),
      },
    }
  }
  const key = (i: number) => {
    const n = ctx.nodeObjects[i]
    if (by === 'layer') return n.layer
    if (by === 'cluster') return n.cluster ? `Cluster ${n.cluster}` : '(none)'
    return n.annotations[0] ?? '(none)'
  }
  const entries = new Map<string, LegendEntry>()
  for (const i of ids) {
    const k = key(i)
    const e = entries.get(k)
    if (e) e.count = (e.count ?? 0) + 1
    else
      entries.set(k, {
        label: k,
        color: colorOf(i),
        count: 1,
        select: k === '(none)' ? undefined : by,
      })
  }
  return {
    title: { layer: 'Layers', cluster: 'Clusters', annotation: 'Annotations' }[
      by
    ],
    entries: [...entries.values()],
  }
}

const surface = () =>
  surfaceOf(
    `#${ctx.renderer?.getClearColor(new THREE.Color()).getHexString() ?? '000000'}`
  )

// Colour the target nodes by a property. @return groups coloured (or 0)
export function colorNodesBy(
  target: NodeTarget,
  by: ColorBy,
  palette: CategoricalPalette = 'distinct',
  ramp: SequentialPalette = 'blue',
  record = true
): number {
  const ids = nodeTargets(target)
  if (ids.length === 0) return 0
  let colorOf: (i: number) => string
  let groups: number
  if (by === 'degree') {
    const degree = new Array<number>(ctx.nodeObjects.length).fill(0)
    for (const e of ctx.edgeObjects) {
      degree[e.sourceNodeIndex]++
      degree[e.targetNodeIndex]++
    }
    const vals = ids.map((i) => degree[i])
    const lo = Math.min(...vals)
    const span = Math.max(...vals) - lo
    const sf = surface()
    colorOf = (i) =>
      sequentialColor(span ? (degree[i] - lo) / span : 0.5, sf, ramp)
    groups = new Set(vals).size
  } else {
    const key = (i: number) => {
      const n = ctx.nodeObjects[i]
      if (by === 'layer') return n.layer
      if (by === 'cluster') return n.cluster || '(none)'
      return n.annotations[0] ?? '(none)'
    }
    // order of first appearance across the whole network, so colours follow
    // the entity, not the current filter
    const all = ctx.nodeObjects.map((_, i) => key(i))
    const order = by === 'layer' ? ctx.layers.map((l) => l.name) : all
    const colors = categoricalColors(order, surface(), palette)
    colorOf = (i) => colors.get(key(i))!
    groups = new Set(ids.map(key)).size
  }
  const cmd = new NodeStyleCommand(`Color nodes by ${by}`, ids, (i) => ({
    color: colorOf(i),
  }))
  if (record) history.execute(cmd)
  else pending.push(cmd)
  setLegend(legendFor(by, ids, colorOf, ramp))
  return groups
}

// Commands built with record=false, gathered into one undo step by
// colorBlindMode below.
const pending: Command[] = []

// Channels get the categorical palette in their registry order.
export function colorChannelsByPalette(
  palette: CategoricalPalette = 'distinct',
  record = true
): number {
  const channels = Object.keys(ctx.channelColors)
  const colors = categoricalColors(channels, surface(), palette)
  const before = { ...ctx.channelColors }
  const apply = (c: Record<string, string>) => {
    Object.assign(ctx.channelColors, c)
    redrawIntraLayerEdges()
    ctx.renderInterLayerEdgesFlag = true
  }
  const cmd: Command = {
    description: 'Channel palette',
    execute: () => apply(Object.fromEntries(colors)),
    undo: () => apply(before),
  }
  if (record) history.execute(cmd)
  else pending.push(cmd)
  return channels.length
}

const LAYER_SHAPES: NodeGeometryType[] = [
  'sphere',
  'box',
  'diamond',
  'cone',
  'cylinder',
  'tetrahedron',
  'capsule',
  'torus',
  'icosahedron',
  'dodecahedron',
  'pyramid',
  'disc',
  'hexagon',
  'ring',
]

// One click for colour-blind readers: validated palette by layer (or by
// cluster when clustered), the same palette for channels, and a second cue
// that doesn't rely on colour — one node shape per layer. One undo step.
export function colorBlindMode(palette: CategoricalPalette = 'okabeIto'): void {
  pending.length = 0
  const clustered = ctx.nodeObjects.some((n) => n.cluster !== '')
  colorNodesBy(
    'all',
    clustered ? 'cluster' : 'layer',
    palette,
    'cividis',
    false
  )
  if (Object.keys(ctx.channelColors).length)
    colorChannelsByPalette(palette, false)
  const shapeOf = new Map(
    ctx.layers.map((l, k) => [l.name, LAYER_SHAPES[k % LAYER_SHAPES.length]])
  )
  pending.push(
    new NodeStyleCommand('Shape per layer', nodeTargets('all'), (i) => ({
      shape: shapeOf.get(ctx.nodeObjects[i].layer),
    }))
  )
  const steps = pending.splice(0)
  history.execute({
    description: 'Colour-blind friendly mode',
    execute: () => steps.forEach((c) => c.execute()),
    undo: () => [...steps].reverse().forEach((c) => c.undo()),
  })
}
