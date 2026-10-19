import { describe, expect, it } from 'vitest'
import { PINCH_MAX, PINCH_MIN, pinchStep } from './touch_controls'

// world = pan + scale * v  (pan = the scene's translation, v = local point)
const toWorld = (
  pan: { x: number; y: number },
  scale: number,
  v: { x: number; y: number }
) => ({
  x: pan.x + scale * v.x,
  y: pan.y + scale * v.y,
})

describe('pinchStep', () => {
  it('keeps the world point under the fingers fixed while zooming', () => {
    const pan = { x: 30, y: -10 }
    const mid = { x: 100, y: 50 }
    const v = { x: (mid.x - pan.x) / 1, y: (mid.y - pan.y) / 1 } // local point under mid at scale 1
    const s = pinchStep(pan, 1, mid, mid, 2)
    expect(s.scale).toBe(2)
    const w = toWorld(s.pan, s.scale, v)
    expect(w.x).toBeCloseTo(mid.x)
    expect(w.y).toBeCloseTo(mid.y)
  })

  it('follows the midpoint when two fingers move together (pan)', () => {
    const s = pinchStep(
      { x: 0, y: 0 },
      1.5,
      { x: 10, y: 10 },
      { x: 40, y: -5 },
      1
    )
    expect(s.scale).toBe(1.5)
    expect(s.pan).toEqual({ x: 30, y: -15 })
  })

  it('clamps the zoom', () => {
    expect(
      pinchStep({ x: 0, y: 0 }, 5, { x: 0, y: 0 }, { x: 0, y: 0 }, 1e9).scale
    ).toBe(PINCH_MAX)
    expect(
      pinchStep({ x: 0, y: 0 }, 0.3, { x: 0, y: 0 }, { x: 0, y: 0 }, 1e-9).scale
    ).toBe(PINCH_MIN)
  })
})
