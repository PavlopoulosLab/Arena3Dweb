// Numeric node values (expression, scores): a table uploaded in the File
// panel, applied by name to every copy of a node; the Style panel colours
// nodes by one of its columns with a gradient and a legend.

import * as THREE from 'three'
import type { ValueTable } from '../api/client'
import { bus } from '../bus'
import { history } from '../commands/base'
import { ctx } from '../three'
import { metricColor } from '../commands/scene'
import { sequentialColor, surfaceOf, type SequentialPalette } from './palettes'
import { setLegend } from './legend'
import { nodeTargets, NodeStyleCommand, type NodeTarget } from './style'

let table: ValueTable | null = null

export function setValues(t: ValueTable | null): void {
  table = t
  bus.emit('values:loaded', { columns: t?.columns ?? [] })
}
export const valueColumns = (): string[] => table?.columns ?? []
export const valueTable = (): ValueTable | null => table

// nodes (copies) the table names
export function matchedNodes(): number {
  if (!table) return 0
  const names = new Set(table.rows.map((r) => r.node))
  return ctx.nodeObjects.filter((n) => names.has(n.name)).length
}

export interface ValueColoring {
  colored: number
  min: number
  max: number
  diverging: boolean
}

// Colour the target nodes by a column; values spanning zero get a diverging
// scale centred on zero (blue – pale – red), others the chosen ramp.
export function colorNodesByValues(
  target: NodeTarget,
  column: string,
  ramp: SequentialPalette
): ValueColoring | null {
  if (!table) return null
  const c = table.columns.indexOf(column)
  if (c < 0) return null
  const byName = new Map<string, number>()
  for (const r of table.rows) {
    const v = r.values[c]
    if (v !== null && v !== undefined) byName.set(r.node, v)
  }
  const ids = nodeTargets(target).filter((i) =>
    byName.has(ctx.nodeObjects[i].name)
  )
  if (ids.length === 0) return null
  const vals = ids.map((i) => byName.get(ctx.nodeObjects[i].name)!)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const diverging = min < 0 && max > 0
  const half = Math.max(-min, max) || 1
  const span = max - min
  const surface = surfaceOf(
    `#${ctx.renderer?.getClearColor(new THREE.Color()).getHexString() ?? '000000'}`
  )
  const colorOf = (v: number) =>
    diverging
      ? `#${metricColor(0.5 + v / (2 * half))}`
      : sequentialColor(span ? (v - min) / span : 0.5, surface, ramp)
  history.execute(
    new NodeStyleCommand(`Colour by ${column}`, ids, (i) => ({
      color: colorOf(byName.get(ctx.nodeObjects[i].name)!),
    }))
  )
  const stops = [0, 0.25, 0.5, 0.75, 1].map((t) =>
    diverging ? `#${metricColor(t)}` : sequentialColor(t, surface, ramp)
  )
  setLegend({
    title: column,
    gradient: {
      min: diverging ? -half : min,
      max: diverging ? half : max,
      stops,
    },
  })
  return { colored: ids.length, min, max, diverging }
}
