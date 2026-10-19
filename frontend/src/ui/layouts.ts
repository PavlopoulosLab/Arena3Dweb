// Layouts panel — port of v2 views/layouts.R and the channel layout list
// (edge.js attachChannelLayoutList). The layer checkbox group of v2 is the
// Layer selection tab now (ui/layer_selection.ts); the panel's first section
// only says how many layers are ticked and opens that tab. Clustering has a
// panel of its own (ui/clustering.ts, top bar → Clustering); layouts only use
// its clusters (the Group Layout card) and never run a clustering algorithm.

import { store } from '../store'
import {
  HIVE_AXES,
  HIVE_PROPERTIES,
  HIVE_SCALES,
  hivePositions,
  hiveValues,
  type HiveAxes,
  type HiveInput,
  type HiveProperty,
  type HiveScale,
  HIVE_FIT,
} from '../actions/hive'
import { history } from '../commands/base'
import {
  PREDEFINED_LAYOUTS,
  applyPredefinedLayout,
  type PredefinedLayout,
} from '../actions/layout'
import { PredefinedLayoutCommand } from '../commands/scene'
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
  groupAlgorithmProblem,
  groupLayoutRuns3D,
  groupLocalProblem,
  LAYOUTS_3D,
  runGroupLayout,
  WEIGHTED_ALGORITHMS,
  type GroupSource,
  type GroupStrategy,
} from '../actions/group_layout'
import { startLoader, finishLoader } from '../actions/screen'
import { selectionSummary } from './layer_selection'
import { fitViewNow } from '../actions/search'
import { showTab } from './tabs'
import { escapeHtml } from '../utils'
import { PROGRESS_HTML, ProgressBar } from './progress'
import type { Scope } from '../api/client'
import { UMAP, umapOptions } from '../actions/umap'
import { initUmapForm, readUmapChoice, umapFormHtml } from './umap'
import { FOLD_ALL_HTML, openCard } from './sections'

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
// the main algorithm list adds UMAP (backend services/umap_layout.py), which
// runs in 2D and 3D and reads edge weights; group and local layouts don't offer it
const MAIN_ALGORITHMS = [...LAYOUT_ALGORITHMS, UMAP]
const MAIN_3D = [...LAYOUTS_3D, UMAP]
const MAIN_WEIGHTED = [...WEIGHTED_ALGORITHMS, UMAP]
// backend models/layout.py MIN_/MAX_CHANNEL_WEIGHT
const MIN_CHANNEL_WEIGHT = 0.1
const MAX_CHANNEL_WEIGHT = 10

const options = (values: string[]) =>
  values.map((v) => `<option value="${v}">${v}</option>`).join('')

// Sections in the order they are used: pick layers, set up a layout, run
// it (the Run bar stays in view), then the optional extras folded away.
const LAYOUTS_HTML = `
<div class="col-md-8 col-lg-6 layout-panel">
  ${FOLD_ALL_HTML}
  <details class="lp-section lp-more" id="layoutCard_layers" data-multilayer-only>
    <summary><span class="lp-step">1</span>Layers</summary>
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
      <span id="layoutLayerSummary" class="small"></span>
      <button id="openLayerSelection" class="btn btn-outline-primary btn-sm" title="Tick the layers to lay out in the Layer selection tab">Layer selection…</button>
    </div>
    <div id="channelColorLayoutDiv" class="channelColorLayoutDiv"></div>
  </details>

  <details class="lp-section lp-more" id="layoutCard_layout">
    <summary><span class="lp-step">2</span><span data-multilayer-only>Layout</span><span data-single-only>Layout of the whole network</span></summary>
    <div class="form-text mt-0 mb-2" data-single-only>One graph, as in NORMA: the layout runs on every node at once (in 3D while <i>3D Layout</i> is on); the Groups card below organises it by clusters (the Clustering panel) or annotations.</div>
    <label class="form-label small" for="layoutAlgorithmChoice">Algorithm</label>
    <select class="form-select form-select-sm mb-3" id="layoutAlgorithmChoice">${options(MAIN_ALGORITHMS)}</select>
    <div id="umapOptionsBox" class="lp-umap mb-3 d-none">${umapFormHtml('umap')}</div>

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

    <details class="lp-more lp-sub" id="layoutSub_options">
      <summary>Weights &amp; 3D<span class="lp-hint" id="layoutOptionsHint">2D layout, no edge weights</span></summary>
    <div class="form-check form-switch mb-1">
      <input class="form-check-input" type="checkbox" role="switch" id="useEdgeWeightsCheckbox" />
      <label class="form-check-label" for="useEdgeWeightsCheckbox">Use Edge Weights (and Channel Weights)</label>
    </div>
    <div class="form-text mt-0 mb-2">Heavier edges pull nodes closer: ${MAIN_WEIGHTED.join(', ')}.</div>
    <div class="form-check form-switch mb-1">
      <input class="form-check-input" type="checkbox" role="switch" id="layout3dCheckbox" />
      <label class="form-check-label" for="layout3dCheckbox">3D Layout</label>
    </div>
    <div class="form-text mt-0">Nodes leave the floor (${MAIN_3D.join(', ')}); best with cube, sphere or fog-cloud layers. A 2D layout flattens them again.</div>
    </details>
    <details class="lp-more lp-sub" id="layoutSub_local">
      <summary>Selected nodes<span class="lp-hint">with Selected Nodes Only</span></summary>
    <div class="lp-grid">
      <div>
        <label class="form-label small" for="localLayoutAlgorithmChoice">Layout inside the selected nodes</label>
        <select class="form-select form-select-sm" id="localLayoutAlgorithmChoice">${options(LAYOUT_ALGORITHMS)}</select>
      </div>
    </div>
    </details>
    <div class="form-text mt-2">Communities come from the <a href="#" id="layoutOpenClustering">Clustering</a> panel; the Group Layout card below lays them out.</div>
    <div id="layoutCompat" class="form-text mt-2 d-none"></div>
  </details>

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
      <div id="hiveOptions" class="mt-2 d-none">
        <div class="form-text mt-0 mb-2">Each layer becomes an axis (Krzywinski et al. 2012, hive plots): nodes sit on their axis by a network property instead of an aesthetic layout, and links curve between the axes.</div>
        <div class="lp-grid">
          <div>
            <label class="form-label small" for="hiveProperty">Position on axis</label>
            <select id="hiveProperty" class="form-select form-select-sm">
              ${HIVE_PROPERTIES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label small" for="hiveScale">Scale</label>
            <select id="hiveScale" class="form-select form-select-sm">
              ${HIVE_SCALES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="lp-grid mt-1">
          <div>
            <label class="form-label small" for="hiveAxes">Axes</label>
            <select id="hiveAxes" class="form-select form-select-sm">
              ${HIVE_AXES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label small" for="hiveHeight">Height off the plane</label>
            <select id="hiveHeight" class="form-select form-select-sm">
              <option value="">None (flat)</option>
              ${HIVE_PROPERTIES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-text mt-0 d-none" id="hiveHeightNote">Spread in 3D, the axes use all three dimensions: a height needs axes in a plane.</div>
        <div class="form-check mt-1">
          <input class="form-check-input" type="checkbox" id="hiveCurved" checked />
          <label class="form-check-label" for="hiveCurved">Curved links between the axes (as in hive plots)</label>
        </div>
      </div>
    </div>
  </details>

  <details id="alignmentCard" class="lp-section lp-more" data-multilayer-only>
    <summary><span class="lp-step lp-step--opt">+</span>Cross-Layer Alignment</summary>
    <div id="alignmentBox" class="mt-2">
      <div class="form-text mt-0 mb-2">Per Layer scope, 2D. Fewer crossings between layers while each layer keeps its own structure; nodes are matched by name and by inter-layer edges.</div>
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
        <span class="form-text m-0">runs the chosen algorithm per layer with this alignment (2D); the misalignment score under the run bar shows the effect — lower means straighter links</span>
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
      <details class="lp-more lp-sub mb-2" id="groupSub_forces">
        <summary>Force &amp; size<span class="lp-hint">how hard groups pull, how big they are</span></summary>
        <label class="form-label small" for="groupForce">Force strength: <span id="groupForceValue">10</span></label>
        <input type="range" class="form-range" id="groupForce" min="1" max="20" step="1" value="10" />
        <label class="form-label small" for="groupScale">Group size: <span id="groupScaleValue">1.0</span>×</label>
        <input type="range" class="form-range" id="groupScale" min="0.25" max="4" step="0.25" value="1" />
      </details>
      <div class="form-text mb-2">Karatzas et al. 2022 (NORMA-2.0). Uses the layers selected above (all if none). Sphere/cube/cloud layers get 3D layouts inside each group.</div>
      <div id="groupCompat" class="form-text mb-2 d-none"></div>
      <div id="groupNoClusters" class="form-text mb-2 d-none">No clusters yet: find communities in the <a href="#" id="groupOpenClustering">Clustering</a> panel first, or group by annotations.</div>
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
    const ok = !three || option.value === '-' || MAIN_3D.includes(option.value)
    option.hidden = !ok
    option.disabled = !ok
  }
  if (three && select.value !== '-' && !MAIN_3D.includes(select.value)) {
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
// panel disables them as soon as a choice rules them out, with a note: the
// local layout only applies to the selected nodes; edge weights work with the
// weighted algorithms on the plain scopes, without alignment; alignment
// needs the Per Layer scope and a 2D layout.
function syncCompatibility(): void {
  const el = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T | null
  const box3d = el<HTMLInputElement>('layout3dCheckbox')
  const local = el<HTMLSelectElement>('localLayoutAlgorithmChoice')
  const weights = el<HTMLInputElement>('useEdgeWeightsCheckbox')
  const align = el<HTMLSelectElement>('alignmentMode')
  const algorithm = el<HTMLSelectElement>('layoutAlgorithmChoice')
  if (!box3d || !local || !weights || !align || !algorithm) return
  const single = ctx.networkMode === 'single'
  const scope: Scope = single ? 'allLayers' : currentScope()
  const three = box3d.checked
  const notes: string[] = []
  local.disabled = scope !== 'nodesPerLayers'
  // no algorithm chosen yet: the switch stays usable (weights count once a
  // weighted algorithm runs)
  const weightsOk =
    (algorithm.value === '-' || MAIN_WEIGHTED.includes(algorithm.value)) &&
    (scope === 'perLayer' || scope === 'allLayers') &&
    (align.disabled || align.value === 'none')
  weights.disabled = !weightsOk
  if (!weightsOk && weights.checked)
    notes.push(
      `Edge weights are left out here: they work with ${MAIN_WEIGHTED.join(', ')} on the Per Layer or All Selected Layers scope, without alignment.`
    )
  const umap = algorithm.value === UMAP
  const alignOk = !single && scope === 'perLayer' && !three && !umap
  align.disabled = !alignOk
  const reference = el<HTMLSelectElement>('alignmentReference')
  const strength = el<HTMLInputElement>('alignmentStrength')
  if (reference) reference.disabled = !alignOk
  if (strength) strength.disabled = !alignOk
  const alignNote = el('alignmentNote')
  if (alignNote) {
    alignNote.textContent = alignOk
      ? ''
      : umap
        ? 'UMAP places the nodes by itself: alignment works with the other algorithms.'
        : 'Alignment needs the Per Layer scope and a 2D layout.'
    alignNote.classList.toggle('d-none', alignOk)
  }
  el('umapOptionsBox')?.classList.toggle('d-none', !umap)
  // the folded Weights & 3D sub-section still says what is on
  const hint = el('layoutOptionsHint')
  if (hint)
    hint.textContent = `${three ? '3D' : '2D'} layout, ${useWeights() ? 'edge weights' : 'no edge weights'}`
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

// also read by the Analyze panels (same channel filter as layouts)
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

  const is3d = (document.getElementById('layout3dCheckbox') as HTMLInputElement)
    .checked
  if (is3d && !MAIN_3D.includes(algorithm))
    return status(`${algorithm} has no 3D version.`, true)
  const align = document.getElementById('alignmentMode') as HTMLSelectElement
  const umap = algorithm === UMAP
  let umapFields = {}
  try {
    if (umap) {
      const choice = readUmapChoice('umap')
      umapFields = { umap: umapOptions(choice, layers), seed: choice.seed }
    }
  } catch (err) {
    return status(err instanceof Error ? err.message : String(err), true)
  }
  if (
    !umap &&
    !align.disabled &&
    align.value !== 'none' &&
    (scope !== 'perLayer' || is3d)
  )
    return status(
      'Alignment works with the Per Layer scope and a 2D layout.',
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
        ...(align.disabled || umap ? {} : alignmentFields(scope)),
        channel_weights: useWeights() ? channelWeights() : null,
        ...umapFields,
      },
      false,
      layoutProgress.upload(
        umap
          ? 'Computing UMAP on the server (the first run after a server start takes about 20 s)'
          : `Computing ${algorithm} on the server`
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

  document
    .getElementById('layoutOpenClustering')
    ?.addEventListener('click', (e) => {
      e.preventDefault()
      showTab('#panel-clustering')
      openCard(document.getElementById('runClustering'))
    })

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
    'useEdgeWeightsCheckbox',
    'alignmentMode',
  ])
    document.getElementById(id)?.addEventListener('change', syncCompatibility)
  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="subgraphChoice"]'
  ))
    radio.addEventListener('change', syncCompatibility)
  bus.on('network:loaded', syncCompatibility)
  initUmapForm('umap')
  syncCompatibility()
  bus.on('mode:changed', ({ mode }) => {
    const box = document.getElementById('layout3dCheckbox') as HTMLInputElement
    if (mode === 'single' && ctx.layers.length > 1 && !box.checked) {
      box.checked = true
      syncAlgorithmOptions()
    }
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
    // alignment needs Per Layer and 2D: set them, then run
    const perLayer = document.getElementById(
      'subgraph_perLayer'
    ) as HTMLInputElement
    if (!perLayer.checked) perLayer.click()
    const box = document.getElementById('layout3dCheckbox') as HTMLInputElement
    if (box.checked) {
      box.checked = false
      box.dispatchEvent(new Event('change', { bubbles: true }))
    }
    syncCompatibility()
    if (alignMode.value === 'none') alignMode.value = 'soft'
    syncAlign()
    void onRunLayout()
  })
  const arrangement = document.getElementById(
    'layerArrangement'
  ) as HTMLSelectElement
  const syncHiveOptions = () => {
    document
      .getElementById('hiveOptions')
      ?.classList.toggle('d-none', arrangement.value !== 'hive')
    // a height lifts nodes off a flat hive's plane: none with 3D axes
    const in3d =
      (document.getElementById('hiveAxes') as HTMLSelectElement).value === '3d'
    const height = document.getElementById('hiveHeight') as HTMLSelectElement
    height.disabled = in3d
    if (in3d) height.value = ''
    document.getElementById('hiveHeightNote')?.classList.toggle('d-none', !in3d)
  }
  arrangement.addEventListener('change', syncHiveOptions)
  document
    .getElementById('hiveAxes')
    ?.addEventListener('change', syncHiveOptions)
  syncHiveOptions()
  document
    .getElementById('applyArrangement')
    ?.addEventListener('click', () => void arrangeLayers())
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

async function arrangeLayers(): Promise<void> {
  if (ctx.layers.length <= 1)
    return status('Arrangements need at least two layers.', true)
  const name = (
    document.getElementById('layerArrangement') as HTMLSelectElement
  ).value as PredefinedLayout
  const label = PREDEFINED_LAYOUTS.find(([v]) => v === name)?.[1] ?? name
  if (name !== 'hive') {
    history.execute(
      new PredefinedLayoutCommand(name, () => {
        applyPredefinedLayout(name)
        // the chord ring is wider than the default zoom: bring it all into
        // view, in the same undo step
        if (name === 'chord') fitViewNow()
      })
    )
    return status(`Layers arranged: ${label}.`)
  }
  const pick = (id: string) =>
    (document.getElementById(id) as HTMLSelectElement).value
  const property = pick('hiveProperty') as HiveProperty
  const scale = pick('hiveScale') as HiveScale
  const curved = (document.getElementById('hiveCurved') as HTMLInputElement)
    .checked
  const axes = pick('hiveAxes') as HiveAxes
  const height = pick('hiveHeight') as HiveProperty | ''
  try {
    const remote = ['betweenness', 'clustering']
    if (remote.includes(property) || remote.includes(height))
      status('Computing the node properties for the axes…')
    const input: HiveInput = {
      position: hivePositions(await hiveValues(property), scale),
      curved,
      axes,
      height:
        axes === 'flat' && height
          ? hivePositions(await hiveValues(height), scale)
          : null,
    }
    history.execute(
      new PredefinedLayoutCommand('hive', () => {
        applyPredefinedLayout('hive', input)
        fitViewNow(HIVE_FIT)
      })
    )
    const of = (list: [string, string][], v: string) =>
      list.find(([k]) => k === v)?.[1] ?? v
    status(
      `Hive plot: ${ctx.layers.length} axes${axes === '3d' ? ' spread in 3D' : ''}, nodes by ${of(HIVE_PROPERTIES, property).toLowerCase()} (${of(HIVE_SCALES, scale).toLowerCase()})${input.height ? `, height by ${of(HIVE_PROPERTIES, height).toLowerCase()}` : ''}.`
    )
  } catch (err) {
    status(err instanceof Error ? err.message : String(err), true)
  }
}

// The Group Layout card never offers what its strategy cannot run (mirrors
// runGroupLayout's guard and the backend's check_combination): in 3D (layers
// as groups, or every chosen layer a sphere/cube/cloud) only 3D algorithms,
// and no Kamada-Kawai inside groups (igraph bug); group gravity only with
// the algorithms that read edge weights; virtual nodes not with Circle, Grid
// or Random, which ignore edges; super nodes always lay groups out locally.
// A choice ruled out falls back, and a note says why.
function syncGroupOptions(): void {
  const el = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T
  const source = el<HTMLSelectElement>('groupSource')
  const strategy = el<HTMLSelectElement>('groupStrategy').value as GroupStrategy
  const algorithm = el<HTMLSelectElement>('groupAlgorithm')
  const local = el<HTMLSelectElement>('groupLocal')
  // the layers the run uses: every layer while none is ticked
  const { network, selectedLayers } = store.get()
  const layers =
    ctx.networkMode === 'single' || selectedLayers.length === 0
      ? (network?.layers ?? [])
      : selectedLayers
  const three = groupLayoutRuns3D(source.value as GroupSource, layers)
  const notes: string[] = []
  if (three)
    notes.push(
      source.value === 'layers'
        ? 'Layers as groups are laid out in 3D: only algorithms with a 3D version are offered.'
        : 'Sphere/cube/cloud layers get 3D group layouts: only algorithms with a 3D version are offered.'
    )
  if (strategy === 'gravity')
    notes.push(
      `Group gravity works through edge weights, so it runs ${WEIGHTED_ALGORITHMS.slice(0, -1).join(', ')} or ${WEIGHTED_ALGORITHMS.at(-1)} — the others ignore weights.`
    )
  if (strategy === 'virtual')
    notes.push(
      'Virtual nodes pull through edges, so Circle, Grid and Random (which ignore edges) are not offered.'
    )
  const restrict = (
    select: HTMLSelectElement,
    problem: (value: string) => string | null,
    fallback: string
  ) => {
    for (const option of select.options) {
      const ruledOut = problem(option.value) !== null
      option.hidden = ruledOut
      option.disabled = ruledOut
    }
    if (problem(select.value) === null) return
    const label = select.selectedOptions[0]?.textContent ?? select.value
    notes.push(`${label} was switched to ${fallback}.`)
    select.value = fallback
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }
  restrict(
    algorithm,
    (a) => groupAlgorithmProblem(strategy, a, three),
    'Fruchterman-Reingold'
  )
  restrict(local, (l) => groupLocalProblem(strategy, l, three), 'Circle')
  const note = el('groupCompat')
  note.textContent = notes.join(' ')
  note.classList.toggle('d-none', notes.length === 0)
  el('groupNoClusters').classList.toggle(
    'd-none',
    source.value !== 'clusters' || ctx.nodeObjects.some((n) => n.cluster !== '')
  )
}

// NORMA-2.0 group layouts (actions/group_layout.ts)
function initGroupLayout(): void {
  const el = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T
  const strategy = el<HTMLSelectElement>('groupStrategy')
  const source = el<HTMLSelectElement>('groupSource')
  const local = el<HTMLSelectElement>('groupLocal')
  local.value = 'Circle'
  el<HTMLSelectElement>('groupAlgorithm').value = 'Fruchterman-Reingold'
  source.addEventListener('change', syncGroupOptions)
  strategy.addEventListener('change', syncGroupOptions)
  document
    .getElementById('groupLayoutCard')
    ?.addEventListener('toggle', syncGroupOptions)
  bus.on('history:changed', syncGroupOptions) // layer container/selection changes
  bus.on('network:loaded', syncGroupOptions)
  bus.on('mode:changed', syncGroupOptions)
  bus.on('clustering:applied', syncGroupOptions)
  syncGroupOptions()
  el('groupOpenClustering').addEventListener('click', (e) => {
    e.preventDefault()
    showTab('#panel-clustering')
    openCard(document.getElementById('runClustering'))
  })
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
