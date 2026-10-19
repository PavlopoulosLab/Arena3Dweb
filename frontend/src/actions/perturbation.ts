// Perturbation analysis (Analyze → Perturbation) — the client side of
// POST /api/perturbation/knockout and /attack: which scene objects a knockout
// touches, the network without them (Apply as a new network), the reports for
// Data Tables, the colours of "Colour by change" and the robustness chart.

import { Color } from 'three'
import { ctx } from '../three'
import type {
  AttackStrategy,
  Curve,
  GlobalMeasures,
  KnockoutResponse,
  NetworkData,
  NodeChange,
} from '../api/client'
import { CATEGORICAL, OTHER } from './palettes'
import { xyChart } from './chart'

// ---------------------------------------------------------------- scene
/** The knocked-out nodes in the scene, and the edges that go with them or
 * were removed (an edge drawn for several channels only once all of them are). */
export function affectedObjects(
  res: KnockoutResponse,
  net: NetworkData
): { nodes: number[]; edges: number[] } {
  const gone = new Set(res.removed_nodes)
  const cut = new Set(res.removed_edges)
  const rows = new Map<string, { total: number; cut: number }>()
  net.edges.forEach((e, i) => {
    const key = `${e.src}---${e.trg}`
    const r = rows.get(key) ?? { total: 0, cut: 0 }
    r.total++
    if (cut.has(i)) r.cut++
    rows.set(key, r)
  })
  const nodes = ctx.nodeLayerNames.flatMap((id, i) => (gone.has(id) ? [i] : []))
  const edges = ctx.edgeObjects.flatMap((e, i) => {
    if (gone.has(e.source) || gone.has(e.target)) return [i]
    const r = rows.get(`${e.source}---${e.target}`)
    return r && r.cut > 0 && r.cut === r.total ? [i] : []
  })
  return { nodes, edges }
}

/** The network without the knocked-out nodes (and their edges) and the
 * removed edges; layers left without nodes go too. */
export function perturbedNetwork(
  net: NetworkData,
  res: KnockoutResponse
): NetworkData {
  const gone = new Set(res.removed_nodes)
  const cut = new Set(res.removed_edges)
  const nodes = net.nodes.filter((n) => !gone.has(n.id))
  const edges = net.edges.filter(
    (e, i) => !cut.has(i) && !gone.has(e.src) && !gone.has(e.trg)
  )
  const layers = new Set(nodes.map((n) => n.layer))
  const channels = new Set(edges.map((e) => e.channel))
  return {
    nodes: nodes.map((n) => ({ ...n })),
    edges: edges.map((e) => ({ ...e })),
    layers: net.layers.filter((l) => layers.has(l)),
    channels: net.channels.filter((c) => channels.has(c)),
    warnings: [],
  }
}

// ---------------------------------------------------------------- changes
export type ChangeMeasure =
  'degree' | 'betweenness' | 'closeness' | 'propagation'
export const CHANGE_LABELS: Record<ChangeMeasure, string> = {
  degree: 'Degree',
  betweenness: 'Betweenness',
  closeness: 'Closeness',
  propagation: 'Propagation',
}

const AFTER = {
  degree: 'degree_after',
  betweenness: 'betweenness_after',
  closeness: 'closeness_after',
  propagation: 'propagation_after',
} as const

/** after − before, or null for a knocked-out node (or no propagation). */
export function change(row: NodeChange, m: ChangeMeasure): number | null {
  const before = row[m]
  const after = row[AFTER[m]]
  return before === null || after === null ? null : after - before
}

const measuresOf = (rows: NodeChange[]): ChangeMeasure[] => [
  'degree',
  'betweenness',
  'closeness',
  ...(rows.some((r) => r.propagation !== null)
    ? (['propagation'] as const)
    : []),
]

/** Most affected first: the sum, over the measures, of each node's change
 * relative to the measure's largest value; the knocked-out nodes last. */
export function mostAffected(rows: NodeChange[]): NodeChange[] {
  const measures = measuresOf(rows)
  const top = new Map(
    measures.map((m) => [
      m,
      rows.reduce((t, r) => Math.max(t, Math.abs(r[m] ?? 0)), 0) || 1,
    ])
  )
  const score = (r: NodeChange) =>
    r.removed
      ? -1
      : measures.reduce(
          (s, m) => s + Math.abs(change(r, m) ?? 0) / top.get(m)!,
          0
        )
  return rows
    .map((r) => ({ r, s: score(r) }))
    .sort((a, b) => b.s - a.s || a.r.id.localeCompare(b.r.id))
    .map(({ r }) => r)
}

// `multilayer`: per layer and whole network; else the whole network only
export function stateOf(r: NodeChange, multilayer: boolean): string {
  if (r.removed) return 'knocked out'
  if (!multilayer) return r.cut_off_whole ? 'cut off' : ''
  if (r.cut_off_layer && r.cut_off_whole)
    return 'cut off (layer and whole network)'
  if (r.cut_off_layer) return 'cut off (layer)'
  if (r.cut_off_whole) return 'cut off (whole network)'
  return ''
}

// 4 significant digits, integers as they are
const num = (v: number): number =>
  Number.isInteger(v) ? v : Number(v.toPrecision(4))

export interface Table {
  columns: string[]
  rows: (string | number)[][]
}

/** Data Tables → Knockout Nodes: every node of the analysed layers, most
 * affected first, up to `limit` rows. */
export function knockoutNodeTable(
  rows: NodeChange[],
  multilayer: boolean,
  limit = 1000
): Table {
  const measures = measuresOf(rows)
  const columns = ['Node', 'Layer', 'State']
  for (const m of measures)
    columns.push(
      CHANGE_LABELS[m],
      `${CHANGE_LABELS[m]} after`,
      `Δ ${CHANGE_LABELS[m]}`
    )
  const cell = (v: number | null) => (v === null ? '' : num(v))
  return {
    columns,
    rows: mostAffected(rows)
      .slice(0, limit)
      .map((r) => [
        r.label,
        r.layer,
        stateOf(r, multilayer),
        ...measures.flatMap((m) => [
          cell(r[m]),
          cell(r[AFTER[m]]),
          cell(change(r, m)),
        ]),
      ]),
  }
}

const MEASURE_ROWS: [keyof GlobalMeasures, string][] = [
  ['nodes', 'Nodes'],
  ['edges', 'Edges'],
  ['components', 'Connected components'],
  ['largest_component', 'Largest component (nodes)'],
  ['density', 'Density'],
  ['average_path_length', 'Average path length (largest component)'],
  ['diameter', 'Diameter (largest component)'],
  ['efficiency', 'Global efficiency'],
  ['cut_off', 'Nodes cut off from the largest component'],
]

/** Data Tables → Knockout: each global measure of each network, before and after. */
export function knockoutMeasureTable(
  before: GlobalMeasures[],
  after: GlobalMeasures[]
): Table {
  const rows: (string | number)[][] = []
  before.forEach((b, k) => {
    const a = after[k]
    for (const [key, label] of MEASURE_ROWS) {
      const x = Number(b[key])
      const y = Number(a[key])
      const pct = x === 0 ? '' : num(((y - x) / x) * 100)
      rows.push([b.name, label, num(x), num(y), num(y - x), pct])
    }
  })
  return {
    columns: ['Network', 'Measure', 'Before', 'After', 'Change', 'Change %'],
    rows,
  }
}

// ---------------------------------------------------------------- colours
// ColorBrewer RdBu: a loss is blue, no change pale, a gain red
const LOSS = new Color('#2166ac')
const NONE = new Color('#f7f7f7')
const GAIN = new Color('#b2182b')
export const CHANGE_STOPS = ['#2166ac', '#f7f7f7', '#b2182b']
export const KNOCKED_OUT_COLOR = OTHER

/** t in [−1, 1] → the diverging colour. */
export function divergingColor(t: number): string {
  const x = Math.min(1, Math.max(-1, t))
  const c = NONE.clone().lerp(x < 0 ? LOSS : GAIN, Math.abs(x))
  return `#${c.getHexString()}`
}

/** Each node's colour by its change in one measure, scaled by the largest
 * change either way; knocked-out nodes grey. */
export function changeColors(
  rows: NodeChange[],
  m: ChangeMeasure
): { colors: Map<string, string>; max: number } {
  const max = rows.reduce((t, r) => Math.max(t, Math.abs(change(r, m) ?? 0)), 0)
  const colors = new Map<string, string>()
  for (const r of rows) {
    const d = change(r, m)
    colors.set(
      r.id,
      r.removed || d === null
        ? KNOCKED_OUT_COLOR
        : divergingColor(max > 0 ? d / max : 0)
    )
  }
  return { colors, max }
}

// ---------------------------------------------------------------- curves
export type CurveMeasure = 'largest' | 'components' | 'efficiency'
export const CURVE_LABELS: Record<CurveMeasure, string> = {
  largest: 'Largest component (share of the nodes)',
  components: 'Connected components',
  efficiency: 'Global efficiency (share of the start)',
}

// the backend's name for the analysed layers together
export const WHOLE = 'Whole network'

// short, for the chart's y axis
const AXIS_LABELS: Record<CurveMeasure, string> = {
  largest: 'largest component',
  components: 'components',
  efficiency: 'efficiency (of the start)',
}

export const STRATEGY_LABELS: Record<AttackStrategy, string> = {
  random: 'random failure',
  degree: 'degree attack',
  betweenness: 'betweenness attack',
}

export interface Series {
  strategy: AttackStrategy
  recalculate: boolean
  curve: Curve
}

export const seriesLabel = (s: Series): string =>
  `${s.curve.name} · ${STRATEGY_LABELS[s.strategy]}` +
  (s.strategy === 'random'
    ? ''
    : s.recalculate
      ? ', recalculated'
      : ', ranked once')

const DASH: Record<AttackStrategy, string> = {
  random: '',
  degree: '7 4',
  betweenness: '2 3',
}

const valuesOf = (c: Curve, m: CurveMeasure): number[] | null =>
  m === 'largest' ? c.largest : m === 'components' ? c.components : c.efficiency

/** The robustness chart: the measure against the share of nodes removed, one
 * line per network and strategy (colour = network, dash = strategy; the whole
 * network heavier), the spread of the random runs as a band, the robustness R
 * in the legend. `width`: the box it is drawn in, so the text keeps its size;
 * `standalone`: light colours and a background, for the SVG download. */
export function robustnessSvg(
  series: Series[],
  m: CurveMeasure,
  { standalone = false, width = 560 } = {}
): string {
  const shown = series.filter((s) => valuesOf(s.curve, m))
  if (!shown.length)
    return `<p class="small text-secondary">${m === 'efficiency' ? 'No efficiency in these runs (tick it before running).' : 'No curves.'}</p>`
  const palette = standalone ? CATEGORICAL.light : CATEGORICAL.dark
  const names = [...new Set(shown.map((s) => s.curve.name))]
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const fmtY = m === 'components' ? (v: number) => String(Math.round(v)) : pct
  const xMax = Math.max(...shown.map((s) => s.curve.fraction.at(-1) ?? 0)) || 1
  return xyChart(
    shown.map(({ curve: c, ...s }) => {
      const label = seriesLabel({ ...s, curve: c })
      const ys = valuesOf(c, m)!
      const sd = m === 'largest' ? c.largest_sd : null
      return {
        label,
        legend: `${label} — R = ${c.robustness.toFixed(3)}${c.complete ? '' : ' (stopped early)'}`,
        color: palette[names.indexOf(c.name)] ?? OTHER,
        kind: 'line' as const,
        x: c.fraction,
        y: ys,
        dash: DASH[s.strategy] || undefined,
        width: c.name === WHOLE ? 2.6 : 1.6,
        band: sd
          ? {
              lo: ys.map((v, i) => Math.max(0, v - sd[i])),
              hi: ys.map((v, i) => Math.min(1, v + sd[i])),
            }
          : undefined,
        tips: c.fraction.map(
          (f, i) =>
            `${label}: ${pct(f)} removed → ${fmtY(ys[i])}${m === 'components' ? ' components' : ''}`
        ),
      }
    }),
    { label: 'share of the nodes removed', min: 0, max: xMax, format: pct },
    {
      label: AXIS_LABELS[m],
      min: 0,
      max: m === 'components' ? undefined : 1,
      format: fmtY,
    },
    {
      standalone,
      width,
      aria: `${CURVE_LABELS[m]} against the share of the nodes removed`,
    }
  )
}

/** Every point of every curve, for Data Tables and the CSV download. */
export function robustnessTable(series: Series[]): Table {
  const rows: (string | number)[][] = []
  for (const s of series) {
    const c = s.curve
    c.fraction.forEach((f, i) =>
      rows.push([
        c.name,
        STRATEGY_LABELS[s.strategy],
        s.strategy === 'random' ? '' : s.recalculate ? 'recalculated' : 'once',
        num(f),
        Math.round(f * c.nodes),
        num(c.largest[i]),
        c.largest_sd ? num(c.largest_sd[i]) : '',
        num(c.components[i]),
        c.efficiency ? num(c.efficiency[i]) : '',
        num(c.robustness),
      ])
    )
  }
  return {
    columns: [
      'Network',
      'Strategy',
      'Ranking',
      'Fraction removed',
      'Nodes removed',
      'Largest component',
      'Largest component SD',
      'Components',
      'Efficiency',
      'Robustness R',
    ],
    rows,
  }
}

export function toCsv({ columns, rows }: Table): string {
  const q = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns, ...rows].map((r) => r.map(q).join(',')).join('\n')
}
