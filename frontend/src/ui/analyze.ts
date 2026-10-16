// Analysis panel — node metrics (topology scaling), network statistics, layer
// comparison, exploration (hops, paths, attribute search) and annotation /
// enrichment. Gathered here from the Layout and Nodes panels so "lay it out",
// "edit it" and "analyse it" each have one place. Layers come from the Layout
// tab's selection (all layers when none is selected).

import { api, type TopologyGraph, type TopologyScope } from '../api/client'
import { bus } from '../bus'
import { store } from '../store'
import { ctx } from '../three'
import { applyTopology } from '../actions/layout'
import { startLoader, finishLoader } from '../actions/screen'
import { PROGRESS_HTML, ProgressBar } from './progress'

const analyzeProgress = new ProgressBar('analyzeProgress')
import { selectedChannels } from './layouts'
import { EXPLORE_HTML, initExplore } from './explore'
import { ANNOTATIONS_HTML, initAnnotations } from './annotations'
import { GROUPS_HTML, initGroups } from './groups'

// backend services/multilayer.py MULTILAYER_METRICS
const MULTILAYER_METRICS = [
  'Multiplex Degree',
  'Participation Coefficient',
  'Multilayer PageRank',
]

const ANALYZE_HTML = `
<div class="col-md-8 col-lg-6">
  <p class="small text-secondary mb-2" id="analyzeLayers"></p>
  <h6>Node Metrics</h6>
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
  <button id="runTopologyScale" class="btn btn-primary mb-3">Run</button>

  <h6>Network</h6>
  <div class="d-flex flex-wrap gap-2 mb-2">
    <button id="networkStats" class="btn btn-outline-primary" title="Density, components, diameter, clustering, degree distribution… shown in Data Tables">Network Statistics</button>
    <button id="compareLayers" class="btn btn-outline-primary" data-multilayer-only title="Node and edge overlap between layers, shown in Data Tables">Compare Layers</button>
  </div>
   ${PROGRESS_HTML('analyzeProgress', 'Analysis progress')}
  <div id="analyze_status" class="small mb-3"></div>

  ${EXPLORE_HTML}
  ${ANNOTATIONS_HTML}
  ${GROUPS_HTML}
</div>
`

function status(msg: string, isError = false): void {
  const el = document.getElementById('analyze_status')
  if (!el) return
  el.textContent = msg
  el.className = `small mb-3 ${isError ? 'text-danger' : 'text-success'}`
}

// the Layer selection tab's ticks, or every layer when nothing is ticked
function analysisLayers(): string[] {
  const st = store.get()
  return st.selectedLayers.length
    ? st.selectedLayers
    : (st.network?.layers ?? [])
}

function describeLayers(): void {
  const el = document.getElementById('analyzeLayers')
  if (!el) return
  const st = store.get()
  el.textContent = !st.network
    ? 'Load a network to analyse it.'
    : st.selectedLayers.length
      ? `Analysing the ${st.selectedLayers.length} layer(s) ticked in Layer selection.`
      : 'Analysing all layers (tick layers in the Layer selection tab to narrow this).'
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
  if (!st.network) return status('Upload a network first.', true)
  const layers = analysisLayers()
  if (layers.length < 2)
    return status('Compare needs at least two layers.', true)
  try {
    const res = await api.layerSimilarity({
      nodes: st.network.nodes,
      edges: st.network.edges,
      layers,
    })
    bus.emit('layers:similarity', res)
    status('Layer similarity is in Analyze → Data Tables → Layer Similarity.')
  } catch (err) {
    status(err instanceof Error ? err.message : 'Comparison failed.', true)
  }
}

async function onNetworkStats(): Promise<void> {
  const st = store.get()
  if (!st.network) return status('Upload a network first.', true)
  try {
    const res = await api.networkStats({
      nodes: st.network.nodes,
      edges: st.network.edges,
      layers: analysisLayers(),
    })
    bus.emit('network:stats', res)
    status(
      'Network statistics are in Analyze → Data Tables → Network Statistics.'
    )
  } catch (err) {
    status(err instanceof Error ? err.message : 'Statistics failed.', true)
  }
}

export function initAnalyzePanel(): void {
  const pane = document.getElementById('panel-analyze')
  if (!pane) return
  pane.innerHTML = ANALYZE_HTML
  const metricSel = document.getElementById(
    'topologyScaleMetricChoice'
  ) as HTMLSelectElement
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
  initExplore()
  initAnnotations()
  initGroups()
  describeLayers()
  bus.on('network:loaded', describeLayers)
  document
    .querySelector('[data-bs-target="#panel-analyze"]')
    ?.addEventListener('shown.bs.tab', describeLayers)
}
