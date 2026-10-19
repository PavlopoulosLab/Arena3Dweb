// Headless (node-env) tests: flag machinery only. Div creation/positioning
// is exercised by the Phase 13 Playwright E2E against the real DOM.
import { beforeEach, describe, expect, it } from 'vitest'
import { ctx, Layer, Node, resetContext } from '../three'
import { labelShift } from './screen'
import {
  contrastWith,
  createLabels,
  renderLayerLabels,
  renderNodeLabels,
  setLabelColor,
  showLayerLabels,
  showNodeLabels,
} from './labels'

beforeEach(() => {
  resetContext()
  ctx.layers = [new Layer({ id: 0, name: 'L1' })]
  ctx.layerGroups = { L1: 0 }
  ctx.nodeGroups = { A_L1: 'L1' }
  ctx.nodeLayerNames = ['A_L1']
  ctx.nodeObjects = [
    new Node({ id: 0, name: 'A', nodeLayerName: 'A_L1', layer: 'L1' }),
  ]
})

describe('showNodeLabels', () => {
  it('maps modes onto the node label flags and recomputes them', () => {
    showNodeLabels('all')
    expect(ctx.showAllNodeLabelsFlag).toBe(true)
    expect(ctx.showSelectedNodeLabelsFlag).toBe(false)
    expect(ctx.renderNodeLabelsFlag).toBe(true)
    expect(ctx.nodeObjects[0].showLabel).toBe(true)

    showNodeLabels('none')
    expect(ctx.showAllNodeLabelsFlag).toBe(false)
    expect(ctx.showSelectedNodeLabelsFlag).toBe(false)
    expect(ctx.nodeObjects[0].showLabel).toBe(false)
  })
})

describe('showLayerLabels', () => {
  it('maps modes onto the layer label flags', () => {
    showLayerLabels('selected')
    expect(ctx.showAllLayerLabelsFlag).toBe(false)
    expect(ctx.showSelectedLayerLabelsFlag).toBe(true)
    expect(ctx.renderLayerLabelsFlag).toBe(true)

    showLayerLabels('none')
    expect(ctx.showAllLayerLabelsFlag).toBe(false)
    expect(ctx.showSelectedLayerLabelsFlag).toBe(false)
  })
})

describe('animate-loop renderers', () => {
  it('run flag-gated and clear their flags (headless no-op on divs)', () => {
    createLabels() // no document -> no divs, must not throw
    ctx.renderLayerLabelsFlag = true
    ctx.renderNodeLabelsFlag = true
    renderLayerLabels()
    renderNodeLabels()
    expect(ctx.renderLayerLabelsFlag).toBe(false)
    expect(ctx.renderNodeLabelsFlag).toBe(false)
  })
})

describe('setLabelColor', () => {
  it('updates the universal label color', () => {
    setLabelColor('#ff00ff')
    expect(ctx.labelColor).toBe('#ff00ff')
  })
})

describe('label looks', () => {
  it('picks a halo, box or shadow colour that stands out from the text', () => {
    expect(contrastWith('#000000')).toBe('#ffffff')
    expect(contrastWith('#ffffff')).toBe('#111111')
    expect(contrastWith('#e41a1c')).toBe('#ffffff') // red text: white halo
    expect(contrastWith('#ffd43b')).toBe('#111111') // yellow: dark halo
  })

  it('moves exported labels as the screen does: centred, above or below', () => {
    // a 40 x 20 label; its corner usually sits 7px right, 10px up
    expect(labelShift('right', 40, 20)).toEqual([0, 0])
    expect(labelShift(undefined, 40, 20)).toEqual([0, 0])
    // centred: the corner goes to the node centre minus half the label
    const [cx, cy] = labelShift('centre', 40, 20)
    expect([7 + cx, -10 + cy]).toEqual([-20, -10])
    const [, ay] = labelShift('above', 40, 20)
    const [, by] = labelShift('below', 40, 20)
    expect(-10 + ay + 20).toBeLessThan(0) // bottom edge above the centre
    expect(-10 + by).toBeGreaterThan(0) // top edge below the centre
  })
})
