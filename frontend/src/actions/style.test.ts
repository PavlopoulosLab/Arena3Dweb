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
  TOL_BRIGHT,
  categoricalColors,
  sequentialColor,
  surfaceOf,
} from './palettes'
import { contrast } from './palette'
import { nodeLabelState, setNodeLabelMode } from './node'
import {
  chooseLabels,
  clearChosenLabels,
  colorBlindMode,
  colorLabelsBy,
  colorNodesBy,
  edgeTargets,
  nodeTargets,
  layerLabelColors,
  showLabelsOf,
  styleEdges,
  styleLabelLooks,
  styleLayerLabels,
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
    expect(categoricalColors(['x', 'y'], 'dark', 'tol').get('y')).toBe(
      TOL_BRIGHT[1]
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

  it('sets label looks and positions, undoes in one step', () => {
    const look = {
      style: 'halo' as const,
      color: '',
      width: 3,
      opacity: 0.75,
      bold: true,
    }
    styleNodes('layer:L1', { labelLook: look, labelPosition: 'centre' })
    const [a, b, c] = ctx.nodeObjects
    expect(a.labelLook).toEqual(look)
    expect(a.labelLook).not.toBe(look) // a copy, so later edits stay apart
    expect(b.labelPosition).toBe('centre')
    expect([c.labelLook, c.labelPosition]).toEqual([null, 'right'])
    history.undo()
    expect([a.labelLook, a.labelPosition]).toEqual([null, 'right'])
  })

  it('colours labels by group, from the node or against it, not the nodes', () => {
    ctx.nodeObjects[2].setColor('#ffff00', true)
    expect(colorLabelsBy('all', 'layer', 'okabeIto')).toBe(2)
    const [a, b, c] = ctx.nodeObjects
    expect(a.labelColor).toBe(b.labelColor) // same layer, same colour
    expect(a.labelColor).not.toBe(c.labelColor)
    expect(a.color).toBe('#111111') // the nodes keep theirs
    // readable on the (black, headless) background
    expect(contrast(a.labelColor, '#000000')).toBeGreaterThanOrEqual(3)
    colorLabelsBy('all', 'contrast')
    expect([a.labelColor, c.labelColor]).toEqual(['#ffffff', '#111111'])
    colorLabelsBy('layer:L2', 'match')
    expect(c.labelColor).toBe('#ffff00')
    history.undo()
    history.undo()
    history.undo()
    expect(ctx.nodeObjects.map((n) => n.labelColor)).toEqual(['', '', ''])
  })

  it('pinned labels show with Chosen, and the selection with its tick', () => {
    const [a, b, c] = ctx.nodeObjects
    b.isSelected = true
    setNodeLabelMode('chosen', false)
    showLabelsOf([0])
    expect([a.showLabel, b.showLabel, c.showLabel]).toEqual([
      true,
      false,
      false,
    ])
    setNodeLabelMode('chosen', true) // and the selection's
    expect([a.showLabel, b.showLabel, c.showLabel]).toEqual([true, true, false])
    setNodeLabelMode('selected')
    expect([a.showLabel, b.showLabel]).toEqual([false, true])
    setNodeLabelMode('none')
    expect(b.showLabel).toBe(false)
  })

  it('pinning moves Show Labels to Chosen; undo moves it back', () => {
    const [a, b] = ctx.nodeObjects
    b.isSelected = true
    setNodeLabelMode('selected')
    showLabelsOf([0])
    // from Selected: Chosen, keeping the selection's labels
    expect(nodeLabelState()).toEqual({ mode: 'chosen', withSelection: true })
    expect([a.labelShown, a.showLabel, b.showLabel]).toEqual([true, true, true])
    history.undo()
    expect(nodeLabelState().mode).toBe('selected')
    expect([a.labelShown, a.showLabel]).toEqual([false, false])
    // from None: Chosen alone; All stays All
    setNodeLabelMode('none')
    showLabelsOf([0, 2])
    expect(nodeLabelState()).toEqual({ mode: 'chosen', withSelection: false })
    expect(b.showLabel).toBe(false)
    expect(clearChosenLabels()).toBe(2)
    expect(ctx.nodeObjects.some((n) => n.labelShown)).toBe(false)
    setNodeLabelMode('all')
    showLabelsOf([1])
    expect(nodeLabelState().mode).toBe('all')
  })

  it('the label picker chooses all, none, the inverse or the selection', () => {
    const [a, b, c] = ctx.nodeObjects
    b.isSelected = true
    expect(chooseLabels([0, 1], 'all')).toBe(2)
    expect([a.labelShown, b.labelShown, c.labelShown]).toEqual([
      true,
      true,
      false,
    ])
    expect(chooseLabels([0, 1, 2], 'invert')).toBe(1)
    expect([a.labelShown, b.labelShown, c.labelShown]).toEqual([
      false,
      false,
      true,
    ])
    // the selected nodes in the list, and only them
    expect(chooseLabels([0, 1, 2], 'selected')).toBe(1)
    expect([a.labelShown, b.labelShown, c.labelShown]).toEqual([
      false,
      true,
      false,
    ])
    expect(chooseLabels([0, 1, 2], 'none')).toBe(0)
    history.undo() // each choice one step
    expect(b.labelShown).toBe(true)
    expect(chooseLabels([], 'all')).toBe(0)
  })

  it('bold or a style for many labels keeps each one its own look', () => {
    const [a, b] = ctx.nodeObjects
    a.labelLook = {
      style: 'box',
      color: '#222222',
      width: 2,
      opacity: 0.4,
      bold: false,
    }
    styleLabelLooks([0, 1], { bold: true })
    expect(a.labelLook).toMatchObject({
      style: 'box',
      opacity: 0.4,
      bold: true,
    })
    expect(b.labelLook).toMatchObject({ style: 'halo', bold: true }) // the default
    history.undo()
    expect(a.labelLook?.bold).toBe(false)
    expect(b.labelLook).toBeNull()
  })

  it('styles layer labels for some layers, with their colours; undo', () => {
    const [l1, l2] = ctx.layers
    const colors = layerLabelColors([0, 1], 'palette', '#000000', 'okabeIto')
    expect(colors.get(0)).not.toBe(colors.get(1))
    expect(layerLabelColors([1], 'one', '#123456').get(1)).toBe('#123456')
    expect(layerLabelColors([0], 'theme').get(0)).toBe('')
    expect(layerLabelColors([0], 'layer').get(0)).toMatch(/^#[0-9a-f]{6}$/)
    styleLayerLabels([1], () => ({
      look: { style: 'box', color: '', width: 2, opacity: 0.5, bold: true },
      font: 'condensed',
      bold: true,
      italic: true,
      color: '#123456',
      position: 'below',
    }))
    expect([l2.labelFont, l2.labelBold, l2.labelItalic]).toEqual([
      'condensed',
      true,
      true,
    ])
    expect([l2.labelColor, l2.labelPosition, l2.labelLook?.style]).toEqual([
      '#123456',
      'below',
      'box',
    ])
    expect([l1.labelFont, l1.labelPosition]).toEqual(['', 'corner'])
    history.undo()
    expect([l2.labelFont, l2.labelColor, l2.labelLook]).toEqual(['', '', null])
  })

  it('hangs layer labels at the corner, or centred above or under the floor', () => {
    const l = ctx.layers[0] // 100 wide, the floor in its y-z plane
    const corner = l.labelAnchor()
    l.labelPosition = 'above'
    const [ax, ay] = l.labelAnchor()
    l.labelPosition = 'below'
    const [bx, by] = l.labelAnchor()
    expect(ay).toBeCloseTo(50)
    expect(by).toBeCloseTo(-50)
    expect(ax).toBeCloseTo(bx) // both centred
    expect(corner[1]).toBeCloseTo(-50) // the outer corner, as before
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
