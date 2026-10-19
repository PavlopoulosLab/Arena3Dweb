// Rich editing — PLAN-ROADMAP Phase 24. Style a target set of nodes or edges
// (colour, size, shape, width, after Cytoscape's Style panel also opacity,
// border, stretch, label text/colour/size/look/position, description, line
// type and arrow colour) or colour them, or their labels, by a palette; every
// change is one undoable command and persists in sessions.

import * as THREE from 'three'
import { ctx } from '../three'
import {
  DEFAULT_LABEL_LOOK,
  type LabelLook,
  type LabelPosition,
  type NodeGeometryType,
} from '../three/Node'
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
import { contrastWith, restyleLayerLabels, restyleNodeLabels } from './labels'
import type { LayerLabelFont, LayerLabelPosition } from '../three/Layer'
import {
  decideNodeLabelFlags,
  revealChosenLabels,
  setNodeLabelMode,
  type NodeLabelState,
} from './node'
import { readableOn, themeChannelColor, themeNodeColor } from './palette'
import { THEMES } from './theme_presets'
import { store } from '../store'

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
  labelLook: LabelLook | null
  labelPosition: LabelPosition
  labelShown: boolean
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
    labelLook: n.labelLook && { ...n.labelLook },
    labelPosition: n.labelPosition,
    labelShown: n.labelShown,
    descr: n.descr,
  }
}

export class NodeStyleCommand implements Command {
  private readonly before: NodeStyle[]
  private readonly beforePriority = ctx.nodeColorPrioritySource
  // Show Labels before pinning moved it to Chosen (see execute)
  private beforeLabels: NodeLabelState | null = null
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
      if (s.labelLook !== undefined)
        n.labelLook = s.labelLook && { ...s.labelLook }
      if (s.labelPosition !== undefined) n.labelPosition = s.labelPosition
      if (s.labelShown !== undefined) n.labelShown = s.labelShown
      if (s.descr !== undefined) n.descr = s.descr
    })
    ctx.nodeColorPrioritySource = priority
    restyleNodeLabels()
    decideNodeLabelFlags() // pinned labels show or go
  }

  execute(): void {
    const patches = this.indices.map((i, k) => this.after(i, k))
    const changesColor = patches.some((p) => p.color)
    this.apply(
      (k) => patches[k],
      changesColor ? 'default' : ctx.nodeColorPrioritySource
    )
    // a label pinned to stay on screen shows at once
    if (patches.some((p) => p.labelShown))
      this.beforeLabels = revealChosenLabels()
  }
  undo(): void {
    this.apply((k) => this.before[k], this.beforePriority)
    if (this.beforeLabels)
      setNodeLabelMode(this.beforeLabels.mode, this.beforeLabels.withSelection)
    this.beforeLabels = null
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

/** Pin (or unpin) the labels of these nodes: pinned labels stay on screen
 * with Show Labels: Chosen, whatever the selection. One undo step. */
export function showLabelsOf(ids: number[], shown = true): number {
  return styleNodeIndices(
    ids,
    { labelShown: shown },
    shown ? 'Show their labels' : 'Hide their labels'
  )
}

// The label picker's buttons (Edit → Nodes → Labels to show), on a list of
// nodes: every label chosen, none, the other way round, or just the selected
// nodes'. Worked out now, so a redo repeats the same choice. One undo step.
export type LabelChoice = 'all' | 'none' | 'invert' | 'selected'
const CHOICE_NAMES: Record<LabelChoice, string> = {
  all: 'Show every listed label',
  none: 'Hide every listed label',
  invert: 'Invert the listed labels',
  selected: "Show the selected nodes' labels",
}

/** @return labels chosen among `ids` afterwards */
export function chooseLabels(ids: number[], how: LabelChoice): number {
  if (ids.length === 0) return 0
  const n = (i: number) => ctx.nodeObjects[i]
  const shown = new Map(
    ids.map((i) => [
      i,
      how === 'all' ||
        (how === 'invert' && !n(i).labelShown) ||
        (how === 'selected' && n(i).isSelected),
    ])
  )
  history.execute(
    new NodeStyleCommand(CHOICE_NAMES[how], ids, (i) => ({
      labelShown: shown.get(i)!,
    }))
  )
  return ids.filter((i) => shown.get(i)).length
}

/** Change part of the label look of these nodes (bold, the style …), each
 * keeping the rest of its own look (or the default halo). One undo step. */
export function styleLabelLooks(
  ids: number[],
  change: Partial<LabelLook>,
  description = 'Style labels'
): number {
  if (ids.length)
    history.execute(
      new NodeStyleCommand(description, ids, (i) => ({
        labelLook: {
          ...(ctx.nodeObjects[i].labelLook ?? DEFAULT_LABEL_LOOK),
          ...change,
        },
      }))
    )
  return ids.length
}

/** Unpin every label. @return labels unpinned */
export function clearChosenLabels(): number {
  return showLabelsOf(
    ctx.nodeObjects.flatMap((n, i) => (n.labelShown ? [i] : [])),
    false
  )
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

// ---------------------------------------------------------------- labels
// Label colours apart from the node colours: one palette colour per group
// (layer, cluster or first annotation term), the node's own colour (made to
// read on the background) or a colour that reads on top of the node.
export type LabelColorBy =
  'layer' | 'cluster' | 'annotation' | 'match' | 'contrast'
export type LabelPalette = CategoricalPalette | 'theme' | 'channels'
export const LABEL_PALETTE_LABELS: Record<LabelPalette, string> = {
  theme: 'Theme node colours',
  channels: 'Theme channel colours',
  distinct: 'Distinct (colour-blind checked)',
  okabeIto: 'Okabe–Ito (colour-blind safe)',
  tol: 'Tol bright (colour-blind safe)',
}

const background = () =>
  `#${ctx.renderer?.getClearColor(new THREE.Color()).getHexString() ?? '000000'}`

// one colour per key, in first-seen order of `keys`, each made to read on
// the background the labels sit on
function paletteColors(
  keys: string[],
  palette: LabelPalette
): Map<string, string> {
  if (palette !== 'theme' && palette !== 'channels') {
    const bg = background()
    const colors = categoricalColors(keys, surface(), palette)
    for (const [k, c] of colors) colors.set(k, readableOn(c, bg))
    return colors
  }
  const theme = THEMES[store.get().currentTheme] ?? THEMES.dark
  const out = new Map<string, string>()
  for (const k of keys)
    if (!out.has(k))
      out.set(
        k,
        palette === 'theme'
          ? themeNodeColor(theme, out.size)
          : themeChannelColor(theme, out.size)
      )
  return out
}

/** Colour the labels of the target nodes. @return groups coloured (or 0) */
export function colorLabelsBy(
  target: NodeTarget,
  by: LabelColorBy,
  palette: LabelPalette = 'theme'
): number {
  return colorLabelIndices(nodeTargets(target), by, palette)
}

export function colorLabelIndices(
  ids: number[],
  by: LabelColorBy,
  palette: LabelPalette = 'theme'
): number {
  if (ids.length === 0) return 0
  const hex = (c: string) => `#${new THREE.Color(c).getHexString()}`
  let colorOf: (i: number) => string
  let groups: number
  if (by === 'match' || by === 'contrast') {
    const bg = background()
    colorOf = (i) => {
      const c = hex(ctx.nodeObjects[i].getColor())
      return by === 'match' ? readableOn(c, bg) : contrastWith(c)
    }
    groups = new Set(ids.map(colorOf)).size
  } else {
    const key = (i: number) => {
      const n = ctx.nodeObjects[i]
      if (by === 'layer') return n.layer
      if (by === 'cluster') return n.cluster || '(none)'
      return n.annotations[0] ?? '(none)'
    }
    // order across the whole network, so a group keeps its colour whichever
    // nodes are coloured
    const order =
      by === 'layer'
        ? ctx.layers.map((l) => l.name)
        : ctx.nodeObjects.map((_, i) => key(i))
    const colors = paletteColors(order, palette)
    colorOf = (i) => colors.get(key(i))!
    groups = new Set(ids.map(key)).size
  }
  history.execute(
    new NodeStyleCommand(`Colour labels by ${by}`, ids, (i) => ({
      labelColor: colorOf(i),
    }))
  )
  return groups
}

// ---------------------------------------------------------------- layer labels
// Edit → Layers → Labels & axes: the look, font, colour and place of the
// layer labels, for all layers or the selected ones. One undo step each.
export type LayerLabelStyle = {
  look: LabelLook | null
  font: LayerLabelFont | ''
  bold: boolean
  italic: boolean
  color: string
  position: LayerLabelPosition
}
export type LayerLabelColorBy = 'theme' | 'one' | 'layer' | 'palette'

const layerLabelStyle = (i: number): LayerLabelStyle => {
  const l = ctx.layers[i]
  return {
    look: l.labelLook && { ...l.labelLook },
    font: l.labelFont,
    bold: l.labelBold,
    italic: l.labelItalic,
    color: l.labelColor,
    position: l.labelPosition,
  }
}

function applyLayerLabelStyle(i: number, st: Partial<LayerLabelStyle>): void {
  const l = ctx.layers[i]
  if (st.look !== undefined) l.labelLook = st.look && { ...st.look }
  if (st.font !== undefined) l.labelFont = st.font
  if (st.bold !== undefined) l.labelBold = st.bold
  if (st.italic !== undefined) l.labelItalic = st.italic
  if (st.color !== undefined) l.labelColor = st.color
  if (st.position !== undefined) l.labelPosition = st.position
}

/** The layer's own colour as its label colour: the colour of its nodes (as
 * the layer legend shows it), made to read on the background. */
export function layerLabelColor(i: number): string {
  const l = ctx.layers[i]
  const node = ctx.nodeObjects.find((n) => n.layer === l.name)
  const c = `#${new THREE.Color(node?.getColor() ?? l.getColor()).getHexString()}`
  return readableOn(c, background())
}

/** Style the labels of these layers; `after` gives each layer its change
 * (worked out now, so a redo repeats it). @return layers changed */
export function styleLayerLabels(
  indices: number[],
  after: (i: number) => Partial<LayerLabelStyle>,
  description = 'Style layer labels'
): number {
  if (indices.length === 0) return 0
  const before = indices.map(layerLabelStyle)
  const changes = indices.map(after)
  const apply = (sts: Partial<LayerLabelStyle>[]) => {
    indices.forEach((i, k) => applyLayerLabelStyle(i, sts[k]))
    restyleLayerLabels()
  }
  history.execute({
    description,
    execute: () => apply(changes),
    undo: () => apply(before),
  })
  return indices.length
}

/** The label colour each of these layers gets: the theme's (''), one colour,
 * its own colour, or one palette colour per layer (in layer order). */
export function layerLabelColors(
  indices: number[],
  by: LayerLabelColorBy,
  color = '#ffffff',
  palette: LabelPalette = 'theme'
): Map<number, string> {
  if (by === 'palette') {
    const colors = paletteColors(
      ctx.layers.map((l) => l.name),
      palette
    )
    return new Map(indices.map((i) => [i, colors.get(ctx.layers[i].name)!]))
  }
  return new Map(
    indices.map((i) => [
      i,
      by === 'theme' ? '' : by === 'one' ? color : layerLabelColor(i),
    ])
  )
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
