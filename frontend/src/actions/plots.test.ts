import { describe, expect, it } from 'vitest'
import {
  bandwidth,
  ecdf,
  histogram,
  kde,
  pearson,
  powerLawFit,
  quantile,
  ranks,
  spearman,
  summary,
} from './plot_math'
import { boxViolinSvg, heatmapSvg, niceTicks, xyChart } from './chart'
import {
  correlationPlot,
  curvePlot,
  histogramPlot,
  logLogPlot,
  pathValues,
  profilesPlot,
  rankingPlot,
  scatterPlot,
  shellsPlot,
} from './plots'
import type { GraphStats } from '../api/client'

describe('plot maths', () => {
  it('summarises', () => {
    const s = summary([4, 1, 3, 2])
    expect(s).toMatchObject({ n: 4, mean: 2.5, median: 2.5, min: 1, max: 4 })
    expect(s.sd).toBeCloseTo(Math.sqrt(5 / 3))
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2)
    expect(summary([]).n).toBe(0)
  })

  it('bins by count or width, the last bin closed', () => {
    const b = histogram([0, 1, 2, 3, 4], { bins: 2 })
    expect(b.map((x) => x.count)).toEqual([2, 3]) // [0,2) and [2,4]
    expect(b[1].members).toEqual([2, 3, 4])
    const w = histogram([0, 1, 2, 3, 4], { width: 1 })
    expect(w).toHaveLength(4)
    expect(w[3].count).toBe(2) // 3 and the upper edge 4
    expect(histogram([5, 5, 5])).toHaveLength(1) // all equal: one bin
  })

  it('a kernel density that integrates to about 1', () => {
    const v = [1, 2, 2, 3, 3, 3, 4, 4, 5]
    const d = kde(v, 200)
    const dx = d.x[1] - d.x[0]
    expect(d.y.reduce((a, y) => a + y * dx, 0)).toBeCloseTo(1, 1)
    expect(bandwidth(v)).toBeGreaterThan(0)
  })

  it('empirical CDF and CCDF at each distinct value', () => {
    expect(ecdf([1, 2, 2, 3])).toEqual({ x: [1, 2, 3], y: [0.25, 0.75, 1] })
    expect(ecdf([1, 2, 2, 3], true)).toEqual({
      x: [1, 2, 3],
      y: [1, 0.75, 0.25],
    })
  })

  it('correlates, ranks with ties averaged', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1)
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1)
    expect(ranks([10, 20, 20, 5])).toEqual([2, 3.5, 3.5, 1])
    // monotone but not linear: Spearman 1, Pearson below
    const x = [1, 2, 3, 4, 5]
    const y = x.map((v) => v ** 4)
    expect(spearman(x, y)).toBeCloseTo(1)
    expect(pearson(x, y)).toBeLessThan(0.99)
  })

  it('fits a power law by maximum likelihood', () => {
    // γ = 1 + n / Σ ln(k / 0.5) for kMin = 1
    const k = [1, 1, 1, 2, 2, 4, 8]
    const sum = k.reduce((s, v) => s + Math.log(v / 0.5), 0)
    expect(powerLawFit(k)?.gamma).toBeCloseTo(1 + k.length / sum)
    expect(powerLawFit(k, 2)?.n).toBe(4) // 2, 2, 4, 8
    expect(powerLawFit([1])).toBeNull()
  })
})

describe('the chart component', () => {
  it('nice ticks', () => {
    expect(niceTicks(0, 10)).toEqual([0, 2, 4, 6, 8, 10])
    expect(niceTicks(0, 1)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1])
    expect(niceTicks(3, 3)).toEqual([3])
  })

  it('draws lines, bars and points, keys on what a click selects', () => {
    const svg = xyChart(
      [
        {
          label: 'A',
          color: '#f00',
          kind: 'line',
          x: [1, 2, 3],
          y: [1, 4, 9],
          keys: ['a', 'b', 'c'],
        },
        {
          label: 'B',
          color: '#00f',
          kind: 'bars',
          x: [0, 1],
          x1: [1, 2],
          y: [2, 3],
          keys: ['p', 'q'],
        },
      ],
      { label: 'x' },
      { label: 'y' }
    )
    expect(svg).toContain('class="ch-line"')
    expect(svg.match(/data-key=/g)).toHaveLength(5)
    expect(svg).not.toMatch(/class="[^"]*"[^>]*class=/) // one class attribute per element
    expect(svg).toContain('class="ch-hit ch-dot"')
    expect(svg).toContain('>A<') // a legend for two series
  })

  it('log axes: powers of ten, nothing at or below zero', () => {
    const svg = xyChart(
      [
        {
          label: 'A',
          color: '#f00',
          kind: 'points',
          x: [0, 1, 10, 100],
          y: [1, 1, 1, 1],
        },
      ],
      { label: 'x', scale: 'log' },
      { label: 'y' }
    )
    expect(svg.match(/<circle/g)).toHaveLength(3)
    for (const t of ['>1<', '>10<', '>100<']) expect(svg).toContain(t)
  })

  it('downloads are light, with a background', () => {
    const file = xyChart(
      [{ label: 'A', color: '#f00', kind: 'line', x: [0, 1], y: [0, 1] }],
      { label: 'x' },
      { label: 'y' },
      { standalone: true }
    )
    expect(file).toContain('fill="#fff"')
    expect(file).not.toContain('class="ch-text"')
    expect(
      xyChart([], { label: 'x' }, { label: 'y' }, { empty: 'none here' })
    ).toContain('none here')
  })

  it('a heatmap and box plots', () => {
    const h = heatmapSvg(
      ['a', 'b'],
      [
        [1, 0.5],
        [0.5, 1],
      ],
      () => '#ccc'
    )
    expect(h.match(/<rect/g)).toHaveLength(4)
    expect(h).toContain('a × b: 0.5')
    const b = boxViolinSvg(
      [{ label: 'L1', color: '#f00', values: [1, 2, 3, 4, 100], key: 'k' }],
      { label: 'v' }
    )
    expect(b).toContain('median 3')
    expect(b).toContain('data-key="k"')
  })
})

describe('plot builders', () => {
  const groups = [
    {
      name: 'L1',
      color: '#f00',
      values: [1, 1, 2, 5],
      ids: ['a', 'b', 'c', 'd'],
    },
    { name: 'L2', color: '#0f0', values: [1, 3], ids: ['e', 'f'] },
  ]

  it('a histogram: shared bins, side by side, a bin selects its nodes', () => {
    const h = histogramPlot(groups, 'degree', { bins: 2 })
    expect(h.picks.get('h0:0')).toEqual(['a', 'b', 'c']) // [1, 3)
    expect(h.picks.get('h1:1')).toEqual(['f'])
    expect(h.table.rows).toHaveLength(4)
    expect(h.stats?.map((s) => s.n)).toEqual([4, 2])
    expect(h.svg({ width: 400, standalone: false })).not.toContain(
      'fill-opacity="0.55"'
    )
  })

  it('log–log: shares of each value, a power-law fit with its note', () => {
    const p = logLogPlot(groups.slice(0, 1), 'degree', { fit: true })
    expect(p.table.rows).toEqual([
      ['L1', 1, 0.5],
      ['L1', 2, 0.25],
      ['L1', 5, 0.25],
    ])
    expect(p.svg({ width: 400, standalone: false })).toContain('γ =')
    expect(p.note).toContain('simple maximum-likelihood fit')
    expect(p.picks.get('l0:0')).toEqual(['a', 'b'])
  })

  it('a scatter: correlations in the corner, each point selects its node', () => {
    const s = scatterPlot(
      [
        {
          name: 'L1',
          color: '#f00',
          x: [1, 2, 3, 0],
          y: [2, 4, 7, 1],
          ids: ['a', 'b', 'c', 'd'],
          labels: ['A', 'B', 'C', 'D'],
        },
      ],
      'degree',
      'betweenness',
      { log: true }
    )
    expect(s.table.rows).toHaveLength(3) // D has a zero: off log axes
    expect(s.picks.get('b')).toEqual(['b'])
    const svg = s.svg({ width: 400, standalone: false })
    expect(svg).toContain('Spearman ρ = 1')
    expect(svg).toContain('B (L1): 2, 4')
  })

  it('a correlation matrix with ones on the diagonal', () => {
    const c = correlationPlot(
      ['a', 'b'],
      [
        [1, 2, 3],
        [3, 2, 1],
      ]
    )
    expect(c.table.rows).toEqual([
      ['a', 1, -1],
      ['b', -1, 1],
    ])
  })

  it('curves against degree, with a reference line', () => {
    const c = curvePlot(
      [
        {
          name: 'L1',
          color: '#f00',
          points: [
            [2, 1],
            [3, 0],
          ],
        },
      ],
      'k',
      'C(k)',
      { log: true, reference: 1 }
    )
    expect(c.note).toContain('leave out zeros')
    expect(c.svg({ width: 400, standalone: false })).toContain(
      'as on a random graph'
    )
  })

  it('k-core shells: counts per shell, a bar selects its nodes', () => {
    const s = shellsPlot([
      { name: 'L1', color: '#f00', values: [1, 2, 2], ids: ['a', 'b', 'c'] },
    ])
    expect(s.table.rows).toEqual([
      ['L1', 1, 1],
      ['L1', 2, 2],
    ])
    expect(s.picks.get('k0:1')).toEqual(['b', 'c'])
  })

  it('a ranking: best value as the bar, the rank in each layer as dots', () => {
    const r = rankingPlot(
      [
        {
          label: 'A',
          ids: ['A_1', 'A_2'],
          values: new Map([
            ['L1', 5],
            ['L2', 1],
          ]),
        },
        { label: 'B', ids: ['B_1'], values: new Map([['L1', 3]]) },
        { label: 'C', ids: ['C_2'], values: new Map([['L2', 9]]) },
      ],
      [
        { name: 'L1', color: '#f00' },
        { name: 'L2', color: '#0f0' },
      ],
      'Degree',
      2
    )
    expect(r.table.rows).toEqual([
      ['C', 9, '', 1],
      ['A', 5, 1, 2],
    ])
    expect(r.picks.get('r:A')).toEqual(['A_1', 'A_2'])
  })

  it('distances as values, thinned past a cap with the same shape', () => {
    expect(pathValues({ 1: 2, 2: 1 })).toEqual({
      values: [1, 1, 2],
      thinned: false,
    })
    const t = pathValues({ 1: 300, 2: 100 }, 40)
    expect(t.thinned).toBe(true)
    expect(t.values.filter((v) => v === 1)).toHaveLength(30)
  })

  it('layer profiles: one panel per statistic', () => {
    const st = (name: string, density: number) =>
      ({
        name,
        density,
        average_degree: 2,
        average_clustering: 0,
        transitivity: 0,
        average_path_length: 1,
        diameter: 1,
        components: 1,
        assortativity: null,
      }) as unknown as GraphStats
    const p = profilesPlot(
      [st('L1', 0.5), st('Whole network', 0.25)],
      () => '#888'
    )
    expect(p.table.rows[0]).toEqual(['Density', 0.5, 0.25])
    expect(p.table.rows.at(-1)).toEqual(['Degree assortativity', '', ''])
    expect(p.svg({ width: 600, standalone: false })).toContain(
      'Average path length'
    )
  })
})
