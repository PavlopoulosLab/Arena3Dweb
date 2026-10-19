// Edit → Attributes: a node table and an edge table after Cytoscape's, one
// row per node or edge, every cell editable. What a row shows is read from
// the scene objects; an edit goes through the Style commands (style.ts), so
// it is one undo step and kept in sessions. Ticking rows is the scene
// selection, and an edit in a ticked row changes every ticked row in the
// list. Export writes the attribute files File → Node / Edge attributes
// read back.

import { Color } from 'three'
import { ctx } from '../three'
import { EDGE_MIN_VISIBLE_OPACITY } from '../three/constants'
import {
  LABEL_BOX_OPACITY,
  LABEL_HALO_PX,
  LABEL_POSITION_LABELS,
  NODE_SHAPES,
  labelLookFromText,
  labelLookText,
  type LabelPosition,
  type NodeGeometryType,
} from '../three/Node'
import { LINE_TYPE_LABELS, type LineType } from '../three/Edge'
import { selectEdges, selectNodes } from './search'
import { listGroups, type GroupSource } from './groups'
import {
  styleEdgeIndices,
  styleNodeIndices,
  type EdgePatch,
  type NodePatch,
} from './style'

// ---------------------------------------------------------------- cells
export type NodeColumn =
  | 'name'
  | 'layer'
  | 'color'
  | 'shape'
  | 'scale'
  | 'alpha'
  | 'label'
  | 'labelColor'
  | 'labelSize'
  | 'labelStyle'
  | 'labelBold'
  | 'labelPosition'
  | 'labelShown'
  | 'descr'
export type EdgeColumn =
  | 'source'
  | 'target'
  | 'layers'
  | 'channel'
  | 'color'
  | 'width'
  | 'opacity'
  | 'lineType'
  | 'arrowColor'

// #rrggbb, as <input type="color"> needs it ('#FFF', 'red' -> '#ffffff', …)
export const hex = (color: string): string =>
  `#${new Color(color).getHexString()}`

export const round = (v: number): number => Number(v.toFixed(3))

export function nodeCell(i: number, col: NodeColumn): string | number {
  const n = ctx.nodeObjects[i]
  switch (col) {
    case 'name':
      return n.name
    case 'layer':
      return n.layer
    case 'color':
      return hex(n.getColor())
    case 'shape':
      return n.shape
    case 'scale':
      return round(n.getScale())
    case 'alpha':
      return round(n.alpha)
    case 'label':
      return n.label
    case 'labelColor': // '' = as the label style
      return n.labelColor ? hex(n.labelColor) : ''
    case 'labelSize': // '' = as the label style
      return n.labelSize || ''
    case 'labelStyle': // '' = as the label style
      return n.labelLook?.style ?? ''
    case 'labelBold':
      return n.labelLook?.bold ? 'yes' : ''
    case 'labelPosition':
      return n.labelPosition
    case 'labelShown': // pinned: shown with Show Labels: Chosen
      return n.labelShown ? 'yes' : ''
    case 'descr':
      return n.descr
  }
}

const nodeName = (i: number) => ctx.nodeObjects[i]?.name ?? ''
const layerName = (i: number) => ctx.layers[i]?.name ?? ''

export function edgeCell(i: number, col: EdgeColumn): string | number {
  const e = ctx.edgeObjects[i]
  switch (col) {
    case 'source':
      return nodeName(e.sourceNodeIndex)
    case 'target':
      return nodeName(e.targetNodeIndex)
    case 'layers':
      return e.interLayer
        ? `${layerName(e.sourceLayerIndex)} → ${layerName(e.targetLayerIndex)}`
        : layerName(e.sourceLayerIndex)
    case 'channel':
      return e.channels.join(', ')
    case 'color':
      return hex(e.decideColor(0, true))
    case 'width':
      return round(e.widthFactor)
    case 'opacity':
      return round(e.opacityFactor)
    case 'lineType':
      return e.lineType
    case 'arrowColor':
      return e.arrowColor ? hex(e.arrowColor) : ''
  }
}

// ---------------------------------------------------------------- lists
export type NodeFilter = {
  text?: string // in the name, label, description or layer
  layer?: string // '' = every layer
  group?: string // `annotation:<name>` / `cluster:<name>`, '' = any
  selectedOnly?: boolean
}

export function filterNodes(f: NodeFilter): number[] {
  const text = f.text?.trim().toLowerCase() ?? ''
  let members: Set<number> | null = null
  if (f.group) {
    const colon = f.group.indexOf(':')
    const source = f.group.slice(0, colon) as GroupSource
    const name = f.group.slice(colon + 1)
    members = new Set(
      listGroups(source).find((g) => g.name === name)?.members ?? []
    )
  }
  return ctx.nodeObjects.flatMap((n, i) =>
    (!f.layer || n.layer === f.layer) &&
    (!f.selectedOnly || n.isSelected) &&
    (!members || members.has(i)) &&
    (!text ||
      [n.name, n.label, n.descr, n.layer].some((s) =>
        s.toLowerCase().includes(text)
      ))
      ? [i]
      : []
  )
}

export type EdgeFilter = {
  text?: string // in the source or target name
  channel?: string // '*' or undefined = any, '' = no channel
  kind?: '' | 'intra' | 'inter'
  selectedOnly?: boolean
}

export function filterEdges(f: EdgeFilter): number[] {
  const text = f.text?.trim().toLowerCase() ?? ''
  const channel = f.channel ?? '*'
  return ctx.edgeObjects.flatMap((e, i) =>
    (!f.kind || (f.kind === 'inter') === e.interLayer) &&
    (!f.selectedOnly || e.isSelected) &&
    (channel === '*' ||
      (channel === ''
        ? e.channels.length === 0
        : e.channels.includes(channel))) &&
    (!text ||
      [nodeName(e.sourceNodeIndex), nodeName(e.targetNodeIndex)].some((s) =>
        s.toLowerCase().includes(text)
      ))
      ? [i]
      : []
  )
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

// Stable: equal cells keep their order. Numbers by value, text naturally
// ('n2' before 'n10').
export function sortRows(
  ids: number[],
  cell: (i: number) => string | number,
  dir: 1 | -1
): number[] {
  const keyed = ids.map((i, k) => ({ i, k, v: cell(i) }))
  keyed.sort((a, b) => {
    const c =
      typeof a.v === 'number' && typeof b.v === 'number'
        ? a.v - b.v
        : collator.compare(String(a.v), String(b.v))
    return c * dir || a.k - b.k
  })
  return keyed.map((r) => r.i)
}

// The rows an edit in row `i` changes: every ticked row in the list when
// `i` is ticked (a bulk edit), else `i` alone.
export function editTargets(
  i: number,
  list: number[],
  ticked: (i: number) => boolean
): number[] {
  return ticked(i) ? list.filter(ticked) : [i]
}

// ---------------------------------------------------------------- values
const COLOR = /^#[0-9a-f]{6}$/i
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v))
const number = (raw: string): number | null => {
  const v = Number(raw.trim())
  return raw.trim() === '' || !Number.isFinite(v) ? null : v
}

// a pinned label in a typed cell or a file: yes / true / 1, or blank / no
const SHOWN = ['yes', 'y', 'true', '1', 'x', 'shown']
const NOT_SHOWN = ['', 'no', 'n', 'false', '0']

export const LIMITS = {
  scale: [0.05, 20],
  alpha: [0.05, 1],
  borderWidth: [0, 10],
  labelSize: [6, 60],
  labelHalo: LABEL_HALO_PX,
  labelBox: LABEL_BOX_OPACITY,
  width: [0.1, 10],
  opacity: [0.05, 1],
} as const

// A typed value as a patch for the Style command, or null when it is not
// valid. Numbers are kept within the editor's limits.
export type NodeField =
  Exclude<NodeColumn, 'name' | 'layer'> | 'borderColor' | 'borderWidth'

export function nodePatch(field: NodeField, raw: string): NodePatch | null {
  const v = number(raw)
  switch (field) {
    case 'color':
      return COLOR.test(raw) ? { color: raw.toLowerCase() } : null
    case 'shape':
      return NODE_SHAPES.includes(raw as NodeGeometryType)
        ? { shape: raw as NodeGeometryType }
        : null
    case 'scale':
      return v === null ? null : { scale: clamp(v, ...LIMITS.scale) }
    case 'alpha':
      return v === null ? null : { alpha: clamp(v, ...LIMITS.alpha) }
    case 'label':
      return { label: raw.trim().slice(0, 200) }
    case 'descr':
      return { descr: raw.trim().slice(0, 2000) }
    case 'labelColor': // '' = as the label style
      return raw === '' || COLOR.test(raw)
        ? { labelColor: raw.toLowerCase() }
        : null
    case 'labelSize': // blank or 0 = as the label style
      return raw.trim() === '' || v === 0
        ? { labelSize: 0 }
        : v === null
          ? null
          : { labelSize: Math.round(clamp(v, ...LIMITS.labelSize)) }
    case 'labelStyle': {
      const look = labelLookFromText(raw)
      return look === undefined ? null : { labelLook: look }
    }
    case 'labelShown': {
      const t = raw.trim().toLowerCase()
      return SHOWN.includes(t)
        ? { labelShown: true }
        : NOT_SHOWN.includes(t)
          ? { labelShown: false }
          : null
    }
    case 'labelPosition': // blank = right of the node, as always
      return raw.trim() === ''
        ? { labelPosition: 'right' }
        : raw.trim().toLowerCase() in LABEL_POSITION_LABELS
          ? { labelPosition: raw.trim().toLowerCase() as LabelPosition }
          : null
    default:
      return null // the border needs both its colour and width: borderPatch
  }
}

export function borderPatch(color: string, width: string): NodePatch | null {
  const w = number(width)
  return COLOR.test(color) && w !== null
    ? {
        border: {
          color: color.toLowerCase(),
          width: clamp(w, ...LIMITS.borderWidth),
        },
      }
    : null
}

export type EdgeField = Exclude<
  EdgeColumn,
  'source' | 'target' | 'layers' | 'channel'
>

export function edgePatch(field: EdgeField, raw: string): EdgePatch | null {
  const v = number(raw)
  switch (field) {
    case 'color':
      return COLOR.test(raw) ? { color: raw.toLowerCase() } : null
    case 'width':
      return v === null ? null : { widthFactor: clamp(v, ...LIMITS.width) }
    case 'opacity':
      return v === null ? null : { opacityFactor: clamp(v, ...LIMITS.opacity) }
    case 'lineType':
      return raw in LINE_TYPE_LABELS ? { lineType: raw as LineType } : null
    case 'arrowColor': // '' = the edge's colour
      return raw === '' || COLOR.test(raw)
        ? { arrowColor: raw.toLowerCase() }
        : null
  }
}

// ---------------------------------------------------------------- edits
const plural = (n: number, what: string) =>
  `${n.toLocaleString('en-GB')} ${what}${n === 1 ? '' : 's'}`

const NODE_FIELD_NAMES: Record<keyof NodePatch, string> = {
  color: 'colour',
  scale: 'size',
  shape: 'shape',
  alpha: 'opacity',
  border: 'border',
  stretch: 'proportions',
  label: 'label',
  labelColor: 'label colour',
  labelSize: 'label size',
  labelLook: 'label style',
  labelPosition: 'label position',
  labelShown: 'label shown',
  descr: 'description',
}
const EDGE_FIELD_NAMES: Record<keyof EdgePatch, string> = {
  color: 'colour',
  widthFactor: 'width',
  opacityFactor: 'opacity',
  lineType: 'line type',
  arrowColor: 'arrow colour',
}

export const nodePatchName = (p: NodePatch): string =>
  Object.keys(p)
    .map((k) => NODE_FIELD_NAMES[k as keyof NodePatch])
    .join(', ')
export const edgePatchName = (p: EdgePatch): string =>
  Object.keys(p)
    .map((k) => EDGE_FIELD_NAMES[k as keyof EdgePatch])
    .join(', ')

// One undo step for all of `ids`. @return nodes changed
export function editNodes(ids: number[], patch: NodePatch): number {
  const what =
    ids.length === 1 ? ctx.nodeObjects[ids[0]].name : plural(ids.length, 'node')
  return styleNodeIndices(ids, patch, `Set ${nodePatchName(patch)} of ${what}`)
}

export function editEdges(ids: number[], patch: EdgePatch): number {
  const what =
    ids.length === 1
      ? `${edgeCell(ids[0], 'source')} – ${edgeCell(ids[0], 'target')}`
      : plural(ids.length, 'edge')
  return styleEdgeIndices(ids, patch, `Set ${edgePatchName(patch)} of ${what}`)
}

// ---------------------------------------------------------------- ticks
// Ticking rows adds them to the scene selection, unticking takes them out;
// the rest of the selection stays.
export function tickNodes(ids: number[], on: boolean): void {
  if (on) return selectNodes(ids, false)
  const off = new Set(ids)
  selectNodes(
    ctx.nodeObjects.flatMap((n, i) => (n.isSelected && !off.has(i) ? [i] : [])),
    true
  )
}

export function tickEdges(ids: number[], on: boolean): void {
  if (on) return selectEdges(ids, false)
  const off = new Set(ids)
  selectEdges(
    ctx.edgeObjects.flatMap((e, i) => (e.isSelected && !off.has(i) ? [i] : [])),
    true
  )
}

// ---------------------------------------------------------------- export
// Tab-separated, in the formats of the node and edge attribute files (File
// panel), with the columns they read back; one edge row per channel.
const cell = (v: string | number) =>
  String(v)
    .replace(/[\t\r\n]+/g, ' ')
    .trim()
const line = (cells: (string | number)[]) => cells.map(cell).join('\t')

export const NODE_ATTRIBUTE_COLUMNS = [
  'Node',
  'Layer',
  'Color',
  'Size',
  'Shape',
  'Opacity',
  'Label',
  'LabelColor',
  'LabelSize',
  'LabelStyle',
  'LabelPosition',
  'LabelBold',
  'LabelShown',
  'Url',
  'Description',
  'Annotation',
]

export function nodeAttributesTsv(ids = ctx.nodeObjects.map((_, i) => i)) {
  const rows = ids.map((i) => {
    const n = ctx.nodeObjects[i]
    return line([
      n.name,
      n.layer,
      hex(n.getColor()),
      round(n.getScale()),
      n.shape,
      round(n.alpha),
      n.label,
      n.labelColor,
      n.labelSize || '',
      // bold has a column of its own
      labelLookText(n.labelLook && { ...n.labelLook, bold: false }),
      n.labelPosition === 'right' ? '' : n.labelPosition,
      n.labelLook?.bold ? 'yes' : '',
      n.labelShown ? 'yes' : '',
      n.url,
      n.descr,
      n.annotations.join(';'),
    ])
  })
  return [NODE_ATTRIBUTE_COLUMNS.join('\t'), ...rows].join('\n') + '\n'
}

export const EDGE_ATTRIBUTE_COLUMNS = [
  'SourceNode',
  'SourceLayer',
  'TargetNode',
  'TargetLayer',
  'Channel',
  'Color',
  'Width',
  'Opacity',
  'LineType',
  'ArrowColor',
]

export function edgeAttributesTsv(ids = ctx.edgeObjects.map((_, i) => i)) {
  const rows = ids.flatMap((i) => {
    const e = ctx.edgeObjects[i]
    const s = ctx.nodeObjects[e.sourceNodeIndex]
    const t = ctx.nodeObjects[e.targetNodeIndex]
    const row = (channel: string, j: number) =>
      line([
        s.name,
        s.layer,
        t.name,
        t.layer,
        channel,
        hex(e.decideColor(j, true)),
        round(e.widthFactor),
        round(e.opacityFactor),
        e.lineType,
        e.arrowColor ? hex(e.arrowColor) : '',
      ])
    return e.channels.length ? e.channels.map(row) : [row('', 0)]
  })
  return [EDGE_ATTRIBUTE_COLUMNS.join('\t'), ...rows].join('\n') + '\n'
}

// ---------------------------------------------------------------- picking
// Distance from (x, y) to the segment a–b.
export function segmentDistance(
  x: number,
  y: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax
  const dy = by - ay
  const len = dx * dx + dy * dy
  const t = len ? clamp(((x - ax) * dx + (y - ay) * dy) / len, 0, 1) : 0
  return Math.hypot(x - ax - t * dx, y - ay - t * dy)
}

// The node's place on the canvas, as the right-click menu reckons it.
export function nodeOnCanvas(i: number): [number, number] {
  const n = ctx.nodeObjects[i]
  return [
    ctx.xBoundMax + n.getWorldPosition('x'),
    ctx.yBoundMax - n.getWorldPosition('y'),
  ]
}

// The edge drawn nearest a point of the canvas (layer coordinates), taken
// straight from node to node, or -1 when none is within `radius` px. Edges
// of hidden floors and edges too faint to be drawn are skipped.
export function pickEdge(x: number, y: number, radius = 6): number {
  const at = new Map<number, [number, number]>()
  const place = (i: number) => {
    let p = at.get(i)
    if (!p) at.set(i, (p = nodeOnCanvas(i)))
    return p
  }
  let best = -1
  let bestD = radius
  ctx.edgeObjects.forEach((e, k) => {
    if (e.sourceNodeIndex < 0 || e.targetNodeIndex < 0) return
    if (!e.areLayersNotHidden()) return
    if (e.decideOpacity(0) < EDGE_MIN_VISIBLE_OPACITY) return
    const d = segmentDistance(
      x,
      y,
      ...place(e.sourceNodeIndex),
      ...place(e.targetNodeIndex)
    )
    if (d < bestD) {
      bestD = d
      best = k
    }
  })
  return best
}
