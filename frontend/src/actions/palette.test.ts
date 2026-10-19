import { describe, expect, it } from 'vitest'
import { THEMES } from './themes'
import {
  contrast,
  luminance,
  readableOn,
  themeChannelColor,
  themeNodeColor,
} from './palette'

describe('contrast', () => {
  it('runs from 1 (the same colour) to 21 (black on white)', () => {
    expect(contrast('#777777', '#777777')).toBeCloseTo(1)
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21)
    expect(luminance('#ffffff')).toBeCloseTo(1)
  })
})

describe('readableOn', () => {
  it('keeps a colour that already stands out', () => {
    expect(readableOn('#E41A1C', '#000000')).toBe('#e41a1c')
  })

  it('darkens yellow on white and lightens dark blue on black', () => {
    const yellow = readableOn('#ffff33', '#ffffff')
    expect(contrast(yellow, '#ffffff')).toBeGreaterThanOrEqual(3)
    expect(luminance(yellow)).toBeLessThan(luminance('#ffff33'))
    const navy = readableOn('#1d1d6b', '#000000')
    expect(contrast(navy, '#000000')).toBeGreaterThanOrEqual(3)
    expect(luminance(navy)).toBeGreaterThan(luminance('#1d1d6b'))
  })
})

// CIE76 colour difference: 15 or more reads as a different colour at a glance
function deltaE(a: string, b: string): number {
  const lab = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    const f = (t: number) =>
      t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
    const x = f((r * 0.4124 + g * 0.3576 + bl * 0.1805) / 0.95047)
    const y = f(r * 0.2126 + g * 0.7152 + bl * 0.0722)
    const z = f((r * 0.0193 + g * 0.1192 + bl * 0.9505) / 1.08883)
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
  }
  const [p, q] = [lab(a), lab(b)]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

describe('the themes', () => {
  const themes = Object.entries(THEMES)

  it('come in the three groups of the picker', () => {
    expect(themes.length).toBeGreaterThanOrEqual(25)
    for (const g of ['dark', 'light', 'cb'])
      expect(themes.filter(([, t]) => t.group === g).length).toBeGreaterThan(5)
    // the ids sessions and specs name
    for (const id of ['dark', 'light', 'gray', 'blueprint', 'paper'])
      expect(THEMES[id]).toBeDefined()
  })

  it('give labels, edges, nodes and channels that read on the background', () => {
    for (const [id, t] of themes) {
      expect(
        contrast(t.text, t.background),
        `${id} labels`
      ).toBeGreaterThanOrEqual(4.5)
      expect(
        contrast(t.edge, t.background),
        `${id} edges`
      ).toBeGreaterThanOrEqual(3)
      for (let i = 0; i < 16; i++)
        expect(
          contrast(themeNodeColor(t, i), t.background),
          `${id} layer ${i}`
        ).toBeGreaterThanOrEqual(3)
      for (let i = 0; i < 10; i++)
        expect(
          contrast(themeChannelColor(t, i), t.background),
          `${id} channel ${i}`
        ).toBeGreaterThanOrEqual(3)
    }
  })

  it('give ten channels and eight layers colours that all differ', () => {
    for (const [id, t] of themes) {
      expect(t.channels.length, id).toBeGreaterThanOrEqual(10)
      expect(t.nodes.length, id).toBeGreaterThanOrEqual(8)
      for (const [what, colour, n] of [
        ['channel', themeChannelColor, 10],
        ['layer', themeNodeColor, 8],
      ] as const) {
        const colours = Array.from({ length: n }, (_, i) => colour(t, i))
        for (let i = 0; i < n; i++)
          for (let j = i + 1; j < n; j++)
            expect(
              deltaE(colours[i], colours[j]),
              `${id}: ${what}s ${i} and ${j} (${colours[i]}, ${colours[j]})`
            ).toBeGreaterThanOrEqual(15)
      }
    }
  })

  it('give more layers than a palette holds readable colours too', () => {
    const t = THEMES.light
    const extra = themeNodeColor(t, t.nodes.length + 2)
    expect(contrast(extra, t.background)).toBeGreaterThanOrEqual(3)
  })
})
