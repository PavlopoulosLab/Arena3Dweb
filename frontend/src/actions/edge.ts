// Port of v2 www/js/object_actions/edge.js — inter/intra-layer edge render
// machinery, channel color/visibility, and edge render settings.
// createEdgeObjects/assignChannelColorsFromPalette live in network.ts's
// build. Deferred with their phases: channel layout/edit lists + color-picker
// DOM (Phase 13 UI), edge attributes upload (POST /api/attributes),
// pause-button label (canvas_controls.ts).

import { ctx } from '../three'
import type { EdgeShape } from '../three/runtime'
import type { EdgeAttributeRow } from '../api/client'
import { LINE_TYPE_LABELS, type LineType } from '../three/Edge'

// v2 assignChannelColorsFromPalette — reassigns every known channel's color
// in insertion order (channel order from the network build).
export function assignChannelColorsFromPalette(palette: string[]): void {
  Object.keys(ctx.channelColors).forEach((channel, i) => {
    ctx.channelColors[channel] = palette[i % palette.length]
  })
}

export function redrawIntraLayerEdges(): void {
  for (const e of ctx.edgeObjects) if (!e.interLayer) e.redrawEdge()
}

export function redrawInterLayerEdges(): void {
  for (const e of ctx.edgeObjects) if (e.interLayer) e.redrawEdge()

  ctx.interEdgesRemoved = false
  // v2's locked-flag pair: redraw runs for one extra animate tick after the
  // flag was raised, then re-arms
  if (ctx.waitEdgeRenderFlag) {
    ctx.waitEdgeRenderFlag = false
  } else {
    ctx.renderInterLayerEdgesFlag = false
    ctx.waitEdgeRenderFlag = true
  }
}

// Called every animate() tick.
export function renderInterLayerEdges(): void {
  if (existsConditionToRemoveInterEdges()) {
    if (!ctx.interEdgesRemoved) removeInterLayerEdges()
  } else {
    // removed edges come back once the condition clears (a drag ended)
    if (ctx.interEdgesRemoved) ctx.renderInterLayerEdgesFlag = true
    if (ctx.renderInterLayerEdgesFlag) redrawInterLayerEdges()
  }
}

// v2 also removed the edges while ctx.scene.dragging; that made them vanish
// during every pan/orbit (where they move with the scene and need no redraw)
// and lag behind layer drags. Layer/node drags now raise
// renderInterLayerEdgesFlag per move instead, so the edges follow live; the
// render-pause button remains the escape hatch for huge networks.
function existsConditionToRemoveInterEdges(): boolean {
  return (
    ctx.interLayerEdgesRenderPauseFlag ||
    (ctx.pauseInterWhileMoving && !!ctx.scene?.dragging) ||
    (!ctx.edgeOpacityByWeight && ctx.interLayerEdgeOpacity === 0)
  )
}

function removeInterLayerEdges(): void {
  for (const e of ctx.edgeObjects)
    if (e.interLayer) ctx.scene?.remove(e.THREE_Object)
  ctx.interEdgesRemoved = true
}

// @return whether rendering is now paused (v2 toggleInterLayerEdgesRendering;
// the pause-button label is Phase 13's job)
export function toggleInterLayerEdgesRendering(): boolean {
  ctx.interLayerEdgesRenderPauseFlag = !ctx.interLayerEdgesRenderPauseFlag
  if (!ctx.interLayerEdgesRenderPauseFlag) ctx.renderInterLayerEdgesFlag = true
  return ctx.interLayerEdgesRenderPauseFlag
}

// v2 changeChannelColor minus the DOM picker element.
// Multi-channel edges: parallel lines (the default), one Bézier curve per
// channel, or one shared straight line.
export function setEdgeShape(shape: EdgeShape): void {
  ctx.edgeShape = shape
  ctx.renderInterLayerEdgesFlag = true
  redrawIntraLayerEdges()
}

export function setChannelColor(channel: string, color: string): void {
  ctx.channelColors[channel] = color
  ctx.renderInterLayerEdgesFlag = true
  redrawIntraLayerEdges()
}

// v2 toggleChannelVisibility minus the DOM checkbox (checked = hidden there;
// this takes `visible` directly). Both the curve line and its arrow carry
// userData.tag = channel, so match by tag rather than assuming a fixed
// line/arrow interleave — arrows are skipped for zero-opacity channels, which
// broke the old positional children[j+1] lookup.
export function setChannelVisibility(channel: string, visible: boolean): void {
  for (const edge of ctx.edgeObjects) {
    for (const child of edge.THREE_Object.children) {
      if (child.userData.tag === channel) child.visible = visible
    }
  }
  ctx.channelVisibility[channel] = visible
}

export function unselectAllEdges(): void {
  for (const e of ctx.edgeObjects) e.deselect()
  ctx.renderInterLayerEdgesFlag = true
  redrawIntraLayerEdges()
}

// Settings setters (v2 Shiny handlers) =====

export function toggleDirection(enabled: boolean): void {
  ctx.isDirectionEnabled = enabled
  ctx.renderInterLayerEdgesFlag = true
  redrawIntraLayerEdges()
}

// Arrowheads only in some layers (null = all) and, apart from them, on the
// links between layers: a network may mix directed and undirected layers,
// such as OmniPath signalling next to STRING interactions.
export function setArrowLayers(layers: string[] | null): void {
  ctx.arrowLayers = layers
  redrawIntraLayerEdges()
}

export function setInterLayerArrows(on: boolean): void {
  ctx.interLayerArrows = on
  ctx.renderInterLayerEdgesFlag = true
}

export function setIntraDirectionArrowSize(size: number): void {
  ctx.intraDirectionArrowSize = size
  redrawIntraLayerEdges()
}

export function setInterDirectionArrowSize(size: number): void {
  ctx.interDirectionArrowSize = size
  ctx.renderInterLayerEdgesFlag = true
}

// The Edge Actions radio always picks both flags at once, so take them
// together and redraw once rather than twice.
export function setEdgeWeightEncoding(
  byOpacity: boolean,
  byWidth: boolean
): void {
  ctx.edgeOpacityByWeight = byOpacity
  ctx.edgeWidthByWeight = byWidth
  ctx.renderInterLayerEdgesFlag = true
  redrawIntraLayerEdges()
}

export function setIntraLayerEdgeOpacity(opacity: number): void {
  ctx.intraLayerEdgeOpacity = opacity
  redrawIntraLayerEdges()
}

export function setInterLayerEdgeOpacity(opacity: number): void {
  ctx.interLayerEdgeOpacity = opacity
  ctx.renderInterLayerEdgesFlag = true
}

export function setIntraLayerEdgeWidth(width: number): void {
  ctx.intraLayerEdgeWidth = width
  redrawIntraLayerEdges()
}

export function setInterLayerEdgeWidth(width: number): void {
  ctx.interLayerEdgeWidth = width
  ctx.renderInterLayerEdgesFlag = true
}

export function setEdgeSelectedColorPriority(flag: boolean): void {
  ctx.selectedEdgeColorFlag = flag
  ctx.renderInterLayerEdgesFlag = true
  redrawIntraLayerEdges()
}

export function setEdgeFileColorPriority(flag: boolean): void {
  ctx.edgeFileColorPriority = flag
  ctx.renderInterLayerEdgesFlag = true
  redrawIntraLayerEdges()
  // v2 also showed/hid the channel color-picker div — Phase 13 UI
}

export function setIntraChannelCurvature(curvature: number): void {
  ctx.intraChannelCurvature = curvature
  redrawIntraLayerEdges()
}

export function setInterChannelCurvature(curvature: number): void {
  ctx.interChannelCurvature = curvature
  ctx.renderInterLayerEdgesFlag = true
}

// v2 edge.js setEdgeAttributes/setEdgeColorFromAttributes: recolor matching
// edges from an attribute file (per channel when given, else the first
// channel), then force loaded-edge-color priority so the colors show.
// The width, opacity, line type and arrow columns are what Edit →
// Attributes exports (per edge, so every channel row carries them).
export function applyEdgeAttributes(rows: EdgeAttributeRow[]): void {
  const pairs = new Map(
    ctx.edgeObjects.map((e, i) => [`${e.source}---${e.target}`, i])
  )
  for (const row of rows) {
    const pos = pairs.get(row.edge_pair)
    if (pos === undefined) continue // edge not in network
    const edge = ctx.edgeObjects[pos]
    const channelPos = row.channel ? edge.channels.indexOf(row.channel) : 0
    if (channelPos === -1) continue // channel not on this edge
    edge.importedColors[channelPos] = row.color
    edge.colors[channelPos] = row.color
    if (row.width != null) edge.widthFactor = row.width
    if (row.opacity != null) edge.opacityFactor = row.opacity
    if (row.line_type && row.line_type in LINE_TYPE_LABELS)
      edge.lineType = row.line_type as LineType
    if (row.arrow_color) edge.arrowColor = row.arrow_color
  }
  setEdgeFileColorPriority(true)
}
