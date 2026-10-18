// Port of v2 www/js/object_actions/canvas_controls.js nav-control remainder:
// the two fixed buttons (#navControlButtonsDiv) and the Scene/Layers/Nodes
// control table inside #info. Every button takes one step as soon as it is
// pressed, so a click always does something; held down, it keeps going (one
// step every 70 ms after a short pause) until it is released, wherever that
// happens. Shiny syncs are replaced by render/label flags.

import * as THREE from 'three'
import { bus } from '../bus'
import { ctx } from '../three'
import { redrawIntraLayerEdges, toggleInterLayerEdgesRendering } from './edge'
import { getSelectedLayers, initialSpreadLayers } from './layer'
import { getSelectedNodes } from './node'
import { fitView } from './search'
import {
  getSelectCombine,
  getSelectShape,
  resetZoomTarget,
  setSelectCombine,
  setSelectShape,
  type SelectCombine,
  type SelectShape,
} from './canvas_controls'
import { history } from '../commands/base'
import { GROUP_ICONS, axisIcon } from '../ui/nav_icons'
import {
  captureTransforms,
  TransformCommand,
  type TransformSnapshot,
} from '../commands/scene'

type Axis = 'X' | 'Y' | 'Z'

const REPEAT_MS = 70
// a click is one step; held longer than this, the button keeps going
const HOLD_DELAY_MS = 300

let repeatId: ReturnType<typeof setInterval> | undefined
let holdId: ReturnType<typeof setTimeout> | undefined
// One undo entry per press: snapshot on press, command pushed on release.
let repeatBefore: TransformSnapshot | null = null
let repeatDescription = ''
let repeatMoved = false

function stopRepeat(): void {
  clearTimeout(holdId)
  clearInterval(repeatId)
  holdId = repeatId = undefined
  if (repeatBefore && repeatMoved)
    history.execute(
      new TransformCommand(repeatDescription, repeatBefore, captureTransforms())
    )
  repeatBefore = null
  repeatMoved = false
}

// One step now, then — while the button stays pressed — one every REPEAT_MS
function startRepeat(step: () => void, description = 'Nav control move'): void {
  stopRepeat()
  repeatBefore = captureTransforms()
  repeatDescription = description
  const tick = () => {
    step()
    repeatMoved = true
  }
  tick()
  holdId = setTimeout(() => {
    repeatId = setInterval(tick, REPEAT_MS)
  }, HOLD_DELAY_MS)
}

function sliderValue(id: string): number {
  return Number((document.getElementById(id) as HTMLInputElement).value)
}

function raiseMovedFlags(): void {
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderLayerLabelsFlag = true
  ctx.renderNodeLabelsFlag = true
}

// --- Scene ---------------------------------------------------------------

function rotateScene(direction: number, axis: Axis): void {
  startRepeat(() => {
    if (!ctx.scene?.exists()) return
    const rad =
      direction * THREE.MathUtils.degToRad(sliderValue('sceneRotateSlider'))
    if (axis === 'X') ctx.scene.rotateX(rad)
    else if (axis === 'Y') ctx.scene.rotateY(rad)
    else ctx.scene.rotateZ(rad)
    raiseMovedFlags()
  })
}

// Fit the whole network into the window (pan and zoom), like a double-click
// on the background; one undoable step.
export function recenterNetwork(): void {
  if (ctx.scene?.exists()) {
    resetZoomTarget()
    fitView()
    raiseMovedFlags()
  }
}

// --- Layers --------------------------------------------------------------

function rotateSelectedLayers(direction: number, axis: Axis): void {
  const selected = getSelectedLayers()
  if (selected.length === 0) return alert('Please select at least one layer.')
  startRepeat(() => {
    const rad =
      direction * THREE.MathUtils.degToRad(sliderValue('layerRotateSlider'))
    for (const i of selected) {
      if (axis === 'X') ctx.layers[i].rotateX(rad)
      else if (axis === 'Y') ctx.layers[i].rotateY(rad)
      else ctx.layers[i].rotateZ(rad)
    }
    raiseMovedFlags()
  })
}

function moveLayers(direction: number, axis: Axis): void {
  const selected = getSelectedLayers()
  if (selected.length === 0) return alert('Please select at least one layer.')
  startRepeat(() => {
    const step = direction * sliderValue('layerTranslateSlider')
    for (const i of selected) {
      if (axis === 'X') ctx.layers[i].translateX(step)
      else if (axis === 'Y') ctx.layers[i].translateY(step)
      else ctx.layers[i].translateZ(step)
    }
    raiseMovedFlags()
  })
}

function spreadLayers(direction: number): void {
  startRepeat(() => {
    initialSpreadLayers(direction)
    raiseMovedFlags()
  }, 'Spread layers')
}

function scaleLayers(): void {
  const value = sliderValue('layerScaleSlider')
  const td = document.getElementById('sliderValue4')
  if (td) td.textContent = `x${value}`

  const selected = getSelectedLayers()
  if (selected.length === 0) return alert('Please select at least one layer.')
  for (const i of selected) {
    // nodes keep their in-plane offsets proportional (v2 scaleLayers)
    const moveFactor = value / ctx.layers[i].getScale()
    for (const child of ctx.layers[i].plane.children) {
      if (child.type === 'Mesh') {
        child.position.y *= moveFactor
        child.position.z *= moveFactor
      }
    }
    ctx.layers[i].setScale(value)
  }
  redrawIntraLayerEdges()
  raiseMovedFlags()
}

// --- Nodes ---------------------------------------------------------------

function spreadNodes(multiplier: number): void {
  const selected = getSelectedNodes()
  if (selected.length === 0) return alert('Please select at least one node.')
  startRepeat(() => {
    for (const i of selected) {
      const node = ctx.nodeObjects[i]
      node.setPosition('y', node.getPosition('y') * multiplier)
      node.setPosition('z', node.getPosition('z') * multiplier)
    }
    redrawIntraLayerEdges()
    raiseMovedFlags()
  }, 'Spread nodes')
}

function moveNodes(direction: number, axis: Axis): void {
  const selected = getSelectedNodes()
  if (selected.length === 0) return alert('Please select at least one node.')
  startRepeat(() => {
    const step = direction * sliderValue('nodeTranslateSlider')
    for (const i of selected) {
      if (axis === 'X') ctx.nodeObjects[i].translateX(step)
      else if (axis === 'Y') ctx.nodeObjects[i].translateY(step)
      else ctx.nodeObjects[i].translateZ(step)
    }
    redrawIntraLayerEdges()
    raiseMovedFlags()
  })
}

function scaleNodes(): void {
  const value = sliderValue('nodeScaleSlider')
  const td = document.getElementById('sliderValue6')
  if (td) td.textContent = `x${value}`

  const selected = getSelectedNodes()
  if (selected.length === 0) return alert('Please select at least one node.')
  for (const i of selected) ctx.nodeObjects[i].setScale(value)
}

// --- DOM -----------------------------------------------------------------

// One Angle/Step group: value label + slider + the six axis buttons laid out
// as v2's four table rows (label,±X / slider / ±Y / ±Z).
function axisRowsHtml(
  valueId: string,
  valueText: string,
  sliderId: string,
  slider: { min: number; max: number; value: number; step: number },
  t: '' | '_T'
): string {
  const btn = (name: string): string =>
    `<td class="canvasControls" data-nav="${name}${t}" title="${t ? 'Move' : 'Rotate'} ${name.startsWith('plus') ? '+' : '−'}${name.slice(-1)}">${axisIcon(name, t === '_T')}</td>`
  return `
    <tr>
      <td colspan="2" class="labelDrop" id="${valueId}">${valueText}</td>
      ${btn('minusX')}${btn('plusX')}
    </tr>
    <tr>
      <td rowspan="3" colspan="2">
        <input class="canvasSlider raiseSlider" id="${sliderId}" type="range"
          min="${slider.min}" max="${slider.max}" value="${slider.value}" step="${slider.step}" />
      </td>
    </tr>
    <tr>${btn('minusY')}${btn('plusY')}</tr>
    <tr>${btn('minusZ')}${btn('plusZ')}</tr>`
}

const INFO_HTML = `
  <ul id="navShortcuts">
    <li><span>Zoom</span><span><kbd>Wheel</kbd></span></li>
    <li data-multilayer-only><span>Pan</span><span><kbd>Drag</kbd> / <kbd>&#8592;&#8593;&#8594;&#8595;</kbd></span></li>
    <li data-multilayer-only><span>Orbit</span><span><kbd>Middle Drag</kbd></span></li>
    <li data-single-only><span>Rotate Network</span><span><kbd>Drag</kbd></span></li>
    <li data-single-only><span>Pan</span><span><kbd>Middle Drag</kbd> / <kbd>&#8592;&#8593;&#8594;&#8595;</kbd></span></li>
    <li data-multilayer-only><span>Drag Layer</span><span><kbd>Drag</kbd></span></li>
    <li data-multilayer-only><span>Rotate Layer</span><span><kbd class='blue'>Z</kbd><kbd class='red'>X</kbd><kbd class='green'>C</kbd> + <kbd>Drag</kbd></span></li>
    <li data-single-only><span>Rotate about Axis</span><span><kbd class='blue'>Z</kbd><kbd class='red'>X</kbd><kbd class='green'>C</kbd> + <kbd>Drag</kbd></span></li>
    <li><span>Move Selected Nodes</span><span><kbd class='blue'>Z</kbd><kbd class='green'>C</kbd> + <kbd>Drag</kbd></span></li>
    <li><span>Select Node/Layer</span><span><kbd>Dbl Click</kbd></span></li>
    <li><span>Select an Area</span><span><kbd>Shift</kbd> + <kbd>Drag</kbd></span></li>
    <li class="nav-shape"><span>Area Shape</span><span class="nav-shape__btns" role="group" aria-label="Shape of the area Shift + Drag selects">
      <button type="button" data-shape="rectangle" title="Shift + Drag selects the nodes inside a rectangle">&#9645; Rectangle</button>
      <button type="button" data-shape="lasso" title="Shift + Drag draws a freehand lasso; the nodes inside it are selected">&#10044; Lasso</button>
    </span></li>
    <li class="nav-shape"><span>Area Mode</span><span class="nav-shape__btns" role="group" aria-label="What the area does to the selection">
      <button type="button" data-combine="new" title="The area's nodes replace the selection">New</button>
      <button type="button" data-combine="add" title="The area's nodes are added to the selection">Add</button>
      <button type="button" data-combine="remove" title="The area's nodes are taken out of the selection (or hold Alt / Option as you release)">Remove</button>
    </span></li>
    <li><span>Fit View, Unselect All</span><span><kbd>Dbl Click</kbd> Scene</span></li>
  </ul>
  <table id="canvasControls_table"><tbody>
    <tr><td colspan="4"><h5>Scene</h5></td></tr>
    <tr><td colspan="4" class="controlsSubLabel">Rotation Controls</td></tr>
    ${axisRowsHtml('sliderValue1', 'Angle: 5&#730;', 'sceneRotateSlider', { min: 1, max: 15, value: 5, step: 1 }, '')}
    <tr><td colspan="4"><button id="recenterButton">Recenter Network</button></td></tr>
  </tbody><tbody data-multilayer-only>
    <tr class="border_tr"><td colspan="4"><h5>Layers</h5></td></tr>
    <tr><td colspan="4" class="controlsSubLabel">Rotation Controls</td></tr>
    ${axisRowsHtml('sliderValue2', 'Angle: 5&#730;', 'layerRotateSlider', { min: 1, max: 15, value: 5, step: 1 }, '')}
    <tr><td colspan="4" class="controlsSubLabel">Translation Controls</td></tr>
    <tr>
      <td colspan="2" class="canvasControls nav-group" data-nav="expandLayers" title="Spread layers apart">${GROUP_ICONS.expandLayers}</td>
      <td colspan="2" class="canvasControls nav-group" data-nav="collapseLayers" title="Pull layers together">${GROUP_ICONS.collapseLayers}</td>
    </tr>
    ${axisRowsHtml('sliderValue3', 'Step: 25', 'layerTranslateSlider', { min: 5, max: 50, value: 25, step: 5 }, '_T')}
    <tr>
      <td>Scale</td>
      <td colspan="2">
        <input class="canvasSlider" id="layerScaleSlider" type="range" min="0.2" max="5" value="1" step="0.1" />
      </td>
      <td id="sliderValue4">x1</td>
    </tr>
  </tbody><tbody>
    <tr class="border_tr"><td colspan="4"><h5>Nodes</h5></td></tr>
    <tr><td colspan="4" class="controlsSubLabel">Translation Controls</td></tr>
    <tr>
      <td colspan="2" class="canvasControls nav-group" data-nav="expandNodes" title="Spread selected nodes apart">${GROUP_ICONS.expandNodes}</td>
      <td colspan="2" class="canvasControls nav-group" data-nav="collapseNodes" title="Pull selected nodes together">${GROUP_ICONS.collapseNodes}</td>
    </tr>
    ${axisRowsHtml('sliderValue5', 'Step: 25', 'nodeTranslateSlider', { min: 5, max: 50, value: 25, step: 5 }, '_T')}
    <tr>
      <td>Scale</td>
      <td colspan="2">
        <input class="canvasSlider" id="nodeScaleSlider" type="range" min="0.2" max="5" value="1" step="0.1" />
      </td>
      <td id="sliderValue6">x1</td>
    </tr>
  </tbody></table>`

// data-nav name (without _T suffix stripping) → hold-to-repeat action
function holdAction(name: string): (() => void) | null {
  const map: Record<string, () => void> = {
    minusX: () => rotateScene(-1, 'X'),
    plusX: () => rotateScene(1, 'X'),
    minusY: () => rotateScene(-1, 'Y'),
    plusY: () => rotateScene(1, 'Y'),
    minusZ: () => rotateScene(-1, 'Z'),
    plusZ: () => rotateScene(1, 'Z'),
  }
  return map[name] ?? null
}

// Real stop/start affordance for the render-pause button (previously a
// static "Stop:Render..." label that never reflected the actual flag).
function setPauseButtonState(paused: boolean): void {
  const btn = document.getElementById('interLayerEdgesRenderPauseButton')
  if (!btn) return
  btn.classList.toggle('is-paused', paused)
  btn.innerHTML = paused
    ? '<span class="nav-toggle-icon">&#9654;</span>Render Inter-Layer Edges'
    : '<span class="nav-toggle-icon">&#10074;&#10074;</span>Pause Inter-Layer Edges'
  btn.setAttribute(
    'aria-label',
    paused
      ? 'Resume inter-layer edge rendering'
      : 'Pause inter-layer edge rendering'
  )
}

// Up/down chevron reflecting whether #info is currently expanded.
function setControlsToggleState(open: boolean): void {
  const btn = document.getElementById('displayCanvasControlsButton')
  if (!btn) return
  btn.classList.toggle('is-open', open)
  btn.innerHTML = `<span class="nav-toggle-icon">${open ? '&#9652;' : '&#9662;'}</span>Navigation Controls`
  btn.setAttribute(
    'aria-label',
    open ? 'Hide navigation controls' : 'Show navigation controls'
  )
}

// v2 attached the controls on first network build (canvasControlsAttached
// flag); #info keeps its "waiting for network" hint until then.
export function registerNavControls(): void {
  const off = bus.on('network:loaded', () => {
    attachNavControls()
    off()
  })
}

function attachNavControls(): void {
  const buttonsDiv = document.getElementById('navControlButtonsDiv')
  const info = document.getElementById('info')
  if (!buttonsDiv || !info) return

  buttonsDiv.innerHTML = `
    <button id="interLayerEdgesRenderPauseButton" class="displayCanvasControls nav-toggle-btn" type="button" data-multilayer-only></button>
    <button id="displayCanvasControlsButton" class="displayCanvasControls nav-toggle-btn" type="button"></button>`
  document
    .getElementById('interLayerEdgesRenderPauseButton')!
    .addEventListener('click', () => {
      setPauseButtonState(toggleInterLayerEdgesRendering())
    })
  document
    .getElementById('displayCanvasControlsButton')!
    .addEventListener('click', () => {
      const open = info.style.display === 'none'
      info.style.display = open ? 'inline-block' : 'none'
      setControlsToggleState(open)
    })

  info.innerHTML = INFO_HTML
  // the area Shift + Drag selects: a rectangle or a freehand lasso, and
  // whether it replaces, adds to or takes from the selection
  const switches = [
    ...info.querySelectorAll<HTMLButtonElement>('.nav-shape button'),
  ]
  const syncSwitches = () =>
    switches.forEach((b) => {
      const on =
        b.dataset.shape === getSelectShape() ||
        b.dataset.combine === getSelectCombine()
      b.classList.toggle('is-active', on)
      b.setAttribute('aria-pressed', String(on))
    })
  switches.forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.shape) setSelectShape(b.dataset.shape as SelectShape)
      else setSelectCombine(b.dataset.combine as SelectCombine)
      syncSwitches()
    })
  )
  syncSwitches()
  // on phones the table would cover most of the scene: start it closed
  const phone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 768px)').matches
  info.style.display = phone ? 'none' : 'inline-block'
  setPauseButtonState(ctx.interLayerEdgesRenderPauseFlag)
  setControlsToggleState(!phone)

  document
    .getElementById('recenterButton')!
    .addEventListener('click', recenterNetwork)

  // Hold-to-repeat axis buttons. The table holds three axis groups in DOM
  // order: scene rotate, layer rotate (plain names), then layer + node
  // translate (_T names) — disambiguated by which group's rows they sit in.
  const groups: ((name: string) => void)[] = [
    (n) => holdAction(n)?.(),
    (n) =>
      rotateSelectedLayers(n.startsWith('minus') ? -1 : 1, n.slice(-1) as Axis),
    (n) =>
      moveLayers(
        n.startsWith('minus') ? -1 : 1,
        n.charAt(n.length - 3) as Axis
      ),
    (n) =>
      moveNodes(n.startsWith('minus') ? -1 : 1, n.charAt(n.length - 3) as Axis),
  ]
  let plainSeen = 0
  let tSeen = 0
  for (const el of info.querySelectorAll<HTMLElement>('[data-nav]')) {
    const name = el.dataset.nav!
    let press: () => void
    if (name === 'expandLayers') press = () => spreadLayers(1)
    else if (name === 'collapseLayers') press = () => spreadLayers(-1)
    else if (name === 'expandNodes') press = () => spreadNodes(1.1)
    else if (name === 'collapseNodes') press = () => spreadNodes(0.9)
    else {
      const isT = name.endsWith('_T')
      const group = isT
        ? 2 + Math.floor(tSeen++ / 6)
        : Math.floor(plainSeen++ / 6)
      press = () => groups[group](name)
    }
    // pointer events: mouse, pen and touch alike; the step runs on press
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      e.preventDefault() // no text selection or focus jump on fast clicks
      press()
    })
    el.addEventListener('pointerleave', stopRepeat)
  }
  // released anywhere (or the window loses the pointer): stop
  window.addEventListener('pointerup', stopRepeat)
  window.addEventListener('pointercancel', stopRepeat)
  window.addEventListener('blur', stopRepeat)

  // Live-scale on input; one undo entry per drag, finalized on 'change'.
  // `sync` re-applies the restored scale to the slider + its value label on
  // undo/redo (the transform snapshot only covers the 3D objects).
  const wireScaleSlider = (
    el: HTMLElement,
    run: () => void,
    description: string,
    sync: () => void
  ): void => {
    let before: TransformSnapshot | null = null
    el.addEventListener('input', () => {
      before ??= captureTransforms()
      run()
    })
    el.addEventListener('change', () => {
      if (before) {
        history.execute(
          new TransformCommand(description, before, captureTransforms(), sync)
        )
        before = null
      }
    })
  }
  const setSlider = (sliderId: string, tdId: string, value: number): void => {
    const s = document.getElementById(sliderId) as HTMLInputElement | null
    if (s) s.value = String(value)
    const td = document.getElementById(tdId)
    if (td) td.textContent = `x${value}`
  }
  wireScaleSlider(
    document.getElementById('layerScaleSlider')!,
    scaleLayers,
    'Scale layers',
    () => {
      const sel = getSelectedLayers()
      setSlider(
        'layerScaleSlider',
        'sliderValue4',
        sel.length ? ctx.layers[sel[0]].getScale() : 1
      )
    }
  )
  wireScaleSlider(
    document.getElementById('nodeScaleSlider')!,
    scaleNodes,
    'Scale nodes',
    () => {
      const sel = getSelectedNodes()
      setSlider(
        'nodeScaleSlider',
        'sliderValue6',
        sel.length ? ctx.nodeObjects[sel[0]].getScale() : 1
      )
    }
  )
  for (const [sliderId, tdId, fmt] of [
    ['sceneRotateSlider', 'sliderValue1', 'Angle: %v˚'],
    ['layerRotateSlider', 'sliderValue2', 'Angle: %v˚'],
    ['layerTranslateSlider', 'sliderValue3', 'Step: %v'],
    ['nodeTranslateSlider', 'sliderValue5', 'Step: %v'],
  ] as const) {
    document.getElementById(sliderId)!.addEventListener('input', (e) => {
      document.getElementById(tdId)!.textContent = fmt.replace(
        '%v',
        (e.target as HTMLInputElement).value
      )
    })
  }
}
