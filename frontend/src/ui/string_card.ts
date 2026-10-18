// The STRING card of the Database Importers panel, with NORMA's options:
// organism, network type, interactors, confidence, evidence channels (the
// confidence is recomputed from the ticked ones), one edge per channel or per
// pair, groupings from functional terms (enriched or all annotations, one
// annotation set per term collection), protein descriptions, and the STRING
// server: through this server, directly from the browser, or automatically.

import {
  api,
  type StringGrouping,
  type StringGroupingOptions,
  type StringImportRequest,
  type StringImportResponse,
  type StringRaw,
} from '../api/client'
import { bus } from '../bus'
import type { ProgressBar } from './progress'
import { ctx } from '../three'
import { Color } from 'three'
import { applyGroups } from '../actions/groups'
import { setChannelColor } from '../actions/edge'
import {
  activeSlot,
  applyAnnotationSet,
  registerAnnotationSet,
} from '../actions/workspace'

type Row = Record<string, unknown>

export interface StringCardHooks {
  load: (
    what: string,
    request: () => Promise<StringImportResponse>,
    after: (data: StringImportResponse) => string
  ) => Promise<void>
  status: (msg: string, isError?: boolean) => void
  progress: ProgressBar // the card's bar
}

// NORMA STRING_SPECIES
const SPECIES: [number, string][] = [
  [9606, 'Homo sapiens (human)'],
  [10090, 'Mus musculus (mouse)'],
  [10116, 'Rattus norvegicus (rat)'],
  [7955, 'Danio rerio (zebrafish)'],
  [7227, 'Drosophila melanogaster (fruit fly)'],
  [6239, 'Caenorhabditis elegans (nematode)'],
  [4932, 'Saccharomyces cerevisiae (baker’s yeast)'],
  [4896, 'Schizosaccharomyces pombe (fission yeast)'],
  [3702, 'Arabidopsis thaliana (thale cress)'],
  [39947, 'Oryza sativa japonica (rice)'],
  [511145, 'Escherichia coli K-12 MG1655'],
  [224308, 'Bacillus subtilis 168'],
  [83332, 'Mycobacterium tuberculosis H37Rv'],
  [9031, 'Gallus gallus (chicken)'],
  [9913, 'Bos taurus (cattle)'],
  [9823, 'Sus scrofa (pig)'],
  [9615, 'Canis lupus familiaris (dog)'],
  [8364, 'Xenopus tropicalis (western clawed frog)'],
  [36329, 'Plasmodium falciparum 3D7 (malaria parasite)'],
]

// score field, channel name (services/databases.py STRING_CHANNELS), STRING's colour
const CHANNELS: [string, string, string][] = [
  ['nscore', 'Gene neighborhood', '#59c46b'],
  ['fscore', 'Gene fusion', '#d9534f'],
  ['pscore', 'Co-occurrence', '#3a6cd6'],
  ['ascore', 'Co-expression', '#111827'],
  ['escore', 'Experiments', '#b464c9'],
  ['dscore', 'Curated databases', '#8fc7e8'],
  ['tscore', 'Text mining', '#c9c14a'],
]

// STRING collection key, name, ticked by default (NORMA STRING_CATEGORIES)
const CATEGORIES: [string, string, boolean][] = [
  ['Process', 'GO Biological Process', true],
  ['Function', 'GO Molecular Function', true],
  ['Component', 'GO Cellular Component', true],
  ['KEGG', 'KEGG pathways', true],
  ['RCTM', 'Reactome pathways', true],
  ['WikiPathways', 'WikiPathways', false],
  ['Keyword', 'UniProt keywords', true],
  ['Pfam', 'Pfam domains', false],
  ['InterPro', 'InterPro domains and features', true],
  ['SMART', 'SMART domains', false],
  ['DISEASES', 'Diseases (DISEASES)', true],
  ['TISSUES', 'Tissues (TISSUES)', false],
  ['COMPARTMENTS', 'Subcellular localization (COMPARTMENTS)', false],
  ['HPO', 'Human phenotypes (Monarch)', false],
  ['MPO', 'Mammalian phenotypes (Monarch)', false],
  ['DPO', 'Drosophila phenotypes (Monarch)', false],
  ['WPO', 'C. elegans phenotypes (Monarch)', false],
  ['ZPO', 'Zebrafish phenotypes (Monarch)', false],
  ['FYPO', 'Fission yeast phenotypes (Monarch)', false],
  ['NetworkNeighborAL', 'Local network clusters (STRING)', false],
  ['PMID', 'Reference publications (PubMed)', false],
]
// the grouping shown first, when present (NORMA STRING_PREFERRED_GROUPING)
const PREFERRED = [
  'KEGG',
  'RCTM',
  'Process',
  'WikiPathways',
  'Function',
  'Component',
  'Keyword',
  'InterPro',
  'DISEASES',
]

const DEFAULT_ADDRESS = 'https://string-db.org'
const ADDRESS = /^https:\/\/(version-\d+-\d+\.)?string-db\.org\/?$/
const PRIOR = 0.041 // STRING's prior, as in services/databases.py
const MAX_VIEW_NAMES = 2000 // config.MAX_GROUPING_IDENTIFIERS

export function stringCardHtml(): string {
  const options = SPECIES.map(
    ([t, n]) => `<option value="${t}">${n}</option>`
  ).join('')
  const channels = CHANNELS.map(
    ([f, n, c]) => `
          <div class="form-check">
            <input class="form-check-input db_channel" type="checkbox" id="db_ch_${f}" value="${f}" checked />
            <label class="form-check-label" for="db_ch_${f}"><span class="string-swatch" style="background:${c}"></span>${n}</label>
          </div>`
  ).join('')
  const categories = CATEGORIES.map(
    ([k, n, on]) => `
            <div class="form-check">
              <input class="form-check-input string_cat" type="checkbox" id="string_cat_${k}" value="${k}"${on ? ' checked' : ''} />
              <label class="form-check-label" for="string_cat_${k}">${n}</label>
            </div>`
  ).join('')
  return `
      <div class="string-brand mb-2">
        <span class="string-brand__logo">STRING</span>
        <span class="string-brand__text">protein association networks · string-db.org</span>
      </div>
      <label class="form-label small" for="db_identifiers">Proteins or genes</label>
      <textarea id="db_identifiers" class="form-control form-control-sm db-identifiers" rows="3" placeholder="e.g. TP53" spellcheck="false" aria-describedby="string_query_hint"></textarea>
      <div class="form-text mt-1 mb-2" id="string_query_hint">One or more names, separated by spaces, commas or new lines. Ctrl+Enter fetches.</div>

      <label class="form-label small" for="string_organism">Organism</label>
      <select id="string_organism" class="form-select form-select-sm">${options}<option value="other">Other (NCBI taxon ID)…</option></select>
      <input id="string_taxon" class="form-control form-control-sm mt-1 d-none" inputmode="numeric" placeholder="NCBI taxon ID, e.g. 7955" aria-label="NCBI taxon ID" />

      <label class="form-label small mt-2" for="string_network">Network</label>
      <select id="string_network" class="form-select form-select-sm">
        <option value="functional">Functional associations (all evidence)</option>
        <option value="physical">Physical interactions only</option>
      </select>

      <label class="form-label small mt-2 d-flex justify-content-between" for="string_add_nodes"><span>Interactors to add</span><span id="string_add_nodes_value">20</span></label>
      <input type="range" class="form-range" id="string_add_nodes" min="0" max="500" step="5" value="20" />

      <label class="form-label small" for="string_score_preset">Minimum confidence</label>
      <select id="string_score_preset" class="form-select form-select-sm">
        <option value="0.9">Highest (0.900)</option>
        <option value="0.7">High (0.700)</option>
        <option value="0.4" selected>Medium (0.400)</option>
        <option value="0.15">Low (0.150)</option>
        <option value="custom">Custom…</option>
      </select>
      <div id="string_score_row" class="d-none">
        <label class="form-label small mt-1 d-flex justify-content-between" for="string_score"><span>Confidence</span><span id="string_score_value">0.40</span></label>
        <input type="range" class="form-range" id="string_score" min="0.05" max="0.99" step="0.01" value="0.4" />
      </div>

      <details class="string-more">
        <summary>Evidence channels</summary>
        <div id="db_string_opts" class="string-checks">${channels}
        </div>
        <div class="form-text mt-1">Confidence is recomputed from the ticked channels only, as STRING does.</div>
        <label class="form-label small mt-2" for="string_edge_mode">Edges</label>
        <select id="string_edge_mode" class="form-select form-select-sm">
          <option value="channels">One edge per channel (multi-edge)</option>
          <option value="combined">One edge per pair (combined score)</option>
        </select>
      </details>

      <details class="string-more">
        <summary>Groupings from functional terms</summary>
        <label class="form-label small mt-1" for="string_annot_mode">Terms</label>
        <select id="string_annot_mode" class="form-select form-select-sm">
          <option value="enrichment">Enriched in the network (recommended)</option>
          <option value="annotation">All annotations of its proteins</option>
        </select>
        <div id="string_fdr_row">
          <label class="form-label small mt-2" for="string_fdr">Keep terms with FDR at most</label>
          <input type="number" id="string_fdr" class="form-control form-control-sm" value="0.05" min="0.0001" max="1" step="0.01" />
        </div>
        <div class="form-text d-none" id="string_kegg_note">STRING doesn't share full KEGG annotations; KEGG pathways come only with enriched terms.</div>
        <div class="string-subtitle mt-2">Term collections <span>depend on the organism and STRING version</span></div>
        <div class="d-flex gap-2 mb-1">
          <button type="button" id="string_cat_all" class="btn btn-outline-secondary btn-sm flex-fill">All</button>
          <button type="button" id="string_cat_none" class="btn btn-outline-secondary btn-sm flex-fill">None</button>
        </div>
        <div id="string_categories" class="string-checks string-checks--scroll">${categories}
            <div class="form-check">
              <input class="form-check-input" type="checkbox" id="string_cat_other" />
              <label class="form-check-label" for="string_cat_other">Any other collection STRING offers</label>
            </div>
        </div>
        <div class="lp-grid mt-2">
          <div><label class="form-label small" for="string_max_terms">Groups per collection</label><input type="number" id="string_max_terms" class="form-control form-control-sm" value="30" min="1" max="500" /></div>
          <div><label class="form-label small" for="string_min_group">Smallest group</label><input type="number" id="string_min_group" class="form-control form-control-sm" value="2" min="1" max="100" /></div>
        </div>
      </details>

      <details class="string-more">
        <summary>STRING server</summary>
        <label class="form-label small mt-1" for="string_connect">Connect</label>
        <select id="string_connect" class="form-select form-select-sm">
          <option value="auto" selected>Automatically (through this server when available)</option>
          <option value="proxy">Through this server</option>
          <option value="direct">Directly from the browser</option>
        </select>
        <div class="form-text" id="string_connect_state">Decided at the first request.</div>
        <label class="form-label small mt-2" for="string_address">Address</label>
        <input id="string_address" class="form-control form-control-sm" type="url" value="${DEFAULT_ADDRESS}" spellcheck="false" autocomplete="off" />
        <div class="form-text">Use a version address such as https://version-12-0.string-db.org to get the same answers every time.</div>
        <div class="form-check mt-2">
          <input class="form-check-input" type="checkbox" id="string_descriptions" checked />
          <label class="form-check-label" for="string_descriptions">Fetch protein descriptions</label>
        </div>
      </details>

      <div class="d-grid gap-2 mt-3">
        <button id="db_import_string" class="btn btn-primary btn-sm">Fetch network</button>
        <button id="string_groupings_button" type="button" class="btn btn-outline-primary btn-sm" disabled>Fetch groupings for the current view</button>
      </div>`
}

// ---------------------------------------------------------------- settings
const el = <T extends HTMLElement = HTMLInputElement>(id: string) =>
  document.getElementById(id) as T
const value = (id: string) => el<HTMLInputElement | HTMLSelectElement>(id).value
const ticked = (selector: string) =>
  [...document.querySelectorAll<HTMLInputElement>(selector)]
    .filter((b) => b.checked)
    .map((b) => b.value)
const clamp = (v: number, lo: number, hi: number, fallback: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback

function taxon(): number | null {
  const sel = value('string_organism')
  const t = Number(sel === 'other' ? value('string_taxon').trim() : sel)
  return Number.isInteger(t) && t > 0 ? t : null
}

function threshold(): number {
  const preset = value('string_score_preset')
  const v = Number(preset === 'custom' ? value('string_score') : preset)
  return clamp(v, 0, 1, 0.4)
}

function address(): string {
  return value('string_address').trim().replace(/\/+$/, '') || DEFAULT_ADDRESS
}

function groupingOptions(): StringGroupingOptions | null {
  const categories = ticked('.string_cat')
  const other = el('string_cat_other').checked
  if (categories.length === 0 && !other) return null // None = no groupings
  return {
    mode: value('string_annot_mode') as 'enrichment' | 'annotation',
    fdr: clamp(Number(value('string_fdr')), 0.0001, 1, 0.05),
    categories,
    other_categories: other,
    max_terms: Math.round(clamp(Number(value('string_max_terms')), 1, 500, 30)),
    min_group: Math.round(clamp(Number(value('string_min_group')), 1, 100, 2)),
  }
}

function updateUI(): void {
  el('string_taxon').classList.toggle(
    'd-none',
    value('string_organism') !== 'other'
  )
  el('string_add_nodes_value').textContent = value('string_add_nodes')
  const custom = value('string_score_preset') === 'custom'
  el('string_score_row').classList.toggle('d-none', !custom)
  el('string_score_value').textContent = Number(value('string_score')).toFixed(
    2
  )
  const enrichment = value('string_annot_mode') === 'enrichment'
  el('string_fdr_row').classList.toggle('d-none', !enrichment)
  el('string_kegg_note').classList.toggle(
    'd-none',
    enrichment || !el('string_cat_KEGG').checked
  )
  el<HTMLButtonElement>('string_groupings_button').disabled =
    ctx.nodeObjects.length === 0
}

// ---------------------------------------------------------------- connection
type Route = 'proxy' | 'direct'
let decided: Route | null = null // Connect: Automatically, after the first request
let lastCall = 0

function setDecided(route: Route): void {
  decided = route
  el('string_connect_state').textContent =
    route === 'proxy'
      ? 'Going through this server.'
      : 'This server cannot reach STRING: asking STRING directly from the browser.'
}

// The server's "Could not reach <host>" — an outage between it and STRING
const unreachable = (err: unknown) =>
  /^Could not reach /.test(err instanceof Error ? err.message : String(err))

async function stringCall(method: string, params: Record<string, string>) {
  // one second between calls, as STRING asks
  const wait = lastCall + 1050 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
  let res: Response
  try {
    // a form POST with a plain-text body is a "simple" request: no CORS preflight
    res = await fetch(`${address()}/api/json/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({
        ...params,
        caller_identity: 'arena3d',
      }).toString(),
    })
  } catch (err) {
    throw new Error(
      `STRING could not be reached from the browser (${err instanceof Error ? err.message : String(err)}). Check the internet connection, or choose Connect: Through this server.`
    )
  }
  const text = await res.text()
  if (res.status === 404)
    throw new Error('STRING found none of the given names for this organism.')
  if (!res.ok) throw new Error(`STRING answered with an error (${res.status}).`)
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(
      'STRING sent an answer that is not JSON. The STRING address may be wrong.'
    )
  }
  const rows = (Array.isArray(data) ? data : [data]) as Row[]
  const error = rows.length === 1 ? rows[0] : null
  if (error && ('Error' in error || 'ErrorMessage' in error))
    throw new Error(`STRING: ${String(error.ErrorMessage ?? error.Error)}`)
  return rows
}

const score = (v: unknown) => {
  const x = Number(v)
  return Number.isFinite(x) && x > 0 ? (x > 1 ? x / 1000 : x) : 0
}

// The proteins the server keeps (services/databases.py build_string), so
// descriptions and groupings are asked for the same set as through the server.
function keptIds(network: Row[], req: StringImportRequest): string[] {
  const fields = req.channels ?? CHANNELS.map(([f]) => f)
  const all = fields.length === CHANNELS.length
  const min = (req.required_score ?? 0.4) - 1e-9
  const kept = new Set<string>()
  for (const r of network) {
    const scores = fields.map((f) => score(r[f]))
    let combined = score(r.score)
    if (!all) {
      let miss = 1
      for (const s of scores)
        if (s > 0) miss *= 1 - Math.max(0, (s - PRIOR) / (1 - PRIOR))
      combined = 1 - miss + PRIOR * miss
    }
    if (combined < min) continue
    if (req.edge_mode !== 'combined' && !scores.some((s) => s > 0)) continue
    kept.add(String(r.stringId_A))
    kept.add(String(r.stringId_B))
  }
  return [...kept]
}

// Connect: Directly — the browser asks STRING, the server only builds.
async function fetchRaw(
  req: StringImportRequest,
  notes: string[],
  step: (label: string) => void
): Promise<StringRaw> {
  const species = String(req.species)
  const total = 3 + (req.descriptions ? 1 : 0) + (req.groupings ? 1 : 0)
  let k = 0
  const next = (label: string) => step(`STRING: ${label} (${++k}/${total})`)
  next('checking the version')
  const version = await stringCall('version', {}).catch(() => null)
  next(`looking up ${req.identifiers.length} names`)
  const ids = await stringCall('get_string_ids', {
    identifiers: req.identifiers.join('\r'),
    species,
    echo_query: '1',
    limit: '1',
  })
  const query = [
    ...new Set(
      ids
        .map((r) => (typeof r.stringId === 'string' ? r.stringId : ''))
        .filter(Boolean)
    ),
  ]
  if (query.length === 0) return { version, ids, network: [] } // the server says so
  const params: Record<string, string> = {
    identifiers: query.join('\r'),
    species,
    required_score: String(Math.round((req.required_score ?? 0.4) * 1000)),
    network_type: req.network_type ?? 'functional',
  }
  if (req.add_nodes) params.add_nodes = String(req.add_nodes)
  next('fetching the network')
  const network = await stringCall('network', params)
  const kept = keptIds(network, req).join('\r')
  let info: Row[] | null = null
  let terms: Row[] | null = null
  if (req.descriptions && kept) next('fetching protein descriptions')
  if (req.descriptions && kept)
    info = await stringCall('get_string_ids', {
      identifiers: kept,
      species,
    }).catch((err: Error) => {
      notes.push(`Protein descriptions couldn't be fetched: ${err.message}`)
      return null
    })
  if (req.groupings && kept)
    next(
      req.groupings.mode === 'enrichment'
        ? 'running functional enrichment'
        : 'fetching functional annotations'
    )
  if (req.groupings && kept)
    terms = await stringCall(
      req.groupings.mode === 'enrichment'
        ? 'enrichment'
        : 'functional_annotation',
      { identifiers: kept, species }
    ).catch((err: Error) => {
      notes.push(`Groupings couldn't be fetched: ${err.message}`)
      return null
    })
  return { version, ids, network, info, terms }
}

// Through this server, directly, or automatically: the server first, and the
// browser from then on if the server cannot reach STRING.
async function viaRoute<T>(
  server: () => Promise<T>,
  direct: () => Promise<T>
): Promise<T> {
  const connect = value('string_connect')
  const route: Route =
    connect === 'auto' ? (decided ?? 'proxy') : (connect as Route)
  if (route === 'direct') return direct()
  try {
    const result = await server()
    if (connect === 'auto') setDecided('proxy')
    return result
  } catch (err) {
    if (connect !== 'auto' || !unreachable(err)) throw err
    setDecided('direct')
    return direct()
  }
}

// ---------------------------------------------------------------- results
function isDarkBackground(): boolean {
  if (!ctx.renderer) return true
  const c = ctx.renderer.getClearColor(new Color())
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.4
}

// STRING's channel colours (co-expression's black turns light on dark scenes)
function colorChannels(channels: string[]): void {
  const dark = isDarkBackground()
  for (const [, name, color] of CHANNELS) {
    if (!channels.includes(name)) continue
    const c = name === 'Co-expression' && dark ? '#d1d5db' : color
    setChannelColor(name, c)
    const input = document.getElementById(`color${name}`) as HTMLInputElement
    if (input) input.value = c
  }
}

// One annotation set per term collection; the preferred one is shown.
// Each set is named after what was asked ("STRING TP53, MDM2: KEGG pathways"),
// so a later import, or an expansion of the view, never overwrites it.
function applyGroupings(
  groupings: StringGrouping[],
  source: string,
  suffix: string
): string[] {
  const names: string[] = []
  for (const g of groupings) {
    const byNode = new Map<string, string[]>()
    for (const t of g.terms)
      for (const m of t.members)
        byNode.set(m, [...(byNode.get(m) ?? []), t.description])
    applyGroups([...byNode].map(([node, groups]) => ({ node, groups })))
    names.push(`${source}: ${g.name}${suffix}`)
    registerAnnotationSet(names[names.length - 1], (n) => byNode.has(n))
  }
  const first =
    PREFERRED.map((k) => groupings.findIndex((g) => g.category === k)).find(
      (i) => i >= 0
    ) ?? 0
  const slot = activeSlot()
  const index = slot?.annotationSets.findIndex((a) => a.name === names[first])
  if (index !== undefined && index >= 0) applyAnnotationSet(index)
  return groupings.map((g) => g.name)
}

const suffixOf = (opts: StringGroupingOptions) =>
  opts.mode === 'enrichment' ? ` (FDR ≤ ${opts.fdr})` : ''

function groupingText(names: string[]): string {
  return names.length
    ? ` Added ${names.length} grouping${names.length === 1 ? '' : 's'}: ${names.join(', ')} — switch between them in the Annotations card.`
    : ''
}

function afterLoad(
  data: StringImportResponse,
  opts: StringGroupingOptions | null,
  notes: string[]
): string {
  colorChannels(data.channels)
  const info = new Map((data.node_info ?? []).map((n) => [n.name, n]))
  for (const node of ctx.nodeObjects) {
    const i = info.get(node.name)
    if (!i) continue
    node.url = i.url
    if (i.description) node.descr = i.description
  }
  const query = (data.node_info ?? []).filter((n) => n.query).map((n) => n.name)
  const asked = `STRING ${query.slice(0, 3).join(', ')}${query.length > 3 ? ` +${query.length - 3}` : ''}`
  const groups = opts
    ? applyGroupings(data.groupings ?? [], asked, suffixOf(opts))
    : []
  const source = [
    data.string_version ? `STRING ${data.string_version}` : 'STRING',
    data.taxon_name,
  ]
    .filter(Boolean)
    .join(', ')
  return ` From ${source}.${groupingText(groups)}${notes.length ? ' ' + notes.join(' ') : ''}`
}

// ---------------------------------------------------------------- actions
function fetchNetwork(hooks: StringCardHooks): void {
  const identifiers = value('db_identifiers')
    .split(/[\s,;]+/)
    .filter(Boolean)
  if (identifiers.length === 0)
    return hooks.status('Type one or more protein names, e.g. TP53.', true)
  const species = taxon()
  if (species === null)
    return hooks.status('Type the organism’s NCBI taxon ID, e.g. 7955.', true)
  const channels = ticked('.db_channel')
  if (channels.length === 0)
    return hooks.status('Tick at least one evidence channel.', true)
  const site = address()
  if (!ADDRESS.test(site))
    return hooks.status(
      'The STRING address must be https://string-db.org or a version address such as https://version-12-0.string-db.org.',
      true
    )
  const groupings = groupingOptions()
  const req: StringImportRequest = {
    identifiers,
    species,
    network_type: value('string_network') as 'functional' | 'physical',
    required_score: threshold(),
    channels,
    edge_mode: value('string_edge_mode') as 'channels' | 'combined',
    add_nodes: Math.round(clamp(Number(value('string_add_nodes')), 0, 500, 0)),
    descriptions: el('string_descriptions').checked,
    groupings,
    // the default goes unnamed, so the server's configured STRING applies
    address: site === DEFAULT_ADDRESS ? null : site,
  }
  const notes: string[] = []
  void hooks.load(
    'STRING',
    () =>
      viaRoute(
        () => api.importString(req),
        async () =>
          api.importString({
            ...req,
            raw: await fetchRaw(req, notes, (label) =>
              hooks.progress.computing(label)
            ),
          })
      ),
    (data) => afterLoad(data, groupings, notes)
  )
}

async function fetchViewGroupings(hooks: StringCardHooks): Promise<void> {
  const names = [...new Set(ctx.nodeObjects.map((n) => n.name))]
  if (names.length === 0) return hooks.status('Load a network first.', true)
  if (names.length > MAX_VIEW_NAMES)
    return hooks.status(
      `Groupings can be fetched for up to ${MAX_VIEW_NAMES} proteins; this network has ${names.length}.`,
      true
    )
  const species = taxon()
  if (species === null)
    return hooks.status('Type the organism’s NCBI taxon ID, e.g. 7955.', true)
  const opts = groupingOptions()
  if (!opts) return hooks.status('Tick at least one term collection.', true)
  const site = address()
  if (!ADDRESS.test(site))
    return hooks.status('The STRING address must be on string-db.org.', true)
  const button = el<HTMLButtonElement>('string_groupings_button')
  button.disabled = true
  hooks.status(
    `${opts.mode === 'enrichment' ? 'Running functional enrichment' : 'Fetching functional annotations'} for ${names.length} proteins…`
  )
  const req = {
    identifiers: names,
    species,
    groupings: opts,
    address: site === DEFAULT_ADDRESS ? null : site,
  }
  try {
    const res = await viaRoute(
      () => api.stringGroupings(req),
      async () =>
        api.stringGroupings({
          ...req,
          raw_terms: await stringCall(
            opts.mode === 'enrichment' ? 'enrichment' : 'functional_annotation',
            { identifiers: names.join('\r'), species: String(species) }
          ),
        })
    )
    const added = applyGroupings(
      res.groupings,
      'STRING (current view)',
      suffixOf(opts)
    )
    hooks.status(
      added.length
        ? groupingText(added).trim()
        : res.warnings.join(' ') || 'No groupings found.',
      added.length === 0
    )
  } catch (err) {
    hooks.status(err instanceof Error ? err.message : String(err), true)
  } finally {
    updateUI()
  }
}

export function initStringCard(hooks: StringCardHooks): void {
  const card = document.getElementById('card_string')
  if (!card) return
  card.addEventListener('input', updateUI)
  card.addEventListener('change', updateUI)
  el('string_cat_all').addEventListener('click', () => {
    card
      .querySelectorAll<HTMLInputElement>('.string_cat')
      .forEach((b) => (b.checked = true))
    updateUI()
  })
  el('string_cat_none').addEventListener('click', () => {
    card
      .querySelectorAll<HTMLInputElement>('.string_cat, #string_cat_other')
      .forEach((b) => (b.checked = false))
    updateUI()
  })
  el('string_connect').addEventListener('change', () => {
    decided = null
    el('string_connect_state').textContent =
      value('string_connect') === 'auto' ? 'Decided at the first request.' : ''
  })
  el('string_address').addEventListener('change', () => {
    decided = null // a new address may answer differently
  })
  el('db_identifiers').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      fetchNetwork(hooks)
    }
  })
  el('db_import_string').addEventListener('click', () => fetchNetwork(hooks))
  el('string_groupings_button').addEventListener(
    'click',
    () => void fetchViewGroupings(hooks)
  )
  bus.on('network:loaded', updateUI)
  bus.on('workspace:changed', updateUI)
  updateUI()
}
