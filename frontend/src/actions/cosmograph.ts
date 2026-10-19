// Export → Other tools → Cosmograph (https://cosmograph.app), the GPU graph
// viewer for large networks. Two CSV files: the links (`source`, `target`
// and the edge's weight, channel and layers) and the node metadata (`id` plus
// label, layer, colour, size, cluster, annotation terms, File → Values
// columns, the node metrics applied so far and the UMAP view's x/y if one was
// computed). Node ids are Node_Layer, unique across layers; the plain name is
// the label. "Open in Cosmograph" hosts both on this server for an hour
// (POST /api/share, served with CORS as downloads) and opens Cosmograph's
// QueryString link: cosmograph.app/run/?data=<links>&meta=<nodes>.

import { bus } from '../bus'
import { ctx } from '../three'
import { ExportError, network } from './export'
import { valueTable } from './values'
import { cachedUmapPositions } from './umap'
import { hostFile } from './visualizations'

export const COSMOGRAPH_APP = 'https://cosmograph.app/run/'
export const COSMOGRAPH_LINKS_COLUMNS = [
  'source',
  'target',
  'weight',
  'channel',
  'source_layer',
  'target_layer',
]
export const COSMOGRAPH_NODE_COLUMNS = [
  'id',
  'label',
  'layer',
  'color',
  'size',
  'cluster',
  'annotations',
]

// the raw values of each node metric applied in this network (Analyze →
// node metrics), kept for the export; an undo of a metric takes it out
const metricValues = new Map<string, Record<string, number>>()
bus.on('network:loaded', () => metricValues.clear())
bus.on('topology:applied', ({ metric, raw }) => {
  if (raw && Object.keys(raw).length) metricValues.set(metric, raw)
  else metricValues.delete(metric)
})

const cell = (v: string | number): string => {
  const s = String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csv = (header: string[], rows: (string | number)[][]): string =>
  [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n'

export function cosmographLinksCsv(): string {
  const net = network()
  const known = new Set(ctx.nodeLayerNames)
  const rows = net.edges
    .filter((e) => known.has(e.src) && known.has(e.trg))
    .map((e) => [
      e.src,
      e.trg,
      e.weight,
      e.channel ?? '',
      e.source_layer,
      e.target_layer,
    ])
  if (!rows.length)
    throw new ExportError('Cosmograph needs links: this network has no edges.')
  return csv(COSMOGRAPH_LINKS_COLUMNS, rows)
}

export function cosmographNodesCsv(): string {
  network()
  const header = [...COSMOGRAPH_NODE_COLUMNS]
  // extra columns keep their own names unless one is taken
  const column = (name: string) => {
    let out = name
    while (header.includes(out)) out = `${out} (2)`
    header.push(out)
  }
  const values = valueTable()
  const byName = new Map(values?.rows.map((r) => [r.node, r.values]) ?? [])
  values?.columns.forEach(column)
  const metrics = [...metricValues]
  metrics.forEach(([m]) => column(m))
  const umap = cachedUmapPositions()
  if (umap) ['umap_x', 'umap_y'].forEach(column)
  const rows = ctx.nodeObjects.map((n, i) => {
    const id = ctx.nodeLayerNames[i]
    const own = byName.get(n.name)
    const p = umap?.[id]
    return [
      id,
      n.name,
      n.layer,
      n.color,
      Number(n.getScale().toFixed(4)),
      n.cluster,
      n.annotations.join('; '),
      ...(values?.columns.map((_, c) => own?.[c] ?? '') ?? []),
      ...metrics.map(([, raw]) => raw[id] ?? ''),
      ...(umap ? [p?.[0] ?? '', p?.[1] ?? ''] : []),
    ]
  })
  return csv(header, rows)
}

// Cosmograph's QueryString API (classic app): the files by URL, coloured,
// sized and labelled by the metadata columns
export function cosmographUrl(linksUrl: string, nodesUrl: string): string {
  for (const u of [linksUrl, nodesUrl])
    if (!/^https?:\/\//i.test(u))
      throw new ExportError('The hosted files need an http(s) address.')
  const q = new URLSearchParams({
    data: linksUrl,
    meta: nodesUrl,
    source: 'source',
    target: 'target',
    nodeColor: 'color',
    nodeSize: 'size',
    nodeLabel: 'label',
  })
  return `${COSMOGRAPH_APP}?${q.toString()}`
}

// Host both files (one hour) and return the link that opens them
export async function cosmographLink(): Promise<string> {
  const links = cosmographLinksCsv()
  const nodes = cosmographNodesCsv()
  const [linksUrl, nodesUrl] = await Promise.all([
    hostFile(links, 'text/csv', 'arena3d_cosmograph_links.csv'),
    hostFile(nodes, 'text/csv', 'arena3d_cosmograph_nodes.csv'),
  ])
  return cosmographUrl(linksUrl, nodesUrl)
}
