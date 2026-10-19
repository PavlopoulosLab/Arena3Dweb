// Port of v2 www/js/object_actions/labels.js — plain absolutely-positioned
// divs in #labelDiv, repositioned in the animate loop (flag-gated, as v2).
// Positioning is set inline so it works before the Phase 13 stylesheet lands.

import { Color } from 'three'
import { ctx, NODE_LABEL_DEFAULT_SIZE } from '../three'
import { setNodeLabelMode, type NodeLabelMode } from './node'
import { luminance } from './palette'
import {
  DEFAULT_LABEL_LOOK,
  type LabelLook,
  type LabelPosition,
} from '../three/Node'
import type { LayerLabelFont, LayerLabelPosition } from '../three/Layer'
import { LABEL_GAP, registerAnimateHook } from './screen'

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
      node.getLabel(),
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
  restyleNodeLabels() // per-node overrides (Edit → Style)
  restyleLayerLabels() // per-layer looks (Edit → Layers → Labels & axes)
  ctx.renderLayerLabelsFlag = true
}

// v2 setLabelColorVariable + setLabelColor.
export function setLabelColor(color = ctx.labelColor): void {
  ctx.labelColor = color
  for (const div of nodeLabelsDivs) div.style.color = color
  restyleNodeLabels()
  restyleLayerLabels() // a layer label's own colour stays
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

export function showNodeLabels(mode: NodeLabelMode): void {
  setNodeLabelMode(mode)
}

export function resizeLayerLabels(size: number): void {
  for (const div of layerLabelsDivs) div.style.fontSize = `${size}px`
}

export function resizeNodeLabels(size: number): void {
  labelStyles['*'] = { ...labelStyles['*'], size }
  restyleNodeLabels()
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
      // the floor's corner, or above / under the floor (Labels & axes)
      const [x, y] = ctx.layers[i].labelAnchor()
      div.style.left = `${ctx.xBoundMax + x}px`
      div.style.top = `${ctx.yBoundMax - y}px`
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
// every node ('*') or per layer; per-layer entries win, and a node's own text,
// colour and size (Edit → Style) win over both. Re-applied whenever labels
// are (re)created or the theme recolours them.
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
// layer labels: web-safe stacks, condensed ones first where a system has them
const LAYER_FONTS: Record<LayerLabelFont, string> = {
  sans: FONTS.system,
  serif: FONTS.serif,
  mono: FONTS.mono,
  condensed:
    '"Roboto Condensed", "Arial Narrow", "Helvetica Neue Condensed", "Liberation Sans Narrow", sans-serif-condensed, sans-serif',
}
// a label above or under the floor: centred on it, this far from its edge
const LAYER_LABEL_SHIFT: Record<LayerLabelPosition, string> = {
  corner: '',
  above: 'translate(-50%, calc(-100% - 6px))',
  below: 'translate(-50%, 6px)',
}

/** Layer labels with their own look, font, colour and place (Edit → Layers
 * → Labels & axes); the halo is their default too. */
export function restyleLayerLabels(): void {
  layerLabelsDivs.forEach((div, i) => {
    const layer = ctx.layers[i]
    if (!layer) return
    const text = layer.labelColor || ctx.labelColor
    div.style.color = text
    div.style.fontFamily = layer.labelFont ? LAYER_FONTS[layer.labelFont] : ''
    div.style.fontStyle = layer.labelItalic ? 'italic' : ''
    applyLook(
      div,
      { ...(layer.labelLook ?? DEFAULT_LABEL_LOOK), bold: layer.labelBold },
      {},
      text
    )
    div.style.transform = LAYER_LABEL_SHIFT[layer.labelPosition]
    div.dataset.pos = layer.labelPosition // read by the image export
  })
  ctx.renderLayerLabelsFlag = true
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

// #rrggbb of any CSS colour three.js reads ('#FFF', 'white', …)
const hexOf = (color: string) => `#${new Color(color).getHexString()}`

/** A colour that stands out against `color`: near-black on light colours,
 * white on dark ones — a label's halo, box or shadow by default, or a label's
 * colour on top of its node (Edit → Style → Contrast with node). */
export function contrastWith(color: string): string {
  return luminance(hexOf(color)) > 0.4 ? '#111111' : '#ffffff'
}

const rgba = (color: string, alpha: number) => {
  const c = new Color(color)
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alpha})`
}

// The label's top-left corner sits 7px right of and 10px above the node
// centre (renderNodeLabels); a position moves it from there, in CSS so no
// label is measured (screen.ts labelShift does the same sums for the export).
const POSITION_SHIFT: Record<LabelPosition, string> = {
  right: '',
  centre: 'translate(calc(-50% - 7px), calc(-50% + 10px))',
  above: `translate(calc(-50% - 7px), calc(-100% + ${10 - LABEL_GAP}px))`,
  below: `translate(calc(-50% - 7px), ${10 + LABEL_GAP}px)`,
}

const DARK_HALO =
  '0 0 3px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.8)'

// A node's own look wins over the label style's halo, background and weight.
// Without either, labels get a halo (DEFAULT_LABEL_LOOK): a rim against the
// text colour, so they read over nodes, edges and any theme. The halo is a
// text stroke drawn under the letters (paint-order), twice the outline's
// width since half of it hides under the fill.
function applyLook(
  div: HTMLDivElement,
  own: LabelLook | null,
  st: LabelStyle,
  text: string
): void {
  let shadow = st.halo ? DARK_HALO : ''
  let box = st.background ? 'rgba(0, 0, 0, 0.55)' : ''
  let stroke = ''
  const look = own ?? (st.halo || st.background ? null : DEFAULT_LABEL_LOOK)
  if (look) {
    const other = look.color || contrastWith(text)
    shadow =
      look.style === 'shadow'
        ? `0 1px 2px ${rgba(other, 0.9)}, 0 2px 6px ${rgba(other, 0.7)}`
        : ''
    box = look.style === 'box' ? rgba(other, look.opacity) : ''
    stroke = look.style === 'halo' ? `${look.width * 2}px ${other}` : ''
  }
  div.style.fontWeight = look?.bold ? 'bold' : (st.weight ?? '')
  div.style.textShadow = shadow
  div.style.setProperty('-webkit-text-stroke', stroke)
  div.style.setProperty('paint-order', stroke ? 'stroke fill' : '')
  div.style.strokeLinejoin = stroke ? 'round' : ''
  div.style.background = box
  div.style.padding = box ? '0 0.3em' : ''
  div.style.borderRadius = box ? '0.4em' : ''
  // read back by the image export (actions/screen.ts)
  div.dataset.shadow = shadow
    ? look?.style === 'shadow'
      ? look.color || contrastWith(text)
      : '#000000'
    : ''
}

export function restyleNodeLabels(): void {
  nodeLabelsDivs.forEach((div, i) => {
    const node = ctx.nodeObjects[i]
    const layer = ctx.nodeGroups[ctx.nodeLayerNames[i]]
    const st: LabelStyle = { ...labelStyles['*'], ...labelStyles[layer] }
    if (node) div.textContent = node.getLabel()
    const text = node?.labelColor || (st.color ?? ctx.labelColor)
    div.style.color = text
    const size = node?.labelSize || st.size
    div.style.fontSize = size ? `${size}px` : NODE_LABEL_DEFAULT_SIZE
    div.style.fontStyle = st.italic ? 'italic' : ''
    div.style.fontFamily = st.font ? FONTS[st.font] : ''
    applyLook(div, node?.labelLook ?? null, st, text)
    const position = node?.labelPosition ?? 'right'
    div.style.transform = POSITION_SHIFT[position]
    div.dataset.pos = position
    div.style.opacity = st.opacity !== undefined ? String(st.opacity) : ''
  })
}
