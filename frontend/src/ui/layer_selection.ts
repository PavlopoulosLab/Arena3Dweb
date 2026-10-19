// Layer selection panel (top bar → Layer selection): which layers the
// Layout, Clustering, Analyze and Export panels work on (with a button to
// each), with a Hide and a Labels switch per layer. v2 (and Arena3D 3.0
// until now) kept these checkboxes at the top
// of the Layout panel (www/js/object_actions/layer.js attachLayerCheckboxes);
// they are a step of their own now, so the Layout panel starts at the
// algorithm. The panel is hidden in Single network mode (one graph).

import { bus } from '../bus'
import { ctx } from '../three'
import { escapeHtml, safeColor } from '../utils'
import { showTab } from './tabs'
import { layerSwatchColor } from '../actions/legend'
import {
  selectLayer,
  selectAllLayers,
  setLayerVisibility,
  setLayerNodeLabels,
  setLayerCoords,
} from '../actions/layer'
import { syncLayerCoordsControls } from './layer'

const HTML = `
<div class="col-md-8 col-lg-6 layout-panel" id="layerSelectionPanel">
  <section class="lp-section">
    <h6 class="lp-title">Layer selection</h6>
    <div class="form-text mt-0 mb-2">
      Tick the layers to work on: layouts, alignment, the analyses and the NORMA export run on the selected layers
      (on every layer while none is ticked). <i>Hide</i> takes a layer and its inter-layer edges out of the view;
      <i>Labels</i> shows the names of its nodes; <i>Axes</i> draws its own coordinate system.
    </div>
    <div class="d-flex flex-wrap align-items-center gap-3 mb-2">
      <div class="form-check mb-0">
        <input class="form-check-input" type="checkbox" id="selectAllLayersCheckbox" />
        <label class="form-check-label" for="selectAllLayersCheckbox">Select/Deselect All Layers</label>
      </div>
      <button id="invertLayerSelection" class="btn btn-outline-secondary btn-sm" title="Tick the unticked layers and untick the ticked ones">Invert</button>
      <span id="layerSelectionCount" class="small text-secondary"></span>
    </div>
    <div id="checkboxdiv" class="checkboxdiv mb-2"></div>
    <div id="layerSelectionEmpty" class="form-text">Load a network to list its layers.</div>
  </section>
  <section class="lp-section">
    <h6 class="lp-title">Then work on them</h6>
    <div class="form-text mt-0 mb-2">These panels use the ticked layers (every layer while none is ticked):</div>
    <div id="layerSelectionNext" class="d-flex flex-wrap gap-2">
      <button class="btn btn-outline-primary btn-sm" data-goto="#panel-layouts">Layout…</button>
      <button class="btn btn-outline-primary btn-sm" data-goto="#panel-clustering">Clustering…</button>
      <button class="btn btn-outline-primary btn-sm" data-goto="#panel-metrics">Metrics…</button>
      <button class="btn btn-outline-primary btn-sm" data-goto="#panel-statistics">Statistics…</button>
      <button class="btn btn-outline-primary btn-sm" data-goto="#panel-plots">Plots…</button>
      <button class="btn btn-outline-primary btn-sm" data-goto="#panel-perturbation">Perturbation…</button>
      <button class="btn btn-outline-primary btn-sm" data-goto="#panel-export">Export…</button>
    </div>
  </section>
</div>
`

/** "2 of 4 layers selected", or what happens while none is. */
export function selectionSummary(): string {
  const n = ctx.layers.length
  const k = ctx.layers.filter((l) => l.isSelected).length
  if (n === 0) return 'No network loaded.'
  if (k === 0) return `No layer selected: all ${n} are used.`
  return `${k} of ${n} layer${n === 1 ? '' : 's'} selected.`
}

function syncSummary(): void {
  const count = document.getElementById('layerSelectionCount')
  if (count) count.textContent = selectionSummary()
  const all = document.getElementById(
    'selectAllLayersCheckbox'
  ) as HTMLInputElement | null
  if (all)
    all.checked = ctx.layers.length > 0 && ctx.layers.every((l) => l.isSelected)
  const empty = document.getElementById('layerSelectionEmpty')
  if (empty) empty.classList.toggle('d-none', ctx.layers.length > 0)
}

// v2 attachLayerCheckboxes: per layer a select checkbox (labelled with the
// layer name, with the legend's colour for it) plus Hide and Labels checkboxes.
// XSS fix: layer.name comes straight from an uploaded TSV/session file, so it
// must go through escapeHtml() before landing in the innerHTML template below.
export function buildLayerCheckboxes(): void {
  const container = document.getElementById('checkboxdiv')
  if (!container) return
  container.innerHTML = ''
  const nodesOf = new Map<string, number>()
  for (const id of ctx.nodeLayerNames) {
    const layer = ctx.nodeGroups[id]
    nodesOf.set(layer, (nodesOf.get(layer) ?? 0) + 1)
  }
  ctx.layers.forEach((layer, i) => {
    const row = document.createElement('div')
    row.className = 'layer-row'
    const color = layerSwatchColor(layer.name)
    const nodes = nodesOf.get(layer.name) ?? 0
    row.innerHTML = `
      <input class="form-check-input layer_checkbox" type="checkbox" id="checkbox_${i}" ${layer.isSelected ? 'checked' : ''} />
      <span class="layer-row__swatch" style="background:${escapeHtml(safeColor(color))}" aria-hidden="true"></span>
      <label class="form-check-label layer_label layer-row__name" for="checkbox_${i}">${escapeHtml(layer.name)}</label>
      <span class="layer-row__count">${nodes} node${nodes === 1 ? '' : 's'}</span>
      <label class="form-check-label layer-row__opt" for="checkbox2_${i}">
        <input class="form-check-input hideLayer_checkbox" type="checkbox" id="checkbox2_${i}" ${layer.plane.visible ? '' : 'checked'} />Hide</label>
      <label class="form-check-label layer-row__opt" for="checkbox3_${i}">
        <input class="form-check-input showLayerNodes_checkbox" type="checkbox" id="checkbox3_${i}" />Labels</label>
      <label class="form-check-label layer-row__opt" for="checkbox4_${i}" title="This layer's own X, Y and Z axes">
        <input class="form-check-input layerAxes_checkbox" type="checkbox" id="checkbox4_${i}" ${layer.coordsShown ? 'checked' : ''} />Axes</label>
    `
    const [sel, hide, labels, axes] = row.querySelectorAll('input')
    sel.addEventListener('change', () => selectLayer(i, sel.checked))
    hide.addEventListener('change', () => setLayerVisibility(i, !hide.checked))
    labels.addEventListener('change', () =>
      setLayerNodeLabels(i, labels.checked)
    )
    axes.addEventListener('change', () => {
      setLayerCoords(i, axes.checked)
      syncLayerCoordsControls()
    })
    container.appendChild(row)
  })
  syncSummary()
}

// The tick boxes follow the selection wherever it changes (a click on a
// floor, undo, a session) without a rebuild.
function syncTicks(): void {
  ctx.layers.forEach((layer, i) => {
    const box = document.getElementById(
      `checkbox_${i}`
    ) as HTMLInputElement | null
    if (box) box.checked = layer.isSelected
  })
  syncLayerCoordsControls() // "Selected" axes follow the selection
  syncSummary()
}

export function initLayerSelectionPanel(): void {
  const pane = document.getElementById('panel-layer-selection')
  if (!pane) return
  pane.innerHTML = HTML
  document
    .getElementById('selectAllLayersCheckbox')
    ?.addEventListener('change', (e) => {
      selectAllLayers((e.target as HTMLInputElement).checked)
      syncTicks()
    })
  document
    .getElementById('invertLayerSelection')
    ?.addEventListener('click', () => {
      ctx.layers.forEach((layer, i) => selectLayer(i, !layer.isSelected))
      syncTicks()
    })
  // on to the panels that use the selection
  for (const button of pane.querySelectorAll<HTMLButtonElement>(
    '#layerSelectionNext [data-goto]'
  ))
    button.addEventListener('click', () => showTab(button.dataset.goto!))
  bus.on('network:loaded', buildLayerCheckboxes)
  bus.on('layers:selected', syncTicks)
  syncSummary()
}
