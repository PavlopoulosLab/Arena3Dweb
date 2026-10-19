import { afterEach, describe, expect, it } from 'vitest'
import type { NetworkData } from '../api/client'
import { store } from '../store'
import { ctx } from '../three'
import {
  CIRCOSJS_SCRIPT,
  GOSLING_EDITOR,
  JBROWSE_TRACK,
  JBROWSE_WEB,
  NGCIRCOS_SCRIPTS,
  circosjsData,
  circosjsHtml,
  goslingCsv,
  goslingEditorUrl,
  goslingSpec,
  jbrowseConfig,
  jbrowseFasta,
  jbrowseFiles,
  jbrowseRefNames,
  jbrowseUrl,
  jbrowseVcf,
  jsonCrushSwap,
  ngcircosHtml,
  ngcircosInput,
  ringNetwork,
  type Ring,
  type RingNode,
} from './circular_tools'

// Export → Visualizations → Gosling.js, NGCircos.js, CircosJS and JBrowse 2:
// the generated specs, pages and files from one ring of the network.

const node = (
  label: string,
  layer: string,
  slot: number,
  color: string,
  degree: number
): RingNode => ({
  id: `${label}_${layer}`,
  label,
  layer,
  slot,
  color,
  degree,
  value: degree,
})
// names that must be escaped: <, &, quotes, and a layer with a space
const a1 = node('x<y', 'Layer <A>', 0, '#ff0000', 2)
const a2 = node('b&c', 'Layer <A>', 1, '#ff0000', 2)
const b1 = node('"q"', 'B b', 0, '#00ff00', 2)
const b2 = node("it's", 'B b', 1, '#00ff00', 2)
const ring: Ring = {
  layers: [
    { name: 'Layer <A>', color: '#aa0000', nodes: [a1, a2] },
    { name: 'B b', color: '#00aa00', nodes: [b1, b2] },
  ],
  edges: [
    { source: a1, target: a2, channel: 'ch<1>', weight: 1, color: '#111111' },
    { source: a1, target: b1, channel: 'ch2', weight: 0.5, color: '#222222' },
    { source: b1, target: b2, channel: 'ch2', weight: 2, color: '#222222' },
    { source: a2, target: b2, channel: 'ch<1>', weight: 3, color: '#111111' },
  ],
  measure: 'degree',
}
const RAW = ['x<y', 'b&c', '"q"', "it's", 'ch<1>', 'Layer <A>']

// the JSON inside a page's <script type="application/json">
const pageData = (page: string) =>
  JSON.parse(
    page.match(
      /<script type="application\/json" id="arena3d-data">([^]*?)<\/script>/
    )![1]
  ) as Record<string, unknown>

type Track = Record<string, unknown> & {
  data: {
    values?: Record<string, unknown>[]
    url?: string
    type: string
    sampleLength?: number
  }
  tooltip?: { field: string }[]
}

describe('Gosling spec', () => {
  const spec = goslingSpec(ring) as {
    assembly: [string, number][]
    layout: string
    tracks: Track[]
  }

  it('is a circular spec on a custom assembly of the layers', () => {
    expect(spec.layout).toBe('circular')
    expect(spec.assembly).toEqual([
      ['Layer <A>', 4],
      ['B b', 4],
    ])
    expect(spec.tracks.map((t) => t.id)).toEqual([
      'layers',
      'nodes',
      'degree',
      'edges',
    ])
    for (const t of spec.tracks) {
      expect(t.data).toBeTruthy()
      expect(t.mark).toBeTruthy()
      expect(t.width).toBeGreaterThan(0)
      expect(t.height).toBeGreaterThan(0)
    }
  })

  it('carries every edge as a link between the middles of its nodes', () => {
    const edges = spec.tracks[3]
    const rows = edges.data.values!
    expect(rows).toHaveLength(ring.edges.length)
    expect(edges.mark).toBe('withinLink')
    expect(edges.data).toMatchObject({
      genomicFieldsToConvert: [
        { chromosomeField: 'source_layer', genomicFields: ['source_pos'] },
        { chromosomeField: 'target_layer', genomicFields: ['target_pos'] },
      ],
    })
    expect(rows[1]).toMatchObject({
      source_layer: 'Layer <A>',
      source_pos: 1,
      target_layer: 'B b',
      target_pos: 1,
      kind: 'between',
    })
    expect(rows[3]).toMatchObject({ source_pos: 3, target_pos: 3 })
    // all rows are drawn: sampling starts above sampleLength
    expect(edges.data.sampleLength).toBeGreaterThanOrEqual(rows.length)
    // the two overlaid link tracks split the edges within and between layers
    const kinds = (edges.tracks as { dataTransform: { oneOf: string[] }[] }[])
      .map((t) => t.dataTransform[0].oneOf[0])
      .sort()
    expect(kinds).toEqual(['between', 'within'])
  })

  it('colours from the scene: layers, nodes, and edges by channel', () => {
    expect(spec.tracks[0].color).toMatchObject({
      domain: ['Layer <A>', 'B b'],
      range: ['#aa0000', '#00aa00'],
    })
    expect(spec.tracks[1].color).toMatchObject({
      field: 'color',
      domain: ['#ff0000', '#00ff00'],
    })
    expect(spec.tracks[3].stroke).toMatchObject({
      field: 'channel',
      domain: ['ch<1>', 'ch2'],
      range: ['#111111', '#222222'],
      legend: true,
    })
  })

  it('escapes every name a tooltip shows (Gosling tooltips are HTML)', () => {
    const shown = spec.tracks.flatMap((t) =>
      (t.tooltip ?? []).flatMap(({ field }) =>
        t.data.values!.map((row) => String(row[field]))
      )
    )
    expect(shown.length).toBeGreaterThan(20)
    for (const text of shown) {
      expect(text).not.toMatch(/[<>"']/)
      expect(text).not.toMatch(/&(?!(lt|gt|amp|quot|#39);)/)
    }
    const json = JSON.stringify(spec.tracks.map((t) => t.data.values))
    for (const escaped of ['x&lt;y', 'b&amp;c', '&quot;q&quot;', 'it&#39;s'])
      expect(json).toContain(escaped)
  })

  it('reads hosted CSV tables by URL for the editor', () => {
    const hosted = goslingSpec(ring, {
      nodes: 'https://a.org/api/share/n',
      edges: 'https://a.org/api/share/e',
    }) as { tracks: Track[] }
    expect(hosted.tracks[1].data).toMatchObject({
      type: 'csv',
      url: 'https://a.org/api/share/n',
    })
    expect(hosted.tracks[3].data).toMatchObject({
      type: 'csv',
      url: 'https://a.org/api/share/e',
    })
    const csv = goslingCsv(ring)
    expect(csv.nodes.trim().split('\n')).toHaveLength(1 + 4)
    expect(csv.edges.trim().split('\n')).toHaveLength(1 + ring.edges.length)
    expect(csv.edges.split('\n')[0]).toBe(
      'source_layer,source_pos,target_layer,target_pos,source,target,channel,channel_name,weight,color,kind'
    )
    expect(csv.nodes).toContain(
      'Layer <A>,0,2,x&lt;y,Layer &lt;A&gt;,2,#ff0000\n'
    )
    // a name with a comma stays one CSV cell
    const comma = goslingCsv({
      ...ring,
      edges: [],
      layers: [
        { ...ring.layers[0], nodes: [node('a,b', 'L', 0, '#000000', 0)] },
      ],
    })
    expect(comma.nodes).toContain(',"a,b",')
    expect(comma.edges.trim().split('\n')).toHaveLength(1)
  })

  it('puts the spec in the editor link as JSONCrush reads it', () => {
    const url = new URL(goslingEditorUrl({ a: "it's", b: { c: [1, '!~'] } }))
    expect(`${url.origin}${url.pathname}`).toBe(GOSLING_EDITOR)
    const crushed = url.searchParams.get('spec')!
    expect(crushed.endsWith('_')).toBe(true)
    // JSONCrush.uncrush: drop the last character, then swap back
    expect(JSON.parse(jsonCrushSwap(crushed.slice(0, -1), false))).toEqual({
      a: "it's",
      b: { c: [1, '!~'] },
    })
  })
})

describe('NGCircos', () => {
  it('builds the genome, a node ring, a ring track and one LINK module per colour', () => {
    const input = ngcircosInput(ring, 'histogram')
    expect(input.genome).toEqual([
      [
        ['Layer &lt;A&gt;', 4],
        ['B b', 4],
      ],
    ])
    const names = input.modules.map((m) => m[0])
    expect(names).toEqual(['ARC01', 'HISTOGRAM01', 'LINK01', 'LINK02'])
    expect(input.modules[1][2]).toHaveLength(4)
    const links = input.modules.filter((m) => m[0].startsWith('LINK'))
    expect(links.map((m) => m[1].LinkFillColor)).toEqual(['#111111', '#222222'])
    // every edge is one LINK row on the genome's chromosomes
    const rows = links.flatMap((m) => m[2])
    expect(rows).toHaveLength(ring.edges.length)
    const chrs = new Set(input.genome[0].map(([c]) => c))
    for (const row of rows) {
      expect(chrs.has(row.g1chr as string)).toBe(true)
      expect(chrs.has(row.g2chr as string)).toBe(true)
    }
    expect(input.settings.genomeFillColor).toEqual(['#aa0000', '#00aa00'])
    expect(ngcircosInput(ring, 'heatmap').modules[1][0]).toBe('HEATMAP01')
    expect(
      ngcircosInput(ring, 'none').modules.map((m) => m[0])
    ).not.toContainEqual(expect.stringMatching(/HEATMAP|HISTOGRAM/))
  })

  it('writes a page that loads NGCircos from pinned CDN copies', () => {
    const page = ngcircosHtml(ring, 'heatmap')
    for (const src of NGCIRCOS_SCRIPTS) {
      expect(src).toMatch(/@v?\d+\.\d+\.\d+\/|\/\d+\.\d+\.\d+\//)
      expect(page).toContain(`<script src="${src}"></script>`)
    }
    expect(page).toContain('new NGCircos(...data.modules')
    const data = pageData(page)
    expect(data.modules).toHaveLength(4)
    // NGCircos puts names in HTML tooltips: all escaped; the plain layer
    // names only relabel its text labels, through textContent
    const { names, ...input } = data
    for (const raw of RAW) expect(JSON.stringify(input)).not.toContain(raw)
    expect(names).toEqual({ 'Layer &lt;A&gt;': 'Layer <A>', 'B b': 'B b' })
    expect(page).toContain('t.textContent = data.names[t.textContent]')
    // and no name can close the data's <script>
    expect(page.match(/id="arena3d-data">([^]*?)<\/script>/)![1]).not.toContain(
      '<'
    )
  })
})

describe('CircosJS', () => {
  it('lays the layers out and draws every edge as a chord', () => {
    const data = circosjsData(ring, 'heatmap')
    expect(data.layout).toEqual([
      { id: 'L1', label: 'Layer <A>', color: '#aa0000', len: 4 },
      { id: 'L2', label: 'B b', color: '#00aa00', len: 4 },
    ])
    expect(data.chords).toHaveLength(ring.edges.length)
    for (const c of data.chords) {
      expect(['L1', 'L2']).toContain(c.source.id)
      expect(['L1', 'L2']).toContain(c.target.id)
      expect(c.source.end).toBeGreaterThan(c.source.start)
    }
    expect(data.chords.map((c) => c.color)).toEqual(
      ring.edges.map((e) => e.color)
    )
    expect(data.nodes.map((n) => n.color)).toEqual([
      '#ff0000',
      '#ff0000',
      '#00ff00',
      '#00ff00',
    ])
    expect(data.track).toMatchObject({ type: 'heatmap', measure: 'degree' })
    expect(circosjsData(ring, 'none').track).toBeNull()
  })

  it('writes a page whose names cannot break out of the script', () => {
    const page = circosjsHtml(ring, 'histogram')
    expect(page).toContain(`<script src="${CIRCOSJS_SCRIPT}"></script>`)
    expect(CIRCOSJS_SCRIPT).toContain('circos@2.1.0')
    const json = page.match(/id="arena3d-data">([^]*?)<\/script>/)![1]
    expect(json).not.toContain('<')
    expect(pageData(page).chords).toHaveLength(ring.edges.length)
    // tooltips (HTML in CircosJS) escape the names in the page
    expect(page).toContain('esc(d.source.name)')
  })
})

describe('JBrowse 2', () => {
  it('names one sequence per layer, VCF-safe and unique', () => {
    expect([...jbrowseRefNames(ring).values()]).toEqual(['Layer__A_', 'B_b'])
    const odd = (names: string[]): Ring => ({
      ...ring,
      layers: names.map((name) => ({ ...ring.layers[0], name })),
    })
    expect([...jbrowseRefNames(odd(['a b', 'a_b', '#x:y'])).values()]).toEqual([
      'a_b',
      'a_b_2',
      '_x_y',
    ])
  })

  it('writes one VCF breakend per edge, between the sequences of the assembly', () => {
    const lines = jbrowseVcf(ring).trim().split('\n')
    expect(lines[0]).toBe('##fileformat=VCFv4.3')
    const records = lines.filter((l) => !l.startsWith('#'))
    expect(records).toHaveLength(ring.edges.length)
    const config = jbrowseConfig(ring, 'https://a.org/api/share/x') as {
      assemblies: {
        sequence: { adapter: { features: { refName: string; end: number }[] } }
      }[]
      tracks: { adapter: { type: string; vcfLocation: { uri: string } } }[]
    }
    const refs = new Set(
      config.assemblies[0].sequence.adapter.features.map((f) => f.refName)
    )
    for (const record of records) {
      const cols = record.split('\t')
      expect(cols).toHaveLength(8)
      expect(refs.has(cols[0])).toBe(true)
      const [, mate] = cols[4].match(/^N\[([^:]+):\d+\[$/)!
      expect(refs.has(mate)).toBe(true)
      expect(cols[7]).toMatch(/^SVTYPE=BND;.*;COLOR=#[0-9a-f]{6}$/)
    }
    // a1 (Layer <A>, slot 0) to b1 (B b, slot 0): 1-based middles
    expect(records[1].split('\t').slice(0, 5)).toEqual([
      'Layer__A_',
      '2',
      'edge2',
      'N',
      'N[B_b:2[',
    ])
    expect(config.tracks[0].adapter).toEqual({
      type: 'VcfAdapter',
      vcfLocation: {
        uri: 'https://a.org/api/share/x',
        locationType: 'UriLocation',
      },
    })
  })

  it('percent-encodes the names in INFO, so no field or line breaks', () => {
    const odd = node('a;b=c,d\te\nf', 'Layer <A>', 0, '#ff0000', 1)
    const vcf = jbrowseVcf({
      ...ring,
      edges: [{ ...ring.edges[0], source: odd }],
    })
    const record = vcf.trim().split('\n').at(-1)!
    expect(record.split('\t')).toHaveLength(8)
    const source = record.match(/SOURCE=([^;]*)/)![1]
    expect(decodeURIComponent(source)).toBe('a;b=c,d\te\nf (Layer <A>)')
  })

  it('indexes the FASTA of the layers for JBrowse Desktop', () => {
    const { fasta, fai } = jbrowseFasta(ring)
    for (const line of fai.trim().split('\n')) {
      const [, len, offset] = line.split('\t').map(Number)
      expect(fasta.slice(offset, offset + len)).toBe('N'.repeat(len))
      expect(fasta[offset + len]).toBe('\n')
    }
    expect(Object.keys(jbrowseFiles(ring))).toEqual([
      'config.json',
      'arena3d_edges.vcf',
      'arena3d_layers.fa',
      'arena3d_layers.fa.fai',
      'README.txt',
    ])
  })

  it('opens the hosted config in JBrowse Web on the circular view', () => {
    const url = new URL(jbrowseUrl('https://a.org/api/share/cfg'))
    expect(`${url.origin}${url.pathname}`).toBe(JBROWSE_WEB)
    expect(url.searchParams.get('config')).toBe('https://a.org/api/share/cfg')
    const session = url.searchParams.get('session')!
    expect(session.startsWith('spec-')).toBe(true)
    expect(JSON.parse(session.slice(5))).toEqual({
      views: [
        { type: 'CircularView', assembly: 'arena3d', tracks: [JBROWSE_TRACK] },
      ],
    })
  })
})

describe('ring of the scene', () => {
  const saved = {
    nodeObjects: ctx.nodeObjects,
    nodeLayerNames: ctx.nodeLayerNames,
    edgeObjects: ctx.edgeObjects,
    channelVisibility: ctx.channelVisibility,
  }
  afterEach(() => {
    Object.assign(ctx, saved)
    store.update({ network: null, selectedLayers: [] })
  })

  it('takes the ticked layers and the shown, ticked channels, with scene colours', () => {
    const net: NetworkData = {
      layers: ['L1', 'L2', 'L3'],
      channels: ['c1', 'c2'],
      nodes: [
        ['A', 'L1'],
        ['B', 'L1'],
        ['C', 'L2'],
        ['D', 'L3'],
      ].map(([label, layer]) => ({ id: `${label}_${layer}`, label, layer })),
      edges: [
        ['A_L1', 'B_L1', 'c1'],
        ['A_L1', 'B_L1', 'c2'],
        ['A_L1', 'C_L2', 'c1'],
        ['B_L1', 'D_L3', 'c1'],
      ].map(([src, trg, channel]) => ({
        src,
        trg,
        source_node: src[0],
        source_layer: src.slice(2),
        target_node: trg[0],
        target_layer: trg.slice(2),
        weight: 1,
        scaled_weight: 1,
        channel,
      })),
      warnings: [],
    }
    const colors: Record<string, string> = {
      A_L1: '#ff0000',
      B_L1: '#ff0000',
      C_L2: '#0000ff',
      D_L3: '#00ff00',
    }
    Object.assign(ctx, {
      nodeLayerNames: Object.keys(colors),
      nodeObjects: Object.entries(colors).map(([id, color]) => ({
        color,
        layer: id.slice(2),
      })),
      edgeObjects: [
        ['A_L1---B_L1', ['c1', 'c2']],
        ['A_L1---C_L2', ['c1']],
        ['B_L1---D_L3', ['c1']],
      ].map(([name, channels]) => ({
        name,
        channels,
        decideColor: (i: number) =>
          channels[i] === 'c1' ? '#123456' : '#654321',
      })),
      channelVisibility: { c1: true, c2: true },
    })
    store.update({ network: net, selectedLayers: ['L1', 'L2'] })

    const r = ringNetwork(null)
    expect(r.layers.map((l) => [l.name, l.color, l.nodes.length])).toEqual([
      ['L1', '#ff0000', 2],
      ['L2', '#0000ff', 1],
    ])
    // the edge to L3 is out; both channels of A–B are in, coloured per channel
    expect(
      r.edges.map((e) => [e.source.label, e.target.label, e.color])
    ).toEqual([
      ['A', 'B', '#123456'],
      ['A', 'B', '#654321'],
      ['A', 'C', '#123456'],
    ])
    expect(r.layers[0].nodes.map((n) => n.degree)).toEqual([3, 2])
    expect(r.layers[0].nodes[0].value).toBe(3)

    // a channel unticked for layouts or hidden in the scene stays out
    expect(ringNetwork(['c1']).edges).toHaveLength(2)
    ctx.channelVisibility.c1 = false
    expect(ringNetwork(null).edges.map((e) => e.channel)).toEqual(['c2'])
  })
})
