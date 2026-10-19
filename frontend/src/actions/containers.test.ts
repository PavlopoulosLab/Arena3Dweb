import { beforeEach, describe, expect, it } from 'vitest'
import type { SessionData, SessionLayer } from '../api/client'
import { history } from '../commands/base'
import {
  ChangeContainerCommand,
  ChangeContainerStyleCommand,
} from '../commands/scene'
import { store } from '../store'
import { ctx, resetContext } from '../three'
import { DEFAULT_CONTAINER_LOOK } from '../three/Layer'
import { insideContainer, type VolumeKind } from '../three/containers'
import {
  currentPositions,
  nodeDegrees,
  placeInContainers,
  placeLayerNodes,
  sessionContainerLook,
} from './containers'
import { fitToContainers } from './layout'
import { buildFromSession } from './network'
import { collectSession } from './session'

// two layers with a small graph each, plus one edge between them
function session(extra: Partial<SessionLayer> = {}): SessionData {
  const nodes = ['A', 'B', 'C', 'D', 'E'].flatMap((name, k) =>
    ['L1', 'L2'].map((layer) => ({
      name,
      layer,
      position_x: 0,
      position_y: (k - 2) * 60,
      position_z: ((k * 37) % 5) * 40 - 80,
      scale: 1,
      color: '#ff0000',
      url: '',
      descr: '',
    }))
  )
  return {
    scene: {
      position_x: 0,
      position_y: 0,
      scale: 1,
      color: '#000000',
      rotation_x: 0,
      rotation_y: 0,
      rotation_z: 0,
    },
    layers: ['L1', 'L2'].map((name, i) => ({
      name,
      position_x: i ? 300 : -300,
      position_y: 0,
      position_z: 0,
      rotation_x: 0,
      rotation_y: 0,
      rotation_z: 0,
      last_layer_scale: 1,
      floor_current_color: '#777777',
      geometry_parameters_width: 400,
      generate_coordinates: false,
      ...extra,
    })),
    nodes,
    edges: [
      { src: 'A_L1', trg: 'B_L1', opacity: 1, color: '#123123' },
      { src: 'A_L1', trg: 'C_L1', opacity: 1, color: '#123123' },
      { src: 'A_L1', trg: 'D_L1', opacity: 1, color: '#123123' },
      { src: 'B_L1', trg: 'C_L1', opacity: 1, color: '#123123' },
      { src: 'A_L1', trg: 'A_L2', opacity: 1, color: '#123123' },
    ],
    universalLabelColor: '#ffffff',
    direction: false,
    edgeOpacityByWeight: false,
    edgeWidthByWeight: false,
    scramble_nodes: false,
  }
}

beforeEach(() => {
  resetContext()
  store.update({ network: null, selectedChannels: [] })
})

// unit-shape coordinates of a node: [x, y, z] / the layer's half-width
function unit(name: string): [number, number, number] {
  const i = ctx.nodeLayerNames.indexOf(name)
  const n = ctx.nodeObjects[i]
  const r = ctx.layers[ctx.layerGroups[n.layer]].containerRadius()
  return [
    n.getPosition('x') / r,
    n.getPosition('y') / r,
    n.getPosition('z') / r,
  ]
}

describe('container options in sessions', () => {
  it('older sessions load with the default look, inside', () => {
    buildFromSession(session({ container: 'sphere' }))
    const l = ctx.layers[0]
    expect(l.container).toBe('sphere')
    expect(l.containerPlacement).toBe('inside')
    expect(l.containerLook()).toEqual(DEFAULT_CONTAINER_LOOK)
  })

  it('keeps the new containers, placement and look through a save', () => {
    buildFromSession(
      session({
        container: 'torus',
        container_placement: 'surface',
        container_color: '#112233',
        container_opacity: 0.5,
        container_outline: false,
        container_outline_color: '#445566',
        container_wireframe: true,
        container_glow: true,
        container_floor: true,
      })
    )
    const saved = collectSession().layers[1]
    expect(saved.container).toBe('torus')
    expect(saved.container_placement).toBe('surface')
    expect(saved.container_outline).toBe(false)
    expect(saved.container_outline_color).toBe('#445566')
    expect(saved.container_wireframe).toBe(true)
    expect(saved.container_glow).toBe(true)
    expect(saved.container_floor).toBe(true)
    resetContext()
    buildFromSession({
      ...session(),
      layers: [saved, saved].map((l, i) => ({ ...l, name: `L${i + 1}` })),
    })
    expect(ctx.layers[0].containerLook()).toEqual({
      color: '#112233',
      opacity: 0.5,
      outline: false,
      outlineColor: '#445566',
      wireframe: true,
      glow: true,
      floor: true,
    })
  })

  it('ignores what it does not know', () => {
    const { look, placement } = sessionContainerLook({
      container_color: 'red',
      container_opacity: 7,
      container_outline: 'yes' as unknown as boolean,
      container_placement: 'around' as unknown as 'inside',
    })
    expect(look.color).toBeNull()
    expect(look.opacity).toBe(1)
    expect(look.outline).toBe(true)
    expect(placement).toBe('inside')
    buildFromSession(
      session({ container: 'teapot' as unknown as SessionLayer['container'] })
    )
    expect(ctx.layers[0].container).toBe('floor')
  })
})

describe('placing a layer’s nodes', () => {
  it('fresh layouts and refits keep every node inside its container', () => {
    buildFromSession(session())
    const kinds: VolumeKind[] = ['cylinder', 'cone', 'torus', 'geodesic']
    for (const kind of kinds) {
      for (const l of ctx.layers) l.setContainer(kind)
      // a fresh 3D layout over the box, as normalizeLayoutPositions gives it
      const raw = Object.fromEntries(
        ctx.nodeLayerNames.map((n, i) => [
          n,
          [
            ((i * 53) % 400) - 200,
            ((i * 91) % 400) - 200,
            ((i * 29) % 400) - 200,
          ] as [number, number, number],
        ])
      )
      history.execute({
        description: 't',
        execute: () => {
          const placed = fitToContainers(raw, true)
          ctx.nodeObjects.forEach((n, i) => {
            const [y, z, x] = placed[ctx.nodeLayerNames[i]]
            n.setPosition('x', x ?? 0)
            n.setPosition('y', y)
            n.setPosition('z', z)
          })
        },
        undo: () => {},
      })
      for (const name of ctx.nodeLayerNames)
        expect(insideContainer(kind, unit(name))).toBe(true)
      // fitting again moves nothing that is already inside
      const now = currentPositions()
      const again = fitToContainers(now)
      if (kind !== 'cone')
        for (const name of Object.keys(now))
          now[name].forEach((v, k) => expect(again[name][k]).toBeCloseTo(v, 6))
    }
  })

  it('tiers go by degree: the hub on top of the cone', () => {
    buildFromSession(session())
    const l1 = ctx.layers[0]
    l1.setContainer('cone')
    const degree = nodeDegrees()
    expect(degree.get('A_L1')).toBe(4)
    const placed = placeLayerNodes(l1, currentPositions(new Set(['L1'])))
    const top = Math.max(...Object.values(placed).map((p) => p[0]))
    expect(placed.A_L1[0]).toBe(top)
  })

  it('2D positions stay 2D', () => {
    buildFromSession(session())
    for (const l of ctx.layers) l.setContainer('cube')
    const flat = { A_L1: [10, 20] as [number, number] }
    expect(placeInContainers(flat, 'box').A_L1).toHaveLength(2)
  })
})

describe('container commands', () => {
  it('a container switch and its placement undo together', () => {
    buildFromSession(session())
    history.execute(new ChangeContainerCommand([0, 1], 'pyramid', 'surface'))
    expect(ctx.layers.map((l) => l.container)).toEqual(['pyramid', 'pyramid'])
    expect(ctx.layers[0].containerPlacement).toBe('surface')
    history.undo()
    expect(ctx.layers.map((l) => l.container)).toEqual(['floor', 'floor'])
    expect(ctx.layers[0].containerPlacement).toBe('inside')
  })

  it('the look changes and comes back on undo', () => {
    buildFromSession(session())
    history.execute(
      new ChangeContainerStyleCommand([1], { glow: true, wireframe: true })
    )
    expect(ctx.layers[1].containerGlow).toBe(true)
    expect(ctx.layers[0].containerGlow).toBe(false)
    history.undo()
    expect(ctx.layers[1].containerLook()).toEqual(DEFAULT_CONTAINER_LOOK)
    // the colour-and-opacity form still works
    history.execute(new ChangeContainerStyleCommand([0], '#abcdef', 0.4))
    expect(ctx.layers[0].containerColor).toBe('#abcdef')
    expect(ctx.layers[0].containerOpacity).toBe(0.4)
  })
})
