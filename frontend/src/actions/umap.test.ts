import { describe, expect, it } from 'vitest'
import {
  assembleFeatures,
  featureSources,
  MAX_SET_TERMS,
  umapCsv,
  umapScatterSvg,
  umapTitle,
  UMAP_DEFAULTS,
  UMAP_METRICS,
  vegaUmapSpec,
  VEGA_MAX_POINTS,
  type FeatureData,
  type UmapPoint,
} from './umap'

const nodes = [
  { id: 'A_L1', label: 'A' },
  { id: 'B_L1', label: 'B' },
  { id: 'A_L2', label: 'A' },
  { id: 'C_L2', label: 'C' },
]

const data: FeatureData = {
  values: {
    columns: ['score', 'log2fc'],
    rows: [
      { node: 'A', values: [1, -2] },
      { node: 'B', values: [3, null] },
    ],
  },
  sets: [
    {
      name: 'GO',
      byNode: { A_L1: ['kinase', 'membrane'], B_L1: ['kinase'], C_L2: ['x'] },
    },
  ],
  clusters: { A_L1: '1', B_L1: '1', C_L2: '2' },
}

describe('featureSources', () => {
  it('lists value columns, annotation sets, clusters and metrics', () => {
    const keys = featureSources(data).map((s) => s.key)
    expect(keys.slice(0, 4)).toEqual([
      'value:score',
      'value:log2fc',
      'set:GO',
      'clusters',
    ])
    expect(keys.slice(4)).toEqual(UMAP_METRICS.map((m) => `metric:${m}`))
  })

  it('leaves out clusters when no node has one', () => {
    const keys = featureSources({ values: null, sets: [], clusters: {} }).map(
      (s) => s.kind
    )
    expect(keys.every((k) => k === 'metric')).toBe(true)
  })
})

describe('assembleFeatures', () => {
  it('values go by node name: every copy alike, missing ones null', () => {
    const f = assembleFeatures(nodes, ['value:score', 'value:log2fc'], data)
    expect(f.feature_names).toEqual(['score', 'log2fc'])
    expect(f.features).toEqual({
      A_L1: [1, -2],
      B_L1: [3, null],
      A_L2: [1, -2],
      C_L2: [null, null],
    })
    expect(f.metrics).toEqual([])
  })

  it('an annotation set becomes one 0/1 column per term, most frequent first', () => {
    const f = assembleFeatures(nodes, ['set:GO'], data)
    expect(f.feature_names).toEqual(['GO: kinase', 'GO: membrane', 'GO: x'])
    expect(f.features.A_L1).toEqual([1, 1, 0])
    expect(f.features.B_L1).toEqual([1, 0, 0])
    expect(f.features.A_L2).toEqual([0, 0, 0]) // this copy is not annotated
    expect(f.features.C_L2).toEqual([0, 0, 1])
  })

  it('clusters are one-hot too; metrics are left to the server', () => {
    const f = assembleFeatures(
      nodes,
      ['clusters', 'metric:Degree', 'metric:Unknown'],
      data
    )
    expect(f.feature_names).toEqual(['Cluster: 1', 'Cluster: 2'])
    expect(f.features.A_L2).toEqual([0, 0])
    expect(f.features.C_L2).toEqual([0, 1])
    expect(f.metrics).toEqual(['Degree'])
  })

  it('only metrics: no client rows at all', () => {
    const f = assembleFeatures(nodes, ['metric:PageRank'], data)
    expect(f.feature_names).toEqual([])
    expect(f.features).toEqual({})
    expect(f.metrics).toEqual(['PageRank'])
  })

  it('a set with many terms keeps the most frequent ones', () => {
    const byNode: Record<string, string[]> = {}
    const many = Array.from({ length: 80 }, (_, i) => ({
      id: `n${i}_L`,
      label: `n${i}`,
    }))
    many.forEach((n, i) => (byNode[n.id] = [`t${i}`, 'shared']))
    const f = assembleFeatures(many, ['set:big'], {
      values: null,
      sets: [{ name: 'big', byNode }],
      clusters: {},
    })
    expect(f.feature_names).toHaveLength(MAX_SET_TERMS)
    expect(f.feature_names[0]).toBe('big: shared')
  })

  it('ignores sources that are gone', () => {
    const f = assembleFeatures(nodes, ['value:nope', 'set:nope'], data)
    expect(f.feature_names).toEqual([])
  })
})

const points: UmapPoint[] = [
  {
    id: 'A_L1',
    name: 'A',
    layer: 'L1',
    x: 0,
    y: 1,
    cluster: '1',
    annotation: 'kinase',
    group: 'kinase',
    color: '#ff0000',
  },
  {
    id: 'B,1_L1',
    name: 'B,1',
    layer: 'L1',
    x: 2.5,
    y: -1,
    cluster: '(none)',
    annotation: '(none)',
    group: '(none)',
    color: '#8a8a86',
  },
]

describe('UMAP view outputs', () => {
  it('CSV: one row per point, quoted where needed', () => {
    expect(umapCsv(points).split('\n')).toEqual([
      'node_id,node,layer,umap_1,umap_2,cluster,annotation',
      'A_L1,A,L1,0,1,1,kinase',
      '"B,1_L1","B,1",L1,2.5,-1,(none),(none)',
      '',
    ])
  })

  it('SVG: a dot per point and a legend per group', () => {
    const svg = umapScatterSvg(points, 'Test <UMAP>', 'annotation')
    expect(svg).toContain('Test &lt;UMAP&gt;')
    expect(svg.match(/<circle [^>]*r="5"/g)).toHaveLength(2)
    expect(svg).toContain('kinase (1)')
    expect(svg).toContain('UMAP 1')
  })

  it('Vega-Lite: groups keep their colours; scene colours pass through', () => {
    const spec = vegaUmapSpec(points, 't', 'annotation') as {
      encoding: { color: { scale: { domain: string[]; range: string[] } } }
      data: { values: unknown[] }
    }
    expect(spec.data.values).toHaveLength(2)
    expect(spec.encoding.color.scale.range).toContain('#ff0000')
    const scene = vegaUmapSpec(points, 't', 'scene') as {
      encoding: { color: { field: string; scale: null } }
    }
    expect(scene.encoding.color).toMatchObject({ field: 'color', scale: null })
    const many = Array.from({ length: VEGA_MAX_POINTS + 1 }, () => points[0])
    expect(() => vegaUmapSpec(many, 't', 'scene')).toThrow(/up to/)
  })

  it('titles name the mode and the parameters', () => {
    expect(umapTitle(UMAP_DEFAULTS)).toBe(
      'Topology UMAP (n_neighbors 15, min_dist 0.1, euclidean, seed 42)'
    )
    expect(
      umapTitle({ ...UMAP_DEFAULTS, mode: 'hybrid', balance: 0.25 })
    ).toContain(
      'Hybrid UMAP (n_neighbors 15, min_dist 0.1, euclidean, balance 0.25'
    )
  })
})
