// Port of v2 www/js/object_actions/layer.js — spread, hover, selection,
// repaint, visibility and layer-wide setters. Selection syncs to the store
// instead of Shiny inputs. Deferred with their phases: checkbox group +
// color-picker DOM (Phase 13 UI), DragControls + held-key/slider
// rotate/move/scale intervals (canvas_controls.ts).

import type { MeshBasicMaterial } from 'three'
import { bus } from '../bus'
import { store } from '../store'
import { ctx, SELECTED_LAYER_DEFAULT_COLOR } from '../three'
import { LAYER_DEFAULT_COLOR } from '../three/constants'
import { VOLUME_CONTAINERS } from '../three/Layer'
import type { ColorPrioritySource } from '../three'
import { findIndexByUuid } from '../utils'
import { decideNodeLabelFlags } from './node'
import { raycaster, setRaycaster } from './screen'

// Spread layers evenly along x (v2: predefined layouts, upload/import,
// canvas controls; direction -1 stacks them back).
// Side by side across the window — wider apart when 3D volumes (cubes,
// spheres, clouds) would otherwise overlap. @return the spacing used
export function initialSpreadLayers(direction = 1): number {
  const n = ctx.layers.length
  const radius = Math.max(
    0,
    ...ctx.layers
      .filter((l) => VOLUME_CONTAINERS.includes(l.container))
      .map((l) => l.containerRadius())
  )
  const spacing = Math.max((ctx.xBoundMax * 2) / n, 2 * radius * 1.15)
  ctx.layers.forEach((layer, i) => {
    const offset =
      n % 2
        ? (i - Math.floor(n / 2)) * spacing
        : (i - n / 2) * spacing + spacing / 2
    layer.translateX(direction * offset)
  })
  return spacing
}

function updateSelectedLayersStore(): void {
  const names = ctx.layers.filter((l) => l.isSelected).map((l) => l.name)
  store.update({ selectedLayers: names })
  bus.emit('layers:selected', { names })
}

// @return selected layer indexes
export function getSelectedLayers(): number[] {
  return ctx.layers.filter((l) => l.isSelected).map((l) => l.id)
}

// Last floor-picker color applied. Tracked so ChangeFloorColorCommand can
// recover the previous value on undo — the DOM color input already holds the
// new value by the time its 'change' event fires, so it can't be read back.
let lastFloorColor = LAYER_DEFAULT_COLOR

export function getLastFloorColor(): string {
  return lastFloorColor
}

// `pickerColor` overrides the DOM color input (themes.ts passes the theme's
// floor color; the input itself only exists once Phase 13 builds the UI).
export function repaintLayers(pickerColor?: string): void {
  if (ctx.layerColorPrioritySource === 'picker' && pickerColor)
    lastFloorColor = pickerColor
  for (const layer of ctx.layers) {
    if (layer.isSelected) layer.setColor(SELECTED_LAYER_DEFAULT_COLOR)
    else if (ctx.layerColorPrioritySource === 'default')
      layer.setColor(layer.importedColor)
    else if (ctx.layerColorPrioritySource === 'picker')
      layer.setColor(
        pickerColor ||
          (typeof document !== 'undefined' &&
            (document.getElementById('floor_color') as HTMLInputElement | null)
              ?.value) ||
          layer.color
      )
  }
}

export function checkHoverOverLayer(event: {
  clientX: number
  clientY: number
}): void {
  setRaycaster(event)
  const planes = ctx.layers.map(({ plane }) => plane)
  // Non-recursive: planes carry node spheres/labels/coord lines as children;
  // a child hit isn't in `planes`, so findIndexByUuid returned -1 and crashed.
  const intersects = raycaster().intersectObjects(planes, false)
  if (intersects.length > 0) {
    if (ctx.lastHoveredLayerIndex !== null) {
      repaintLayers()
      ctx.hoveredLayerPaintedFlag = true
    }
    const i = findIndexByUuid(planes, intersects[0].object.uuid)
    ;(ctx.layers[i].plane.material as MeshBasicMaterial).color.set(0xff0000)
    ctx.lastHoveredLayerIndex = i
  } else {
    if (ctx.hoveredLayerPaintedFlag) {
      repaintLayers() // remove red color from last hovered
      ctx.hoveredLayerPaintedFlag = false
    }
    ctx.lastHoveredLayerIndex = null
  }
}

// v2 toggled the matching DOM checkbox too — Phase 13 wires that back up.
export function performDoubleClickLayerSelection(): void {
  if (ctx.lastHoveredLayerIndex === null) return
  ctx.layers[ctx.lastHoveredLayerIndex].toggleSelection()
  ctx.lastHoveredLayerIndex = null
  ctx.renderLayerLabelsFlag = true
  repaintLayers()
  updateSelectedLayersStore()
}

// v2 selectCheckedLayer minus the DOM checkbox element.
export function selectLayer(index: number, selected: boolean): void {
  ctx.layers[index].isSelected = selected
  ctx.renderLayerLabelsFlag = true
  repaintLayers()
  updateSelectedLayersStore()
}

export function selectAllLayers(selected: boolean): void {
  for (const layer of ctx.layers) layer.isSelected = selected
  ctx.renderLayerLabelsFlag = true
  repaintLayers()
  updateSelectedLayersStore()
}

// v2 hideLayers core, per layer (the checkbox loop is Phase 13's).
export function setLayerVisibility(index: number, visible: boolean): void {
  ctx.layers[index].toggleVisibility(visible)
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderLayerLabelsFlag = true
  decideNodeLabelFlags()
}

// v2 showLayerNodeLabels core, per layer.
export function setLayerNodeLabels(index: number, show: boolean): void {
  ctx.layers[index].showNodeLabels = show
  decideNodeLabelFlags()
}

// Handlers (v2 Shiny handlers) =====

export function showLayerCoords(show: boolean): void {
  for (const layer of ctx.layers) layer.toggleCoords(show)
}

export function setLayerAxesOpacity(opacity: number): void {
  for (const layer of ctx.layers) layer.setAxesOpacity(opacity)
}

export function setFloorOpacity(opacity: number): void {
  for (const layer of ctx.layers) layer.setOpacity(opacity)
}

export function showFloors(flag: boolean): void {
  for (const layer of ctx.layers) layer.toggleFloor(flag)
}

// A single-layer network (e.g. a 2-column edgelist) reads better without its
// floor; multilayer networks keep them. Called after every network build.
export function applyDefaultFloorVisibility(): void {
  showFloors(ctx.layers.length !== 1)
}

export function setLayerColorPriority(source: ColorPrioritySource): void {
  ctx.layerColorPrioritySource = source
  repaintLayers()
}
