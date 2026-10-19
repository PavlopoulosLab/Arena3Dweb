// Layer Actions panel — port of v2 views/layer.R plus the floor color picker
// v2 injected from on_page_load.js initializeColorPickers.

import { LAYER_DEFAULT_COLOR } from '../three/constants'
import type { FloorStyle } from '../three/Layer'
import { getSelectedLayers } from '../actions/layer'
import { showLayerLabels, resizeLayerLabels } from '../actions/labels'
import {
  showLayerCoords,
  setLayerAxesOpacity,
  setFloorOpacity,
  setLayerColorPriority,
  showFloors,
} from '../actions/layer'
import { bus } from '../bus'
import { setLayerContainer } from '../actions/modes'
import { VOLUME_CONTAINERS, type LayerContainer } from '../three/Layer'
import { store } from '../store'
import type { NetworkData } from '../api/client'
import { loadNetwork } from '../actions/network'
import { fitToContainers, liftNodesByDegree } from '../actions/layout'
import {
  RestructureError,
  mergeLayers,
  splitLayerByCluster,
} from '../actions/restructure'
import { ctx } from '../three'
import { history } from '../commands/base'
import {
  ChangeFloorColorCommand,
  ChangeFloorShapeCommand,
  ChangeFloorStyleCommand,
  ChangeContainerStyleCommand,
  ApplyLayoutCommand,
} from '../commands/scene'
import { FOLD_ALL_HTML } from './sections'

const LAYER_HTML = `
<div class="col-md-6 col-lg-4 layout-panel">
  ${FOLD_ALL_HTML}
  <details class="lp-section lp-more" id="layerCard_labels" open>
  <summary>Labels &amp; axes</summary>
  <label class="form-label">Show Labels:</label>
  <div class="mb-3">
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="showLayerLabelsRadio" id="layerLabels_all" value="all" checked />
      <label class="form-check-label" for="layerLabels_all">All</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="showLayerLabelsRadio" id="layerLabels_selected" value="selected" />
      <label class="form-check-label" for="layerLabels_selected">Selected</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="showLayerLabelsRadio" id="layerLabels_none" value="none" />
      <label class="form-check-label" for="layerLabels_none">None</label>
    </div>
  </div>
  <div class="form-check mb-2">
    <input class="form-check-input" type="checkbox" id="showLayerCoords" />
    <label class="form-check-label" for="showLayerCoords">Show Layer Coord Systems</label>
  </div>
  <label class="form-label small mb-0" for="layerAxesOpacity">Layer axes opacity: <span id="layerAxesOpacityValue">0.85</span></label>
  <input type="range" class="form-range mb-3" id="layerAxesOpacity" min="0.1" max="1" step="0.05" value="0.85" aria-label="Layer axes opacity" />
  <div>
    <label class="form-label" for="resizeLayerLabels">Resize Labels:</label>
    <input type="range" class="form-range" id="resizeLayerLabels" min="12" max="30" step="1" value="20" />
  </div>
  </details>
  <details class="lp-section lp-more" id="layerCard_shape" open>
  <summary>Shape &amp; container</summary>
  <label class="form-label" for="layerContainer">Layer Shape (selected layers, or all):</label>
  <div class="d-flex gap-2 mb-1">
    <select id="layerContainer" class="form-select form-select-sm" style="width:auto">
      <option value="floor">Floor (2D)</option>
      <option value="cube">Cube (3D)</option>
      <option value="sphere">Sphere (3D)</option>
      <option value="cloud">Fog cloud (3D)</option>
      <option value="none">None</option>
    </select>
    <button id="applyLayerContainer" class="btn btn-outline-primary btn-sm">Apply</button>
  </div>
  <div class="form-text mb-2">3D shapes lay their nodes out in 3D inside the volume; use Layouts with "3D Layout" for other algorithms.</div>
  <div id="containerStyle">
    <label class="form-label small mb-1">3D Container Look (selected layers, or all):</label>
    <div class="d-flex align-items-center gap-2 flex-wrap">
      <input type="color" id="containerColor" class="form-control form-control-color form-control-sm" value="#5b8def" title="Container colour" aria-label="Container colour" />
      <div class="form-check mb-0">
        <input class="form-check-input" type="checkbox" id="containerFollowFloor" checked />
        <label class="form-check-label small" for="containerFollowFloor">Theme default (contrasts with the background)</label>
      </div>
    </div>
    <label class="form-label small mt-2 mb-0" for="containerOpacity">Opacity: <span id="containerOpacityValue">0.30</span></label>
    <input type="range" class="form-range" id="containerOpacity" min="0" max="1" step="0.05" value="0.3" />
    <button id="applyContainerStyle" class="btn btn-outline-primary btn-sm">Apply Look</button>
  </div>
  </details>
  <details class="lp-section lp-more" id="layerCard_floor" open>
  <summary>Floor</summary>
  <label class="form-label">Floor Shape (selected layers, or all):</label>
  <div class="mb-2">
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="floorShape" id="floorShape_square" value="square" checked />
      <label class="form-check-label" for="floorShape_square">Square</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="floorShape" id="floorShape_disk" value="disk" />
      <label class="form-check-label" for="floorShape_disk">Disk</label>
    </div>
  </div>
  <div class="form-check mb-2">
    <input class="form-check-input" type="checkbox" id="showFloors" checked />
    <label class="form-check-label" for="showFloors">Show Layer Floors</label>
  </div>
  <label class="form-label" for="floorStyle">Floor Style (selected layers, or all):</label>
  <select id="floorStyle" class="form-select form-select-sm mb-3" style="width:auto">
    <option value="solid">Solid</option>
    <option value="wireframe">Wireframe</option>
    <option value="grid">Grid</option>
    <option value="dots">Dotted grid</option>
    <option value="outline">Outline only</option>
  </select>
  <div>
    <label class="form-label" for="layerOpacity">Floor Opacity:</label>
    <input type="range" class="form-range" id="layerOpacity" min="0" max="1" step="0.05" value="0.6" />
  </div>
  </details>
  <details class="lp-section lp-more" id="layerCard_colours">
  <summary>Colours</summary>
  <label class="form-label">Color Priority:</label>
  <div class="mb-3">
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="layerColorPriorityRadio" id="layerPriority_default" value="default" checked />
      <label class="form-check-label" for="layerPriority_default">Default / Imported</label>
    </div>
    <div class="form-check form-check-inline">
      <input class="form-check-input" type="radio" name="layerColorPriorityRadio" id="layerPriority_picker" value="picker" />
      <label class="form-check-label" for="layerPriority_picker">Theme / Colorpicker</label>
    </div>
  </div>
  <div id="floorColorPicker" class="colorPicker">
    <input type="color" id="floor_color" name="floor_color" value="${LAYER_DEFAULT_COLOR}" />
    <label for="floor_color">Floor Color</label>
  </div>
  </details>
  <details class="lp-section lp-more" id="layerCard_restructure">
  <summary>Restructure</summary>
  <label class="form-label">Restructure Layers:</label>
  <div class="d-flex flex-wrap gap-2 mb-2">
    <button id="splitLayerByCluster" class="btn btn-outline-primary btn-sm" title="Each cluster of the selected layer becomes its own layer (run a clustered layout first)">Split Selected Layer by Cluster</button>
    <button id="mergeSelectedLayers" class="btn btn-outline-primary btn-sm" title="Flatten the selected layers into one">Merge Selected Layers</button>
  </div>
  <div class="d-flex align-items-center gap-2 mb-2">
    <button id="liftNodesByDegree" class="btn btn-outline-primary btn-sm">Lift Nodes by Degree</button>
    <input id="liftHeight" class="form-control form-control-sm" style="width:5.5rem" type="number" min="10" max="1000" step="10" value="150" aria-label="Maximum lift height" />
  </div>
  </details>
  <div id="layer_status" class="small"></div>
</div>
`

export function initLayerPanel(): void {
  const pane = document.getElementById('panel-layer')
  if (!pane) return
  pane.innerHTML = LAYER_HTML

  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="showLayerLabelsRadio"]'
  )) {
    radio.addEventListener('change', () => {
      showLayerLabels(radio.value as 'all' | 'selected' | 'none')
    })
  }

  document
    .getElementById('showLayerCoords')
    ?.addEventListener('change', (e) => {
      showLayerCoords((e.target as HTMLInputElement).checked)
    })
  document
    .getElementById('layerAxesOpacity')
    ?.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value)
      document.getElementById('layerAxesOpacityValue')!.textContent =
        v.toFixed(2)
      setLayerAxesOpacity(v)
    })
  initRestructure()

  document
    .getElementById('containerOpacity')
    ?.addEventListener('input', (e) => {
      document.getElementById('containerOpacityValue')!.textContent = Number(
        (e.target as HTMLInputElement).value
      ).toFixed(2)
    })
  document
    .getElementById('applyContainerStyle')
    ?.addEventListener('click', () => {
      const selected = ctx.layers.filter((l) => l.isSelected).map((l) => l.id)
      const ids = selected.length ? selected : ctx.layers.map((l) => l.id)
      if (ids.length === 0) return layerStatus('Load a network first.', true)
      const follow = (
        document.getElementById('containerFollowFloor') as HTMLInputElement
      ).checked
      const color = (
        document.getElementById('containerColor') as HTMLInputElement
      ).value
      const opacity = Number(
        (document.getElementById('containerOpacity') as HTMLInputElement).value
      )
      history.execute(
        new ChangeContainerStyleCommand(ids, follow ? null : color, opacity)
      )
      layerStatus(
        ids.some(
          (i) =>
            ctx.layers[i].container !== 'floor' &&
            ctx.layers[i].container !== 'none'
        )
          ? 'Container look applied.'
          : 'Container look saved; it shows once the layers are cubes, spheres or fog clouds.'
      )
    })
  document
    .getElementById('applyLayerContainer')
    ?.addEventListener('click', () => {
      const kind = (
        document.getElementById('layerContainer') as HTMLSelectElement
      ).value as LayerContainer
      const selected = ctx.layers.filter((l) => l.isSelected).map((l) => l.id)
      const ids = selected.length ? selected : ctx.layers.map((l) => l.id)
      if (ids.length === 0) return layerStatus('Load a network first.', true)
      const endsHive = !!ctx.hive && VOLUME_CONTAINERS.includes(kind)
      setLayerContainer(ids, kind)
        .then((laidOut) =>
          layerStatus(
            (endsHive ? 'Hive plot ended (its layers are axes). ' : '') +
              (laidOut
                ? `Layers set to ${kind}; nodes laid out in 3D inside.`
                : `Layers set to ${kind}.`)
          )
        )
        .catch((err: unknown) =>
          layerStatus(err instanceof Error ? err.message : String(err), true)
        )
    })

  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="floorShape"]'
  ))
    radio.addEventListener('change', () => {
      const selected = ctx.layers.filter((l) => l.isSelected).map((l) => l.id)
      const ids = selected.length ? selected : ctx.layers.map((l) => l.id)
      history.execute(
        new ChangeFloorShapeCommand(ids, radio.value as 'square' | 'disk')
      )
      if (radio.value === 'disk') {
        // pull nodes that now hang over the rim back onto the disk
        const current = Object.fromEntries(
          ctx.nodeObjects.map((n, i) => [
            ctx.nodeLayerNames[i],
            [n.getPosition('y'), n.getPosition('z'), n.getPosition('x')] as [
              number,
              number,
              number,
            ],
          ])
        )
        const fitted = fitToContainers(current)
        if (Object.keys(fitted).some((k) => fitted[k][0] !== current[k][0]))
          history.execute(new ApplyLayoutCommand(fitted))
      }
    })

  const floors = document.getElementById('showFloors') as HTMLInputElement
  floors.addEventListener('change', () => showFloors(floors.checked))
  // single-layer networks load without a floor — keep the checkbox truthful
  bus.on('network:loaded', () => {
    floors.checked = ctx.layers.some((l) => l.floorVisible)
  })
  document.getElementById('floorStyle')?.addEventListener('change', (e) => {
    const style = (e.target as HTMLSelectElement).value as FloorStyle
    const selected = getSelectedLayers()
    const ids = selected.length ? selected : ctx.layers.map((_, i) => i)
    if (ids.length === 0) return layerStatus('Load a network first.', true)
    history.execute(new ChangeFloorStyleCommand(ids, style))
    layerStatus(`Floor style: ${style}.`)
  })
  document
    .getElementById('resizeLayerLabels')
    ?.addEventListener('input', (e) => {
      resizeLayerLabels(Number((e.target as HTMLInputElement).value))
    })
  document.getElementById('layerOpacity')?.addEventListener('input', (e) => {
    setFloorOpacity(Number((e.target as HTMLInputElement).value))
  })

  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="layerColorPriorityRadio"]'
  )) {
    radio.addEventListener('change', () => {
      setLayerColorPriority(radio.value as 'default' | 'picker')
    })
  }

  // v2 repaintLayersFromPicker: picking a color switches priority to picker.
  document.getElementById('floor_color')?.addEventListener('change', (e) => {
    history.execute(
      new ChangeFloorColorCommand((e.target as HTMLInputElement).value)
    )
  })
}

function layerStatus(msg: string, isError = false): void {
  const el = document.getElementById('layer_status')
  if (!el) return
  el.textContent = msg
  el.className = `small mb-3 ${isError ? 'text-danger' : 'text-success'}`
}

// Split / merge reload the network (one undo step); lift is a layout command.
function initRestructure(): void {
  const maxLayers = () => store.get().config?.max_layers ?? 20
  const reload = (build: (net: NetworkData) => NetworkData, done: string) => {
    const net = store.get().network
    if (!net) return layerStatus('Load a network first.', true)
    try {
      loadNetwork(build(net))
      layerStatus(done)
    } catch (err) {
      if (!(err instanceof RestructureError)) throw err
      layerStatus(err.message, true)
    }
  }

  document
    .getElementById('splitLayerByCluster')
    ?.addEventListener('click', () => {
      const selected = store.get().selectedLayers
      if (selected.length !== 1)
        return layerStatus('Select exactly one layer to split.', true)
      const clusterOf = Object.fromEntries(
        ctx.nodeObjects.map((n, i) => [ctx.nodeLayerNames[i], n.getCluster()])
      )
      reload(
        (net) => splitLayerByCluster(net, selected[0], clusterOf, maxLayers()),
        `Split ${selected[0]} into one layer per cluster.`
      )
    })

  document
    .getElementById('mergeSelectedLayers')
    ?.addEventListener('click', () => {
      const selected = store.get().selectedLayers
      const into = selected.join('+')
      reload(
        (net) => mergeLayers(net, selected, into, maxLayers()),
        `Merged ${selected.length} layers into ${into}.`
      )
    })

  document
    .getElementById('liftNodesByDegree')
    ?.addEventListener('click', () => {
      if (ctx.nodeObjects.length === 0)
        return layerStatus('Load a network first.', true)
      const h = Number(
        (document.getElementById('liftHeight') as HTMLInputElement).value
      )
      liftNodesByDegree(
        Number.isFinite(h) ? Math.min(1000, Math.max(10, h)) : 150
      )
      layerStatus('Nodes lifted by degree. Run any 2D layout to flatten them.')
    })
}
