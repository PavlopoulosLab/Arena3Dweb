// General utilities — port of v2 www/js/general.js. Pure, framework-free.

// XSS fix: escapes HTML metacharacters so user-controlled strings
// (layer/channel names from uploaded network files) can't break out of an
// innerHTML template. Shared by ui/data.ts, ui/edge.ts, ui/layouts.ts.
export function escapeHtml(v: string | number): string {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Colours from files and sessions go into style="" and SVG attributes: only
// CSS colour forms pass (hex, rgb()/hsl(), a colour name), so a value can
// neither break out of the attribute nor add CSS declarations.
const COLOUR =
  /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|hsl)a?\([\d\s.,%/+-]{1,60}\)|[a-z]{3,20})$/i
export function safeColor(v: unknown, fallback = '#888888'): string {
  const c = typeof v === 'string' ? v.trim() : ''
  return COLOUR.test(c) ? c : fallback
}

export function exists<T>(array: T[], element: T): boolean {
  return array.some((l) => l == element)
}

export function getUniqueValues<T>(array: T[]): T[] {
  return [...new Set(array)]
}

export function getCaseInsensitiveIndices(
  array: string[],
  element: string
): number[] {
  const target = element.toLowerCase()
  const indexes: number[] = []
  for (let i = 0; i < array.length; i++)
    if (array[i].toLowerCase() === target) indexes.push(i)
  return indexes
}

// Position of a Three.js object's uuid in an array (-1 if absent).
export function findIndexByUuid(
  array: { uuid: string }[],
  uuid: string
): number {
  return array.findIndex((object) => object.uuid === uuid)
}

// Seeded PRNG (mulberry32) so a given network always scatters to the same
// layout — Load Example and uploads are reproducible instead of random each
// time. Call setRandomSeed() to restart the sequence. Mirrors the backend's
// random.seed(123) for layout algorithms.
let rngState = 123 >>> 0

export function setRandomSeed(seed: number): void {
  rngState = seed >>> 0
}

function seededRandom(): number {
  rngState = (rngState + 0x6d2b79f5) | 0
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Random float in [min, max) from the seeded sequence.
export function getRandomArbitrary(min: number, max: number): number {
  return seededRandom() * (max - min) + min
}

export function toRadians(angle: number): number {
  return angle * (Math.PI / 180)
}

export const delay_ms = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(res, ms))
