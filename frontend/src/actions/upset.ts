// UpSet plots (Lex et al., 2014) for the set comparisons of Analyze: which
// elements the compared sets share. Every element goes to exactly one
// combination — the sets it belongs to — so the bars partition the union: a
// bar with one dot holds what only that set has, a bar with several dots what
// exactly those sets share. Drawn as SVG, with no library.

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export interface UpsetSet {
  name: string
  members: Iterable<string>
  color?: string // the set-size bar; a neutral grey when missing
}

export interface UpsetOptions {
  maxBars?: number // combinations shown, largest first (default 40)
  element?: string // what the elements are, for the titles ('nodes')
  title?: string
}

export interface UpsetBar {
  sets: number[] // indexes into the input
  count: number
  sample: string[] // a few members, for the tooltip
}

/** The exclusive intersections, largest first. */
export function upsetBars(sets: UpsetSet[], maxBars = 40): UpsetBar[] {
  const members = sets.map((s) => new Set(s.members))
  const all = new Set<string>()
  for (const m of members) for (const e of m) all.add(e)
  const combos = new Map<string, UpsetBar>()
  for (const e of all) {
    const inSets = members.flatMap((m, i) => (m.has(e) ? [i] : []))
    const key = inSets.join(',')
    const bar = combos.get(key) ?? { sets: inSets, count: 0, sample: [] }
    bar.count++
    if (bar.sample.length < 6) bar.sample.push(e)
    combos.set(key, bar)
  }
  return [...combos.values()]
    .sort((a, b) => b.count - a.count || a.sets.length - b.sets.length)
    .slice(0, maxBars)
}

const hex = (c: string | undefined) =>
  c && /^#[0-9a-f]{6}$/i.test(c) ? c : '#8a93a6'

export function upsetSvg(sets: UpsetSet[], opts: UpsetOptions = {}): string {
  const element = opts.element ?? 'elements'
  const members = sets.map((s) => new Set(s.members))
  const bars = upsetBars(sets, opts.maxBars ?? 40)
  const union = new Set<string>()
  for (const m of members) for (const e of m) union.add(e)
  const rows = sets
    .map((_, i) => i)
    .sort((a, b) => members[b].size - members[a].size)
  const rowOf = new Map(rows.map((set, r) => [set, r]))

  const sizeX = 58 // where the horizontal set-size bars start (room for the count)
  const sizeW = 120
  const nameW = 150
  const left = sizeX + sizeW + 10 + nameW + 8
  const top = opts.title ? 34 : 14
  const colW = 24
  const rowH = 20
  const barH = 150
  const matrixTop = top + barH + 28
  const width = left + Math.max(1, bars.length) * colW + 24
  const height = matrixTop + sets.length * rowH + 18
  const maxCount = Math.max(1, ...bars.map((b) => b.count))
  const maxSize = Math.max(1, ...members.map((m) => m.size))
  const f = (v: number) => v.toFixed(1)
  const cx = (j: number) => left + j * colW + colW / 2
  const cy = (r: number) => matrixTop + r * rowH + rowH / 2

  const title = opts.title
    ? `<text x="14" y="22" font-size="13" font-weight="600" fill="#222">${esc(opts.title)}</text>`
    : ''
  const topBars = bars
    .map((b, j) => {
      const h = (b.count / maxCount) * barH
      const y = top + barH - h
      const names = b.sets.map((i) => sets[i].name)
      return `<g><rect x="${f(cx(j) - 8)}" y="${f(y)}" width="16" height="${f(h)}" rx="2" fill="#4a6fa5"><title>${b.count} ${esc(element)} in ${esc(names.join(' ∩ '))} only${b.sample.length ? ': ' + esc(b.sample.join(', ')) + (b.count > b.sample.length ? ', …' : '') : ''}</title></rect><text x="${f(cx(j))}" y="${f(y - 4)}" text-anchor="middle" font-size="9" fill="#333">${b.count}</text></g>`
    })
    .join('\n')
  const matrix = bars
    .map((b, j) => {
      const inRows = b.sets.map((i) => rowOf.get(i)!)
      const line =
        inRows.length > 1
          ? `<line x1="${f(cx(j))}" y1="${f(cy(Math.min(...inRows)))}" x2="${f(cx(j))}" y2="${f(cy(Math.max(...inRows)))}" stroke="#4a6fa5" stroke-width="2.5"/>`
          : ''
      const dots = sets
        .map((_, i) => {
          const on = b.sets.includes(i)
          return `<circle cx="${f(cx(j))}" cy="${f(cy(rowOf.get(i)!))}" r="5.5" fill="${on ? '#4a6fa5' : '#dfe3ea'}"/>`
        })
        .join('')
      return `<g>${line}${dots}</g>`
    })
    .join('\n')
  const stripes = rows
    .map((_, r) =>
      r % 2
        ? `<rect x="${f(left - 4)}" y="${f(matrixTop + r * rowH)}" width="${f(bars.length * colW + 8)}" height="${rowH}" fill="#f3f5f8"/>`
        : ''
    )
    .join('')
  const sideBars = rows
    .map((set, r) => {
      const size = members[set].size
      const w = (size / maxSize) * sizeW
      const name = sets[set].name
      const shown = name.length > 24 ? name.slice(0, 23) + '…' : name
      return `<g><rect x="${f(sizeX + sizeW - w)}" y="${f(cy(r) - 7)}" width="${f(w)}" height="14" rx="2" fill="${hex(sets[set].color)}"><title>${esc(name)}: ${size} ${esc(element)}</title></rect><text x="${f(sizeX + sizeW - w - 4)}" y="${f(cy(r) + 3.5)}" text-anchor="end" font-size="9" fill="#333">${size}</text><text x="${f(sizeX + sizeW + 10)}" y="${f(cy(r) + 3.5)}" font-size="10" fill="#222"><title>${esc(name)}</title>${esc(shown)}</text></g>`
    })
    .join('\n')
  const axis = `<line x1="${f(left - 4)}" y1="${f(top + barH + 0.5)}" x2="${f(left + bars.length * colW + 4)}" y2="${f(top + barH + 0.5)}" stroke="#999"/><text x="${f(left - 8)}" y="${f(top + 10)}" text-anchor="end" font-size="9" fill="#666">${esc(element)} per combination</text><text x="${f(sizeX + sizeW)}" y="${f(matrixTop - 6)}" text-anchor="end" font-size="9" fill="#666">set size</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, sans-serif">
<rect width="100%" height="100%" fill="#ffffff"/>
<title>UpSet plot: ${sets.length} sets, ${union.size} ${esc(element)}, ${bars.length} combinations</title>
${title}
${stripes}
${axis}
<g>${topBars}</g>
<g>${matrix}</g>
<g>${sideBars}</g>
</svg>
`
}
