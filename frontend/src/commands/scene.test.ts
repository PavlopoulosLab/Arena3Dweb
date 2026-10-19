import { beforeEach, describe, expect, it } from 'vitest'
import { Node, Layer, Scene, Edge, ctx, resetContext } from '../three'
import {
  ChangeNodeColorCommand,
  ChangeNodeSizeCommand,
  ChangeEdgeColorCommand,
  MoveLayerCommand,
  ApplyLayoutCommand,
  ApplyTopologyCommand,
  ChangeThemeCommand,
  LoadNetworkCommand,
  ColorNodesByValueCommand,
  metricColor,
} from './scene'
import { store } from '../store'

// Minimal populated scene: one layer "L", nodes A/B, one intra edge A->B.
function seed(): void {
  const scene = new Scene()
  const layer = new Layer({ geometry_parameters_width: 100 })
  ctx.scene = scene
  ctx.layers = [layer]
  ctx.layerGroups = { L: 0 }
  ctx.nodeGroups = { 'A::L': 'L', 'B::L': 'L' }
  ctx.nodeLayerNames = ['A::L', 'B::L']
  ctx.nodeObjects = [
    new Node({
      name: 'A',
      nodeLayerName: 'A::L',
      layer: 'L',
      color: '#111111',
    }),
    new Node({
      name: 'B',
      nodeLayerName: 'B::L',
      layer: 'L',
      color: '#222222',
    }),
  ]
  ctx.edgeObjects = [new Edge({ source: 'A::L', target: 'B::L', weights: [1] })]
}

beforeEach(() => {
  resetContext()
  seed()
})

describe('ChangeNodeColorCommand', () => {
  it('executes, undoes and redoes', () => {
    const c = new ChangeNodeColorCommand(0, '#00ff00')
    c.execute()
    expect(ctx.nodeObjects[0].color).toBe('#00ff00')
    c.undo()
    expect(ctx.nodeObjects[0].color).toBe('#111111')
    c.execute() // redo
    expect(ctx.nodeObjects[0].color).toBe('#00ff00')
  })
})

describe('ChangeNodeSizeCommand', () => {
  it('executes and undoes', () => {
    const c = new ChangeNodeSizeCommand(1, 3)
    c.execute()
    expect(ctx.nodeObjects[1].getScale()).toBe(3)
    c.undo()
    expect(ctx.nodeObjects[1].getScale()).toBe(1)
  })
})

describe('ChangeEdgeColorCommand', () => {
  it('recolours the edge and restores colour + priority on undo', () => {
    expect(ctx.edgeFileColorPriority).toBe(false)
    const c = new ChangeEdgeColorCommand(0, '#abcdef')
    c.execute()
    expect(ctx.edgeObjects[0].colors).toEqual(['#abcdef'])
    expect(ctx.edgeObjects[0].importedColors).toEqual(['#abcdef'])
    expect(ctx.edgeFileColorPriority).toBe(true)
    c.undo()
    expect(ctx.edgeObjects[0].colors).toEqual([ctx.edgeDefaultColor])
    expect(ctx.edgeFileColorPriority).toBe(false)
  })
})

describe('MoveLayerCommand', () => {
  it('applies then reverts a layer transform', () => {
    const c = new MoveLayerCommand(0, {
      position: { x: 50 },
      rotation: { y: 0.3 },
    })
    c.execute()
    expect(ctx.layers[0].getPosition('x')).toBe(50)
    expect(ctx.layers[0].getRotation('y')).toBeCloseTo(0.3)
    c.undo()
    expect(ctx.layers[0].getPosition('x')).toBe(0)
    expect(ctx.layers[0].getRotation('y')).toBe(0)
  })
})

describe('ApplyLayoutCommand', () => {
  it('places nodes and restores previous positions', () => {
    const c = new ApplyLayoutCommand({ 'A::L': [5, 6], 'B::L': [-5, -6] })
    c.execute()
    expect(ctx.nodeObjects[0].getPosition('y')).toBe(5)
    expect(ctx.nodeObjects[0].getPosition('z')).toBe(6)
    expect(ctx.nodeObjects[0].getPosition('x')).toBe(0)
    c.undo()
    expect(ctx.nodeObjects[0].getPosition('y')).toBe(0)
    expect(ctx.nodeObjects[0].getPosition('z')).toBe(0)
  })

  it('sets depth for 3D positions and flattens on a later 2D layout', () => {
    const c3 = new ApplyLayoutCommand({ 'A::L': [1, 2, 30] })
    c3.execute()
    expect(ctx.nodeObjects[0].getPosition('x')).toBe(30)
    const c2 = new ApplyLayoutCommand({ 'A::L': [1, 2] })
    c2.execute()
    expect(ctx.nodeObjects[0].getPosition('x')).toBe(0)
    c2.undo() // undo restores the depth too
    expect(ctx.nodeObjects[0].getPosition('x')).toBe(30)
  })

  it('assigns clusters + colours and reverts them', () => {
    const c = new ApplyLayoutCommand(
      { 'A::L': [1, 1], 'B::L': [2, 2] },
      { 'A::L': 0, 'B::L': 1 }
    )
    c.execute()
    expect(ctx.nodeObjects[0].getCluster()).toBe('0')
    expect(ctx.nodeColorPrioritySource).toBe('cluster')
    c.undo()
    expect(ctx.nodeObjects[0].getCluster()).toBe('')
    expect(ctx.nodeColorPrioritySource).toBe('default')
  })
})

describe('ApplyTopologyCommand', () => {
  it('scales nodes and restores', () => {
    const c = new ApplyTopologyCommand('Degree', { 'A::L': 2.5, 'B::L': 0.5 })
    c.execute()
    expect(ctx.nodeObjects[0].getScale()).toBe(2.5)
    expect(ctx.nodeObjects[1].getScale()).toBe(0.5)
    c.undo()
    expect(ctx.nodeObjects[0].getScale()).toBe(1)
    expect(ctx.nodeObjects[1].getScale()).toBe(1)
  })
})

describe('ChangeThemeCommand', () => {
  it('drives a store setter and reverts', () => {
    let theme = 'dark'
    const c = new ChangeThemeCommand(
      'light',
      () => theme,
      (t) => (theme = t)
    )
    c.execute()
    expect(theme).toBe('light')
    c.undo()
    expect(theme).toBe('dark')
  })
})

describe('LoadNetworkCommand', () => {
  it('builds on execute, clears on undo, rebuilds on redo', () => {
    // Start from an empty context so we can observe the load.
    resetContext()
    const build = (): void => {
      ctx.scene = new Scene()
      ctx.layers = [new Layer({ geometry_parameters_width: 100 })]
      ctx.nodeLayerNames = ['X::L']
      ctx.nodeGroups = { 'X::L': 'L' }
      ctx.layerGroups = { L: 0 }
      ctx.nodeObjects = [
        new Node({ name: 'X', nodeLayerName: 'X::L', layer: 'L' }),
      ]
      ctx.edgeObjects = []
    }
    const c = new LoadNetworkCommand(build)
    c.execute()
    expect(ctx.nodeObjects).toHaveLength(1)
    c.undo()
    expect(ctx.nodeObjects).toHaveLength(0)
    expect(ctx.scene).toBeNull()
    c.execute() // redo
    expect(ctx.nodeObjects).toHaveLength(1)
  })
})

describe('TransformCommand', () => {
  it('restores node/layer transforms on undo', async () => {
    const { captureTransforms, TransformCommand } = await import('./scene')
    const before = captureTransforms()
    ctx.nodeObjects[0].setPosition('y', 42)
    ctx.layers[0].plane.position.set(1, 2, 3)
    const c = new TransformCommand('move', before, captureTransforms())
    c.undo()
    expect(ctx.nodeObjects[0].getPosition('y')).toBe(0)
    expect(ctx.layers[0].plane.position.x).toBe(0)
    c.execute() // redo
    expect(ctx.nodeObjects[0].getPosition('y')).toBe(42)
    expect(ctx.layers[0].plane.position.z).toBe(3)
  })
})

describe('ChangeChannelColorCommand', () => {
  it('sets and restores the channel color', async () => {
    const { ChangeChannelColorCommand } = await import('./scene')
    ctx.channelColors = { ppi: '#cfcfcf' }
    const c = new ChangeChannelColorCommand('ppi', '#ff0000')
    c.execute()
    expect(ctx.channelColors['ppi']).toBe('#ff0000')
    c.undo()
    expect(ctx.channelColors['ppi']).toBe('#cfcfcf')
  })
})

describe('ChangeFloorColorCommand', () => {
  it('rewinds picker color to previous, not the just-set value', async () => {
    const { ChangeFloorColorCommand } = await import('./scene')
    ctx.layerColorPrioritySource = 'picker'
    new ChangeFloorColorCommand('#111111').execute() // establishes prior picker
    const c = new ChangeFloorColorCommand('#ff0000')
    c.execute()
    expect(ctx.layers[0].color.toLowerCase()).toBe('#ff0000')
    c.undo()
    expect(ctx.layers[0].color.toLowerCase()).toBe('#111111')
  })
})

describe('LoadNetworkCommand store sync', () => {
  it('undo/redo restore store.network with the scene', () => {
    const before = {
      nodes: [],
      edges: [],
      layers: ['old'],
      channels: [],
      warnings: [],
    }
    const after = { ...before, layers: ['new'] }
    store.update({ network: before })
    const c = new LoadNetworkCommand(() => store.update({ network: after }))
    c.execute()
    expect(store.get().network?.layers).toEqual(['new'])
    c.undo()
    expect(store.get().network?.layers).toEqual(['old'])
    c.execute()
    expect(store.get().network?.layers).toEqual(['new'])
  })
})

describe('ColorNodesByValueCommand', () => {
  it('maps low/high to the gradient ends and undoes', () => {
    const before = ctx.nodeObjects.map((n) => n.color)
    const c = new ColorNodesByValueCommand({ 'A::L': 0, 'B::L': 10 })
    c.execute()
    expect(ctx.nodeObjects[0].color).toBe(`#${metricColor(0)}`)
    expect(ctx.nodeObjects[1].color).toBe(`#${metricColor(1)}`)
    expect(metricColor(0)).toBe('2c7bb6')
    expect(metricColor(1)).toBe('d7191c')
    c.undo()
    expect(ctx.nodeObjects.map((n) => n.color)).toEqual(before)
  })
})
