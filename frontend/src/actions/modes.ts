// 3D modes — PLAN-ROADMAP Phases 19-20.
//
// "3D network (ignore layers)": every layer is stacked on one origin with no
// floor, then one 3D layout runs over the whole network, so nodes share a
// single space (layer survives only as node colour). Turning it off restores
// the layers exactly as they were.
//
// Layer containers: 3D containers (three/containers.ts) get a per-layer 3D
// layout so their nodes fill the volume, or sit on its surface.

import * as THREE from 'three'
import { store } from '../store'
import { ctx } from '../three'
import type { ContainerPlacement, LayerContainer } from '../three/Layer'
import { VOLUME_CONTAINERS } from '../three/Layer'
import { CONTAINERS } from '../three/containers'
import { currentPositions, placeLayerNodes } from './containers'
import { history } from '../commands/base'
import type { Command } from '../commands/base'
import {
  ApplyLayoutCommand,
  ChangeContainerCommand,
  PredefinedLayoutCommand,
} from '../commands/scene'
import type { LayoutPosition } from '../api/client'
import { applyLayout, applyPredefinedLayout } from './layout'
import { redrawIntraLayerEdges } from './edge'
import { focusOnNodes } from './search'
import { showFloors } from './layer'
import { bus } from '../bus'
import type { NetworkMode } from '../three/runtime'

export type LayerState = {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  container: LayerContainer
}

export function captureLayers(): LayerState[] {
  return ctx.layers.map((l) => ({
    position: l.plane.position.clone(),
    quaternion: l.plane.quaternion.clone(),
    container: l.container,
  }))
}

function applyLayers(states: LayerState[]): void {
  states.forEach((s, i) => {
    const l = ctx.layers[i]
    if (!l) return
    l.plane.position.copy(s.position)
    l.plane.quaternion.copy(s.quaternion)
    l.setContainer(s.container)
  })
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderLayerLabelsFlag = true
  ctx.renderNodeLabelsFlag = true
}

function nodePositions(): Record<string, LayoutPosition> {
  return Object.fromEntries(
    ctx.nodeObjects.map((n, i) => [
      ctx.nodeLayerNames[i],
      [
        n.getPosition('y'),
        n.getPosition('z'),
        n.getPosition('x'),
      ] as LayoutPosition,
    ])
  )
}

// Layers stacked/unstacked as one undo step.
export class LayerStateCommand implements Command {
  constructor(
    public description: string,
    private readonly before: LayerState[],
    private readonly after: LayerState[]
  ) {}
  execute(): void {
    applyLayers(this.after)
  }
  undo(): void {
    applyLayers(this.before)
  }
}

// Saved when 3D-network mode turns on, restored when it turns off.
type SavedLayers = {
  layers: LayerState[]
  nodes: Record<string, LayoutPosition>
}
let saved: SavedLayers | null = null

export const isNetwork3d = () => saved !== null

// The stacking/unstacking step also owns the saved state, so undo and redo
// keep isNetwork3d() truthful (ui/mode.ts reconciles the switch from it).
class Network3dCommand extends LayerStateCommand {
  constructor(
    description: string,
    before: LayerState[],
    after: LayerState[],
    private readonly whenDone: SavedLayers | null,
    private readonly whenUndone: SavedLayers | null
  ) {
    super(description, before, after)
  }
  override execute(): void {
    super.execute()
    saved = this.whenDone
  }
  override undo(): void {
    super.undo()
    saved = this.whenUndone
  }
}

export async function setNetwork3d(
  on: boolean,
  algorithm = 'Fruchterman-Reingold'
): Promise<void> {
  const net = store.get().network
  if (!net || ctx.layers.length === 0) throw new Error('Load a network first.')
  if (on === isNetwork3d()) return
  if (on) {
    const state = { layers: captureLayers(), nodes: nodePositions() }
    const q = ctx.layers[0].plane.quaternion.clone()
    const stacked: LayerState[] = ctx.layers.map(() => ({
      position: new THREE.Vector3(),
      quaternion: q.clone(),
      container: 'none',
    }))
    history.execute(
      new Network3dCommand('3D network', state.layers, stacked, state, null)
    )
    // one 3D layout over all layers: they now share a single space
    await applyLayout({
      nodes: net.nodes,
      edges: net.edges,
      algorithm,
      scope: 'allLayers',
      selected_layers: net.layers,
      dimensions: 3,
    })
  } else {
    const back = saved!
    history.execute(
      new Network3dCommand(
        'Layered network',
        captureLayers(),
        back.layers,
        null,
        back
      )
    )
    history.execute(new ApplyLayoutCommand(back.nodes))
  }
  redrawIntraLayerEdges()
}

export function resetNetworkMode(): void {
  saved = null
}

// Network mode (top-bar switch). 'single' treats the data as one graph:
// several layers are stacked into one 3D space (setNetwork3d), a single layer
// just loses its floor; ui/mode.ts hides the layer-only controls.
export function networkModeFromScene(): NetworkMode {
  if (isNetwork3d()) return 'single'
  if (ctx.layers.length === 1 && !ctx.layers[0].floorVisible) return 'single'
  return 'multilayer'
}

// A switch stacks the layers before its layout returns; the reconcile below
// waits for the whole switch so the UI flips once, at the end.
let switching = false

export async function setNetworkMode(mode: NetworkMode): Promise<void> {
  if (ctx.layers.length === 0) throw new Error('Load a network first.')
  switching = true
  try {
    if (mode === 'single') {
      if (ctx.layers.length > 1) await setNetwork3d(true)
      else showFloors(false)
    } else if (isNetwork3d()) await setNetwork3d(false)
    else if (ctx.layers.length === 1) showFloors(true)
  } finally {
    switching = false
  }
  ctx.networkMode = mode
  bus.emit('mode:changed', { mode })
}

// Undo/redo stack or unstack the layers behind the flag's back; a new
// network starts in the mode its layers imply.
export function reconcileNetworkMode(): void {
  if (switching) return
  const mode = networkModeFromScene()
  if (mode === ctx.networkMode) return
  ctx.networkMode = mode
  bus.emit('mode:changed', { mode })
}

// Sessions (actions/session.ts) carry the layered state behind 3D-network
// mode, so a reloaded session can still be turned back into layers.
export type SavedLayerState = {
  position: [number, number, number]
  quaternion: [number, number, number, number]
  container: LayerContainer
}

export function network3dSessionState(): {
  layers: SavedLayerState[]
  nodes: Record<string, LayoutPosition>
} | null {
  if (!saved) return null
  return {
    layers: saved.layers.map((l) => ({
      position: l.position.toArray(),
      quaternion: l.quaternion.toArray(),
      container: l.container,
    })),
    nodes: saved.nodes,
  }
}

export function restoreNetwork3dState(
  layers: SavedLayerState[],
  nodes: Record<string, LayoutPosition>
): void {
  saved = {
    layers: layers.map((l) => ({
      position: new THREE.Vector3(...l.position),
      quaternion: new THREE.Quaternion(...l.quaternion),
      container: l.container,
    })),
    nodes,
  }
}

// Floors were spaced for flat planes; volumes are as deep as they are wide.
// If neighbouring layers (along x, as Parallel lays them out) would overlap,
// re-space them evenly along x, keeping their other coordinates. One undo step.
function spreadOverlappingVolumes(): boolean {
  const order = ctx.layers
    .map((l, i) => ({ i, x: l.plane.position.x, r: l.containerRadius() }))
    .sort((a, b) => a.x - b.x)
  const gap = 2 * Math.max(...order.map((o) => o.r)) * 1.15
  const tight = order.some((o, k) => k > 0 && o.x - order[k - 1].x < gap - 1e-6)
  if (!tight) return false
  const before = captureLayers()
  const after = captureLayers()
  order.forEach((o, k) => {
    after[o.i].position.x = (k - (order.length - 1) / 2) * gap
  })
  history.execute(new LayerStateCommand('Space out 3D layers', before, after))
  return true
}

const fitAll = () => focusOnNodes(ctx.nodeObjects.map((_, i) => i))

// What setLayerContainer did to the nodes: a new 3D layout inside, a move
// into the new shape, or nothing.
export type ContainerOutcome = 'laidOut' | 'placed' | 'unchanged'

// Switch layers to a container (and, given, inside / on the surface). Volume
// containers get a 3D layout per layer when their nodes are still flat — or
// were on a surface or in tiers, which keep no depth — so the volume is
// actually used; otherwise the nodes move from the old shape into the new one,
// keeping the layout, in the same undo step as the switch.
export async function setLayerContainer(
  layerIds: number[],
  kind: LayerContainer,
  algorithm = 'Fruchterman-Reingold',
  placement?: ContainerPlacement
): Promise<ContainerOutcome> {
  const net = store.get().network
  if (!net || layerIds.length === 0) return 'unchanged'
  const volume = VOLUME_CONTAINERS.includes(kind)
  // a hive plot's layers are axes: a volume ends it first (its own undo
  // step), bringing back the floors, the containers and the nodes it moved
  if (ctx.hive && volume)
    history.execute(
      new PredefinedLayoutCommand('parallel', () =>
        applyPredefinedLayout('parallel')
      )
    )
  const change = new ChangeContainerCommand(layerIds, kind, placement)
  if (!volume) {
    history.execute(change)
    return 'unchanged'
  }
  const layers = layerIds.map((i) => ctx.layers[i])
  const names = new Set(layers.map((l) => l.name))
  const flat = ctx.nodeObjects.every(
    (n) => !names.has(n.layer) || Math.abs(n.getPosition('x')) < 1
  )
  // a surface or tiers kept no depth: a new layout fills the new shape
  const lossy = layers.some((l) => {
    const was = CONTAINERS[l.container]
    const to = placement ?? l.containerPlacement
    return (
      (was.tiers && !CONTAINERS[kind].tiers) ||
      (was.surface &&
        l.containerPlacement === 'surface' &&
        (to === 'inside' || !CONTAINERS[kind].surface))
    )
  })
  if (flat || lossy) {
    history.execute(change)
    const spread = spreadOverlappingVolumes()
    // each layer's own layout fills its own container
    await applyLayout(
      {
        nodes: net.nodes,
        edges: net.edges,
        algorithm,
        scope: 'perLayer',
        selected_layers: [...names],
        dimensions: 3,
      },
      true
    )
    if (spread) fitAll()
    return 'laidOut'
  }
  // from the old shape into the new one, as one step with the switch
  const positions: Record<string, LayoutPosition> = {}
  for (const layer of layers)
    Object.assign(
      positions,
      placeLayerNodes(
        layer,
        currentPositions(new Set([layer.name])),
        { kind, placement: placement ?? layer.containerPlacement },
        layer.container
      )
    )
  const move = new ApplyLayoutCommand(positions)
  history.execute({
    description: change.description,
    execute: () => {
      change.execute()
      move.execute()
    },
    undo: () => {
      move.undo()
      change.undo()
    },
  })
  if (spreadOverlappingVolumes()) fitAll()
  return 'placed'
}
