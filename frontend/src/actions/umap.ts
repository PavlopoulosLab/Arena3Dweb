// UMAP (McInnes, Healy & Melville 2018), computed on the server
// (backend services/umap_layout.py through POST /api/layout, algorithm
// 'UMAP'). Shared by the Layout panel, which places the nodes, and Export →
// Other tools, which draws the same embedding as a 2D scatter (SVG/PNG),
// writes its coordinates (CSV) or opens it in the Vega editor.
//
// Attribute features the client knows are assembled here: File → Values
// columns (by node name, every copy alike), annotation sets and the current
// clusters as one-hot terms. Node metrics are computed on the server, on the
// graph each scope lays out.

import {
  api,
  type LayoutPosition,
  type LayoutRequest,
  type UmapMode,
  type UmapOptions,
  type UploadProgress,
  type ValueTable,
} from '../api/client'
import { ctx } from '../three'
import { store } from '../store'
import { valueTable } from './values'
import { activeSlot, type AnnotationSet } from './workspace'
import { categoricalColors, OTHER } from './palettes'
import { layerSwatchColor } from './legend'
import { ExportError, network } from './export'
import { lzCompressToEncodedURIComponent } from './visualizations'

export const UMAP = 'UMAP'
export const UMAP_MODES: [UmapMode, string][] = [
  ['topology', 'Topology UMAP: by connectivity'],
  ['attributes', 'Attribute UMAP: by node features'],
  ['hybrid', 'Hybrid UMAP: connectivity and features'],
]
// backend services/topology.py METRICS
export const UMAP_METRICS = [
  'Degree',
  'Clustering Coefficient',
  'Betweenness Centrality',
  'Closeness Centrality',
  'Eigenvector Centrality',
  'PageRank',
  'Coreness (k-core)',
  'Eccentricity',
]
export const MAX_SET_TERMS = 50 // the most frequent terms of a set count
export const MAX_UMAP_FEATURES = 500 // backend config.MAX_UMAP_FEATURES

export type FeatureKind = 'value' | 'set' | 'clusters' | 'metric'
export interface FeatureSource {
  key: string
  label: string
  kind: FeatureKind
}

// what the features are made of
export interface FeatureData {
  values: ValueTable | null
  sets: AnnotationSet[]
  clusters: Record<string, string> // Node_Layer id -> cluster ('' = none)
}

export function currentFeatureData(): FeatureData {
  const clusters: Record<string, string> = {}
  ctx.nodeObjects.forEach((n, i) => {
    if (n.cluster !== '') clusters[ctx.nodeLayerNames[i]] = n.cluster
  })
  return {
    values: valueTable(),
    sets: activeSlot()?.annotationSets ?? [],
    clusters,
  }
}

// Everything the user can tick, in the order the form lists it
export function featureSources(data: FeatureData): FeatureSource[] {
  return [
    ...(data.values?.columns ?? []).map((c) => ({
      key: `value:${c}`,
      label: c,
      kind: 'value' as const,
    })),
    ...data.sets.map((s) => ({
      key: `set:${s.name}`,
      label: s.name,
      kind: 'set' as const,
    })),
    ...(Object.keys(data.clusters).length
      ? [{ key: 'clusters', label: 'Clusters', kind: 'clusters' as const }]
      : []),
    ...UMAP_METRICS.map((m) => ({
      key: `metric:${m}`,
      label: m,
      kind: 'metric' as const,
    })),
  ]
}

// One-hot columns over the terms of `termsOf`, the most frequent first
function oneHot(
  prefix: string,
  nodes: { id: string }[],
  termsOf: (id: string) => string[]
): { names: string[]; rows: Map<string, number[]> } {
  const counts = new Map<string, number>()
  for (const n of nodes)
    for (const t of new Set(termsOf(n.id)))
      counts.set(t, (counts.get(t) ?? 0) + 1)
  const terms = [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_SET_TERMS)
    .map(([t]) => t)
  const rows = new Map<string, number[]>()
  for (const n of nodes) {
    const own = new Set(termsOf(n.id))
    rows.set(
      n.id,
      terms.map((t) => (own.has(t) ? 1 : 0))
    )
  }
  return { names: terms.map((t) => `${prefix}: ${t}`), rows }
}

export interface AssembledFeatures {
  feature_names: string[]
  features: Record<string, (number | null)[]>
  metrics: string[]
}

// The ticked sources as one row per node (`label` = the node's name, which
// File → Values matches). A value a node lacks is null: the server fills in
// the column mean.
export function assembleFeatures(
  nodes: { id: string; label: string }[],
  picked: string[],
  data: FeatureData
): AssembledFeatures {
  const names: string[] = []
  const columns: ((id: string, label: string) => number | null)[] = []
  const metrics: string[] = []
  for (const key of picked) {
    const [kind, ...rest] = key.split(':')
    const name = rest.join(':')
    if (kind === 'value' && data.values) {
      const c = data.values.columns.indexOf(name)
      if (c < 0) continue
      const byName = new Map(
        data.values.rows.map((r) => [r.node, r.values[c] ?? null])
      )
      names.push(name)
      columns.push((_, label) => byName.get(label) ?? null)
    } else if (kind === 'set' || kind === 'clusters') {
      const set = data.sets.find((s) => s.name === name)
      if (kind === 'set' && !set) continue
      const termsOf =
        kind === 'clusters'
          ? (id: string) => (data.clusters[id] ? [data.clusters[id]] : [])
          : (id: string) => set!.byNode[id] ?? []
      const hot = oneHot(kind === 'clusters' ? 'Cluster' : name, nodes, termsOf)
      hot.names.forEach((n, j) => {
        names.push(n)
        columns.push((id) => hot.rows.get(id)![j])
      })
    } else if (kind === 'metric' && UMAP_METRICS.includes(name))
      metrics.push(name)
  }
  const features: Record<string, (number | null)[]> = {}
  if (names.length)
    for (const n of nodes) features[n.id] = columns.map((f) => f(n.id, n.label))
  return { feature_names: names, features, metrics }
}

export interface UmapChoice {
  mode: UmapMode
  features: string[] // FeatureSource keys
  balance: number
  n_neighbors: number
  min_dist: number
  metric: 'euclidean' | 'cosine'
  seed: number
}

export const UMAP_DEFAULTS: UmapChoice = {
  mode: 'topology',
  features: [],
  balance: 0.5,
  n_neighbors: 15,
  min_dist: 0.1,
  metric: 'euclidean',
  seed: 42,
}

// The request's `umap` block for the nodes of `layers`
export function umapOptions(
  choice: UmapChoice,
  layers: string[],
  data: FeatureData = currentFeatureData()
): UmapOptions {
  const base = {
    mode: choice.mode,
    n_neighbors: choice.n_neighbors,
    min_dist: choice.min_dist,
    metric: choice.metric,
    balance: choice.balance,
  }
  if (choice.mode === 'topology') return base
  const chosen = new Set(layers)
  const nodes = (store.get().network?.nodes ?? []).filter((n) =>
    chosen.has(n.layer)
  )
  const assembled = assembleFeatures(nodes, choice.features, data)
  if (!assembled.feature_names.length && !assembled.metrics.length)
    throw new Error(
      'Attribute and Hybrid UMAP need features: tick value columns, annotation sets, clusters or node metrics.'
    )
  if (assembled.feature_names.length > MAX_UMAP_FEATURES)
    throw new Error(
      `UMAP takes up to ${MAX_UMAP_FEATURES} feature columns (these make ${assembled.feature_names.length}); tick fewer annotation sets.`
    )
  return { ...base, ...assembled }
}

// ---------------------------------------------------------------- export view
// One point per node copy (the chosen layers as one network) or per node name
// (copies merged, as the "Align Nodes Across Selected Layers" scope does).
export type UmapPoints = 'copies' | 'names'
export type UmapColour = 'scene' | 'layer' | 'cluster' | 'annotation'
export const UMAP_COLOURS: [UmapColour, string][] = [
  ['scene', 'scene colours'],
  ['layer', 'layer'],
  ['cluster', 'cluster'],
  ['annotation', 'annotation term'],
]

export interface UmapPoint {
  id: string
  name: string
  layer: string
  x: number
  y: number
  cluster: string
  annotation: string
  group: string // what the colour stands for ('' for scene colours)
  color: string
}

// the layers the view uses: those ticked in Layer selection, all if none
export function exportLayers(): string[] {
  const { network: net, selectedLayers } = store.get()
  return selectedLayers.length ? selectedLayers : (net?.layers ?? [])
}

let cache: {
  net: unknown
  key: string
  positions: Record<string, LayoutPosition>
} | null = null

// The 2D embedding, computed once per network, options and layers
export async function umapEmbedding(
  choice: UmapChoice,
  points: UmapPoints,
  onProgress?: UploadProgress
): Promise<Record<string, LayoutPosition>> {
  const net = network()
  const layers = exportLayers()
  const req: LayoutRequest = {
    nodes: net.nodes,
    edges: net.edges,
    algorithm: UMAP,
    scope: points === 'names' ? 'coupled' : 'allLayers',
    selected_layers: layers,
    seed: choice.seed,
    dimensions: 2,
    umap: umapOptions(choice, layers),
  }
  const key = JSON.stringify({ ...req, nodes: null, edges: null })
  if (cache && cache.net === net && cache.key === key) return cache.positions
  const res = await api.layout(req, onProgress)
  cache = { net, key, positions: res.positions }
  return res.positions
}

// The last UMAP view of the network on screen, if any (for other exports)
export function cachedUmapPositions(): Record<string, LayoutPosition> | null {
  return cache && cache.net === store.get().network ? cache.positions : null
}

const NONE = '(none)'

export function umapPoints(
  positions: Record<string, LayoutPosition>,
  colour: UmapColour,
  points: UmapPoints
): UmapPoint[] {
  const seen = new Set<string>()
  const out: UmapPoint[] = []
  ctx.nodeObjects.forEach((n, i) => {
    const id = ctx.nodeLayerNames[i]
    const p = positions[id]
    if (!p || (points === 'names' && seen.has(n.name))) return
    seen.add(n.name)
    const cluster = n.cluster || NONE
    const annotation = n.annotations[0] ?? NONE
    const group =
      colour === 'layer'
        ? n.layer
        : colour === 'cluster'
          ? cluster
          : colour === 'annotation'
            ? annotation
            : ''
    out.push({
      id,
      name: n.name,
      layer: n.layer,
      x: p[0],
      y: p[1],
      cluster,
      annotation,
      group,
      color: n.color,
    })
  })
  if (colour === 'scene') return out
  // categories by size; layers keep the colours the scene gives them
  const sizes = new Map<string, number>()
  for (const p of out) sizes.set(p.group, (sizes.get(p.group) ?? 0) + 1)
  const order = [...sizes]
    .filter(([g]) => g !== NONE)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([g]) => g)
  const palette = categoricalColors(order, 'light')
  for (const p of out)
    p.color =
      colour === 'layer'
        ? layerSwatchColor(p.group)
        : p.group === NONE
          ? OTHER
          : palette.get(p.group)!
  return out
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
const hex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#888888')
const LEGEND_MAX = 14

// legend rows: each group with its colour, the largest first
function legendRows(pts: UmapPoint[]): [string, string, number][] {
  const rows = new Map<string, [string, number]>()
  for (const p of pts) {
    const r = rows.get(p.group)
    rows.set(p.group, [p.color, (r?.[1] ?? 0) + 1])
  }
  return [...rows]
    .map(([g, [c, n]]) => [g, c, n] as [string, string, number])
    .sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]))
}

// A 2D scatter of the embedding, white background, legend on the right
export function umapScatterSvg(
  pts: UmapPoint[],
  title: string,
  colour: UmapColour
): string {
  if (!pts.length) throw new ExportError('No nodes to draw.')
  const plot = 640
  const left = 50
  const top = 50
  const legend = colour === 'scene' ? [] : legendRows(pts)
  const width = left + plot + (legend.length ? 240 : 30)
  const height = top + plot + 50
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const [x0, x1, y0, y1] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ]
  const pad = 16
  const sx = (x: number) =>
    left +
    pad +
    (x1 > x0 ? ((x - x0) / (x1 - x0)) * (plot - 2 * pad) : plot / 2)
  // y grows upwards, as in a plot
  const sy = (y: number) =>
    top +
    plot -
    pad -
    (y1 > y0 ? ((y - y0) / (y1 - y0)) * (plot - 2 * pad) : plot / 2)
  const r = pts.length > 2000 ? 2.5 : pts.length > 500 ? 3.5 : 5
  const dots = pts
    .map(
      (p) =>
        `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${r}" fill="${hex(p.color)}" fill-opacity="0.85" stroke="#ffffff" stroke-width="0.6"><title>${esc(p.name)} (${esc(p.layer)})${p.group ? ` · ${esc(p.group)}` : ''}</title></circle>`
    )
    .join('')
  const shown = legend.slice(0, LEGEND_MAX)
  const rest = legend.length - shown.length
  const legendX = left + plot + 24
  const legendSvg = shown
    .map(
      ([g, c, n], i) =>
        `<circle cx="${legendX + 6}" cy="${top + 10 + i * 20}" r="6" fill="${hex(c)}"/><text x="${legendX + 18}" y="${top + 14 + i * 20}" font-size="12">${esc(g.length > 26 ? `${g.slice(0, 25)}…` : g)} (${n})</text>`
    )
    .join('')
  const more = rest
    ? `<text x="${legendX}" y="${top + 14 + shown.length * 20}" font-size="12" fill="#555555">… ${rest} more</text>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif">
<rect width="100%" height="100%" fill="#ffffff"/>
<text x="${left}" y="30" font-size="16" font-weight="bold">${esc(title)}</text>
<rect x="${left}" y="${top}" width="${plot}" height="${plot}" fill="none" stroke="#999999"/>
<text x="${left + plot / 2}" y="${top + plot + 30}" font-size="13" text-anchor="middle">UMAP 1</text>
<text x="${left - 18}" y="${top + plot / 2}" font-size="13" text-anchor="middle" transform="rotate(-90 ${left - 18} ${top + plot / 2})">UMAP 2</text>
${dots}
${legendSvg}${more}
</svg>`
}

// The SVG drawn on a canvas at twice its size
export async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new ExportError('The scatter did not render.'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.width * scale
    canvas.height = img.height * scale
    const g = canvas.getContext('2d')!
    g.scale(scale, scale)
    g.drawImage(img, 0, 0)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new ExportError('PNG failed.'))),
        'image/png'
      )
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

const csvCell = (s: string) =>
  /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s

export function umapCsv(pts: UmapPoint[]): string {
  const rows = pts.map((p) =>
    [p.id, p.name, p.layer, String(p.x), String(p.y), p.cluster, p.annotation]
      .map(csvCell)
      .join(',')
  )
  return `${['node_id', 'node', 'layer', 'umap_1', 'umap_2', 'cluster', 'annotation'].join(',')}\n${rows.join('\n')}\n`
}

export const VEGA_MAX_POINTS = 3000

export function vegaUmapSpec(
  pts: UmapPoint[],
  title: string,
  colour: UmapColour
): Record<string, unknown> {
  if (pts.length > VEGA_MAX_POINTS)
    throw new ExportError(
      `The Vega editor link holds up to ${VEGA_MAX_POINTS} points (this view has ${pts.length}); download the SVG or the CSV instead.`
    )
  const legend = legendRows(pts)
  const color =
    colour === 'scene'
      ? { field: 'color', type: 'nominal', scale: null, legend: null }
      : {
          field: 'group',
          type: 'nominal',
          title: UMAP_COLOURS.find(([c]) => c === colour)?.[1] ?? colour,
          scale: {
            domain: legend.map(([g]) => g),
            range: legend.map(([, c]) => hex(c)),
          },
        }
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    title,
    width: 600,
    height: 600,
    data: {
      values: pts.map((p) => ({
        node: p.name,
        layer: p.layer,
        group: p.group,
        color: hex(p.color),
        x: Number(p.x.toFixed(4)),
        y: Number(p.y.toFixed(4)),
      })),
    },
    mark: { type: 'circle', size: 60, opacity: 0.85 },
    encoding: {
      x: {
        field: 'x',
        type: 'quantitative',
        title: 'UMAP 1',
        scale: { zero: false },
      },
      y: {
        field: 'y',
        type: 'quantitative',
        title: 'UMAP 2',
        scale: { zero: false },
      },
      color,
      tooltip: [{ field: 'node' }, { field: 'layer' }, { field: 'group' }],
    },
    params: [{ name: 'zoom', select: 'interval', bind: 'scales' }],
  }
}

export function vegaUmapUrl(
  pts: UmapPoint[],
  title: string,
  colour: UmapColour
): string {
  return `https://vega.github.io/editor/#/url/vega-lite/${lzCompressToEncodedURIComponent(JSON.stringify(vegaUmapSpec(pts, title, colour)))}`
}

// "Topology UMAP (n_neighbors 15, min_dist 0.1, euclidean)"
export function umapTitle(choice: UmapChoice): string {
  const mode = {
    topology: 'Topology',
    attributes: 'Attribute',
    hybrid: 'Hybrid',
  }[choice.mode]
  const balance =
    choice.mode === 'hybrid' ? `, balance ${choice.balance.toFixed(2)}` : ''
  return `${mode} UMAP (n_neighbors ${choice.n_neighbors}, min_dist ${choice.min_dist}, ${choice.metric}${balance}, seed ${choice.seed})`
}
