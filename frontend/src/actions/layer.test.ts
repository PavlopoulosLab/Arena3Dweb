import { beforeEach, describe, expect, it } from 'vitest'
import { store } from '../store'
import {
  ctx,
  Layer,
  resetContext,
  SELECTED_LAYER_DEFAULT_COLOR,
} from '../three'
import {
  getSelectedLayers,
  initialSpreadLayers,
  repaintLayers,
  selectAllLayers,
  selectLayer,
  setLayerVisibility,
} from './layer'

function seed(n: number): void {
  ctx.layers = Array.from(
    { length: n },
    (_, i) => new Layer({ id: i, name: `L${i + 1}` })
  )
  ctx.layerGroups = Object.fromEntries(ctx.layers.map((l, i) => [l.name, i]))
}

beforeEach(() => {
  resetContext()
  store.update({ selectedLayers: [] })
})

describe('initialSpreadLayers', () => {
  it('spreads an odd count symmetrically around 0', () => {
    seed(3)
    initialSpreadLayers()
    const xs = ctx.layers.map((l) => l.getPosition('x'))
    expect(xs[1]).toBe(0)
    expect(xs[0]).toBe(-xs[2])
    expect(xs[0]).toBeLessThan(0)
  })

  it('spaces 3D volumes far enough apart not to overlap', () => {
    seed(3)
    initialSpreadLayers()
    initialSpreadLayers(-1)
    for (const l of ctx.layers) l.setContainer('sphere')
    const spaced = initialSpreadLayers()
    const r = ctx.layers[0].containerRadius()
    expect(spaced).toBeGreaterThanOrEqual(2 * r)
    const xs = ctx.layers.map((l) => l.getPosition('x'))
    expect(xs[1] - xs[0]).toBeCloseTo(spaced)
  })

  it('direction -1 stacks an even count back to 0', () => {
    seed(2)
    initialSpreadLayers(1)
    expect(ctx.layers[0].getPosition('x')).not.toBe(0)
    initialSpreadLayers(-1)
    expect(ctx.layers[0].getPosition('x')).toBeCloseTo(0)
  })
})

describe('selection', () => {
  it('selectLayer repaints selected color and syncs the store', () => {
    seed(2)
    selectLayer(0, true)
    expect(getSelectedLayers()).toEqual([0])
    expect(ctx.layers[0].color).toBe(SELECTED_LAYER_DEFAULT_COLOR)
    expect(ctx.layers[1].color).not.toBe(SELECTED_LAYER_DEFAULT_COLOR)
    expect(store.get().selectedLayers).toEqual(['L1'])
    expect(ctx.renderLayerLabelsFlag).toBe(true)
  })

  it('selectAllLayers(false) restores imported colors', () => {
    seed(2)
    selectAllLayers(true)
    expect(getSelectedLayers()).toEqual([0, 1])
    selectAllLayers(false)
    expect(getSelectedLayers()).toEqual([])
    expect(ctx.layers[0].color).toBe(ctx.layers[0].importedColor)
    expect(store.get().selectedLayers).toEqual([])
  })
})

describe('repaintLayers', () => {
  it('picker priority falls back to current color without the DOM input', () => {
    seed(1)
    ctx.layers[0].setColor('#ababab')
    ctx.layerColorPrioritySource = 'picker'
    repaintLayers()
    expect(ctx.layers[0].color).toBe('#ababab')
  })
})

describe('setLayerVisibility', () => {
  it('hides the plane, raises render flags and recomputes node label flags', () => {
    seed(1)
    setLayerVisibility(0, false)
    expect(ctx.layers[0].isVisible).toBe(false)
    expect(ctx.layers[0].plane.visible).toBe(false)
    expect(ctx.renderInterLayerEdgesFlag).toBe(true)
    expect(ctx.renderLayerLabelsFlag).toBe(true)
  })
})
