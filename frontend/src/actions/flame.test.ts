import { describe, expect, it } from 'vitest'
import { FLAME_DEFAULT_SERVER, flameText, flameUrl } from './flame'

// Export → Send to Flame: the lists travel in Flame's url_genes parameter.

const lists = [
  { name: 'L1', genes: ['TP53', 'BRCA1'] },
  { name: 'L2', genes: ['EGFR'] },
]

describe('flame links', () => {
  it('carries the lists in url_genes, lists by ; and genes by ,', () => {
    expect(flameUrl('', lists)).toBe(
      `${FLAME_DEFAULT_SERVER}?url_genes=TP53,BRCA1;EGFR`
    )
    expect(flameUrl('https://flame.test/app?x=1', lists)).toBe(
      'https://flame.test/app?x=1&url_genes=TP53,BRCA1;EGFR'
    )
  })
  it('keeps the separators out of names and opens web addresses only', () => {
    expect(
      flameUrl('https://flame.test/', [{ name: 'a', genes: ['A B', 'C;D'] }])
    ).toContain('url_genes=A_B,C_D')
    expect(() => flameUrl('javascript:alert(1)', lists)).toThrow(/http/)
  })
  it('writes one block per list for pasting', () => {
    expect(flameText(lists)).toBe('# L1\nTP53, BRCA1\n\n# L2\nEGFR\n')
  })
})
