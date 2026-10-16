// Port of v2 www/js/object_actions/labels.js — plain absolutely-positioned
// divs in #labelDiv, repositioned in the animate loop (flag-gated, as v2).
// Positioning is set inline so it works before the Phase 13 stylesheet lands.

import { Vector3 } from 'three'
import { ctx, NODE_LABEL_DEFAULT_SIZE } from '../three'
import { decideNodeLabelFlags } from './node'
import { registerAnimateHook } from './screen'

const VEC3 = new Vector3() // scratch, reused per frame

// Rebuilt on every network build (v2 resetValues cleared #labelDiv).
let nodeLabelsDivs: HTMLDivElement[] = []
let layerLabelsDivs: HTMLDivElement[] = []

function labelContainer(): HTMLElement | null {
  return typeof document === 'undefined'
    ? null
    : document.getElementById('labelDiv')
}

function createLabel(
  container: HTMLElement,
  text: string,
  id: string,
  className: string
): HTMLDivElement {
  const div = document.createElement('div')
  div.textContent = text
  div.className = className
  div.id = id
  div.style.position = 'absolute'
  div.style.color = ctx.labelColor
  container.appendChild(div)
  return div
}

// Called from the network build (v2 executePostNetworkSetup). No-op headless.
export function createLabels(): void {
  const container = labelContainer()
  nodeLabelsDivs = []
  layerLabelsDivs = []
  if (!container) return
  container.innerHTML = ''

  ctx.nodeObjects.forEach((node, i) => {
    const div = createLabel(
      container,
      node.name,
      `${ctx.nodeLayerNames[i]}_label`,
      'labels'
    )
    div.style.fontSize = NODE_LABEL_DEFAULT_SIZE
    div.style.display = 'none'
    nodeLabelsDivs.push(div)
  })

  for (const layer of ctx.layers) {
    const div = createLabel(
      container,
      layer.getName(),
      `${layer.getName()}_label`,
      'layer-labels'
    )
    div.style.display = 'inline-block'
    layerLabelsDivs.push(div)
  }
  labelStyles = {}
  ctx.renderLayerLabelsFlag = true
}

// v2 setLabelColorVariable + setLabelColor.
export function setLabelColor(color = ctx.labelColor): void {
  ctx.labelColor = color
  for (const div of layerLabelsDivs) div.style.color = color
  for (const div of nodeLabelsDivs) div.style.color = color
  restyleNodeLabels()
}

// Handlers (v2 Shiny handlers) =====

export function showLayerLabels(mode: 'all' | 'selected' | 'none'): void {
  ctx.showAllLayerLabelsFlag = mode === 'all'
  ctx.showSelectedLayerLabelsFlag = mode === 'selected'

  layerLabelsDivs.forEach((div, i) => {
    const visible =
      mode === 'all' || (mode === 'selected' && ctx.layers[i].isSelected)
    div.style.display = visible ? 'inline-block' : 'none'
  })
  if (mode !== 'none') ctx.renderLayerLabelsFlag = true
}

export function showNodeLabels(mode: 'all' | 'selected' | 'none'): void {
  ctx.showAllNodeLabelsFlag = mode === 'all'
  ctx.showSelectedNodeLabelsFlag = mode === 'selected'
  decideNodeLabelFlags()
}

export function resizeLayerLabels(size: number): void {
  for (const div of layerLabelsDivs) div.style.fontSize = `${size}px`
}

export function resizeNodeLabels(size: number): void {
  labelStyles['*'] = { ...labelStyles['*'], size }
  for (const div of nodeLabelsDivs) div.style.fontSize = `${size}px`
}

// Animate-loop rendering =====

export function renderLayerLabels(): void {
  if (!ctx.renderLayerLabelsFlag) return

  if (ctx.showAllLayerLabelsFlag) {
    redrawLayerLabels(ctx.layers.map((l) => l.id))
  } else if (ctx.showSelectedLayerLabelsFlag) {
    for (const div of layerLabelsDivs) div.style.display = 'none'
    const selected = ctx.layers.filter((l) => l.isSelected).map((l) => l.id)
    if (selected.length > 0) redrawLayerLabels(selected)
  }
  ctx.renderLayerLabelsFlag = false
}

// v2 read the hideLayer DOM checkboxes; hidden state lives on Layer now.
function redrawLayerLabels(indexes: number[]): void {
  for (const i of indexes) {
    const div = layerLabelsDivs[i]
    if (!div) continue
    if (ctx.layers[i].isVisible) {
      const world = ctx.layers[i].sphere.getWorldPosition(VEC3.set(0, 0, 0))
      div.style.left = `${ctx.xBoundMax + world.x}px`
      div.style.top = `${ctx.yBoundMax - world.y}px`
      div.style.display = 'inline-block'
    } else div.style.display = 'none'
  }
}

export function renderNodeLabels(): void {
  if (!ctx.renderNodeLabelsFlag) return

  ctx.nodeObjects.forEach((node, i) => {
    const div = nodeLabelsDivs[i]
    if (!div) return
    if (node.showLabel) {
      div.style.left = `${ctx.xBoundMax + node.getWorldPosition('x') + 7}px`
      div.style.top = `${ctx.yBoundMax - node.getWorldPosition('y') - 10}px`
      div.style.display = 'inline-block'
    } else div.style.display = 'none'
  })
  ctx.renderNodeLabelsFlag = false
}

// Performance panel: labels disappear while the scene is being moved
function labelsWhileMoving(): void {
  const container = labelContainer()
  if (!container) return
  const hide = ctx.hideLabelsWhileMoving && !!ctx.scene?.dragging
  const visibility = hide ? 'hidden' : ''
  if (container.style.visibility !== visibility)
    container.style.visibility = visibility
}

// Called once from main.ts.
export function registerLabelRendering(): void {
  registerAnimateHook(renderLayerLabels)
  registerAnimateHook(renderNodeLabels)
  registerAnimateHook(labelsWhileMoving)
}

// ---------------------------------------------------------------- label style
// Colour, font, weight, halo, background and opacity of the node labels, for
// every node ('*') or per layer; per-layer entries win. Re-applied whenever
// labels are (re)created or the theme recolours them.
export interface LabelStyle {
  color?: string
  size?: number
  weight?: 'normal' | 'bold'
  italic?: boolean
  font?: 'system' | 'serif' | 'mono'
  halo?: boolean
  background?: boolean
  opacity?: number
}
const FONTS: Record<NonNullable<LabelStyle['font']>, string> = {
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}
let labelStyles: Record<string, LabelStyle> = {}

export const labelStylesSnapshot = (): Record<string, LabelStyle> =>
  JSON.parse(JSON.stringify(labelStyles)) as Record<string, LabelStyle>

export function restoreLabelStyles(styles: Record<string, LabelStyle>): void {
  labelStyles = JSON.parse(JSON.stringify(styles)) as Record<string, LabelStyle>
  restyleNodeLabels()
}

// layers null = every node (and the per-layer overrides are dropped)
export function applyLabelStyle(
  style: LabelStyle,
  layers: string[] | null
): void {
  if (layers === null) labelStyles = { '*': { ...labelStyles['*'], ...style } }
  else
    for (const layer of layers)
      labelStyles[layer] = { ...labelStyles[layer], ...style }
  restyleNodeLabels()
}

export function restyleNodeLabels(): void {
  nodeLabelsDivs.forEach((div, i) => {
    const layer = ctx.nodeGroups[ctx.nodeLayerNames[i]]
    const st: LabelStyle = { ...labelStyles['*'], ...labelStyles[layer] }
    div.style.color = st.color ?? ctx.labelColor
    if (st.size) div.style.fontSize = `${st.size}px`
    div.style.fontWeight = st.weight ?? ''
    div.style.fontStyle = st.italic ? 'italic' : ''
    div.style.fontFamily = st.font ? FONTS[st.font] : ''
    div.style.textShadow = st.halo
      ? '0 0 3px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.8)'
      : ''
    if (st.background) {
      div.style.background = 'rgba(0, 0, 0, 0.55)'
      div.style.padding = '0 0.3em'
      div.style.borderRadius = '0.4em'
    } else {
      div.style.background = ''
      div.style.padding = ''
      div.style.borderRadius = ''
    }
    div.style.opacity = st.opacity !== undefined ? String(st.opacity) : ''
  })
}
