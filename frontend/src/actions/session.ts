// Session export — port of v2 convertSessionToJSON (functions/input.R) fed by
// rshiny_update.js. Assembles the export dict from live ctx state; the backend
// (/api/session/export) just packages it with a download header. Import lives
// in network.ts (buildFromSession). File-panel upload/download wiring is
// Phase 13.

import { Color } from 'three'
import { api, type SessionData } from '../api/client'
import { store } from '../store'
import { ctx } from '../three'
import { annotationView } from './annotations'
import { themeState } from './themes'
import { nodeLabelState } from './node'
import { network3dSessionState } from './modes'
import { activeSlot } from './workspace'
import type { Edge } from '../three/Edge'
import type { Node } from '../three/Node'
import type { Layer } from '../three/Layer'

// Edit → Style per-node / per-edge style, only what differs from the default
// so sessions stay small
function nodeStyleFields(n: Node): Partial<SessionData['nodes'][number]> {
  return {
    ...(n.alpha !== 1 ? { opacity: n.alpha } : {}),
    ...(n.borderWidth > 0
      ? { border_color: n.borderColor, border_width: n.borderWidth }
      : {}),
    ...(n.stretch.some((v) => v !== 1) ? { stretch: [...n.stretch] } : {}),
    ...(n.label ? { label: n.label } : {}),
    ...(n.labelColor ? { label_color: n.labelColor } : {}),
    ...(n.labelSize ? { label_size: n.labelSize } : {}),
    ...(n.labelLook ? { label_style: { ...n.labelLook } } : {}),
    ...(n.labelPosition !== 'right' ? { label_position: n.labelPosition } : {}),
    ...(n.labelShown ? { label_shown: true } : {}),
  }
}

// Labels & axes: a layer label's look, only what differs from the default
function layerLabelFields(l: Layer): Partial<SessionData['layers'][number]> {
  return {
    ...(l.labelLook ? { label_style: { ...l.labelLook } } : {}),
    ...(l.labelFont ? { label_font: l.labelFont } : {}),
    ...(l.labelBold ? { label_bold: true } : {}),
    ...(l.labelItalic ? { label_italic: true } : {}),
    ...(l.labelColor ? { label_color: l.labelColor } : {}),
    ...(l.labelPosition !== 'corner'
      ? { label_position: l.labelPosition }
      : {}),
  }
}

function edgeStyleFields(e: Edge): Partial<SessionData['edges'][number]> {
  return {
    ...(e.opacityFactor !== 1 ? { opacity_factor: e.opacityFactor } : {}),
    ...(e.lineType !== 'solid' ? { line_type: e.lineType } : {}),
    ...(e.arrowColor ? { arrow_color: e.arrowColor } : {}),
  }
}

// v2 collected scene/layers/nodes/edges through the Shiny bridge; here we read
// the Three.js objects directly. Values are numbers (v2 stringified them via
// JSON; the importer coerces with Number(), so either is fine).
export function collectSession(): SessionData {
  const color = ctx.renderer
    ? `#${ctx.renderer.getClearColor(new Color()).getHexString()}`
    : '#000000'

  const layered = network3dSessionState()
  return {
    scene: {
      position_x: ctx.scene?.getPosition('x') ?? 0,
      position_y: ctx.scene?.getPosition('y') ?? 0,
      scale: ctx.scene?.getScale() ?? 1,
      color,
      rotation_x: ctx.scene?.getRotation('x') ?? 0,
      rotation_y: ctx.scene?.getRotation('y') ?? 0,
      rotation_z: ctx.scene?.getRotation('z') ?? 0,
    },
    layers: ctx.layers.map((l, i) => ({
      name: l.getName(),
      position_x: l.getPosition('x'),
      position_y: l.getPosition('y'),
      position_z: l.getPosition('z'),
      last_layer_scale: l.getScale(),
      rotation_x: l.getRotation('x'),
      rotation_y: l.getRotation('y'),
      rotation_z: l.getRotation('z'),
      floor_current_color: l.getColor(),
      geometry_parameters_width: l.getWidth(),
      floor_shape: l.floorShape,
      floor_style: l.floorStyle,
      container: l.container,
      floor_visible: l.floorVisible,
      container_color: l.containerColor,
      container_opacity: l.containerOpacity,
      container_placement: l.containerPlacement,
      container_outline: l.containerOutline,
      container_outline_color: l.containerOutlineColor,
      container_wireframe: l.containerWireframe,
      container_glow: l.containerGlow,
      container_floor: l.containerFloor,
      ...layerLabelFields(l),
      ...(layered?.layers[i] ? { layered: layered.layers[i] } : {}),
      generate_coordinates: false,
    })),
    nodes: ctx.nodeObjects.map((n, i) => ({
      name: n.getName(),
      layer: n.getLayer(),
      position_x: n.getPosition('x'),
      position_y: n.getPosition('y'),
      position_z: n.getPosition('z'),
      scale: n.getScale(),
      color: n.getColor(),
      url: n.url,
      descr: n.descr,
      annotations: n.annotations,
      shape: n.shape,
      ...nodeStyleFields(n),
      ...(layered?.nodes[ctx.nodeLayerNames[i]]
        ? { layered_position: layered.nodes[ctx.nodeLayerNames[i]] }
        : {}),
    })),
    edges: collectEdges(),
    universalLabelColor: ctx.labelColor,
    direction: ctx.isDirectionEnabled,
    arrowLayers: ctx.arrowLayers,
    interLayerArrows: ctx.interLayerArrows,
    edgeOpacityByWeight: ctx.edgeOpacityByWeight,
    edgeWidthByWeight: ctx.edgeWidthByWeight,
    scramble_nodes: false,
    intraEdgeBundling: ctx.intraEdgeBundling,
    interEdgeBundling: ctx.interEdgeBundling,
    edgeShape: ctx.edgeShape,
    hive: ctx.hive,
    annotationView: annotationView(),
    theme: themeState(),
    nodeLabels: nodeLabelState(),
    ...namesOnScreen(),
  }
}

// the network's name and its annotation set's name, so a reload keeps them
function namesOnScreen(): Pick<SessionData, 'name' | 'annotationSet'> {
  const slot = activeSlot()
  if (!slot) return {}
  const set = slot.annotationSets[slot.activeSet]
  return { name: slot.name, ...(set ? { annotationSet: set.name } : {}) }
}

// v2 updateEdgesRShiny + updateEdgeColorsRShiny: one export row per channel
// (or a single channel-less row), color resolved with forExport=true.
function collectEdges(): SessionData['edges'] {
  const rows: SessionData['edges'] = []
  for (const edge of ctx.edgeObjects) {
    if (edge.channels.length > 0) {
      edge.channels.forEach((channel, j) => {
        rows.push({
          src: edge.source,
          trg: edge.target,
          opacity: edge.weights[j],
          color: edge.decideColor(j, true),
          channel,
          width_factor: edge.widthFactor,
          ...edgeStyleFields(edge),
        })
      })
    } else {
      rows.push({
        src: edge.source,
        trg: edge.target,
        opacity: edge.weights[0],
        color: edge.decideColor(0, true),
        width_factor: edge.widthFactor,
        ...edgeStyleFields(edge),
      })
    }
  }
  return rows
}

// Named as v2's download: POST the assembled session, trigger a file save.
export async function exportSession(filename = 'network.json'): Promise<void> {
  if (!store.get().network) throw new Error('No network to export.')
  const blob = await api.exportSession(collectSession())
  triggerDownload(blob, filename)
}

function triggerDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
