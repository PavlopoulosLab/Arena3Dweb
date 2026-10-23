import * as THREE from 'three'
import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, Edge, Layer, Node, resetContext, Scene } from '../three'
import {
  applyEdgeAttributes,
  setArrowLayers,
  setInterLayerArrows,
  renderInterLayerEdges,
  setChannelColor,
  setChannelVisibility,
  setEdgeWeightEncoding,
  setInterLayerEdgeOpacity,
  toggleInterLayerEdgesRendering,
} from './edge'

// Two layers, one node each, one inter-layer edge.
function seed(): void {
  ctx.scene = new Scene()
  ctx.layers = [
    new Layer({ id: 0, name: 'L1' }),
    new Layer({ id: 1, name: 'L2' }),
  ]
  ctx.layerGroups = { L1: 0, L2: 1 }
  ctx.nodeGroups = { A_L1: 'L1', B_L2: 'L2' }
  ctx.nodeLayerNames = ['A_L1', 'B_L2']
  ctx.nodeObjects = [
    new Node({ id: 0, name: 'A', nodeLayerName: 'A_L1', layer: 'L1' }),
    new Node({ id: 1, name: 'B', nodeLayerName: 'B_L2', layer: 'L2' }),
  ]
  ctx.layers[0].addNode(ctx.nodeObjects[0].sphere)
  ctx.layers[1].addNode(ctx.nodeObjects[1].sphere)
  ctx.edgeObjects = [
    new Edge({
      id: 0,
      source: 'A_L1',
      target: 'B_L2',
      weights: [1],
      interLayer: true,
    }),
  ]
}

beforeEach(() => {
  resetContext()
  seed()
})

describe('renderInterLayerEdges', () => {
  it('removes inter-layer edges while paused, redraws after unpausing', () => {
    const obj = ctx.edgeObjects[0].THREE_Object
    expect(ctx.scene!.exists()).toBe(true)

    toggleInterLayerEdgesRendering() // pause
    renderInterLayerEdges()
    expect(ctx.interEdgesRemoved).toBe(true)
    expect(ctx.scene!.THREE_Object.children).not.toContain(obj)

    toggleInterLayerEdgesRendering() // unpause raises the render flag
    expect(ctx.renderInterLayerEdgesFlag).toBe(true)
    renderInterLayerEdges()
    expect(ctx.interEdgesRemoved).toBe(false)
    expect(ctx.scene!.THREE_Object.children).toContain(
      ctx.edgeObjects[0].THREE_Object
    )
  })

  it('redraws for one extra tick, then clears the flag (locked-flag pair)', () => {
    ctx.renderInterLayerEdgesFlag = true
    renderInterLayerEdges() // tick 1: waitEdgeRenderFlag drops
    expect(ctx.renderInterLayerEdgesFlag).toBe(true)
    renderInterLayerEdges() // tick 2: flag clears, re-arms
    expect(ctx.renderInterLayerEdgesFlag).toBe(false)
    expect(ctx.waitEdgeRenderFlag).toBe(true)
  })

  it('removes edges when opacity is 0 and opacity-by-weight is off', () => {
    setEdgeWeightEncoding(false, false)
    setInterLayerEdgeOpacity(0)
    renderInterLayerEdges()
    expect(ctx.interEdgesRemoved).toBe(true)
  })
})

describe('channels', () => {
  it('setChannelColor updates the palette and raises the render flag', () => {
    ctx.renderInterLayerEdgesFlag = false
    setChannelColor('ch1', '#abcdef')
    expect(ctx.channelColors['ch1']).toBe('#abcdef')
    expect(ctx.renderInterLayerEdgesFlag).toBe(true)
  })

  it('setChannelVisibility toggles the tagged channel line', () => {
    ctx.channelColors = { ch1: '#ff0000' }
    ctx.edgeObjects = [
      new Edge({
        id: 0,
        source: 'A_L1',
        target: 'B_L2',
        weights: [1],
        channels: ['ch1'],
        colors: ['#ff0000'],
        interLayer: true,
      }),
    ]
    setChannelVisibility('ch1', false)
    const line = ctx.edgeObjects[0].THREE_Object.children.find(
      (c) => c.userData.tag === 'ch1'
    )
    expect(line?.visible).toBe(false)
    expect(ctx.channelVisibility['ch1']).toBe(false)
  })

  it('toggles the right channel when a sibling channel is too faint to draw', () => {
    // ch1 has weight 0, below EDGE_MIN_VISIBLE_OPACITY, so neither its line nor
    // its arrow is built at all; ch2 gets both. Children are therefore not a
    // fixed line/arrow interleave, which is why lookups go through
    // userData.tag — the old positional children[j+1] corrupted ch1 here.
    ctx.isDirectionEnabled = true
    ctx.channelColors = { ch1: '#ff0000', ch2: '#00ff00' }
    ctx.channelVisibility = { ch1: true, ch2: true }
    ctx.edgeObjects = [
      new Edge({
        id: 0,
        source: 'A_L1',
        target: 'B_L2',
        weights: [0, 1],
        channels: ['ch1', 'ch2'],
        colors: ['#ff0000', '#00ff00'],
        interLayer: true,
      }),
    ]
    setChannelVisibility('ch2', false)
    const children = ctx.edgeObjects[0].THREE_Object.children
    expect(children.filter((c) => c.userData.tag === 'ch1')).toHaveLength(0)
    const ch2 = children.filter((c) => c.userData.tag === 'ch2')
    expect(ch2.length).toBeGreaterThan(0)
    for (const c of ch2) expect(c.visible).toBe(false)
    ctx.isDirectionEnabled = false
  })
})

describe('arrowheads by layer', () => {
  const arrows = (e: Edge) => {
    let n = 0
    e.THREE_Object.traverse((o) => {
      if (o instanceof THREE.ArrowHelper) n++
    })
    return n
  }

  it('are drawn only in the chosen layers, and on links between layers by their own switch', () => {
    // a second node in L1, for an edge within L1
    ctx.nodeGroups.C_L1 = 'L1'
    ctx.nodeLayerNames.push('C_L1')
    ctx.nodeObjects.push(
      new Node({ id: 2, name: 'C', nodeLayerName: 'C_L1', layer: 'L1' })
    )
    ctx.layers[0].addNode(ctx.nodeObjects[2].sphere)
    ctx.isDirectionEnabled = true
    const edges = () => [
      new Edge({ id: 1, source: 'A_L1', target: 'C_L1', weights: [1] }),
      new Edge({
        id: 2,
        source: 'A_L1',
        target: 'B_L2',
        weights: [1],
        interLayer: true,
      }),
    ]
    expect(edges().map(arrows)).toEqual([1, 1]) // by default, everywhere
    setArrowLayers(['L2'])
    setInterLayerArrows(false)
    expect(edges().map(arrows)).toEqual([0, 0])
    setArrowLayers(['L1'])
    expect(edges().map(arrows)).toEqual([1, 0])
    ctx.isDirectionEnabled = false
    expect(edges().map(arrows)).toEqual([0, 0]) // and never without direction
  })
})

describe('applyEdgeAttributes', () => {
  it('recolors matching edges and forces file-color priority', () => {
    ctx.edgeObjects[0].channels = ['ppi']
    ctx.edgeObjects[0].colors = ['#111111']
    ctx.edgeObjects[0].importedColors = ['#111111']
    applyEdgeAttributes([
      { edge_pair: 'A_L1---B_L2', color: '#ff0000', channel: 'ppi' },
      { edge_pair: 'X_L1---Y_L2', color: '#00ff00', channel: null }, // no such edge
    ])
    expect(ctx.edgeObjects[0].importedColors[0]).toBe('#ff0000')
    expect(ctx.edgeObjects[0].colors[0]).toBe('#ff0000')
    expect(ctx.edgeFileColorPriority).toBe(true)
  })

  it('skips channels the edge does not carry', () => {
    ctx.edgeObjects[0].channels = ['ppi']
    ctx.edgeObjects[0].importedColors = ['#111111']
    applyEdgeAttributes([
      { edge_pair: 'A_L1---B_L2', color: '#ff0000', channel: 'coexpression' },
    ])
    expect(ctx.edgeObjects[0].importedColors[0]).toBe('#111111')
  })
})
