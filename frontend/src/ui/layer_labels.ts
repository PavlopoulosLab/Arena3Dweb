// Edit → Layers → Labels & axes → Label style: the look of the layer labels
// (halo — the default —, plain, box or shadow), their font, bold and italic,
// their colour (the theme's, one colour, each layer's own, or a palette) and
// where they sit (the floor's corner, above or under the floor), for all
// layers or the selected ones. One undo step per Apply or Reset.

import { getSelectedLayers } from '../actions/layer'
import {
  LABEL_PALETTE_LABELS,
  layerLabelColors,
  styleLayerLabels,
  type LabelPalette,
  type LayerLabelColorBy,
} from '../actions/style'
import { LABEL_LOOK_LABELS, type LabelLookStyle } from '../three/Node'
import {
  LAYER_LABEL_FONTS,
  LAYER_LABEL_POSITIONS,
  type LayerLabelFont,
  type LayerLabelPosition,
} from '../three/Layer'
import { ctx } from '../three'

const opts = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([v, l]) => `<option value="${v}">${l}</option>`)
    .join('')

export const LAYER_LABELS_HTML = `
  <h6 class="layer-label-style__title">Label style</h6>
  <div class="layer-label-style">
    <label class="form-label small m-0" for="layerLabelLook">Style</label>
    <div class="layer-label-style__value">
      <select id="layerLabelLook" class="form-select form-select-sm">${opts(LABEL_LOOK_LABELS)}</select>
      <span data-layer-look="halo box shadow" class="layer-label-style__look"><input type="color" id="layerLabelLookColor" value="#000000" title="Halo, box or shadow colour" aria-label="Halo, box or shadow colour" /><label class="layer-label-style__check small" title="White around dark text, dark around light text"><input class="form-check-input" type="checkbox" id="layerLabelLookAuto" checked />Auto</label></span>
      <span data-layer-look="halo" class="layer-label-style__look"><input type="range" id="layerLabelHalo" min="0.5" max="6" step="0.5" value="2" aria-label="Halo width" /><span id="layerLabelHaloValue" class="small">2.0 px</span></span>
      <span data-layer-look="box" class="layer-label-style__look"><input type="range" id="layerLabelBox" min="0.1" max="1" step="0.05" value="0.75" aria-label="Box opacity" /><span id="layerLabelBoxValue" class="small">0.75</span></span>
    </div>
    <label class="form-label small m-0" for="layerLabelFont">Font</label>
    <div class="layer-label-style__value">
      <select id="layerLabelFont" class="form-select form-select-sm">${opts({ '': 'As the app', ...LAYER_LABEL_FONTS })}</select>
      <label class="layer-label-style__check small"><input class="form-check-input" type="checkbox" id="layerLabelBold" />Bold</label>
      <label class="layer-label-style__check small"><input class="form-check-input" type="checkbox" id="layerLabelItalic" />Italic</label>
    </div>
    <label class="form-label small m-0" for="layerLabelColorBy">Colour</label>
    <div class="layer-label-style__value">
      <select id="layerLabelColorBy" class="form-select form-select-sm">${opts({ theme: "The theme's", one: 'One colour', layer: 'Match layer colour', palette: 'Palette' })}</select>
      <input type="color" id="layerLabelColor" value="#ffd43b" class="d-none" aria-label="Layer label colour" />
      <select id="layerLabelPalette" class="form-select form-select-sm d-none" aria-label="Layer label palette">${opts(LABEL_PALETTE_LABELS)}</select>
    </div>
    <label class="form-label small m-0" for="layerLabelPosition">Position</label>
    <div class="layer-label-style__value">
      <select id="layerLabelPosition" class="form-select form-select-sm">${opts(LAYER_LABEL_POSITIONS)}</select>
    </div>
  </div>
  <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
    <div class="form-check form-check-inline m-0">
      <input class="form-check-input" type="radio" name="layerLabelTarget" id="layerLabelTarget_all" value="all" checked />
      <label class="form-check-label" for="layerLabelTarget_all">All layers</label>
    </div>
    <div class="form-check form-check-inline m-0">
      <input class="form-check-input" type="radio" name="layerLabelTarget" id="layerLabelTarget_selected" value="selected" />
      <label class="form-check-label" for="layerLabelTarget_selected">Selected layers</label>
    </div>
  </div>
  <div class="d-flex flex-wrap gap-2 mb-1">
    <button type="button" id="applyLayerLabelStyle" class="btn btn-outline-primary btn-sm">Apply Label Style</button>
    <button type="button" id="resetLayerLabelStyle" class="btn btn-outline-secondary btn-sm" title="Back to the default: a halo at the floor's corner, in the theme's colour">Reset</button>
  </div>
  <div id="layerLabelStatus" class="small mb-2" aria-live="polite"></div>`

const input = (id: string) => document.getElementById(id) as HTMLInputElement
const value = (id: string) => input(id).value

function status(msg: string, isError = false): void {
  const el = document.getElementById('layerLabelStatus')
  if (!el) return
  el.textContent = msg
  el.className = `small mb-2 ${isError ? 'text-danger' : 'text-success'}`
}

// all layers, or the ones ticked in Layer selection
function targets(): number[] | null {
  if (input('layerLabelTarget_all').checked) return ctx.layers.map((_, i) => i)
  const sel = getSelectedLayers()
  return sel.length ? sel : null
}

export function initLayerLabelStyle(): void {
  const look = document.getElementById('layerLabelLook') as HTMLSelectElement
  if (!look) return
  look.value = 'halo'
  const showLook = () => {
    for (const el of document.querySelectorAll<HTMLElement>(
      '[data-layer-look]'
    ))
      el.hidden = !el.dataset.layerLook!.split(' ').includes(look.value)
  }
  look.addEventListener('change', showLook)
  showLook()
  input('layerLabelLookColor').addEventListener(
    'input',
    () => (input('layerLabelLookAuto').checked = false)
  )
  input('layerLabelHalo').addEventListener('input', () => {
    document.getElementById('layerLabelHaloValue')!.textContent =
      `${Number(value('layerLabelHalo')).toFixed(1)} px`
  })
  input('layerLabelBox').addEventListener('input', () => {
    document.getElementById('layerLabelBoxValue')!.textContent = Number(
      value('layerLabelBox')
    ).toFixed(2)
  })
  const colorBy = document.getElementById(
    'layerLabelColorBy'
  ) as HTMLSelectElement
  colorBy.addEventListener('change', () => {
    input('layerLabelColor').classList.toggle('d-none', colorBy.value !== 'one')
    document
      .getElementById('layerLabelPalette')!
      .classList.toggle('d-none', colorBy.value !== 'palette')
  })

  const plural = (n: number) => `${n} layer${n === 1 ? '' : 's'}`
  document
    .getElementById('applyLayerLabelStyle')
    ?.addEventListener('click', () => {
      const ids = targets()
      if (!ids)
        return status(
          'Select layers first (Layer selection), or pick All layers.',
          true
        )
      if (ids.length === 0) return status('Load a network first.', true)
      const bold = input('layerLabelBold').checked
      const colors = layerLabelColors(
        ids,
        colorBy.value as LayerLabelColorBy,
        value('layerLabelColor'),
        value('layerLabelPalette') as LabelPalette
      )
      styleLayerLabels(ids, (i) => ({
        look: {
          style: look.value as LabelLookStyle,
          color: input('layerLabelLookAuto').checked
            ? ''
            : value('layerLabelLookColor'),
          width: Number(value('layerLabelHalo')),
          opacity: Number(value('layerLabelBox')),
          bold,
        },
        font: value('layerLabelFont') as LayerLabelFont | '',
        bold,
        italic: input('layerLabelItalic').checked,
        color: colors.get(i)!,
        position: value('layerLabelPosition') as LayerLabelPosition,
      }))
      status(`Label style applied to ${plural(ids.length)}.`)
    })
  document
    .getElementById('resetLayerLabelStyle')
    ?.addEventListener('click', () => {
      const ids = targets()
      if (!ids?.length)
        return status(
          'Select layers first (Layer selection), or pick All layers.',
          true
        )
      styleLayerLabels(
        ids,
        () => ({
          look: null,
          font: '',
          bold: false,
          italic: false,
          color: '',
          position: 'corner',
        }),
        'Reset layer labels'
      )
      status(`Labels of ${plural(ids.length)} back to the default.`)
    })
}
