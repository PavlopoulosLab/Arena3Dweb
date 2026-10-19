import { beforeEach, describe, expect, it } from 'vitest'
import { store } from '../store'
import { ctx, Edge, Layer, Node, resetContext, Scene } from '../three'
import {
  executeCommand,
  registerSelectionAction,
  selectionMenu,
  selectDownstreamPath,
  selectMultiLayerPath,
  selectNeighbors,
} from './right_click_menu'

// Three layers; A,D on L1, B on L2, C on L3.
// Edges: A-B (inter), B-C (inter), A-D (intra L1).
function seed(): void {
  ctx.scene = new Scene()
  ctx.layers = [
    new Layer({ id: 0, name: 'L1' }),
    new Layer({ id: 1, name: 'L2' }),
    new Layer({ id: 2, name: 'L3' }),
  ]
  ctx.layerGroups = { L1: 0, L2: 1, L3: 2 }
  ctx.nodeGroups = { A_L1: 'L1', B_L2: 'L2', C_L3: 'L3', D_L1: 'L1' }
  ctx.nodeLayerNames = ['A_L1', 'B_L2', 'C_L3', 'D_L1']
  ctx.nodeObjects = ctx.nodeLayerNames.map(
    (nl, i) =>
      new Node({
        id: i,
        name: nl.split('_')[0],
        nodeLayerName: nl,
        layer: ctx.nodeGroups[nl],
      })
  )
  ctx.nodeObjects.forEach((n, i) =>
    ctx.layers[ctx.layerGroups[ctx.nodeGroups[ctx.nodeLayerNames[i]]]].addNode(
      n.sphere
    )
  )
  ctx.edgeObjects = [
    new Edge({
      id: 0,
      source: 'A_L1',
      target: 'B_L2',
      weights: [1],
      interLayer: true,
    }),
    new Edge({
      id: 1,
      source: 'B_L2',
      target: 'C_L3',
      weights: [1],
      interLayer: true,
    }),
    new Edge({ id: 2, source: 'A_L1', target: 'D_L1', weights: [1] }),
  ]
}

const selectedNodes = (): number[] =>
  ctx.nodeObjects.filter((n) => n.isSelected).map((n) => n.id)

beforeEach(() => {
  resetContext()
  store.update({ selectedNodes: [] })
  seed()
})

describe('selectNeighbors', () => {
  it('selects direct neighbors and their edges (inter and intra)', () => {
    selectNeighbors(0) // A
    expect(selectedNodes()).toEqual([1, 3]) // B and D
    expect(ctx.edgeObjects[0].isSelected).toBe(true)
    expect(ctx.edgeObjects[2].isSelected).toBe(true)
    expect(ctx.edgeObjects[1].isSelected).toBe(false)
  })
})

describe('selectMultiLayerPath', () => {
  it('walks across layers, skipping the starting and current layer', () => {
    selectMultiLayerPath(0) // A: -> B (L2) -> C (L3); D (L1) excluded
    expect(selectedNodes()).toEqual([1, 2])
  })
})

describe('selectDownstreamPath', () => {
  it('follows inter-layer edges into unvisited layers only', () => {
    selectDownstreamPath(0) // A -> B -> C; D shares the starting layer
    expect(selectedNodes()).toEqual([1, 2])
    expect(ctx.edgeObjects[0].isSelected).toBe(true)
    expect(ctx.edgeObjects[1].isSelected).toBe(true)
    expect(ctx.edgeObjects[2].isSelected).toBe(false)
  })
})

describe('executeCommand', () => {
  it('runs the command, raises render flags and syncs the store', () => {
    executeCommand(0, 'Select Neighbors')
    expect(ctx.renderInterLayerEdgesFlag).toBe(true)
    expect(store.get().selectedNodes).toEqual(['B_L2', 'D_L1'])
  })

  it('"-" is a no-op', () => {
    executeCommand(0, '-')
    expect(selectedNodes()).toEqual([])
    expect(ctx.renderInterLayerEdgesFlag).toBe(false)
  })
})

describe('the selection group', () => {
  it('is empty without a selection; lists the actions in order otherwise', () => {
    expect(selectionMenu([])).toEqual([])
    const ran: number[][] = []
    registerSelectionAction({
      label: 'Early action',
      order: 1,
      run: (sel) => ran.push(sel),
    })
    registerSelectionAction({
      label: (sel) => `Only for pairs (${sel.length})`,
      when: (sel) => sel.length === 2,
      run: () => undefined,
    })
    const one = selectionMenu([0]).map((a) => a.label)
    expect(one[0]).toBe('Early action')
    expect(one).toContain('Focus Camera on Selection')
    expect(one).toContain('Copy Names (1)')
    expect(one).not.toContain('Only for pairs (1)')
    expect(selectionMenu([0, 1]).map((a) => a.label)).toContain(
      'Only for pairs (2)'
    )
    selectionMenu([0, 3])[0].run()
    expect(ran).toEqual([[0, 3]])
  })
})
