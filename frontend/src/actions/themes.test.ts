import { beforeEach, describe, expect, it } from 'vitest'
import { history } from '../commands/base'
import { ChangeThemeCommand } from '../commands/scene'
import { store } from '../store'
import { ctx, Edge, Layer, Node, resetContext, Scene } from '../three'
import { themeChannelColor, themeNodeColor } from './palette'
import {
  applyTheme,
  registerThemeListener,
  restoreColours,
  snapshotColours,
  themeState,
  THEMES,
} from './themes'

// two layers with a node each (one of them a colour of its own), two
// channels (one recoloured by hand) and an edge with its own arrow colour
const OWN = '#ffff00'
beforeEach(() => {
  resetContext()
  ctx.scene = new Scene()
  ctx.layers = [
    new Layer({ id: 0, name: 'L1' }),
    new Layer({ id: 1, name: 'L2' }),
  ]
  ctx.layerGroups = { L1: 0, L2: 1 }
  ctx.nodeObjects = [
    new Node({ id: 0, name: 'A', layer: 'L1', nodeLayerName: 'A_L1' }),
    new Node({
      id: 1,
      name: 'B',
      layer: 'L2',
      nodeLayerName: 'B_L2',
      color: OWN,
    }),
  ]
  ctx.nodeGroups = { A_L1: 'L1', B_L2: 'L2' }
  ctx.nodeLayerNames = ['A_L1', 'B_L2']
  ctx.layers[0].addNode(ctx.nodeObjects[0].sphere)
  ctx.layers[1].addNode(ctx.nodeObjects[1].sphere)
  ctx.channelColors = { ch1: '#123456', ch2: '#000002' }
  ctx.edgeDefaultColor = '#cfcfcf'
  const edge = new Edge({ id: 0, source: 'A_L1', target: 'B_L2' })
  edge.arrowColor = '#ff0000'
  ctx.edgeObjects = [edge]
  ctx.edgeFileColorPriority = true
  store.update({ currentTheme: 'dark' })
})

describe('applyTheme', () => {
  it("with the theme's colours: background, labels, nodes, floors, channels, edges", () => {
    applyTheme('light')
    const t = THEMES.light
    expect(ctx.labelColor).toBe(t.text)
    expect(ctx.edgeDefaultColor).toBe(t.edge)
    // every layer its own readable colour, the user's yellow included
    expect(ctx.nodeObjects.map((n) => n.importedColor)).toEqual([
      themeNodeColor(t, 0),
      themeNodeColor(t, 1),
    ])
    expect(ctx.channelColors).toEqual({
      ch1: themeChannelColor(t, 0),
      ch2: themeChannelColor(t, 1),
    })
    expect(ctx.layerColorPrioritySource).toBe('picker')
    expect(ctx.layers[0].color).toBe(t.floor)
    // colours set by hand per edge give way
    expect(ctx.edgeFileColorPriority).toBe(false)
    expect(ctx.edgeObjects[0].arrowColor).toBe('')
    expect(ctx.renderInterLayerEdgesFlag).toBe(true)
    expect(themeState()).toEqual({ name: 'dark', applied: true })
  })

  it('keeping the colours changes only the background, labels and containers', () => {
    applyTheme('paper', false)
    expect(ctx.labelColor).toBe(THEMES.paper.text)
    expect(ctx.containerDefaultColor).toBe(THEMES.paper.container)
    expect(ctx.nodeObjects[1].importedColor).toBe(OWN)
    expect(ctx.channelColors).toEqual({ ch1: '#123456', ch2: '#000002' })
    expect(ctx.edgeDefaultColor).toBe('#cfcfcf')
    expect(ctx.edgeFileColorPriority).toBe(true)
    expect(ctx.edgeObjects[0].arrowColor).toBe('#ff0000')
    expect(ctx.layerColorPrioritySource).toBe('default')
    expect(themeState().applied).toBe(false)
  })

  it('unknown theme is a no-op', () => {
    applyTheme('neon')
    expect(ctx.channelColors).toEqual({ ch1: '#123456', ch2: '#000002' })
  })
})

describe('theme:changed wiring', () => {
  it('a switch with the colours is one undo step that puts them all back', () => {
    registerThemeListener()
    history.execute(
      new ChangeThemeCommand(
        'okabe',
        () => store.get().currentTheme,
        (t) => store.update({ currentTheme: t }),
        { recolour: true, snapshot: snapshotColours, restore: restoreColours }
      )
    )
    expect(store.get().currentTheme).toBe('okabe')
    expect(ctx.nodeObjects[1].importedColor).toBe(
      themeNodeColor(THEMES.okabe, 1)
    )
    expect(ctx.edgeFileColorPriority).toBe(false)

    history.undo()
    expect(store.get().currentTheme).toBe('dark')
    expect(ctx.labelColor).toBe(THEMES.dark.text)
    expect(ctx.nodeObjects[1].importedColor).toBe(OWN)
    expect(ctx.channelColors).toEqual({ ch1: '#123456', ch2: '#000002' })
    expect(ctx.edgeDefaultColor).toBe('#cfcfcf')
    expect(ctx.edgeFileColorPriority).toBe(true)
    expect(ctx.edgeObjects[0].arrowColor).toBe('#ff0000')
    expect(ctx.layerColorPrioritySource).toBe('default')
  })

  it('a switch that keeps the colours leaves them, and undo too', () => {
    registerThemeListener()
    history.execute(
      new ChangeThemeCommand(
        'light',
        () => store.get().currentTheme,
        (t) => store.update({ currentTheme: t }),
        { recolour: false, snapshot: snapshotColours, restore: restoreColours }
      )
    )
    expect(ctx.labelColor).toBe('#000000')
    expect(ctx.nodeObjects[1].importedColor).toBe(OWN)
    history.undo()
    expect(ctx.labelColor).toBe('#ffffff')
    expect(ctx.nodeObjects[1].importedColor).toBe(OWN)
  })
})
