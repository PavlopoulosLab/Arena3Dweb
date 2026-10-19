// Network mode switch in the top bar: Multilayered (layers as floors, every
// layer control) or Single network (one graph; layer-only controls step
// aside). Elements marked data-multilayer-only are hidden by style.css while
// <body> carries .mode-single; options that cannot be hidden are disabled here.

import { bus } from '../bus'
import { store } from '../store'
import { applyLayout } from '../actions/layout'
import { ctx } from '../three'
import type { NetworkMode } from '../three/runtime'
import { reconcileNetworkMode, setNetworkMode } from '../actions/modes'
import { finishLoader, startLoader } from '../actions/screen'
import { showTab } from './tabs'

function disableOption(selector: string, fallback: string, off: boolean): void {
  const option = document.querySelector<HTMLOptionElement>(selector)
  if (!option) return
  option.disabled = off
  const select = option.parentElement as HTMLSelectElement
  if (off && select.value === option.value) {
    select.value = fallback
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

function applyModeToUi(mode: NetworkMode): void {
  const single = mode === 'single'
  document.body.classList.toggle('mode-single', single)
  document.getElementById('modeMultilayer')?.classList.toggle('active', !single)
  document.getElementById('modeSingle')?.classList.toggle('active', single)
  disableOption('#groupSource option[value="layers"]', 'clusters', single)
  disableOption('#styleColorBy option[value="layer"]', 'cluster', single)
  const floors = document.getElementById(
    'showFloors'
  ) as HTMLInputElement | null
  if (floors) floors.checked = ctx.layers.some((l) => l.floorVisible)
  // an open layer-only panel gives way to the scene
  if (
    single &&
    document.querySelector('#panel-layer.active, #panel-layer-selection.active')
  )
    showTab('#panel-main-view')
}

export function initNetworkMode(): void {
  const buttons: [NetworkMode, HTMLButtonElement | null][] = [
    [
      'multilayer',
      document.getElementById('modeMultilayer') as HTMLButtonElement | null,
    ],
    [
      'single',
      document.getElementById('modeSingle') as HTMLButtonElement | null,
    ],
  ]
  for (const [mode, btn] of buttons)
    btn?.addEventListener('click', () => {
      if (ctx.networkMode === mode || ctx.layers.length === 0) return
      startLoader()
      setNetworkMode(mode)
        .catch((err: unknown) => console.error('[arena3d] network mode', err))
        .finally(finishLoader)
    })
  bus.on('mode:changed', ({ mode }) => applyModeToUi(mode))
  bus.on('network:loaded', ({ session }) => {
    for (const [, btn] of buttons)
      if (btn) btn.disabled = ctx.layers.length === 0
    reconcileNetworkMode()
    applyModeToUi(ctx.networkMode)
    // a one-layer network: the user says whether it is a flat layer on a
    // floor or one 3D network (sessions bring their own answer)
    showOneLayerPrompt(ctx.layers.length === 1 && !session)
  })
  initOneLayerPrompt()
  bus.on('history:changed', reconcileNetworkMode)
  applyModeToUi(ctx.networkMode)
}

// ---------------------------------------------------------------- one layer
const PROMPT_HTML = `
<div id="oneLayerPrompt" class="one-layer-prompt d-none" role="dialog" aria-label="One layer: how to show it">
  <div class="one-layer-prompt__text">This network has one layer. Show it as</div>
  <div class="d-flex flex-wrap gap-2">
    <button id="oneLayerSingle" type="button" class="btn btn-primary btn-sm">Single 3D network</button>
    <button id="oneLayerFloor" type="button" class="btn btn-outline-primary btn-sm">Single layer on a floor</button>
  </div>
  <div class="form-text mt-1">A 3D network is laid out in space with the NORMA-style group tools; a floor keeps the layer flat with the multilayer controls. The top-bar switch changes it any time.</div>
</div>`

function showOneLayerPrompt(show: boolean): void {
  document.getElementById('oneLayerPrompt')?.classList.toggle('d-none', !show)
}

export function dismissOneLayerPrompt(): void {
  showOneLayerPrompt(false)
}

// A one-layer network on a floor, with the multilayer controls.
export async function showOneLayerOnFloor(): Promise<void> {
  dismissOneLayerPrompt()
  await setNetworkMode('multilayer')
}

// The loaded network as one graph in space: several layers are stacked by the
// mode switch (with its 3D layout); a single layer gets a 3D layout of its own.
export async function showAsSingle3d(): Promise<void> {
  dismissOneLayerPrompt()
  const net = store.get().network
  if (!net || ctx.layers.length === 0) return
  if (ctx.layers.length > 1) return setNetworkMode('single')
  const box = document.getElementById(
    'layout3dCheckbox'
  ) as HTMLInputElement | null
  if (box && !box.checked) {
    box.checked = true
    box.dispatchEvent(new Event('change', { bubbles: true }))
  }
  if (ctx.networkMode !== 'single') await setNetworkMode('single')
  // one graph in space: a 3D layout of every node
  await applyLayout({
    nodes: net.nodes,
    edges: net.edges,
    algorithm: 'Fruchterman-Reingold',
    scope: 'allLayers',
    selected_layers: net.layers,
    selected_channels: store.get().selectedChannels,
    dimensions: 3,
  })
}

function initOneLayerPrompt(): void {
  if (document.getElementById('oneLayerPrompt')) return
  document.body.insertAdjacentHTML('beforeend', PROMPT_HTML)
  const run = (step: () => Promise<void>, what: string) => () => {
    startLoader()
    step()
      .catch((err: unknown) => console.error(`[arena3d] ${what}`, err))
      .finally(finishLoader)
  }
  document
    .getElementById('oneLayerFloor')
    ?.addEventListener('click', run(showOneLayerOnFloor, 'network mode'))
  document
    .getElementById('oneLayerSingle')
    ?.addEventListener('click', run(showAsSingle3d, 'one-layer 3D'))
}
