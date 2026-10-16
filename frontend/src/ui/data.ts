// Data Tables panel (Analyze menu) — port of v2 views/data.R plus its table renderers:
// functions/render.R (renderNetworkDF / renderClusteringDF / renderMetricTable,
// hideDataMetricTabs) and functions/edges.R updateSelectedEdgesView.
//
// v2 rendered DT datatables (excel/csv/copy/pdf/print buttons, per-column
// filters). Ported as plain HTML tables with a CSV download button and
// sortable columns: a click on a header sorts the report by that column
// (numbers largest first, text A→Z), a second click turns it round; the
// order is kept while the report refreshes and the CSV follows it.
// ponytail: no per-column filters or excel/pdf/print export, add if missed.

import { Tab } from 'bootstrap'
import { showTab } from './tabs'
import { bus } from '../bus'
import { store } from '../store'
import { ctx } from '../three'
import { escapeHtml } from '../utils'
import { upsetSvg, type UpsetSet } from '../actions/upset'
import { layerSwatchColor } from '../actions/legend'
import type { GraphStats, LayerSimilarityResponse } from '../api/client'

const TABS = [
  { id: 'network', label: 'Network Data' },
  { id: 'selectedEdges', label: 'Selected Edges' },
  { id: 'clustering', label: 'Clustering Data' },
  { id: 'degree', label: 'Degree' },
  { id: 'transitivity', label: 'Clustering Coefficient' },
  { id: 'betweenness', label: 'Betweenness Centrality' },
  { id: 'multiplexDegree', label: 'Multiplex Degree' },
  { id: 'participation', label: 'Participation Coefficient' },
  { id: 'pagerank', label: 'Multilayer PageRank' },
  { id: 'similarity', label: 'Layer Similarity' },
  { id: 'stats', label: 'Network Statistics' },
  { id: 'groupStats', label: 'Group Statistics' },
  { id: 'compare', label: 'Network Comparison' },
  { id: 'closeness', label: 'Closeness' },
  { id: 'eigenvector', label: 'Eigenvector' },
  { id: 'pagerankNode', label: 'PageRank' },
  { id: 'coreness', label: 'Coreness' },
  { id: 'eccentricity', label: 'Eccentricity' },
  { id: 'groups', label: 'Groups' },
  { id: 'groupOverlap', label: 'Group Overlap' },
  { id: 'values', label: 'Node Values' },
] as const

// v2 renderMetricTable keyed output ids by metric (init.R TOPOLOGY_METRICS)
const METRIC_TAB: Record<string, string> = {
  Degree: 'degree',
  'Clustering Coefficient': 'transitivity',
  'Betweenness Centrality': 'betweenness',
  'Multiplex Degree': 'multiplexDegree',
  'Participation Coefficient': 'participation',
  'Multilayer PageRank': 'pagerank',
  'Closeness Centrality': 'closeness',
  'Eigenvector Centrality': 'eigenvector',
  PageRank: 'pagerankNode',
  'Coreness (k-core)': 'coreness',
  Eccentricity: 'eccentricity',
}

const DATA_HTML = `
<div class="data-panel">
<ul class="nav nav-tabs data-tabs" role="tablist" aria-label="Reports">
  ${TABS.map(
    (t) => `
  <li class="nav-item d-none" id="dataTab-${t.id}" role="presentation">
    <button class="nav-link" data-bs-toggle="tab" data-bs-target="#dataPane-${t.id}" type="button" role="tab">${t.label}</button>
  </li>`
  ).join('')}
</ul>
<div class="tab-content data-content">
  ${TABS.map(
    (t) =>
      `<div class="tab-pane fade" id="dataPane-${t.id}" role="tabpanel"></div>`
  ).join('')}
</div>
<div id="dataEmpty" class="form-text">The reports appear here as tabs: the network on loading, then every metric, statistic, clustering, comparison and group table a button produces.</div>
</div>
`

function toCsv(columns: string[], rows: (string | number)[][]): string {
  const q = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns, ...rows].map((r) => r.map(q).join(',')).join('\n')
}

function activateDataTab(tabId: string): void {
  const btn = document.querySelector(`[data-bs-target="#dataPane-${tabId}"]`)
  if (btn) Tab.getOrCreateInstance(btn).show()
}

// ---------------------------------------------------------------- sorting
type SortDir = 'asc' | 'desc'
interface Report {
  columns: string[]
  rows: (string | number)[][] // as delivered
  sort: { col: number; dir: SortDir } | null
}
const reports = new Map<string, Report>()

// A cell's number, if it is one ('1,234', '12 %' and '0.52' count; '—' and
// '' do not).
function numberOf(v: string | number): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const t = v.trim().replace(/,/g, '').replace(/\s*%$/, '')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const isNumeric = (rows: (string | number)[][], col: number): boolean => {
  let seen = 0
  for (const r of rows) {
    const v = r[col]
    if (v === '' || v === '—' || v === undefined) continue
    if (numberOf(v) === null) return false
    seen++
  }
  return seen > 0
}

/** The rows in the report's current order (missing values always last). */
export function sortedRows(
  rows: (string | number)[][],
  sort: { col: number; dir: SortDir } | null
): (string | number)[][] {
  if (!sort) return rows
  const { col, dir } = sort
  const sign = dir === 'asc' ? 1 : -1
  const numeric = isNumeric(rows, col)
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
  })
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const va = a.r[col] ?? ''
      const vb = b.r[col] ?? ''
      if (numeric) {
        const na = numberOf(va)
        const nb = numberOf(vb)
        if (na === null && nb === null) return a.i - b.i
        if (na === null) return 1
        if (nb === null) return -1
        return (na - nb) * sign || a.i - b.i
      }
      const sa = String(va)
      const sb = String(vb)
      if (sa === '' && sb === '') return a.i - b.i
      if (sa === '') return 1
      if (sb === '') return -1
      return collator.compare(sa, sb) * sign || a.i - b.i
    })
    .map(({ r }) => r)
}

/** The order a first click gives a column: numbers largest first, text A→Z. */
const firstDir = (rows: (string | number)[][], col: number): SortDir =>
  isNumeric(rows, col) ? 'desc' : 'asc'

function headerHtml(report: Report): string {
  return report.columns
    .map((c, i) => {
      const active = report.sort?.col === i
      const dir = active ? report.sort!.dir : null
      const aria = dir ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'
      const num = isNumeric(report.rows, i) ? ' num' : ''
      return `<th class="data-sort${active ? ' data-sort--active' : ''}${num}" data-col="${i}" role="columnheader" aria-sort="${aria}" tabindex="0" title="Sort by ${escapeHtml(c)}">${escapeHtml(c)}<span class="data-sort__ind" aria-hidden="true">${dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '⇅'}</span></th>`
    })
    .join('')
}

// numbers right-aligned, in tabular figures
function bodyHtml(report: Report, rows: (string | number)[][]): string {
  const num = report.columns.map((_, i) => isNumeric(report.rows, i))
  return rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (v, i) => `<td${num[i] ? ' class="num"' : ''}>${escapeHtml(v)}</td>`
          )
          .join('')}</tr>`
    )
    .join('')
}

// Sort (or turn round) by a column, and redraw only the table, so whatever
// else the pane holds (the degree chart under Network Statistics) stays.
function sortReport(tabId: string, col: number): void {
  const report = reports.get(tabId)
  const table = document.querySelector(`#dataPane-${tabId} table.data-table`)
  if (!report || !table) return
  const same = report.sort?.col === col
  const dir: SortDir = same
    ? report.sort!.dir === 'asc'
      ? 'desc'
      : 'asc'
    : firstDir(report.rows, col)
  report.sort = { col, dir }
  table.querySelector('thead tr')!.innerHTML = headerHtml(report)
  table.querySelector('tbody')!.innerHTML = bodyHtml(
    report,
    sortedRows(report.rows, report.sort)
  )
}

// An UpSet plot under a comparison table: the sets (layers, groups or the
// layers of two networks) and what exactly they share, with an SVG download.
function appendUpset(
  paneId: string,
  sets: UpsetSet[],
  element: string,
  fileName: string
): void {
  const pane = document.getElementById(`dataPane-${paneId}`)
  if (!pane || sets.length < 2) return
  const box = document.createElement('div')
  box.className = 'mt-3 upset-box'
  const svg = upsetSvg(sets, { element })
  box.innerHTML = `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
      <span class="small fw-semibold">UpSet plot: ${escapeHtml(element)} the sets share</span>
      <button class="btn btn-sm btn-outline-primary upset-download">Download SVG</button>
      <span class="small text-secondary">A bar with one dot: in that set only; with several dots: in exactly those sets.</span>
    </div>
    <div class="upset-plot">${svg}</div>`
  box.querySelector('.upset-download')?.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}_upset.svg`
    a.click()
    URL.revokeObjectURL(url)
  })
  pane.appendChild(box)
}

// the node names of a layer, for the layer UpSet plots
const layerNodeNames = (layer: string): string[] =>
  ctx.nodeObjects.flatMap((n, i) =>
    ctx.nodeGroups[ctx.nodeLayerNames[i]] === layer ? [n.name] : []
  )

/** v2 renderShinyDataTable + showTab: fill a pane, unhide its tab, focus it. */
// `reveal`: the table is the result the user asked for (a statistics,
// groups or comparison button), so the Data Tables panel comes up; tables
// that are side effects of other actions (a clustering layout, a metric) fill
// their tab quietly.
function renderTable(
  tabId: string,
  columns: string[],
  rows: (string | number)[][],
  fileName: string,
  focus = true,
  reveal = false
): void {
  const pane = document.getElementById(`dataPane-${tabId}`)
  if (!pane) return
  // a refreshed report keeps its order while the columns are the same
  const previous = reports.get(tabId)
  const sort =
    previous &&
    previous.sort &&
    previous.columns.length === columns.length &&
    previous.columns.every((c, i) => c === columns[i])
      ? previous.sort
      : null
  const report: Report = { columns, rows, sort }
  reports.set(tabId, report)
  pane.innerHTML = `
    <div class="data-toolbar">
      <span class="data-meta">${rows.length} row${rows.length === 1 ? '' : 's'} · ${columns.length} column${columns.length === 1 ? '' : 's'}</span>
      <button class="btn btn-sm btn-outline-primary" id="dataCsv-${tabId}">Download CSV</button>
      <span class="data-hint">Click a column title to sort; again to turn the order round.</span>
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>${headerHtml(report)}</tr></thead>
        <tbody>${bodyHtml(report, sortedRows(rows, sort))}</tbody>
      </table>
    </div>`
  document.getElementById('dataEmpty')?.classList.add('d-none')
  const table = pane.querySelector('table.data-table')!
  const headerCol = (target: EventTarget | null): number | null => {
    const th = (target as HTMLElement | null)?.closest('th.data-sort')
    return th ? Number((th as HTMLElement).dataset.col) : null
  }
  table.addEventListener('click', (e) => {
    const col = headerCol(e.target)
    if (col !== null) sortReport(tabId, col)
  })
  // a mouse click sorts without taking focus (focusing would scroll a wide
  // table sideways); the keyboard still reaches the titles with Tab
  table.addEventListener('mousedown', (e) => {
    if (headerCol(e.target) !== null) e.preventDefault()
  })
  table.addEventListener('keydown', (e: Event) => {
    const key = (e as KeyboardEvent).key
    if (key !== 'Enter' && key !== ' ') return
    const col = headerCol(e.target)
    if (col === null) return
    e.preventDefault()
    sortReport(tabId, col)
  })
  document.getElementById(`dataCsv-${tabId}`)?.addEventListener('click', () => {
    const current = reports.get(tabId) ?? report
    const url = URL.createObjectURL(
      new Blob([toCsv(columns, sortedRows(current.rows, current.sort))], {
        type: 'text/csv',
      })
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  })
  document.getElementById(`dataTab-${tabId}`)?.classList.remove('d-none')
  if (focus) activateDataTab(tabId)
  if (reveal) showTab('#panel-data')
}

function renderNetworkTable(): void {
  const network = store.get().network
  if (!network) return
  const hasChannels = network.channels.length > 0
  const columns = [
    'SourceNode',
    'SourceLayer',
    'TargetNode',
    'TargetLayer',
    'Weight',
  ]
  if (hasChannels) columns.push('Channel')
  const rows = network.edges.map((e) => {
    const row: (string | number)[] = [
      e.source_node,
      e.source_layer,
      e.target_node,
      e.target_layer,
      e.weight,
    ]
    if (hasChannels) row.push(e.channel ?? '')
    return row
  })
  renderTable('network', columns, rows, 'networkData')
}

/** v2 updateSelectedEdgesView: per-channel rows; tab hidden when none selected. */
function refreshSelectedEdges(): void {
  const rows: (string | number)[][] = []
  for (const e of ctx.edgeObjects) {
    if (!e.isSelected) continue
    const base = [
      ctx.nodeObjects[e.sourceNodeIndex].name,
      ctx.layers[e.sourceLayerIndex].name,
      ctx.nodeObjects[e.targetNodeIndex].name,
      ctx.layers[e.targetLayerIndex].name,
    ]
    if (e.channels.length > 0)
      e.channels.forEach((ch, j) => rows.push([...base, ch, e.weights[j]]))
    else rows.push([...base, '', e.weights[0] ?? ''])
  }
  if (rows.length > 0) {
    renderTable(
      'selectedEdges',
      [
        'SourceNode',
        'SourceLayer',
        'TargetNode',
        'TargetLayer',
        'Channel',
        'Weight',
      ],
      rows,
      'selectedEdgeData',
      false
    )
  } else {
    const item = document.getElementById('dataTab-selectedEdges')
    if (item && !item.classList.contains('d-none')) {
      const wasActive = item
        .querySelector('.nav-link')
        ?.classList.contains('active')
      item.classList.add('d-none')
      if (wasActive) activateDataTab('network')
    }
  }
}

// Jaccard heatmaps (nodes, edges) for the compared layers; cell shade = overlap.
function renderSimilarity(res: LayerSimilarityResponse): void {
  const pane = document.getElementById('dataPane-similarity')
  if (!pane) return
  const heat = (title: string, m: number[][]) => `
    <h6 class="mt-2">${title}</h6>
    <div style="overflow:auto"><table class="table table-sm table-bordered similarity-table">
      <thead><tr><th></th>${res.layers.map((l) => `<th>${escapeHtml(l)}</th>`).join('')}</tr></thead>
      <tbody>${m
        .map(
          (row, i) =>
            `<tr><th>${escapeHtml(res.layers[i])}</th>${row
              .map(
                (v) =>
                  `<td style="background: color-mix(in srgb, #d7191c ${Math.round(v * 100)}%, transparent)">${v.toFixed(2)}</td>`
              )
              .join('')}</tr>`
        )
        .join('')}</tbody>
    </table></div>`
  pane.innerHTML =
    heat('Shared nodes (Jaccard)', res.node_jaccard) +
    heat('Shared edges (Jaccard)', res.edge_jaccard)
  appendUpset(
    'similarity',
    res.layers.map((name) => ({
      name,
      members: layerNodeNames(name),
      color: layerSwatchColor(name),
    })),
    'nodes',
    'layerSimilarity'
  )
  document.getElementById('dataTab-similarity')?.classList.remove('d-none')
  activateDataTab('similarity')
  showTab('#panel-data')
}

// Degree distribution as a single-series bar chart: one hue, thin bars
// rounded at the top, recessive axis, a tooltip per bar (SVG <title>).
export function degreeChartSvg(dist: Record<string, number>): string {
  const entries = Object.entries(dist)
    .map(([k, v]) => [Number(k), v] as const)
    .sort((a, b) => a[0] - b[0])
  if (entries.length === 0)
    return '<p class="small text-secondary">No nodes.</p>'
  const W = 560
  const H = 200
  const pad = { l: 36, r: 8, t: 8, b: 28 }
  const maxDeg = entries[entries.length - 1][0]
  const maxCount = Math.max(...entries.map((e) => e[1]))
  const slot = (W - pad.l - pad.r) / (maxDeg + 1)
  const bw = Math.max(1, Math.min(18, slot - 2)) // 2px gap between bars
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / maxCount)
  const bars = entries
    .map(([d, c]) => {
      const x = pad.l + d * slot + (slot - bw) / 2
      const top = y(c)
      const h = H - pad.b - top
      const r = Math.min(4, bw / 2, h)
      return `<path class="deg-bar" d="M${x},${H - pad.b} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - pad.b} Z"><title>Degree ${d}: ${c} node${c === 1 ? '' : 's'}</title></path>`
    })
    .join('')
  const ticks = [...new Set([0, Math.round(maxDeg / 2), maxDeg])]
    .map(
      (d) =>
        `<text x="${pad.l + d * slot + slot / 2}" y="${H - 10}" text-anchor="middle">${d}</text>`
    )
    .join('')
  return `<svg class="degree-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Degree distribution" style="width:100%;max-width:${W}px">
    <line x1="${pad.l}" y1="${H - pad.b}" x2="${W - pad.r}" y2="${H - pad.b}" class="deg-axis"/>
    <text x="${pad.l - 6}" y="${pad.t + 8}" text-anchor="end">${maxCount}</text>
    <text x="${pad.l - 6}" y="${H - pad.b}" text-anchor="end">0</text>
    ${bars}${ticks}
    <text x="${(W + pad.l) / 2}" y="${H}" text-anchor="middle">degree</text>
  </svg>`
}

const STAT_ROWS: [keyof GraphStats, string, (v: number) => string][] = [
  ['nodes', 'Nodes', String],
  ['edges', 'Edges', String],
  ['density', 'Density', (v) => v.toFixed(4)],
  ['average_degree', 'Average degree', (v) => v.toFixed(2)],
  ['max_degree', 'Max degree', String],
  ['components', 'Connected components', String],
  ['largest_component', 'Largest component (nodes)', String],
  ['diameter', 'Diameter (largest component)', String],
  ['average_path_length', 'Average path length', (v) => v.toFixed(2)],
  ['average_clustering', 'Average clustering coefficient', (v) => v.toFixed(3)],
  ['transitivity', 'Transitivity (global clustering)', (v) => v.toFixed(3)],
  ['assortativity', 'Degree assortativity', (v) => v.toFixed(3)],
]

function renderStats(stats: GraphStats[]): void {
  const pane = document.getElementById('dataPane-stats')
  if (!pane) return
  const columns = ['Statistic', ...stats.map((s) => s.name)]
  const rows = STAT_ROWS.map(([key, label, fmt]) => [
    label,
    ...stats.map((s) => {
      const v = s[key] as number | null
      return v === null ? '—' : fmt(v)
    }),
  ])
  renderTable('stats', columns, rows, 'networkStatistics', true, true)
  const chartBox = document.createElement('div')
  chartBox.className = 'mt-3'
  chartBox.innerHTML = `
    <label class="form-label small" for="degreeChartPick">Degree distribution:</label>
    <select id="degreeChartPick" class="form-select form-select-sm mb-2" style="width:auto">
      ${stats.map((s, i) => `<option value="${i}" ${i === stats.length - 1 ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
    </select>
    <div id="degreeChart"></div>`
  pane.appendChild(chartBox)
  const pick = chartBox.querySelector('select')!
  const draw = () =>
    (chartBox.querySelector('#degreeChart')!.innerHTML = degreeChartSvg(
      stats[Number(pick.value)].degree_distribution
    ))
  pick.addEventListener('change', draw)
  draw()
}

// Groups card (ui/groups.ts): members per group, per layer
export function renderGroupsTable(
  rows: {
    name: string
    color: string
    total: number
    perLayer: Record<string, number>
    members: string[]
  }[],
  layers: string[]
): void {
  renderTable(
    'groups',
    ['Group', 'Colour', 'Members', ...layers, 'Nodes'],
    rows.map((g) => [
      g.name,
      g.color,
      g.total,
      ...layers.map((l) => g.perLayer[l] ?? 0),
      g.members.join('; '),
    ]),
    'groups',
    true,
    true
  )
}

export function renderGroupOverlapTable(
  names: string[],
  jaccard: number[][],
  members: string[][] = [],
  colors: string[] = []
): void {
  renderTable(
    'groupOverlap',
    ['Group', ...names],
    names.map((n, i) => [n, ...jaccard[i].map((v) => v.toFixed(2))]),
    'groupOverlap',
    true,
    true
  )
  if (members.length === names.length)
    appendUpset(
      'groupOverlap',
      names.map((name, i) => ({ name, members: members[i], color: colors[i] })),
      'nodes',
      'groupOverlap'
    )
}

export function renderGroupStatsTable(rows: (string | number)[][]): void {
  renderTable(
    'groupStats',
    [
      'Group',
      'Nodes',
      'Layers',
      'Edges inside',
      'Intra-layer',
      'Inter-layer',
      'Density',
      'Mean degree inside',
      '% of all edges',
      'Nodes in other groups too',
    ],
    rows,
    'group_statistics',
    true,
    true
  )
}

export function renderCompareTable(
  a: string,
  b: string,
  rows: (string | number)[][],
  sets: UpsetSet[] = []
): void {
  renderTable(
    'compare',
    ['Measure', `A: ${a}`, `B: ${b}`, 'Both', 'Only A', 'Only B', 'Jaccard'],
    rows,
    'network_comparison',
    true,
    true
  )
  appendUpset('compare', sets, 'nodes', 'network_comparison')
}

export function renderValuesTable(
  columns: string[],
  rows: { node: string; values: (number | null)[] }[]
): void {
  renderTable(
    'values',
    ['Node', ...columns],
    rows.map((r) => [r.node, ...r.values.map((v) => (v === null ? '' : v))]),
    'nodeValues',
    false
  )
}

export function initDataPanel(): void {
  const pane = document.getElementById('panel-data')
  if (!pane) return
  pane.innerHTML = DATA_HTML

  bus.on('network:loaded', () => renderNetworkTable())
  bus.on('clustering:applied', ({ clusters }) => {
    renderTable(
      'clustering',
      ['Node', 'Cluster'],
      Object.entries(clusters),
      'clusteringData'
    )
  })
  bus.on('layers:similarity', renderSimilarity)
  bus.on('network:stats', renderStats)
  // the metric's values next to the node scale they became
  bus.on('topology:applied', ({ metric, scales, raw }) => {
    const tabId = METRIC_TAB[metric]
    if (!tabId) return
    const value = (v: number) =>
      Number.isInteger(v) ? v : Number(v.toPrecision(4))
    renderTable(
      tabId,
      raw ? ['Node', metric, 'Scale'] : ['Node', 'Scale'],
      Object.entries(scales).map(([name, s]) =>
        raw ? [name, value(raw[name] ?? 0), value(s)] : [name, value(s)]
      ),
      `${tabId}Data`
    )
  })
  // Selected edges have no bus event (selection is pure ctx state); recompute
  // whenever the View Data panel is opened.
  document
    .querySelector('[data-bs-target="#panel-data"]')
    ?.addEventListener('shown.bs.tab', () => refreshSelectedEdges())
}
