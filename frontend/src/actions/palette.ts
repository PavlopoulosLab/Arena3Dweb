// Colours that read on the scene's background (actions/themes.ts): a theme's
// colour per layer and per channel (actions/theme_presets.ts), and any colour
// darkened on light backgrounds or lightened on dark ones until it stands out
// (WCAG's 3:1 for graphics).

import { COLOR_VECTOR_280 } from '../three/constants'
import type { Theme } from './theme_presets'

const MIN_CONTRAST = 3
const HEX = /^#[0-9a-f]{6}$/i

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ]
}

const toHex = (c: number[]) =>
  '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio of two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * `color`, moved towards black on a light background (white on a dark one)
 * just far enough to stand out from it; unchanged when it already does.
 */
export function readableOn(color: string, background: string): string {
  // a named or short colour is left as it is
  if (!HEX.test(color) || !HEX.test(background)) return color
  if (contrast(color, background) >= MIN_CONTRAST) return color.toLowerCase()
  const target =
    contrast('#000000', background) >= contrast('#ffffff', background) ? 0 : 255
  const from = rgb(color)
  for (let t = 0.05; t < 1; t += 0.05) {
    const mixed = toHex(from.map((v) => v + (target - v) * t))
    if (contrast(mixed, background) >= MIN_CONTRAST) return mixed
  }
  return target ? '#ffffff' : '#000000'
}

// the categorical colours without their greys: a grey layer reads as a floor
// or an edge, not as a group of nodes
const DISTINCT = COLOR_VECTOR_280.filter((hex) => {
  const c = rgb(hex)
  return Math.max(...c) - Math.min(...c) > 40
})

/** Layer `index`'s node colour in `theme`; past its palette, a distinct one. */
export function themeNodeColor(theme: Theme, index: number): string {
  return readableOn(
    theme.nodes[index] ?? DISTINCT[index % DISTINCT.length],
    theme.background
  )
}

/** Channel `index`'s colour in `theme` (its palette has ten at least). */
export function themeChannelColor(theme: Theme, index: number): string {
  return readableOn(
    theme.channels[index % theme.channels.length],
    theme.background
  )
}
