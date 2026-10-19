// Scene Actions panel — port of v2 views/scene.R plus the scene color picker
// v2 injected from on_page_load.js initializeColorPickers. The VR button is
// dropped (functions/vr.R deleted, PLAN Phase 7).

import { MathUtils } from 'three'
import { ctx } from '../three'
import { registerAnimateHook } from '../actions/screen'
import { history } from '../commands/base'
import {
  ChangeBackgroundColorCommand,
  PredefinedLayoutCommand,
} from '../commands/scene'
import { isBloomEnabled, setBloomEnabled } from '../three/postprocessing'
import { setMinimapVisible } from '../ui/minimap'
import { setLegendShown } from '../ui/legend'
import {
  PREDEFINED_LAYOUTS,
  applyPredefinedLayout,
  type PredefinedLayout,
} from '../actions/layout'

const SCENE_HTML = `
<div class="col-md-6 col-lg-4 layout-panel">
  <details class="lp-section lp-more" id="sceneCard_axes">
  <summary>Axes &amp; rotation</summary>
  <div class="form-check mb-2">
    <input class="form-check-input" type="checkbox" id="toggleSceneCoords" checked />
    <label class="form-check-label" for="toggleSceneCoords">Show Scene Coord System</label>
  </div>
  <label class="form-label small mb-0" for="sceneAxesOpacity">Scene axes opacity: <span id="sceneAxesOpacityValue">0.85</span></label>
  <input type="range" class="form-range mb-3" id="sceneAxesOpacity" min="0.1" max="1" step="0.05" value="0.85" aria-label="Scene axes opacity" />
  <div class="form-check mb-2">
    <input class="form-check-input" type="checkbox" id="autoRotateScene" />
    <label class="form-check-label" for="autoRotateScene">Enable Scene Auto Rotate</label>
  </div>
  <div class="form-check">
    <input class="form-check-input" type="checkbox" id="toggleBloom" />
    <label class="form-check-label" for="toggleBloom">Node Glow (dark backgrounds)</label>
  </div>
  </details>
  <details class="lp-section lp-more" id="sceneCard_overlays">
  <summary>Overlays</summary>
  <div class="form-check mb-3">
    <input class="form-check-input" type="checkbox" id="toggleMinimap" checked />
    <label class="form-check-label" for="toggleMinimap">Show Navigator (2D)</label>
  </div>
  <div class="form-check">
    <input class="form-check-input" type="checkbox" id="toggleLegend" checked />
    <label class="form-check-label" for="toggleLegend">Show Legend</label>
  </div>
  </details>
  <details class="lp-section lp-more" id="sceneCard_arrangement" data-multilayer-only>
  <summary>Layer arrangement</summary>
  <label class="form-label">Select Predefined Layout:</label>
  ${PREDEFINED_LAYOUTS.map(
    ([value, label]) => `
  <div class="form-check">
    <input class="form-check-input" type="radio" name="predefined_layout" id="predef_${value}" value="${value}" ${value === 'parallel' ? 'checked' : ''} />
    <label class="form-check-label" for="predef_${value}">${label}</label>
  </div>`
  ).join('')}
  </details>
  <details class="lp-section lp-more" id="sceneCard_background">
  <summary>Background</summary>
  <div id="sceneColorPicker" class="colorPicker">
    <input type="color" id="scene_color" name="scene_color" value="#000000" />
    <label for="scene_color">Background Color</label>
  </div>
  </details>
</div>
`

export function initScenePanel(): void {
  const pane = document.getElementById('panel-scene')
  if (!pane) return
  pane.innerHTML = SCENE_HTML

  document
    .getElementById('toggleSceneCoords')
    ?.addEventListener('change', (e) => {
      ctx.scene?.toggleCoords((e.target as HTMLInputElement).checked)
    })
  document
    .getElementById('sceneAxesOpacity')
    ?.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value)
      document.getElementById('sceneAxesOpacityValue')!.textContent =
        v.toFixed(2)
      ctx.scene?.setAxesOpacity(v)
    })

  // ponytail: v2 auto-rotate kept the canvas-button rotation interval alive;
  // those buttons aren't ported, so this is a steady Y spin in the render loop.
  document
    .getElementById('autoRotateScene')
    ?.addEventListener('change', (e) => {
      if (ctx.scene)
        ctx.scene.autoRotate = (e.target as HTMLInputElement).checked
    })
  registerAnimateHook(() => {
    if (ctx.scene?.autoRotate) ctx.scene.rotateY(MathUtils.degToRad(0.5))
  })

  const bloomToggle = document.getElementById(
    'toggleBloom'
  ) as HTMLInputElement | null
  if (bloomToggle) {
    bloomToggle.checked = isBloomEnabled()
    bloomToggle.addEventListener('change', (e) => {
      setBloomEnabled((e.target as HTMLInputElement).checked)
    })
  }
  document.getElementById('toggleLegend')?.addEventListener('change', (e) => {
    setLegendShown((e.target as HTMLInputElement).checked)
  })

  document.getElementById('toggleMinimap')?.addEventListener('change', (e) => {
    setMinimapVisible((e.target as HTMLInputElement).checked)
  })

  document.getElementById('scene_color')?.addEventListener('change', (e) => {
    history.execute(
      new ChangeBackgroundColorCommand((e.target as HTMLInputElement).value)
    )
  })

  // v2 observeEvent(input$predefined_layout, ignoreInit = T): applied on
  // change, not on the initially-selected value.
  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="predefined_layout"]'
  )) {
    radio.addEventListener('change', () => {
      history.execute(
        new PredefinedLayoutCommand(radio.value, () =>
          applyPredefinedLayout(radio.value as PredefinedLayout)
        )
      )
    })
  }
}
