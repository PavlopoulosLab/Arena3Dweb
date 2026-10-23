// Edge Actions panel — port of v2 views/edge.R plus the show/hide slider
// toggles from functions/edges.R (handleEdgeWidthByWeightCheckbox,
// handleEdgeDirectionCheckbox) and the channel color/visibility list from
// www/js/object_actions/edge.js attachChannelEditList.

import { ctx } from '../three'
import type { EdgeShape } from '../three/runtime'
import { bus } from '../bus'
import { history } from '../commands/base'
import { ChangeChannelColorCommand } from '../commands/scene'
import { store } from '../store'
import {
  toggleDirection,
  setArrowLayers,
  setInterLayerArrows,
  setIntraDirectionArrowSize,
  setInterDirectionArrowSize,
  setEdgeWeightEncoding,
  setIntraLayerEdgeOpacity,
  setInterLayerEdgeOpacity,
  setIntraLayerEdgeWidth,
  setInterLayerEdgeWidth,
  setIntraChannelCurvature,
  setInterChannelCurvature,
  setEdgeSelectedColorPriority,
  setEdgeFileColorPriority,
  setChannelVisibility,
  setEdgeShape,
} from '../actions/edge'
import { escapeHtml } from '../utils'
import { edgesBelowThreshold, setEdgeWeightThreshold } from '../actions/explore'
import {
  initBundling,
  resetBundles,
  setEdgeBundling,
} from '../actions/bundling'
import { FOLD_ALL_HTML } from './sections'

const EDGE_HTML = `
<div class="col-md-6 col-lg-4 layout-panel">
  ${FOLD_ALL_HTML}
  <details class="lp-section lp-more" id="edgeCard_weights">
  <summary>Weights</summary>
  <div>
    <label class="form-label" for="edgeWeightThreshold">Hide Edges with Weight Below: <span id="edgeWeightThresholdValue">0</span></label>
    <input type="range" class="form-range" id="edgeWeightThreshold" min="0" max="1" step="0.05" value="0" />
    <div class="form-text">Weights are scaled to 0.1–1 on upload; per channel for multi-channel edges.</div>
  </div>
  </details>
  <details class="lp-section lp-more" id="edgeCard_bundling">
  <summary>Bundling</summary>
  <div id="bundlingBox">
    <label class="form-label" for="intraBundling"><span data-multilayer-only>Intra-Layer </span>Edge Bundling: <span id="intraBundlingValue">0.00</span></label>
    <input type="range" class="form-range" id="intraBundling" min="0" max="1" step="0.05" value="0" />
    <div data-multilayer-only>
      <label class="form-label" for="interBundling">Inter-Layer Edge Bundling: <span id="interBundlingValue">0.00</span></label>
      <input type="range" class="form-range" id="interBundling" min="0" max="1" step="0.05" value="0" />
    </div>
    <div class="form-text">Similar edges merge into shared bundles (force-directed edge bundling), so busy networks read as flows. 0 = straight edges; strengths are saved in sessions.<span data-single-only> In Single network mode the whole graph is one space, so every edge bundles in one set, the former inter-layer edges included.</span></div>
    <div id="bundling_status" class="small text-secondary"></div>
  </div>
  </details>
  <details class="lp-section lp-more" id="edgeCard_direction">
  <summary>Direction</summary>
  <div class="form-check mb-2">
    <input class="form-check-input" type="checkbox" id="edgeDirectionToggle" />
    <label class="form-check-label" for="edgeDirectionToggle">Enable Edge Direction</label>
  </div>
  <div class="mb-3 d-none" id="intraDirectionArrowSizeWrap">
    <label class="form-label" for="intraDirectionArrowSize">Intra-Layer Direction Arrow Size:</label>
    <input type="range" class="form-range" id="intraDirectionArrowSize" min="1" max="10" step="1" value="5" />
  </div>
  <div class="mb-3 d-none" id="interDirectionArrowSizeWrap" data-multilayer-only>
    <label class="form-label" for="interDirectionArrowSize">Inter-Layer Direction Arrow Size:</label>
    <input type="range" class="form-range" id="interDirectionArrowSize" min="1" max="10" step="1" value="5" />
  </div>
  <div class="mb-2 d-none" id="arrowLayersWrap">
    <label class="form-label">Arrowheads in:</label>
    <div id="arrowLayersList" class="d-flex flex-wrap gap-2"></div>
    <div class="form-check" data-multilayer-only>
      <input class="form-check-input" type="checkbox" id="interLayerArrows" checked />
      <label class="form-check-label" for="interLayerArrows">Links between layers</label>
    </div>
    <div class="form-text">For a network that mixes directed and undirected layers, such as OmniPath signalling next to STRING interactions, untick the undirected ones.</div>
  </div>
  </details>
  <details class="lp-section lp-more" id="edgeCard_appearance">
  <summary>Appearance</summary>
  <label class="form-label">Show Edge Weight As:</label>
  <div class="mb-3">
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="edgeWeightEncodingRadio" id="edgeWeight_opacity" value="opacity" checked />
      <label class="form-check-label" for="edgeWeight_opacity">Opacity</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="edgeWeightEncodingRadio" id="edgeWeight_width" value="width" />
      <label class="form-check-label" for="edgeWeight_width">Width</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="edgeWeightEncodingRadio" id="edgeWeight_both" value="both" />
      <label class="form-check-label" for="edgeWeight_both">Both</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="edgeWeightEncodingRadio" id="edgeWeight_neither" value="neither" />
      <label class="form-check-label" for="edgeWeight_neither">Neither</label>
    </div>
  </div>
  <div class="mb-3 d-none" id="intraLayerEdgeOpacityWrap">
    <label class="form-label" for="intraLayerEdgeOpacity">Intra-Layer Edge Opacity:</label>
    <input type="range" class="form-range" id="intraLayerEdgeOpacity" min="0" max="1" step="0.1" value="1" />
  </div>
  <div class="mb-3 d-none" id="interLayerEdgeOpacityWrap" data-multilayer-only>
    <label class="form-label" for="interLayerEdgeOpacity">Inter-Layer Edge Opacity:</label>
    <input type="range" class="form-range" id="interLayerEdgeOpacity" min="0" max="1" step="0.1" value="0.4" />
  </div>
  <div class="mb-3" id="intraLayerEdgeWidthWrap">
    <label class="form-label" for="intraLayerEdgeWidth">Intra-Layer Edge Width:</label>
    <input type="range" class="form-range" id="intraLayerEdgeWidth" min="1" max="10" step="0.5" value="1" />
  </div>
  <div class="mb-3" id="interLayerEdgeWidthWrap" data-multilayer-only>
    <label class="form-label" for="interLayerEdgeWidth">Inter-Layer Edge Width:</label>
    <input type="range" class="form-range" id="interLayerEdgeWidth" min="1" max="10" step="0.5" value="1" />
  </div>
  <div class="mb-3 d-none" id="edgeShapeWrap">
    <label class="form-label" for="edgeShape">Edge Shape (channels):</label>
    <select id="edgeShape" class="form-select form-select-sm">
      <option value="parallel">Parallel — channels side by side, as STRING draws them</option>
      <option value="curved">Bézier curves — one curve per channel</option>
      <option value="straight">Straight — channels share one line</option>
    </select>
  </div>
  <div class="mb-3 d-none" id="intraChannelCurvatureWrap">
    <label class="form-label" for="intraChannelCurvature">Intra-Layer Channel Curvature:</label>
    <input type="range" class="form-range" id="intraChannelCurvature" min="10" max="60" step="1" value="15" />
  </div>
  <div class="mb-3 d-none" id="interChannelCurvatureWrap" data-multilayer-only>
    <label class="form-label" for="interChannelCurvature">Inter-Layer Channel Curvature:</label>
    <input type="range" class="form-range" id="interChannelCurvature" min="1" max="30" step="1" value="5" />
  </div>
  </details>
  <details class="lp-section lp-more" id="edgeCard_colours">
  <summary>Colours</summary>
  <div class="form-check mb-2">
    <input class="form-check-input" type="checkbox" id="edgeSelectedColorPriority" checked />
    <label class="form-check-label" for="edgeSelectedColorPriority">Highlight Selected Edges in Color</label>
  </div>
  <div class="form-check mb-3">
    <input class="form-check-input" type="checkbox" id="edgeFileColorPriority" />
    <label class="form-check-label" for="edgeFileColorPriority">Priority on Loaded Edge Color</label>
  </div>
  <div id="channelColorPicker" class="channelColorPicker"></div>
  </details>
</div>
`

// The Direction card as the scene has it: the toggle, the arrow sizes and
// the layers that draw arrowheads (one box per layer, ticked when it does).
function syncDirectionControls(): void {
  const on = ctx.isDirectionEnabled
  const toggle = document.getElementById(
    'edgeDirectionToggle'
  ) as HTMLInputElement | null
  if (toggle) toggle.checked = on
  show('intraDirectionArrowSizeWrap', on)
  show('interDirectionArrowSizeWrap', on)
  show('arrowLayersWrap', on)
  const list = document.getElementById('arrowLayersList')
  if (list)
    list.innerHTML = ctx.layers
      .map((l, i) => {
        const ticked =
          ctx.arrowLayers === null || ctx.arrowLayers.includes(l.name)
        return `<div class="form-check form-check-inline me-0">
          <input class="form-check-input" type="checkbox" id="arrowLayer_${i}" data-layer="${escapeHtml(l.name)}"${ticked ? ' checked' : ''} />
          <label class="form-check-label" for="arrowLayer_${i}">${escapeHtml(l.name)}</label>
        </div>`
      })
      .join('')
  const inter = document.getElementById(
    'interLayerArrows'
  ) as HTMLInputElement | null
  if (inter) inter.checked = ctx.interLayerArrows
}

function show(id: string, visible: boolean): void {
  document.getElementById(id)?.classList.toggle('d-none', !visible)
}

// The radio is only a view over ctx.edgeOpacityByWeight/edgeWidthByWeight,
// which are what the session JSON stores. One row per combination, so any
// imported pair maps back onto an option.
const ENCODING_FLAGS: Record<string, [boolean, boolean]> = {
  opacity: [true, false],
  width: [false, true],
  both: [true, true],
  neither: [false, false],
}

// Point the radio and the slider visibility at whatever ctx currently holds.
// Called on init and after every network/session load, since importing a
// session writes ctx directly (actions/network.ts) and never touches the DOM.
function syncEncodingSliders(): void {
  const value =
    Object.keys(ENCODING_FLAGS).find(
      (k) =>
        ENCODING_FLAGS[k][0] === ctx.edgeOpacityByWeight &&
        ENCODING_FLAGS[k][1] === ctx.edgeWidthByWeight
    ) ?? 'opacity'
  const radio = document.querySelector<HTMLInputElement>(
    `input[name="edgeWeightEncodingRadio"][value="${value}"]`
  )
  if (radio) radio.checked = true

  // A slider is only useful for the encoding weight isn't already driving.
  show('intraLayerEdgeOpacityWrap', !ctx.edgeOpacityByWeight)
  show('interLayerEdgeOpacityWrap', !ctx.edgeOpacityByWeight)
  show('intraLayerEdgeWidthWrap', !ctx.edgeWidthByWeight)
  show('interLayerEdgeWidthWrap', !ctx.edgeWidthByWeight)
}

// Curvature only ever reaches Edge.createChannels, which is skipped entirely
// for single-edge networks — so on those the sliders move nothing. The help
// text already described them as multi-edge only; this makes that true.
function syncChannelControls(): void {
  const multiEdge = (store.get().network?.channels ?? []).length > 0
  const shape = ctx.edgeShape
  const select = document.getElementById('edgeShape') as HTMLSelectElement
  if (select) select.value = shape
  show('edgeShapeWrap', multiEdge)
  // only Bézier curves have a curvature to set
  show('intraChannelCurvatureWrap', multiEdge && shape === 'curved')
  show('interChannelCurvatureWrap', multiEdge && shape === 'curved')
}

// v2 attachChannelEditList: per channel a color picker + a Hide checkbox.
// XSS fix: `ch` is a user-controlled channel name (TSV Channel column) —
// escapeHtml() it before interpolating into innerHTML, including inside the
// id/value attributes below.
function buildChannelEditList(): void {
  const container = document.getElementById('channelColorPicker')
  if (!container) return
  container.innerHTML = ''
  const channels = store.get().network?.channels ?? []
  if (channels.length === 0) return

  const title = document.createElement('h6')
  title.textContent = 'Channels'
  container.appendChild(title)
  // names, swatches and Hide switches in aligned columns (style.css)
  const grid = document.createElement('div')
  grid.className = 'channel-grid'
  container.appendChild(grid)

  for (const ch of channels) {
    const row = document.createElement('div')
    row.className = 'channel_subcontainer'
    // the picker keeps its id: the STRING card recolours it by name
    row.innerHTML = `
      <span class="channelLabel" title="${escapeHtml(ch)}">${escapeHtml(ch)}</span>
      <input type="color" class="channel_colorPicker" id="color${escapeHtml(ch)}" value="${escapeHtml(ctx.channelColors[ch] ?? '#cfcfcf')}" aria-label="Colour of channel ${escapeHtml(ch)}" />
      <label class="channelCheckboxLabel"><input class="form-check-input channel_checkbox" type="checkbox" />Hide</label>
    `
    const picker = row.querySelector<HTMLInputElement>('.channel_colorPicker')!
    const hide = row.querySelector<HTMLInputElement>('.channel_checkbox')!
    picker.addEventListener('change', () =>
      history.execute(new ChangeChannelColorCommand(ch, picker.value))
    )
    hide.addEventListener('change', () =>
      setChannelVisibility(ch, !hide.checked)
    )
    grid.appendChild(row)
  }
}

export function initEdgePanel(): void {
  const pane = document.getElementById('panel-edge')
  if (!pane) return
  pane.innerHTML = EDGE_HTML

  const threshold = document.getElementById(
    'edgeWeightThreshold'
  ) as HTMLInputElement
  threshold.addEventListener('input', () => {
    const t = Number(threshold.value)
    setEdgeWeightThreshold(t)
    document.getElementById('edgeWeightThresholdValue')!.textContent =
      `${t.toFixed(2)} (${edgesBelowThreshold()} hidden)`
  })

  const range = (id: string, fn: (v: number) => void) =>
    document.getElementById(id)?.addEventListener('input', (e) => {
      fn(Number((e.target as HTMLInputElement).value))
    })

  // Direction toggle shows/hides the arrow-size sliders (edges.R) and the
  // choice of where arrowheads go.
  document
    .getElementById('edgeDirectionToggle')
    ?.addEventListener('change', (e) => {
      toggleDirection((e.target as HTMLInputElement).checked)
      syncDirectionControls()
    })
  document.getElementById('arrowLayersList')?.addEventListener('change', () => {
    const boxes = [
      ...document.querySelectorAll<HTMLInputElement>('#arrowLayersList input'),
    ]
    // every layer ticked is the default, saved as "all" so new layers have arrows too
    setArrowLayers(
      boxes.every((b) => b.checked)
        ? null
        : boxes.filter((b) => b.checked).map((b) => b.dataset.layer ?? '')
    )
  })
  document
    .getElementById('interLayerArrows')
    ?.addEventListener('change', (e) => {
      setInterLayerArrows((e.target as HTMLInputElement).checked)
    })
  range('intraDirectionArrowSize', setIntraDirectionArrowSize)
  range('interDirectionArrowSize', setInterDirectionArrowSize)

  // Each encoding driven by weight hides its own manual sliders (edges.R did
  // this for opacity; width follows the same rule).
  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="edgeWeightEncodingRadio"]'
  )) {
    radio.addEventListener('change', () => {
      const [byOpacity, byWidth] = ENCODING_FLAGS[radio.value]
      setEdgeWeightEncoding(byOpacity, byWidth)
      syncEncodingSliders()
    })
  }
  range('intraLayerEdgeOpacity', setIntraLayerEdgeOpacity)
  range('interLayerEdgeOpacity', setInterLayerEdgeOpacity)
  range('intraLayerEdgeWidth', setIntraLayerEdgeWidth)
  range('interLayerEdgeWidth', setInterLayerEdgeWidth)

  range('intraChannelCurvature', setIntraChannelCurvature)
  range('interChannelCurvature', setInterChannelCurvature)

  document
    .getElementById('edgeSelectedColorPriority')
    ?.addEventListener('change', (e) => {
      setEdgeSelectedColorPriority((e.target as HTMLInputElement).checked)
    })
  document
    .getElementById('edgeFileColorPriority')
    ?.addEventListener('change', (e) => {
      setEdgeFileColorPriority((e.target as HTMLInputElement).checked)
    })

  document.getElementById('edgeShape')?.addEventListener('change', (e) => {
    setEdgeShape((e.target as HTMLSelectElement).value as EdgeShape)
    syncChannelControls()
  })

  syncEncodingSliders()
  syncChannelControls()
  initBundlingControls()
  bus.on('network:loaded', () => {
    syncDirectionControls() // a session may carry direction and arrowheads
    buildChannelEditList()
    syncEncodingSliders() // an imported session may carry either flag
    syncChannelControls() // and may or may not be multi-edge
    resetBundles() // a session may carry bundling strengths
    syncBundlingSliders()
  })
}

// Edge bundling sliders (actions/bundling.ts): dragging shows the value,
// letting go applies it as one undo step.
const BUNDLING = [
  ['intraBundling', 'intra'],
  ['interBundling', 'inter'],
] as const

function syncBundlingSliders(): void {
  for (const [id, kind] of BUNDLING) {
    const v = kind === 'intra' ? ctx.intraEdgeBundling : ctx.interEdgeBundling
    const input = document.getElementById(id) as HTMLInputElement | null
    if (!input) continue
    input.value = String(v)
    document.getElementById(`${id}Value`)!.textContent = v.toFixed(2)
  }
}

function initBundlingControls(): void {
  initBundling()
  const msg = document.getElementById('bundling_status')!
  for (const [id, kind] of BUNDLING) {
    const input = document.getElementById(id) as HTMLInputElement
    input.addEventListener('input', () => {
      document.getElementById(`${id}Value`)!.textContent = Number(
        input.value
      ).toFixed(2)
    })
    input.addEventListener('change', () => {
      if (ctx.edgeObjects.length === 0) {
        msg.textContent = 'Load a network first.'
        input.value = '0'
        return
      }
      msg.textContent = 'Bundling edges…'
      // let the message paint before the (synchronous) bundling runs
      setTimeout(() => {
        setEdgeBundling(kind, Number(input.value))
        msg.textContent = ''
      }, 30)
    })
  }
  // undo/redo of a bundling step moves the sliders back
  bus.on('history:changed', syncBundlingSliders)
}
