// SVG charts for the Analyze panels (Plots, Perturbation): an x–y chart of
// lines, steps, points and bars on linear or log axes, a heatmap, box and
// violin groups, a ranking with dots, and small multiples. Each chart is drawn
// to the width it gets, so its text keeps its size; `standalone` gives light
// colours and a background for the downloads. Bars, points and boxes can carry
// a key (data-key, class ch-hit) that the panel turns into nodes to select.

import { kde, quantile, summary } from './plot_math'
import { safeColor } from '../utils'

export type Scale = 'linear' | 'log'

export interface Axis {
  label: string
  scale?: Scale
  min?: number
  max?: number
  format?: (v: number) => string
}

export interface Series {
  label: string
  color: string
  kind: 'line' | 'step' | 'points' | 'bars'
  x: number[]
  y: number[]
  x1?: number[] // bars: right edges (x holds the left ones)
  band?: { lo: number[]; hi: number[] } // a shaded spread around a line
  dash?: string
  width?: number
  tips?: string[] // per point or bar
  keys?: string[] // per point or bar: what a click selects
  legend?: string // the legend text, when not the label
}

export interface ChartOptions {
  width?: number
  standalone?: boolean
  corner?: string[] // lines of text in the top-right corner
  aria?: string
  empty?: string // shown when nothing can be drawn
}

// ---------------------------------------------------------------- helpers
export const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
// a colour from a file or session: a CSS colour only, escaped
const col = (c: string | undefined) => esc(safeColor(c))

/** A short number: 3 significant digits, exponents for the very large or small. */
export function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(1)
  return String(Number(v.toPrecision(3)))
}

interface Theme {
  text: string
  axis: string
  grid: string
  bg: string
}

const theme = (standalone: boolean, W: number, H: number): Theme =>
  standalone
    ? {
        text: 'fill="#333"',
        axis: 'stroke="#999"',
        grid: 'stroke="#e5e5e5"',
        bg: `<rect width="${W}" height="${H}" fill="#fff"/>`,
      }
    : {
        text: 'class="ch-text"',
        axis: 'class="ch-axis"',
        grid: 'class="ch-grid"',
        bg: '',
      }

const svgOpen = (W: number, H: number, aria: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" class="arena-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(aria)}" font-family="system-ui, sans-serif" font-size="11" style="width:100%;max-width:${W}px;height:auto">`

const widthOf = (w: number | undefined) =>
  Math.round(Math.min(720, Math.max(320, w ?? 560)))

const hit = (key: string | undefined) =>
  key === undefined ? '' : ` class="ch-hit" data-key="${esc(key)}"`

const title = (tip: string | undefined) =>
  tip ? `<title>${esc(tip)}</title>` : ''

export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (!(hi > lo)) return [lo]
  const raw = (hi - lo) / count
  const p = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((f) => f * p).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (
    let v = Math.ceil(lo / step - 1e-9) * step;
    v <= hi + step * 1e-9;
    v += step
  )
    out.push(Number(v.toPrecision(12)))
  return out
}

interface Scaled {
  at: (v: number) => number // to pixels
  ticks: number[]
  ok: (v: number) => boolean // drawable on this scale
}

function scaled(
  values: number[],
  axis: Axis,
  from: number,
  to: number,
  zero: boolean
): Scaled {
  if (axis.scale === 'log') {
    const pos = values.filter((v) => v > 0)
    const lo = axis.min ?? 10 ** Math.floor(Math.log10(Math.min(...pos, 1)))
    let hi = axis.max ?? 10 ** Math.ceil(Math.log10(Math.max(...pos, 1)))
    if (hi <= lo) hi = lo * 10
    const [a, b] = [Math.log10(lo), Math.log10(hi)]
    const ticks: number[] = []
    for (let e = Math.ceil(a - 1e-9); e <= b + 1e-9; e++) {
      ticks.push(10 ** e)
      if (b - a <= 2) ticks.push(2 * 10 ** e, 5 * 10 ** e)
    }
    return {
      at: (v) => from + ((to - from) * (Math.log10(v) - a)) / (b - a),
      ticks: ticks.filter((t) => t >= lo && t <= hi).sort((p, q) => p - q),
      ok: (v) => v > 0 && v >= lo && v <= hi,
    }
  }
  const finite = values.filter(Number.isFinite)
  let lo = axis.min ?? Math.min(...finite, zero ? 0 : Infinity)
  let hi = axis.max ?? Math.max(...finite, zero ? 0 : -Infinity)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) [lo, hi] = [0, 1]
  if (hi === lo) [lo, hi] = [lo - 0.5, hi + 0.5]
  const ticks = niceTicks(lo, hi)
  if (axis.min === undefined) lo = Math.min(lo, ticks[0])
  if (axis.max === undefined) hi = Math.max(hi, ticks[ticks.length - 1])
  return {
    at: (v) => from + ((to - from) * (v - lo)) / (hi - lo),
    ticks: ticks.filter((t) => t >= lo - 1e-9 && t <= hi + 1e-9),
    ok: Number.isFinite,
  }
}

function legendRows(
  entries: {
    text: string
    color: string
    dash?: string
    square?: boolean
    width?: number
  }[],
  x: number,
  y0: number,
  t: Theme
): string {
  return entries
    .map((e, k) => {
      const y = y0 + 18 * k
      const sw = e.square
        ? `<rect x="${x + 8}" y="${y - 5}" width="10" height="10" rx="2" fill="${col(e.color)}"/>`
        : `<line x1="${x}" x2="${x + 26}" y1="${y}" y2="${y}" stroke="${col(e.color)}" stroke-width="${e.width ?? 2}"${e.dash ? ` stroke-dasharray="${e.dash}"` : ''}/>`
      return `${sw}<text x="${x + 34}" y="${y + 4}" ${t.text}>${esc(e.text)}</text>`
    })
    .join('')
}

// ---------------------------------------------------------------- x–y
/** Lines, steps, points and bars against linear or log axes, a legend
 * below and optional notes in the top-right corner. */
export function xyChart(
  series: Series[],
  xAxis: Axis,
  yAxis: Axis,
  opts: ChartOptions = {}
): string {
  const drawn = series.filter((s) => s.x.length)
  if (!drawn.length)
    return `<p class="small text-secondary">${esc(opts.empty ?? 'Nothing to plot.')}</p>`
  const W = widthOf(opts.width)
  const plotH = Math.round(W * 0.5)
  const pad = { l: 52, r: 14, t: 12, b: 38 }
  const legend = drawn.length > 1 || drawn.some((s) => s.legend)
  const H = plotH + (legend ? 18 * drawn.length + 8 : 0)
  const t = theme(!!opts.standalone, W, H)
  const bars = drawn.some((s) => s.kind === 'bars')
  const xs = drawn.flatMap((s) => [...s.x, ...(s.x1 ?? [])])
  const ys = drawn.flatMap((s) => [
    ...s.y,
    ...(s.band ? [...s.band.lo, ...s.band.hi] : []),
  ])
  const X = scaled(xs, xAxis, pad.l, W - pad.r, false)
  const Y = scaled(ys, yAxis, plotH - pad.b, pad.t, bars)
  const fx = xAxis.format ?? fmtNum
  const fy = yAxis.format ?? fmtNum
  const parts = [t.bg]
  for (const v of Y.ticks)
    parts.push(
      `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y.at(v).toFixed(1)}" y2="${Y.at(v).toFixed(1)}" ${t.grid}/>`,
      `<text x="${pad.l - 6}" y="${(Y.at(v) + 4).toFixed(1)}" text-anchor="end" ${t.text}>${esc(fy(v))}</text>`
    )
  for (const v of X.ticks)
    parts.push(
      `<text x="${X.at(v).toFixed(1)}" y="${plotH - pad.b + 16}" text-anchor="middle" ${t.text}>${esc(fx(v))}</text>`
    )
  const base = plotH - pad.b
  parts.push(
    `<line x1="${pad.l}" x2="${W - pad.r}" y1="${base}" y2="${base}" ${t.axis}/>`,
    `<line x1="${pad.l}" x2="${pad.l}" y1="${pad.t}" y2="${base}" ${t.axis}/>`,
    `<text x="${(W + pad.l) / 2}" y="${plotH - 4}" text-anchor="middle" ${t.text}>${esc(xAxis.label)}</text>`,
    `<text transform="translate(12 ${(pad.t + base) / 2}) rotate(-90)" text-anchor="middle" ${t.text}>${esc(yAxis.label)}</text>`
  )
  // bars of several series on the same spots show through each other
  const barSeries = drawn.filter((s) => s.kind === 'bars')
  const overlay =
    barSeries.length > 1 && barSeries.every((s) => s.x[0] === barSeries[0].x[0])
  const many =
    drawn.reduce((n, s) => n + (s.kind === 'points' ? s.x.length : 0), 0) > 600
  for (const s of drawn) {
    const ok = (i: number) => X.ok(s.x[i]) && Y.ok(s.y[i])
    const px = (i: number) => X.at(s.x[i]).toFixed(1)
    const py = (i: number) => Y.at(s.y[i]).toFixed(1)
    const stroke = `stroke="${col(s.color)}" stroke-width="${s.width ?? 2}"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}`
    const idx = s.x.map((_, i) => i).filter(ok)
    if (s.band) {
      const { lo, hi } = s.band
      const up = idx.map(
        (i) => `${px(i)},${Y.at(Y.ok(hi[i]) ? hi[i] : s.y[i]).toFixed(1)}`
      )
      const down = idx
        .map((i) => `${px(i)},${Y.at(Y.ok(lo[i]) ? lo[i] : s.y[i]).toFixed(1)}`)
        .reverse()
      if (up.length > 1)
        parts.push(
          `<path d="M${[...up, ...down].join(' L')} Z" fill="${col(s.color)}" fill-opacity="0.15" stroke="none"/>`
        )
    }
    if (s.kind === 'line' && idx.length)
      parts.push(
        `<path class="ch-line" d="M${idx.map((i) => `${px(i)},${py(i)}`).join(' L')}" fill="none" ${stroke}>${title(s.label)}</path>`
      )
    if (s.kind === 'step' && idx.length) {
      const d = idx
        .map((i, k) => (k ? `H${px(i)} V${py(i)}` : `M${px(i)},${py(i)}`))
        .join(' ')
      parts.push(
        `<path class="ch-line" d="${d}" fill="none" ${stroke}>${title(s.label)}</path>`
      )
    }
    // a line's points show on hover (ch-dot); a scatter's always
    if (s.kind === 'line' || s.kind === 'points')
      for (const i of idx) {
        const key = s.keys?.[i]
        const cls = [
          key !== undefined ? 'ch-hit' : '',
          s.kind === 'line' ? 'ch-dot' : '',
        ]
          .filter(Boolean)
          .join(' ')
        parts.push(
          `<circle${cls ? ` class="${cls}"` : ''}${key !== undefined ? ` data-key="${esc(key)}"` : ''} cx="${px(i)}" cy="${py(i)}" r="${s.kind === 'points' ? (many ? 2 : 3) : 2.5}" fill="${col(s.color)}"${s.kind === 'points' ? ' fill-opacity="0.75"' : ''}>${title(s.tips?.[i])}</circle>`
        )
      }
    if (s.kind === 'bars')
      for (const i of idx) {
        const x0 = X.at(s.x[i])
        const x1 = X.at(s.x1?.[i] ?? s.x[i] + 1)
        const top = Y.at(s.y[i])
        const bottom = yAxis.scale === 'log' ? base : Math.min(base, Y.at(0))
        const w = Math.max(1, x1 - x0 - (x1 - x0 > 4 ? 1 : 0))
        parts.push(
          `<rect${hit(s.keys?.[i])} x="${x0.toFixed(1)}" y="${Math.min(top, bottom).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.abs(bottom - top).toFixed(1)}" fill="${col(s.color)}"${overlay ? ' fill-opacity="0.55"' : ''}>${title(s.tips?.[i])}</rect>`
        )
      }
  }
  ;(opts.corner ?? []).forEach((line, k) =>
    parts.push(
      `<text x="${W - pad.r - 4}" y="${pad.t + 12 + 14 * k}" text-anchor="end" ${t.text}>${esc(line)}</text>`
    )
  )
  if (legend)
    parts.push(
      legendRows(
        drawn.map((s) => ({
          text: s.legend ?? s.label,
          color: s.color,
          dash: s.dash,
          width: s.width,
          square: s.kind === 'bars' || s.kind === 'points',
        })),
        pad.l,
        plotH + 12,
        t
      )
    )
  return `${svgOpen(W, H, opts.aria ?? `${yAxis.label} against ${xAxis.label}`)}${parts.join('')}</svg>`
}

// ---------------------------------------------------------------- heatmap
/** A matrix of values from −1 to 1 (blue – pale – red), the value in each cell. */
export function heatmapSvg(
  labels: string[],
  m: (number | null)[][],
  color: (v: number) => string,
  opts: ChartOptions = {}
): string {
  if (!labels.length)
    return `<p class="small text-secondary">${esc(opts.empty ?? 'Nothing to plot.')}</p>`
  const W = widthOf(opts.width)
  const lw = Math.min(170, Math.max(...labels.map((l) => l.length)) * 6.2 + 12)
  const cell = Math.max(18, Math.min(56, (W - lw - 8) / labels.length))
  const top = 16
  const H = Math.round(top + cell * labels.length + 8 + lw * 0.75)
  const t = theme(!!opts.standalone, W, H)
  const parts = [t.bg]
  labels.forEach((row, i) => {
    parts.push(
      `<text x="${lw - 6}" y="${(top + cell * (i + 0.5) + 4).toFixed(1)}" text-anchor="end" ${t.text}>${esc(row)}</text>`
    )
    labels.forEach((col, j) => {
      const v = m[i][j]
      const x = lw + cell * j
      const y = top + cell * i
      parts.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(cell - 1).toFixed(1)}" height="${(cell - 1).toFixed(1)}" fill="${v === null ? '#888' : color(v)}"><title>${esc(`${row} × ${col}: ${v === null ? 'n/a' : fmtNum(v)}`)}</title></rect>`
      )
      if (v !== null && cell >= 28)
        parts.push(
          `<text x="${(x + cell / 2).toFixed(1)}" y="${(y + cell / 2 + 4).toFixed(1)}" text-anchor="middle" fill="${Math.abs(v) > 0.6 ? '#fff' : '#222'}">${v.toFixed(2)}</text>`
        )
    })
  })
  const by = top + cell * labels.length + 10
  labels.forEach((col, j) => {
    const x = lw + cell * (j + 0.5)
    parts.push(
      `<text transform="translate(${x.toFixed(1)} ${by}) rotate(40)" ${t.text}>${esc(col)}</text>`
    )
  })
  return `${svgOpen(W, H, opts.aria ?? 'Heatmap')}${parts.join('')}</svg>`
}

// ---------------------------------------------------------------- box / violin
export interface Group {
  label: string
  color: string
  values: number[]
  key?: string
}

/** One box (median, quartiles, whiskers to 1.5 IQR) per group, with the
 * violin (the kernel density, mirrored) behind it. */
export function boxViolinSvg(
  groups: Group[],
  axis: Axis,
  opts: ChartOptions & { violin?: boolean } = {}
): string {
  const shown = groups.filter((g) => g.values.length)
  if (!shown.length)
    return `<p class="small text-secondary">${esc(opts.empty ?? 'Nothing to plot.')}</p>`
  const W = widthOf(opts.width)
  const plotH = Math.round(W * 0.5)
  const pad = { l: 52, r: 14, t: 12, b: 40 }
  const H = plotH
  const t = theme(!!opts.standalone, W, H)
  const all = shown.flatMap((g) => g.values)
  const Y = scaled(all, axis, plotH - pad.b, pad.t, false)
  const f = axis.format ?? fmtNum
  const slot = (W - pad.l - pad.r) / shown.length
  const parts = [t.bg]
  for (const v of Y.ticks)
    parts.push(
      `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y.at(v).toFixed(1)}" y2="${Y.at(v).toFixed(1)}" ${t.grid}/>`,
      `<text x="${pad.l - 6}" y="${(Y.at(v) + 4).toFixed(1)}" text-anchor="end" ${t.text}>${esc(f(v))}</text>`
    )
  parts.push(
    `<line x1="${pad.l}" x2="${pad.l}" y1="${pad.t}" y2="${plotH - pad.b}" ${t.axis}/>`,
    `<text transform="translate(12 ${(plotH - pad.b + pad.t) / 2}) rotate(-90)" text-anchor="middle" ${t.text}>${esc(axis.label)}</text>`
  )
  shown.forEach((g, k) => {
    const cx = pad.l + slot * (k + 0.5)
    const vals = g.values.filter(Y.ok)
    const s = [...vals].sort((a, b) => a - b)
    const st = summary(s)
    const [q1, q3] = [quantile(s, 0.25), quantile(s, 0.75)]
    const iqr = q3 - q1
    const loW = s.find((v) => v >= q1 - 1.5 * iqr) ?? st.min
    const hiW = [...s].reverse().find((v) => v <= q3 + 1.5 * iqr) ?? st.max
    const half = Math.min(36, slot * 0.4)
    if (opts.violin !== false && s.length > 2 && st.max > st.min) {
      const d = kde(axis.scale === 'log' ? s.map(Math.log10) : s, 60)
      const peak = Math.max(...d.y) || 1
      const pts = d.x
        .map((x, i) => [axis.scale === 'log' ? 10 ** x : x, d.y[i]] as const)
        .filter(([x]) => Y.ok(x) && x >= st.min && x <= st.max)
      if (pts.length > 1) {
        const right = pts.map(
          ([x, y]) =>
            `${(cx + (half * y) / peak).toFixed(1)},${Y.at(x).toFixed(1)}`
        )
        const left = pts
          .map(
            ([x, y]) =>
              `${(cx - (half * y) / peak).toFixed(1)},${Y.at(x).toFixed(1)}`
          )
          .reverse()
        parts.push(
          `<path d="M${[...right, ...left].join(' L')} Z" fill="${col(g.color)}" fill-opacity="0.25" stroke="${col(g.color)}" stroke-opacity="0.6"/>`
        )
      }
    }
    const bw = Math.min(16, half * 0.5)
    const tip = `${g.label}: n ${st.n}, median ${fmtNum(st.median)}, quartiles ${fmtNum(q1)}–${fmtNum(q3)}, range ${fmtNum(st.min)}–${fmtNum(st.max)}`
    parts.push(
      `<line x1="${cx}" x2="${cx}" y1="${Y.at(loW).toFixed(1)}" y2="${Y.at(hiW).toFixed(1)}" stroke="${col(g.color)}"/>`,
      `<rect${hit(g.key)} x="${(cx - bw).toFixed(1)}" y="${Y.at(q3).toFixed(1)}" width="${(2 * bw).toFixed(1)}" height="${Math.max(1, Y.at(q1) - Y.at(q3)).toFixed(1)}" fill="${col(g.color)}" fill-opacity="0.8"><title>${esc(tip)}</title></rect>`,
      `<line x1="${(cx - bw).toFixed(1)}" x2="${(cx + bw).toFixed(1)}" y1="${Y.at(st.median).toFixed(1)}" y2="${Y.at(st.median).toFixed(1)}" stroke="${opts.standalone ? '#000' : '#fff'}" stroke-width="2"/>`
    )
    s.filter((v) => v < loW || v > hiW)
      .slice(0, 200)
      .forEach((v) =>
        parts.push(
          `<circle cx="${cx}" cy="${Y.at(v).toFixed(1)}" r="2" fill="${col(g.color)}"/>`
        )
      )
    parts.push(
      `<text x="${cx}" y="${plotH - pad.b + 16}" text-anchor="middle" ${t.text}>${esc(g.label.length > 16 ? `${g.label.slice(0, 15)}…` : g.label)}</text>`
    )
  })
  return `${svgOpen(W, H, opts.aria ?? `${axis.label} per group`)}${parts.join('')}</svg>`
}

// ---------------------------------------------------------------- ranking
export interface RankRow {
  label: string
  value: number
  key?: string
  marks: { label: string; color: string; rank: number | null }[]
}

/** Top nodes as bars of a value, and beside them each node's rank in other
 * groups (layers) as coloured dots: who is a hub where. */
export function rankingSvg(
  rows: RankRow[],
  valueLabel: string,
  maxRank: number,
  opts: ChartOptions = {}
): string {
  if (!rows.length)
    return `<p class="small text-secondary">${esc(opts.empty ?? 'Nothing to plot.')}</p>`
  const W = widthOf(opts.width)
  const lw = Math.min(
    140,
    Math.max(...rows.map((r) => r.label.length)) * 6.2 + 10
  )
  const rowH = 18
  const top = 26
  const marks = rows[0].marks
  const H = top + rowH * rows.length + 12 + 18 * marks.length + 8
  const t = theme(!!opts.standalone, W, H)
  const barW = (W - lw - 20) * 0.5
  const rankX0 = lw + barW + 24
  const rankX1 = W - 14
  const vmax = Math.max(...rows.map((r) => r.value), 0) || 1
  const rx = (r: number) =>
    rankX0 + ((rankX1 - rankX0) * (r - 1)) / Math.max(1, maxRank - 1)
  const parts = [
    t.bg,
    `<text x="${lw}" y="12" ${t.text}>${esc(valueLabel)}</text>`,
    `<text x="${rankX0}" y="12" ${t.text}>rank in each layer (1 = top)</text>`,
    `<text x="${rankX0}" y="${top - 4}" ${t.text}>1</text>`,
    `<text x="${rankX1}" y="${top - 4}" text-anchor="end" ${t.text}>${maxRank}</text>`,
  ]
  rows.forEach((r, i) => {
    const y = top + rowH * i
    parts.push(
      `<text x="${lw - 6}" y="${y + 12}" text-anchor="end" ${t.text}>${esc(r.label)}</text>`,
      `<rect${hit(r.key)} x="${lw}" y="${y + 3}" width="${Math.max(1, (barW * r.value) / vmax).toFixed(1)}" height="${rowH - 6}" fill="${opts.standalone ? '#2a78d6' : '#3987e5'}"><title>${esc(`${r.label}: ${fmtNum(r.value)}`)}</title></rect>`,
      `<line x1="${rankX0}" x2="${rankX1}" y1="${y + rowH / 2}" y2="${y + rowH / 2}" ${t.grid}/>`
    )
    for (const m of r.marks)
      if (m.rank !== null)
        parts.push(
          `<circle cx="${rx(Math.min(m.rank, maxRank)).toFixed(1)}" cy="${y + rowH / 2}" r="4" fill="${col(m.color)}"><title>${esc(`${r.label} in ${m.label}: rank ${m.rank}`)}</title></circle>`
        )
  })
  parts.push(
    legendRows(
      marks.map((m) => ({ text: m.label, color: m.color, square: true })),
      lw,
      top + rowH * rows.length + 18,
      t
    )
  )
  return `${svgOpen(W, H, opts.aria ?? `Top nodes by ${valueLabel}`)}${parts.join('')}</svg>`
}

// ---------------------------------------------------------------- small multiples
export interface MiniPanel {
  title: string
  bars: { label: string; color: string; value: number | null }[]
}

/** One small bar chart per measure, the groups (layers) in their colours. */
export function smallMultiplesSvg(
  panels: MiniPanel[],
  opts: ChartOptions = {}
): string {
  if (!panels.length)
    return `<p class="small text-secondary">${esc(opts.empty ?? 'Nothing to plot.')}</p>`
  const W = widthOf(opts.width)
  const cols = W >= 540 ? 3 : 2
  const pw = W / cols
  const ph = 110
  const rows = Math.ceil(panels.length / cols)
  const names = panels[0].bars
  const H = ph * rows + 12 + 18 * names.length
  const t = theme(!!opts.standalone, W, H)
  const parts = [t.bg]
  panels.forEach((p, k) => {
    const x0 = (k % cols) * pw + 8
    const y0 = Math.floor(k / cols) * ph
    const vals = p.bars
      .map((b) => b.value)
      .filter((v): v is number => v !== null && Number.isFinite(v))
    const lo = Math.min(0, ...vals)
    const hi = Math.max(0, ...vals) || 1
    const innerH = ph - 44
    const y = (v: number) => y0 + 22 + innerH * (1 - (v - lo) / (hi - lo || 1))
    const bw = (pw - 24) / Math.max(1, p.bars.length)
    parts.push(
      `<text x="${x0}" y="${y0 + 12}" ${t.text} font-weight="600">${esc(p.title)}</text>`,
      `<line x1="${x0}" x2="${x0 + pw - 16}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" ${t.axis}/>`
    )
    p.bars.forEach((b, i) => {
      if (b.value === null || !Number.isFinite(b.value)) return
      const top = y(b.value)
      parts.push(
        `<rect x="${(x0 + bw * i + 2).toFixed(1)}" y="${Math.min(top, y(0)).toFixed(1)}" width="${Math.max(1, bw - 4).toFixed(1)}" height="${Math.max(1, Math.abs(y(0) - top)).toFixed(1)}" fill="${col(b.color)}"><title>${esc(`${b.label} — ${p.title}: ${fmtNum(b.value)}`)}</title></rect>`
      )
      if (bw >= 38)
        parts.push(
          `<text x="${(x0 + bw * (i + 0.5)).toFixed(1)}" y="${(y0 + ph - 8).toFixed(1)}" text-anchor="middle" ${t.text}>${esc(fmtNum(b.value))}</text>`
        )
    })
  })
  parts.push(
    legendRows(
      names.map((b) => ({ text: b.label, color: b.color, square: true })),
      8,
      ph * rows + 12,
      t
    )
  )
  return `${svgOpen(W, H, opts.aria ?? 'Measures per layer')}${parts.join('')}</svg>`
}
