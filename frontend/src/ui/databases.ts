// Databases panel — one expandable, colour-coded card per source, as in
// NORMA: STRING, Reactome, OmniPath, NDEx, IntAct, Gene Ontology and a
// Compare card (STRING · IntAct · OmniPath as layers). Protein lists, organism
// and score are typed once: the cards that take them stay in sync.

import { api, type NetworkData } from '../api/client'
import { registerLoad, snapshotActive } from '../actions/workspace'
import { escapeHtml } from '../utils'
import { loadNetwork } from '../actions/network'
import { mergeAsLayers } from '../actions/merge'
import { setNetworkMode } from '../actions/modes'
import { dismissOneLayerPrompt } from './mode'
import { store } from '../store'
import { ctx } from '../three'
import { redrawIntraLayerEdges } from '../actions/edge'
import { startLoader, finishLoader } from '../actions/screen'
import { showTab } from './tabs'
import { PROGRESS_HTML, ProgressBar } from './progress'

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

// STRING score fields -> channel names (services/databases.py STRING_CHANNELS)
const STRING_CHANNELS: [string, string][] = [
  ['escore', 'Experiments'],
  ['dscore', 'Databases'],
  ['tscore', 'Text mining'],
  ['ascore', 'Co-expression'],
  ['nscore', 'Neighborhood'],
  ['fscore', 'Gene fusion'],
  ['pscore', 'Co-occurrence'],
]
const DATABASES = ['STRING', 'IntAct', 'OmniPath']

const CLOUD =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 16.6A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 15.3"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>'

const species = (id: string) =>
  `<select id="${id}" class="form-select form-select-sm db-species" aria-label="Organism">${SPECIES.map(([t, n]) => `<option value="${t}">${n}</option>`).join('')}</select>`
const score = (id: string) =>
  `<input id="${id}" class="form-control form-control-sm db-score" type="number" min="0" max="1" step="0.05" value="0.4" aria-label="Minimum score" />`
const identifiers = (id: string) =>
  `<textarea id="${id}" class="form-control form-control-sm db-identifiers mb-2" rows="2" placeholder="e.g. TP53 MDM2 CDKN1A ATM" spellcheck="false" aria-label="Proteins"></textarea>`
const organismScore = (sid: string, scid: string) => `
      <div class="lp-grid mb-2">
        <div><label class="form-label small" for="${sid}">Organism</label>${species(sid)}</div>
        <div><label class="form-label small" for="${scid}">Min. score (0–1)</label>${score(scid)}</div>
      </div>`

function card(
  key: string,
  title: string,
  blurb: string,
  body: string,
  open = false
): string {
  return `
<details class="db-card db-card--${key}" id="card_${key}"${open ? ' open' : ''}>
  <summary class="db-card__head">
    <span class="db-card__icon">${CLOUD}</span>
    <span class="db-card__title">${title}</span>
    <button type="button" class="db-card__help" title="How this importer works" aria-label="Help for ${title}">?</button>
    <span class="db-card__chevron" aria-hidden="true">▸</span>
  </summary>
  <div class="db-card__body">
    <div class="form-text mt-0 mb-2">${blurb}</div>
    ${body}
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
      <div id="${key}_results" class="db-hits mb-2"></div>
      <label class="form-label small" for="${key}_ids">${what[0].toUpperCase()}${what.slice(1)} to import (one per line, each becomes a layer)</label>
      <textarea id="${key}_ids" class="form-control form-control-sm mb-2" rows="3" placeholder="${example}" spellcheck="false"></textarea>`

const DATABASES_HTML = `
<div class="col-md-8 col-lg-6 layout-panel db-panel">
  <div class="lp-section db-mode">
    <div class="lp-title">Import as</div>
    <div class="form-check">
      <input class="form-check-input" type="radio" name="db_import_mode" id="db_mode_replace" value="replace" checked />
      <label class="form-check-label" for="db_mode_replace">New network (replaces the current one)</label>
    </div>
    <div class="form-check">
      <input class="form-check-input" type="radio" name="db_import_mode" id="db_mode_layer" value="layer" />
      <label class="form-check-label" for="db_mode_layer">New layer(s) added to the current network — copies of a node are linked across layers</label>
    </div>
    <div class="form-check">
      <input class="form-check-input" type="radio" name="db_import_mode" id="db_mode_single" value="single" />
      <label class="form-check-label" for="db_mode_single">Single 3D network (one graph, no floors)</label>
    </div>
  </div>
  ${card(
    'string',
    'STRING',
    'Protein–protein associations with one curved channel per evidence type, weighted by its score.',
    `
      <label class="form-label small" for="db_identifiers">Proteins (gene names or IDs)</label>
      ${identifiers('db_identifiers')}
      ${organismScore('db_species', 'db_score')}
      <div id="db_string_opts" class="mb-2">
        ${STRING_CHANNELS.map(
          ([f, n]) => `
        <div class="form-check form-check-inline">
          <input class="form-check-input db_channel" type="checkbox" id="db_ch_${f}" value="${f}" checked />
          <label class="form-check-label" for="db_ch_${f}">${n}</label>
        </div>`
        ).join('')}
        <div class="mt-1">
          <label for="db_add_nodes" class="form-label small">Add interactors:</label>
          <input id="db_add_nodes" class="form-control form-control-sm d-inline-block" style="width:5rem" type="number" min="0" max="100" value="0" />
        </div>
      </div>
      <button id="db_import_string" class="btn btn-primary btn-sm">Import from STRING</button>`,
    true
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
      <div class="mb-2"><label class="form-label small" for="omnipath_species">Organism</label>${species('omnipath_species')}</div>
      <div class="form-check mb-2">
        <input class="form-check-input" type="checkbox" id="omnipath_only_among" checked />
        <label class="form-check-label" for="omnipath_only_among">Only interactions among these proteins</label>
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
        <label class="form-check-label" for="intact_only_among">Only interactions among these proteins</label>
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
        <input class="form-check-input" type="checkbox" id="go_children" />
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
          <label class="form-check-label" for="db_only_among">Only interactions among these proteins</label>
        </div>
      </div>
      <button id="db_import_layers" class="btn btn-primary btn-sm">Import, One Layer per Database</button>`
  )}
  ${PROGRESS_HTML('dbProgress', 'Import progress')}
  <div id="db_status" class="small mt-2"></div>
</div>
`

const progress = new ProgressBar('dbProgress')

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

type ImportMode = 'replace' | 'layer' | 'single'
const importMode = (): ImportMode =>
  (document.querySelector<HTMLInputElement>(
    'input[name="db_import_mode"]:checked'
  )?.value ?? 'replace') as ImportMode

// Adding layers reloads the merged network; the loaded layers and nodes get
// their positions back and the new layers line up after the last one.
type Transforms = {
  scene: number[]
  layers: Map<string, number[]>
  nodes: Map<string, number[]>
}
function snapshotTransforms(): Transforms {
  const s = ctx.scene!
  return {
    scene: [
      s.getPosition('x'),
      s.getPosition('y'),
      s.getScale(),
      s.getRotation('x'),
      s.getRotation('y'),
      s.getRotation('z'),
    ],
    layers: new Map(
      ctx.layers.map((l) => [
        l.name,
        [
          l.getPosition('x'),
          l.getPosition('y'),
          l.getPosition('z'),
          l.getRotation('x'),
          l.getRotation('y'),
          l.getRotation('z'),
          l.getScale(),
        ],
      ])
    ),
    nodes: new Map(
      ctx.nodeObjects.map((n, i) => [
        ctx.nodeLayerNames[i],
        [n.getPosition('x'), n.getPosition('y'), n.getPosition('z')],
      ])
    ),
  }
}
function restoreTransforms(t: Transforms): void {
  const s = ctx.scene
  if (!s?.exists()) return
  const [px, py, sc, rx, ry, rz] = t.scene
  s.setPosition('x', px)
  s.setPosition('y', py)
  s.setScale(sc)
  s.setRotation('x', rx)
  s.setRotation('y', ry)
  s.setRotation('z', rz)
  let maxX = -Infinity
  for (const v of t.layers.values()) maxX = Math.max(maxX, v[0])
  let added = 0
  for (const l of ctx.layers) {
    const v = t.layers.get(l.name)
    if (v) {
      l.setPosition('x', v[0])
      l.setPosition('y', v[1])
      l.setPosition('z', v[2])
      l.setRotation('x', v[3])
      l.setRotation('y', v[4])
      l.setRotation('z', v[5])
      l.setScale(v[6])
    } else if (Number.isFinite(maxX)) {
      added++
      l.setPosition('x', maxX + 480 * added)
      l.setPosition('y', 0)
      l.setPosition('z', 0)
    }
  }
  ctx.nodeObjects.forEach((n, i) => {
    const v = t.nodes.get(ctx.nodeLayerNames[i])
    if (!v) return
    n.setPosition('x', v[0])
    n.setPosition('y', v[1])
    n.setPosition('z', v[2])
  })
  redrawIntraLayerEdges()
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderLayerLabelsFlag = true
  ctx.renderNodeLabelsFlag = true
}

async function load(
  what: string,
  request: Promise<NetworkData>
): Promise<void> {
  status(`Fetching from ${what}…`)
  progress.computing(`Fetching from ${what}`)
  startLoader()
  try {
    const data = await request
    const mode = importMode()
    const current = store.get().network
    const warn = data.warnings.length ? ` ${data.warnings.join(' ')}` : ''
    if (mode === 'layer' && current && ctx.scene?.exists()) {
      const kept = snapshotTransforms()
      const merged = mergeAsLayers(current, data)
      loadNetwork(merged.network)
      restoreTransforms(kept)
      progress.done(`${what} added`)
      status(
        `Added ${merged.layers.length === 1 ? 'layer' : 'layers'} ${merged.layers.join(', ')}: ${data.nodes.length} nodes, ${data.edges.length} edges, ${merged.links} link${merged.links === 1 ? '' : 's'} to copies in the other layers. Run a layout for the new layer${merged.layers.length === 1 ? '' : 's'}.${warn}`
      )
    } else {
      snapshotActive()
      loadNetwork(data)
      registerLoad(`${what} import`)
      if (mode === 'single') {
        await setNetworkMode('single')
        dismissOneLayerPrompt()
      }
      progress.done(`${what} loaded`)
      status(
        `Loaded network: ${data.layers.length} layers, ${data.nodes.length} nodes, ${data.edges.length} edges${mode === 'single' ? ' as one 3D network' : ''}.${warn}`
      )
    }
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
      for (const other of inputs) if (other !== input) other.value = input.value
    })
}

function initPicker(key: 'reactome' | 'go'): void {
  const results = document.getElementById(`${key}_results`)!
  const ids = document.getElementById(`${key}_ids`) as HTMLTextAreaElement
  const search = async () => {
    const q = val(`${key}_query`).trim()
    if (q.length < 2)
      return status('Type at least two characters to search.', true)
    results.innerHTML = '<span class="form-text">Searching…</span>'
    try {
      const hits = await api.searchSets(key, q, Number(val(`${key}_species`)))
      results.innerHTML = hits.length
        ? hits
            .map(
              (h) =>
                `<button type="button" class="db-hit" data-id="${escapeHtml(h.id)}" title="Add ${escapeHtml(h.id)}"><span class="db-hit__id">${escapeHtml(h.id)}</span> ${escapeHtml(h.name)}${h.detail ? ` <span class="db-hit__detail">${escapeHtml(h.detail)}</span>` : ''}</button>`
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
    } catch (err) {
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

  document.getElementById('db_import_string')?.addEventListener('click', () => {
    const ids = proteins('db_identifiers')
    if (!ids) return
    const channels = checked('.db_channel')
    if (channels.length === 0)
      return status('Tick at least one evidence channel.', true)
    const addNodes = Number(val('db_add_nodes'))
    void load(
      'STRING',
      api.importString({
        identifiers: ids,
        species: Number(val('db_species')),
        required_score: scoreOf('db_score'),
        channels,
        add_nodes: Number.isFinite(addNodes)
          ? Math.min(100, Math.max(0, Math.round(addNodes)))
          : 0,
      })
    )
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
      'db_score',
      'omnipath_only_among',
    ],
  ] as const)
    document.getElementById(button)?.addEventListener('click', () => {
      const ids = proteins(idsId)
      if (!ids) return
      void load(
        db,
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
    void load(
      databases.join(', '),
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
      void load(
        'Reactome',
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
    void load(
      'Gene Ontology',
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
      void load('NDEx', api.importNdex(uuid))
    })
}
