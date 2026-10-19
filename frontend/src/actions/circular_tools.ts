// Export → Visualizations: interactive Circos alternatives — Gosling.js,
// NGCircos.js, CircosJS and the JBrowse 2 circular view. One ring model feeds
// all four: the layers ticked in Layer selection (all if none) as segments
// ("chromosomes") sized by their node counts, every node a two-unit slot along
// its layer, and the edges between those nodes whose channel is ticked for
// layouts and shown in the scene. Node, layer and edge colours are the
// scene's. Arena3D only writes JSON and HTML text: the pages load their
// library from a CDN at a pinned version, and the web tools read the files
// hosted on this server for an hour (POST /api/share), as for Gephi Lite.

import { store } from '../store'
import { ctx } from '../three'
import { ExportError, network } from './export'
import { layerSwatchColor } from './legend'
import { valueTable } from './values'
import { hostFile } from './visualizations'

export interface RingNode {
  id: string // Node_Layer
  label: string
  layer: string
  slot: number // its place along the layer, from 0
  color: string
  degree: number // edges exported, a self-loop counting twice
  value: number | null // the ring track's measure: degree or a Values column
}
export interface RingLayer {
  name: string
  color: string
  nodes: RingNode[]
}
export interface RingEdge {
  source: RingNode
  target: RingNode
  channel: string | null
  weight: number
  color: string
}
export interface Ring {
  layers: RingLayer[]
  edges: RingEdge[]
  measure: string // what RingNode.value holds
}

export const RING_MAX_EDGES = 20000
export const RING_WARN_EDGES = 3000 // the pages draw slowly beyond this

// every user-controlled name that a tool shows through innerHTML (Gosling,
// NGCircos and CircosJS tooltips) is escaped
export const html = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
const hex = (c: string | undefined) =>
  c && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : '#888888'

/**
 * The network as a ring. `channels`: the channels ticked for layouts (null:
 * no channel boxes, so all); `column`: a File → Values column for the ring
 * track (default: node degree).
 */
export function ringNetwork(
  channels: string[] | null,
  column: string | null = null
): Ring {
  const net = network()
  const picked = store.get().selectedLayers
  const keep = new Set(picked.length ? picked : net.layers)
  const nodeColor = new Map(
    ctx.nodeLayerNames.map((id, i) => [id, ctx.nodeObjects[i].color])
  )
  const table = column ? valueTable() : null
  const at = table && column ? table.columns.indexOf(column) : -1
  const valueOf = new Map(
    table && at >= 0 ? table.rows.map((r) => [r.node, r.values[at]]) : []
  )
  const layers: RingLayer[] = net.layers
    .filter((l) => keep.has(l))
    .map((name) => ({ name, color: hex(layerSwatchColor(name)), nodes: [] }))
  const layerOf = new Map(layers.map((l) => [l.name, l]))
  const nodeOf = new Map<string, RingNode>()
  for (const n of net.nodes) {
    const layer = layerOf.get(n.layer)
    if (!layer) continue
    const node: RingNode = {
      id: n.id,
      label: n.label,
      layer: n.layer,
      slot: layer.nodes.length,
      color: hex(nodeColor.get(n.id)),
      degree: 0,
      value: null,
    }
    layer.nodes.push(node)
    nodeOf.set(n.id, node)
  }
  // the scene's edges (one per node pair) know each channel's colour
  const drawn = new Map(ctx.edgeObjects.map((e) => [e.name, e]))
  const shown = (c: string | null) =>
    c === null ||
    ((!channels || channels.includes(c)) && ctx.channelVisibility[c] !== false)
  const edges: RingEdge[] = []
  for (const e of net.edges) {
    const source = nodeOf.get(e.src)
    const target = nodeOf.get(e.trg)
    if (!source || !target || !shown(e.channel)) continue
    const obj = drawn.get(`${e.src}---${e.trg}`)
    const k = obj && e.channel !== null ? obj.channels.indexOf(e.channel) : 0
    edges.push({
      source,
      target,
      channel: e.channel,
      weight: e.weight,
      color: hex(obj ? obj.decideColor(Math.max(0, k), true) : undefined),
    })
    source.degree++
    target.degree++
  }
  const kept = layers.filter((l) => l.nodes.length)
  if (!kept.length)
    throw new ExportError('The layers ticked in Layer selection have no nodes.')
  if (edges.length > RING_MAX_EDGES)
    throw new ExportError(
      `The circular views take up to ${RING_MAX_EDGES.toLocaleString('en')} edges (${edges.length.toLocaleString('en')} here); tick fewer layers or channels.`
    )
  for (const l of kept)
    for (const n of l.nodes)
      n.value = column ? (valueOf.get(n.label) ?? null) : n.degree
  return { layers: kept, edges, measure: column ?? 'degree' }
}

export const ringSize = (r: Ring): string =>
  `${r.layers.length} layer${r.layers.length === 1 ? '' : 's'}, ${r.layers.reduce((a, l) => a + l.nodes.length, 0)} nodes, ${r.edges.length} edges`

/** A note for the status line when a ring is large for an interactive page. */
export const ringWarning = (r: Ring): string =>
  r.edges.length > RING_WARN_EDGES
    ? ` — ${r.edges.length.toLocaleString('en')} edges: the view may be slow; tick fewer layers or channels for a lighter one`
    : ''

// a channel legend when every edge of a channel has the channel's colour
// (the scene's channel palette), else null (colours from an edge file)
function channelColors(r: Ring): Map<string, string> | null {
  const out = new Map<string, string>()
  for (const e of r.edges) {
    if (e.channel === null) return null
    const c = out.get(e.channel)
    if (c && c !== e.color) return null
    out.set(e.channel, e.color)
  }
  return out.size ? out : null
}

// two units per node: a node fills [2·slot, 2·slot + 2], an edge ends at its
// middle
const UNIT = 2
const start = (n: RingNode) => UNIT * n.slot
const mid = (n: RingNode) => UNIT * n.slot + UNIT / 2
const span = (l: RingLayer) => UNIT * l.nodes.length
const uniq = (xs: string[]) => [...new Set(xs)]

// ---------------------------------------------------------------- Gosling
// Gosling.js grammar (https://gosling-lang.org/docs/): a custom assembly of
// [chromosome, length] pairs (docs/genome-builds), JSON or CSV data with
// chromosomeField/genomicFields — genomicFieldsToConvert for rows with two
// chromosomes — and `withinLink` marks between x and xe (docs/mark). Rows past
// `sampleLength` (default 1000) are sampled away, so it is set to the count.
// Tooltips are HTML, so they show escaped copies of the names (*_name,
// node, source, target); axis labels and legends are text, so the chromosome
// names and colour domains keep the plain names.
export const GOSLING_EDITOR = 'https://gosling.js.org/'

// plain names lose tabs and line breaks (Gosling writes a chrom-sizes table)
const field = (s: string) => s.replace(/[\t\r\n]+/g, ' ').trim() || '_'

export function goslingRows(r: Ring) {
  const named = (n: RingNode) => `${html(n.label)} (${html(n.layer)})`
  const nodes = r.layers.flatMap((l) =>
    l.nodes.map((n) => ({
      layer: field(n.layer),
      start: start(n),
      end: start(n) + UNIT,
      node: html(n.label),
      layer_name: html(n.layer),
      degree: n.degree,
      color: n.color,
    }))
  )
  const edges = r.edges.map((e) => ({
    source_layer: field(e.source.layer),
    source_pos: mid(e.source),
    target_layer: field(e.target.layer),
    target_pos: mid(e.target),
    source: named(e.source),
    target: named(e.target),
    channel: field(e.channel ?? ''),
    channel_name: html(e.channel ?? ''),
    weight: e.weight,
    color: e.color,
    kind: e.source.layer === e.target.layer ? 'within' : 'between',
  }))
  return { nodes, edges }
}

const csvCell = (v: string | number) => {
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csvOf = (header: string[], rows: Record<string, string | number>[]) =>
  [header, ...rows.map((r) => header.map((h) => r[h]))]
    .map((r) => r.map(csvCell).join(','))
    .join('\n') + '\n'

/** The node and edge rows as CSV, for hosting (Open in Gosling Editor). */
export function goslingCsv(r: Ring): { nodes: string; edges: string } {
  const { nodes, edges } = goslingRows(r)
  return {
    nodes: csvOf(
      ['layer', 'start', 'end', 'node', 'layer_name', 'degree', 'color'],
      nodes
    ),
    edges: csvOf(
      [
        'source_layer',
        'source_pos',
        'target_layer',
        'target_pos',
        'source',
        'target',
        'channel',
        'channel_name',
        'weight',
        'color',
        'kind',
      ],
      edges
    ),
  }
}

/**
 * A circular Gosling spec: layers ring, nodes ring, degree bars and the
 * edges inside — arcs within a layer and links between layers, as two
 * overlaid link tracks. With `hosted` (CSV URLs) the data is read by link,
 * otherwise it travels inside the spec.
 */
export function goslingSpec(
  r: Ring,
  hosted?: { nodes: string; edges: string }
): Record<string, unknown> {
  const rows = goslingRows(r)
  const W = 720
  const sample = (n: number) => Math.max(1000, n)
  const nodeData = hosted
    ? { type: 'csv', url: hosted.nodes }
    : { type: 'json', values: rows.nodes }
  const edgeData = hosted
    ? { type: 'csv', url: hosted.edges }
    : { type: 'json', values: rows.edges }
  const genomic = { type: 'genomic' }
  const byValue = (field: string, values: string[]) => ({
    field,
    type: 'nominal',
    domain: values,
    range: values,
    legend: false,
  })
  const channels = channelColors(r)
  const stroke = channels
    ? {
        field: 'channel',
        type: 'nominal',
        domain: [...channels.keys()].map(field),
        range: [...channels.values()],
        legend: true,
        title: 'Channel',
      }
    : byValue('color', uniq(r.edges.map((e) => e.color)))
  const nodeColor = byValue('color', uniq(rows.nodes.map((n) => n.color)))
  const nodeTooltip = [
    { field: 'node', type: 'nominal', alt: 'Node' },
    { field: 'layer_name', type: 'nominal', alt: 'Layer' },
    { field: 'degree', type: 'quantitative', alt: 'Degree' },
  ]
  return {
    title: 'Arena3D network',
    subtitle: ringSize(r),
    assembly: r.layers.map((l) => [field(l.name), span(l)]),
    layout: 'circular',
    static: false,
    centerRadius: 0.3,
    spacing: 1,
    alignment: 'stack',
    tracks: [
      {
        id: 'layers',
        title: '',
        data: {
          type: 'json',
          values: r.layers.map((l) => ({
            layer: field(l.name),
            layer_name: html(l.name),
            start: 0,
            end: span(l),
            nodes: l.nodes.length,
          })),
          chromosomeField: 'layer',
          genomicFields: ['start', 'end'],
        },
        mark: 'rect',
        x: { field: 'start', type: 'genomic', axis: 'top' },
        xe: { field: 'end', ...genomic },
        color: {
          field: 'layer',
          type: 'nominal',
          domain: r.layers.map((l) => field(l.name)),
          range: r.layers.map((l) => l.color),
          legend: true,
          title: 'Layer',
        },
        stroke: { value: 'white' },
        strokeWidth: { value: 1 },
        tooltip: [
          { field: 'layer_name', type: 'nominal', alt: 'Layer' },
          { field: 'nodes', type: 'quantitative', alt: 'Nodes' },
        ],
        width: W,
        height: 22,
      },
      {
        id: 'nodes',
        title: '',
        data: {
          ...nodeData,
          chromosomeField: 'layer',
          genomicFields: ['start', 'end'],
          sampleLength: sample(rows.nodes.length),
        },
        mark: 'rect',
        x: { field: 'start', ...genomic },
        xe: { field: 'end', ...genomic },
        color: nodeColor,
        stroke: { value: 'white' },
        strokeWidth: { value: 0.3 },
        tooltip: nodeTooltip,
        width: W,
        height: 16,
      },
      {
        id: 'degree',
        title: '',
        data: {
          ...nodeData,
          chromosomeField: 'layer',
          genomicFields: ['start', 'end'],
          sampleLength: sample(rows.nodes.length),
        },
        mark: 'bar',
        x: { field: 'start', ...genomic },
        xe: { field: 'end', ...genomic },
        y: { field: 'degree', type: 'quantitative', axis: 'none' },
        color: nodeColor,
        tooltip: nodeTooltip,
        width: W,
        height: 36,
      },
      {
        id: 'edges',
        title: '',
        alignment: 'overlay',
        data: {
          ...edgeData,
          genomicFieldsToConvert: [
            { chromosomeField: 'source_layer', genomicFields: ['source_pos'] },
            { chromosomeField: 'target_layer', genomicFields: ['target_pos'] },
          ],
          sampleLength: sample(rows.edges.length),
        },
        mark: 'withinLink',
        x: { field: 'source_pos', ...genomic },
        xe: { field: 'target_pos', ...genomic },
        stroke,
        strokeWidth: { value: 1 },
        tooltip: [
          { field: 'source', type: 'nominal', alt: 'Source' },
          { field: 'target', type: 'nominal', alt: 'Target' },
          ...(channels
            ? [{ field: 'channel_name', type: 'nominal', alt: 'Channel' }]
            : []),
          { field: 'weight', type: 'quantitative', alt: 'Weight' },
        ],
        tracks: [
          {
            dataTransform: [
              { type: 'filter', field: 'kind', oneOf: ['within'] },
            ],
            opacity: { value: 0.6 },
          },
          {
            dataTransform: [
              { type: 'filter', field: 'kind', oneOf: ['between'] },
            ],
            opacity: { value: 0.35 },
          },
        ],
        width: W,
        height: 260,
      },
    ],
  }
}

// JSONCrush (Frank Force, MIT; jsoncrush 1.1.8, which the Gosling editor
// reads its ?spec= parameter with): only its reversible character swap, so
// the result is a valid uncompressed JSONCrush string — the data is hosted,
// and the spec left in the link is short.
export function jsonCrushSwap(s: string, forward = true): string {
  const groups = [
    ['"', "'"],
    ["':", '!'],
    [",'", '~'],
    ['}', ')', '\\', '\\'],
    ['{', '(', '\\', '\\'],
  ]
  const swap = (t: string, g: string[]) =>
    t.replace(
      new RegExp(`${(g[2] ?? '') + g[0]}|${(g[3] ?? '') + g[1]}`, 'g'),
      (m) => (m === g[0] ? g[1] : g[0])
    )
  return (forward ? groups : [...groups].reverse()).reduce(swap, s)
}

export const goslingEditorUrl = (spec: Record<string, unknown>): string =>
  `${GOSLING_EDITOR}?spec=${encodeURIComponent(jsonCrushSwap(JSON.stringify(spec).replace(/\u0001/g, '')) + '_')}`

/** Host the node and edge tables, then the editor link with a spec that reads them. */
export async function goslingEditorLink(r: Ring): Promise<string> {
  const csv = goslingCsv(r)
  const [nodes, edges] = await Promise.all([
    hostFile(csv.nodes, 'text/csv', 'arena3d_gosling_nodes.csv'),
    hostFile(csv.edges, 'text/csv', 'arena3d_gosling_edges.csv'),
  ])
  return goslingEditorUrl(goslingSpec(r, { nodes, edges }))
}

// --------------------------------------------- the pages' shared parts
export type RingTrack = 'histogram' | 'heatmap' | 'none'

// pale edges (those of a dark scene theme) are drawn on a dark page
const luminance = (c: string) =>
  [1, 3, 5]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0)
export const darkPage = (r: Ring): boolean =>
  r.edges.length > 0 &&
  r.edges.reduce((a, e) => a + luminance(e.color), 0) / r.edges.length > 0.7

// JSON inside <script type="application/json">: "<" escaped so no name can
// close the element
const scriptJson = (v: unknown) =>
  JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')

function page(
  title: string,
  r: Ring,
  scripts: string[],
  data: unknown,
  body: string,
  style = ''
): string {
  const [bg, fg, muted] = darkPage(r)
    ? ['#16181d', '#e8e8e8', '#a8adb5']
    : ['#ffffff', '#222222', '#555555']
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html(title)}</title>
<style>
body { font-family: system-ui, sans-serif; margin: 16px; color: ${fg}; background: ${bg}; }
h1 { font-size: 18px; margin: 0 0 4px; }
p { margin: 0 0 8px; color: ${muted}; font-size: 13px; }
#chart svg { max-width: 100%; height: auto; }
.circos-tooltip, div[class^="NGCircos"][class$="Tooltip"] { position: absolute; pointer-events: none; padding: 4px 8px; border-radius: 4px; background: #fff; color: #222; font-size: 12px; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3); }
${style}</style>
${scripts.map((s) => `<script src="${s}"></script>`).join('\n')}
</head>
<body>
<h1>${html(title)}</h1>
<p>${html(ringSize(r))} — exported from Arena3D. Hover a ribbon or a block for its names.</p>
<div id="chart"></div>
<script type="application/json" id="arena3d-data">${scriptJson(data)}</script>
<script>
var data = JSON.parse(document.getElementById('arena3d-data').textContent);
${body}
</script>
</body>
</html>
`
}

// ---------------------------------------------------------------- NGCircos
// NGCircos.js 1.1.0 (Cui et al., NG-Circos, Bioinformatics 2020), as shipped
// in the interacCircos R package (https://github.com/mrcuizhe/interacCircos,
// inst/htmlwidgets/lib — the source read for this format): new NGCircos(
// ...modules, [genome], settings) with genome = [[chr, length], …] and each
// module [NAME, config, data] — ARC rows {chr, start, end, color, html},
// LINK rows {fusion, g1chr, g1start, g1end, g1name, g2chr, …, html} (one
// colour per LINK module, so one module per edge colour), HEATMAP and
// HISTOGRAM rows {chr, start, end, name, value, html}. Its tooltips are HTML
// (chr, name and fusion included), so every name is escaped.
export const NGCIRCOS_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/d3@3.3.10/d3.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js',
  'https://cdn.jsdelivr.net/gh/mrcuizhe/interacCircos@v1.2.0/inst/htmlwidgets/lib/NGCircos.js',
]

export interface NgcircosInput {
  genome: [string, number][][]
  modules: [string, Record<string, unknown>, Record<string, unknown>[]][]
  settings: Record<string, unknown>
}

export function ngcircosInput(r: Ring, track: RingTrack): NgcircosInput {
  const size = 900
  const outer = 380 // the layers ring
  const inner = 360
  const chr = (n: RingNode) => html(n.layer)
  const name = (n: RingNode) => `${html(n.label)} (${html(n.layer)})`
  const modules: NgcircosInput['modules'] = [
    [
      'ARC01',
      { innerRadius: inner - 14, outerRadius: inner - 4, ARCOpacity: 1 },
      r.layers.flatMap((l) =>
        l.nodes.map((n) => ({
          chr: chr(n),
          start: start(n),
          end: start(n) + UNIT,
          color: n.color,
          des: html(n.label),
          html: `${name(n)}<br>degree ${n.degree}`,
        }))
      ),
    ],
  ]
  const valued = r.layers.flatMap((l) =>
    l.nodes.filter((n) => n.value !== null)
  )
  const values = valued.map((n) => ({
    chr: chr(n),
    start: start(n),
    end: start(n) + UNIT,
    name: html(n.label),
    value: n.value,
    html: `${name(n)}<br>${html(r.measure)} ${n.value}`,
  }))
  const hasTrack = track !== 'none' && values.length > 0
  const ring = { in: inner - 50, out: inner - 20 }
  if (hasTrack && track === 'heatmap')
    modules.push([
      'HEATMAP01',
      {
        innerRadius: ring.in,
        outerRadius: ring.out,
        minColor: '#fff7bc',
        maxColor: '#d7301f',
        totalLayer: 1,
      },
      values,
    ])
  if (hasTrack && track === 'histogram')
    modules.push([
      'HISTOGRAM01',
      {
        minRadius: ring.in,
        maxRadius: ring.out,
        histogramFillColor: '#6c757d',
      },
      values,
    ])
  const byColor = new Map<string, RingEdge[]>()
  for (const e of r.edges)
    byColor.set(e.color, [...(byColor.get(e.color) ?? []), e])
  let i = 0
  for (const [color, edges] of byColor)
    modules.push([
      `LINK${String(++i).padStart(2, '0')}`,
      {
        LinkRadius: (hasTrack ? ring.in : inner - 14) - 6,
        LinkFillColor: color,
        LinkWidth: 1,
        LinkType: 'Q',
        displayLinkAxis: false,
        displayLinkLabel: false,
      },
      edges.map((e) => ({
        fusion: `${name(e.source)} – ${name(e.target)}`,
        g1chr: chr(e.source),
        g1start: start(e.source),
        g1end: start(e.source) + UNIT,
        g1name: html(e.source.label),
        g2chr: chr(e.target),
        g2start: start(e.target),
        g2end: start(e.target) + UNIT,
        g2name: html(e.target.label),
        html: `${name(e.source)} – ${name(e.target)}${e.channel !== null ? `<br>${html(e.channel)}` : ''}<br>weight ${e.weight}`,
      })),
    ])
  const tip = (m: string) => ({
    [`${m}MouseEvent`]: true,
    [`${m}MouseOverDisplay`]: true,
    [`${m}MouseOverTooltipsSetting`]: 'custom',
    [`${m}MouseOverTooltipsHtml`]: '',
  })
  return {
    genome: [r.layers.map((l) => [html(l.name), span(l)])],
    modules,
    settings: {
      target: 'chart',
      svgWidth: size,
      svgHeight: size,
      chrPad: r.layers.length > 1 ? 0.03 : 0,
      innerRadius: inner,
      outerRadius: outer,
      zoom: true,
      genomeFillColor: r.layers.map((l) => l.color),
      genomeBorder: {
        display: true,
        borderColor: darkPage(r) ? '#16181d' : '#ffffff',
        borderSize: 1,
      },
      ticks: {
        display: false,
        len: 5,
        color: '#000',
        textSize: 10,
        textColor: '#000',
        scale: 1,
        realLength: false,
        offset: 0,
      },
      genomeLabel: {
        display: true,
        textSize: 14,
        textColor: darkPage(r) ? '#e8e8e8' : '#222222',
        dx: 0.03,
        dy: '-0.55em',
      },
      ...tip('ARC'),
      ...tip('LINK'),
      ...tip('HEATMAP'),
      ...tip('HISTOGRAM'),
      LINKMouseOverStrokeColor: '#222',
    },
  }
}

export function ngcircosHtml(r: Ring, track: RingTrack): string {
  return page(
    'Arena3D network — NGCircos',
    r,
    NGCIRCOS_SCRIPTS,
    {
      ...ngcircosInput(r, track),
      names: Object.fromEntries(r.layers.map((l) => [html(l.name), l.name])),
    },
    `var c = new NGCircos(...data.modules, data.genome, data.settings);
c.draw_genome(c.genomeLength);
// the layer labels are drawn as text: show their names unescaped
document.querySelectorAll('#chart text').forEach(function (t) {
  if (data.names.hasOwnProperty(t.textContent)) t.textContent = data.names[t.textContent];
});`,
    'path.NGCircosLINK { stroke-opacity: 0.45; }\n'
  )
}

// ---------------------------------------------------------------- CircosJS
// CircosJS 2.1.0 (https://github.com/nicgirault/circosJS, readme): new
// Circos({container, width, height}).layout([{id, len, color, label}], conf)
// then tracks by id — highlight and heatmap/histogram rows {block_id, start,
// end, value}, chords {source: {id, start, end}, target: {…}} — and
// .render(). dist/circos.min.js bundles its d3 modules. Layout ids are plain
// L1, L2… (they become element ids); tooltips are HTML, so the page escapes
// the names it shows.
export const CIRCOSJS_SCRIPT =
  'https://cdn.jsdelivr.net/npm/circos@2.1.0/dist/circos.min.js'

export function circosjsData(r: Ring, track: RingTrack) {
  const id = new Map(r.layers.map((l, i) => [l.name, `L${i + 1}`]))
  const block = (n: RingNode) => id.get(n.layer)!
  const layout = r.layers.map((l) => ({
    id: id.get(l.name)!,
    label: l.name,
    color: l.color,
    len: span(l),
  }))
  const nodes = r.layers.flatMap((l) =>
    l.nodes.map((n) => ({
      block_id: block(n),
      start: start(n),
      end: start(n) + UNIT,
      color: n.color,
      name: n.label,
      layer: n.layer,
      degree: n.degree,
    }))
  )
  const values = r.layers.flatMap((l) =>
    l.nodes
      .filter((n) => n.value !== null)
      .map((n) => ({
        block_id: block(n),
        start: start(n),
        end: start(n) + UNIT,
        value: n.value,
        color: n.color,
        name: n.label,
      }))
  )
  const end = (n: RingNode) => ({
    id: block(n),
    start: start(n) + 0.3,
    end: start(n) + UNIT - 0.3,
    name: n.label,
    layer: n.layer,
  })
  const chords = r.edges.map((e) => ({
    source: end(e.source),
    target: end(e.target),
    color: e.color,
    channel: e.channel,
    weight: e.weight,
  }))
  return {
    size: 900,
    gap: r.layers.length > 1 ? 0.03 : 0,
    labelColor: darkPage(r) ? '#e8e8e8' : '#222222',
    layout,
    nodes,
    track:
      track !== 'none' && values.length
        ? { type: track, measure: r.measure, values }
        : null,
    chords,
  }
}

export function circosjsHtml(r: Ring, track: RingTrack): string {
  return page(
    'Arena3D network — CircosJS',
    r,
    [CIRCOSJS_SCRIPT],
    circosjsData(r, track),
    `function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
var R = data.size / 2 - 90;
var c = new Circos({ container: '#chart', width: data.size, height: data.size });
c.layout(data.layout, {
  innerRadius: R - 22, outerRadius: R, gap: data.gap, cornerRadius: 0,
  labels: { display: true, position: 'center', size: 14, color: data.labelColor, radialOffset: 34 },
  ticks: { display: false }
});
c.highlight('nodes', data.nodes, {
  innerRadius: 0.93, outerRadius: 0.99, color: function (d) { return d.color; },
  tooltipContent: function (d) { return esc(d.name) + ' (' + esc(d.layer) + ')<br>degree ' + d.degree; }
});
if (data.track) {
  c[data.track.type]('ring-track', data.track.values, {
    innerRadius: 0.8, outerRadius: 0.91,
    color: data.track.type === 'heatmap' ? 'YlOrRd' : function (d) { return d.color; },
    tooltipContent: function (d) { return esc(d.name) + '<br>' + esc(data.track.measure) + ' ' + d.value; }
  });
}
c.chords('edges', data.chords, {
  radius: data.track ? 0.79 : 0.92, opacity: 0.5,
  color: function (d) { return d.color; },
  tooltipContent: function (d) {
    return esc(d.source.name) + ' (' + esc(d.source.layer) + ') – ' + esc(d.target.name) + ' (' + esc(d.target.layer) + ')' +
      (d.channel !== null ? '<br>' + esc(d.channel) : '') + '<br>weight ' + d.weight;
  }
});
c.render();`
  )
}

// ---------------------------------------------------------------- JBrowse 2
// JBrowse 2 (https://jbrowse.org/jb2/docs/) reads genomes, not networks, so
// the mapping is a stand-in: an assembly with one reference sequence per layer
// (FromConfigSequenceAdapter, 2 bp of N per node, in order) and the edges as
// VCF breakends, one SVTYPE=BND record per edge whose ALT N[layer:pos[ points
// at the other node — what the Circular View draws as chords
// (docs/user_guides/circular_view; VariantTrack → ChordVariantDisplay, each
// chord coloured by its INFO COLOR through the StructuralVariantChordRenderer's
// strokeColor jexl). JBrowse Web opens it by ?config=<url>&session=spec-{
// "views":[{"type":"CircularView",…}]} (docs/urlparams). Checked against the
// v4.3.0 sources (VcfAdapter, Chord.tsx) and @gmod/vcf (parseBreakend splits
// the mate at ":", INFO values are percent-decoded).
export const JBROWSE_WEB = 'https://jbrowse.org/code/jb2/v4.3.0/'
export const JBROWSE_ASSEMBLY = 'arena3d'
export const JBROWSE_TRACK = 'arena3d_edges'

// Sequence names in the characters a VCF contig ID allows, without ":" (the
// breakend's separator) and "#" (a header line), and unique
export function jbrowseRefNames(r: Ring): Map<string, string> {
  const out = new Map<string, string>()
  const taken = new Set<string>()
  for (const l of r.layers) {
    const base = l.name.replace(/[^0-9A-Za-z!$%&+./?@^_|~-]/g, '_') || '_'
    let name = base
    for (let k = 2; taken.has(name); k++) name = `${base}_${k}`
    taken.add(name)
    out.set(l.name, name)
  }
  return out
}

// VCF 4.3 percent-encoding for INFO values
const info = (s: string) =>
  s.replace(
    /[%;=,:\t\r\n ]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`
  )

export function jbrowseVcf(r: Ring): string {
  const ref = jbrowseRefNames(r)
  const pos = (n: RingNode) => mid(n) + 1 // VCF is 1-based
  const named = (n: RingNode) => info(`${n.label} (${n.layer})`)
  const head = [
    '##fileformat=VCFv4.3',
    '##source=Arena3D',
    '##INFO=<ID=SVTYPE,Number=1,Type=String,Description="Type of structural variant: BND, one record per network edge">',
    '##INFO=<ID=SOURCE,Number=1,Type=String,Description="Source node (layer)">',
    '##INFO=<ID=TARGET,Number=1,Type=String,Description="Target node (layer)">',
    '##INFO=<ID=CHANNEL,Number=1,Type=String,Description="Edge channel">',
    '##INFO=<ID=WEIGHT,Number=1,Type=Float,Description="Edge weight">',
    '##INFO=<ID=COLOR,Number=1,Type=String,Description="Edge colour in Arena3D">',
    ...r.layers.map(
      (l) => `##contig=<ID=${ref.get(l.name)},length=${span(l)}>`
    ),
    '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
  ]
  const rows = r.edges.map((e, i) =>
    [
      ref.get(e.source.layer),
      pos(e.source),
      `edge${i + 1}`,
      'N',
      `N[${ref.get(e.target.layer)}:${pos(e.target)}[`,
      '.',
      'PASS',
      [
        'SVTYPE=BND',
        `SOURCE=${named(e.source)}`,
        `TARGET=${named(e.target)}`,
        ...(e.channel !== null ? [`CHANNEL=${info(e.channel)}`] : []),
        `WEIGHT=${e.weight}`,
        `COLOR=${e.color}`,
      ].join(';'),
    ].join('\t')
  )
  return [...head, ...rows].join('\n') + '\n'
}

// For JBrowse Desktop (Open sequence file): the layers as a FASTA of Ns and
// its .fai index (name, length, offset, bases per line, bytes per line)
export function jbrowseFasta(r: Ring): { fasta: string; fai: string } {
  const ref = jbrowseRefNames(r)
  let offset = 0
  let fasta = ''
  const fai: string[] = []
  for (const l of r.layers) {
    const head = `>${ref.get(l.name)}\n` // ASCII: one byte per character
    const n = span(l)
    fai.push(
      `${ref.get(l.name)}\t${n}\t${offset + head.length}\t${n}\t${n + 1}`
    )
    fasta += `${head}${'N'.repeat(n)}\n`
    offset += head.length + n + 1
  }
  return { fasta, fai: fai.join('\n') + '\n' }
}

export function jbrowseConfig(
  r: Ring,
  vcfUri: string
): Record<string, unknown> {
  const ref = jbrowseRefNames(r)
  return {
    assemblies: [
      {
        name: JBROWSE_ASSEMBLY,
        displayName: 'Arena3D network (layers as sequences)',
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: `${JBROWSE_ASSEMBLY}_layers`,
          adapter: {
            type: 'FromConfigSequenceAdapter',
            features: r.layers.map((l, i) => ({
              uniqueId: `layer${i + 1}`,
              refName: ref.get(l.name),
              start: 0,
              end: span(l),
              seq: 'N'.repeat(span(l)),
            })),
          },
        },
      },
    ],
    tracks: [
      {
        type: 'VariantTrack',
        trackId: JBROWSE_TRACK,
        name: `Arena3D edges (${r.edges.length})`,
        assemblyNames: [JBROWSE_ASSEMBLY],
        adapter: {
          type: 'VcfAdapter',
          vcfLocation: { uri: vcfUri, locationType: 'UriLocation' },
        },
        displays: [
          {
            type: 'ChordVariantDisplay',
            displayId: `${JBROWSE_TRACK}-ChordVariantDisplay`,
            renderer: {
              type: 'StructuralVariantChordRenderer',
              strokeColor: "jexl:get(feature,'INFO').COLOR[0]",
            },
          },
        ],
      },
    ],
  }
}

export const jbrowseUrl = (configUrl: string): string =>
  `${JBROWSE_WEB}?config=${encodeURIComponent(configUrl)}&session=${encodeURIComponent(
    `spec-${JSON.stringify({ views: [{ type: 'CircularView', assembly: JBROWSE_ASSEMBLY, tracks: [JBROWSE_TRACK] }] })}`
  )}`

/** config.json (reading the VCF beside it), the VCF, a FASTA and a README, for a zip. */
export function jbrowseFiles(r: Ring): Record<string, string> {
  const { fasta, fai } = jbrowseFasta(r)
  return {
    'config.json': JSON.stringify(
      jbrowseConfig(r, 'arena3d_edges.vcf'),
      null,
      1
    ),
    'arena3d_edges.vcf': jbrowseVcf(r),
    'arena3d_layers.fa': fasta,
    'arena3d_layers.fa.fai': fai,
    'README.txt': `Arena3D network for JBrowse 2 (${ringSize(r)}).

JBrowse reads genomes, so the network stands in for one: every layer is a
reference sequence of 2 bp per node (in Arena3D's order; characters a VCF
sequence name cannot hold become _), and every edge a VCF breakend (SVTYPE=BND)
between the middles of its two nodes, drawn as a chord in the Circular View
and coloured as in Arena3D (INFO COLOR). The node names, channel and weight are
in each record's INFO.

JBrowse Web: put config.json and arena3d_edges.vcf on a web server (with
CORS) and open
  ${JBROWSE_WEB}?config=<URL of config.json>&session=spec-{"views":[{"type":"CircularView","assembly":"${JBROWSE_ASSEMBLY}","tracks":["${JBROWSE_TRACK}"]}]}
or add them to your own JBrowse Web (jbrowse add-assembly / add-track).

JBrowse Desktop: Open sequence file -> arena3d_layers.fa (with its .fai),
then add a Circular view and open arena3d_edges.vcf as a track; its
breakends are drawn as chords.
`,
  }
}

/** Host the VCF, then a config reading it, and return the JBrowse Web link. */
export async function jbrowseLink(r: Ring): Promise<string> {
  if (!r.edges.length)
    throw new ExportError('No edges to draw in these layers and channels.')
  const vcf = await hostFile(jbrowseVcf(r), 'text/plain', 'arena3d_edges.vcf')
  const config = await hostFile(
    JSON.stringify(jbrowseConfig(r, vcf)),
    'application/json',
    'arena3d_jbrowse_config.json'
  )
  return jbrowseUrl(config)
}
