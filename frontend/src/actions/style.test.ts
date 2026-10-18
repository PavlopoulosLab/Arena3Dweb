import { beforeEach, describe, expect, it } from 'vitest'
import type {
  ArrowHelper,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from 'three'
import type { Line2 } from 'three/addons/lines/Line2.js'
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

  it('sets opacity, border, proportions, labels and descriptions, undoes in one step', () => {
    ctx.nodeObjects[0].isSelected = true
    ctx.nodeObjects[1].isSelected = true
    styleNodes('selected', {
      alpha: 0.4,
      border: { color: '#ff0000', width: 2 },
      stretch: [1, 3, 0.5],
      label: 'Hub',
      labelColor: '#00ff00',
      labelSize: 20,
      descr: 'a hub',
    })
    const [a, b, c] = ctx.nodeObjects
    expect(a.alpha).toBe(0.4)
    expect((a.sphere.material as MeshStandardMaterial).opacity).toBe(0.4)
    expect(a.outline).not.toBeNull()
    expect(a.sphere.children).toContain(a.outline)
    expect(a.outline!.geometry).toBe(a.sphere.geometry)
    // width = z, height = y, depth = x (out of the floor); size stays 1
    expect(a.sphere.scale.toArray()).toEqual([0.5, 3, 1])
    expect(a.getScale()).toBe(1)
    expect([b.getLabel(), b.labelColor, b.labelSize, b.descr]).toEqual([
      'Hub',
      '#00ff00',
      20,
      'a hub',
    ])
    expect(c.getLabel()).toBe('A') // not selected
    expect(c.outline).toBeNull()
    history.undo()
    expect(a.alpha).toBe(1)
    expect(a.outline).toBeNull()
    expect(a.sphere.children).toHaveLength(0)
    expect(a.sphere.scale.toArray()).toEqual([1, 1, 1])
    expect([b.getLabel(), b.labelColor, b.labelSize, b.descr]).toEqual([
      'B',
      '',
      0,
      '',
    ])
  })

  it('keeps proportions through a resize and the outline through a new shape', () => {
    styleNodes('all', {
      stretch: [2, 1, 1],
      border: { color: '#fff', width: 1 },
    })
    const n = ctx.nodeObjects[0]
    n.setScale(3) // e.g. scaled by a topology metric
    expect(n.sphere.scale.toArray()).toEqual([3, 3, 6])
    styleNodes('all', { shape: 'box' })
    expect(n.outline!.geometry).toBe(n.sphere.geometry)
  })

  it('hover feedback is relative to the node opacity', () => {
    const n = ctx.nodeObjects[0]
    n.setAlpha(0.6)
    n.setOpacity(0.5)
    expect(n.getOpacity()).toBeCloseTo(0.3)
    n.setOpacity(1)
    expect(n.getOpacity()).toBeCloseTo(0.6)
  })

  it('sets edge opacity, line type and arrow colour, undoes', () => {
    ctx.isDirectionEnabled = true
    styleEdges('intra', {
      opacityFactor: 0.5,
      lineType: 'dashed',
      arrowColor: '#0000ff',
    })
    const e = ctx.edgeObjects[0]
    expect(e.decideOpacity()).toBeCloseTo(ctx.intraLayerEdgeOpacity * 0.5)
    expect(e.decideArrowColor('#cccccc')).toBe('#0000ff')
    const [line, arrow] = e.THREE_Object.children as [Line2, ArrowHelper]
    expect(line.material.dashed).toBe(true)
    expect(line.geometry.attributes.instanceDistanceStart).toBeDefined()
    expect(
      (arrow.cone.material as MeshBasicMaterial).color.getHexString()
    ).toBe('0000ff')
    expect(ctx.edgeObjects[1].lineType).toBe('solid')
    // the selection highlight wins over a custom arrow colour
    e.isSelected = true
    expect(e.decideArrowColor('#cccccc')).toBe('#cccccc')
    history.undo()
    expect([e.opacityFactor, e.lineType, e.arrowColor]).toEqual([
      1,
      'solid',
      '',
    ])
    expect((e.THREE_Object.children[0] as Line2).material.dashed).toBe(false)
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
