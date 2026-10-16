// Node Actions panel — port of v2 views/node.R. The node search lives in the
// Find panel (ui/find.ts).

import { showNodeLabels, resizeNodeLabels } from '../actions/labels'
import { bus } from '../bus'
import { ctx } from '../three'
import {
  selectAllNodes,
  setNodeColorPriority,
  setNodeSelectedColorPriority,
} from '../actions/node'
import {
  NODE_SHAPE_LABELS,
  NODE_SHAPES,
  type NodeGeometryType,
} from '../three/Node'
import { getSelectedLayers } from '../actions/layer'
import { history } from '../commands/base'
import { ChangeNodeGeometryCommand, LabelStyleCommand } from '../commands/scene'

const NODE_HTML = `
<div class="col-md-6 col-lg-4">
  <h6>Selection &amp; labels</h6>
  <div class="form-check mb-3">
    <input class="form-check-input" type="checkbox" id="selectAllNodes" />
    <label class="form-check-label" for="selectAllNodes">Select / Deselect all Nodes</label>
  </div>
  <label class="form-label">Show Labels:</label>
  <div class="mb-3">
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="showNodeLabelsRadio" id="nodeLabels_all" value="all" />
      <label class="form-check-label" for="nodeLabels_all">All</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="showNodeLabelsRadio" id="nodeLabels_selected" value="selected" checked />
      <label class="form-check-label" for="nodeLabels_selected">Selected</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="showNodeLabelsRadio" id="nodeLabels_none" value="none" />
      <label class="form-check-label" for="nodeLabels_none">None</label>
    </div>
  </div>
  <div class="mb-3">
    <label class="form-label" for="resizeNodeLabels">Resize Labels:</label>
    <input type="range" class="form-range" id="resizeNodeLabels" min="5" max="15" step="1" value="12" />
  </div>
  <h6>Label style</h6>
  <div class="lp-grid mb-2">
    <div>
      <label class="form-label small" for="labelColor">Colour</label>
      <input type="color" id="labelColor" class="form-control form-control-color form-control-sm" value="#ffffff" title="Label colour" />
    </div>
    <div>
      <label class="form-label small" for="labelFont">Font</label>
      <select id="labelFont" class="form-select form-select-sm">
        <option value="system">System</option>
        <option value="serif">Serif</option>
        <option value="mono">Monospace</option>
      </select>
    </div>
  </div>
  <div class="d-flex flex-wrap gap-3 mb-2">
    <div class="form-check form-check-inline m-0">
      <input class="form-check-input" type="checkbox" id="labelBold" />
      <label class="form-check-label" for="labelBold">Bold</label>
    </div>
    <div class="form-check form-check-inline m-0">
      <input class="form-check-input" type="checkbox" id="labelItalic" />
      <label class="form-check-label" for="labelItalic">Italic</label>
    </div>
    <div class="form-check form-check-inline m-0">
      <input class="form-check-input" type="checkbox" id="labelHalo" />
      <label class="form-check-label" for="labelHalo">Dark halo</label>
    </div>
    <div class="form-check form-check-inline m-0">
      <input class="form-check-input" type="checkbox" id="labelBackground" />
      <label class="form-check-label" for="labelBackground">Background</label>
    </div>
  </div>
  <label class="form-label small mb-0" for="labelOpacity">Opacity: <span id="labelOpacityValue">1.00</span></label>
  <input type="range" class="form-range" id="labelOpacity" min="0.2" max="1" step="0.05" value="1" />
  <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
    <div class="form-check form-check-inline m-0">
      <input class="form-check-input" type="radio" name="labelStyleTarget" id="labelTarget_all" value="all" checked />
      <label class="form-check-label" for="labelTarget_all">All nodes</label>
    </div>
    <div class="form-check form-check-inline m-0" data-multilayer-only>
      <input class="form-check-input" type="radio" name="labelStyleTarget" id="labelTarget_layers" value="layers" />
      <label class="form-check-label" for="labelTarget_layers">Selected layers</label>
    </div>
    <button id="applyLabelStyle" class="btn btn-outline-primary btn-sm">Apply Label Style</button>
  </div>
  <div class="form-text mb-3">Colour, font, weight, halo, background and opacity of the node labels — for all of them, or for the layers selected in Layout, so each layer can read differently. Labels follow the theme colour until a colour is applied; undoable.</div>
  <h6>Shape</h6>
  <label class="form-label" for="nodeGeometry">Node Geometry:</label>
  <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
    <select id="nodeGeometry" class="form-select form-select-sm" style="width:auto" aria-label="Node geometry">
      ${NODE_SHAPES.map((s) => `<option value="${s}">${NODE_SHAPE_LABELS[s]}</option>`).join('')}
    </select>
    <div class="form-check form-check-inline m-0">
      <input class="form-check-input" type="radio" name="nodeGeometryTarget" id="nodeGeomTarget_all" value="all" checked />
      <label class="form-check-label" for="nodeGeomTarget_all">All nodes</label>
    </div>
    <div class="form-check form-check-inline m-0" data-multilayer-only>
      <input class="form-check-input" type="radio" name="nodeGeometryTarget" id="nodeGeomTarget_layers" value="layers" />
      <label class="form-check-label" for="nodeGeomTarget_layers">Selected layers</label>
    </div>
  </div>
  <div class="form-text mb-2">Each layer can have its own shape: tick layers in the Layer selection tab, pick <i>Selected layers</i>, then a shape.</div>
  <div id="node_status" class="small mb-3"></div>
  <h6>Colours</h6>
  <label class="form-label">Color Priority:</label>
  <div class="mb-3">
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="nodeColorPriorityRadio" id="nodePriority_default" value="default" checked />
      <label class="form-check-label" for="nodePriority_default">Default / Imported</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="nodeColorPriorityRadio" id="nodePriority_cluster" value="cluster" />
      <label class="form-check-label" for="nodePriority_cluster">Clustering</label>
    </div>
  </div>
  <div class="form-check mb-3">
    <input class="form-check-input" type="checkbox" id="nodeSelectedColorPriority" checked />
    <label class="form-check-label" for="nodeSelectedColorPriority">Highlight Selected Nodes</label>
  </div>
</div>
`

export function initNodePanel(): void {
  const pane = document.getElementById('panel-node')
  if (!pane) return
  pane.innerHTML = NODE_HTML

  document.getElementById('selectAllNodes')?.addEventListener('change', (e) => {
    selectAllNodes((e.target as HTMLInputElement).checked)
  })

  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="showNodeLabelsRadio"]'
  )) {
    radio.addEventListener('change', () => {
      showNodeLabels(radio.value as 'all' | 'selected' | 'none')
    })
  }

  document
    .getElementById('resizeNodeLabels')
    ?.addEventListener('input', (e) => {
      resizeNodeLabels(Number((e.target as HTMLInputElement).value))
    })

  document.getElementById('labelOpacity')?.addEventListener('input', (e) => {
    document.getElementById('labelOpacityValue')!.textContent = Number(
      (e.target as HTMLInputElement).value
    ).toFixed(2)
  })
  const labelColorInput = document.getElementById(
    'labelColor'
  ) as HTMLInputElement
  bus.on('network:loaded', () => (labelColorInput.value = ctx.labelColor))
  document.getElementById('applyLabelStyle')?.addEventListener('click', () => {
    const input = (id: string) =>
      document.getElementById(id) as HTMLInputElement
    const perLayer = (
      document.getElementById('labelTarget_layers') as HTMLInputElement
    ).checked
    const layers = perLayer
      ? getSelectedLayers().map((i) => ctx.layers[i].name)
      : null
    if (layers && layers.length === 0)
      return nodeStatus('Select layers in Layout first.', true)
    history.execute(
      new LabelStyleCommand(
        {
          color: labelColorInput.value,
          font: (document.getElementById('labelFont') as HTMLSelectElement)
            .value as 'system' | 'serif' | 'mono',
          weight: input('labelBold').checked ? 'bold' : 'normal',
          italic: input('labelItalic').checked,
          halo: input('labelHalo').checked,
          background: input('labelBackground').checked,
          opacity: Number(input('labelOpacity').value),
        },
        layers
      )
    )
    nodeStatus(
      layers
        ? `Label style applied to ${layers.length} layer${layers.length === 1 ? '' : 's'}.`
        : 'Label style applied to all nodes.'
    )
  })

  document.getElementById('nodeGeometry')?.addEventListener('change', (e) => {
    const shape = (e.target as HTMLSelectElement).value as NodeGeometryType
    const perLayer = (
      document.getElementById('nodeGeomTarget_layers') as HTMLInputElement
    ).checked
    const layers = perLayer ? getSelectedLayers() : null
    if (layers && layers.length === 0)
      return nodeStatus('Select layers in Layout first.', true)
    history.execute(new ChangeNodeGeometryCommand(shape, layers))
    nodeStatus(
      layers
        ? `${NODE_SHAPE_LABELS[shape]} nodes in ${layers.length} layer${layers.length === 1 ? '' : 's'}.`
        : `All nodes: ${NODE_SHAPE_LABELS[shape]}.`
    )
  })

  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="nodeColorPriorityRadio"]'
  )) {
    radio.addEventListener('change', () => {
      setNodeColorPriority(radio.value as 'default' | 'cluster')
    })
  }

  document
    .getElementById('nodeSelectedColorPriority')
    ?.addEventListener('change', (e) => {
      setNodeSelectedColorPriority((e.target as HTMLInputElement).checked)
    })
}

function nodeStatus(msg: string, isError = false): void {
  const el = document.getElementById('node_status')
  if (!el) return
  el.textContent = msg
  el.className = `small mb-3 ${isError ? 'text-danger' : 'text-success'}`
}
