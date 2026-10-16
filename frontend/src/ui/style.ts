// Style panel — PLAN-ROADMAP Phase 24: rich editing of nodes and edges,
// palettes (incl. colour-blind-safe ones), a colour-blind friendly mode and
// a colour-vision-deficiency simulator.

import { bus } from '../bus'
import { ctx } from '../three'
import { colorNodesByValues } from '../actions/values'
import { nodeTargets } from '../actions/style'
import { escapeHtml } from '../utils'
import {
  NODE_SHAPE_LABELS as SHAPES,
  type NodeGeometryType,
} from '../three/Node'
import {
  colorBlindMode,
  colorChannelsByPalette,
  colorNodesBy,
  styleEdges,
  styleNodes,
  type ColorBy,
  type EdgeTarget,
  type NodeTarget,
} from '../actions/style'
import {
  CATEGORICAL_LABELS,
  SEQUENTIAL_LABELS,
  simulateCvd,
  type CategoricalPalette,
  type CvdMode,
  type SequentialPalette,
} from '../actions/palettes'

const opts = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([v, l]) => `<option value="${v}">${l}</option>`)
    .join('')

const STYLE_HTML = `
<div class="col-md-8 col-lg-6">
  <h6 class="mb-2">Nodes</h6>
  <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
    <label class="form-label m-0" for="styleNodeTarget">Apply to:</label>
    <select id="styleNodeTarget" class="form-select form-select-sm" style="width:auto"></select>
  </div>
  <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
    <input type="color" id="styleNodeColor" value="#3987e5" aria-label="Node colour" />
    <button id="styleNodeColorApply" class="btn btn-outline-primary btn-sm">Colour</button>
    <input type="range" id="styleNodeSize" min="0.2" max="4" step="0.1" value="1" style="width:7rem" aria-label="Node size" />
    <span id="styleNodeSizeValue" class="small">1.0×</span>
    <button id="styleNodeSizeApply" class="btn btn-outline-primary btn-sm">Size</button>
    <select id="styleNodeShape" class="form-select form-select-sm" style="width:auto" aria-label="Node shape">${opts(SHAPES)}</select>
    <button id="styleNodeShapeApply" class="btn btn-outline-primary btn-sm">Shape</button>
  </div>
  <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
    <label class="form-label m-0" for="styleColorBy">Colour by:</label>
    <select id="styleColorBy" class="form-select form-select-sm" style="width:auto">
      ${opts({ layer: 'Layer', cluster: 'Cluster', annotation: 'First annotation', degree: 'Degree' })}
      <option value="values" disabled>Uploaded values</option>
    </select>
    <select id="styleValueColumn" class="form-select form-select-sm d-none" style="width:auto" aria-label="Value column"></select>
    <select id="styleCategorical" class="form-select form-select-sm" style="width:auto" aria-label="Categorical palette">${opts(CATEGORICAL_LABELS)}</select>
    <select id="styleSequential" class="form-select form-select-sm d-none" style="width:auto" aria-label="Sequential palette">${opts(SEQUENTIAL_LABELS)}</select>
    <button id="styleColorByApply" class="btn btn-outline-primary btn-sm">Apply Palette</button>
  </div>

  <h6 class="mb-2">Edges</h6>
  <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
    <label class="form-label m-0" for="styleEdgeTarget">Apply to:</label>
    <select id="styleEdgeTarget" class="form-select form-select-sm" style="width:auto">
      ${opts({ all: 'All edges', selected: 'Selected edges', intra: 'Intra-layer edges', inter: 'Inter-layer edges' })}
    </select>
  </div>
  <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
    <input type="color" id="styleEdgeColor" value="#cfcfcf" aria-label="Edge colour" />
    <button id="styleEdgeColorApply" class="btn btn-outline-primary btn-sm">Colour</button>
    <input type="range" id="styleEdgeWidth" min="0.25" max="5" step="0.25" value="1" style="width:7rem" aria-label="Edge width factor" />
    <span id="styleEdgeWidthValue" class="small">1.00×</span>
    <button id="styleEdgeWidthApply" class="btn btn-outline-primary btn-sm">Width</button>
    <button id="styleChannelPalette" class="btn btn-outline-primary btn-sm" title="Colour channels with the categorical palette above">Channel Palette</button>
  </div>

  <h6 class="mb-2">Colour Vision</h6>
  <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
    <button id="colorBlindMode" class="btn btn-primary btn-sm" title="Okabe–Ito colours by layer (or cluster), the same for channels, and one node shape per layer">Colour-Blind Friendly Mode</button>
    <label class="form-label m-0" for="cvdSimulate">Preview as:</label>
    <select id="cvdSimulate" class="form-select form-select-sm" style="width:auto">
      ${opts({ none: 'Normal vision', protanopia: 'Protanopia (red-blind)', deuteranopia: 'Deuteranopia (green-blind)', tritanopia: 'Tritanopia (blue-blind)', achromatopsia: 'Achromatopsia (no colour)' })}
    </select>
  </div>
  <div id="style_status" class="small"></div>
</div>
`

function status(msg: string, isError = false): void {
  const el = document.getElementById('style_status')
  if (!el) return
  el.textContent = msg
  el.className = `small ${isError ? 'text-danger' : 'text-success'}`
}

const value = (id: string) =>
  (document.getElementById(id) as HTMLInputElement).value

function fillNodeTargets(): void {
  const sel = document.getElementById('styleNodeTarget') as HTMLSelectElement
  sel.innerHTML =
    opts({ selected: 'Selected nodes', all: 'All nodes' }) +
    ctx.layers
      .map(
        (l) =>
          `<option value="layer:${escapeHtml(l.name)}">Layer ${escapeHtml(l.name)}</option>`
      )
      .join('')
}

export function initStylePanel(): void {
  const pane = document.getElementById('panel-style')
  if (!pane) return
  pane.innerHTML = STYLE_HTML
  fillNodeTargets()
  bus.on('network:loaded', fillNodeTargets)

  const nodeTarget = () => value('styleNodeTarget') as NodeTarget
  const done = (n: number, what: string) =>
    n
      ? status(`${what} (${n}).`)
      : status(
          'Nothing to change — check "Apply to" (select nodes/edges first?).',
          true
        )

  document
    .getElementById('styleNodeColorApply')
    ?.addEventListener('click', () =>
      done(
        styleNodes(nodeTarget(), { color: value('styleNodeColor') }),
        'Nodes recoloured'
      )
    )
  const size = document.getElementById('styleNodeSize') as HTMLInputElement
  size.addEventListener('input', () => {
    document.getElementById('styleNodeSizeValue')!.textContent =
      `${Number(size.value).toFixed(1)}×`
  })
  document
    .getElementById('styleNodeSizeApply')
    ?.addEventListener('click', () =>
      done(
        styleNodes(nodeTarget(), { scale: Number(size.value) }),
        'Nodes resized'
      )
    )
  document
    .getElementById('styleNodeShapeApply')
    ?.addEventListener('click', () =>
      done(
        styleNodes(nodeTarget(), {
          shape: value('styleNodeShape') as NodeGeometryType,
        }),
        'Node shapes changed'
      )
    )

  const colorBy = document.getElementById('styleColorBy') as HTMLSelectElement
  const column = document.getElementById(
    'styleValueColumn'
  ) as HTMLSelectElement
  colorBy.addEventListener('change', () => {
    const seq = colorBy.value === 'degree' || colorBy.value === 'values'
    document.getElementById('styleSequential')!.classList.toggle('d-none', !seq)
    document.getElementById('styleCategorical')!.classList.toggle('d-none', seq)
    column.classList.toggle('d-none', colorBy.value !== 'values')
  })
  // a values file (File panel) switches the option on and lists its columns
  bus.on('values:loaded', ({ columns }) => {
    const option = colorBy.querySelector<HTMLOptionElement>(
      'option[value="values"]'
    )!
    option.disabled = columns.length === 0
    column.innerHTML = columns
      .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
      .join('')
    if (columns.length) {
      colorBy.value = 'values'
      colorBy.dispatchEvent(new Event('change', { bubbles: true }))
      // nothing selected yet: the values are for the whole network
      const target = document.getElementById(
        'styleNodeTarget'
      ) as HTMLSelectElement
      if (target.value === 'selected' && nodeTargets('selected').length === 0)
        target.value = 'all'
    }
  })
  document
    .getElementById('styleColorByApply')
    ?.addEventListener('click', () => {
      if (colorBy.value === 'values') {
        const r = colorNodesByValues(
          nodeTarget(),
          column.value,
          value('styleSequential') as SequentialPalette
        )
        return r
          ? status(
              `Coloured ${r.colored} nodes by ${column.value} (${r.min} to ${r.max}${r.diverging ? ', diverging around 0' : ''}).`
            )
          : status(
              'No node in "Apply to" has a value in that column — select nodes, or choose All nodes.',
              true
            )
      }
      const groups = colorNodesBy(
        nodeTarget(),
        colorBy.value as ColorBy,
        value('styleCategorical') as CategoricalPalette,
        value('styleSequential') as SequentialPalette
      )
      if (!groups) return status('No nodes to colour — check "Apply to".', true)
      status(
        colorBy.value !== 'degree' && groups > 8
          ? `Coloured ${groups} groups; groups past the 8th share a neutral grey (a palette can't keep more apart).`
          : `Coloured by ${colorBy.value} (${groups} group${groups === 1 ? '' : 's'}).`
      )
    })

  const edgeTarget = () => value('styleEdgeTarget') as EdgeTarget
  document
    .getElementById('styleEdgeColorApply')
    ?.addEventListener('click', () =>
      done(
        styleEdges(edgeTarget(), { color: value('styleEdgeColor') }),
        'Edges recoloured'
      )
    )
  const width = document.getElementById('styleEdgeWidth') as HTMLInputElement
  width.addEventListener('input', () => {
    document.getElementById('styleEdgeWidthValue')!.textContent =
      `${Number(width.value).toFixed(2)}×`
  })
  document
    .getElementById('styleEdgeWidthApply')
    ?.addEventListener('click', () =>
      done(
        styleEdges(edgeTarget(), { widthFactor: Number(width.value) }),
        'Edge widths changed'
      )
    )
  document
    .getElementById('styleChannelPalette')
    ?.addEventListener('click', () => {
      const n = colorChannelsByPalette(
        value('styleCategorical') as CategoricalPalette
      )
      if (n) status(`Coloured ${n} channels.`)
      else status('This network has no channels.', true)
    })

  document.getElementById('colorBlindMode')?.addEventListener('click', () => {
    if (ctx.nodeObjects.length === 0)
      return status('Load a network first.', true)
    colorBlindMode()
    status(
      'Colour-blind friendly: Okabe–Ito colours plus one node shape per layer (undo to revert).'
    )
  })
  document
    .getElementById('cvdSimulate')
    ?.addEventListener('change', () =>
      simulateCvd(value('cvdSimulate') as CvdMode)
    )
}
