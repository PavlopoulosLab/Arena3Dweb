// Port of v2 www/js/object_actions/node.js — hover, selection, repaint,
// shape/color-priority setters. Selection state syncs to the store instead
// of Shiny inputs. Deferred with their phases: search bar / sliders / node
// description div (Phase 13 UI), lasso + held-key node moves + spread/move/
// scale sliders (canvas_controls.ts), attribute upload (POST /api/attributes).

import type { NodeAttributeRow } from '../api/client'
import { bus } from '../bus'
import { store } from '../store'
import { ctx, SELECTED_DEFAULT_COLOR } from '../three'
import type { ColorPrioritySource } from '../three'
import { NODE_DETAIL } from '../three/constants'
import {
  findIndexByUuid,
  getCaseInsensitiveIndices,
  getRandomArbitrary,
  setRandomSeed,
} from '../utils'
import { raycaster, setRaycaster } from './screen'

// v2 set.seed(123): fixed so every network load scatters to the same layout.
const SCRAMBLE_SEED = 123

// v2 node.js scrambleNodes — random y/z spread onto each node's layer plane.
// Re-seeds first so the same network always scatters identically (Load Example
// and uploads are reproducible).
export function scrambleNodes(
  yMin = ctx.yBoundMin,
  yMax = ctx.yBoundMax,
  zMin = ctx.zBoundMin,
  zMax = ctx.zBoundMax
): void {
  setRandomSeed(SCRAMBLE_SEED)
  for (const node of ctx.nodeObjects) {
    node.translateY(getRandomArbitrary(yMin, yMax))
    node.translateZ(getRandomArbitrary(zMin, zMax))
  }
}

export function updateSelectedNodesStore(): void {
  store.update({
    selectedNodes: ctx.nodeObjects
      .filter((n) => n.isSelected)
      .map((n) => n.nodeLayerName),
  })
}

// @return whether the pointer is over a node
export function checkHoverOverNode(event: {
  clientX: number
  clientY: number
}): boolean {
  setRaycaster(event)
  const spheres = ctx.nodeObjects.map(({ sphere }) => sphere)
  const intersects = raycaster().intersectObjects(spheres, false)
  let changed = false
  let hovering = false

  if (ctx.lastHoveredNodeIndex !== null) {
    ctx.nodeObjects[ctx.lastHoveredNodeIndex].setOpacity(1)
    ctx.lastHoveredNodeIndex = null
    changed = true
  }

  if (intersects.length > 0) {
    const i = findIndexByUuid(spheres, intersects[0].object.uuid)
    ctx.nodeObjects[i].setOpacity(0.5)
    ctx.lastHoveredNodeIndex = i
    changed = true
    hovering = true
  }

  if (changed) decideNodeLabelFlags()
  return hovering
}

// v2 read the hideLayer DOM checkboxes; layer visibility now lives on Layer.
export function decideNodeLabelFlags(): void {
  ctx.renderNodeLabelsFlag = true
  ctx.nodeObjects.forEach((node, i) => {
    const layer =
      ctx.layers[ctx.layerGroups[ctx.nodeGroups[ctx.nodeLayerNames[i]]]]
    // Priorities list:
    if (!layer.isVisible) node.showLabel = false
    else if (ctx.showAllNodeLabelsFlag) node.showLabel = true
    else if (layer.showNodeLabels) node.showLabel = true
    else if (ctx.showSelectedNodeLabelsFlag && node.isSelected)
      node.showLabel = true
    else if (i === ctx.lastHoveredNodeIndex) node.showLabel = true
    else node.showLabel = false
  })
}

// @return selected node indexes
export function getSelectedNodes(): number[] {
  return ctx.nodeObjects.filter((n) => n.isSelected).map((n) => n.id)
}

// @return whether a node was toggled
export function performDoubleClickNodeSelection(event: {
  clientX: number
  clientY: number
}): boolean {
  setRaycaster(event)
  const spheres = ctx.nodeObjects.map(({ sphere }) => sphere)
  const intersects = raycaster().intersectObjects(spheres, false)
  if (intersects.length === 0) return false

  const i = findIndexByUuid(spheres, intersects[0].object.uuid)
  ctx.nodeObjects[i].isSelected = !ctx.nodeObjects[i].isSelected
  repaintNode(i)
  decideNodeLabelFlags()
  updateSelectedNodesStore()
  return true
}

export function repaintNode(i: number): void {
  const node = ctx.nodeObjects[i]
  if (ctx.selectedNodeColorFlag && node.isSelected)
    node.setColor(SELECTED_DEFAULT_COLOR)
  // getColor resolves the default/picker/cluster priority (v2 repaintNode's
  // manual cluster branch is folded into it)
  else node.setColor(node.getColor())
}

export function repaintNodes(): void {
  ctx.nodeObjects.forEach((_, i) => repaintNode(i))
}

export function selectAllNodes(selected: boolean): void {
  ctx.nodeObjects.forEach((node, i) => {
    node.isSelected = selected
    repaintNode(i)
  })
  decideNodeLabelFlags()
  updateSelectedNodesStore()
}

export function unselectAllNodes(): void {
  selectAllNodes(false)
}

// Core of v2 selectSearchedNodes minus the DOM search bar (Phase 13 wires
// the input + Enter key to this). Comma-separated, case-insensitive names.
export function selectNodesByName(search: string): void {
  const names = ctx.nodeObjects.map(({ name }) => name)
  for (const term of search.split(',')) {
    for (const i of getCaseInsensitiveIndices(names, term.trim())) {
      if (!ctx.nodeObjects[i].isSelected) {
        ctx.nodeObjects[i].isSelected = true
        repaintNode(i)
      }
    }
  }
  decideNodeLabelFlags()
  updateSelectedNodesStore()
}

// Performance panel: sphere segments (other shapes are already simple)
const DETAIL: Record<'low' | 'medium' | 'high', [number, number]> = {
  low: [6, 5],
  medium: [8, 8],
  high: [18, 12],
}
export function setNodeDetail(level: 'low' | 'medium' | 'high'): void {
  ctx.nodeDetail = level
  ;[NODE_DETAIL.width, NODE_DETAIL.height] = DETAIL[level]
  for (const node of ctx.nodeObjects)
    if (node.shape === 'sphere') node.setGeometry('sphere')
}

export function setNodeColorPriority(source: ColorPrioritySource): void {
  ctx.nodeColorPrioritySource = source
  repaintNodes()
}

export function setNodeSelectedColorPriority(flag: boolean): void {
  ctx.selectedNodeColorFlag = flag
  repaintNodes()
}

// v2 node.js setNodeAttributes + handler_clickNodeColorPriority("default"):
// apply per-node color/size/url/description from an attribute file, then
// flip color priority to default so imported colors show.
export function applyNodeAttributes(rows: NodeAttributeRow[]): void {
  for (const row of rows) {
    const pos = ctx.nodeLayerNames.indexOf(row.node_layer)
    if (pos === -1) continue // node not in network
    const node = ctx.nodeObjects[pos]
    if (row.color) node.setColor(row.color, true)
    if (row.size !== null) node.setScale(row.size)
    if (row.url) node.url = row.url
    if (row.description) node.descr = row.description
    if (row.annotations) node.annotations = [...row.annotations]
  }
  bus.emit('groups:changed', { source: 'annotation' })
  setNodeColorPriority('default')
}
