// Analyze → Plots: distributions of one measure (histogram, density, CDF /
// CCDF, log–log with a power-law fit, box and violin per layer) and plots
// that relate topological features (scatter, correlation matrix, C(k),
// knn(k), rich club, k-core shells, centrality ranking, layer profiles), per
// layer overlaid in the layer colours or for the analysed layers as one
// graph. The server computes the metrics and curves (POST /api/plots), kept
// here per network so each is computed once; actions/plots.ts builds the
// charts. A click on a bar or a point (or a box dragged on a scatter)
// selects its nodes in the scene.

import {
  api,
  type PlotExtra,
  type PlotScope,
  type PlotScopeData,
} from '../api/client'
import { bus } from '../bus'
import { store } from '../store'
import { ctx } from '../three'
import { escapeHtml } from '../utils'
import { layerSwatchColor } from '../actions/legend'
import {
  decideNodeLabelFlags,
  repaintNode,
  updateSelectedNodesStore,
} from '../actions/node'
import { fmtNum } from '../actions/chart'
import { toCsv, WHOLE } from '../actions/perturbation'
import {
  boxPlot,
  cdfPlot,
  correlationPlot,
  curvePlot,
  densityPlot,
  histogramPlot,
  logLogPlot,
  pathValues,
  profilesPlot,
  rankingPlot,
  scatterPlot,
  shellsPlot,
  type Built,
  type Group,
  type RankInput,
  type ScatterGroup,
} from '../actions/plots'
import { valueColumns, valueTable } from '../actions/values'
import { selectedChannels } from './layouts'
import { PROGRESS_HTML, ProgressBar } from './progress'

const MULTILAYER = [
  'Multiplex Degree',
  'Participation Coefficient',
  'Multilayer PageRank',
]

const opt = (value: string, label: string) =>
  `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`

const KINDS: [string, [string, string][]][] = [
  [
    'Distribution of one measure',
    [
      ['histogram', 'Histogram'],
      ['density', 'Density (kernel)'],
      ['cdf', 'Cumulative distribution (CDF / CCDF)'],
      ['loglog', 'Log–log distribution, power-law fit'],
      ['box', 'Box and violin per layer'],
    ],
  ],
  [
    'Topological features together',
    [
      ['scatter', 'Scatter: one metric against another'],
      ['correlation', 'Metric correlation matrix'],
      ['ck', 'Clustering against degree, C(k)'],
      ['knn', 'Neighbour degree against degree, knn(k)'],
      ['richclub', 'Rich-club coefficient'],
      ['kcore', 'k-core shells'],
      ['ranking', 'Centrality ranking across layers'],
      ['profiles', 'Layer profiles'],
    ],
  ],
]

const DIST = 'histogram density cdf loglog box'

export const PLOTS_HTML = `
<details class="lp-section lp-more" id="plotsCard" open>
  <summary>Plot</summary>
  <div class="lp-grid mb-2">
    <div>
      <label class="form-label small" for="plotKind">Plot</label>
      <select id="plotKind" class="form-select form-select-sm">
        ${KINDS.map(([g, items]) => `<optgroup label="${g}">${items.map(([v, l]) => opt(v, l)).join('')}</optgroup>`).join('')}
      </select>
    </div>
    <div data-plot="${DIST} scatter correlation ck knn richclub kcore" data-multilayer-only>
      <label class="form-label small" for="plotScope">Graphs</label>
      <select id="plotScope" class="form-select form-select-sm">
        <option value="perLayer">Each layer, overlaid</option>
        <option value="combined">The analysed layers as one graph</option>
      </select>
    </div>
    <div data-plot="${DIST}">
      <label class="form-label small" for="plotSource">Of</label>
      <select id="plotSource" class="form-select form-select-sm"></select>
    </div>
    <div data-plot="scatter">
      <label class="form-label small" for="plotX">x</label>
      <select id="plotX" class="form-select form-select-sm"></select>
    </div>
    <div data-plot="scatter">
      <label class="form-label small" for="plotY">y</label>
      <select id="plotY" class="form-select form-select-sm"></select>
    </div>
    <div data-plot="histogram">
      <label class="form-label small" for="plotBins">Bins</label>
      <input id="plotBins" type="number" min="1" max="200" step="1" value="20" class="form-control form-control-sm" />
    </div>
    <div data-plot="histogram">
      <label class="form-label small" for="plotBinWidth">or bin width</label>
      <input id="plotBinWidth" type="number" min="0" step="any" placeholder="from the bins" class="form-control form-control-sm" />
    </div>
    <div data-plot="ranking">
      <label class="form-label small" for="plotRankMetric">Metric</label>
      <select id="plotRankMetric" class="form-select form-select-sm"></select>
    </div>
    <div data-plot="ranking">
      <label class="form-label small" for="plotTopN">Top</label>
      <input id="plotTopN" type="number" min="3" max="60" step="1" value="20" class="form-control form-control-sm" />
    </div>
    <div data-plot="loglog">
      <label class="form-label small" for="plotKmin">Fit from k ≥</label>
      <input id="plotKmin" type="number" min="1" step="1" value="1" class="form-control form-control-sm" />
    </div>
  </div>
  <div class="d-flex flex-wrap gap-3 mb-2">
    <div class="form-check" data-plot="cdf">
      <input class="form-check-input" type="checkbox" id="plotCcdf" />
      <label class="form-check-label small" for="plotCcdf">Complementary (CCDF)</label>
    </div>
    <div class="form-check" data-plot="cdf scatter ck knn box">
      <input class="form-check-input" type="checkbox" id="plotLog" />
      <label class="form-check-label small" for="plotLog">Log axes</label>
    </div>
    <div class="form-check" data-plot="loglog">
      <input class="form-check-input" type="checkbox" id="plotFit" checked />
      <label class="form-check-label small" for="plotFit">Power-law fit</label>
    </div>
    <div class="form-check" data-plot="box">
      <input class="form-check-input" type="checkbox" id="plotViolin" checked />
      <label class="form-check-label small" for="plotViolin">Violins</label>
    </div>
    <div class="form-check" data-plot="richclub">
      <input class="form-check-input" type="checkbox" id="plotRichNorm" checked />
      <label class="form-check-label small" for="plotRichNorm" title="Divided by its mean on three random graphs with the same degrees: above 1, the hubs link to each other more than chance">Against random graphs with the same degrees</label>
    </div>
  </div>
  <div class="d-flex align-items-start gap-2">
    <button id="plotDraw" class="btn btn-primary btn-sm">Draw</button>
    <div class="run-progress flex-grow-1">
      ${PROGRESS_HTML('plotsProgress', 'Plot progress')}
      <button id="plotCancel" class="btn btn-sm btn-outline-secondary mt-2 d-none">Cancel</button>
    </div>
  </div>
  <div id="plot_status" class="small mt-2" aria-live="polite"></div>
</details>
<div id="plotBox" class="plot-box d-none">
  <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
    <button id="plotSvg" class="btn btn-outline-primary btn-sm">Download SVG</button>
    <button id="plotPng" class="btn btn-outline-primary btn-sm">PNG</button>
    <button id="plotCsv" class="btn btn-outline-primary btn-sm">CSV</button>
    <span id="plotHint" class="form-text m-0"></span>
  </div>
  <div id="plotChart"></div>
  <div id="plotNote" class="form-text"></div>
  <div id="plotStats"></div>
</div>
`

const progress = new ProgressBar('plotsProgress')
let abort: AbortController | null = null
let shown: { built: Built; name: string } | null = null

const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T
const value = (id: string) => el<HTMLInputElement>(id).value
const checked = (id: string) => el<HTMLInputElement>(id).checked

function status(msg: string, isError = false): void {
  const out = document.getElementById('plot_status')
  if (!out) return
  out.textContent = msg
  out.className = `small mt-2 ${isError ? 'text-danger' : 'text-success'}`
}

const wholeOnly = () => ctx.networkMode === 'single'

function analysedLayers(): string[] {
  const st = store.get()
  return st.selectedLayers.length
    ? st.selectedLayers
    : (st.network?.layers ?? [])
}

// a layer's node colour (from a node that is not painted as selected), the
// whole network in a grey that reads on dark panels and white downloads
function colorOf(name: string): string {
  if (name === WHOLE) return '#9aa4b2'
  const nodes = ctx.nodeObjects.filter((n) => n.layer === name)
  const n = nodes.find((m) => !m.isSelected)
  return n ? n.color : (nodes[0]?.importedColor ?? layerSwatchColor(name))
}

// ---------------------------------------------------------------- server data
// per network, layers and channels: each graph's metrics and curves so far
let cache: { key: string; scopes: Map<PlotScope, PlotScopeData[]> } | null =
  null
let richRandom = -1 // what the cached rich-club curves were normalised by

// where each extra comes back
const FIELD: Record<PlotExtra, keyof PlotScopeData> = {
  components: 'components',
  paths: 'path_lengths',
  clustering_by_degree: 'clustering_by_degree',
  neighbour_degree: 'neighbour_degree',
  rich_club: 'rich_club',
}

function cacheFor(): Map<PlotScope, PlotScopeData[]> {
  const key = JSON.stringify([analysedLayers(), selectedChannels()])
  if (!cache || cache.key !== key) {
    cache = { key, scopes: new Map() }
    richRandom = -1
  }
  return cache.scopes
}

/** The graphs of a scope with at least these metrics and extras. */
async function scopesWith(
  scope: PlotScope,
  metrics: string[],
  extras: PlotExtra[],
  rich = 0
): Promise<PlotScopeData[]> {
  const net = store.get().network!
  const stored = cacheFor()
  const have = stored.get(scope)
  const missingMetrics = metrics.filter((m) => !have?.[0]?.metrics[m])
  const missingExtras = extras.filter(
    (x) =>
      !have?.length ||
      have[0][FIELD[x]] == null ||
      (x === 'rich_club' && rich !== richRandom)
  )
  if (have && !missingMetrics.length && !missingExtras.length) return have
  abort?.abort()
  const mine = (abort = new AbortController())
  el('plotCancel').classList.remove('d-none')
  progress.computing('Computing on the server')
  try {
    const res = await api.plots(
      {
        nodes: net.nodes,
        edges: net.edges,
        layers: analysedLayers(),
        selected_channels: selectedChannels(),
        scope,
        metrics: missingMetrics,
        extras: missingExtras,
        rich_club_random: rich,
      },
      mine.signal
    )
    if (missingExtras.includes('rich_club')) richRandom = rich
    const merged = res.scopes.map((s) => {
      const old = have?.find((o) => o.name === s.name)
      if (!old) return s
      const out = { ...old, metrics: { ...old.metrics, ...s.metrics } }
      for (const x of missingExtras)
        Object.assign(out, {
          [FIELD[x]]: s[FIELD[x]],
          ...(x === 'paths' ? { unconnected: s.unconnected } : {}),
        })
      return out
    })
    stored.set(scope, merged)
    progress.done('Computed', 1500)
    return merged
  } finally {
    if (abort === mine) abort = null
    el('plotCancel').classList.add('d-none')
  }
}

// ---------------------------------------------------------------- sources
type Source =
  | { kind: 'metric'; name: string }
  | { kind: 'value'; name: string }
  | { kind: 'weight' | 'components' | 'paths' }

function parseSource(v: string): Source {
  if (v.startsWith('metric:')) return { kind: 'metric', name: v.slice(7) }
  if (v.startsWith('value:')) return { kind: 'value', name: v.slice(6) }
  return { kind: v as 'weight' | 'components' | 'paths' }
}

const sourceLabel = (s: Source) =>
  s.kind === 'metric' || s.kind === 'value'
    ? s.name
    : {
        weight: 'edge weight',
        components: 'component size (nodes)',
        paths: 'distance (hops)',
      }[s.kind]

const metricNames = (): string[] => {
  const all = store.get().config?.topology_metrics ?? []
  return (store.get().network?.layers.length ?? 0) > 1
    ? all
    : all.filter((m) => !MULTILAYER.includes(m))
}

// the node values (File → Values) of each graph's nodes, by name
function valueGroups(column: string, scope: PlotScope): Group[] {
  const t = valueTable()
  const c = t?.columns.indexOf(column) ?? -1
  if (!t || c < 0) return []
  const byName = new Map<string, number>()
  for (const r of t.rows) {
    const v = r.values[c]
    if (v !== null && v !== undefined) byName.set(r.node, v)
  }
  const layers = analysedLayers()
  const sets = scope === 'combined' ? [layers] : layers.map((l) => [l])
  return sets.map((ls) => {
    const nodes = ctx.nodeObjects.filter(
      (n) => ls.includes(n.layer) && byName.has(n.name)
    )
    const name = ls.length === 1 && scope !== 'combined' ? ls[0] : WHOLE
    return {
      name,
      color: colorOf(name),
      values: nodes.map((n) => byName.get(n.name)!),
      ids: nodes.map((n) => n.nodeLayerName),
    }
  })
}

// edge weights: one group per channel (or per layer / all, without channels)
function weightGroups(scope: PlotScope): Group[] {
  const net = store.get().network!
  const layers = new Set(analysedLayers())
  const channels = selectedChannels()
  const edges = net.edges.filter(
    (e) =>
      layers.has(e.source_layer) &&
      layers.has(e.target_layer) &&
      (!channels || e.channel === null || channels.includes(e.channel))
  )
  const groups = new Map<string, number[]>()
  const keyOf = (e: (typeof edges)[number]) =>
    net.channels.length
      ? (e.channel ?? '')
      : scope === 'combined' || e.source_layer !== e.target_layer
        ? WHOLE
        : e.source_layer
  for (const e of edges) {
    const k = keyOf(e)
    const at = groups.get(k)
    if (at) at.push(e.weight)
    else groups.set(k, [e.weight])
  }
  return [...groups].map(([name, values]) => ({
    name,
    color: ctx.channelColors[name] ?? colorOf(name),
    values,
  }))
}

async function groupsOf(source: Source, scope: PlotScope): Promise<Group[]> {
  if (source.kind === 'value') return valueGroups(source.name, scope)
  if (source.kind === 'weight') return weightGroups(scope)
  if (source.kind === 'metric') {
    const data = await scopesWith(scope, [source.name], [])
    return data.map((s) => ({
      name: s.name,
      color: colorOf(s.name),
      values: s.metrics[source.name],
      ids: s.nodes,
    }))
  }
  const data = await scopesWith(scope, [], [source.kind])
  return data.map((s) => ({
    name: s.name,
    color: colorOf(s.name),
    values:
      source.kind === 'components'
        ? (s.components ?? [])
        : pathValues(s.path_lengths ?? {}).values,
  }))
}

// ---------------------------------------------------------------- building
async function build(kind: string, scope: PlotScope): Promise<Built> {
  if (DIST.split(' ').includes(kind)) {
    const source = parseSource(value('plotSource'))
    const label = sourceLabel(source)
    const groups = (await groupsOf(source, scope)).filter(
      (g) => g.values.length
    )
    if (!groups.length) throw new Error(`No values of ${label} to plot.`)
    const built =
      kind === 'histogram'
        ? histogramPlot(groups, label, {
            bins: Math.round(Number(value('plotBins'))) || 20,
            width: Number(value('plotBinWidth')) || undefined,
          })
        : kind === 'density'
          ? densityPlot(groups, label)
          : kind === 'cdf'
            ? cdfPlot(groups, label, {
                ccdf: checked('plotCcdf'),
                log: checked('plotLog'),
              })
            : kind === 'loglog'
              ? logLogPlot(groups, label, {
                  fit: checked('plotFit'),
                  kMin: Math.max(1, Math.round(Number(value('plotKmin')) || 1)),
                })
              : boxPlot(groups, label, {
                  log: checked('plotLog'),
                  violin: checked('plotViolin'),
                })
    if (source.kind === 'paths') {
      const data = cacheFor().get(scope) ?? []
      const cut = data.reduce((n, s) => n + (s.unconnected ?? 0), 0)
      const thinned = data.some((s) => pathValues(s.path_lengths ?? {}).thinned)
      built.note = [
        built.note,
        cut
          ? `${cut.toLocaleString()} pairs of nodes have no path between them.`
          : '',
        thinned ? 'Pairs thinned to 200,000 with the same shape.' : '',
      ]
        .filter(Boolean)
        .join(' ')
    }
    return built
  }
  if (kind === 'scatter') {
    const [xs, ys] = [parseSource(value('plotX')), parseSource(value('plotY'))]
    const metrics = [xs, ys].flatMap((s) =>
      s.kind === 'metric' ? [s.name] : []
    )
    const data = await scopesWith(scope, metrics, [])
    // node id -> value: a metric of this graph, or a File → Values column
    const valueOf = (s: Source, d: PlotScopeData) => {
      if (s.kind === 'metric')
        return new Map(d.nodes.map((v, i) => [v, d.metrics[s.name][i]]))
      const m = new Map<string, number>()
      for (const g of valueGroups(s.kind === 'value' ? s.name : '', 'combined'))
        g.ids?.forEach((id, i) => m.set(id, g.values[i]))
      return m
    }
    const label = new Map(ctx.nodeObjects.map((n) => [n.nodeLayerName, n.name]))
    const groups: ScatterGroup[] = data.map((d) => {
      const [mx, my] = [valueOf(xs, d), valueOf(ys, d)]
      const ids = d.nodes.filter((v) => mx.has(v) && my.has(v))
      return {
        name: d.name,
        color: colorOf(d.name),
        x: ids.map((v) => mx.get(v)!),
        y: ids.map((v) => my.get(v)!),
        ids,
        labels: ids.map((v) => label.get(v) ?? v),
      }
    })
    return scatterPlot(groups, sourceLabel(xs), sourceLabel(ys), {
      log: checked('plotLog'),
    })
  }
  if (kind === 'correlation') {
    const names = metricNames()
    const data = await scopesWith(scope, names, [])
    return correlationPlot(
      names,
      names.map((m) => data.flatMap((d) => d.metrics[m]))
    )
  }
  if (kind === 'ck' || kind === 'knn') {
    const extra = kind === 'ck' ? 'clustering_by_degree' : 'neighbour_degree'
    const data = await scopesWith(scope, [], [extra])
    return curvePlot(
      data.map((d) => ({
        name: d.name,
        color: colorOf(d.name),
        points: d[extra] ?? [],
      })),
      'degree k',
      kind === 'ck' ? 'C(k), mean clustering' : 'knn(k), neighbour degree',
      { log: checked('plotLog') }
    )
  }
  if (kind === 'richclub') {
    const norm = checked('plotRichNorm')
    const data = await scopesWith(scope, [], ['rich_club'], norm ? 3 : 0)
    return curvePlot(
      data.map((d) => ({
        name: d.name,
        color: colorOf(d.name),
        points: (d.rich_club ?? []).flatMap((p) =>
          !norm
            ? [[p.k, p.phi] as [number, number]]
            : p.phi_random
              ? [[p.k, p.phi / p.phi_random] as [number, number]]
              : []
        ),
      })),
      'degree k',
      norm ? 'ρ(k) = φ(k) / φ random' : 'φ(k), rich club',
      { reference: norm ? 1 : undefined }
    )
  }
  if (kind === 'kcore') {
    const m = 'Coreness (k-core)'
    const data = await scopesWith(scope, [m], [])
    return shellsPlot(
      data.map((d) => ({
        name: d.name,
        color: colorOf(d.name),
        values: d.metrics[m],
        ids: d.nodes,
      }))
    )
  }
  if (kind === 'ranking') {
    const m = value('plotRankMetric')
    const data = await scopesWith('perLayer', [m], [])
    const label = new Map(ctx.nodeObjects.map((n) => [n.nodeLayerName, n.name]))
    const rows = new Map<string, RankInput>()
    for (const d of data)
      d.nodes.forEach((id, i) => {
        const name = label.get(id) ?? id
        const r: RankInput = rows.get(name) ?? {
          label: name,
          ids: [],
          values: new Map<string, number>(),
        }
        r.ids.push(id)
        r.values.set(d.name, d.metrics[m][i])
        rows.set(name, r)
      })
    return rankingPlot(
      [...rows.values()],
      data.map((d) => ({ name: d.name, color: colorOf(d.name) })),
      m,
      Math.min(60, Math.max(3, Math.round(Number(value('plotTopN')) || 20)))
    )
  }
  // layer profiles: Network Statistics per layer and for the whole network
  const net = store.get().network!
  progress.computing('Computing the statistics on the server')
  const stats = await api.networkStats({
    nodes: net.nodes,
    edges: net.edges,
    layers: analysedLayers(),
  })
  progress.done('Computed', 1500)
  return profilesPlot(stats, colorOf)
}

// ---------------------------------------------------------------- drawing
function render(): void {
  if (!shown) return
  const { built } = shown
  el('plotBox').classList.remove('d-none')
  const chart = el('plotChart')
  chart.innerHTML = built.svg({
    width: (chart.clientWidth || 560) - 2,
    standalone: false,
  })
  el('plotNote').textContent = built.note ?? ''
  el('plotHint').textContent = built.picks.size
    ? 'Click a bar or a point to select its nodes (Shift adds)' +
      (chart.querySelector('circle.ch-hit')
        ? '; drag a box to select the points in it.'
        : '.')
    : ''
  el('plotStats').innerHTML = built.stats?.length
    ? `<table class="table table-sm plot-stats mt-2"><thead><tr><th></th><th>n</th><th>mean</th><th>median</th><th>sd</th><th>min</th><th>max</th></tr></thead><tbody>${built.stats
        .map(
          (s) =>
            `<tr><th>${escapeHtml(s.name)}</th>${[
              s.n,
              s.mean,
              s.median,
              s.sd,
              s.min,
              s.max,
            ]
              .map((v) => `<td>${escapeHtml(fmtNum(v))}</td>`)
              .join('')}</tr>`
        )
        .join('')}</tbody></table>`
    : ''
}

async function draw(): Promise<void> {
  if (!store.get().network) return status('Load a network first.', true)
  const kind = value('plotKind')
  const scope: PlotScope = wholeOnly()
    ? 'combined'
    : (value('plotScope') as PlotScope)
  const net = store.get().network
  try {
    const built = await build(kind, scope)
    if (store.get().network !== net) return
    shown = { built, name: kind }
    render()
    status(
      `Drawn: ${el<HTMLSelectElement>('plotKind').selectedOptions[0]?.text ?? kind}.`
    )
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      progress.hide()
      return status('Cancelled.')
    }
    const why = err instanceof Error ? err.message : 'The plot failed.'
    progress.fail(why)
    status(why, true)
  }
}

// select the nodes behind a bar or points; Shift adds to the selection
function selectIds(ids: Iterable<string>, add: boolean): void {
  const set = new Set(ids)
  let n = 0
  ctx.nodeObjects.forEach((node, i) => {
    const on = set.has(node.nodeLayerName) || (add && node.isSelected)
    if (on) n++
    if (node.isSelected === on) return
    node.isSelected = on
    repaintNode(i)
  })
  decideNodeLabelFlags()
  updateSelectedNodesStore() // announces 'selection:changed'
  status(`Selected ${n} node${n === 1 ? '' : 's'} in the scene.`)
}

function wireChart(): void {
  const chart = el('plotChart')
  chart.addEventListener('click', (e) => {
    const key = (e.target as Element).closest<SVGElement>('.ch-hit')?.dataset
      .key
    const ids = key ? shown?.built.picks.get(key) : undefined
    if (ids) selectIds(ids, (e as MouseEvent).shiftKey)
  })
  // a box dragged on the chart selects the points in it
  let start: DOMPoint | null = null
  let box: SVGRectElement | null = null
  const toSvg = (svg: SVGSVGElement, e: MouseEvent) =>
    new DOMPoint(e.clientX, e.clientY).matrixTransform(
      svg.getScreenCTM()?.inverse()
    )
  chart.addEventListener('mousedown', (e) => {
    const svg = chart.querySelector('svg')
    if (!svg || (e.target as Element).closest('.ch-hit')) return
    if (!svg.querySelector('circle.ch-hit')) return
    start = toSvg(svg, e)
    box = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    box.setAttribute('class', 'ch-brush')
    svg.appendChild(box)
    e.preventDefault()
  })
  window.addEventListener('mousemove', (e) => {
    const svg = chart.querySelector('svg')
    if (!start || !box || !svg) return
    const p = toSvg(svg, e)
    box.setAttribute('x', String(Math.min(p.x, start.x)))
    box.setAttribute('y', String(Math.min(p.y, start.y)))
    box.setAttribute('width', String(Math.abs(p.x - start.x)))
    box.setAttribute('height', String(Math.abs(p.y - start.y)))
  })
  window.addEventListener('mouseup', (e) => {
    const svg = chart.querySelector('svg')
    if (!start || !box || !svg) return
    const p = toSvg(svg, e)
    const [x0, x1] = [Math.min(p.x, start.x), Math.max(p.x, start.x)]
    const [y0, y1] = [Math.min(p.y, start.y), Math.max(p.y, start.y)]
    box.remove()
    start = box = null
    if (x1 - x0 < 3 && y1 - y0 < 3) return // a click, not a box
    const ids: string[] = []
    svg.querySelectorAll<SVGCircleElement>('circle.ch-hit').forEach((c) => {
      const [cx, cy] = [
        Number(c.getAttribute('cx')),
        Number(c.getAttribute('cy')),
      ]
      if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1)
        ids.push(...(shown?.built.picks.get(c.dataset.key ?? '') ?? []))
    })
    selectIds(ids, e.shiftKey)
  })
}

// ---------------------------------------------------------------- downloads
function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const standalone = () =>
  shown ? shown.built.svg({ width: 720, standalone: true }) : ''

function savePng(): void {
  const svg = standalone()
  if (!svg) return
  const img = new Image()
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width * 2
    canvas.height = img.height * 2
    const g = canvas.getContext('2d')
    if (!g) return
    g.scale(2, 2)
    g.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    canvas.toBlob((b) => b && save(b, `plot_${shown?.name ?? 'chart'}.png`))
  }
  img.src = url
}

// ---------------------------------------------------------------- wiring
function fillSources(): void {
  const metrics = metricNames()
  const values = valueColumns()
  const groups = (withGraph: boolean) =>
    [
      `<optgroup label="Node metrics">${metrics.map((m) => opt(`metric:${m}`, m)).join('')}</optgroup>`,
      values.length
        ? `<optgroup label="Node values (File → Values)">${values.map((c) => opt(`value:${c}`, c)).join('')}</optgroup>`
        : '',
      withGraph
        ? `<optgroup label="Edges and paths">${opt('weight', 'Edge weights (per channel)')}${opt('components', 'Component sizes')}${opt('paths', 'Shortest-path lengths')}</optgroup>`
        : '',
    ].join('')
  for (const [id, withGraph] of [
    ['plotSource', true],
    ['plotX', false],
    ['plotY', false],
  ] as const) {
    const sel = el<HTMLSelectElement>(id)
    const was = sel.value
    sel.innerHTML = groups(withGraph)
    if ([...sel.options].some((o) => o.value === was)) sel.value = was
  }
  if (!el<HTMLSelectElement>('plotY').dataset.picked && metrics.length > 2)
    el<HTMLSelectElement>('plotY').value = 'metric:Betweenness Centrality'
  const rank = el<HTMLSelectElement>('plotRankMetric')
  const was = rank.value
  rank.innerHTML = metrics.map((m) => opt(m, m)).join('')
  rank.value = metrics.includes(was) ? was : 'Betweenness Centrality'
}

function showOptions(): void {
  const kind = value('plotKind')
  document
    .querySelectorAll<HTMLElement>('#plotsCard [data-plot]')
    .forEach((box) =>
      box.classList.toggle(
        'd-none',
        !box.dataset.plot!.split(' ').includes(kind)
      )
    )
  // log axes are what these are usually read on
  el<HTMLInputElement>('plotLog').checked = kind === 'ck' || kind === 'knn'
}

export function initPlots(): void {
  if (!document.getElementById('plotsCard')) return
  fillSources()
  showOptions()
  el('plotKind').addEventListener('change', showOptions)
  el('plotY').addEventListener(
    'change',
    () => (el('plotY').dataset.picked = '1')
  )
  el('plotDraw').addEventListener('click', () => void draw())
  el('plotCancel').addEventListener('click', () => abort?.abort())
  el('plotSvg').addEventListener('click', () =>
    save(
      new Blob([standalone()], { type: 'image/svg+xml' }),
      `plot_${shown?.name ?? 'chart'}.svg`
    )
  )
  el('plotPng').addEventListener('click', savePng)
  el('plotCsv').addEventListener('click', () => {
    if (shown)
      save(
        new Blob([toCsv(shown.built.table)], { type: 'text/csv' }),
        `plot_${shown.name}.csv`
      )
  })
  wireChart()
  const forget = () => {
    cache = null
    shown = null
    el('plotBox').classList.add('d-none')
    fillSources()
  }
  for (const event of ['network:loaded', 'workspace:changed'] as const)
    bus.on(event, forget)
  bus.on('values:loaded', fillSources)
  // drawn to the box's width, which is 0 while the panel is hidden
  document
    .querySelector('[data-bs-target="#panel-plots"]')
    ?.addEventListener('shown.bs.tab', render)
}
