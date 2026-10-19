import { beforeEach, describe, expect, it } from 'vitest'
import type { AppConfig } from '../api/config'
import type { EdgeModel, NetworkData } from '../api/client'
import { history } from '../commands/base'
import { store } from '../store'
import { ctx, resetContext } from '../three'
import { buildNetwork, loadNetwork } from './network'

function edge(partial: Partial<EdgeModel>): EdgeModel {
  return {
    src: 'A_L1',
    trg: 'B_L2',
    source_node: 'A',
    source_layer: 'L1',
    target_node: 'B',
    target_layer: 'L2',
    weight: 1,
    scaled_weight: 1,
    channel: null,
    ...partial,
  }
}

function network(partial: Partial<NetworkData> = {}): NetworkData {
  return {
    layers: ['L1', 'L2'],
    channels: [],
    warnings: [],
    nodes: [
      { id: 'A_L1', label: 'A', layer: 'L1' },
      { id: 'B_L2', label: 'B', layer: 'L2' },
      { id: 'C_L1', label: 'C', layer: 'L1' },
    ],
    edges: [
      edge({}),
      edge({ trg: 'C_L1', target_node: 'C', target_layer: 'L1' }),
    ],
    ...partial,
  }
}

beforeEach(() => {
  resetContext()
  store.update({
    config: {
      max_channels: 2,
      channel_colors_light: ['#8dd3c7', '#ffffb3'],
    } as AppConfig,
  })
})

describe('buildNetwork', () => {
  it('builds layers, nodes and edges into ctx', () => {
    buildNetwork(network())
    expect(ctx.layers.map((l) => l.name)).toEqual(['L1', 'L2'])
    expect(ctx.nodeObjects).toHaveLength(3)
    expect(ctx.nodeLayerNames).toEqual(['A_L1', 'B_L2', 'C_L1'])
    expect(ctx.nodeGroups['C_L1']).toBe('L1')
    expect(ctx.edgeObjects).toHaveLength(2)
    expect(ctx.edgeObjects[0].interLayer).toBe(true)
    expect(ctx.edgeObjects[1].interLayer).toBe(false)
    // layers spread apart on x, nodes scrambled onto their layer
    expect(ctx.layers[0].getPosition('x')).not.toBe(
      ctx.layers[1].getPosition('x')
    )
  })

  it('collapses same-pair channel rows into one Edge with channel colors', () => {
    buildNetwork(
      network({
        channels: ['ch1', 'ch2'],
        edges: [edge({ channel: 'ch1' }), edge({ channel: 'ch2' })],
      })
    )
    expect(ctx.edgeObjects).toHaveLength(1)
    expect(ctx.edgeObjects[0].channels).toEqual(['ch1', 'ch2'])
    expect(ctx.edgeObjects[0].colors).toEqual(['#8dd3c7', '#ffffb3'])
    expect(ctx.channelVisibility).toEqual({ ch1: true, ch2: true })
    expect(store.get().selectedChannels).toEqual(['ch1', 'ch2'])
  })
})

describe('loadNetwork', () => {
  it('is one undoable step; undo restores the previous (empty) registries', () => {
    loadNetwork(network())
    expect(ctx.nodeObjects).toHaveLength(3)
    expect(history.canUndo).toBe(true)
    history.undo()
    expect(ctx.nodeObjects).toHaveLength(0)
    expect(ctx.layers).toHaveLength(0)
    history.redo()
    expect(ctx.nodeObjects).toHaveLength(3)
  })

  it('rejects networks above the channel limit', () => {
    expect(() => loadNetwork(network({ channels: ['a', 'b', 'c'] }))).toThrow(
      /no more than 2 channels/
    )
  })
})
