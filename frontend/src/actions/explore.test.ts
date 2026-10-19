import { beforeEach, describe, expect, it } from 'vitest'
import { Node, Layer, Scene, Edge, ctx, resetContext } from '../three'
import {
  clearPathHighlight,
  clearSelection,
  edgesBelowThreshold,
  expandSelection,
  highlightPathsBetweenSelected,
  invertSelection,
  selectByAttribute,
  selectByLinks,
  selectComponents,
  selectNodesOfSelectedLayers,
  selectPathBetweenSelected,
  shortestPath,
} from './explore'

// L1: A - B - C (chain). L2: C - D. Only C is in both layers (copies C@L1, C@L2).
function seed(): void {
  ctx.scene = new Scene()
  ctx.layers = [
    new Layer({ id: 0, name: 'L1', geometry_parameters_width: 100 }),
    new Layer({ id: 1, name: 'L2', geometry_parameters_width: 100 }),
  ]
  ctx.layerGroups = { L1: 0, L2: 1 }
  const nodes: [string, string][] = [
    ['A', 'L1'],
    ['B', 'L1'],
    ['C', 'L1'],
    ['C', 'L2'],
    ['D', 'L2'],
  ]
  ctx.nodeLayerNames = nodes.map(([n, l]) => `${n}::${l}`)
  ctx.nodeGroups = Object.fromEntries(nodes.map(([n, l]) => [`${n}::${l}`, l]))
  ctx.nodeObjects = nodes.map(
    ([n, l], i) =>
      new Node({ id: i, name: n, nodeLayerName: `${n}::${l}`, layer: l })
  )
  ctx.edgeObjects = [
    new Edge({ source: 'A::L1', target: 'B::L1', weights: [0.9] }),
    new Edge({ source: 'B::L1', target: 'C::L1', weights: [0.3] }),
    new Edge({ source: 'C::L2', target: 'D::L2', weights: [0.5] }),
  ]
}

beforeEach(() => {
  resetContext()
  seed()
})

const selected = () =>
  ctx.nodeObjects.flatMap((n, i) => (n.isSelected ? [i] : []))

describe('expandSelection', () => {
  it('grows by hops within layers', () => {
    ctx.nodeObjects[0].isSelected = true // A
    expect(expandSelection(1, 'within')).toBe(1) // + B
    expect(selected()).toEqual([0, 1])
    expandSelection(5, 'within')
    expect(selected()).toEqual([0, 1, 2]) // never reaches L2
  })

  it('crosses layers through copies of the same node', () => {
    ctx.nodeObjects[2].isSelected = true // C@L1
    expandSelection(2, 'across') // C@L2 at hop 1, D at hop 2
    expect(selected()).toContain(4)
  })
})

describe('shortestPath', () => {
  it('finds the layer-hopping path only in across mode', () => {
    expect(shortestPath(0, 4, 'within')).toBeNull()
    expect(shortestPath(0, 4, 'across')).toEqual([0, 1, 2, 3, 4])
  })

  it('selects the path edges between the two selected nodes', () => {
    ctx.nodeObjects[0].isSelected = true
    ctx.nodeObjects[2].isSelected = true
    expect(selectPathBetweenSelected('within')).toEqual([0, 1, 2])
    expect(ctx.edgeObjects.map((e) => e.isSelected)).toEqual([
      true,
      true,
      false,
    ])
    ctx.nodeObjects[1].isSelected = false
    expect(() => selectPathBetweenSelected('within')).not.toThrow() // 2 selected again
  })

  it('needs exactly two selected nodes', () => {
    expect(() => selectPathBetweenSelected('within')).toThrow(/exactly two/)
  })
})

describe('selectByAttribute', () => {
  it('matches description and annotations, case-insensitively', () => {
    ctx.nodeObjects[1].descr = 'Tumor suppressor'
    ctx.nodeObjects[4].annotations = ['p53 Signaling']
    expect(selectByAttribute('TUMOR')).toBe(1)
    expect(selectByAttribute('p53')).toBe(1)
    expect(selected()).toEqual([1, 4])
    expect(selectByAttribute('  ')).toBe(0)
  })
})

describe('edge weight threshold', () => {
  it('counts and hides edges below the threshold', () => {
    ctx.edgeWeightThreshold = 0.4
    expect(edgesBelowThreshold()).toBe(1)
    expect(ctx.edgeObjects[1].decideOpacity()).toBe(0)
    expect(ctx.edgeObjects[0].decideOpacity()).toBeGreaterThan(0)
  })
})

describe('whole-selection tools', () => {
  it('selects the connected component, within or across layers', () => {
    ctx.nodeObjects[0].isSelected = true
    expect(selectComponents('within')).toBe(2)
    expect(selected()).toEqual([0, 1, 2])
    expect(selectComponents('across')).toBe(2)
    expect(selected()).toEqual([0, 1, 2, 3, 4])
  })

  it('inverts and clears the selection, edges included', () => {
    ctx.nodeObjects[0].isSelected = true
    expect(invertSelection()).toBe(4)
    expect(selected()).toEqual([1, 2, 3, 4])
    ctx.edgeObjects[0].select()
    clearSelection()
    expect(selected()).toEqual([])
    expect(ctx.edgeObjects.some((e) => e.isSelected)).toBe(false)
  })

  it('selects the nodes of the selected layers', () => {
    expect(() => selectNodesOfSelectedLayers()).toThrow(/Select a layer/)
    ctx.layers[1].isSelected = true
    expect(selectNodesOfSelectedLayers()).toBe(2)
    expect(selected()).toEqual([3, 4])
  })

  it('selects the hubs: nodes with at least N links', () => {
    expect(selectByLinks(2, 'within')).toBe(1)
    expect(selected()).toEqual([1]) // B: A-B and B-C
    expect(selectByLinks(1, 'within')).toBe(5)
  })
})

describe('highlightPathsBetweenSelected', () => {
  it('highlights the paths and can select the nodes along them', () => {
    ctx.nodeObjects[0].isSelected = true
    ctx.nodeObjects[2].isSelected = true
    expect(highlightPathsBetweenSelected('within', true)).toEqual({
      ends: 2,
      pairs: 1,
      joined: 1,
      edges: 2,
      nodes: 1,
    })
    expect(selected()).toEqual([0, 1, 2])
    expect(ctx.edgeObjects.map((e) => e.isSelected)).toEqual([
      true,
      true,
      false,
    ])
  })

  it('takes back what it added, never counting its own nodes as ends', () => {
    ctx.nodeObjects[0].isSelected = true
    ctx.nodeObjects[4].isSelected = true
    // no path within layers; across them through the copies of C
    expect(highlightPathsBetweenSelected('within', true).joined).toBe(0)
    const r = highlightPathsBetweenSelected('across', true)
    expect(r).toMatchObject({ ends: 2, joined: 1, edges: 3, nodes: 3 })
    expect(selected()).toEqual([0, 1, 2, 3, 4])
    // updated again: still the same two ends
    expect(highlightPathsBetweenSelected('across', true).ends).toBe(2)
    ctx.nodeObjects[4].isSelected = false
    expect(highlightPathsBetweenSelected('across', true).ends).toBe(1)
    expect(selected()).toEqual([0])
    expect(ctx.edgeObjects.some((e) => e.isSelected)).toBe(false)
  })

  it("leaves the user's own edges selected when cleared", () => {
    ctx.edgeObjects[0].select()
    ctx.nodeObjects[0].isSelected = true
    ctx.nodeObjects[2].isSelected = true
    highlightPathsBetweenSelected('within', false)
    expect(selected()).toEqual([0, 2])
    clearPathHighlight()
    expect(ctx.edgeObjects.map((e) => e.isSelected)).toEqual([
      true,
      false,
      false,
    ])
  })
})
