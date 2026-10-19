// Analyze → Perturbation: knock nodes or edges out and
// compare the network before and after (Data Tables, a faded or hidden
// preview in the scene, colour by change, apply as a new network), and attack
// it step by step for robustness curves. The server does the graph work
// (POST /api/perturbation/knockout and /attack); actions/perturbation.ts
// turns the results into tables, colours and the chart.

import {
  api,
  type AttackStrategy,
  type Curve,
  type KnockoutRequest,
  type KnockoutResponse,
  type NetworkData,
  type RankMetric,
} from '../api/client'
import { bus } from '../bus'
import { history } from '../commands/base'
import { captureLooks, LookCommand, type Looks } from '../commands/perturbation'
import { store } from '../store'
import { ctx } from '../three'
import { escapeHtml } from '../utils'
import { legend, setLegend, type Legend } from '../actions/legend'
import { startLoader, finishLoader } from '../actions/screen'
import { registerSelectionAction } from '../actions/right_click_menu'
import {
  affectedObjects,
  CHANGE_LABELS,
  CHANGE_STOPS,
  changeColors,
  CURVE_LABELS,
  KNOCKED_OUT_COLOR,
  knockoutMeasureTable,
  knockoutNodeTable,
  perturbedNetwork,
  robustnessSvg,
  robustnessTable,
  seriesLabel,
  toCsv,
  type ChangeMeasure,
  type CurveMeasure,
  type Series,
  WHOLE,
} from '../actions/perturbation'
import { renderKnockoutTables, renderRobustnessTable } from './data'
import { askImportAs, placeNetwork } from './import_as'
import { selectedChannels } from './layouts'
import { PROGRESS_HTML, ProgressBar } from './progress'
import { showTab } from './tabs'

export const PERTURBATION_HTML = `
<div class="form-text mt-0 mb-2">Knock nodes or edges out and see what changes, or attack the network step by step to see how robust it is: one graph per layer and one for the whole network, undirected, parallel edges merged, distances in hops.</div>
<details id="perturbation_card" class="lp-section lp-more perturb-card" open>
  <summary>Knock out</summary>
  <div class="mt-2">
    <div class="lp-grid mb-2">
      <div>
        <label class="form-label small" for="koNodes">Nodes</label>
        <select id="koNodes" class="form-select form-select-sm">
          <option value="selected">The selected nodes</option>
          <option value="names">Nodes by name</option>
          <option value="top">The top k by a metric</option>
          <option value="none">No nodes (edges only)</option>
        </select>
      </div>
      <div data-ko="names" class="d-none">
        <label class="form-label small" for="koNames">Names</label>
        <input id="koNames" class="form-control form-control-sm" placeholder="TP53, EGFR" />
      </div>
      <div data-ko="top" class="d-none">
        <label class="form-label small" for="koTopMetric">Metric</label>
        <select id="koTopMetric" class="form-select form-select-sm">
          <option value="degree">Degree</option>
          <option value="betweenness">Betweenness</option>
          <option value="pagerank">PageRank</option>
        </select>
      </div>
      <div data-ko="top" class="d-none">
        <label class="form-label small" for="koTopK">k</label>
        <input id="koTopK" type="number" min="1" step="1" value="5" class="form-control form-control-sm" />
      </div>
      <div data-ko="top" class="d-none" data-multilayer-only>
        <div class="form-check mb-1">
          <input class="form-check-input" type="checkbox" id="koTopPerLayer" />
          <label class="form-check-label small" for="koTopPerLayer">k in each layer</label>
        </div>
      </div>
    </div>
    <div class="form-check mb-2" data-multilayer-only>
      <input class="form-check-input" type="checkbox" id="koEveryCopy" />
      <label class="form-check-label small" for="koEveryCopy">Every copy across layers (multiplex knockout)</label>
    </div>
    <div class="small mb-1">Edges</div>
    <div class="d-flex flex-wrap gap-3 mb-2">
      <div class="form-check">
        <input class="form-check-input" type="checkbox" id="koSelectedEdges" />
        <label class="form-check-label small" for="koSelectedEdges">The selected edges</label>
      </div>
      <div class="form-check" data-multilayer-only>
        <input class="form-check-input" type="checkbox" id="koInterLayer" />
        <label class="form-check-label small" for="koInterLayer">The inter-layer edges</label>
      </div>
    </div>
    <div class="lp-grid mb-2">
      <div id="koChannelBox" class="d-none">
        <label class="form-label small" for="koChannel">A channel</label>
        <select id="koChannel" class="form-select form-select-sm"></select>
      </div>
      <div>
        <label class="form-label small" for="koRandom">A random share of edges (%)</label>
        <input id="koRandom" type="number" min="0" max="100" step="5" value="0" class="form-control form-control-sm" />
      </div>
      <div>
        <label class="form-label small" for="koPropagate" title="Network propagation: a random walk that goes back to these nodes at each step with the restart probability">Propagate from (optional)</label>
        <input id="koPropagate" class="form-control form-control-sm" placeholder="names, e.g. a drug's targets" />
      </div>
      <div>
        <label class="form-label small" for="koRestart">Restart probability</label>
        <input id="koRestart" type="number" min="0.05" max="0.95" step="0.05" value="0.5" class="form-control form-control-sm" />
      </div>
    </div>
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
      <button id="runKnockout" class="btn btn-primary btn-sm">Run Knockout</button>
      <label class="small" for="koShow">Knocked out in the scene:</label>
      <select id="koShow" class="form-select form-select-sm" style="width:auto">
        <option value="fade" selected>faded</option>
        <option value="hide">hidden</option>
        <option value="none">as they are</option>
      </select>
    </div>
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
      <button id="koColour" class="btn btn-outline-primary btn-sm" disabled title="Blue: lost, red: gained, pale: no change; knocked-out nodes grey">Colour by Change</button>
      <select id="koColourBy" class="form-select form-select-sm" style="width:auto" aria-label="Measure to colour by" disabled></select>
      <button id="koRestore" class="btn btn-outline-primary btn-sm" disabled title="Back to how the nodes and edges looked before the knockout (an undo step of its own)">Restore</button>
      <button id="koApply" class="btn btn-outline-primary btn-sm" disabled title="Load the network without the knocked-out nodes and edges, through the Import as popup">Apply as a New Network</button>
      <button id="koReports" class="btn btn-outline-primary btn-sm" disabled>Reports</button>
    </div>
    <div class="run-progress">
      ${PROGRESS_HTML('perturbProgress', 'Knockout progress')}
      <button id="koCancel" class="btn btn-sm btn-outline-secondary mt-2 d-none">Cancel</button>
    </div>
    <div id="perturb_status" class="small mb-2" aria-live="polite"></div>
  </div>
</details>
<details id="attack_card" class="lp-section lp-more perturb-card" open>
  <summary>Attack and robustness</summary>
  <div class="mt-2">
    <div class="lp-grid mb-2">
      <div>
        <label class="form-label small" for="attackStrategy">Remove nodes</label>
        <select id="attackStrategy" class="form-select form-select-sm">
          <option value="random">At random (failure)</option>
          <option value="degree">By degree (targeted)</option>
          <option value="betweenness">By betweenness (targeted)</option>
        </select>
      </div>
      <div>
        <label class="form-label small" for="attackRanking">Ranking</label>
        <select id="attackRanking" class="form-select form-select-sm" disabled>
          <option value="again" selected>Recalculated after each step</option>
          <option value="once">Computed once</option>
        </select>
      </div>
      <div>
        <label class="form-label small" for="attackRuns">Random runs to average</label>
        <input id="attackRuns" type="number" min="1" max="20" step="1" value="5" class="form-control form-control-sm" />
      </div>
      <div>
        <label class="form-label small" for="attackSteps">Steps (up to 50)</label>
        <input id="attackSteps" type="number" min="1" max="50" step="1" value="20" class="form-control form-control-sm" />
      </div>
      <div>
        <label class="form-label small" for="attackMax">Remove up to (%)</label>
        <input id="attackMax" type="number" min="5" max="100" step="5" value="100" class="form-control form-control-sm" />
      </div>
      <div>
        <div class="form-check mb-1">
          <input class="form-check-input" type="checkbox" id="attackEfficiency" />
          <label class="form-check-label small" for="attackEfficiency" title="Slower; for graphs up to 2,000 nodes">Global efficiency too</label>
        </div>
      </div>
    </div>
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
      <button id="runAttack" class="btn btn-primary btn-sm">Run Attack</button>
      <div class="form-check mb-0">
        <input class="form-check-input" type="checkbox" id="attackKeep" />
        <label class="form-check-label small" for="attackKeep">Keep earlier runs on the chart</label>
      </div>
    </div>
    <div id="attackBox" class="d-none">
      <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
        <select id="attackMeasure" class="form-select form-select-sm" style="width:auto" aria-label="Measure on the chart">
          ${Object.entries(CURVE_LABELS)
            .map(([k, v]) => `<option value="${k}">${v}</option>`)
            .join('')}
        </select>
        <button id="attackSvg" class="btn btn-outline-primary btn-sm">Download SVG</button>
        <button id="attackCsv" class="btn btn-outline-primary btn-sm">Download CSV</button>
      </div>
      <div id="attackChart" class="robustness-box"></div>
    </div>
    <div class="run-progress">
      ${PROGRESS_HTML('attackProgress', 'Attack progress')}
      <button id="attackCancel" class="btn btn-sm btn-outline-secondary mt-2 d-none">Cancel</button>
    </div>
    <div id="attack_status" class="small mt-2" aria-live="polite"></div>
  </div>
</details>
`

const progress = new ProgressBar('perturbProgress')
const attackProgress = new ProgressBar('attackProgress')
// the runs in flight, for Cancel
let koAbort: AbortController | null = null
let attackAbort: AbortController | null = null

const isCancel = (err: unknown) =>
  err instanceof DOMException && err.name === 'AbortError'

const showCancel = (id: string, on: boolean) =>
  document.getElementById(id)?.classList.toggle('d-none', !on)

const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T
const value = (id: string) => el<HTMLInputElement>(id).value
const checked = (id: string) => el<HTMLInputElement>(id).checked

function say(id: string, msg: string, isError = false): void {
  const out = document.getElementById(id)
  if (!out) return
  out.textContent = msg
  out.className = `small ${id === 'attack_status' ? 'mt-2' : 'mb-2'} ${isError ? 'text-danger' : 'text-success'}`
}
const status = (msg: string, isError = false) =>
  say('perturb_status', msg, isError)
const attackStatus = (msg: string, isError = false) =>
  say('attack_status', msg, isError)

const plural = (n: number, word: string) =>
  `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`

// the Layer selection tab's ticks, or every layer when nothing is ticked
function analysedLayers(): string[] {
  const st = store.get()
  return st.selectedLayers.length
    ? st.selectedLayers
    : (st.network?.layers ?? [])
}

// one graph in space: the per-layer graphs are not what the user looks at
const wholeOnly = () => ctx.networkMode === 'single'

const names = (text: string) =>
  text
    .split(/[,;\n\t]+/)
    .map((s) => s.trim())
    .filter(Boolean)

const download = (name: string, text: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------- knockout
interface KnockoutRun {
  res: KnockoutResponse
  network: NetworkData // the network it ran on
  what: string // "2 nodes (TP53, EGFR) and 5 edges"
  affected: { nodes: number[]; edges: number[] }
  baseline: Looks // how the analysed nodes and touched edges looked before
  legend: Legend | null // the legend before Colour by change
  touched: boolean // a preview or a colouring changed the scene since
}
let last: KnockoutRun | null = null

function knockoutRequest(net: NetworkData, layers: string[]): KnockoutRequest {
  const req: KnockoutRequest = {
    nodes: net.nodes,
    edges: net.edges,
    layers,
    selected_channels: selectedChannels(),
    every_copy: checked('koEveryCopy') && !wholeOnly(),
    remove_inter_layer: checked('koInterLayer') && !wholeOnly(),
    random_edge_fraction:
      Math.min(100, Math.max(0, Number(value('koRandom')) || 0)) / 100,
    restart: Math.min(0.95, Math.max(0.05, Number(value('koRestart')) || 0.5)),
    propagation_seeds: names(value('koPropagate')),
  }
  const from = value('koNodes')
  if (from === 'selected')
    req.remove_nodes = ctx.nodeObjects.flatMap((n) =>
      n.isSelected ? [n.nodeLayerName] : []
    )
  else if (from === 'names') req.remove_names = names(value('koNames'))
  else if (from === 'top')
    req.top_k = {
      metric: value('koTopMetric') as RankMetric,
      k: Math.max(1, Math.round(Number(value('koTopK')) || 1)),
      per_layer: checked('koTopPerLayer') && !wholeOnly(),
    }
  if (checked('koSelectedEdges'))
    req.remove_edges = ctx.edgeObjects.flatMap((e) =>
      e.isSelected ? [{ src: e.source, trg: e.target }] : []
    )
  const channel = value('koChannel')
  if (channel) req.remove_channels = [channel]
  return req
}

// what was knocked out, in a few words
function describe(res: KnockoutResponse, net: NetworkData): string {
  const label = new Map(net.nodes.map((n) => [n.id, n.label]))
  const labels = [
    ...new Set(res.removed_nodes.map((id) => label.get(id) ?? id)),
  ]
  const count = res.removed_nodes.length
  const nodes = !count
    ? ''
    : labels.length <= 4
      ? `${plural(count, 'node')} (${labels.join(', ')})`
      : plural(count, 'node')
  const edges = res.removed_edges.length
    ? plural(res.removed_edges.length, 'edge')
    : ''
  return [nodes, edges].filter(Boolean).join(' and ')
}

function summary(run: KnockoutRun): string {
  const { res } = run
  const k = res.after.length - 1
  const [b, a] = [res.before[k], res.after[k]]
  const eff = b.efficiency
    ? `, efficiency ${Math.round(((a.efficiency - b.efficiency) / b.efficiency) * 100)}%`
    : ''
  const where = res.after.length > 1 && !wholeOnly() ? `${a.name}: ` : ''
  const cut = a.cut_off ? `; ${plural(a.cut_off, 'node')} cut off` : ''
  const warn = res.warnings.length ? ` ${res.warnings.join(' ')}` : ''
  return (
    `Knocked out ${run.what}. ${where}largest component ${b.largest_component} → ${a.largest_component} nodes, ` +
    `${plural(a.components, 'component')} (was ${b.components})${eff}${cut}. ` +
    `Reports in Data Tables → Knockout.${warn}`
  )
}

// fade, hide or show the knocked-out nodes and edges, from the baseline
function previewLooks(run: KnockoutRun, mode: string): Looks {
  const factor = mode === 'fade' ? 0.15 : mode === 'hide' ? 0 : 1
  const looks: Looks = { nodes: new Map(), edges: new Map() }
  for (const i of run.affected.nodes)
    looks.nodes.set(i, {
      alpha: (run.baseline.nodes.get(i)?.alpha ?? 1) * factor,
    })
  for (const i of run.affected.edges)
    looks.edges.set(i, (run.baseline.edges.get(i) ?? 1) * factor)
  return looks
}

function preview(mode: string): void {
  if (!last || !onScreen(last)) return
  const words = { fade: 'Fade', hide: 'Hide', none: 'Show' }[mode] ?? 'Show'
  history.execute(
    new LookCommand(`${words} the knocked-out nodes`, previewLooks(last, mode))
  )
  last.touched = mode !== 'none'
}

// the run is about the network on screen (not replaced or switched since)
const onScreen = (run: KnockoutRun) => store.get().network === run.network

function enableResults(on: boolean): void {
  for (const id of [
    'koColour',
    'koColourBy',
    'koRestore',
    'koApply',
    'koReports',
  ])
    el<HTMLButtonElement>(id).disabled = !on
}

async function runKnockout(): Promise<void> {
  const net = store.get().network
  if (!net) return status('Load a network first.', true)
  const layers = analysedLayers()
  const req = knockoutRequest(net, layers)
  if (value('koNodes') === 'selected' && !req.remove_nodes?.length) {
    const edgesToo =
      req.remove_edges?.length ||
      req.remove_channels?.length ||
      req.remove_inter_layer ||
      req.random_edge_fraction
    if (!edgesToo)
      return status(
        'Select the nodes to knock out first (or choose another way above).',
        true
      )
  }
  // a new run starts from the scene as the last one left it
  if (last && onScreen(last)) restore(false)
  koAbort?.abort()
  const abort = (koAbort = new AbortController())
  showCancel('koCancel', true)
  startLoader()
  try {
    const res = await api.knockout(
      req,
      progress.upload(
        req.propagation_seeds?.length
          ? 'Knocking out, propagating before and after'
          : 'Knocking out, measuring before and after'
      ),
      abort.signal
    )
    if (store.get().network !== net) return progress.hide()
    const affected = affectedObjects(res, net)
    const layerSet = new Set(layers)
    const analysed = ctx.nodeObjects.flatMap((n, i) =>
      layerSet.has(n.layer) ? [i] : []
    )
    const run: KnockoutRun = {
      res,
      network: net,
      what: describe(res, net),
      affected,
      baseline: captureLooks(analysed, affected.edges),
      legend: legend(),
      touched: false,
    }
    last = run
    if (wholeOnly()) {
      res.before = res.before.slice(-1)
      res.after = res.after.slice(-1)
    }
    renderKnockoutTables(
      knockoutMeasureTable(res.before, res.after),
      knockoutNodeTable(res.nodes, layers.length > 1 && !wholeOnly())
    )
    const colourBy = el<HTMLSelectElement>('koColourBy')
    const measures: ChangeMeasure[] = ['betweenness', 'degree', 'closeness']
    if (res.nodes.some((n) => n.propagation !== null))
      measures.push('propagation')
    colourBy.innerHTML = measures
      .map((m) => `<option value="${m}">${CHANGE_LABELS[m]}</option>`)
      .join('')
    enableResults(true)
    if (value('koShow') !== 'none') preview(value('koShow'))
    const k = res.after.length - 1
    progress.done(
      `Knocked out ${run.what}: largest component ${res.before[k].largest_component} → ${res.after[k].largest_component}`,
      6000
    )
    status(summary(run))
  } catch (err) {
    if (isCancel(err)) {
      progress.hide()
      status('Knockout cancelled.')
    } else {
      const why = err instanceof Error ? err.message : 'The knockout failed.'
      progress.fail(why)
      status(why, true)
    }
  } finally {
    if (koAbort === abort) koAbort = null
    showCancel('koCancel', false)
    finishLoader()
  }
}

function colourByChange(): void {
  if (!last || !onScreen(last)) return
  const m = value('koColourBy') as ChangeMeasure
  const { colors, max } = changeColors(last.res.nodes, m)
  const looks: Looks = {
    nodes: new Map(),
    edges: new Map(),
    priority: 'default',
  }
  ctx.nodeObjects.forEach((n, i) => {
    const c = colors.get(n.nodeLayerName)
    if (c) looks.nodes.set(i, { color: c, imported: c })
  })
  history.execute(
    new LookCommand(`Colour by change in ${CHANGE_LABELS[m]}`, looks)
  )
  last.touched = true
  setLegend({
    title: `Change in ${CHANGE_LABELS[m].toLowerCase()}`,
    gradient: { min: -max, max, stops: CHANGE_STOPS },
    entries: last.res.removed_nodes.length
      ? [
          {
            label: 'Knocked out',
            color: KNOCKED_OUT_COLOR,
            count: last.res.removed_nodes.length,
          },
        ]
      : [],
  })
  status(
    `Coloured by the change in ${CHANGE_LABELS[m].toLowerCase()}: blue lost, red gained (up to ${Number(max.toPrecision(3))}).`
  )
}

// back to the looks before the knockout: one undo step
function restore(report = true): void {
  if (!last || !onScreen(last)) return
  if (!last.touched) {
    if (report)
      status(
        'Nothing to restore: the scene shows the nodes and edges as before.'
      )
    return
  }
  last.touched = false
  history.execute(new LookCommand('Restore after the knockout', last.baseline))
  setLegend(last.legend)
  el<HTMLSelectElement>('koShow').value = 'none'
  if (report)
    status(
      'Restored: the nodes and edges look as before the knockout (undo brings the preview back).'
    )
}

async function applyAsNetwork(): Promise<void> {
  if (!last || !onScreen(last)) return
  const run = last
  const data = perturbedNetwork(run.network, run.res)
  const choice = await askImportAs(`The network without ${run.what} (knockout)`)
  if (!choice) return
  startLoader()
  try {
    restore(false) // the original keeps its looks when it is switched back to
    status(
      await placeNetwork(data, choice, `Knockout: ${run.what}`.slice(0, 80))
    )
    showTab('#panel-main-view')
  } catch (err) {
    status(err instanceof Error ? err.message : 'Loading failed.', true)
  } finally {
    finishLoader()
  }
}

// ---------------------------------------------------------------- attack
let series: Series[] = []

function drawChart(): void {
  const box = el('attackBox')
  box.classList.toggle('d-none', series.length === 0)
  el('attackChart').innerHTML = series.length
    ? robustnessSvg(series, value('attackMeasure') as CurveMeasure, {
        width: el('attackChart').clientWidth - 16, // less the box's padding
      })
    : ''
}

// One request per curve, so the bar shows real progress and Cancel stops
// between curves: the whole network first (it matters most), then each layer
// with only its own nodes and edges.
interface CurveJob {
  name: string
  layers: string[]
  whole: boolean
}

function curveJobs(layers: string[]): CurveJob[] {
  if (wholeOnly() || layers.length === 1)
    return [
      { name: layers.length === 1 ? layers[0] : WHOLE, layers, whole: true },
    ]
  return [
    { name: WHOLE, layers, whole: true },
    ...layers.map((l) => ({ name: l, layers: [l], whole: false })),
  ]
}

async function runAttack(): Promise<void> {
  const net = store.get().network
  if (!net) return attackStatus('Load a network first.', true)
  const strategy = value('attackStrategy') as AttackStrategy
  const recalculate = value('attackRanking') === 'again'
  const base = {
    selected_channels: selectedChannels(),
    strategy,
    recalculate,
    runs: Math.min(
      20,
      Math.max(1, Math.round(Number(value('attackRuns')) || 5))
    ),
    steps: Math.min(
      50,
      Math.max(1, Math.round(Number(value('attackSteps')) || 20))
    ),
    max_fraction:
      Math.min(100, Math.max(5, Number(value('attackMax')) || 100)) / 100,
    efficiency: checked('attackEfficiency'),
  }
  const jobs = curveJobs(analysedLayers())
  const got: Curve[][] = []
  const warnings: string[] = []
  attackAbort?.abort()
  const abort = (attackAbort = new AbortController())
  showCancel('attackCancel', true)
  const started = performance.now()
  let cancelled = false
  startLoader()
  try {
    for (const [k, job] of jobs.entries()) {
      attackProgress.working(
        `Curve ${k + 1} of ${jobs.length}: ${job.name}`,
        k / jobs.length,
        started
      )
      const own = job.whole ? null : job.layers[0]
      const res = await api.attack(
        {
          ...base,
          nodes: own ? net.nodes.filter((n) => n.layer === own) : net.nodes,
          edges: own
            ? net.edges.filter(
                (e) => e.source_layer === own && e.target_layer === own
              )
            : net.edges,
          layers: job.layers,
          whole_only: job.whole,
        },
        abort.signal
      )
      if (store.get().network !== net) return attackProgress.hide()
      got[k] = res.curves
      warnings.push(...res.warnings)
    }
  } catch (err) {
    if (!isCancel(err)) {
      const why = err instanceof Error ? err.message : 'The attack failed.'
      attackProgress.fail(why)
      return attackStatus(why, true)
    }
    cancelled = true
  } finally {
    if (attackAbort === abort) attackAbort = null
    showCancel('attackCancel', false)
    finishLoader()
  }
  // the layers in order, then the whole network
  const curves = [...got.slice(1), got[0]].flatMap((c) => c ?? [])
  if (!curves.length) {
    attackProgress.hide()
    return cancelled
      ? attackStatus('Attack cancelled before the first curve.')
      : attackStatus(`No curve came back. ${warnings.join(' ')}`, true)
  }
  const fresh = curves.map((curve) => ({ strategy, recalculate, curve }))
  // a run that is already on the chart is replaced, not repeated
  const label = new Set(fresh.map(seriesLabel))
  series = checked('attackKeep')
    ? [...series.filter((s) => !label.has(seriesLabel(s))), ...fresh]
    : fresh
  const efficiency = curves.some((c) => c.efficiency)
  if (base.efficiency && efficiency)
    el<HTMLSelectElement>('attackMeasure').value = 'efficiency'
  else if (value('attackMeasure') === 'efficiency' && !efficiency)
    el<HTMLSelectElement>('attackMeasure').value = 'largest'
  drawChart()
  renderRobustnessTable(robustnessTable(series))
  if (cancelled) {
    attackProgress.hide()
    return attackStatus(
      `Attack cancelled after ${curves.length} of ${jobs.length} curves; those are on the chart.`
    )
  }
  const main = fresh[fresh.length - 1]
  const r = `R = ${main.curve.robustness.toFixed(3)}`
  attackProgress.done(
    `${plural(curves.length, 'curve')} ready; ${main.curve.name}: ${r}`,
    6000
  )
  attackStatus(
    `${seriesLabel(main)}: robustness ${r} ` +
      `(the area under the largest-component curve; 0.5 is a network that shrinks only by the nodes removed). ` +
      `Points in Data Tables → Robustness.${warnings.length ? ` ${warnings.join(' ')}` : ''}`
  )
}

// ---------------------------------------------------------------- wiring
// the channels of the network on screen, for "remove a channel"
function fillChannels(): void {
  const channels = store.get().network?.channels ?? []
  el('koChannelBox').classList.toggle('d-none', channels.length === 0)
  el<HTMLSelectElement>('koChannel').innerHTML = [
    '<option value="">None</option>',
    ...channels.map(
      (c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
    ),
  ].join('')
}

function forget(): void {
  last = null
  series = []
  enableResults(false)
  drawChart()
  fillChannels()
}

function showNodeChoice(): void {
  const from = value('koNodes')
  document
    .querySelectorAll<HTMLElement>('#perturbation_card [data-ko]')
    .forEach((box) => box.classList.toggle('d-none', box.dataset.ko !== from))
}

export function initPerturbation(): void {
  const on = (id: string, run: () => void) =>
    document.getElementById(id)?.addEventListener('click', run)
  on('runKnockout', () => void runKnockout())
  on('koColour', colourByChange)
  on('koRestore', () => restore())
  on('koApply', () => void applyAsNetwork())
  on('koReports', () => showTab('#panel-data'))
  on('runAttack', () => void runAttack())
  on('koCancel', () => koAbort?.abort())
  on('attackCancel', () => attackAbort?.abort())
  on('attackSvg', () =>
    download(
      'robustness.svg',
      robustnessSvg(series, value('attackMeasure') as CurveMeasure, {
        standalone: true,
      }),
      'image/svg+xml'
    )
  )
  on('attackCsv', () =>
    download('robustness.csv', toCsv(robustnessTable(series)), 'text/csv')
  )
  el('koNodes').addEventListener('change', showNodeChoice)
  el('koShow').addEventListener('change', () => preview(value('koShow')))
  el('attackMeasure').addEventListener('change', drawChart)
  // drawn to the box's width, which is 0 while the panel is hidden
  document
    .querySelector('[data-bs-target="#panel-perturbation"]')
    ?.addEventListener('shown.bs.tab', () => {
      if (series.length) drawChart()
    })
  el('attackStrategy').addEventListener('change', () => {
    const random = value('attackStrategy') === 'random'
    el<HTMLSelectElement>('attackRanking').disabled = random
    el<HTMLInputElement>('attackRuns').disabled = !random
  })
  for (const event of ['network:loaded', 'workspace:changed'] as const)
    bus.on(event, forget)
  fillChannels()
  showNodeChoice()
  registerSelectionAction({
    label: (sel) => `Knock Out the ${plural(sel.length, 'Node')}…`,
    order: 66,
    run: () => {
      showTab('#panel-perturbation')
      el<HTMLDetailsElement>('perturbation_card').open = true
      el<HTMLSelectElement>('koNodes').value = 'selected'
      showNodeChoice()
      el('perturbation_card').scrollIntoView({ block: 'start' })
      void runKnockout()
    },
  })
}
