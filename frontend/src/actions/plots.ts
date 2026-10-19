// Analyze → Plots: each plot type built from its data — the chart (actions/
// chart.ts), the plotted numbers as a table (CSV), summary statistics, and
// what a click on a bar, a point or a row selects. The panel (ui/plots.ts)
// fetches the data and draws; everything here is pure.

import type { GraphStats } from '../api/client'
import {
  boxViolinSvg,
  fmtNum,
  heatmapSvg,
  rankingSvg,
  smallMultiplesSvg,
  xyChart,
  type Series as ChartSeries,
} from './chart'
import {
  ecdf,
  histogram,
  kde,
  pearson,
  powerLawFit,
  spearman,
  summary,
  type Summary,
} from './plot_math'
import { divergingColor, type Table } from './perturbation'

/** One set of values: a layer, the whole network, a channel. `ids` (node
 * ids, parallel to `values`) let a click select the nodes behind a bar. */
export interface Group {
  name: string
  color: string
  values: number[]
  ids?: string[]
}

export interface StatRow extends Summary {
  name: string
}

export interface Built {
  svg: (o: { width: number; standalone: boolean }) => string
  table: Table
  stats?: StatRow[]
  picks: Map<string, string[]> // data-key -> node ids
  note?: string
}

const r4 = (v: number) =>
  Number.isFinite(v) ? Number(v.toPrecision(4)) : ('' as const)

export const statsOf = (groups: Group[]): StatRow[] =>
  groups.map((g) => ({ name: g.name, ...summary(g.values) }))

// ---------------------------------------------------------------- distributions
/** Bars per group on shared bins (counts), the groups side by side in each
 * bin so every bar can be clicked; a click selects a bin's nodes. */
export function histogramPlot(
  groups: Group[],
  label: string,
  { bins, width }: { bins?: number; width?: number } = {}
): Built {
  const all = groups.flatMap((g) => g.values)
  const edges = histogram(all, { bins, width })
  const w = edges.length ? edges[0].x1 - edges[0].x0 : 1
  const lo = edges.length ? edges[0].x0 : 0
  const picks = new Map<string, string[]>()
  const rows: (string | number)[][] = []
  const series: ChartSeries[] = groups.map((g, k) => {
    const counts = edges.map(() => 0)
    const members: string[][] = edges.map(() => [])
    g.values.forEach((v, i) => {
      const b = Math.min(edges.length - 1, Math.floor((v - lo) / w))
      counts[b]++
      if (g.ids) members[b].push(g.ids[i])
    })
    const keys = edges.map((_, b) => `h${k}:${b}`)
    keys.forEach((key, b) => members[b].length && picks.set(key, members[b]))
    edges.forEach((e, b) => rows.push([g.name, r4(e.x0), r4(e.x1), counts[b]]))
    const n = groups.length
    return {
      label: g.name,
      color: g.color,
      kind: 'bars',
      x: edges.map((e) => e.x0 + (w * k) / n),
      x1: edges.map((e) => e.x0 + (w * (k + 1)) / n),
      y: counts,
      keys: g.ids ? keys : undefined,
      tips: edges.map(
        (e, b) =>
          `${g.name}: ${fmtNum(e.x0)}–${fmtNum(e.x1)}: ${counts[b]}${g.ids ? ' (click to select)' : ''}`
      ),
    }
  })
  return {
    svg: (o) => xyChart(series, { label }, { label: 'count' }, o),
    table: { columns: ['Group', 'From', 'To', 'Count'], rows },
    stats: statsOf(groups),
    picks,
  }
}

/** A kernel density curve per group (Gaussian, Silverman's bandwidth). */
export function densityPlot(groups: Group[], label: string): Built {
  const rows: (string | number)[][] = []
  const series: ChartSeries[] = groups
    .filter((g) => g.values.length > 1)
    .map((g) => {
      const d = kde(g.values)
      d.x.forEach((x, i) => rows.push([g.name, r4(x), r4(d.y[i])]))
      return { label: g.name, color: g.color, kind: 'line', x: d.x, y: d.y }
    })
  return {
    svg: (o) =>
      xyChart(
        series,
        { label },
        { label: 'density', min: 0 },
        {
          ...o,
          empty: 'A density needs at least two values.',
        }
      ),
    table: { columns: ['Group', label, 'Density'], rows },
    stats: statsOf(groups),
    picks: new Map(),
  }
}

/** The empirical CDF, P(X ≤ x), or CCDF, P(X ≥ x), as steps. */
export function cdfPlot(
  groups: Group[],
  label: string,
  { ccdf = false, log = false } = {}
): Built {
  const rows: (string | number)[][] = []
  const series: ChartSeries[] = groups.map((g) => {
    const c = ecdf(g.values, ccdf)
    c.x.forEach((x, i) => rows.push([g.name, r4(x), r4(c.y[i])]))
    return { label: g.name, color: g.color, kind: 'step', x: c.x, y: c.y }
  })
  const scale = log ? ('log' as const) : ('linear' as const)
  return {
    svg: (o) =>
      xyChart(
        series,
        { label, scale },
        {
          label: ccdf ? 'P(X ≥ x)' : 'P(X ≤ x)',
          scale,
          min: log ? undefined : 0,
          max: 1,
        },
        o
      ),
    table: { columns: ['Group', label, ccdf ? 'P(X ≥ x)' : 'P(X ≤ x)'], rows },
    stats: statsOf(groups),
    picks: new Map(),
  }
}

/** P(k) on log–log axes: the share of values equal to k (whole numbers) or
 * per logarithmic bin, with an optional power-law fit per group. */
export function logLogPlot(
  groups: Group[],
  label: string,
  { fit = false, kMin = 1 } = {}
): Built {
  const rows: (string | number)[][] = []
  const corner: string[] = []
  const picks = new Map<string, string[]>()
  const series: ChartSeries[] = []
  groups.forEach((g, k) => {
    const pos = g.values.map((v, i) => [v, i] as const).filter(([v]) => v > 0)
    if (!pos.length) return
    const whole = pos.every(([v]) => Number.isInteger(v))
    const bins = new Map<number, number[]>()
    for (const [v, i] of pos) {
      const key = whole ? v : 10 ** (Math.floor(Math.log10(v) * 10) / 10)
      const at = bins.get(key)
      if (at) at.push(i)
      else bins.set(key, [i])
    }
    const xs = [...bins.keys()].sort((a, b) => a - b)
    const n = g.values.length
    const ys = xs.map((x) => {
      const share = bins.get(x)!.length / n
      return whole ? share : share / (x * (10 ** 0.1 - 1)) // per unit width
    })
    const keys = xs.map((_, j) => `l${k}:${j}`)
    if (g.ids)
      xs.forEach((x, j) =>
        picks.set(
          keys[j],
          bins.get(x)!.map((i) => g.ids![i])
        )
      )
    xs.forEach((x, j) => rows.push([g.name, r4(x), r4(ys[j])]))
    series.push({
      label: g.name,
      color: g.color,
      kind: 'points',
      x: xs,
      y: ys,
      keys: g.ids ? keys : undefined,
      tips: xs.map((x, j) => `${g.name}: ${fmtNum(x)} → ${fmtNum(ys[j])}`),
    })
    const f = fit && whole ? powerLawFit(g.values, kMin) : null
    if (f) {
      // P(k) ≈ (γ − 1)/kMin · (k/kMin)^−γ over the tail's share of the nodes
      const share = f.n / n
      const kMax = xs[xs.length - 1]
      const fx = [f.kMin, kMax].filter((v, i, a) => a.indexOf(v) === i)
      series.push({
        label: `${g.name}: power law`,
        legend: `${g.name}: fit γ = ${f.gamma.toFixed(2)}`,
        color: g.color,
        kind: 'line',
        dash: '6 4',
        width: 1.5,
        x: fx,
        y: fx.map(
          (x) => ((share * (f.gamma - 1)) / f.kMin) * (x / f.kMin) ** -f.gamma
        ),
      })
      corner.push(
        `${g.name}: γ = ${f.gamma.toFixed(2)} (k ≥ ${f.kMin}, n = ${f.n})`
      )
    }
  })
  return {
    svg: (o) =>
      xyChart(
        series,
        { label, scale: 'log' },
        { label: 'P(k)', scale: 'log' },
        { ...o, corner, empty: 'No positive values to draw on log axes.' }
      ),
    table: { columns: ['Group', label, 'P'], rows },
    stats: statsOf(groups),
    picks,
    note: fit
      ? 'Power law: a simple maximum-likelihood fit above k_min (Clauset et al. 2009), without a goodness-of-fit test; a straight line on log–log axes is not proof of a power law.'
      : undefined,
  }
}

/** Box and violin per group, side by side. */
export function boxPlot(
  groups: Group[],
  label: string,
  { log = false, violin = true } = {}
): Built {
  const picks = new Map<string, string[]>()
  groups.forEach((g, k) => g.ids && picks.set(`b${k}`, g.ids))
  return {
    svg: (o) =>
      boxViolinSvg(
        groups.map((g, k) => ({
          label: g.name,
          color: g.color,
          values: g.values,
          key: g.ids ? `b${k}` : undefined,
        })),
        { label, scale: log ? 'log' : 'linear' },
        { ...o, violin }
      ),
    table: {
      columns: ['Group', 'n', 'Mean', 'Median', 'SD', 'Min', 'Max'],
      rows: statsOf(groups).map((s) => [
        s.name,
        s.n,
        r4(s.mean),
        r4(s.median),
        r4(s.sd),
        r4(s.min),
        r4(s.max),
      ]),
    },
    stats: statsOf(groups),
    picks,
  }
}

// ---------------------------------------------------------------- relations
export interface ScatterGroup {
  name: string
  color: string
  x: number[]
  y: number[]
  ids: string[]
  labels: string[]
}

/** One point per node, metric against metric; the correlations in the corner. */
export function scatterPlot(
  groups: ScatterGroup[],
  xLabel: string,
  yLabel: string,
  { log = false } = {}
): Built {
  const keep = (v: number) => Number.isFinite(v) && (!log || v > 0)
  const rows: (string | number)[][] = []
  const picks = new Map<string, string[]>()
  const xs: number[] = []
  const ys: number[] = []
  const series: ChartSeries[] = groups.map((g) => {
    const idx = g.x.map((_, i) => i).filter((i) => keep(g.x[i]) && keep(g.y[i]))
    for (const i of idx) {
      picks.set(g.ids[i], [g.ids[i]])
      rows.push([g.labels[i], g.name, r4(g.x[i]), r4(g.y[i])])
      xs.push(g.x[i])
      ys.push(g.y[i])
    }
    return {
      label: g.name,
      color: g.color,
      kind: 'points',
      x: idx.map((i) => g.x[i]),
      y: idx.map((i) => g.y[i]),
      keys: idx.map((i) => g.ids[i]),
      tips: idx.map(
        (i) =>
          `${g.labels[i]} (${g.name}): ${fmtNum(g.x[i])}, ${fmtNum(g.y[i])}`
      ),
    }
  })
  const corner =
    xs.length > 2
      ? [
          `Pearson r = ${fmtNum(pearson(xs, ys))}`,
          `Spearman ρ = ${fmtNum(spearman(xs, ys))}`,
          `n = ${xs.length}`,
        ]
      : []
  const scale = log ? ('log' as const) : ('linear' as const)
  return {
    svg: (o) =>
      xyChart(
        series,
        { label: xLabel, scale },
        { label: yLabel, scale },
        {
          ...o,
          corner,
        }
      ),
    table: { columns: ['Node', 'Group', xLabel, yLabel], rows },
    picks,
    note: log ? 'Log axes leave out zeros and negative values.' : undefined,
  }
}

/** Spearman rank correlations between every pair of metrics. */
export function correlationPlot(names: string[], columns: number[][]): Built {
  const m = names.map((_, i) =>
    names.map((__, j) => {
      const v = i === j ? 1 : spearman(columns[i], columns[j])
      return Number.isFinite(v) ? v : null
    })
  )
  return {
    svg: (o) =>
      heatmapSvg(names, m, divergingColor, {
        ...o,
        aria: 'Spearman correlations between the metrics',
      }),
    table: {
      columns: ['Metric', ...names],
      rows: names.map((n, i) => [
        n,
        ...m[i].map((v) => (v === null ? '' : r4(v))),
      ]),
    },
    picks: new Map(),
    note: 'Spearman rank correlations over the nodes of the graphs shown: 1 when two metrics order the nodes alike, −1 when they order them in reverse.',
  }
}

export interface CurveGroup {
  name: string
  color: string
  points: [number, number][]
  dash?: string
}

/** Curves against degree: C(k), knn(k), the rich-club coefficient. */
export function curvePlot(
  groups: CurveGroup[],
  xLabel: string,
  yLabel: string,
  { log = false, reference }: { log?: boolean; reference?: number } = {}
): Built {
  const rows: (string | number)[][] = []
  const series: ChartSeries[] = groups.map((g) => {
    g.points.forEach(([x, y]) => rows.push([g.name, x, r4(y)]))
    return {
      label: g.name,
      color: g.color,
      kind: 'line',
      dash: g.dash,
      x: g.points.map((p) => p[0]),
      y: g.points.map((p) => p[1]),
      tips: g.points.map(
        ([x, y]) => `${g.name}: ${xLabel} ${x} → ${fmtNum(y)}`
      ),
    }
  })
  if (reference !== undefined && series.some((s) => s.x.length)) {
    const xs = series.flatMap((s) => s.x)
    series.push({
      label: 'reference',
      legend: `${fmtNum(reference)}: as on a random graph with the same degrees`,
      color: '#8a8a86',
      kind: 'line',
      dash: '2 3',
      width: 1,
      x: [Math.min(...xs), Math.max(...xs)],
      y: [reference, reference],
    })
  }
  const scale = log ? ('log' as const) : ('linear' as const)
  const zeros =
    log && groups.some((g) => g.points.some(([x, y]) => x <= 0 || y <= 0))
  return {
    svg: (o) =>
      xyChart(
        series,
        { label: xLabel, scale },
        { label: yLabel, scale },
        {
          ...o,
          empty: log ? 'Nothing above zero to draw on log axes.' : undefined,
        }
      ),
    table: { columns: ['Group', xLabel, yLabel], rows },
    picks: new Map(),
    note: zeros
      ? 'Log axes leave out zeros (a layer without triangles has C(k) = 0 throughout): untick Log axes to see them.'
      : undefined,
  }
}

/** Nodes per k-core shell, a bar per group side by side; a click selects
 * the shell's nodes. */
export function shellsPlot(groups: Group[]): Built {
  const shells = [...new Set(groups.flatMap((g) => g.values))].sort(
    (a, b) => a - b
  )
  const picks = new Map<string, string[]>()
  const rows: (string | number)[][] = []
  const n = Math.max(1, groups.length)
  const series: ChartSeries[] = groups.map((g, k) => {
    const counts = shells.map(() => 0)
    const members: string[][] = shells.map(() => [])
    g.values.forEach((v, i) => {
      const s = shells.indexOf(v)
      counts[s]++
      if (g.ids) members[s].push(g.ids[i])
    })
    const keys = shells.map((_, s) => `k${k}:${s}`)
    keys.forEach((key, s) => members[s].length && picks.set(key, members[s]))
    shells.forEach((sh, s) => rows.push([g.name, sh, counts[s]]))
    return {
      label: g.name,
      color: g.color,
      kind: 'bars',
      x: shells.map((sh) => sh - 0.45 + (0.9 * k) / n),
      x1: shells.map((sh) => sh - 0.45 + (0.9 * (k + 1)) / n),
      y: counts,
      keys: g.ids ? keys : undefined,
      tips: shells.map((sh, s) => `${g.name}: shell ${sh}: ${counts[s]} nodes`),
    }
  })
  return {
    svg: (o) =>
      xyChart(
        series.map((s) => ({ ...s })),
        {
          label: 'k-core shell (coreness)',
          format: (v) => (Number.isInteger(v) ? String(v) : ''),
        },
        { label: 'nodes' },
        o
      ),
    table: { columns: ['Group', 'Shell', 'Nodes'], rows },
    picks,
  }
}

export interface RankInput {
  label: string // node name
  ids: string[] // its copies
  values: Map<string, number> // layer -> value
}

/** The top `n` names by their best value in any layer, with their rank in
 * every layer as dots. */
export function rankingPlot(
  nodes: RankInput[],
  layers: { name: string; color: string }[],
  metric: string,
  n = 20
): Built {
  const best = (r: RankInput) => Math.max(...r.values.values())
  const rankIn = new Map<string, Map<string, number>>()
  let maxRank = 1
  for (const l of layers) {
    const order = nodes
      .filter((r) => r.values.has(l.name))
      .sort((a, b) => b.values.get(l.name)! - a.values.get(l.name)!)
    maxRank = Math.max(maxRank, order.length)
    rankIn.set(l.name, new Map(order.map((r, i) => [r.label, i + 1])))
  }
  const top = nodes
    .filter((r) => r.values.size)
    .sort((a, b) => best(b) - best(a))
    .slice(0, n)
  const picks = new Map(top.map((r) => [`r:${r.label}`, r.ids]))
  const rows = top.map((r) => ({
    label: r.label,
    value: best(r),
    key: `r:${r.label}`,
    marks: layers.map((l) => ({
      label: l.name,
      color: l.color,
      rank: rankIn.get(l.name)!.get(r.label) ?? null,
    })),
  }))
  return {
    svg: (o) => rankingSvg(rows, `${metric} (best layer)`, maxRank, o),
    table: {
      columns: [
        'Node',
        `${metric} (best layer)`,
        ...layers.map((l) => `Rank in ${l.name}`),
      ],
      rows: rows.map((r) => [
        r.label,
        r4(r.value),
        ...r.marks.map((m) => (m.rank === null ? '' : m.rank)),
      ]),
    },
    picks,
    note: 'Bars: each node’s highest value in any layer; dots: its rank in each layer (1 = the top node there).',
  }
}

const PROFILE: [keyof GraphStats, string][] = [
  ['density', 'Density'],
  ['average_degree', 'Average degree'],
  ['average_clustering', 'Average clustering'],
  ['transitivity', 'Transitivity'],
  ['average_path_length', 'Average path length'],
  ['diameter', 'Diameter'],
  ['components', 'Components'],
  ['assortativity', 'Degree assortativity'],
]

/** The layers (and the whole network) over the global statistics. */
export function profilesPlot(
  stats: GraphStats[],
  colorOf: (name: string) => string
): Built {
  const panels = PROFILE.map(([key, title]) => ({
    title,
    bars: stats.map((s) => ({
      label: s.name,
      color: colorOf(s.name),
      value: s[key] as number | null,
    })),
  }))
  return {
    svg: (o) => smallMultiplesSvg(panels, o),
    table: {
      columns: ['Statistic', ...stats.map((s) => s.name)],
      rows: PROFILE.map(([key, title]) => [
        title,
        ...stats.map((s) => {
          const v = s[key] as number | null
          return v === null ? '' : r4(v)
        }),
      ]),
    },
    picks: new Map(),
  }
}

/** Distances between nodes as values (pairs per hop count), thinned to at
 * most `cap` values with the same shape. */
export function pathValues(
  counts: Record<string, number>,
  cap = 200_000
): { values: number[]; thinned: boolean } {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const f = total > cap ? cap / total : 1
  const values: number[] = []
  for (const [d, c] of Object.entries(counts))
    for (let i = 0, k = Math.max(c ? 1 : 0, Math.round(c * f)); i < k; i++)
      values.push(Number(d))
  return { values, thinned: f < 1 }
}
