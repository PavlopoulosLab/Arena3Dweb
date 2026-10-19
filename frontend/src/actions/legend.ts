// What the on-canvas legend shows: the colour mapping last applied — layers,
// groups (clusters/annotations), a metric or value gradient.

import { bus } from '../bus'
import { ctx } from '../three'

export interface LegendEntry {
  label: string
  color: string
  count?: number
  // what clicking the entry selects
  select?: 'layer' | 'cluster' | 'annotation'
}

export interface Legend {
  title: string
  entries?: LegendEntry[]
  gradient?: { min: number; max: number; stops: string[] }
}

let current: Legend | null = null

export const legend = (): Legend | null => current

export function setLegend(l: Legend | null): void {
  current = l
  bus.emit('legend:changed', { title: l?.title ?? null })
}

/** The colour a layer is shown with: its nodes' (as in the legend), else its floor's. */
export function layerSwatchColor(name: string): string {
  return (
    ctx.nodeObjects.find((n) => n.layer === name)?.color ??
    ctx.layers.find((l) => l.name === name)?.color ??
    '#888888'
  )
}

// The default after a load: one entry per layer, in the layer's node colour.
export function layerLegend(): Legend | null {
  if (ctx.layers.length === 0) return null
  const entries = ctx.layers.map((l) => {
    const members = ctx.nodeObjects.filter((n) => n.layer === l.name)
    return {
      label: l.name,
      color: members[0]?.color ?? l.color,
      count: members.length,
      select: 'layer' as const,
    }
  })
  return { title: 'Layers', entries }
}
