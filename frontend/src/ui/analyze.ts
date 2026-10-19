// The Analyze menu: one panel per kind of analysis — Metrics (node metrics
// for sizes and colours), Statistics (network statistics, layer and network
// comparison), Plots (ui/plots.ts), Perturbation (ui/perturbation.ts),
// Explore (ui/explore.ts) and Annotations & Groups (ui/annotations.ts,
// ui/groups.ts); Data Tables (ui/data.ts) holds their reports. Layers come
// from the Layer selection tab's ticks (all layers when none is ticked).

import { api, type TopologyGraph, type TopologyScope } from '../api/client'
import { bus } from '../bus'
import { store } from '../store'
import { ctx } from '../three'
import { applyTopology } from '../actions/layout'
import { startLoader, finishLoader } from '../actions/screen'
import { PROGRESS_HTML, ProgressBar } from './progress'
import { selectedChannels } from './layouts'
import { EXPLORE_HTML, initExplore } from './explore'
import { PERTURBATION_HTML, initPerturbation } from './perturbation'
import { ANNOTATIONS_HTML, initAnnotations } from './annotations'
import { GROUPS_HTML, initGroups } from './groups'
import { PLOTS_HTML, initPlots } from './plots'
import { FOLD_ALL_HTML, openCard } from './sections'
import { showTab } from './tabs'

const analyzeProgress = new ProgressBar('analyzeProgress')

// backend services/multilayer.py MULTILAYER_METRICS
const MULTILAYER_METRICS = [
  'Multiplex Degree',
  'Participation Coefficient',
  'Multilayer PageRank',
]

// the panels of the Analyze menu (Data Tables aside), in menu order
export const ANALYSIS_PANELS = [
  'metrics',
  'statistics',
  'plots',
  'perturbation',
  'explore',
  'annotations',
] as const

const panel = (body: string, fold = false) =>
  `<div class="col-md-8 col-lg-6 layout-panel">${fold ? FOLD_ALL_HTML : ''}${body}</div>`

// which layers an analysis covers (describeLayers fills every one)
export const LAYERS_NOTE = (id = '') =>
  `<p class="small text-secondary mb-2 analyze-layers"${id ? ` id="${id}"` : ''}></p>`

const METRICS_HTML = panel(`
  ${LAYERS_NOTE('analyzeLayers')}
  <details class="lp-section lp-more" id="analyzeCard_metrics" open>
  <summary>Node Metrics</summary>
  <div class="mb-2">
    <label class="form-label" for="topologyScaleMetricChoice">Scale Nodes by Topology Metric:</label>
    <select class="form-select" id="topologyScaleMetricChoice"></select>
  </div>
  <div class="mb-2">
    <div class="form-check form-check-inline" data-multilayer-only>
      <input class="form-check-input" type="radio" name="analysisScope" id="analysisScope_perLayer" data-multilayer-only value="perLayer" checked />
      <label class="form-check-label" for="analysisScope_perLayer">Per layer</label>
    </div>
    <div class="form-check form-check-inline" data-multilayer-only>
      <input class="form-check-input" type="radio" name="analysisScope" id="analysisScope_allLayers" value="allLayers" />
      <label class="form-check-label" for="analysisScope_allLayers">Across layers</label>
    </div>
    <div class="form-text" data-multilayer-only>Multiplex metrics always span the layers.</div>
  </div>
  <div class="mb-2 d-flex flex-wrap align-items-center gap-2">
    <label class="form-label mb-0" for="topologyGraph">Treat the network as:</label>
    <select class="form-select form-select-sm" id="topologyGraph" style="width:auto" aria-label="Graph type for the metrics">
      <option value="undirected" selected>undirected (parallel edges merged)</option>
      <option value="directed">directed (source → target)</option>
      <option value="multi">multi-edged (every channel its own edge)</option>
    </select>
  </div>
  <div class="form-text mb-2">Directed counts paths and ranks along the edge direction; multi-edged counts every channel between two nodes (the clustering coefficient still merges them).</div>
  <div class="form-check mb-2">
    <input class="form-check-input" type="checkbox" id="colorByMetricCheckbox" />
    <label class="form-check-label" for="colorByMetricCheckbox">Also Color Nodes by Metric (blue = low, red = high)</label>
  </div>
  <button id="runTopologyScale" class="btn btn-primary">Run</button>
  ${PROGRESS_HTML('analyzeProgress', 'Node metric progress')}
  <div id="analyze_status" class="small mb-1"></div>
  </details>
`)

const STATISTICS_HTML = panel(`
  ${LAYERS_NOTE()}
  <details class="lp-section lp-more" id="analyzeCard_network" open>
  <summary>Network</summary>
  <div class="d-flex flex-wrap gap-2">
    <button id="networkStats" class="btn btn-outline-primary" title="Density, components, diameter, clustering, degree distribution… shown in Data Tables">Network Statistics</button>
    <button id="compareLayers" class="btn btn-outline-primary" data-multilayer-only title="Node and edge overlap between layers, with an UpSet plot, shown in Data Tables">Compare Layers</button>
  </div>
  <div class="form-text mt-2">Two loaded networks side by side: <button type="button" class="btn btn-link btn-sm p-0 align-baseline" id="statsCompareNetworks">Compare Networks</button> in File → Loaded networks.</div>
  <div id="stats_status" class="small mt-2"></div>
  </details>
`)

const PANEL_HTML: Record<(typeof ANALYSIS_PANELS)[number], string> = {
  metrics: METRICS_HTML,
  statistics: STATISTICS_HTML,
  plots: panel(`${LAYERS_NOTE()}${PLOTS_HTML}`),
  perturbation: panel(`${LAYERS_NOTE()}${PERTURBATION_HTML}`, true),
  explore: panel(EXPLORE_HTML),
  annotations: panel(`${ANNOTATIONS_HTML}${GROUPS_HTML}`, true),
}

function say(id: string, msg: string, isError: boolean): void {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = msg
  el.className = `small ${id === 'stats_status' ? 'mt-2' : 'mb-1'} ${isError ? 'text-danger' : 'text-success'}`
}
const status = (msg: string, isError = false) =>
  say('analyze_status', msg, isError)
const statsStatus = (msg: string, isError = false) =>
  say('stats_status', msg, isError)

// the Layer selection tab's ticks, or every layer when nothing is ticked
function analysisLayers(): string[] {
  const st = store.get()
  return st.selectedLayers.length
    ? st.selectedLayers
    : (st.network?.layers ?? [])
}

function describeLayers(): void {
  const st = store.get()
  const text = !st.network
    ? 'Load a network to analyse it.'
    : st.selectedLayers.length
      ? `Analysing the ${st.selectedLayers.length} layer(s) ticked in Layer selection.`
      : 'Analysing all layers (tick layers in the Layer selection tab to narrow this).'
  document
    .querySelectorAll('.analyze-layers')
    .forEach((el) => (el.textContent = text))
}

async function onRunTopology(): Promise<void> {
  const st = store.get()
  if (!st.network) return status('Upload a network first.', true)
  const metric = (
    document.getElementById('topologyScaleMetricChoice') as HTMLSelectElement
  ).value
  if (metric === '-') return status('Select a topology metric.', true)
  const scope = (document.querySelector<HTMLInputElement>(
    'input[name="analysisScope"]:checked'
  )?.value ?? 'perLayer') as TopologyScope
  startLoader()
  analyzeProgress.computing(`Computing ${metric} on the server`)
  try {
    await applyTopology(
      {
        nodes: st.network.nodes,
        edges: st.network.edges,
        metric,
        scope:
          MULTILAYER_METRICS.includes(metric) || ctx.networkMode === 'single'
            ? 'allLayers'
            : scope,
        selected_layers: analysisLayers(),
        selected_channels: selectedChannels(),
        graph: (document.getElementById('topologyGraph') as HTMLSelectElement)
          .value as TopologyGraph,
      },
      (document.getElementById('colorByMetricCheckbox') as HTMLInputElement)
        .checked
    )
    analyzeProgress.done('Node scaling applied')
    status('Node scaling applied.')
  } catch (err) {
    analyzeProgress.hide()
    status(
      err instanceof Error ? err.message : 'Topology scaling failed.',
      true
    )
  } finally {
    finishLoader()
  }
}

async function onCompareLayers(): Promise<void> {
  const st = store.get()
  if (!st.network) return statsStatus('Upload a network first.', true)
  const layers = analysisLayers()
  if (layers.length < 2)
    return statsStatus('Compare needs at least two layers.', true)
  try {
    const res = await api.layerSimilarity({
      nodes: st.network.nodes,
      edges: st.network.edges,
      layers,
    })
    bus.emit('layers:similarity', res)
    statsStatus(
      'Layer similarity is in Analyze → Data Tables → Layer Similarity.'
    )
  } catch (err) {
    statsStatus(err instanceof Error ? err.message : 'Comparison failed.', true)
  }
}

async function onNetworkStats(): Promise<void> {
  const st = store.get()
  if (!st.network) return statsStatus('Upload a network first.', true)
  try {
    const res = await api.networkStats({
      nodes: st.network.nodes,
      edges: st.network.edges,
      layers: analysisLayers(),
    })
    bus.emit('network:stats', res)
    statsStatus(
      'Network statistics are in Analyze → Data Tables → Network Statistics.'
    )
  } catch (err) {
    statsStatus(err instanceof Error ? err.message : 'Statistics failed.', true)
  }
}

export function initAnalyzePanel(): void {
  for (const id of ANALYSIS_PANELS) {
    const pane = document.getElementById(`panel-${id}`)
    if (pane) pane.innerHTML = PANEL_HTML[id]
  }
  const metricSel = document.getElementById(
    'topologyScaleMetricChoice'
  ) as HTMLSelectElement | null
  if (!metricSel) return
  metricSel.innerHTML = ['-', ...(store.get().config?.topology_metrics ?? [])]
    .map((m) => `<option value="${m}">${m}</option>`)
    .join('')
  document
    .getElementById('runTopologyScale')
    ?.addEventListener('click', () => void onRunTopology())
  document
    .getElementById('compareLayers')
    ?.addEventListener('click', () => void onCompareLayers())
  document
    .getElementById('networkStats')
    ?.addEventListener('click', () => void onNetworkStats())
  document
    .getElementById('statsCompareNetworks')
    ?.addEventListener('click', () => {
      showTab('#panel-file')
      const pick = document.getElementById('compareWith')
      openCard(pick) // File → Loaded networks may be folded
      pick?.scrollIntoView({ block: 'center' })
      pick?.focus()
    })
  initExplore()
  initPerturbation()
  initPlots()
  initAnnotations()
  initGroups()
  describeLayers()
  bus.on('network:loaded', describeLayers)
  bus.on('layers:selected', describeLayers)
  for (const id of ANALYSIS_PANELS)
    document
      .querySelector(`[data-bs-target="#panel-${id}"]`)
      ?.addEventListener('shown.bs.tab', describeLayers)
}
