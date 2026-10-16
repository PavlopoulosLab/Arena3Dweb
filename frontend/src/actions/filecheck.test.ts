import { describe, expect, it } from 'vitest'
import { checkFileMeta, checkFileText } from './filecheck'

describe('checkFileMeta', () => {
  it('flags empty, huge and wrong-extension files', () => {
    expect(checkFileMeta('a.tsv', 0, 'network')).toMatch(/empty/)
    expect(checkFileMeta('a.tsv', 30e6, 'network')).toMatch(/limit is 20 MB/)
    expect(checkFileMeta('a.xlsx', 10, 'network')).toMatch(/expected a/)
    expect(checkFileMeta('a.GraphML', 10, 'network')).toBeNull()
    expect(checkFileMeta('s.tsv', 10, 'session')).toMatch(/\.json/)
  })
})

describe('checkFileText', () => {
  const ok =
    'SourceNode\tSourceLayer\tTargetNode\tTargetLayer\tWeight\nA\tL1\tB\tL1\t1\n'

  it('accepts a valid network and a 2-column edgelist', () => {
    expect(checkFileText('n.tsv', ok, 'network')).toBeNull()
    expect(
      checkFileText('n.tsv', 'SourceNode\tTargetNode\nA\tB\n', 'network')
    ).toBeNull()
  })

  it('spots CSV, missing columns (with case hint), ragged rows, bad weights', () => {
    expect(
      checkFileText('n.tsv', 'SourceNode,TargetNode\nA,B\n', 'network')
    ).toMatch(/TAB-separated/)
    expect(
      checkFileText(
        'n.tsv',
        'sourcenode\tSourceLayer\tTargetNode\tTargetLayer\nA\tL\tB\tL\n',
        'network'
      )
    ).toMatch(/missing column SourceNode.*case-sensitive \(found sourcenode\)/)
    expect(checkFileText('n.tsv', ok + 'C\n', 'network')).toMatch(
      /line 3 has 1 column/
    )
    expect(
      checkFileText('n.tsv', ok + 'C\tL1\tD\tL1\tlots\n', 'network')
    ).toMatch(/line 3 has a non-numeric Weight "lots"/)
    expect(
      checkFileText('n.tsv', 'SourceNode\tTargetNode\n', 'network')
    ).toMatch(/no rows/)
  })

  it('checks JSON sessions and other formats', () => {
    expect(checkFileText('s.json', '{bad', 'session')).toMatch(/not valid JSON/)
    expect(
      checkFileText('s.json', '{"layers":[],"nodes":[]}', 'session')
    ).toMatch(/edges/)
    expect(
      checkFileText('s.json', '{"layers":[],"nodes":[],"edges":[]}', 'session')
    ).toBeNull()
    expect(checkFileText('g.graphml', 'hello', 'network')).toMatch(/XML/)
    expect(checkFileText('g.gml', 'graph [ ]', 'network')).toBeNull()
    expect(
      checkFileText('a.tsv', 'Node\tLayer\nA\tL\n', 'nodeAttributes')
    ).toBeNull()
  })
})
