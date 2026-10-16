// Layouts panel — port of v2 views/layouts.R and the channel layout list
// (edge.js attachChannelLayoutList). The layer checkbox group of v2 is the
// Layer selection tab now (ui/layer_selection.ts); the panel's first section
// only says how many layers are ticked and opens that tab.

import { store } from '../store'
import { registerAnnotationSet } from '../actions/workspace'
import { api } from '../api/client'
import { history } from '../commands/base'
import {
  PREDEFINED_LAYOUTS,
  applyPredefinedLayout,
  type PredefinedLayout,
} from '../actions/layout'
import {
  ApplyClustersCommand,
  ClustersAsAnnotationsCommand,
  PredefinedLayoutCommand,
} from '../commands/scene'
import {
  setHullSource,
  setHullStyle,
  showAnnotationPies,
  type HullSource,
  type HullStyle,
} from '../actions/annotations'
import { bus } from '../bus'
import { ctx } from '../three'
import { applyLayout } from '../actions/layout'
import {
  runGroupLayout,
  type GroupSource,
  type GroupStrategy,
} from '../actions/group_layout'
import { startLoader, finishLoader } from '../actions/screen'
import { selectionSummary } from './layer_selection'
import { fitView } from '../actions/search'
import { showTab } from './tabs'
import { escapeHtml } from '../utils'
import { PROGRESS_HTML, ProgressBar } from './progress'
import type { Scope } from '../api/client'

// v2 views/layouts.R option lists (Davidson-Harel / GEM / Edge Betweenness
// were commented out there too).
const LAYOUT_ALGORITHMS = [
  '-',
  'Fruchterman-Reingold',
  'Reingold-Tilford',
  'Circle',
  'Grid',
  'Random',
  'DrL',
  'Graphopt',
  'Kamada-Kawai',
  'Large Graph Layout',
  'Multidimensional Scaling',
  'Sugiyama',
]
// backend services/layouts.py LAYOUTS_3D
const LAYOUTS_3D = [
  'Fruchterman-Reingold',
  'Kamada-Kawai',
  'DrL',
  'Random',
  'Grid',
  'Circle', // on a sphere in 3D
]
// backend services/layouts.py WEIGHTED_LAYOUTS; the rest ignore weights
const WEIGHTED_ALGORITHMS = ['Fruchterman-Reingold', 'Kamada-Kawai', 'DrL']
// backend models/layout.py MIN_/MAX_CHANNEL_WEIGHT
const MIN_CHANNEL_WEIGHT = 0.1
const MAX_CHANNEL_WEIGHT = 10
const CLUSTERING_ALGORITHMS = [
  '-',
  'Louvain',
  'Walktrap',
  'Fast Greedy',
  'Label Propagation',
  'Leiden', // multiplex Leiden with "Align Nodes Across Selected Layers"
]

const options = (values: string[]) =>
  values.map((v) => `<option value="${v}">${v}</option>`).join('')

// Sections in the order they are used: pick layers, set up a layout, run
// it (the Run bar stays in view), then the optional extras folded away.
const LAYOUTS_HTML = `
<div class="col-md-8 col-lg-6 layout-panel">
  <section class="lp-section" data-multilayer-only>
    <h6 class="lp-title"><span class="lp-step">1</span>Layers</h6>
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
      <span id="layoutLayerSummary" class="small"></span>
      <button id="openLayerSelection" class="btn btn-outline-primary btn-sm" title="Tick the layers to lay out in the Layer selection tab">Layer selection…</button>
    </div>
    <div id="channelColorLayoutDiv" class="channelColorLayoutDiv"></div>
  </section>

  <section class="lp-section">
    <h6 class="lp-title"><span class="lp-step">2</span><span data-multilayer-only>Layout</span><span data-single-only>Layout of the whole network</span></h6>
    <div class="form-text mt-0 mb-2" data-single-only>One graph, as in NORMA: the layout runs on every node at once (in 3D while <i>3D Layout</i> is on); clustering and the Groups card below organise it.</div>
    <label class="form-label small" for="layoutAlgorithmChoice">Algorithm</label>
    <select class="form-select form-select-sm mb-3" id="layoutAlgorithmChoice">${options(LAYOUT_ALGORITHMS)}</select>

    <label class="form-label small" data-multilayer-only>Apply to</label>
    <div class="lp-choices mb-3" data-multilayer-only>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="subgraphChoice" id="subgraph_perLayer" value="perLayer" checked />
        <label class="form-check-label" for="subgraph_perLayer">Per Layer <span class="lp-hint">each layer on its own</span></label>
      </div>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="subgraphChoice" id="subgraph_allLayers" value="allLayers" />
        <label class="form-check-label" for="subgraph_allLayers">All Selected Layers <span class="lp-hint">as one network</span></label>
      </div>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="subgraphChoice" id="subgraph_nodesPerLayers" value="nodesPerLayers" />
        <label class="form-check-label" for="subgraph_nodesPerLayers">Selected Nodes Only <span class="lp-hint">local layout per layer</span></label>
      </div>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="subgraphChoice" id="subgraph_coupled" value="coupled" />
        <label class="form-check-label" for="subgraph_coupled">Align Nodes Across Selected Layers <span class="lp-hint">same spot in every layer</span></label>
      </div>
    </div>

    <div class="form-check form-switch mb-1">
      <input class="form-check-input" type="checkbox" role="switch" id="useEdgeWeightsCheckbox" />
      <label class="form-check-label" for="useEdgeWeightsCheckbox">Use Edge Weights (and Channel Weights)</label>
    </div>
    <div class="form-text mt-0 mb-2">Heavier edges pull nodes closer: ${WEIGHTED_ALGORITHMS.join(', ')}, without clustering.</div>
    <div class="form-check form-switch mb-1">
      <input class="form-check-input" type="checkbox" role="switch" id="layout3dCheckbox" />
      <label class="form-check-label" for="layout3dCheckbox">3D Layout</label>
    </div>
    <div class="form-text mt-0 mb-3">Nodes leave the floor (${LAYOUTS_3D.join(', ')}); best with cube, sphere or fog-cloud layers. A 2D layout flattens them again.</div>

    <div class="lp-grid">
      <div>
        <label class="form-label small" for="clusteringAlgorithmChoice">Clustering (optional)</label>
        <select class="form-select form-select-sm" id="clusteringAlgorithmChoice">${options(CLUSTERING_ALGORITHMS)}</select>
      </div>
      <div>
        <label class="form-label small" for="localLayoutAlgorithmChoice">Layout inside clusters / selected nodes</label>
        <select class="form-select form-select-sm" id="localLayoutAlgorithmChoice">${options(LAYOUT_ALGORITHMS)}</select>
      </div>
    </div>
    <div id="layoutCompat" class="form-text mt-2 d-none"></div>
  </section>

  <section class="lp-section" id="clusteringSection">
    <h6 class="lp-title"><span class="lp-step">3</span>Clustering</h6>
    <div class="form-text mt-0 mb-2">Find communities without moving the nodes: they colour the nodes, fill Data Tables → Clustering Data, and can serve as annotations for pies, hulls, fog clouds and the Groups card — like an annotation file.</div>
    <div class="lp-grid mb-2">
      <div>
        <label class="form-label small" for="clusterAlgorithm">Algorithm</label>
        <select id="clusterAlgorithm" class="form-select form-select-sm">${options(CLUSTERING_ALGORITHMS.filter((a) => a !== '-'))}</select>
      </div>
      <div data-multilayer-only>
        <label class="form-label small" for="clusterScope">Communities</label>
        <select id="clusterScope" class="form-select form-select-sm">
          <option value="perLayer">Within each layer</option>
          <option value="allLayers">Over the selected layers as one graph</option>
          <option value="coupled">Shared across layers by node name</option>
        </select>
      </div>
    </div>
    <div class="d-flex flex-wrap align-items-center gap-2">
      <button id="runClustering" class="btn btn-primary btn-sm">Find Communities</button>
      <button id="clustersToAnnotations" class="btn btn-outline-primary btn-sm" disabled>Use Clusters as Annotations</button>
    </div>
    ${PROGRESS_HTML('clusterProgress', 'Clustering progress')}
    <div id="cluster_status" class="small mt-2"></div>
  </section>

  <div class="lp-runbar">
    <button id="runLayout" class="btn btn-primary">Run Layout</button>
    <div class="lp-runbar__msgs">
      <div id="layouts_status" class="small text-danger"></div>
      <div id="layout_score" class="small text-secondary"></div>
      ${PROGRESS_HTML('layoutProgress', 'Layout progress')}
    </div>
  </div>

  <details id="arrangementCard" class="lp-section lp-more" data-multilayer-only>
    <summary><span class="lp-step lp-step--opt">+</span>Layer Arrangement</summary>
    <div class="mt-2">
      <div class="form-text mt-0 mb-2">Where the floors themselves go — independent of the node layouts above, and undoable.</div>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <select id="layerArrangement" class="form-select form-select-sm" style="width:auto" aria-label="Layer arrangement">
          ${PREDEFINED_LAYOUTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
        <button id="applyArrangement" class="btn btn-primary btn-sm">Arrange Layers</button>
      </div>
    </div>
  </details>

  <details id="alignmentCard" class="lp-section lp-more" data-multilayer-only>
    <summary><span class="lp-step lp-step--opt">+</span>Cross-Layer Alignment</summary>
    <div id="alignmentBox" class="mt-2">
      <div class="form-text mt-0 mb-2">Per Layer scope, 2D, no clustering. Fewer crossings between layers while each layer keeps its own structure; nodes are matched by name and by inter-layer edges.</div>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <select id="alignmentMode" class="form-select form-select-sm" style="width:auto" aria-label="Alignment mode">
          <option value="none">None (independent layers)</option>
          <option value="soft">Soft — blend toward full alignment</option>
          <option value="anchor">Anchor to a reference layer</option>
          <option value="chain">Chain — each layer to the previous</option>
        </select>
        <select id="alignmentReference" class="form-select form-select-sm d-none" style="width:auto" aria-label="Reference layer"></select>
      </div>
      <div id="alignmentNote" class="form-text d-none"></div>
      <div id="alignmentStrengthBox" class="d-none mt-2">
        <label class="form-label small" for="alignmentStrength">Strength: <span id="alignmentStrengthValue">0.70</span> (1 = shared nodes exactly aligned)</label>
        <input type="range" class="form-range" id="alignmentStrength" min="0" max="1" step="0.05" value="0.7" />
      </div>
      <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
        <button id="runAlignedLayout" class="btn btn-primary btn-sm">Run Aligned Layout</button>
        <span class="form-text m-0">runs the chosen algorithm per layer with this alignment (2D, no clustering); the misalignment score under the run bar shows the effect — lower means straighter links</span>
      </div>
    </div>
  </details>

  <details id="groupLayoutCard" class="lp-section lp-more">
    <summary><span class="lp-step lp-step--opt">+</span><span data-multilayer-only>Group Layout (NORMA-2.0)</span><span data-single-only>Groups (NORMA-2.0): clusters and annotations</span></summary>
    <div class="form-text mt-2" data-single-only>As in NORMA, each group gets its own region of the layout and is drawn as a fog cloud or a hull; nodes in several groups become pie charts.</div>
    <div class="mt-2">
      <div class="lp-grid mb-2">
        <div>
          <label class="form-label small" for="groupSource">Groups:</label>
          <select id="groupSource" class="form-select form-select-sm">
            <option value="clusters">Clusters</option>
            <option value="annotations">Annotations</option>
            <option value="layers">Layers (place &amp; angle the floors)</option>
          </select>
        </div>
        <div>
          <label class="form-label small" for="groupStrategy">Strategy:</label>
          <select id="groupStrategy" class="form-select form-select-sm">
            <option value="virtual">1 · Virtual node per group</option>
            <option value="gravity">2 · Group gravity</option>
            <option value="supernodes" selected>3 · Super nodes per group</option>
          </select>
        </div>
        <div>
          <label class="form-label small" for="groupAlgorithm">Algorithm the strategy runs:</label>
          <select id="groupAlgorithm" class="form-select form-select-sm">${options(LAYOUT_ALGORITHMS.filter((a) => a !== '-'))}</select>
        </div>
        <div>
          <label class="form-label small" for="groupLocal">Layout inside each group:</label>
          <select id="groupLocal" class="form-select form-select-sm">
            <option value="keep">Keep the strategy's arrangement</option>
            ${options(LAYOUT_ALGORITHMS.filter((a) => a !== '-'))}
          </select>
        </div>
      </div>
      <label class="form-label small" for="groupForce">Force strength: <span id="groupForceValue">10</span></label>
      <input type="range" class="form-range" id="groupForce" min="1" max="20" step="1" value="10" />
      <label class="form-label small" for="groupScale">Group size: <span id="groupScaleValue">1.0</span>×</label>
      <input type="range" class="form-range" id="groupScale" min="0.25" max="4" step="0.25" value="1" />
      <div class="form-text mb-2">Karatzas et al. 2022 (NORMA-2.0). Uses the layers selected above (all if none). Sphere/cube/cloud layers get 3D layouts inside each group.</div>
      <div class="lp-grid mb-2" data-single-only>
        <div>
          <label class="form-label small" for="groupDraw">Draw groups as</label>
          <select id="groupDraw" class="form-select form-select-sm">
            <option value="none">Nothing</option>
            <option value="fog">Fog clouds</option>
            <option value="hull">Hulls</option>
          </select>
        </div>
        <div class="form-check form-switch mt-4">
          <input class="form-check-input" type="checkbox" role="switch" id="groupPies" />
          <label class="form-check-label" for="groupPies">Pie charts for annotated nodes</label>
        </div>
      </div>
      <button id="runGroupLayout" class="btn btn-primary btn-sm">Run Group Layout</button>
      ${PROGRESS_HTML('groupProgress', 'Group layout progress')}
    </div>
  </details>
</div>
`

const layoutProgress = new ProgressBar('layoutProgress')
const groupProgress = new ProgressBar('groupProgress')

// With 3D Layout on, only the algorithms that have a 3D version are offered;
// a multilayer network stacked into Single-network mode is laid out in 3D.
function syncAlgorithmOptions(): void {
  const three = (
    document.getElementById('layout3dCheckbox') as HTMLInputElement
  ).checked
  const select = document.getElementById(
    'layoutAlgorithmChoice'
  ) as HTMLSelectElement
  for (const option of select.options) {
    const ok =
      !three || option.value === '-' || LAYOUTS_3D.includes(option.value)
    option.hidden = !ok
    option.disabled = !ok
  }
  if (three && select.value !== '-' && !LAYOUTS_3D.includes(select.value)) {
    select.value = 'Fruchterman-Reingold'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

function status(msg: string, isError = false): void {
  const el = document.getElementById('layouts_status')
  if (!el) return
  el.textContent = msg
  el.className = `small ${isError ? 'text-danger' : 'text-success'}`
}

// "2 of 4 layers selected" under the section title, kept current
function syncLayerSummary(): void {
  const el = document.getElementById('layoutLayerSummary')
  if (el) el.textContent = selectionSummary()
}

// v2 attachChannelLayoutList, minus the collapse toggle — all channels
// checked by default; checked ones are sent as selected_channels.
// XSS fix: channel names are user-controlled (TSV Channel column), so they go
// through escapeHtml() before landing in the innerHTML template below.
function buildChannelList(): void {
  const container = document.getElementById('channelColorLayoutDiv')
  if (!container) return
  container.innerHTML = ''
  const channels = store.get().network?.channels ?? []
  if (channels.length === 0) return
  const title = document.createElement('label')
  title.className = 'form-label'
  title.textContent = 'Select Channels for Layouts'
  container.appendChild(title)
  const weighted = useWeights()
  for (const ch of channels) {
    const row = document.createElement('div')
    row.className = 'form-check d-flex align-items-center gap-2'
    row.innerHTML = `
      <input class="form-check-input channel_checkbox" type="checkbox" id="checkbox_layout${escapeHtml(ch)}" checked />
      <label class="form-check-label flex-grow-1" for="checkbox_layout${escapeHtml(ch)}">${escapeHtml(ch)}</label>
      <input class="form-control form-control-sm channel_weight" type="number" style="width: 5.5rem"
        min="${MIN_CHANNEL_WEIGHT}" max="${MAX_CHANNEL_WEIGHT}" step="0.1" value="1"
        title="Channel weight for weighted layouts" />
    `
    const weight = row.querySelector<HTMLInputElement>('.channel_weight')!
    weight.dataset.channel = ch
    weight.setAttribute('aria-label', `Layout weight for channel ${ch}`)
    weight.disabled = !weighted
    container.appendChild(row)
  }
}

function useWeights(): boolean {
  const box = document.getElementById(
    'useEdgeWeightsCheckbox'
  ) as HTMLInputElement | null
  return !!box && box.checked && !box.disabled
}

// What goes together. The backend refuses the other combinations, so the
// panel disables them as soon as a choice rules them out, with a note: 3D
// layouts and clustering exclude each other; the local layout only applies
// inside clusters or to the selected nodes; edge weights work with the
// weighted algorithms on the plain scopes, without clustering or alignment;
// alignment needs the Per Layer scope, a 2D layout and no clustering.
function syncCompatibility(): void {
  const el = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T | null
  const box3d = el<HTMLInputElement>('layout3dCheckbox')
  const cluster = el<HTMLSelectElement>('clusteringAlgorithmChoice')
  const local = el<HTMLSelectElement>('localLayoutAlgorithmChoice')
  const weights = el<HTMLInputElement>('useEdgeWeightsCheckbox')
  const align = el<HTMLSelectElement>('alignmentMode')
  const algorithm = el<HTMLSelectElement>('layoutAlgorithmChoice')
  if (!box3d || !cluster || !local || !weights || !align || !algorithm) return
  const single = ctx.networkMode === 'single'
  const scope: Scope = single ? 'allLayers' : currentScope()
  const three = box3d.checked
  const clustering = cluster.value !== '-'
  const notes: string[] = []
  cluster.disabled = three
  box3d.disabled = clustering
  if (three)
    notes.push('Clustering needs a 2D layout: switch 3D Layout off to cluster.')
  if (clustering)
    notes.push(`${cluster.value} clustering keeps the layout in 2D.`)
  local.disabled = !clustering && scope !== 'nodesPerLayers'
  // no algorithm chosen yet: the switch stays usable (weights count once a
  // weighted algorithm runs)
  const weightsOk =
    (algorithm.value === '-' ||
      WEIGHTED_ALGORITHMS.includes(algorithm.value)) &&
    !clustering &&
    (scope === 'perLayer' || scope === 'allLayers') &&
    (align.disabled || align.value === 'none')
  weights.disabled = !weightsOk
  if (!weightsOk && weights.checked)
    notes.push(
      `Edge weights are left out here: they work with ${WEIGHTED_ALGORITHMS.join(', ')} on the Per Layer or All Selected Layers scope, without clustering or alignment.`
    )
  const alignOk = !single && scope === 'perLayer' && !three && !clustering
  align.disabled = !alignOk
  const reference = el<HTMLSelectElement>('alignmentReference')
  const strength = el<HTMLInputElement>('alignmentStrength')
  if (reference) reference.disabled = !alignOk
  if (strength) strength.disabled = !alignOk
  const alignNote = el('alignmentNote')
  if (alignNote) {
    alignNote.textContent = alignOk
      ? ''
      : 'Alignment needs the Per Layer scope, a 2D layout and no clustering.'
    alignNote.classList.toggle('d-none', alignOk)
  }
  const note = el('layoutCompat')
  if (note) {
    note.textContent = notes.join(' ')
    note.classList.toggle('d-none', notes.length === 0)
  }
}

// Channel weight inputs only matter when weighted layouts are on.
function syncChannelWeightInputs(): void {
  const weighted = useWeights()
  document
    .querySelectorAll<HTMLInputElement>(
      '#channelColorLayoutDiv .channel_weight'
    )
    .forEach((input) => (input.disabled = !weighted))
}

// Clamped to the backend's range so an out-of-range entry can't 422 the run;
// blank/invalid entries count as 1 (neutral).
function channelWeights(): Record<string, number> | null {
  const inputs = document.querySelectorAll<HTMLInputElement>(
    '#channelColorLayoutDiv .channel_weight'
  )
  if (inputs.length === 0) return null
  const out: Record<string, number> = {}
  for (const input of inputs) {
    const v = Number.parseFloat(input.value)
    out[input.dataset.channel!] = Number.isFinite(v)
      ? Math.min(MAX_CHANNEL_WEIGHT, Math.max(MIN_CHANNEL_WEIGHT, v))
      : 1
  }
  return out
}

// also read by the Analysis panel (same channel filter as layouts)
export function selectedChannels(): string[] | null {
  const boxes = document.querySelectorAll<HTMLInputElement>(
    '#channelColorLayoutDiv .channel_checkbox'
  )
  if (boxes.length === 0) return null
  return [...boxes]
    .filter((b) => b.checked)
    .map((b) => b.id.replace('checkbox_layout', ''))
}

function alignmentFields(scope: Scope) {
  const mode = (document.getElementById('alignmentMode') as HTMLSelectElement)
    .value as 'none' | 'soft' | 'anchor' | 'chain'
  if (mode === 'none' || scope !== 'perLayer') return {}
  return {
    alignment: mode,
    alignment_strength: Number(
      (document.getElementById('alignmentStrength') as HTMLInputElement).value
    ),
    reference_layer:
      mode === 'anchor'
        ? (document.getElementById('alignmentReference') as HTMLSelectElement)
            .value
        : null,
  }
}

// Misalignment = mean in-plane stretch of links between layers.
function showScore(score: number | null): void {
  const el = document.getElementById('layout_score')
  if (!el) return
  el.textContent =
    score === null
      ? ''
      : `Inter-layer misalignment: ${score.toFixed(1)}% of the layout size (lower = straighter links, fewer crossovers).`
}

function buildReferenceOptions(): void {
  const sel = document.getElementById(
    'alignmentReference'
  ) as HTMLSelectElement | null
  if (!sel) return
  sel.innerHTML = ctx.layers
    .map(
      (l) =>
        `<option value="${escapeHtml(l.name)}">${escapeHtml(l.name)}</option>`
    )
    .join('')
}

function currentScope(): Scope {
  const checked = document.querySelector<HTMLInputElement>(
    'input[name="subgraphChoice"]:checked'
  )
  return (checked?.value ?? 'perLayer') as Scope
}

async function onRunLayout(): Promise<void> {
  const st = store.get()
  if (!st.network) return status('Upload a network first.', true)
  // single-network mode: the whole network, laid out at once
  const single = ctx.networkMode === 'single'
  if (!single && st.selectedLayers.length === 0)
    return status('Select at least one layer.', true)

  const chosen = currentScope()
  const scope: Scope =
    single && chosen !== 'nodesPerLayers' ? 'allLayers' : chosen
  const layers = single ? st.network.layers : st.selectedLayers
  const mainAlgorithm = (
    document.getElementById('layoutAlgorithmChoice') as HTMLSelectElement
  ).value
  const localAlgorithm = (
    document.getElementById('localLayoutAlgorithmChoice') as HTMLSelectElement
  ).value
  // selected nodes use the local layout, or the main algorithm if none is set
  const algorithm =
    scope === 'nodesPerLayers' && localAlgorithm !== '-'
      ? localAlgorithm
      : mainAlgorithm
  if (algorithm === '-') return status('Select a layout algorithm.', true)

  const clusteringAlg = (
    document.getElementById('clusteringAlgorithmChoice') as HTMLSelectElement
  ).value
  const is3d = (document.getElementById('layout3dCheckbox') as HTMLInputElement)
    .checked
  if (is3d) {
    if (!LAYOUTS_3D.includes(algorithm))
      return status(`${algorithm} has no 3D version.`, true)
    if (clusteringAlg !== '-')
      return status('3D layouts cannot be combined with clustering.', true)
  }
  const align = document.getElementById('alignmentMode') as HTMLSelectElement
  if (
    !align.disabled &&
    align.value !== 'none' &&
    (scope !== 'perLayer' || is3d || clusteringAlg !== '-')
  )
    return status(
      'Alignment works with the Per Layer scope, a 2D layout and no clustering.',
      true
    )
  // a fresh status, so nothing (users or tests) mistakes the previous
  // run's "Layout applied." / score for this one
  status('Computing layout…')
  showScore(null)
  startLoader()
  layoutProgress.set('Sending network 0%', 0)
  try {
    const score = await applyLayout(
      {
        nodes: st.network.nodes,
        edges: st.network.edges,
        algorithm,
        scope,
        selected_layers: layers,
        selected_nodes: scope === 'nodesPerLayers' ? st.selectedNodes : null,
        selected_channels: selectedChannels(),
        use_weights: useWeights(),
        dimensions: is3d ? 3 : 2,
        ...(align.disabled ? {} : alignmentFields(scope)),
        channel_weights: useWeights() ? channelWeights() : null,
        clustering:
          clusteringAlg !== '-'
            ? {
                algorithm: clusteringAlg,
                local_layout:
                  localAlgorithm !== '-' ? localAlgorithm : algorithm,
              }
            : null,
      },
      false,
      layoutProgress.upload(
        `Computing ${algorithm}${clusteringAlg !== '-' ? ` + ${clusteringAlg} clustering` : ''} on the server`
      )
    )
    layoutProgress.done('Layout applied')
    status('Layout applied.')
    showScore(score)
  } catch (err) {
    layoutProgress.hide()
    status(err instanceof Error ? err.message : 'Layout failed.', true)
  } finally {
    finishLoader()
  }
}

export function initLayoutsPanel(): void {
  const pane = document.getElementById('panel-layouts')
  if (!pane) return
  pane.innerHTML = LAYOUTS_HTML

  // ---- Clustering as a step of its own
  const clusterProgress = new ProgressBar('clusterProgress')
  const clusterStatus = (msg: string, isError = false) => {
    const el = document.getElementById('cluster_status')
    if (!el) return
    el.textContent = msg
    el.className = `small mt-2 ${isError ? 'text-danger' : 'text-success'}`
  }
  const annotateButton = document.getElementById(
    'clustersToAnnotations'
  ) as HTMLButtonElement
  const syncAnnotateButton = () => {
    annotateButton.disabled = !ctx.nodeObjects.some((n) => n.cluster !== '')
  }
  document.getElementById('runClustering')?.addEventListener('click', () => {
    const st = store.get()
    if (!st.network) return clusterStatus('Upload a network first.', true)
    const layers =
      ctx.networkMode === 'single' || st.selectedLayers.length === 0
        ? st.network.layers
        : st.selectedLayers
    const algorithm = (
      document.getElementById('clusterAlgorithm') as HTMLSelectElement
    ).value
    const scope =
      ctx.networkMode === 'single'
        ? 'allLayers'
        : ((document.getElementById('clusterScope') as HTMLSelectElement)
            .value as 'perLayer' | 'allLayers' | 'coupled')
    clusterStatus('Finding communities…')
    clusterProgress.computing(`Running ${algorithm} on the server`)
    startLoader()
    api
      .clustering({
        nodes: st.network.nodes,
        edges: st.network.edges,
        algorithm,
        scope,
        selected_layers: layers,
        selected_channels: selectedChannels(),
      })
      .then(({ clusters, count }) => {
        history.execute(new ApplyClustersCommand(clusters))
        clusterProgress.done('Communities found')
        clusterStatus(
          `${count} communities (${algorithm}, ${
            scope === 'perLayer'
              ? 'within each layer'
              : scope === 'coupled'
                ? 'shared across layers'
                : 'one graph'
          }); nodes coloured by community — Data Tables lists them.`
        )
        syncAnnotateButton()
      })
      .catch((err: unknown) => {
        clusterProgress.hide()
        clusterStatus(err instanceof Error ? err.message : String(err), true)
      })
      .finally(finishLoader)
  })
  annotateButton.addEventListener('click', () => {
    if (!ctx.nodeObjects.some((n) => n.cluster !== ''))
      return clusterStatus('Find communities first.', true)
    history.execute(new ClustersAsAnnotationsCommand())
    registerAnnotationSet(
      `${(document.getElementById('clusterAlgorithm') as HTMLSelectElement).value} clusters`
    )
    clusterStatus(
      'The clusters are now annotations: pies, hulls, fog clouds and the Groups card use them.'
    )
  })
  bus.on('network:loaded', syncAnnotateButton)
  bus.on('clustering:applied', syncAnnotateButton)
  bus.on('history:changed', syncAnnotateButton)

  document
    .getElementById('openLayerSelection')
    ?.addEventListener('click', () => showTab('#panel-layer-selection'))
  bus.on('layers:selected', syncLayerSummary)
  syncLayerSummary()
  document
    .getElementById('useEdgeWeightsCheckbox')
    ?.addEventListener('change', syncChannelWeightInputs)
  document
    .getElementById('layout3dCheckbox')
    ?.addEventListener('change', syncAlgorithmOptions)
  syncAlgorithmOptions()
  for (const id of [
    'layoutAlgorithmChoice',
    'layout3dCheckbox',
    'clusteringAlgorithmChoice',
    'useEdgeWeightsCheckbox',
    'alignmentMode',
  ])
    document.getElementById(id)?.addEventListener('change', syncCompatibility)
  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="subgraphChoice"]'
  ))
    radio.addEventListener('change', syncCompatibility)
  bus.on('network:loaded', syncCompatibility)
  syncCompatibility()
  bus.on('mode:changed', ({ mode }) => {
    const box = document.getElementById('layout3dCheckbox') as HTMLInputElement
    if (mode === 'single' && ctx.layers.length > 1 && !box.checked) {
      box.checked = true
      syncAlgorithmOptions()
    }
    // single network: the NORMA groups card is the main tool, so it opens
    if (mode === 'single')
      (document.getElementById('groupLayoutCard') as HTMLDetailsElement).open =
        true
    syncCompatibility()
  })
  document.getElementById('runLayout')?.addEventListener('click', () => {
    void onRunLayout()
  })

  initGroupLayout()

  const alignMode = document.getElementById(
    'alignmentMode'
  ) as HTMLSelectElement
  const syncAlign = () => {
    document
      .getElementById('alignmentReference')!
      .classList.toggle('d-none', alignMode.value !== 'anchor')
    document
      .getElementById('alignmentStrengthBox')!
      .classList.toggle('d-none', alignMode.value === 'none')
  }
  alignMode.addEventListener('change', () => {
    syncAlign()
    if (alignMode.value !== 'none')
      status(
        'Press Run Aligned Layout (or Run Layout with the Per Layer scope) to apply it.'
      )
  })
  document.getElementById('runAlignedLayout')?.addEventListener('click', () => {
    // alignment needs Per Layer, 2D and no clustering: set them, then run
    const perLayer = document.getElementById(
      'subgraph_perLayer'
    ) as HTMLInputElement
    if (!perLayer.checked) perLayer.click()
    const box = document.getElementById('layout3dCheckbox') as HTMLInputElement
    if (box.checked) {
      box.checked = false
      box.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const cluster = document.getElementById(
      'clusteringAlgorithmChoice'
    ) as HTMLSelectElement
    if (cluster.value !== '-') {
      cluster.value = '-'
      cluster.dispatchEvent(new Event('change', { bubbles: true }))
    }
    syncCompatibility()
    if (alignMode.value === 'none') alignMode.value = 'soft'
    syncAlign()
    void onRunLayout()
  })
  document.getElementById('applyArrangement')?.addEventListener('click', () => {
    if (ctx.layers.length <= 1)
      return status('Arrangements need at least two layers.', true)
    const name = (
      document.getElementById('layerArrangement') as HTMLSelectElement
    ).value as PredefinedLayout
    history.execute(
      new PredefinedLayoutCommand(name, () => applyPredefinedLayout(name))
    )
    // the chord ring is wider than the default zoom: bring it all into view
    if (name === 'chord') fitView()
    status(
      `Layers arranged: ${PREDEFINED_LAYOUTS.find(([v]) => v === name)?.[1] ?? name}.`
    )
  })
  const strength = document.getElementById(
    'alignmentStrength'
  ) as HTMLInputElement
  strength.addEventListener('input', () => {
    document.getElementById('alignmentStrengthValue')!.textContent = Number(
      strength.value
    ).toFixed(2)
  })

  bus.on('network:loaded', () => {
    buildReferenceOptions()
    showScore(null)
    syncLayerSummary()
    buildChannelList()
    status('')
  })
}

// NORMA-2.0 group layouts (actions/group_layout.ts)
function initGroupLayout(): void {
  const el = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T
  const strategy = el<HTMLSelectElement>('groupStrategy')
  const local = el<HTMLSelectElement>('groupLocal')
  local.value = 'Circle'
  el<HTMLSelectElement>('groupAlgorithm').value = 'Fruchterman-Reingold'
  // super nodes always lay groups out locally
  const syncKeep = () => {
    const keep = local.querySelector<HTMLOptionElement>('option[value="keep"]')!
    keep.disabled = strategy.value === 'supernodes'
    if (keep.disabled && local.value === 'keep') local.value = 'Circle'
  }
  strategy.addEventListener('change', syncKeep)
  syncKeep()
  for (const [id, digits] of [
    ['groupForce', 0],
    ['groupScale', 1],
  ] as const)
    el<HTMLInputElement>(id).addEventListener('input', (e) => {
      el(`${id}Value`).textContent = Number(
        (e.target as HTMLInputElement).value
      ).toFixed(digits)
    })
  // Single network mode draws the groups the NORMA way: fog clouds or hulls
  // around the clusters / annotation terms, pie charts for annotated nodes
  const draw = el<HTMLSelectElement>('groupDraw')
  const applyDraw = () => {
    const src = el<HTMLSelectElement>('groupSource').value
    const hullSource: HullSource =
      draw.value === 'none' || src === 'layers'
        ? 'none'
        : src === 'annotations'
          ? 'annotation'
          : 'cluster'
    setHullSource(hullSource)
    if (draw.value !== 'none') setHullStyle(draw.value as HullStyle)
    // keep the Analyze panel's radios in step
    const radio = (id: string) =>
      document.getElementById(id) as HTMLInputElement | null
    const sourceRadio = radio(`hull_${hullSource}`)
    if (sourceRadio) sourceRadio.checked = true
    const styleRadio = radio(`hullStyle_${draw.value}`)
    if (styleRadio) styleRadio.checked = true
  }
  draw.addEventListener('change', applyDraw)
  el<HTMLInputElement>('groupPies').addEventListener('change', (e) =>
    showAnnotationPies((e.target as HTMLInputElement).checked)
  )

  el('runGroupLayout').addEventListener('click', () => {
    status('Computing group layout…')
    startLoader()
    groupProgress.set('Sending network 0%', 0)
    runGroupLayout({
      source: el<HTMLSelectElement>('groupSource').value as GroupSource,
      strategy: strategy.value as GroupStrategy,
      algorithm: el<HTMLSelectElement>('groupAlgorithm').value,
      local: local.value,
      force: Number(el<HTMLInputElement>('groupForce').value),
      scale: Number(el<HTMLInputElement>('groupScale').value),
      layers:
        ctx.networkMode === 'single'
          ? (store.get().network?.layers ?? [])
          : store.get().selectedLayers,
      useWeights: useWeights(),
      onProgress: groupProgress.upload(
        'Computing the group layout on the server'
      ),
    })
      .then((msg) => {
        groupProgress.done('Group layout applied')
        status(msg)
        // NORMA shows its groups: fog clouds unless something else was chosen
        if (ctx.networkMode === 'single' && draw.value === 'none') {
          draw.value = 'fog'
          applyDraw()
        }
      })
      .catch((err: unknown) => {
        groupProgress.hide()
        status(err instanceof Error ? err.message : String(err), true)
      })
      .finally(finishLoader)
  })
}
