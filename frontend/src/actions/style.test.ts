import { beforeEach, describe, expect, it } from 'vitest'
import { Edge, Layer, Node, Scene, ctx, resetContext } from '../three'
import { history } from '../commands/base'
import {
  CATEGORICAL,
  OKABE_ITO,
  OTHER,
  categoricalColors,
  sequentialColor,
  surfaceOf,
} from './palettes'
import {
  colorBlindMode,
  colorNodesBy,
  edgeTargets,
  nodeTargets,
  styleEdges,
  styleNodes,
} from './style'

beforeEach(() => {
  resetContext()
  ctx.scene = new Scene()
  ctx.layers = ['L1', 'L2'].map(
    (name, id) => new Layer({ id, name, geometry_parameters_width: 100 })
  )
  ctx.layerGroups = { L1: 0, L2: 1 }
  const nodes: [string, string][] = [
    ['A', 'L1'],
    ['B', 'L1'],
    ['A', 'L2'],
  ]
  ctx.nodeLayerNames = nodes.map(([n, l]) => `${n}::${l}`)
  ctx.nodeGroups = Object.fromEntries(nodes.map(([n, l]) => [`${n}::${l}`, l]))
  ctx.nodeObjects = nodes.map(
    ([n, l], i) =>
      new Node({
        id: i,
        name: n,
        nodeLayerName: `${n}::${l}`,
        layer: l,
        color: '#111111',
      })
  )
  ctx.edgeObjects = [
    new Edge({ source: 'A::L1', target: 'B::L1', weights: [1] }),
    new Edge({
      source: 'A::L1',
      target: 'A::L2',
      weights: [1],
      interLayer: true,
    }),
  ]
})

describe('palettes', () => {
  it('assigns in fixed order and folds past the palette into grey', () => {
    const keys = Array.from({ length: 10 }, (_, i) => `g${i}`)
    const c = categoricalColors(keys, 'dark')
    expect(c.get('g0')).toBe(CATEGORICAL.dark[0])
    expect(c.get('g7')).toBe(CATEGORICAL.dark[7])
    expect(c.get('g8')).toBe(OTHER)
    expect(categoricalColors(['x'], 'light', 'okabeIto').get('x')).toBe(
      OKABE_ITO[0]
    )
  })

  it('sequential ramps stay distinct from the background', () => {
    expect(sequentialColor(1, 'dark')).not.toBe(sequentialColor(0, 'dark'))
    expect(sequentialColor(0, 'dark', 'cividis')).not.toBe(
      sequentialColor(1, 'dark', 'cividis')
    )
    expect(surfaceOf('#000000')).toBe('dark')
    expect(surfaceOf('#ffffff')).toBe('light')
  })
})

describe('style commands', () => {
  it('targets nodes and edges', () => {
    ctx.nodeObjects[1].isSelected = true
    expect(nodeTargets('selected')).toEqual([1])
    expect(nodeTargets('layer:L2')).toEqual([2])
    expect(edgeTargets('inter')).toEqual([1])
  })

  it('styles nodes (colour, size, shape) and undoes in one step', () => {
    styleNodes('layer:L1', { color: '#ff0000', scale: 2, shape: 'box' })
    expect(ctx.nodeObjects[0].color).toBe('#ff0000')
    expect(ctx.nodeObjects[0].getScale()).toBe(2)
    expect(ctx.nodeObjects[1].shape).toBe('box')
    expect(ctx.nodeObjects[2].shape).toBe('sphere')
    history.undo()
    expect(ctx.nodeObjects[0].color).toBe('#111111')
    expect(ctx.nodeObjects[0].getScale()).toBe(1)
    expect(ctx.nodeObjects[1].shape).toBe('sphere')
  })

  it('styles edges and undoes', () => {
    styleEdges('intra', { color: '#00ff00', widthFactor: 3 })
    expect(ctx.edgeObjects[0].colors).toEqual(['#00ff00'])
    expect(ctx.edgeObjects[0].widthFactor).toBe(3)
    expect(ctx.edgeObjects[1].widthFactor).toBe(1)
    history.undo()
    expect(ctx.edgeObjects[0].widthFactor).toBe(1)
  })

  it('colours by layer with the palette order of the layers', () => {
    colorNodesBy('all', 'layer', 'okabeIto')
    expect(ctx.nodeObjects[0].color).toBe(OKABE_ITO[0])
    expect(ctx.nodeObjects[2].color).toBe(OKABE_ITO[1])
  })

  it('colour-blind mode recolours, adds shapes per layer, undoes as one step', () => {
    colorBlindMode()
    expect(ctx.nodeObjects[0].color).toBe(OKABE_ITO[0])
    expect(ctx.nodeObjects[2].shape).toBe('box') // layer 2 -> second shape
    history.undo()
    expect(ctx.nodeObjects[0].color).toBe('#111111')
    expect(ctx.nodeObjects[2].shape).toBe('sphere')
  })
})
