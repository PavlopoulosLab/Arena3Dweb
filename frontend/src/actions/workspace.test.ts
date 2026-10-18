import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppConfig } from '../api/config'
import type { NetworkData } from '../api/client'

// The workspace keeps its networks in module state: every test starts from a
// fresh copy of the modules (and so a fresh scene context).
async function fresh() {
  vi.resetModules()
  const { store } = await import('../store')
  store.update({
    config: {
      max_channels: 2,
      channel_colors_light: ['#111111', '#222222'],
    } as AppConfig,
  })
  const { ctx } = await import('../three')
  const { buildNetwork, loadNetwork } = await import('./network')
  const { history } = await import('../commands/base')
  const { collectSession } = await import('./session')
  const ws = await import('./workspace')
  return {
    ctx,
    store,
    history,
    buildNetwork,
    loadNetwork,
    collectSession,
    ...ws,
  }
}

function network(layers: string[], names: string[]): NetworkData {
  const nodes = names.map((name, i) => ({
    id: `${name}_${layers[i % layers.length]}`,
    label: name,
    layer: layers[i % layers.length],
  }))
  return {
    layers,
    channels: [],
    warnings: [],
    nodes,
    edges: nodes.slice(1).map((n) => ({
      src: nodes[0].id,
      trg: n.id,
      source_node: nodes[0].label,
      source_layer: nodes[0].layer,
      target_node: n.label,
      target_layer: n.layer,
      weight: 1,
      scaled_weight: 1,
      channel: null,
    })),
  }
}

let w: Awaited<ReturnType<typeof fresh>>
beforeEach(async () => {
  w = await fresh()
})

describe('sizeText', () => {
  it('counts layers, nodes and edges, singular for one', () => {
    expect(w.sizeText(1, 1, 1)).toBe('1 layer · 1 node · 1 edge')
    expect(w.sizeText(4, 1255, 0)).toBe('4 layers · 1,255 nodes · 0 edges')
  })
})

describe('describeSlots / onScreen', () => {
  it('is empty with nothing loaded', () => {
    expect(w.describeSlots()).toEqual([])
    expect(w.onScreen()).toBeNull()
  })

  it('lists every network with its source and size, the shown one marked', () => {
    w.buildNetwork(network(['L1', 'L2'], ['A', 'B', 'C']))
    w.registerLoad('first.tsv')
    w.snapshotActive() // as a new load does before replacing the scene
    w.buildNetwork(network(['X'], ['P', 'Q']))
    w.registerLoad('STRING import', 'database')
    const rows = w.describeSlots()
    expect(rows.map((r) => [r.name, r.source, r.active])).toEqual([
      ['first.tsv', 'File', false],
      ['STRING import', 'Database', true],
    ])
    expect(rows[0]).toMatchObject({ layers: 2, nodes: 3, edges: 2 })
    expect(rows[1]).toMatchObject({ layers: 1, nodes: 2, edges: 1 })
    expect(w.onScreen()).toEqual({
      network: 'STRING import',
      annotation: null,
    })
  })

  it('counts the network on screen live (layers added since the load)', () => {
    w.buildNetwork(network(['L1'], ['A', 'B']))
    w.registerLoad('one.tsv', 'example')
    w.buildNetwork(network(['L1', 'L2', 'L3'], ['A', 'B', 'C', 'D']))
    w.noteAddition('more.tsv')
    const [row] = w.describeSlots()
    expect(row).toMatchObject({
      source: 'Example',
      layers: 3,
      nodes: 4,
      added: ['more.tsv'],
    })
    expect(w.onScreen()?.network).toBe('one.tsv + more.tsv')
  })

  it('names the annotation set shown, or none', () => {
    w.buildNetwork(network(['L1'], ['A', 'B', 'C']))
    w.registerLoad('net.tsv')
    w.ctx.nodeObjects[0].annotations = ['Alpha']
    w.ctx.nodeObjects[1].annotations = ['Alpha', 'Beta']
    w.registerAnnotationSet('groups.tsv')
    w.ctx.nodeObjects[2].annotations = ['Gamma']
    w.registerAnnotationSet('gamma.tsv', (name) => name === 'C')
    let [row] = w.describeSlots()
    expect(row.sets).toEqual([
      { index: 0, name: 'groups.tsv', nodes: 2 },
      { index: 1, name: 'gamma.tsv', nodes: 1 },
    ])
    expect(row.activeSet).toBe(1)
    expect(w.onScreen()?.annotation).toBe('gamma.tsv')

    w.applyAnnotationSet(0)
    expect(w.onScreen()?.annotation).toBe('groups.tsv')
    expect(w.ctx.nodeObjects.map((n) => n.annotations)).toEqual([
      ['Alpha'],
      ['Alpha', 'Beta'],
      [],
    ])
    w.applyAnnotationSet(-1)
    ;[row] = w.describeSlots()
    expect(row.activeSet).toBe(-1)
    expect(w.onScreen()?.annotation).toBeNull()
  })

  it("keeps a session's annotations as a set of their own, shown", () => {
    w.buildNetwork(network(['L1'], ['A', 'B']))
    w.ctx.nodeObjects[1].annotations = ['Kinase']
    w.registerLoad('saved.json', 'session')
    const [row] = w.describeSlots()
    expect(row.source).toBe('Session file')
    expect(row.sets).toEqual([{ index: 0, name: w.SESSION_SET, nodes: 1 }])
    expect(w.onScreen()?.annotation).toBe(w.SESSION_SET)
  })

  it('a network without annotations brings no set', () => {
    w.buildNetwork(network(['L1'], ['A', 'B']))
    w.registerLoad('plain.tsv')
    expect(w.describeSlots()[0].sets).toEqual([])
  })
})

describe('workspace:changed', () => {
  it('is announced for loads, additions and annotation switches', async () => {
    const { bus } = await import('../bus')
    const seen = vi.fn()
    bus.on('workspace:changed', seen)
    w.buildNetwork(network(['L1'], ['A', 'B']))
    w.registerLoad('a.tsv')
    w.noteAddition('b.tsv')
    w.applyAnnotationSet(-1)
    expect(seen).toHaveBeenCalledTimes(3)
  })
})

// two loads as the app does them: each one an undoable step, the first
// network snapshotted before the second replaces it
function loadTwo() {
  w.loadNetwork(network(['L1', 'L2'], ['A', 'B', 'C']))
  w.registerLoad('a.tsv')
  w.ctx.nodeObjects[0].annotations = ['Alpha']
  w.registerAnnotationSet('alpha.tsv')
  w.snapshotActive()
  w.loadNetwork(network(['X'], ['P', 'Q']))
  w.registerLoad('b.tsv')
  const [a, b] = w.listSlots()
  return { a, b }
}

describe('rename', () => {
  it('renames a network, keeping where it came from', () => {
    w.buildNetwork(network(['L1'], ['A', 'B']))
    const slot = w.registerLoad('figure.tsv')
    expect(w.renameSlot(slot.id, '  My network ')).toBeNull()
    expect(w.onScreen()?.network).toBe('My network')
    expect(w.describeSlots()[0]).toMatchObject({
      name: 'My network',
      origin: 'figure.tsv',
    })
    expect(w.renameSlot(slot.id, '   ')).toBe('Type a name.')
    expect(w.renameSlot(slot.id, 'x'.repeat(w.MAX_NAME + 1))).toMatch(/at most/)
    expect(w.describeSlots()[0].name).toBe('My network')
  })

  it('renames an annotation set, refusing a name the network already has', () => {
    const { a } = loadTwo()
    w.switchTo(a.id)
    w.ctx.nodeObjects[1].annotations = ['Beta']
    w.registerAnnotationSet('beta.tsv')
    expect(w.renameAnnotationSet(a.id, 1, 'alpha.tsv')).toBe(
      'This network already has an annotation set named “alpha.tsv”.'
    )
    expect(w.renameAnnotationSet(a.id, 1, ' Betas ')).toBeNull()
    expect(w.onScreen()?.annotation).toBe('Betas')
    expect(w.renameAnnotationSet(a.id, 0, '')).toBe('Type a name.')
    expect(w.describeSlots()[0].sets.map((x) => x.name)).toEqual([
      'alpha.tsv',
      'Betas',
    ])
  })
})

describe('delete an annotation set', () => {
  it('the one shown: the network shows none', () => {
    w.buildNetwork(network(['L1'], ['A', 'B']))
    const slot = w.registerLoad('net.tsv')
    w.ctx.nodeObjects[0].annotations = ['Alpha']
    w.registerAnnotationSet('alpha.tsv')
    expect(w.deleteAnnotationSet(slot.id, 0)).toBe(true)
    expect(w.describeSlots()[0]).toMatchObject({ sets: [], activeSet: -1 })
    expect(w.ctx.nodeObjects.every((n) => n.annotations.length === 0)).toBe(
      true
    )
  })

  it('one before the shown set: the shown set stays shown', () => {
    w.buildNetwork(network(['L1'], ['A', 'B']))
    const slot = w.registerLoad('net.tsv')
    w.ctx.nodeObjects[0].annotations = ['Alpha']
    w.registerAnnotationSet('alpha.tsv')
    w.ctx.nodeObjects[1].annotations = ['Beta']
    w.registerAnnotationSet('beta.tsv', (n) => n === 'B')
    w.deleteAnnotationSet(slot.id, 0)
    expect(w.describeSlots()[0].activeSet).toBe(0)
    expect(w.onScreen()?.annotation).toBe('beta.tsv')
  })

  it('the shown set of a network not on screen: gone when it comes back', () => {
    const { a } = loadTwo()
    w.deleteAnnotationSet(a.id, 0)
    w.switchTo(a.id)
    expect(w.onScreen()).toEqual({ network: 'a.tsv', annotation: null })
    expect(w.ctx.nodeObjects.every((n) => n.annotations.length === 0)).toBe(
      true
    )
  })
})

describe('delete a network', () => {
  it('one not on screen: gone, the scene stays, undo history cleared', () => {
    const { a, b } = loadTwo()
    expect(w.history.canUndo).toBe(true)
    expect(w.deleteSlot(a.id)).toBe(true)
    expect(w.listSlots().map((s) => s.id)).toEqual([b.id])
    expect(w.activeSlot()?.id).toBe(b.id)
    expect(w.ctx.layers.map((l) => l.name)).toEqual(['X'])
    expect(w.history.canUndo).toBe(false)
  })

  it('the one on screen: the network before it comes back, its scene freed', () => {
    const { a, b } = loadTwo()
    const geometry = w.ctx.nodeObjects[0].sphere.geometry
    const freed = vi.spyOn(geometry, 'dispose')
    expect(w.deleteSlot(b.id)).toBe(true)
    expect(w.activeSlot()?.id).toBe(a.id)
    expect(w.ctx.layers.map((l) => l.name)).toEqual(['L1', 'L2'])
    expect(w.onScreen()).toEqual({ network: 'a.tsv', annotation: 'alpha.tsv' })
    expect(freed).toHaveBeenCalled()
    expect(w.history.canUndo).toBe(false)
  })

  it('the last one: the empty scene of the start', () => {
    w.loadNetwork(network(['L1'], ['A', 'B']))
    const slot = w.registerLoad('only.tsv')
    expect(w.deleteSlot(slot.id)).toBe(true)
    expect(w.listSlots()).toEqual([])
    expect(w.onScreen()).toBeNull()
    expect(w.ctx.nodeObjects).toHaveLength(0)
    expect(w.ctx.layers).toHaveLength(0)
    expect(w.ctx.scene?.exists()).toBe(true)
    expect(w.store.get().network).toBeNull()
    expect(w.history.canUndo).toBe(false)
    expect(w.deleteSlot(slot.id)).toBe(false)
  })
})

describe('names in sessions', () => {
  it('a session keeps the network name and the set shown, and brings them back', () => {
    w.buildNetwork(network(['L1'], ['A', 'B']))
    const slot = w.registerLoad('net.tsv')
    w.ctx.nodeObjects[0].annotations = ['Alpha']
    w.registerAnnotationSet('alpha.tsv')
    w.renameSlot(slot.id, 'Renamed')
    const session = w.collectSession()
    expect(session).toMatchObject({
      name: 'Renamed',
      annotationSet: 'alpha.tsv',
    })
    w.registerLoad('saved.json', 'session', session)
    expect(w.describeSlots()[1]).toMatchObject({
      name: 'Renamed',
      origin: 'saved.json',
      sets: [{ index: 0, name: 'alpha.tsv', nodes: 1 }],
    })
  })
})
