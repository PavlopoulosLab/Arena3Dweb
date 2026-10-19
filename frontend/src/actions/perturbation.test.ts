import { beforeEach, describe, expect, it } from 'vitest'
import { Edge, Layer, Node, Scene, ctx, resetContext } from '../three'
import { history } from '../commands/base'
import { captureLooks, LookCommand } from '../commands/perturbation'
import type {
  Curve,
  EdgeModel,
  KnockoutResponse,
  NetworkData,
  NodeChange,
} from '../api/client'
import {
  KNOCKED_OUT_COLOR,
  affectedObjects,
  change,
  changeColors,
  divergingColor,
  knockoutMeasureTable,
  knockoutNodeTable,
  mostAffected,
  perturbedNetwork,
  robustnessSvg,
  robustnessTable,
  seriesLabel,
  stateOf,
  toCsv,
  type Series,
} from './perturbation'

const edge = (
  s: string,
  sl: string,
  t: string,
  tl: string,
  channel: string | null = null
): EdgeModel => ({
  src: `${s}_${sl}`,
  trg: `${t}_${tl}`,
  source_node: s,
  source_layer: sl,
  target_node: t,
  target_layer: tl,
  weight: 1,
  scaled_weight: 1,
  channel,
})

// L1: A-B (two channels), B-C; L2: A; inter-layer A_L1-A_L2
const NET: NetworkData = {
  nodes: [
    { id: 'A_L1', label: 'A', layer: 'L1' },
    { id: 'B_L1', label: 'B', layer: 'L1' },
    { id: 'C_L1', label: 'C', layer: 'L1' },
    { id: 'A_L2', label: 'A', layer: 'L2' },
  ],
  edges: [
    edge('A', 'L1', 'B', 'L1', 'ppi'),
    edge('A', 'L1', 'B', 'L1', 'coexp'),
    edge('B', 'L1', 'C', 'L1', 'ppi'),
    edge('A', 'L1', 'A', 'L2', 'ppi'),
  ],
  layers: ['L1', 'L2'],
  channels: ['ppi', 'coexp'],
  warnings: [],
}

const row = (id: string, over: Partial<NodeChange> = {}): NodeChange => ({
  id,
  label: id.split('_')[0],
  layer: id.split('_')[1],
  removed: false,
  cut_off_layer: false,
  cut_off_whole: false,
  degree: 2,
  degree_after: 2,
  betweenness: 4,
  betweenness_after: 4,
  closeness: 0.5,
  closeness_after: 0.5,
  propagation: null,
  propagation_after: null,
  ...over,
})

const response = (over: Partial<KnockoutResponse> = {}): KnockoutResponse => ({
  removed_nodes: [],
  removed_edges: [],
  before: [],
  after: [],
  nodes: [],
  warnings: [],
  ...over,
})

beforeEach(() => {
  resetContext()
  ctx.scene = new Scene()
  ctx.layers = ['L1', 'L2'].map(
    (name, id) => new Layer({ id, name, geometry_parameters_width: 100 })
  )
  ctx.layerGroups = { L1: 0, L2: 1 }
  ctx.nodeLayerNames = NET.nodes.map((n) => n.id)
  ctx.nodeGroups = Object.fromEntries(NET.nodes.map((n) => [n.id, n.layer]))
  ctx.nodeObjects = NET.nodes.map(
    (n, i) =>
      new Node({
        id: i,
        name: n.label,
        nodeLayerName: n.id,
        layer: n.layer,
        color: '#111111',
      })
  )
  ctx.channelVisibility = { ppi: true, coexp: true }
  ctx.edgeObjects = [
    new Edge({
      source: 'A_L1',
      target: 'B_L1',
      weights: [1, 1],
      channels: ['ppi', 'coexp'],
    }),
    new Edge({
      source: 'B_L1',
      target: 'C_L1',
      weights: [1],
      channels: ['ppi'],
    }),
    new Edge({
      source: 'A_L1',
      target: 'A_L2',
      weights: [1],
      channels: ['ppi'],
      interLayer: true,
    }),
  ]
})

describe('the knockout in the scene', () => {
  it('touches the removed nodes and their edges', () => {
    const hit = affectedObjects(response({ removed_nodes: ['C_L1'] }), NET)
    expect(hit).toEqual({ nodes: [2], edges: [1] })
  })

  it('fades an edge only once every channel of it is removed', () => {
    expect(
      affectedObjects(response({ removed_edges: [1] }), NET).edges
    ).toEqual([])
    expect(
      affectedObjects(response({ removed_edges: [0, 1, 3] }), NET).edges
    ).toEqual([0, 2])
  })

  it('looks are one undo step and come back exactly', () => {
    const base = captureLooks([0, 1, 2, 3], [0])
    history.execute(
      new LookCommand('fade', {
        nodes: new Map([[0, { alpha: 0.15 }]]),
        edges: new Map([[0, 0.15]]),
      })
    )
    expect(ctx.nodeObjects[0].alpha).toBe(0.15)
    expect(ctx.edgeObjects[0].opacityFactor).toBe(0.15)
    history.execute(
      new LookCommand('colour', {
        nodes: new Map([[1, { color: '#ff0000', imported: '#ff0000' }]]),
        edges: new Map(),
        priority: 'default',
      })
    )
    expect(ctx.nodeObjects[1].getColor()).toBe('#ff0000')
    history.execute(new LookCommand('restore', base))
    expect(ctx.nodeObjects[0].alpha).toBe(1)
    expect(ctx.nodeObjects[1].getColor()).toBe('#111111')
    expect(ctx.edgeObjects[0].opacityFactor).toBe(1)
    history.undo() // the restore
    expect(ctx.nodeObjects[0].alpha).toBe(0.15)
    expect(ctx.nodeObjects[1].getColor()).toBe('#ff0000')
    history.undo()
    history.undo()
    expect(ctx.nodeObjects[0].alpha).toBe(1)
  })
})

describe('the perturbed network', () => {
  it('drops the removed nodes with their edges, and the removed rows', () => {
    const out = perturbedNetwork(
      NET,
      response({ removed_nodes: ['A_L2'], removed_edges: [1] })
    )
    expect(out.nodes.map((n) => n.id)).toEqual(['A_L1', 'B_L1', 'C_L1'])
    expect(out.edges).toEqual([NET.edges[0], NET.edges[2]])
    expect(out.layers).toEqual(['L1']) // L2 is empty now
    expect(out.channels).toEqual(['ppi'])
    expect(NET.nodes).toHaveLength(4) // the original is untouched
  })
})

describe('before and after', () => {
  it('measures the change, none for a knocked-out node', () => {
    expect(change(row('A_L1', { betweenness_after: 1 }), 'betweenness')).toBe(
      -3
    )
    expect(
      change(row('A_L1', { removed: true, degree_after: null }), 'degree')
    ).toBeNull()
    expect(change(row('A_L1'), 'propagation')).toBeNull()
  })

  it('orders the most affected first, the knocked-out last', () => {
    const rows = [
      row('A_L1', { removed: true, degree_after: null }),
      row('B_L1', { betweenness_after: 3 }),
      row('C_L1', { betweenness_after: 0, degree_after: 1 }),
      row('A_L2'),
    ]
    expect(mostAffected(rows).map((r) => r.id)).toEqual([
      'C_L1',
      'B_L1',
      'A_L2',
      'A_L1',
    ])
  })

  it('names the state', () => {
    expect(stateOf(row('A_L1', { removed: true }), true)).toBe('knocked out')
    expect(stateOf(row('A_L1', { cut_off_layer: true }), true)).toBe(
      'cut off (layer)'
    )
    expect(stateOf(row('A_L1', { cut_off_whole: true }), false)).toBe('cut off')
    expect(stateOf(row('A_L1', { cut_off_layer: true }), false)).toBe('')
    expect(
      stateOf(row('A_L1', { cut_off_layer: true, cut_off_whole: true }), true)
    ).toBe('cut off (layer and whole network)')
    expect(stateOf(row('A_L1'), true)).toBe('')
  })

  it('tables the nodes and the global measures', () => {
    const nodes = knockoutNodeTable(
      [
        row('A_L1', {
          removed: true,
          degree_after: null,
          betweenness_after: null,
          closeness_after: null,
        }),
        row('B_L1', { betweenness_after: 1.23456 }),
      ],
      true
    )
    expect(nodes.columns.slice(0, 6)).toEqual([
      'Node',
      'Layer',
      'State',
      'Degree',
      'Degree after',
      'Δ Degree',
    ])
    expect(nodes.columns).not.toContain('Propagation')
    expect(nodes.rows[0].slice(0, 3)).toEqual(['B', 'L1', ''])
    expect(nodes.rows[0][7]).toBe(1.235) // 4 significant digits
    expect(nodes.rows[1].slice(0, 5)).toEqual(['A', 'L1', 'knocked out', 2, ''])

    const m = {
      name: 'L1',
      nodes: 4,
      edges: 4,
      components: 1,
      largest_component: 4,
      density: 0.5,
      average_path_length: 1.5,
      diameter: 2,
      efficiency: 0.8,
      cut_off: 0,
    }
    const t = knockoutMeasureTable(
      [m],
      [
        {
          ...m,
          nodes: 3,
          components: 2,
          largest_component: 2,
          efficiency: 0.4,
          cut_off: 1,
        },
      ]
    )
    expect(t.columns).toEqual([
      'Network',
      'Measure',
      'Before',
      'After',
      'Change',
      'Change %',
    ])
    expect(t.rows).toHaveLength(9)
    expect(t.rows[0]).toEqual(['L1', 'Nodes', 4, 3, -1, -25])
    expect(t.rows[7]).toEqual(['L1', 'Global efficiency', 0.8, 0.4, -0.4, -50])
    expect(t.rows[8]).toEqual([
      'L1',
      'Nodes cut off from the largest component',
      0,
      1,
      1,
      '',
    ])
  })
})

describe('colour by change', () => {
  it('diverges from pale through blue (lost) and red (gained)', () => {
    expect(divergingColor(0)).toBe('#f7f7f7')
    expect(divergingColor(-1)).toBe('#2166ac')
    expect(divergingColor(1)).toBe('#b2182b')
    expect(divergingColor(5)).toBe('#b2182b') // clamped
  })

  it('scales by the largest change; knocked-out nodes grey', () => {
    const { colors, max } = changeColors(
      [
        row('A_L1', { removed: true, betweenness_after: null }),
        row('B_L1', { betweenness_after: 0 }),
        row('C_L1', { betweenness_after: 6 }),
        row('A_L2'),
      ],
      'betweenness'
    )
    expect(max).toBe(4)
    expect(colors.get('A_L1')).toBe(KNOCKED_OUT_COLOR)
    expect(colors.get('B_L1')).toBe('#2166ac')
    expect(colors.get('A_L2')).toBe('#f7f7f7')
    expect(colors.get('C_L1')).toBe(divergingColor(0.5))
  })
})

describe('robustness curves', () => {
  const curve = (name: string, over: Partial<Curve> = {}): Curve => ({
    name,
    nodes: 10,
    fraction: [0, 0.5, 1],
    largest: [1, 0.4, 0],
    largest_sd: null,
    components: [1, 3, 0],
    efficiency: null,
    robustness: 0.45,
    complete: true,
    ...over,
  })
  const series: Series[] = [
    { strategy: 'degree', recalculate: true, curve: curve('L1') },
    {
      strategy: 'random',
      recalculate: true,
      curve: curve('Whole network', { largest_sd: [0, 0.1, 0] }),
    },
  ]

  it('labels a series by network, strategy and ranking', () => {
    expect(seriesLabel(series[0])).toBe('L1 · degree attack, recalculated')
    expect(seriesLabel({ ...series[0], recalculate: false })).toBe(
      'L1 · degree attack, ranked once'
    )
    expect(seriesLabel(series[1])).toBe('Whole network · random failure')
  })

  it('draws a line per series, a band for random runs, R in the legend', () => {
    const svg = robustnessSvg(series, 'largest')
    expect(svg.match(/class="ch-line"/g)).toHaveLength(2)
    expect(svg).toContain('stroke-dasharray="7 4"') // degree attack dashed
    expect(svg).toContain('fill-opacity="0.15"') // the random band
    expect(svg).toContain('R = 0.450')
    expect(svg).toContain('stroke-width="2.6"') // the whole network heavier
    // the download: light, with a background, no theme classes
    const file = robustnessSvg(series, 'largest', { standalone: true })
    expect(file).toContain('fill="#fff"')
    expect(file).not.toContain('class="ch-text"')
    expect(robustnessSvg(series, 'efficiency')).toContain('No efficiency')
    expect(robustnessSvg(series, 'components')).toContain('components')
  })

  it('tables every point, for Data Tables and the CSV', () => {
    const t = robustnessTable(series)
    expect(t.rows).toHaveLength(6)
    expect(t.rows[1]).toEqual([
      'L1',
      'degree attack',
      'recalculated',
      0.5,
      5,
      0.4,
      '',
      3,
      '',
      0.45,
    ])
    expect(t.rows[4][6]).toBe(0.1) // the spread of the random runs
    const csv = toCsv({ columns: ['a', 'b'], rows: [['x, y', 'say "hi"']] })
    expect(csv).toBe('a,b\n"x, y","say ""hi"""')
  })
})
