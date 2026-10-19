// Layer containers in the scene: nodes placed inside a layer's container (or
// on its surface) — after a layout, when the container changes, when nodes
// are fitted back in — and the container options kept in sessions. The
// shapes' own maths is three/containers.ts.

import type { LayoutPosition, SessionLayer } from '../api/client'
import { ctx } from '../three'
import {
  DEFAULT_CONTAINER_LOOK,
  type ContainerLook,
  type Layer,
} from '../three/Layer'
import {
  CONTAINERS,
  clampBox,
  isVolume,
  placeInContainer,
  toBox,
  type ContainerPlacement,
  type LayerContainer,
  type V3,
} from '../three/containers'

// Every edge counts, as for Lift nodes by degree.
export function nodeDegrees(): Map<string, number> {
  const degree = new Map<string, number>()
  for (const e of ctx.edgeObjects)
    for (const i of [e.sourceNodeIndex, e.targetNodeIndex]) {
      const name = ctx.nodeLayerNames[i]
      if (name !== undefined) degree.set(name, (degree.get(name) ?? 0) + 1)
    }
  return degree
}

export interface ContainerTarget {
  kind: LayerContainer
  placement: ContainerPlacement
}

// One layer's nodes ([y, z, x?] in the layer's frame) into a container.
// `from` is where they are now: 'box' for a fresh layout spread over the
// container's box, or the container they sit in (mapped back to the box
// first, so the layout keeps its structure). 2D positions stay 2D when the
// shape keeps them on the floor's plane.
export function placeLayerNodes(
  layer: Layer,
  positions: Record<string, LayoutPosition>,
  target: ContainerTarget = {
    kind: layer.container,
    placement: layer.containerPlacement,
  },
  from: LayerContainer | 'box' = 'box'
): Record<string, LayoutPosition> {
  const kind = target.kind
  if (!isVolume(kind)) return positions
  const r = layer.containerRadius()
  const names = Object.keys(positions)
  if (names.length === 0 || r <= 0) return positions
  const boxed = names.map((n): V3 => {
    const [y, z, x = 0] = positions[n]
    const p: V3 = [x / r, y / r, z / r]
    return from === 'box' ? clampBox(p) : toBox(from, p)
  })
  const degree = CONTAINERS[kind].tiers ? nodeDegrees() : null
  const placed = placeInContainer(kind, boxed, {
    mode: target.placement,
    values: degree ? names.map((n) => degree.get(n) ?? 0) : undefined,
    keys: names,
  })
  const out: Record<string, LayoutPosition> = {}
  names.forEach((n, i) => {
    const [x, y, z] = placed[i]
    const flat = positions[n][2] === undefined && Math.abs(x) < 1e-9
    out[n] = flat ? [y * r, z * r] : [y * r, z * r, x * r]
  })
  return out
}

// Every volume layer's nodes among `positions` into its container: a fresh
// layout ('box'), or nodes already there fitted back in ('current': nodes
// inside stay put, those outside come in to the wall; tiers are redone).
export function placeInContainers(
  positions: Record<string, LayoutPosition>,
  from: 'box' | 'current'
): Record<string, LayoutPosition> {
  const out = { ...positions }
  for (const layer of ctx.layers) {
    if (!isVolume(layer.container)) continue
    const part = Object.fromEntries(
      Object.keys(out)
        .filter((n) => ctx.nodeGroups[n] === layer.name)
        .map((n) => [n, out[n]])
    )
    Object.assign(
      out,
      placeLayerNodes(
        layer,
        part,
        undefined,
        from === 'box' ? 'box' : layer.container
      )
    )
  }
  return out
}

// The nodes' current positions, as layouts give them ([y, z, x]).
export function currentPositions(
  layerNames?: Set<string>
): Record<string, LayoutPosition> {
  const out: Record<string, LayoutPosition> = {}
  ctx.nodeObjects.forEach((n, i) => {
    if (layerNames && !layerNames.has(n.layer)) return
    out[ctx.nodeLayerNames[i]] = [
      n.getPosition('y'),
      n.getPosition('z'),
      n.getPosition('x'),
    ]
  })
  return out
}

// ---------------------------------------------------------------- sessions
const HEX = /^#[0-9a-fA-F]{6}$/
const hexOrNull = (v: unknown) =>
  typeof v === 'string' && HEX.test(v) ? v : null
const bool = (v: unknown, fallback: boolean) =>
  typeof v === 'boolean' ? v : fallback

// A saved layer's container look and placement; older sessions (colour and
// opacity at most) get the defaults for the rest.
export function sessionContainerLook(l: Partial<SessionLayer>): {
  look: ContainerLook
  placement: ContainerPlacement
} {
  const d = DEFAULT_CONTAINER_LOOK
  const opacity = l.container_opacity
  return {
    look: {
      color: hexOrNull(l.container_color),
      opacity:
        typeof opacity === 'number' && Number.isFinite(opacity)
          ? Math.min(1, Math.max(0, opacity))
          : d.opacity,
      outline: bool(l.container_outline, d.outline),
      outlineColor: hexOrNull(l.container_outline_color),
      wireframe: bool(l.container_wireframe, d.wireframe),
      glow: bool(l.container_glow, d.glow),
      floor: bool(l.container_floor, d.floor),
    },
    placement: l.container_placement === 'surface' ? 'surface' : 'inside',
  }
}
