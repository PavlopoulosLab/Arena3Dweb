// Style panel — PLAN-ROADMAP Phase 24: rich editing of nodes and edges,
// palettes (incl. colour-blind-safe ones), a colour-blind friendly mode and
// a colour-vision-deficiency simulator. Nodes and edges are edited in a
// property table after Cytoscape's Style panel: what the targets show now,
// the property, a new value, and Set / Reset.

import { bus } from '../bus'
import { ctx } from '../three'
import { colorNodesByValues } from '../actions/values'
import { escapeHtml } from '../utils'
import {
  NODE_SHAPE_LABELS as SHAPES,
  type NodeGeometryType,
} from '../three/Node'
import { LINE_TYPE_LABELS, type LineType } from '../three/Edge'
import {
  colorBlindMode,
  colorChannelsByPalette,
  colorNodesBy,
  edgeTargets,
  nodeTargets,
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

// One property row: what the targets show now (data-now), the property, a
// new value, Set and (for a per-node or per-edge override) Reset.
const prop = (
  key: string,
  name: string,
  forId: string,
  control: string,
  set: string,
  reset = ''
) => `
  <div class="style-props__row" role="row">
    <span class="style-props__now" role="cell" data-now="${key}"></span>
    <label class="style-props__name" role="rowheader" for="${forId}">${name}</label>
    <span class="style-props__value" role="cell">${control}</span>
    <span class="style-props__actions" role="cell">
      <button id="${set}" class="btn btn-outline-primary btn-sm">Set</button>${
        reset
          ? `<button id="${reset}" class="btn btn-outline-secondary btn-sm" title="Back to the default">Reset</button>`
          : ''
      }
    </span>
  </div>`
const range = (
  id: string,
  min: number,
  max: number,
  step: number,
  value: number,
  text: string,
  label: string
) =>
  `<input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}" /><span id="${id}Value" class="small style-props__num">${text}</span>`
const PROPS_HEAD = `
  <div class="style-props__row style-props__head" role="row">
    <span role="columnheader" title="What the nodes or edges in Apply to show now">Now</span>
    <span role="columnheader">Property</span>
    <span role="columnheader">New value</span>
    <span role="columnheader"><span class="visually-hidden">Set or reset</span></span>
  </div>`

const NODE_PROPS = `
<div id="styleNodeProps" class="style-props" role="table" aria-label="Node properties">
  ${PROPS_HEAD}
  ${prop('color', 'Fill colour', 'styleNodeColor', '<input type="color" id="styleNodeColor" value="#3987e5" />', 'styleNodeColorApply')}
  ${prop('alpha', 'Opacity', 'styleNodeAlpha', range('styleNodeAlpha', 0.1, 1, 0.05, 0.5, '0.50', 'Node opacity'), 'styleNodeAlphaApply', 'styleNodeAlphaReset')}
  ${prop(
    'border',
    'Border',
    'styleNodeBorderColor',
    `<input type="color" id="styleNodeBorderColor" value="#ffffff" title="Border colour" />${range('styleNodeBorderWidth', 0.5, 6, 0.5, 2, '2.0', 'Border width')}`,
    'styleNodeBorderApply',
    'styleNodeBorderReset'
  )}
  ${prop('scale', 'Size', 'styleNodeSize', range('styleNodeSize', 0.2, 4, 0.1, 1, '1.0×', 'Node size'), 'styleNodeSizeApply')}
  ${prop(
    'stretch',
    'Proportions',
    'styleNodeStretchW',
    `<span class="style-props__stack">
      ${(['W', 'H', 'D'] as const)
        .map(
          (a) =>
            `<span class="style-props__axis"><abbr title="${{ W: 'Width', H: 'Height', D: 'Depth' }[a]}">${a}</abbr>${range(`styleNodeStretch${a}`, 0.2, 5, 0.1, 1, '1.0×', { W: 'Width', H: 'Height', D: 'Depth (out of the floor)' }[a])}</span>`
        )
        .join('')}
      <span class="form-check m-0 small"><input class="form-check-input" type="checkbox" id="styleNodeStretchLock" checked /><label class="form-check-label" for="styleNodeStretchLock">Lock width, height and depth</label></span>
    </span>`,
    'styleNodeStretchApply',
    'styleNodeStretchReset'
  )}
  ${prop('shape', 'Shape', 'styleNodeShape', `<select id="styleNodeShape" class="form-select form-select-sm">${opts(SHAPES)}</select>`, 'styleNodeShapeApply')}
  ${prop('label', 'Label', 'styleNodeLabel', '<input type="text" id="styleNodeLabel" class="form-control form-control-sm" placeholder="Node name" maxlength="200" />', 'styleNodeLabelApply', 'styleNodeLabelReset')}
  ${prop('labelColor', 'Label colour', 'styleNodeLabelColor', '<input type="color" id="styleNodeLabelColor" value="#ffd43b" />', 'styleNodeLabelColorApply', 'styleNodeLabelColorReset')}
  ${prop('labelSize', 'Label font size', 'styleNodeLabelSize', range('styleNodeLabelSize', 6, 40, 1, 16, '16 px', 'Label font size'), 'styleNodeLabelSizeApply', 'styleNodeLabelSizeReset')}
  ${prop('descr', 'Description', 'styleNodeDescr', '<input type="text" id="styleNodeDescr" class="form-control form-control-sm" placeholder="Shown on hover" maxlength="2000" />', 'styleNodeDescrApply', 'styleNodeDescrReset')}
</div>`

const EDGE_PROPS = `
<div id="styleEdgeProps" class="style-props" role="table" aria-label="Edge properties">
  ${PROPS_HEAD}
  ${prop('color', 'Colour', 'styleEdgeColor', '<input type="color" id="styleEdgeColor" value="#cfcfcf" />', 'styleEdgeColorApply')}
  ${prop('width', 'Width', 'styleEdgeWidth', range('styleEdgeWidth', 0.25, 5, 0.25, 1, '1.00×', 'Edge width factor'), 'styleEdgeWidthApply')}
  ${prop('opacity', 'Opacity', 'styleEdgeOpacity', range('styleEdgeOpacity', 0.05, 1, 0.05, 0.5, '0.50×', 'Edge opacity factor'), 'styleEdgeOpacityApply', 'styleEdgeOpacityReset')}
  ${prop('lineType', 'Line type', 'styleEdgeLineType', `<select id="styleEdgeLineType" class="form-select form-select-sm">${opts(LINE_TYPE_LABELS)}</select>`, 'styleEdgeLineTypeApply')}
  ${prop('arrow', 'Arrow colour', 'styleEdgeArrowColor', '<input type="color" id="styleEdgeArrowColor" value="#ff6b6b" />', 'styleEdgeArrowApply', 'styleEdgeArrowReset')}
</div>`

const STYLE_HTML = `
<div class="col-md-8 col-lg-6">
  <div class="style-head">
    <div class="btn-group btn-group-sm" role="group" aria-label="Style nodes or edges">
      <button type="button" id="styleShowNodes" class="btn btn-outline-secondary active" aria-pressed="true">Nodes <span id="styleNodeTotal" class="style-badge"></span></button>
      <button type="button" id="styleShowEdges" class="btn btn-outline-secondary" aria-pressed="false">Edges <span id="styleEdgeTotal" class="style-badge"></span></button>
    </div>
  </div>
  <section id="styleNodes" aria-label="Node style">
  <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
    <label class="form-label m-0" for="styleNodeTarget">Apply to:</label>
    <select id="styleNodeTarget" class="form-select form-select-sm" style="width:auto"></select>
    <span id="styleNodeCount" class="small style-props__count"></span>
  </div>
  ${NODE_PROPS}
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
  </section>

  <section id="styleEdges" aria-label="Edge style" hidden>
  <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
    <label class="form-label m-0" for="styleEdgeTarget">Apply to:</label>
    <select id="styleEdgeTarget" class="form-select form-select-sm" style="width:auto">
      ${opts({ all: 'All edges', selected: 'Selected edges', intra: 'Intra-layer edges', inter: 'Inter-layer edges' })}
    </select>
    <span id="styleEdgeCount" class="small style-props__count"></span>
  </div>
  ${EDGE_PROPS}
  <div class="form-text mb-2">Opacity multiplies the edge opacity set in Edit → Edges (or by weight). Arrows show when Direction is on; Reset makes them follow the edge colour again.</div>
  <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
    <select id="styleChannelCategorical" class="form-select form-select-sm" style="width:auto" aria-label="Channel palette">${opts(CATEGORICAL_LABELS)}</select>
    <button id="styleChannelPalette" class="btn btn-outline-primary btn-sm" title="Colour the channels with this palette">Channel Palette</button>
  </div>
  </section>

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

// ---------------------------------------------------------------- now column
// What the nodes or edges in "Apply to" show for each property: one value,
// "mixed", or nothing when there are no targets.
type Now = { text?: string; swatch?: string; ring?: string; title: string }

const fmt = (v: number) => String(Number(v.toFixed(2)))

function nodeNow(key: string, i: number): Now {
  const n = ctx.nodeObjects[i]
  switch (key) {
    case 'color':
      return { swatch: n.getColor(), title: n.getColor() }
    case 'alpha':
      return { text: fmt(n.alpha), title: `Opacity ${fmt(n.alpha)}` }
    case 'border':
      return n.borderWidth > 0
        ? {
            text: fmt(n.borderWidth),
            ring: n.borderColor,
            title: `Border ${n.borderColor}, width ${fmt(n.borderWidth)}`,
          }
        : { text: 'none', title: 'No border' }
    case 'scale':
      return {
        text: `${fmt(n.getScale())}×`,
        title: `Size ${fmt(n.getScale())}×`,
      }
    case 'stretch': {
      const [w, h, d] = n.stretch.map(fmt)
      return {
        text: `${w}·${h}·${d}`,
        title: `Width ${w}×, height ${h}×, depth ${d}×`,
      }
    }
    case 'shape':
      return { text: SHAPES[n.shape], title: SHAPES[n.shape] }
    case 'label':
      return n.label
        ? { text: n.label, title: `Label: ${n.label}` }
        : { text: 'name', title: 'The node name' }
    case 'labelColor':
      return n.labelColor
        ? { swatch: n.labelColor, title: n.labelColor }
        : { text: 'auto', title: 'As the label style (Edit → Nodes)' }
    case 'labelSize':
      return n.labelSize
        ? { text: String(n.labelSize), title: `${n.labelSize} px` }
        : { text: 'auto', title: 'As the label size (Edit → Nodes)' }
    default:
      return n.descr
        ? { text: n.descr, title: n.descr }
        : { text: '—', title: 'No description' }
  }
}

const LINE_GLYPHS: Record<LineType, string> = {
  solid: '———',
  dashed: '- - -',
  dotted: '· · ·',
}

function edgeNow(key: string, i: number): Now {
  const e = ctx.edgeObjects[i]
  switch (key) {
    case 'color': {
      const c = e.decideColor(0, true)
      return { swatch: c, title: c }
    }
    case 'width':
      return {
        text: `${fmt(e.widthFactor)}×`,
        title: `Width ${fmt(e.widthFactor)}×`,
      }
    case 'opacity':
      return {
        text: `${fmt(e.opacityFactor)}×`,
        title: `Opacity ${fmt(e.opacityFactor)}×`,
      }
    case 'lineType':
      return {
        text: LINE_GLYPHS[e.lineType],
        title: LINE_TYPE_LABELS[e.lineType],
      }
    default:
      return e.arrowColor
        ? { swatch: e.arrowColor, title: `Arrows ${e.arrowColor}` }
        : { text: 'edge', title: 'Arrows follow the edge colour' }
  }
}

function summarise(ids: number[], f: (i: number) => Now): Now | 'mixed' | null {
  if (ids.length === 0) return null
  const first = f(ids[0])
  const key = JSON.stringify(first)
  for (let k = 1; k < ids.length; k++)
    if (JSON.stringify(f(ids[k])) !== key) return 'mixed'
  return first
}

function paintNow(cell: HTMLElement, now: Now | 'mixed' | null): void {
  cell.textContent = ''
  cell.style.background = ''
  cell.style.boxShadow = ''
  cell.classList.toggle('style-props__now--mixed', now === 'mixed')
  if (now === null) cell.title = 'Nothing in Apply to'
  else if (now === 'mixed') {
    cell.textContent = 'mixed'
    cell.title = 'Mixed values'
  } else {
    cell.textContent = now.text ?? ''
    cell.title = now.title
    if (now.swatch) cell.style.background = now.swatch
    if (now.ring) cell.style.boxShadow = `inset 0 0 0 3px ${now.ring}`
  }
}

// Nodes | Edges: one of the two property tables at a time, as in Edit →
// Attributes; Colour Vision below stays for both
export function showStyleSection(which: 'nodes' | 'edges'): void {
  const nodes = which === 'nodes'
  for (const [id, on] of [
    ['styleShowNodes', nodes],
    ['styleShowEdges', !nodes],
  ] as const) {
    const btn = document.getElementById(id)
    btn?.classList.toggle('active', on)
    btn?.setAttribute('aria-pressed', String(on))
  }
  document.getElementById('styleNodes')?.toggleAttribute('hidden', !nodes)
  document.getElementById('styleEdges')?.toggleAttribute('hidden', nodes)
}

function showTotals(): void {
  const set = (id: string, n: number) => {
    const el = document.getElementById(id)
    if (el) el.textContent = n ? String(n) : ''
  }
  set('styleNodeTotal', ctx.nodeObjects.length)
  set('styleEdgeTotal', ctx.edgeObjects.length)
}

function refreshNow(): void {
  const pane = document.getElementById('panel-style')
  // only while it can be seen: summarising every node costs on big networks
  if (!pane?.classList.contains('active')) return
  const nodes = nodeTargets(value('styleNodeTarget') as NodeTarget)
  const edges = edgeTargets(value('styleEdgeTarget') as EdgeTarget)
  const count = (n: number, what: string) => `${n} ${what}${n === 1 ? '' : 's'}`
  document.getElementById('styleNodeCount')!.textContent = count(
    nodes.length,
    'node'
  )
  document.getElementById('styleEdgeCount')!.textContent = count(
    edges.length,
    'edge'
  )
  for (const cell of pane.querySelectorAll<HTMLElement>(
    '#styleNodeProps [data-now]'
  ))
    paintNow(
      cell,
      summarise(nodes, (i) => nodeNow(cell.dataset.now!, i))
    )
  for (const cell of pane.querySelectorAll<HTMLElement>(
    '#styleEdgeProps [data-now]'
  ))
    paintNow(
      cell,
      summarise(edges, (i) => edgeNow(cell.dataset.now!, i))
    )
}

// slider read-outs
const FORMATS: Record<string, (v: number) => string> = {
  styleNodeAlpha: (v) => v.toFixed(2),
  styleNodeBorderWidth: (v) => v.toFixed(1),
  styleNodeSize: (v) => `${v.toFixed(1)}×`,
  styleNodeStretchW: (v) => `${v.toFixed(1)}×`,
  styleNodeStretchH: (v) => `${v.toFixed(1)}×`,
  styleNodeStretchD: (v) => `${v.toFixed(1)}×`,
  styleNodeLabelSize: (v) => `${v} px`,
  styleEdgeWidth: (v) => `${v.toFixed(2)}×`,
  styleEdgeOpacity: (v) => `${v.toFixed(2)}×`,
}
const showValue = (id: string) =>
  (document.getElementById(`${id}Value`)!.textContent = FORMATS[id](
    Number(value(id))
  ))

export function initStylePanel(): void {
  const pane = document.getElementById('panel-style')
  if (!pane) return
  pane.innerHTML = STYLE_HTML
  document
    .getElementById('styleShowNodes')
    ?.addEventListener('click', () => showStyleSection('nodes'))
  document
    .getElementById('styleShowEdges')
    ?.addEventListener('click', () => showStyleSection('edges'))
  bus.on('network:loaded', showTotals)
  bus.on('workspace:changed', showTotals)
  showTotals()
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

  const num = (id: string) => Number(value(id))
  const on = (id: string, run: () => void) =>
    document.getElementById(id)?.addEventListener('click', run)
  const node = (patch: Parameters<typeof styleNodes>[1], what: string) =>
    done(styleNodes(nodeTarget(), patch), what)

  for (const id of Object.keys(FORMATS))
    document.getElementById(id)?.addEventListener('input', () => showValue(id))
  // locked: the three axes move together
  const axes = ['W', 'H', 'D'].map((a) => `styleNodeStretch${a}`)
  for (const id of axes)
    document.getElementById(id)?.addEventListener('input', () => {
      if (
        !(document.getElementById('styleNodeStretchLock') as HTMLInputElement)
          .checked
      )
        return
      for (const other of axes) {
        ;(document.getElementById(other) as HTMLInputElement).value = value(id)
        showValue(other)
      }
    })

  on('styleNodeColorApply', () =>
    node({ color: value('styleNodeColor') }, 'Nodes recoloured')
  )
  on('styleNodeAlphaApply', () =>
    node({ alpha: num('styleNodeAlpha') }, 'Node opacity changed')
  )
  on('styleNodeAlphaReset', () => node({ alpha: 1 }, 'Nodes opaque again'))
  on('styleNodeBorderApply', () =>
    node(
      {
        border: {
          color: value('styleNodeBorderColor'),
          width: num('styleNodeBorderWidth'),
        },
      },
      'Node borders set'
    )
  )
  on('styleNodeBorderReset', () =>
    node({ border: { color: '#ffffff', width: 0 } }, 'Node borders removed')
  )
  on('styleNodeSizeApply', () =>
    node({ scale: num('styleNodeSize') }, 'Nodes resized')
  )
  on('styleNodeStretchApply', () =>
    node(
      {
        stretch: [
          num('styleNodeStretchW'),
          num('styleNodeStretchH'),
          num('styleNodeStretchD'),
        ],
      },
      'Nodes stretched'
    )
  )
  on('styleNodeStretchReset', () =>
    node({ stretch: [1, 1, 1] }, 'Node proportions reset')
  )
  on('styleNodeShapeApply', () =>
    node(
      { shape: value('styleNodeShape') as NodeGeometryType },
      'Node shapes changed'
    )
  )
  on('styleNodeLabelApply', () =>
    node({ label: value('styleNodeLabel').trim() }, 'Labels changed')
  )
  on('styleNodeLabelReset', () =>
    node({ label: '' }, 'Labels back to the node names')
  )
  on('styleNodeLabelColorApply', () =>
    node({ labelColor: value('styleNodeLabelColor') }, 'Label colour set')
  )
  on('styleNodeLabelColorReset', () =>
    node({ labelColor: '' }, 'Label colour follows the label style')
  )
  on('styleNodeLabelSizeApply', () =>
    node({ labelSize: num('styleNodeLabelSize') }, 'Label size set')
  )
  on('styleNodeLabelSizeReset', () =>
    node({ labelSize: 0 }, 'Label size follows the label style')
  )
  on('styleNodeDescrApply', () =>
    node({ descr: value('styleNodeDescr').trim() }, 'Descriptions set')
  )
  on('styleNodeDescrReset', () => node({ descr: '' }, 'Descriptions removed'))

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
  const edge = (patch: Parameters<typeof styleEdges>[1], what: string) =>
    done(styleEdges(edgeTarget(), patch), what)
  on('styleEdgeColorApply', () =>
    edge({ color: value('styleEdgeColor') }, 'Edges recoloured')
  )
  on('styleEdgeWidthApply', () =>
    edge({ widthFactor: num('styleEdgeWidth') }, 'Edge widths changed')
  )
  on('styleEdgeOpacityApply', () =>
    edge({ opacityFactor: num('styleEdgeOpacity') }, 'Edge opacity changed')
  )
  on('styleEdgeOpacityReset', () =>
    edge({ opacityFactor: 1 }, 'Edge opacity reset')
  )
  on('styleEdgeLineTypeApply', () =>
    edge(
      { lineType: value('styleEdgeLineType') as LineType },
      'Edge line type changed'
    )
  )
  on('styleEdgeArrowApply', () =>
    edge({ arrowColor: value('styleEdgeArrowColor') }, 'Arrow colour set')
  )
  on('styleEdgeArrowReset', () =>
    edge({ arrowColor: '' }, 'Arrows follow the edge colour')
  )

  // the Now column follows the targets, the selection and every change
  for (const id of ['styleNodeTarget', 'styleEdgeTarget'])
    document.getElementById(id)?.addEventListener('change', refreshNow)
  bus.on('selection:changed', refreshNow)
  bus.on('history:changed', refreshNow)
  bus.on('network:loaded', refreshNow)
  pane.addEventListener('pointerenter', refreshNow)
  document
    .querySelector('[data-bs-target="#panel-style"]')
    ?.addEventListener('shown.bs.tab', refreshNow)
  document
    .getElementById('styleChannelPalette')
    ?.addEventListener('click', () => {
      const n = colorChannelsByPalette(
        value('styleChannelCategorical') as CategoricalPalette
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
