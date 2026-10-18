// Database Importers panel — one expandable, colour-coded card per source, as in
// NORMA: STRING, Reactome, OmniPath, NDEx, IntAct, Gene Ontology and a
// Compare card (STRING · IntAct · OmniPath as layers). Protein lists, organism
// and score are typed once: the cards that take them stay in sync.

import { Tooltip } from 'bootstrap'
import { api, type NetworkData } from '../api/client'
import { escapeHtml } from '../utils'
import { askImportAs, placeNetwork } from './import_as'
import { startLoader, finishLoader } from '../actions/screen'
import { showTab } from './tabs'
import { PROGRESS_HTML, ProgressBar } from './progress'
import { initStringCard, stringCardHtml } from './string_card'

const SPECIES: [number, string][] = [
  [9606, 'Human'],
  [10090, 'Mouse'],
  [10116, 'Rat'],
  [7227, 'Fruit fly'],
  [6239, 'C. elegans'],
  [7955, 'Zebrafish'],
  [559292, 'Yeast (S. cerevisiae)'],
  [3702, 'Arabidopsis'],
  [511145, 'E. coli K-12'],
]

const DATABASES = ['STRING', 'IntAct', 'OmniPath']

// Popup explanation of the "Only interactions among these proteins" checkboxes
const AMONG_TIP =
  'Ticked: only interactions between two of the proteins you typed. ' +
  'Unticked: their other interaction partners join too, so the network grows around them. ' +
  'With a single protein, its partners are always included.'

// Public NDEx networks to try with one click: UUID, name, what it is
const NDEX_EXAMPLES: [string, string, string][] = [
  [
    '35e031eb-45d1-11ed-b7d0-0ac135e8bacf',
    'p53 pathway',
    'NCI-PID · 52 nodes, 361 edges',
  ],
  [
    '2ae30e96-1e5f-11e8-b939-0ac135e8bacf',
    'Inhibition of Apoptosis',
    'SIGNOR · 32 nodes, 45 edges',
  ],
  [
    '296dd114-d392-11ea-8772-0ac135e8bacf',
    'SARS-CoV-2/Human interactome',
    '125 nodes, 206 edges',
  ],
]

const CLOUD =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 16.6A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 15.3"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>'

// `only`: the taxa a source covers (OmniPath: human, mouse, rat)
const species = (id: string, only?: number[]) =>
  `<select id="${id}" class="form-select form-select-sm db-species" aria-label="Organism">${SPECIES.filter(
    ([t]) => !only || only.includes(t)
  )
    .map(([t, n]) => `<option value="${t}">${n}</option>`)
    .join('')}</select>`
const score = (id: string) =>
  `<input id="${id}" class="form-control form-control-sm db-score" type="number" min="0" max="1" step="0.05" value="0.4" aria-label="Minimum score" />`
const identifiers = (id: string) =>
  `<textarea id="${id}" class="form-control form-control-sm db-identifiers mb-2" rows="2" placeholder="e.g. TP53 MDM2 CDKN1A ATM" spellcheck="false" aria-label="Proteins"></textarea>`
const organismScore = (sid: string, scid: string) => `
      <div class="lp-grid mb-2">
        <div><label class="form-label small" for="${sid}">Organism</label>${species(sid)}</div>
        <div><label class="form-label small" for="${scid}">Min. score (0–1)</label>${score(scid)}</div>
      </div>`

function card(key: string, title: string, blurb: string, body: string): string {
  return `
<details class="db-card db-card--${key}" id="card_${key}">
  <summary class="db-card__head">
    <span class="db-card__icon">${CLOUD}</span>
    <span class="db-card__title">${title}</span>
    <button type="button" class="db-card__help" title="How this importer works" aria-label="Help for ${title}">?</button>
    <span class="db-card__chevron" aria-hidden="true">▸</span>
  </summary>
  <div class="db-card__body">
    <div class="form-text mt-0 mb-2">${blurb}</div>
    ${body}
    ${PROGRESS_HTML(`progress_${key}`, `${title} import progress`)}
  </div>
</details>`
}

// a search box whose hits add their id to the list below it
const setPicker = (key: string, what: string, example: string) => `
      <label class="form-label small" for="${key}_query">Find ${what} by name</label>
      <div class="d-flex gap-2 mb-1">
        <input id="${key}_query" class="form-control form-control-sm" placeholder="e.g. apoptosis" spellcheck="false" />
        <button id="${key}_search" type="button" class="btn btn-outline-primary btn-sm text-nowrap">Search</button>
      </div>
      <div class="d-flex align-items-center gap-2 mb-1 d-none" id="${key}_sortRow">
        <label class="form-label small mb-0 text-nowrap" for="${key}_sort">Sort by</label>
        <select id="${key}_sort" class="form-select form-select-sm">
          <option value="name">Name (A→Z)</option>
          <option value="id">ID</option>
          <option value="relevance">Relevance (as found)</option>
        </select>
      </div>
      <div id="${key}_results" class="db-hits mb-2"></div>
      <label class="form-label small" for="${key}_ids">${what[0].toUpperCase()}${what.slice(1)} to import (one per line, each becomes a layer)</label>
      <textarea id="${key}_ids" class="form-control form-control-sm mb-2" rows="3" placeholder="${example}" spellcheck="false"></textarea>`

const DATABASES_HTML = `
<div class="col-md-8 col-lg-6 layout-panel db-panel">
  ${card(
    'string',
    'STRING',
    'Protein–protein associations, one channel per evidence type, with groupings from functional terms — the options of NORMA’s STRING importer.',
    stringCardHtml()
  )}
  ${card(
    'reactome',
    'REACTOME',
    'Pathways as layers: each pathway holds its proteins, linked by STRING interactions among them; copies of a protein are linked across pathways.',
    `
      ${setPicker('reactome', 'pathways', 'R-HSA-109581\nR-HSA-5357801')}
      ${organismScore('reactome_species', 'reactome_score')}
      <div class="mb-2">
        <label class="form-label small" for="reactome_max">Genes per pathway (at most)</label>
        <input id="reactome_max" class="form-control form-control-sm d-inline-block" style="width:6rem" type="number" min="2" max="500" value="300" />
      </div>
      <button id="db_import_reactome" class="btn btn-primary btn-sm">Import from Reactome</button>`
  )}
  ${card(
    'omnipath',
    'OMNIPATH',
    'Curated signalling interactions (OmniPath), one layer.',
    `
      <label class="form-label small" for="omnipath_identifiers">Proteins (gene names or IDs)</label>
      ${identifiers('omnipath_identifiers')}
      <div class="mb-2"><label class="form-label small" for="omnipath_species">Organism</label>${species('omnipath_species', [9606, 10090, 10116])}</div>
      <div class="form-text mb-2">OmniPath covers human, mouse and rat.</div>
      <div class="form-check mb-2">
        <input class="form-check-input" type="checkbox" id="omnipath_only_among" checked />
        <label class="form-check-label db-tipped" for="omnipath_only_among" data-bs-title="${AMONG_TIP}">Only interactions among these proteins</label>
        <span class="db-tip db-tipped" tabindex="0" role="img" data-bs-title="${AMONG_TIP}" aria-label="${AMONG_TIP}">ⓘ</span>
      </div>
      <button id="db_import_omnipath" class="btn btn-primary btn-sm">Import from OmniPath</button>`
  )}
  ${card(
    'ndex',
    'NDEX',
    'A public network from the NDEx exchange, by its UUID or link.',
    `
      <label class="form-label small" for="ndex_uuid">Network UUID or link from ndexbio.org</label>
      <div class="d-flex gap-2">
        <input id="ndex_uuid" class="form-control form-control-sm" placeholder="e.g. 8ae4896f-5c68-11ec-b3be-0ac135e8bacf" spellcheck="false" />
        <button id="ndex_import_button" class="btn btn-primary btn-sm text-nowrap">Import</button>
      </div>
      <div class="form-label small mt-2 mb-1">Or load an example</div>
      <div class="d-flex flex-column gap-1">
        ${NDEX_EXAMPLES.map(
          ([uuid, name, about]) =>
            `<button type="button" class="btn btn-outline-secondary btn-sm text-start ndex-example" data-uuid="${uuid}" data-name="${name}">${name} <span class="form-text">${about}</span></button>`
        ).join('')}
      </div>`
  )}
  ${card(
    'intact',
    'INTACT',
    'Experimentally verified molecular interactions (IntAct, MI-score), one layer.',
    `
      <label class="form-label small" for="intact_identifiers">Proteins (gene names or IDs)</label>
      ${identifiers('intact_identifiers')}
      ${organismScore('intact_species', 'intact_score')}
      <div class="form-check mb-2">
        <input class="form-check-input" type="checkbox" id="intact_only_among" checked />
        <label class="form-check-label db-tipped" for="intact_only_among" data-bs-title="${AMONG_TIP}">Only interactions among these proteins</label>
        <span class="db-tip db-tipped" tabindex="0" role="img" data-bs-title="${AMONG_TIP}" aria-label="${AMONG_TIP}">ⓘ</span>
      </div>
      <button id="db_import_intact" class="btn btn-primary btn-sm">Import from IntAct</button>`
  )}
  ${card(
    'go',
    'GENE ONTOLOGY',
    'GO terms as layers: each term holds the genes annotated to it (QuickGO), linked by STRING interactions among them.',
    `
      ${setPicker('go', 'terms', 'GO:0006915\nGO:0006281')}
      ${organismScore('go_species', 'go_score')}
      <div class="form-check mb-2">
        <input class="form-check-input" type="checkbox" id="go_children" checked />
        <label class="form-check-label" for="go_children">Include genes of child terms</label>
      </div>
      <div class="mb-2">
        <label class="form-label small" for="go_max">Genes per term (at most)</label>
        <input id="go_max" class="form-control form-control-sm d-inline-block" style="width:6rem" type="number" min="2" max="500" value="300" />
      </div>
      <button id="db_import_go" class="btn btn-primary btn-sm">Import from Gene Ontology</button>`
  )}
  ${card(
    'compare',
    'COMPARE DATABASES',
    'STRING, IntAct and OmniPath each as a layer, copies of the same protein linked across them.',
    `
      <label class="form-label small" for="cmp_identifiers">Proteins (gene names or IDs)</label>
      ${identifiers('cmp_identifiers')}
      ${organismScore('cmp_species', 'cmp_score')}
      <div id="db_layer_opts" class="mb-2">
        ${DATABASES.map(
          (d) => `
        <div class="form-check form-check-inline">
          <input class="form-check-input db_database" type="checkbox" id="db_db_${d}" value="${d}" checked />
          <label class="form-check-label" for="db_db_${d}">${d}</label>
        </div>`
        ).join('')}
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="db_only_among" checked />
          <label class="form-check-label db-tipped" for="db_only_among" data-bs-title="${AMONG_TIP}">Only interactions among these proteins</label>
        <span class="db-tip db-tipped" tabindex="0" role="img" data-bs-title="${AMONG_TIP}" aria-label="${AMONG_TIP}">ⓘ</span>
        </div>
      </div>
      <button id="db_import_layers" class="btn btn-primary btn-sm">Import, One Layer per Database</button>`
  )}
  <div id="db_status" class="small mt-2"></div>
</div>
`

// each card has its own bar, under its button (where the user looks)
const bars = new Map<string, ProgressBar>()
const barFor = (card: string): ProgressBar => {
  let bar = bars.get(card)
  if (!bar) bars.set(card, (bar = new ProgressBar(`progress_${card}`)))
  return bar
}

function status(msg: string, isError = false): void {
  const el = document.getElementById('db_status')
  if (!el) return
  el.textContent = msg
  el.className = `small mt-2 ${isError ? 'text-danger' : 'text-success'}`
}

const val = (id: string) =>
  (document.getElementById(id) as HTMLInputElement | HTMLSelectElement).value
const checked = (selector: string): string[] =>
  [...document.querySelectorAll<HTMLInputElement>(selector)]
    .filter((b) => b.checked)
    .map((b) => b.value)
const splitList = (text: string) => text.split(/[\s,;]+/).filter(Boolean)
const lines = (text: string) =>
  text
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
const scoreOf = (id: string) => {
  const v = Number(val(id))
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.4
}

// FastAPI errors arrive as "POST /api/... failed: 400 {"detail": "..."}"
function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const json = msg.slice(msg.indexOf('{'))
  try {
    const detail = (JSON.parse(json) as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
  } catch {
    /* not JSON — fall through */
  }
  return msg
}

// Asks "Import as" first, then fetches: a cancelled popup fetches nothing.
// The card's progress bar follows each step: fetching, building, laying out.
async function load<T extends NetworkData>(
  card: string,
  what: string,
  request: () => Promise<T>,
  after?: (data: T) => string
): Promise<void> {
  const choice = await askImportAs(what, { importer: true })
  if (!choice) return
  const progress = barFor(card)
  status(`Fetching from ${what}…`)
  progress.computing(`Fetching from ${what}`)
  startLoader()
  try {
    const data = await request()
    const placed = await placeNetwork(data, choice, `${what} import`, (stage) =>
      progress.computing(stage)
    )
    // after placing: annotation sets belong to the network's slot
    const extra = after?.(data) ?? ''
    const warn = data.warnings.length ? ` ${data.warnings.join(' ')}` : ''
    const added = choice.mode === 'layer' || choice.mode === 'expand'
    progress.done(`${what} ${added ? 'added' : 'loaded'}`)
    status(`${placed}${extra}${warn}`)
    showTab('#panel-main-view')
  } catch (err) {
    progress.hide()
    status(errorText(err), true)
  } finally {
    finishLoader()
  }
}

function proteins(id: string): string[] | null {
  const ids = splitList(val(id))
  if (ids.length === 0) {
    status('Type one or more protein names, e.g. TP53.', true)
    return null
  }
  return ids
}

// The cards that take a protein list, organism or score stay in sync
function syncGroup(selector: string): void {
  const inputs = [...document.querySelectorAll<HTMLInputElement>(selector)]
  for (const input of inputs)
    input.addEventListener('input', () => {
      for (const other of inputs)
        if (
          other !== input &&
          // an organism a card does not offer leaves that card as it is
          (!(other instanceof HTMLSelectElement) ||
            [...other.options].some((o) => o.value === input.value))
        )
          other.value = input.value
    })
}

type Hit = { id: string; name: string; detail: string }

// Search hits, by name (default), id or as the search returned them
function sortHits(hits: Hit[], by: string): Hit[] {
  if (by === 'relevance') return hits
  const key = (h: Hit) => (by === 'id' ? h.id : h.name)
  return [...hits].sort((a, b) =>
    key(a).localeCompare(key(b), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  )
}

function initPicker(key: 'reactome' | 'go'): void {
  const results = document.getElementById(`${key}_results`)!
  const ids = document.getElementById(`${key}_ids`) as HTMLTextAreaElement
  const sort = document.getElementById(`${key}_sort`) as HTMLSelectElement
  let hits: Hit[] = []
  const render = () => {
    document
      .getElementById(`${key}_sortRow`)
      ?.classList.toggle('d-none', hits.length < 2)
    const added = new Set(lines(ids.value))
    results.innerHTML = hits.length
      ? sortHits(hits, sort.value)
          .map(
            (h) =>
              `<button type="button" class="db-hit${added.has(h.id) ? ' db-hit--added' : ''}" data-id="${escapeHtml(h.id)}" title="Add ${escapeHtml(h.id)}"><span class="db-hit__id">${escapeHtml(h.id)}</span> ${escapeHtml(h.name)}${h.detail ? ` <span class="db-hit__detail">${escapeHtml(h.detail)}</span>` : ''}</button>`
          )
          .join('')
      : '<span class="form-text">Nothing found.</span>'
    results.querySelectorAll<HTMLElement>('.db-hit').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.dataset.id!
        if (!lines(ids.value).includes(id))
          ids.value = (ids.value.trim() ? ids.value.trim() + '\n' : '') + id
        b.classList.add('db-hit--added')
      })
    )
  }
  sort.addEventListener('change', render)
  const search = async () => {
    const q = val(`${key}_query`).trim()
    if (q.length < 2)
      return status('Type at least two characters to search.', true)
    results.innerHTML = '<span class="form-text">Searching…</span>'
    try {
      hits = await api.searchSets(key, q, Number(val(`${key}_species`)))
      render()
    } catch (err) {
      hits = []
      results.innerHTML = ''
      status(errorText(err), true)
    }
  }
  document
    .getElementById(`${key}_search`)
    ?.addEventListener('click', () => void search())
  document.getElementById(`${key}_query`)?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void search()
    }
  })
}

export function initDatabasesPanel(): void {
  const pane = document.getElementById('panel-databases')
  if (!pane) return
  pane.innerHTML = DATABASES_HTML
  // explanations pop up at once on hover or focus, above the drawer
  pane.querySelectorAll<HTMLElement>('.db-tipped').forEach(
    (el) =>
      new Tooltip(el, {
        container: 'body',
        placement: 'top',
        trigger: 'hover focus',
        customClass: 'arena-tooltip',
      })
  )
  syncGroup('.db-identifiers')
  syncGroup('.db-species')
  syncGroup('.db-score')
  // the "?" opens the Databases help page without toggling the card
  pane.querySelectorAll<HTMLElement>('.db-card__help').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      showTab('#panel-help')
      document
        .querySelector<HTMLElement>('#helpDiv [data-help-tab="Databases_tab"]')
        ?.click()
    })
  )
  initPicker('reactome')
  initPicker('go')

  initStringCard({
    load: (what, request, after) => load('string', what, request, after),
    status,
    progress: barFor('string'),
  })
  for (const [button, db, idsId, speciesId, scoreId, onlyId] of [
    [
      'db_import_intact',
      'IntAct',
      'intact_identifiers',
      'intact_species',
      'intact_score',
      'intact_only_among',
    ],
    [
      'db_import_omnipath',
      'OmniPath',
      'omnipath_identifiers',
      'omnipath_species',
      'cmp_score',
      'omnipath_only_among',
    ],
  ] as const)
    document.getElementById(button)?.addEventListener('click', () => {
      const ids = proteins(idsId)
      if (!ids) return
      void load(db.toLowerCase(), db, () =>
        api.importDatabases({
          identifiers: ids,
          species: Number(val(speciesId)),
          databases: [db],
          required_score: scoreOf(scoreId),
          only_among: (document.getElementById(onlyId) as HTMLInputElement)
            .checked,
        })
      )
    })
  document.getElementById('db_import_layers')?.addEventListener('click', () => {
    const ids = proteins('cmp_identifiers')
    if (!ids) return
    const databases = checked('.db_database')
    if (databases.length === 0)
      return status('Tick at least one database.', true)
    void load('compare', databases.join(', '), () =>
      api.importDatabases({
        identifiers: ids,
        species: Number(val('cmp_species')),
        databases,
        required_score: scoreOf('cmp_score'),
        only_among: (
          document.getElementById('db_only_among') as HTMLInputElement
        ).checked,
      })
    )
  })
  document
    .getElementById('db_import_reactome')
    ?.addEventListener('click', () => {
      const pathways = lines(val('reactome_ids'))
      if (pathways.length === 0)
        return status(
          'Add one or more Reactome pathway identifiers (search above).',
          true
        )
      void load('reactome', 'Reactome', () =>
        api.importReactome({
          pathways,
          species: Number(val('reactome_species')),
          required_score: scoreOf('reactome_score'),
          max_genes: Math.min(
            500,
            Math.max(2, Number(val('reactome_max')) || 300)
          ),
        })
      )
    })
  document.getElementById('db_import_go')?.addEventListener('click', () => {
    const terms = lines(val('go_ids'))
    if (terms.length === 0)
      return status('Add one or more GO term identifiers (search above).', true)
    void load('go', 'Gene Ontology', () =>
      api.importGo({
        terms,
        taxon: Number(val('go_species')),
        include_children: (
          document.getElementById('go_children') as HTMLInputElement
        ).checked,
        required_score: scoreOf('go_score'),
        max_genes: Math.min(500, Math.max(2, Number(val('go_max')) || 300)),
      })
    )
  })
  document
    .getElementById('ndex_import_button')
    ?.addEventListener('click', () => {
      const uuid = val('ndex_uuid')
        .trim()
        // accept a pasted NDEx viewer URL too
        .replace(/^.*\/networks?\//, '')
      if (!/^[0-9a-fA-F-]{36}$/.test(uuid))
        return status('Paste an NDEx network UUID (36 characters).', true)
      void load('ndex', 'NDEx', () => api.importNdex(uuid))
    })
  document.querySelectorAll<HTMLElement>('.ndex-example').forEach((b) =>
    b.addEventListener('click', () => {
      const uuid = b.dataset.uuid!
      ;(document.getElementById('ndex_uuid') as HTMLInputElement).value = uuid
      void load('ndex', `NDEx: ${b.dataset.name}`, () => api.importNdex(uuid))
    })
  )
}
