import { beforeEach, describe, expect, it } from 'vitest'
import { Edge, Layer, Node, Scene, ctx, resetContext } from '../three'
import { labelLookFromText, labelLookText, shapeFromText } from '../three/Node'
import { history } from '../commands/base'
import { applyNodeAttributes, nodeLabelState } from './node'
import { applyEdgeAttributes } from './edge'
import {
  borderPatch,
  edgeAttributesTsv,
  edgeCell,
  edgePatch,
  editEdges,
  editNodes,
  editTargets,
  filterEdges,
  filterNodes,
  hex,
  nodeAttributesTsv,
  nodeCell,
  nodePatch,
  pickEdge,
  segmentDistance,
  sortRows,
  tickEdges,
  tickNodes,
} from './attributes'

// A, B, n10, n2 on L1; A on L2. Edges: A–B (L1, channels ppi + coexp),
// A–n10 (L1, no channel), A(L1)–A(L2) inter-layer (ppi).
beforeEach(() => {
  resetContext()
  history.clear()
  ctx.scene = new Scene()
  ctx.layers = ['L1', 'L2'].map(
    (name, id) => new Layer({ id, name, geometry_parameters_width: 100 })
  )
  ctx.layerGroups = { L1: 0, L2: 1 }
  const nodes: [string, string, number, number][] = [
    ['A', 'L1', 0, 0],
    ['B', 'L1', 100, 0],
    ['n10', 'L1', 0, 100],
    ['n2', 'L1', -100, 0],
    ['A', 'L2', 0, -100],
  ]
  ctx.nodeLayerNames = nodes.map(([n, l]) => `${n}_${l}`)
  ctx.nodeGroups = Object.fromEntries(nodes.map(([n, l]) => [`${n}_${l}`, l]))
  ctx.nodeObjects = nodes.map(
    ([n, l, x, y], i) =>
      new Node({
        id: i,
        name: n,
        nodeLayerName: `${n}_${l}`,
        layer: l,
        color: '#111111',
        // the screen's x is the scene's x, its y the scene's y (upwards)
        position_x: x,
        position_y: y,
      })
  )
  ctx.channelColors = { ppi: '#ff0000', coexp: '#00ff00' }
  ctx.edgeObjects = [
    new Edge({
      source: 'A_L1',
      target: 'B_L1',
      weights: [1, 1],
      channels: ['ppi', 'coexp'],
    }),
    new Edge({ source: 'A_L1', target: 'n10_L1', weights: [1] }),
    new Edge({
      source: 'A_L1',
      target: 'A_L2',
      weights: [1],
      channels: ['ppi'],
      interLayer: true,
    }),
  ]
})

const all = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('cells', () => {
  it('read what the scene objects show', () => {
    ctx.nodeObjects[1].label = 'Hub'
    expect(nodeCell(0, 'name')).toBe('A')
    expect(nodeCell(4, 'layer')).toBe('L2')
    expect(nodeCell(0, 'color')).toBe('#111111')
    expect(nodeCell(0, 'shape')).toBe('sphere')
    expect(nodeCell(0, 'scale')).toBe(1)
    expect(nodeCell(1, 'label')).toBe('Hub')
    expect(edgeCell(0, 'source')).toBe('A')
    expect(edgeCell(0, 'target')).toBe('B')
    expect(edgeCell(0, 'layers')).toBe('L1')
    expect(edgeCell(2, 'layers')).toBe('L1 → L2')
    expect(edgeCell(0, 'channel')).toBe('ppi, coexp')
    expect(edgeCell(0, 'color')).toBe('#ff0000') // the first channel's
    expect(edgeCell(0, 'arrowColor')).toBe('')
  })

  it('normalises colours for colour inputs', () => {
    expect(hex('#FFF')).toBe('#ffffff')
    expect(hex('#A3FF00')).toBe('#a3ff00')
  })
})

describe('lists', () => {
  it('filters nodes by text, layer, group and selection', () => {
    ctx.nodeObjects[3].descr = 'a kinase'
    expect(filterNodes({ text: 'kin' })).toEqual([3])
    expect(filterNodes({ text: 'a' })).toEqual([0, 3, 4]) // name, descr
    expect(filterNodes({ layer: 'L2' })).toEqual([4])
    ctx.nodeObjects[1].isSelected = true
    expect(filterNodes({ selectedOnly: true })).toEqual([1])
    ctx.nodeObjects[2].annotations = ['GO:1']
    ctx.nodeObjects[4].annotations = ['GO:1']
    expect(filterNodes({ group: 'annotation:GO:1' })).toEqual([2, 4])
    ctx.nodeObjects[0].cluster = '3'
    expect(filterNodes({ group: 'cluster:Cluster 3' })).toEqual([0])
    expect(filterNodes({ group: 'annotation:none' })).toEqual([])
  })

  it('filters edges by kind, channel, text and selection', () => {
    expect(filterEdges({ kind: 'inter' })).toEqual([2])
    expect(filterEdges({ kind: 'intra' })).toEqual([0, 1])
    expect(filterEdges({ channel: 'ppi' })).toEqual([0, 2])
    expect(filterEdges({ channel: 'coexp' })).toEqual([0])
    expect(filterEdges({ channel: '' })).toEqual([1]) // no channel
    expect(filterEdges({ channel: '*' })).toEqual([0, 1, 2])
    expect(filterEdges({ text: 'n1' })).toEqual([1])
    ctx.edgeObjects[1].isSelected = true
    expect(filterEdges({ selectedOnly: true })).toEqual([1])
  })

  it('sorts numbers by value, text naturally, and stays stable', () => {
    const names = (ids: number[]) => ids.map((i) => ctx.nodeObjects[i].name)
    const byName = (i: number) => nodeCell(i, 'name')
    expect(names(sortRows([0, 1, 2, 3], byName, 1))).toEqual([
      'A',
      'B',
      'n2',
      'n10',
    ])
    expect(names(sortRows([0, 1, 2, 3], byName, -1))).toEqual([
      'n10',
      'n2',
      'B',
      'A',
    ])
    ctx.nodeObjects[2].setScale(0.5)
    ctx.nodeObjects[0].setScale(3)
    const bySize = (i: number) => nodeCell(i, 'scale')
    // equal sizes keep their order (1, 3, 4)
    expect(sortRows(all(5), bySize, 1)).toEqual([2, 1, 3, 4, 0])
  })

  it('an edit in a ticked row changes every ticked row in the list', () => {
    const ticked = new Set([1, 3, 4])
    const isTicked = (i: number) => ticked.has(i)
    expect(editTargets(3, [0, 1, 2, 3], isTicked)).toEqual([1, 3])
    expect(editTargets(2, [0, 1, 2, 3], isTicked)).toEqual([2])
  })
})

describe('values', () => {
  it('turns typed node values into patches, within the limits', () => {
    expect(nodePatch('color', '#00FF00')).toEqual({ color: '#00ff00' })
    expect(nodePatch('color', 'green')).toBeNull()
    expect(nodePatch('shape', 'box')).toEqual({ shape: 'box' })
    expect(nodePatch('shape', 'blob')).toBeNull()
    expect(nodePatch('scale', '2.5')).toEqual({ scale: 2.5 })
    expect(nodePatch('scale', '500')).toEqual({ scale: 20 })
    expect(nodePatch('scale', '')).toBeNull()
    expect(nodePatch('scale', 'big')).toBeNull()
    expect(nodePatch('alpha', '0')).toEqual({ alpha: 0.05 })
    expect(nodePatch('label', '  Hub ')).toEqual({ label: 'Hub' })
    expect(nodePatch('descr', 'x'.repeat(3000))?.descr).toHaveLength(2000)
    expect(nodePatch('labelColor', '')).toEqual({ labelColor: '' })
    expect(nodePatch('labelSize', '')).toEqual({ labelSize: 0 })
    expect(nodePatch('labelSize', '100')).toEqual({ labelSize: 60 })
    expect(borderPatch('#FF0000', '3')).toEqual({
      border: { color: '#ff0000', width: 3 },
    })
    expect(borderPatch('#ff0000', 'thick')).toBeNull()
  })

  it('turns label styles, colours and positions into patches', () => {
    expect(nodePatch('labelStyle', 'halo')).toEqual({
      labelLook: {
        style: 'halo',
        color: '',
        width: 2,
        opacity: 0.75,
        bold: false,
      },
    })
    expect(nodePatch('labelStyle', '')).toEqual({ labelLook: null })
    expect(nodePatch('labelStyle', 'sparkly')).toBeNull()
    expect(nodePatch('labelColor', '')).toEqual({ labelColor: '' })
    expect(nodePatch('labelPosition', 'Above')).toEqual({
      labelPosition: 'above',
    })
    expect(nodePatch('labelPosition', '')).toEqual({ labelPosition: 'right' })
    expect(nodePatch('labelPosition', 'left')).toBeNull()
    expect(nodePatch('labelShown', 'true')).toEqual({ labelShown: true })
    expect(nodePatch('labelShown', 'Yes')).toEqual({ labelShown: true })
    expect(nodePatch('labelShown', 'false')).toEqual({ labelShown: false })
    expect(nodePatch('labelShown', '')).toEqual({ labelShown: false })
    expect(nodePatch('labelShown', 'maybe')).toBeNull()
    expect(nodeCell(0, 'labelStyle')).toBe('')
  })

  it('turns typed edge values into patches', () => {
    expect(edgePatch('color', '#0000ff')).toEqual({ color: '#0000ff' })
    expect(edgePatch('width', '3')).toEqual({ widthFactor: 3 })
    expect(edgePatch('width', '0')).toEqual({ widthFactor: 0.1 })
    expect(edgePatch('opacity', '2')).toEqual({ opacityFactor: 1 })
    expect(edgePatch('lineType', 'dotted')).toEqual({ lineType: 'dotted' })
    expect(edgePatch('lineType', 'wavy')).toBeNull()
    expect(edgePatch('arrowColor', '')).toEqual({ arrowColor: '' })
  })
})

describe('edits', () => {
  it('a bulk node edit is one undo step', () => {
    ctx.nodeObjects[0].setColor('#123456', true)
    expect(editNodes([0, 1, 2], { color: '#ff00ff', shape: 'box' })).toBe(3)
    expect([0, 1, 2].map((i) => nodeCell(i, 'color'))).toEqual(
      Array(3).fill('#ff00ff')
    )
    expect(ctx.nodeObjects[2].shape).toBe('box')
    expect(ctx.nodeObjects[3].shape).toBe('sphere')
    history.undo()
    expect(nodeCell(0, 'color')).toBe('#123456')
    expect(nodeCell(1, 'color')).toBe('#111111')
    expect(ctx.nodeObjects[2].shape).toBe('sphere')
    history.redo()
    expect(nodeCell(1, 'color')).toBe('#ff00ff')
  })

  it('a bulk edge edit is one undo step, every channel lane included', () => {
    editEdges([0, 1], { color: '#abcdef', widthFactor: 2.5 })
    expect(ctx.edgeObjects[0].colors).toEqual(['#abcdef', '#abcdef'])
    expect(edgeCell(1, 'width')).toBe(2.5)
    expect(edgeCell(2, 'width')).toBe(1)
    history.undo()
    expect(ctx.edgeObjects[0].colors).not.toContain('#abcdef')
    expect(edgeCell(1, 'width')).toBe(1)
  })

  it('nothing to edit records no step', () => {
    expect(history.canUndo).toBe(false)
    expect(editNodes([], { color: '#ffffff' })).toBe(0)
    expect(history.canUndo).toBe(false)
  })

  it('ticking adds to the scene selection, unticking takes out', () => {
    ctx.nodeObjects[4].isSelected = true
    tickNodes([0, 1], true)
    expect(filterNodes({ selectedOnly: true })).toEqual([0, 1, 4])
    tickNodes([1, 4], false)
    expect(filterNodes({ selectedOnly: true })).toEqual([0])
    tickEdges([0, 2], true)
    tickEdges([0], false)
    expect(filterEdges({ selectedOnly: true })).toEqual([2])
  })
})

describe('export and reload', () => {
  it('writes node attribute files that File → Node attributes reads', () => {
    const n = ctx.nodeObjects[1]
    n.setColor('#FF0000', true)
    n.setScale(2)
    n.setGeometry('box')
    n.setAlpha(0.5)
    n.label = 'Hub'
    n.labelSize = 20
    n.descr = 'tab\there'
    n.annotations = ['GO:1', 'GO:2']
    const [head, , row] = nodeAttributesTsv().split('\n')
    expect(head.split('\t').slice(0, 4)).toEqual([
      'Node',
      'Layer',
      'Color',
      'Size',
    ])
    expect(row.split('\t')).toEqual([
      'B',
      'L1',
      '#ff0000',
      '2',
      'box',
      '0.5',
      'Hub',
      '',
      '20',
      '', // label style: as the label style
      '', // label position: right, as always
      '', // bold: no
      '', // label shown: as Show Labels says
      '',
      'tab here',
      'GO:1;GO:2',
    ])
  })

  it('writes and reads label styles and positions', () => {
    const n = ctx.nodeObjects[0]
    n.labelLook = {
      style: 'halo',
      color: '#ffffff',
      width: 3,
      opacity: 0.75,
      bold: true,
    }
    n.labelPosition = 'centre'
    n.labelShown = true
    const lines = nodeAttributesTsv().split('\n')
    const cols = lines[0].split('\t')
    const row = lines[1].split('\t')
    // bold has its own column
    expect(row[cols.indexOf('LabelStyle')]).toBe('halo #ffffff 3')
    expect(row[cols.indexOf('LabelBold')]).toBe('yes')
    expect(row[cols.indexOf('LabelPosition')]).toBe('centre')
    expect(row[cols.indexOf('LabelShown')]).toBe('yes')
    applyNodeAttributes([
      {
        node_layer: 'B_L1',
        color: null,
        size: null,
        url: null,
        description: null,
        label_style: 'Box 0.5',
        label_position: 'Below',
        label_shown: true,
        label_bold: true,
      },
    ])
    const b = ctx.nodeObjects[1]
    expect(b.labelLook).toEqual({
      style: 'box',
      color: '',
      width: 2,
      opacity: 0.5,
      bold: true, // LabelBold
    })
    expect(b.labelPosition).toBe('below')
    // a pinned label from the file shows: Show Labels went to Chosen
    expect(b.labelShown).toBe(true)
    expect(nodeLabelState()).toEqual({ mode: 'chosen', withSelection: true })
    expect(b.showLabel).toBe(true)
  })

  it('writes one edge row per channel, in the edge attribute format', () => {
    ctx.edgeObjects[0].widthFactor = 2
    ctx.edgeObjects[0].lineType = 'dashed'
    ctx.edgeObjects[0].arrowColor = '#00F'
    const lines = edgeAttributesTsv().trim().split('\n')
    expect(lines[0]).toBe(
      'SourceNode\tSourceLayer\tTargetNode\tTargetLayer\tChannel\tColor\tWidth\tOpacity\tLineType\tArrowColor'
    )
    expect(lines).toHaveLength(1 + 2 + 1 + 1) // A–B has two channels
    expect(lines[1]).toBe('A\tL1\tB\tL1\tppi\t#ff0000\t2\t1\tdashed\t#0000ff')
    expect(lines[2].split('\t').slice(4, 6)).toEqual(['coexp', '#00ff00'])
    expect(lines[3].split('\t')[4]).toBe('') // no channel
  })

  it('the attribute loaders read the new columns back', () => {
    applyNodeAttributes([
      {
        node_layer: 'B_L1',
        color: '#ff0000',
        size: 2,
        url: null,
        description: null,
        shape: 'cube', // a label works as well as a key
        opacity: 0.4,
        label: 'Hub',
        label_color: '#00ff00',
        label_size: 18,
      },
    ])
    const n = ctx.nodeObjects[1]
    expect([n.shape, n.alpha, n.label, n.labelColor, n.labelSize]).toEqual([
      'box',
      0.4,
      'Hub',
      '#00ff00',
      18,
    ])
    applyEdgeAttributes([
      {
        edge_pair: 'A_L1---n10_L1',
        color: '#0000ff',
        channel: null,
        width: 3,
        opacity: 0.5,
        line_type: 'dotted',
        arrow_color: '#ff00ff',
      },
    ])
    const e = ctx.edgeObjects[1]
    expect([e.widthFactor, e.opacityFactor, e.lineType, e.arrowColor]).toEqual([
      3,
      0.5,
      'dotted',
      '#ff00ff',
    ])
  })

  it('reads label looks in any order, and refuses unknown words', () => {
    expect(labelLookFromText('bold 2.5 HALO')).toEqual({
      style: 'halo',
      color: '',
      width: 2.5,
      opacity: 0.75,
      bold: true,
    })
    expect(labelLookFromText('shadow #000000')?.color).toBe('#000000')
    expect(labelLookFromText('halo 99')?.width).toBe(8) // within the limits
    expect(labelLookFromText('')).toBeNull()
    expect(labelLookFromText('neon')).toBeUndefined()
    expect(labelLookFromText('#ffffff')).toBeUndefined() // no style
    const look = labelLookFromText('box #222222 0.4 bold')!
    expect(labelLookFromText(labelLookText(look))).toEqual(look)
  })

  it('reads shapes by key or label', () => {
    expect(shapeFromText('Cube')).toBe('box')
    expect(shapeFromText(' hexagonal prism ')).toBe('hexagon')
    expect(shapeFromText('torus')).toBe('torus')
    expect(shapeFromText('blob')).toBeNull()
  })
})

describe('picking edges', () => {
  it('measures the distance to a segment', () => {
    expect(segmentDistance(5, 3, 0, 0, 10, 0)).toBe(3)
    expect(segmentDistance(-4, 3, 0, 0, 10, 0)).toBe(5) // past an end
    expect(segmentDistance(1, 1, 2, 2, 2, 2)).toBeCloseTo(Math.SQRT2)
  })

  it('picks the edge nearest the point, within the radius', () => {
    // A at (0, 0), B at (100, 0) on screen = the middle of the canvas
    const at = (x: number, y: number) => [ctx.xBoundMax + x, ctx.yBoundMax - y]
    const [x, y] = at(50, 3)
    expect(pickEdge(x, y)).toBe(0)
    const [x2, y2] = at(-2, 60)
    expect(pickEdge(x2, y2)).toBe(1) // A–n10, upwards
    const [x3, y3] = at(50, 40)
    expect(pickEdge(x3, y3)).toBe(-1)
    ctx.layers[0].isVisible = false
    expect(pickEdge(x, y)).toBe(-1) // hidden floor
  })
})
