import { describe, expect, it } from 'vitest'
import {
  safeColor,
  escapeHtml,
  exists,
  getUniqueValues,
  getCaseInsensitiveIndices,
  findIndexByUuid,
  getRandomArbitrary,
  toRadians,
} from './utils'

describe('utils', () => {
  it('exists uses loose equality', () => {
    expect(exists([1, 2, 3], 2)).toBe(true)
    expect(exists(['a'], 'b')).toBe(false)
  })

  it('getUniqueValues dedupes preserving order', () => {
    expect(getUniqueValues(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('getCaseInsensitiveIndices finds all case-insensitive matches', () => {
    expect(getCaseInsensitiveIndices(['Foo', 'bar', 'FOO'], 'foo')).toEqual([
      0, 2,
    ])
  })

  it('findIndexByUuid returns position or -1', () => {
    const arr = [{ uuid: 'x' }, { uuid: 'y' }]
    expect(findIndexByUuid(arr, 'y')).toBe(1)
    expect(findIndexByUuid(arr, 'z')).toBe(-1)
  })

  it('getRandomArbitrary stays within [min, max)', () => {
    for (let i = 0; i < 100; i++) {
      const r = getRandomArbitrary(5, 10)
      expect(r).toBeGreaterThanOrEqual(5)
      expect(r).toBeLessThan(10)
    }
  })

  it('toRadians converts degrees', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI)
  })

  it('escapeHtml escapes all five HTML metacharacters incl. single quote', () => {
    expect(escapeHtml(`<a href='x'>&"</a>`)).toBe(
      '&lt;a href=&#39;x&#39;&gt;&amp;&quot;&lt;/a&gt;'
    )
  })
})

describe('safeColor', () => {
  it('keeps CSS colours', () => {
    for (const c of [
      '#abc',
      '#a1b2c3',
      '#a1b2c3d4',
      'rgb(1, 2, 3)',
      'hsla(120, 50%, 50%, 0.5)',
      'red',
    ])
      expect(safeColor(c)).toBe(c)
  })
  it('replaces anything that could break out of an attribute or add CSS', () => {
    for (const c of [
      '#fff"><img src=x onerror=alert(1)>',
      'red;position:fixed;inset:0',
      'url(https://evil.example/x)',
      'expression(alert(1))',
      '',
      undefined,
      42,
    ])
      expect(safeColor(c)).toBe('#888888')
    expect(safeColor('nope;', '#000000')).toBe('#000000')
  })
})
