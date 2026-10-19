// The numbers behind Analyze → Plots: summaries, histogram bins, a Gaussian
// kernel density, empirical CDFs, correlations and a simple power-law fit.

export interface Summary {
  n: number
  mean: number
  median: number
  sd: number
  min: number
  max: number
}

const sorted = (values: number[]) => [...values].sort((a, b) => a - b)

/** The q-quantile (0–1) of sorted values, interpolated between neighbours. */
export function quantile(s: number[], q: number): number {
  if (!s.length) return NaN
  const at = (s.length - 1) * q
  const lo = Math.floor(at)
  const hi = Math.ceil(at)
  return s[lo] + (s[hi] - s[lo]) * (at - lo)
}

export function summary(values: number[]): Summary {
  const s = sorted(values)
  const n = s.length
  const mean = n ? s.reduce((a, b) => a + b, 0) / n : NaN
  const sd =
    n > 1 ? Math.sqrt(s.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1)) : 0
  return {
    n,
    mean,
    median: quantile(s, 0.5),
    sd,
    min: n ? s[0] : NaN,
    max: n ? s[n - 1] : NaN,
  }
}

export interface Bin {
  x0: number
  x1: number // the last bin includes its upper edge
  count: number
  members: number[] // indices into the values
}

/** Equal-width bins, by count or by width (Sturges' rule by default). */
export function histogram(
  values: number[],
  { bins, width }: { bins?: number; width?: number } = {}
): Bin[] {
  if (!values.length) return []
  const s = sorted(values)
  const lo = s[0]
  const hi = s[s.length - 1]
  let w =
    width && width > 0
      ? width
      : (hi - lo) / Math.max(1, bins ?? Math.ceil(Math.log2(s.length) + 1))
  if (!(w > 0)) w = 1 // all values equal: one bin around them
  const count = Math.max(1, Math.min(500, Math.ceil((hi - lo) / w) || 1))
  const out: Bin[] = Array.from({ length: count }, (_, i) => ({
    x0: lo + i * w,
    x1: lo + (i + 1) * w,
    count: 0,
    members: [],
  }))
  values.forEach((v, i) => {
    const b = Math.min(count - 1, Math.floor((v - lo) / w))
    out[b].count++
    out[b].members.push(i)
  })
  return out
}

/** Silverman's rule of thumb for the kernel width. */
export function bandwidth(values: number[]): number {
  const s = sorted(values)
  const { sd } = summary(s)
  const iqr = quantile(s, 0.75) - quantile(s, 0.25)
  const spread = Math.min(sd, iqr / 1.34) || sd || Math.abs(s[0]) || 1
  return 0.9 * spread * Math.pow(s.length, -0.2)
}

/** A Gaussian kernel density at `points` evenly spaced points (with margins). */
export function kde(
  values: number[],
  points = 100,
  h = bandwidth(values)
): { x: number[]; y: number[] } {
  if (!values.length) return { x: [], y: [] }
  const s = sorted(values)
  const lo = s[0] - 3 * h
  const hi = s[s.length - 1] + 3 * h
  const x = Array.from(
    { length: points },
    (_, i) => lo + ((hi - lo) * i) / (points - 1)
  )
  const k = 1 / (s.length * h * Math.sqrt(2 * Math.PI))
  const y = x.map(
    (t) => k * s.reduce((a, v) => a + Math.exp(-0.5 * ((t - v) / h) ** 2), 0)
  )
  return { x, y }
}

/** The empirical CDF, P(X ≤ x), or the CCDF, P(X ≥ x), at each distinct value. */
export function ecdf(
  values: number[],
  complementary = false
): { x: number[]; y: number[] } {
  const s = sorted(values)
  const n = s.length
  const x: number[] = []
  const y: number[] = []
  for (let i = 0; i < n;) {
    let j = i // the run of values equal to s[i]: i..j
    while (j + 1 < n && s[j + 1] === s[i]) j++
    x.push(s[i])
    y.push(complementary ? (n - i) / n : (j + 1) / n)
    i = j + 1
  }
  return { x, y }
}

export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return NaN
  const ma = a.slice(0, n).reduce((s, v) => s + v, 0) / n
  const mb = b.slice(0, n).reduce((s, v) => s + v, 0) / n
  let sab = 0
  let saa = 0
  let sbb = 0
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb)
    saa += (a[i] - ma) ** 2
    sbb += (b[i] - mb) ** 2
  }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : NaN
}

/** Ranks from 1, ties sharing their average rank. */
export function ranks(values: number[]): number[] {
  const order = values
    .map((v, i) => [v, i] as const)
    .sort((p, q) => p[0] - q[0])
  const r = new Array<number>(values.length)
  for (let i = 0; i < order.length;) {
    let j = i
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++
    for (let k = i; k <= j; k++) r[order[k][1]] = (i + j) / 2 + 1
    i = j + 1
  }
  return r
}

export const spearman = (a: number[], b: number[]): number =>
  pearson(ranks(a), ranks(b))

/** P(k) ∝ k^−γ for k ≥ kMin: the discrete maximum-likelihood approximation
 * of Clauset, Shalizi & Newman (2009), γ = 1 + n / Σ ln(k / (kMin − ½)).
 * A simple fit: no choice of kMin and no goodness-of-fit test. */
export function powerLawFit(
  values: number[],
  kMin = 1
): { gamma: number; kMin: number; n: number } | null {
  const tail = values.filter((v) => v >= kMin && v > 0)
  if (tail.length < 2 || kMin < 1) return null
  const sum = tail.reduce((s, v) => s + Math.log(v / (kMin - 0.5)), 0)
  return sum > 0 ? { gamma: 1 + tail.length / sum, kMin, n: tail.length } : null
}
