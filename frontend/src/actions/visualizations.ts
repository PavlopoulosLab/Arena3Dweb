// Export → Visualizations: other views of the same network — a chord (Circos
// style) diagram, an adjacency heatmap and a Sankey diagram as SVG, the
// matrix as CSV, input files for the Circos software, the Sankey for
// SankeyMATIC and Plotly — and one-click hand-offs to web tools: the
// Vega editor (the chart travels in the link), Gephi Lite (the GraphML is
// hosted on this server for an hour, like a NORMA hand-off) and STRING.

import { api } from '../api/client'
import { ctx } from '../three'
import { ExportError, graphmlText, network } from './export'
import { layerSwatchColor } from './legend'

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// node colour / layer colour from the scene, keyed by id / name
function nodeColors(): Map<string, string> {
  return new Map(
    ctx.nodeLayerNames.map((id, i) => [id, ctx.nodeObjects[i].color])
  )
}
// a layer's colour as the legend shows it (its nodes', not its floor's)
function layerColors(): Map<string, string> {
  return new Map(ctx.layers.map((l) => [l.name, layerSwatchColor(l.name)]))
}
const hex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#888888')

// ---------------------------------------------------------------- chord
// Layers as arcs (sized by their node counts), nodes as ticks along them,
// edges as chords: intra-layer ones hug their arc, inter-layer ones cross.
export function chordSvg(): string {
  const net = network()
  const nodeColor = nodeColors()
  const layerColor = layerColors()
  const size = 900
  const cx = size / 2
  const cy = size / 2
  const R = 400 // arc outer radius
  const r = 378 // arc inner radius: chords end here
  const gap = (3 * Math.PI) / 180
  const perLayer = new Map<string, string[]>()
  for (const n of net.nodes) {
    const list = perLayer.get(n.layer) ?? []
    list.push(n.id)
    perLayer.set(n.layer, list)
  }
  const layers = net.layers.filter((l) => perLayer.has(l))
  const N = net.nodes.length
  if (N === 0) throw new ExportError('Load a network first.')
  const free = 2 * Math.PI - gap * layers.length
  const angle = new Map<string, number>()
  const arcs: string[] = []
  const labels: string[] = []
  let a = -Math.PI / 2
  const pt = (rad: number, t: number) => [
    cx + rad * Math.cos(t),
    cy + rad * Math.sin(t),
  ]
  const f = (v: number) => v.toFixed(1)
  for (const layer of layers) {
    const ids = perLayer.get(layer)!
    const span = (free * ids.length) / N
    const a0 = a
    const a1 = a + span
    ids.forEach((id, i) => angle.set(id, a0 + ((i + 0.5) / ids.length) * span))
    const color = hex(layerColor.get(layer) ?? '#888888')
    const [x0, y0] = pt(R, a0)
    const [x1, y1] = pt(R, a1)
    const [x2, y2] = pt(r, a1)
    const [x3, y3] = pt(r, a0)
    const large = span > Math.PI ? 1 : 0
    arcs.push(
      `<path d="M${f(x0)},${f(y0)} A${R},${R} 0 ${large} 1 ${f(x1)},${f(y1)} L${f(x2)},${f(y2)} A${r},${r} 0 ${large} 0 ${f(x3)},${f(y3)} Z" fill="${color}" opacity="0.9"><title>${esc(layer)}: ${ids.length} nodes</title></path>`
    )
    const mid = (a0 + a1) / 2
    const [lx, ly] = pt(R + (N <= 90 ? 70 : 26), mid)
    const deg = (mid * 180) / Math.PI
    const flip = deg > 90 && deg < 270
    labels.push(
      `<text x="${f(lx)}" y="${f(ly)}" transform="rotate(${f(flip ? deg + 180 : deg)} ${f(lx)} ${f(ly)})" text-anchor="middle" font-size="15" font-weight="600" fill="${color}">${esc(layer)}</text>`
    )
    a = a1 + gap
  }
  const chords = net.edges
    .map((e) => {
      const t0 = angle.get(e.src)
      const t1 = angle.get(e.trg)
      if (t0 === undefined || t1 === undefined) return ''
      const [x0, y0] = pt(r, t0)
      const [x1, y1] = pt(r, t1)
      const same = e.source_layer === e.target_layer
      // the control point: the centre for cross-layer chords, pulled toward
      // the arc for chords within a layer
      const tm = (t0 + t1) / 2
      const [qx, qy] = same ? pt(r * 0.55, tm) : [cx, cy]
      const color = hex(layerColor.get(e.source_layer) ?? '#888888')
      const w = 0.4 + 2 * Math.min(1, Math.max(0, e.scaled_weight || e.weight))
      return `<path d="M${f(x0)},${f(y0)} Q${f(qx)},${f(qy)} ${f(x1)},${f(y1)}" fill="none" stroke="${color}" stroke-width="${f(w)}" opacity="${same ? 0.35 : 0.3}"><title>${esc(e.source_node)} (${esc(e.source_layer)}) — ${esc(e.target_node)} (${esc(e.target_layer)})${e.channel ? ', ' + esc(e.channel) : ''}: ${e.weight}</title></path>`
    })
    .join('\n')
  const ticks = net.nodes
    .map((n) => {
      const t = angle.get(n.id)!
      const [x0, y0] = pt(R, t)
      const [x1, y1] = pt(R + 8, t)
      const color = hex(nodeColor.get(n.id) ?? '#555555')
      let label = ''
      if (N <= 90) {
        const [lx, ly] = pt(R + 12, t)
        const deg = (t * 180) / Math.PI
        const flip = deg > 90 && deg < 270
        label = `<text x="${f(lx)}" y="${f(ly)}" transform="rotate(${f(flip ? deg + 180 : deg)} ${f(lx)} ${f(ly)})" text-anchor="${flip ? 'end' : 'start'}" dominant-baseline="middle" font-size="9" fill="#333">${esc(n.label)}</text>`
      }
      return `<line x1="${f(x0)}" y1="${f(y0)}" x2="${f(x1)}" y2="${f(y1)}" stroke="${color}" stroke-width="2"><title>${esc(n.label)} (${esc(n.layer)})</title></line>${label}`
    })
    .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" font-family="system-ui, sans-serif">
<rect width="100%" height="100%" fill="#ffffff"/>
<title>Arena3D chord diagram: ${layers.length} layers, ${N} nodes, ${net.edges.length} edges</title>
<g>${chords}</g>
<g>${arcs.join('\n')}</g>
<g>${ticks}</g>
<g>${labels.join('\n')}</g>
</svg>
`
}

// ---------------------------------------------------------------- heatmap
const HEATMAP_MAX = 400

// Node order (by layer) and the symmetric weight matrix
function matrix(): {
  nodes: { id: string; label: string; layer: string }[]
  weight: Map<string, number>
  max: number
} {
  const net = network()
  const nodes = [...net.nodes].sort(
    (a, b) =>
      net.layers.indexOf(a.layer) - net.layers.indexOf(b.layer) ||
      a.label.localeCompare(b.label)
  )
  const weight = new Map<string, number>()
  let max = 0
  for (const e of net.edges) {
    const w = Math.max(0, e.weight)
    for (const key of [`${e.src}\u0000${e.trg}`, `${e.trg}\u0000${e.src}`])
      weight.set(key, Math.max(weight.get(key) ?? 0, w))
    if (w > max) max = w
  }
  return { nodes, weight, max: max || 1 }
}

export function heatmapSvg(): string {
  const { nodes, weight, max } = matrix()
  const N = nodes.length
  if (N === 0) throw new ExportError('Load a network first.')
  if (N > HEATMAP_MAX)
    throw new ExportError(
      `The heatmap draws up to ${HEATMAP_MAX} nodes (this network has ${N}); export the matrix as CSV instead.`
    )
  const layerColor = layerColors()
  const cell = Math.min(16, Math.max(2, Math.floor(1000 / N)))
  const labels = N <= 120
  const pad = labels ? 110 : 24
  const bar = 10
  const size = pad + bar + 2 + N * cell + 12
  const f = (v: number) => v.toFixed(1)
  const ramp = (t: number) => {
    // light to deep blue
    const a = [247, 251, 255]
    const b = [8, 48, 107]
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`
  }
  const x0 = pad + bar + 2
  const cells: string[] = []
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const w = weight.get(`${nodes[i].id}\u0000${nodes[j].id}`)
      if (!w) continue
      cells.push(
        `<rect x="${f(x0 + j * cell)}" y="${f(x0 + i * cell)}" width="${cell}" height="${cell}" fill="${ramp(w / max)}"><title>${esc(nodes[i].label)} (${esc(nodes[i].layer)}) — ${esc(nodes[j].label)} (${esc(nodes[j].layer)}): ${w}</title></rect>`
      )
    }
  // layer bars and separators
  const bars: string[] = []
  let start = 0
  for (let i = 1; i <= N; i++)
    if (i === N || nodes[i].layer !== nodes[start].layer) {
      const color = hex(layerColor.get(nodes[start].layer) ?? '#888888')
      const from = x0 + start * cell
      const len = (i - start) * cell
      bars.push(
        `<rect x="${f(from)}" y="${pad}" width="${f(len)}" height="${bar}" fill="${color}"><title>${esc(nodes[start].layer)}</title></rect>`,
        `<rect x="${pad}" y="${f(from)}" width="${bar}" height="${f(len)}" fill="${color}"><title>${esc(nodes[start].layer)}</title></rect>`
      )
      if (i < N) {
        const at = f(x0 + i * cell)
        bars.push(
          `<line x1="${at}" y1="${x0}" x2="${at}" y2="${f(x0 + N * cell)}" stroke="#888" stroke-width="0.8"/>`,
          `<line x1="${x0}" y1="${at}" x2="${f(x0 + N * cell)}" y2="${at}" stroke="#888" stroke-width="0.8"/>`
        )
      }
      start = i
    }
  const text = labels
    ? nodes
        .map((n, i) => {
          const c = x0 + (i + 0.5) * cell
          const fs = Math.max(5, Math.min(10, cell * 0.75))
          return `<text x="${f(pad - 4)}" y="${f(c)}" text-anchor="end" dominant-baseline="middle" font-size="${fs}">${esc(n.label)}</text><text x="${f(c)}" y="${f(pad - 4)}" transform="rotate(-90 ${f(c)} ${f(pad - 4)})" dominant-baseline="middle" font-size="${fs}">${esc(n.label)}</text>`
        })
        .join('\n')
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" font-family="system-ui, sans-serif">
<rect width="100%" height="100%" fill="#ffffff"/>
<title>Arena3D adjacency heatmap: ${N} nodes</title>
<rect x="${x0}" y="${x0}" width="${N * cell}" height="${N * cell}" fill="#f4f4f4"/>
<g>${cells.join('\n')}</g>
<g>${bars.join('\n')}</g>
<g>${text}</g>
</svg>
`
}

const MATRIX_MAX = 2000

export function adjacencyCsv(): string {
  const { nodes, weight } = matrix()
  if (nodes.length === 0) throw new ExportError('Load a network first.')
  if (nodes.length > MATRIX_MAX)
    throw new ExportError(`The matrix export holds up to ${MATRIX_MAX} nodes.`)
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`
  const head = ['', ...nodes.map((n) => q(n.id))].join(',')
  const rows = nodes.map((a) =>
    [
      q(a.id),
      ...nodes.map((b) => String(weight.get(`${a.id}\u0000${b.id}`) ?? 0)),
    ].join(',')
  )
  return [head, ...rows].join('\n') + '\n'
}

// ---------------------------------------------------------------- Circos
// Input files for the Circos software: one "chromosome" per layer with a band
// per node, the edges as links, and a configuration that draws them.
export function circosFiles(): Record<string, string> {
  const net = network()
  const layerColor = layerColors()
  if (net.nodes.length === 0) throw new ExportError('Load a network first.')
  const rgb = (h: string) => {
    const c = hex(h)
    return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).join(',')
  }
  const tag = (s: string) => s.replace(/[^A-Za-z0-9_]+/g, '_') || 'x'
  const chr = new Map(net.layers.map((l, i) => [l, `L${i + 1}`]))
  const index = new Map<string, number>() // node id -> position on its chromosome
  const counts = new Map<string, number>()
  for (const n of net.nodes) {
    const k = counts.get(n.layer) ?? 0
    index.set(n.id, k)
    counts.set(n.layer, k + 1)
  }
  const karyotype = [
    ...net.layers.map(
      (l) =>
        `chr - ${chr.get(l)} ${tag(l)} 0 ${counts.get(l) ?? 0} ${rgb(layerColor.get(l) ?? '#888888')}`
    ),
    ...net.nodes.map(
      (n) =>
        `band ${chr.get(n.layer)} ${tag(n.label)} ${tag(n.label)} ${index.get(n.id)} ${index.get(n.id)! + 1} grey`
    ),
  ].join('\n')
  const links = net.edges
    .map((e) => {
      const i = index.get(e.src)
      const j = index.get(e.trg)
      if (i === undefined || j === undefined) return ''
      return `${chr.get(e.source_layer)} ${i} ${i + 1} ${chr.get(e.target_layer)} ${j} ${j + 1} color=${rgb(layerColor.get(e.source_layer) ?? '#888888')},thickness=${(1 + 3 * Math.min(1, e.scaled_weight || e.weight)).toFixed(1)}p`
    })
    .filter(Boolean)
    .join('\n')
  const conf = `# Arena3D network for Circos: circos -conf circos.conf
karyotype = karyotype.txt
chromosomes_units = 1

<ideogram>
<spacing>
default = 0.01r
</spacing>
radius = 0.88r
thickness = 30p
fill = yes
stroke_color = dgrey
stroke_thickness = 1p
show_label = yes
label_font = default
label_radius = 1r + 60p
label_size = 26
label_parallel = yes
show_bands = yes
fill_bands = no
band_stroke_thickness = 1
band_transparency = 4
</ideogram>

<links>
<link>
file = links.txt
radius = 0.98r
bezier_radius = 0.1r
crest = 0.5
thickness = 2p
ribbon = no
</link>
</links>

<image>
<<include etc/image.conf>>
</image>
<<include etc/colors_fonts_patterns.conf>>
<<include etc/housekeeping.conf>>
`
  return {
    'karyotype.txt': karyotype + '\n',
    'links.txt': links + '\n',
    'circos.conf': conf,
    'README.txt':
      'Arena3D network as Circos input. Every layer is a chromosome, every node a band on it, every edge a link.\nRun: circos -conf circos.conf  (http://circos.ca)\n',
  }
}

// ---------------------------------------------------------------- Vega editor
// The Vega editor opens a chart whose specification is LZ-compressed into the
// URL hash (the format of its own share links), so no upload is needed.
const KEY = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$'

// lz-string's compressToEncodedURIComponent (Pieroxy, MIT), ported
export function lzCompressToEncodedURIComponent(input: string): string {
  const bitsPerChar = 6
  const dict = new Map<string, number>()
  const toCreate = new Set<string>()
  let w = ''
  let enlargeIn = 2
  let dictSize = 3
  let numBits = 2
  const out: string[] = []
  let val = 0
  let pos = 0
  const pushBit = (bit: number) => {
    val = (val << 1) | bit
    if (pos === bitsPerChar - 1) {
      pos = 0
      out.push(KEY.charAt(val))
      val = 0
    } else pos++
  }
  const writeBits = (count: number, value: number) => {
    for (let i = 0; i < count; i++) {
      pushBit(value & 1)
      value >>= 1
    }
  }
  const grow = () => {
    enlargeIn--
    if (enlargeIn === 0) {
      enlargeIn = 2 ** numBits
      numBits++
    }
  }
  const emit = (s: string) => {
    if (toCreate.has(s)) {
      const code = s.charCodeAt(0)
      if (code < 256) {
        writeBits(numBits, 0)
        writeBits(8, code)
      } else {
        writeBits(numBits, 1)
        writeBits(16, code)
      }
      grow()
      toCreate.delete(s)
    } else writeBits(numBits, dict.get(s)!)
    grow()
  }
  for (let i = 0; i < input.length; i++) {
    const c = input.charAt(i)
    if (!dict.has(c)) {
      dict.set(c, dictSize++)
      toCreate.add(c)
    }
    const wc = w + c
    if (dict.has(wc)) w = wc
    else {
      emit(w)
      dict.set(wc, dictSize++)
      w = c
    }
  }
  if (w !== '') emit(w)
  writeBits(numBits, 2) // end of stream
  for (;;) {
    val <<= 1
    if (pos === bitsPerChar - 1) {
      out.push(KEY.charAt(val))
      break
    }
    pos++
  }
  return out.join('')
}

const VEGA_MAX_EDGES = 2000

export function vegaHeatmapSpec(): Record<string, unknown> {
  const net = network()
  if (net.nodes.length === 0) throw new ExportError('Load a network first.')
  if (net.edges.length > VEGA_MAX_EDGES)
    throw new ExportError(
      `The Vega editor link holds up to ${VEGA_MAX_EDGES} edges (this network has ${net.edges.length}); export the heatmap SVG or the matrix CSV instead.`
    )
  const name = (label: string, layer: string) =>
    net.layers.length > 1 ? `${label} (${layer})` : label
  const order = [...net.nodes]
    .sort(
      (a, b) =>
        net.layers.indexOf(a.layer) - net.layers.indexOf(b.layer) ||
        a.label.localeCompare(b.label)
    )
    .map((n) => name(n.label, n.layer))
  const values = net.edges.flatMap((e) => {
    const row = {
      weight: e.weight,
      channel: e.channel ?? '',
      layers:
        e.source_layer === e.target_layer
          ? e.source_layer
          : `${e.source_layer} → ${e.target_layer}`,
    }
    const s = name(e.source_node, e.source_layer)
    const t = name(e.target_node, e.target_layer)
    return s === t
      ? [{ source: s, target: t, ...row }]
      : [
          { source: s, target: t, ...row },
          { source: t, target: s, ...row },
        ]
  })
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    title: `Arena3D adjacency heatmap (${net.nodes.length} nodes, ${net.edges.length} edges)`,
    data: { values },
    mark: 'rect',
    width: { step: Math.max(4, Math.min(14, Math.floor(900 / order.length))) },
    height: { step: Math.max(4, Math.min(14, Math.floor(900 / order.length))) },
    encoding: {
      x: {
        field: 'source',
        type: 'nominal',
        sort: order,
        axis: { labelAngle: -90 },
      },
      y: { field: 'target', type: 'nominal', sort: order },
      color: {
        field: 'weight',
        type: 'quantitative',
        scale: { scheme: 'viridis' },
      },
      tooltip: [
        { field: 'source' },
        { field: 'target' },
        { field: 'weight' },
        { field: 'channel' },
        { field: 'layers' },
      ],
    },
    config: { view: { stroke: null }, axis: { labelFontSize: 9 } },
  }
}

export function vegaEditorUrl(): string {
  return `https://vega.github.io/editor/#/url/vega-lite/${lzCompressToEncodedURIComponent(JSON.stringify(vegaHeatmapSpec()))}`
}

// ---------------------------------------------------------------- Gephi Lite
export const GEPHI_LITE = 'https://gephi.org/gephi-lite/'

// Host an export on this server (one hour) and return its absolute URL
export async function hostFile(
  content: string,
  mediaType: string,
  name: string
): Promise<string> {
  const { url } = await api.share(content, mediaType, name)
  return url.startsWith('/') ? `${window.location.origin}${url}` : url
}

export const hostGraphml = (): Promise<string> =>
  hostFile(graphmlText(), 'application/graphml+xml', 'arena3d_network.graphml')

export const gephiLiteUrl = (fileUrl: string): string =>
  `${GEPHI_LITE}?file=${encodeURIComponent(fileUrl)}`

// ---------------------------------------------------------------- STRING
const STRING_MAX = 150

// The STRING website's network page for the selected proteins (or all)
export function stringUrl(species: number): string {
  const net = network()
  const selected = ctx.nodeObjects
    .filter((n) => n.isSelected)
    .map((n) => n.name)
  const names = [
    ...new Set(selected.length ? selected : net.nodes.map((n) => n.label)),
  ]
  if (names.length > STRING_MAX)
    throw new ExportError(
      `STRING's page takes up to ${STRING_MAX} proteins; select fewer nodes (Find, or a lasso) first.`
    )
  return `https://string-db.org/cgi/network?identifiers=${names.map(encodeURIComponent).join('%0d')}&species=${species}&caller_identity=arena3d`
}

// ---------------------------------------------------------------- sankey
// Layers as the columns of a Sankey diagram, left to right in the order of
// the stack; the bands are the nodes, their groups (annotation term or
// cluster) or the layers themselves, and the flows are the inter-layer edges
// with their summed weights. An edge is read from the earlier column to the
// later one; edges within a layer have no column to flow to and stay out.
export type SankeyLevel = 'nodes' | 'groups' | 'layers'
export const SANKEY_LEVELS: [SankeyLevel, string][] = [
  ['nodes', 'per node'],
  ['groups', 'per group'],
  ['layers', 'per layer'],
]
export const SANKEY_MAX_BANDS = 200

export interface SankeyBand {
  key: string
  label: string // unique across the diagram
  column: number
  color: string
  value: number
}
export interface SankeyFlow {
  from: number // band indexes
  to: number
  value: number
}
export interface Sankey {
  level: SankeyLevel
  columns: string[] // layer names, left to right
  bands: SankeyBand[]
  flows: SankeyFlow[]
}

function buildSankey(level: SankeyLevel): Sankey {
  const net = network()
  const nodeColor = nodeColors()
  const layerColor = layerColors()
  const order = ctx.layers.map((l) => l.name)
  for (const l of net.layers) if (!order.includes(l)) order.push(l)
  const column = new Map(order.map((l, i) => [l, i]))
  const indexOf = new Map(ctx.nodeLayerNames.map((id, i) => [id, i]))
  const labelOf = new Map(net.nodes.map((n) => [n.id, n.label]))
  const bands: SankeyBand[] = []
  const bandOf = new Map<string, number>()
  const bandFor = (nodeId: string, layer: string): number => {
    const i = indexOf.get(nodeId)
    const node = i === undefined ? null : ctx.nodeObjects[i]
    let key: string
    let label: string
    let color: string
    if (level === 'layers') {
      key = layer
      label = layer
      color = hex(layerColor.get(layer) ?? '#888888')
    } else if (level === 'groups') {
      const group = node
        ? (node.annotations[0] ?? (node.cluster || 'no group'))
        : 'no group'
      key = `${layer}\u0000${group}`
      label = `${group} (${layer})`
      color = hex(node?.color ?? '#888888')
    } else {
      key = nodeId
      label = `${labelOf.get(nodeId) ?? nodeId} (${layer})`
      color = hex(nodeColor.get(nodeId) ?? '#888888')
    }
    let b = bandOf.get(key)
    if (b === undefined) {
      b = bands.length
      bandOf.set(key, b)
      bands.push({
        key,
        label,
        column: column.get(layer) ?? 0,
        color,
        value: 0,
      })
    }
    return b
  }
  const flowOf = new Map<string, SankeyFlow>()
  for (const e of net.edges) {
    if (e.source_layer === e.target_layer) continue
    let a = bandFor(e.src, e.source_layer)
    let b = bandFor(e.trg, e.target_layer)
    if (bands[a].column > bands[b].column) [a, b] = [b, a]
    if (a === b) continue
    const w = Number(e.weight)
    const value = Number.isFinite(w) && w > 0 ? w : 1
    const key = `${a}\u0000${b}`
    const flow = flowOf.get(key)
    if (flow) flow.value += value
    else flowOf.set(key, { from: a, to: b, value })
  }
  const flows = [...flowOf.values()]
  const inflow = bands.map(() => 0)
  const outflow = bands.map(() => 0)
  for (const f of flows) {
    outflow[f.from] += f.value
    inflow[f.to] += f.value
  }
  bands.forEach((b, i) => (b.value = Math.max(inflow[i], outflow[i])))
  // bands without a flow, and their columns, drop out
  const renumber = new Map<number, number>()
  const kept = bands.filter((b, i) => {
    if (b.value <= 0) return false
    renumber.set(i, renumber.size)
    return true
  })
  const used = [...new Set(kept.map((b) => b.column))].sort((x, y) => x - y)
  const columnIndex = new Map(used.map((c, i) => [c, i]))
  for (const b of kept) b.column = columnIndex.get(b.column)!
  return {
    level,
    columns: used.map((c) => order[c]),
    bands: kept,
    flows: flows.map((f) => ({
      from: renumber.get(f.from)!,
      to: renumber.get(f.to)!,
      value: f.value,
    })),
  }
}

/** The Sankey at the asked level, or a coarser one when that has too many bands. */
export function sankey(level: SankeyLevel): Sankey {
  const levels = SANKEY_LEVELS.map(([l]) => l)
  for (const l of levels.slice(levels.indexOf(level))) {
    const s = buildSankey(l)
    if (s.bands.length <= SANKEY_MAX_BANDS || l === 'layers') {
      if (s.flows.length === 0)
        throw new ExportError(
          'No inter-layer edges: a Sankey needs flows between layers.'
        )
      return s
    }
  }
  throw new ExportError('No inter-layer edges.')
}

const sankeyName = (label: string) =>
  label.replace(/\[/g, '(').replace(/]/g, ')')
const round = (v: number) => Number(v.toFixed(3))

export function sankeySvg(level: SankeyLevel): {
  svg: string
  level: SankeyLevel
} {
  const s = sankey(level)
  const perColumn: number[][] = s.columns.map(() => [])
  s.bands.forEach((b, i) => perColumn[b.column].push(i))
  const tallest = Math.max(...perColumn.map((ids) => ids.length))
  const width = 1100
  const height = Math.max(520, Math.min(1600, 22 * tallest + 140))
  const left = 150
  const right = 150
  const top = 60
  const bottom = 24
  const bandW = 18
  const pad = 8
  const K = s.columns.length
  const plotW = width - left - right
  const plotH = height - top - bottom
  const x = (c: number) =>
    left + (K > 1 ? (c * (plotW - bandW)) / (K - 1) : (plotW - bandW) / 2)
  const scale = Math.min(
    ...perColumn.map(
      (ids) =>
        (plotH - pad * (ids.length - 1)) /
        Math.max(
          1e-9,
          ids.reduce((a, i) => a + s.bands[i].value, 0)
        )
    )
  )
  const y: number[] = []
  const h: number[] = []
  for (const ids of perColumn) {
    const total =
      ids.reduce((a, i) => a + s.bands[i].value * scale, 0) +
      pad * (ids.length - 1)
    let cur = top + (plotH - total) / 2
    for (const i of ids) {
      y[i] = cur
      h[i] = s.bands[i].value * scale
      cur += h[i] + pad
    }
  }
  // where each flow leaves its source band and enters its target band:
  // outgoing flows stacked by the target's height, incoming by the source's
  const flows = s.flows.map((f, i) => ({ ...f, i }))
  const outOff = s.bands.map(() => 0)
  const inOff = s.bands.map(() => 0)
  const start: number[] = []
  const end: number[] = []
  for (const f of [...flows].sort((a, b) => y[a.to] - y[b.to] || a.i - b.i)) {
    start[f.i] = y[f.from] + outOff[f.from]
    outOff[f.from] += f.value * scale
  }
  for (const f of [...flows].sort(
    (a, b) => y[a.from] - y[b.from] || a.i - b.i
  )) {
    end[f.i] = y[f.to] + inOff[f.to]
    inOff[f.to] += f.value * scale
  }
  const fx = (v: number) => v.toFixed(1)
  const ribbons = flows
    .map((f) => {
      const from = s.bands[f.from]
      const to = s.bands[f.to]
      const x0 = x(from.column) + bandW
      const x1 = x(to.column)
      const xm = (x0 + x1) / 2
      const fh = Math.max(0.5, f.value * scale)
      const a = start[f.i]
      const b = end[f.i]
      return `<path d="M${fx(x0)},${fx(a)} C${fx(xm)},${fx(a)} ${fx(xm)},${fx(b)} ${fx(x1)},${fx(b)} L${fx(x1)},${fx(b + fh)} C${fx(xm)},${fx(b + fh)} ${fx(xm)},${fx(a + fh)} ${fx(x0)},${fx(a + fh)} Z" fill="${from.color}" opacity="0.45"><title>${esc(from.label)} → ${esc(to.label)}: ${round(f.value)}</title></path>`
    })
    .join('\n')
  const rects = s.bands
    .map((b, i) => {
      const bx = x(b.column)
      const leftHalf = b.column < K / 2
      const lx = leftHalf ? bx + bandW + 6 : bx - 6
      const shown = b.label.length > 28 ? b.label.slice(0, 27) + '…' : b.label
      return `<g><rect x="${fx(bx)}" y="${fx(y[i])}" width="${bandW}" height="${fx(Math.max(1, h[i]))}" fill="${b.color}" stroke="#333" stroke-width="0.5"><title>${esc(b.label)}: ${round(b.value)}</title></rect><text x="${fx(lx)}" y="${fx(y[i] + h[i] / 2 + 3.5)}" text-anchor="${leftHalf ? 'start' : 'end'}" font-size="10" fill="#222"><title>${esc(b.label)}</title>${esc(shown)}</text></g>`
    })
    .join('\n')
  const layerColor = layerColors()
  const titles = s.columns
    .map(
      (name, c) =>
        `<text x="${fx(x(c) + bandW / 2)}" y="${top - 22}" text-anchor="middle" font-size="14" font-weight="600" fill="${hex(layerColor.get(name) ?? '#333333')}">${esc(name)}</text>`
    )
    .join('\n')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, sans-serif">
<rect width="100%" height="100%" fill="#ffffff"/>
<title>Arena3D Sankey diagram (${s.level}): ${s.columns.length} layers, ${s.bands.length} bands, ${s.flows.length} flows</title>
<g>${ribbons}</g>
<g>${rects}</g>
<g>${titles}</g>
</svg>
`
  return { svg, level: s.level }
}

// SankeyMATIC (sankeymatic.com/build): one "Source [amount] Target" line per
// flow, then the band colours.
export function sankeyMaticText(level: SankeyLevel): {
  text: string
  level: SankeyLevel
} {
  const s = sankey(level)
  const lines = [
    `// Arena3D Sankey (${s.level}): ${s.columns.join(' → ')}`,
    '// Paste into sankeymatic.com/build — Source [amount] Target',
    ...s.flows.map(
      (f) =>
        `${sankeyName(s.bands[f.from].label)} [${round(f.value)}] ${sankeyName(s.bands[f.to].label)}`
    ),
    '',
    '// band colours',
    ...s.bands.map((b) => `:${sankeyName(b.label)} ${b.color}`),
  ]
  return { text: lines.join('\n') + '\n', level: s.level }
}

// A Plotly figure (plotly.js, Python plotly.io.read_json, Chart Studio).
export function sankeyPlotlyJson(level: SankeyLevel): {
  json: string
  level: SankeyLevel
} {
  const s = sankey(level)
  const rgba = (c: string, a: number) =>
    `rgba(${parseInt(c.slice(1, 3), 16)}, ${parseInt(c.slice(3, 5), 16)}, ${parseInt(c.slice(5, 7), 16)}, ${a})`
  const figure = {
    data: [
      {
        type: 'sankey',
        orientation: 'h',
        arrangement: 'snap',
        node: {
          label: s.bands.map((b) => b.label),
          color: s.bands.map((b) => b.color),
          customdata: s.bands.map((b) => s.columns[b.column]),
          hovertemplate:
            '%{label}<br>layer %{customdata}<br>%{value}<extra></extra>',
          pad: 12,
          thickness: 18,
          line: { color: '#333333', width: 0.5 },
        },
        link: {
          source: s.flows.map((f) => f.from),
          target: s.flows.map((f) => f.to),
          value: s.flows.map((f) => round(f.value)),
          color: s.flows.map((f) => rgba(s.bands[f.from].color, 0.45)),
        },
      },
    ],
    layout: {
      title: { text: `Arena3D Sankey (${s.level}): ${s.columns.join(' → ')}` },
      font: { size: 11 },
    },
  }
  return { json: JSON.stringify(figure, null, 1), level: s.level }
}
