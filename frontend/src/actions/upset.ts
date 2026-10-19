// UpSet plots (Lex et al., 2014) for the set comparisons of Analyze: which
// elements the compared sets share. Every element goes to exactly one
// combination — the sets it belongs to — so the bars partition the union: a
// bar with one dot holds what only that set has, a bar with several dots what
// exactly those sets share. Drawn as SVG, with no library. The set logic
// below also backs the interactive plot (ui/upset.ts): picked bars, or the
// union / intersection of picked sets, as members, as the nodes they are in
// the network they came from, and as the subnetwork those nodes induce.

import type { EdgeModel, NetworkData, SessionData } from '../api/client'

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Where a set's members are nodes: a layer's node names, or node ids
// (Node_Layer) when no layer is given.
export interface UpsetOrigin {
  network: NetworkData
  label?: string // the network's name: keeps two networks' layers apart
  layer?: string
}

export interface UpsetSet {
  name: string
  members: Iterable<string>
  color?: string // the set-size bar; a neutral grey when missing
  origin?: UpsetOrigin // for selecting the members and cutting a subnetwork
}

// bars by size (the default), or by degree: fewest sets first, or most
export type UpsetSort = 'size' | 'degree' | 'degree-desc'

export interface UpsetOptions {
  maxBars?: number // combinations shown, largest first (default 40)
  element?: string // what the elements are, for the titles ('nodes')
  title?: string
  sort?: UpsetSort
  bars?: UpsetBar[] // already computed (upsetBars), so plot and caller agree
  interactive?: boolean // focusable bars and set rows, data-* hooks, no <title>s
}

export interface UpsetBar {
  key: string // the set indexes, joined by ','
  sets: number[] // indexes into the input
  count: number
  members: string[]
}

export const memberSets = (sets: UpsetSet[]): Set<string>[] =>
  sets.map((s) => new Set(s.members))

const byName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true })

const bySize = (a: UpsetBar, b: UpsetBar) =>
  b.count - a.count || a.sets.length - b.sets.length

export function sortBars(bars: UpsetBar[], sort: UpsetSort = 'size') {
  const out = bars.slice()
  if (sort === 'degree')
    return out.sort(
      (a, b) => a.sets.length - b.sets.length || b.count - a.count
    )
  if (sort === 'degree-desc')
    return out.sort(
      (a, b) => b.sets.length - a.sets.length || b.count - a.count
    )
  return out.sort(bySize)
}

/** The exclusive intersections: the `maxBars` largest, in `sort` order. */
export function upsetBars(
  sets: UpsetSet[],
  maxBars = 40,
  sort: UpsetSort = 'size'
): UpsetBar[] {
  const members = memberSets(sets)
  const all = new Set<string>()
  for (const m of members) for (const e of m) all.add(e)
  const combos = new Map<string, UpsetBar>()
  for (const e of all) {
    const inSets = members.flatMap((m, i) => (m.has(e) ? [i] : []))
    const key = inSets.join(',')
    const bar = combos.get(key) ?? { key, sets: inSets, count: 0, members: [] }
    bar.count++
    bar.members.push(e)
    combos.set(key, bar)
  }
  return sortBars([...combos.values()].sort(bySize).slice(0, maxBars), sort)
}

// ------------------------------------------------------------ set logic

/** Members of exactly the chosen sets and no other: one UpSet bar. */
export function exactIntersection(
  sets: Set<string>[],
  chosen: number[]
): string[] {
  const inside = new Set(chosen)
  if (inside.size === 0) return []
  const [first, ...rest] = [...inside]
  const out: string[] = []
  for (const e of sets[first])
    if (
      rest.every((i) => sets[i].has(e)) &&
      sets.every((s, i) => inside.has(i) || !s.has(e))
    )
      out.push(e)
  return out.sort(byName)
}

/** Members of any of the chosen sets. */
export function unionOf(sets: Set<string>[], chosen: number[]): string[] {
  const out = new Set<string>()
  for (const i of chosen) for (const e of sets[i]) out.add(e)
  return [...out].sort(byName)
}

/** Members of every chosen set (other sets may hold them too). */
export function intersectionOf(
  sets: Set<string>[],
  chosen: number[]
): string[] {
  if (chosen.length === 0) return []
  const [first, ...rest] = chosen
  return [...sets[first]]
    .filter((e) => rest.every((i) => sets[i].has(e)))
    .sort(byName)
}

// What is picked in the plot: bars (each one exactly its sets), or sets
// joined as a union or an intersection.
export type UpsetPick =
  { bars: number[][] } | { sets: number[]; op: 'union' | 'intersection' }

export interface UpsetSelection {
  members: string[]
  sets: number[] // where they were picked: their nodes are the copies there
}

export function pickMembers(
  sets: Set<string>[],
  pick: UpsetPick
): UpsetSelection {
  const numeric = (a: number, b: number) => a - b
  if ('bars' in pick) {
    const members = new Set<string>()
    const involved = new Set<number>()
    for (const bar of pick.bars) {
      for (const e of exactIntersection(sets, bar)) members.add(e)
      for (const i of bar) involved.add(i)
    }
    return {
      members: [...members].sort(byName),
      sets: [...involved].sort(numeric),
    }
  }
  const chosen = [...new Set(pick.sets)].sort(numeric)
  return {
    members:
      pick.op === 'union'
        ? unionOf(sets, chosen)
        : intersectionOf(sets, chosen),
    sets: chosen,
  }
}

// ------------------------------------------------- nodes and subnetworks

// node ids of a network by layer and name
const idIndex = new WeakMap<NetworkData, Map<string, string>>()
function nodeId(
  net: NetworkData,
  layer: string,
  name: string
): string | undefined {
  let index = idIndex.get(net)
  if (!index) {
    index = new Map(net.nodes.map((n) => [`${n.layer}\u0000${n.label}`, n.id]))
    idIndex.set(net, index)
  }
  return index.get(`${layer}\u0000${name}`)
}

export interface UpsetNodes {
  origin: UpsetOrigin
  ids: Set<string>
}

/** The selection as nodes — every copy of a member in the sets it was picked
 * in — grouped by the network they belong to. */
export function selectionNodes(
  sets: UpsetSet[],
  sel: UpsetSelection,
  members: Set<string>[] = memberSets(sets)
): UpsetNodes[] {
  const picked = new Set(sel.members)
  const parts = new Map<NetworkData, UpsetNodes>()
  for (const i of sel.sets) {
    const origin = sets[i].origin
    if (!origin) continue
    const part = parts.get(origin.network) ?? { origin, ids: new Set() }
    parts.set(origin.network, part)
    for (const e of members[i]) {
      if (!picked.has(e)) continue
      const id =
        origin.layer === undefined ? e : nodeId(origin.network, origin.layer, e)
      if (id !== undefined) part.ids.add(id)
    }
  }
  return [...parts.values()].filter((p) => p.ids.size > 0)
}

/** The subnetwork the nodes induce: those nodes, every edge among them, and
 * the layers and channels they use. */
export function inducedSubnetwork(
  net: NetworkData,
  ids: Set<string>
): NetworkData {
  const nodes = net.nodes.filter((n) => ids.has(n.id))
  const edges = net.edges.filter((e) => ids.has(e.src) && ids.has(e.trg))
  const layers = new Set(nodes.map((n) => n.layer))
  const channels = new Set(edges.map((e) => e.channel))
  return {
    nodes: nodes.map((n) => ({ ...n })),
    edges: edges.map((e) => ({ ...e })),
    layers: net.layers.filter((l) => layers.has(l)),
    channels: net.channels.filter((c) => channels.has(c)),
    warnings: [],
  }
}

/** One network from the selected nodes: one network's subnetwork as it is;
 * from several (Compare Networks), each layer is named after its network. */
export function selectionSubnetwork(parts: UpsetNodes[]): NetworkData {
  const subs = parts.map((p) => inducedSubnetwork(p.origin.network, p.ids))
  if (subs.length === 1) return subs[0]
  const out: NetworkData = {
    nodes: [],
    edges: [],
    layers: [],
    channels: [],
    warnings: [],
  }
  const used = new Set<string>()
  subs.forEach((sub, k) => {
    const base = parts[k].origin.label ?? `Network ${k + 1}`
    let label = base
    for (let n = 2; used.has(label); n++) label = `${base} (${n})`
    used.add(label)
    const layer = (l: string) => `${label}: ${l}`
    const ids = new Map<string, string>()
    for (const n of sub.nodes) {
      const id = `${n.label}_${layer(n.layer)}`
      ids.set(n.id, id)
      out.nodes.push({ id, label: n.label, layer: layer(n.layer) })
    }
    for (const e of sub.edges)
      out.edges.push({
        ...e,
        src: ids.get(e.src)!,
        trg: ids.get(e.trg)!,
        source_layer: layer(e.source_layer),
        target_layer: layer(e.target_layer),
      })
    out.layers.push(...sub.layers.map(layer))
    for (const c of sub.channels)
      if (!out.channels.includes(c)) out.channels.push(c)
  })
  // channels are all-or-nothing in a network (as in actions/merge.ts)
  if (out.edges.some((e) => e.channel == null)) {
    for (const e of out.edges) e.channel = null
    out.channels = []
  }
  return out
}

/** Another loaded network (a saved session) as network data, as
 * buildFromSession reads it: opacity stands in for the weight. */
export function sessionNetwork(s: SessionData): NetworkData {
  const byId = new Map(s.nodes.map((n) => [`${n.name}_${n.layer}`, n]))
  const edges: EdgeModel[] = s.edges.map((e) => {
    const src = byId.get(e.src)
    const trg = byId.get(e.trg)
    return {
      src: e.src,
      trg: e.trg,
      source_node: src?.name ?? e.src,
      source_layer: src?.layer ?? '',
      target_node: trg?.name ?? e.trg,
      target_layer: trg?.layer ?? '',
      weight: Number(e.opacity),
      scaled_weight: Number(e.opacity),
      channel: e.channel ?? null,
    }
  })
  return {
    nodes: s.nodes.map((n) => ({
      id: `${n.name}_${n.layer}`,
      label: n.name,
      layer: n.layer,
    })),
    edges,
    layers: s.layers.map((l) => l.name),
    channels: [
      ...new Set(s.edges.map((e) => e.channel).filter((c): c is string => !!c)),
    ],
    warnings: [],
  }
}

// ------------------------------------------------------------------- SVG

const hex = (c: string | undefined) =>
  c && /^#[0-9a-f]{6}$/i.test(c) ? c : '#8a93a6'

// The colours are presentation attributes, so the downloaded SVG stands on
// its own; the interactive plot's classes let the app's CSS retheme it.
export function upsetSvg(sets: UpsetSet[], opts: UpsetOptions = {}): string {
  const element = opts.element ?? 'elements'
  const live = opts.interactive ?? false
  const members = memberSets(sets)
  const bars = opts.bars ?? upsetBars(sets, opts.maxBars ?? 40, opts.sort)
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
  const tip = (text: string) => (live ? '' : `<title>${esc(text)}</title>`)

  const title = opts.title
    ? `<text class="up-ink" x="14" y="22" font-size="13" font-weight="600" fill="#222">${esc(opts.title)}</text>`
    : ''
  const columns = bars
    .map((b, j) => {
      const h = (b.count / maxCount) * barH
      const y = top + barH - h
      const names = b.sets.map((i) => sets[i].name)
      const sample = b.members.slice(0, 6)
      const more = b.count > sample.length ? ', …' : ''
      const bar = `<rect class="up-bar" x="${f(cx(j) - 8)}" y="${f(y)}" width="16" height="${f(h)}" rx="2" fill="#4a6fa5">${tip(`${b.count} ${element} in ${names.join(' ∩ ')} only${sample.length ? ': ' + sample.join(', ') + more : ''}`)}</rect><text class="up-ink" x="${f(cx(j))}" y="${f(y - 4)}" text-anchor="middle" font-size="9" fill="#333">${b.count}</text>`
      const inRows = b.sets.map((i) => rowOf.get(i)!)
      const line =
        inRows.length > 1
          ? `<line class="up-link" x1="${f(cx(j))}" y1="${f(cy(Math.min(...inRows)))}" x2="${f(cx(j))}" y2="${f(cy(Math.max(...inRows)))}" stroke="#4a6fa5" stroke-width="2.5"/>`
          : ''
      const dots = sets
        .map((_, i) => {
          const on = b.sets.includes(i)
          return `<circle class="${on ? 'up-dot up-on' : 'up-dot'}" cx="${f(cx(j))}" cy="${f(cy(rowOf.get(i)!))}" r="5.5" fill="${on ? '#4a6fa5' : '#dfe3ea'}"/>`
        })
        .join('')
      if (!live) return `<g>${bar}</g><g>${line}${dots}</g>`
      const label = `${b.count} ${element} in ${names.join(' and ')} only`
      const hit = `<rect class="up-hit" x="${f(cx(j) - colW / 2)}" y="${f(top)}" width="${colW}" height="${f(matrixTop + sets.length * rowH - top)}" fill="transparent"/>`
      return `<g class="up-col" data-bar="${j}" tabindex="0" role="button" aria-pressed="false" aria-label="${esc(label)}">${hit}${bar}${line}${dots}</g>`
    })
    .join('\n')
  const bands = rows
    .map((set, r) => {
      const stripe = r % 2 === 1
      if (!live && !stripe) return ''
      return `<rect class="${stripe ? 'up-band up-stripe' : 'up-band'}"${live ? ` data-band="${set}"` : ''} x="${f(left - 4)}" y="${f(matrixTop + r * rowH)}" width="${f(bars.length * colW + 8)}" height="${rowH}" fill="${stripe ? '#f3f5f8' : 'transparent'}"/>`
    })
    .join('')
  const sideBars = rows
    .map((set, r) => {
      const size = members[set].size
      const w = (size / maxSize) * sizeW
      const name = sets[set].name
      const shown = name.length > 24 ? name.slice(0, 23) + '…' : name
      const body = `<rect class="up-size" x="${f(sizeX + sizeW - w)}" y="${f(cy(r) - 7)}" width="${f(w)}" height="14" rx="2" fill="${hex(sets[set].color)}">${tip(`${name}: ${size} ${element}`)}</rect><text class="up-ink" x="${f(sizeX + sizeW - w - 4)}" y="${f(cy(r) + 3.5)}" text-anchor="end" font-size="9" fill="#333">${size}</text><text class="up-ink" x="${f(sizeX + sizeW + 10)}" y="${f(cy(r) + 3.5)}" font-size="10" fill="#222">${tip(name)}${esc(shown)}</text>`
      if (!live) return `<g>${body}</g>`
      const hit = `<rect class="up-hit" x="2" y="${f(cy(r) - rowH / 2)}" width="${f(left - 10)}" height="${rowH}" fill="transparent"/>`
      return `<g class="up-set" data-set="${set}" tabindex="0" role="button" aria-pressed="false" aria-label="${esc(`${name}: ${size} ${element}`)}">${hit}${body}</g>`
    })
    .join('\n')
  const axis = `<line class="up-axis" x1="${f(left - 4)}" y1="${f(top + barH + 0.5)}" x2="${f(left + bars.length * colW + 4)}" y2="${f(top + barH + 0.5)}" stroke="#999"/><text class="up-muted" x="${f(left - 8)}" y="${f(top + 10)}" text-anchor="end" font-size="9" fill="#666">${esc(element)} per combination</text><text class="up-muted" x="${f(sizeX + sizeW)}" y="${f(matrixTop - 6)}" text-anchor="end" font-size="9" fill="#666">set size</text>`
  const summary = `UpSet plot: ${sets.length} sets, ${union.size} ${element}, ${bars.length} combinations`
  return `<svg xmlns="http://www.w3.org/2000/svg"${live ? ' class="upset-svg" role="group"' : ''} width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, sans-serif"${live ? ` aria-label="${esc(summary)}"` : ''}>
<rect class="up-bg" width="100%" height="100%" fill="#ffffff"/>
${live ? '' : `<title>${esc(summary)}</title>`}
${title}
${bands}
${axis}
<g>${columns}</g>
<g>${sideBars}</g>
</svg>
`
}
