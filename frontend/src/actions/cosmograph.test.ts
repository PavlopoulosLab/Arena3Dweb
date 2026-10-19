import { describe, expect, it } from 'vitest'
import { COSMOGRAPH_APP, cosmographUrl } from './cosmograph'

describe('cosmographUrl', () => {
  it("builds Cosmograph's QueryString link with the hosted files", () => {
    const url = new URL(
      cosmographUrl(
        'https://arena3d.org/api/share/aaaaaaaa',
        'http://localhost:5173/api/share/bbbbbbbb'
      )
    )
    expect(`${url.origin}${url.pathname}`).toBe(COSMOGRAPH_APP)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      data: 'https://arena3d.org/api/share/aaaaaaaa',
      meta: 'http://localhost:5173/api/share/bbbbbbbb',
      source: 'source',
      target: 'target',
      nodeColor: 'color',
      nodeSize: 'size',
      nodeLabel: 'label',
    })
  })

  it('takes only http(s) addresses', () => {
    expect(() =>
      cosmographUrl('javascript:alert(1)', 'https://a.org/api/share/x')
    ).toThrow(/http\(s\)/)
    expect(() =>
      cosmographUrl('https://a.org/api/share/x', 'data:text/csv,id')
    ).toThrow(/http\(s\)/)
  })
})
