// Annotations — PLAN-ROADMAP Phase 6. View → Annotations' main card:
// annotation sets, pie-chart nodes, a shape around every cluster/annotation;
// and the Enrichment card of Analyze → Annotations & Groups: STRING functional
// enrichment of the selected nodes (results can annotate nodes).

import { api, type EnrichedTerm } from '../api/client'
import {
  activeSlot,
  applyAnnotationSet,
  registerAnnotationSet,
} from '../actions/workspace'
import { bus } from '../bus'
import { ctx } from '../three'
import { escapeHtml, safeColor } from '../utils'
import { askDeleteSet, renameSet } from './networks'
import { selectNodesByName, unselectAllNodes } from '../actions/node'
import type { AnnotationView } from '../api/client'
import { colorByGroups, listGroups, type GroupSource } from '../actions/groups'
import { groupsStatus } from './groups'
import {
  groupColor,
  HULL_OPACITY,
  resetAnnotationOverlays,
  setGroupsHidden,
  setHullOpacity,
  setHullPadding,
  setHullSource,
  setHullStyle,
  showAnnotationPies,
  takeAnnotationView,
  type HullSource,
  type HullStyle,
} from '../actions/annotations'

const SPECIES: [number, string][] = [
  [9606, 'Human'],
  [10090, 'Mouse'],
  [10116, 'Rat'],
  [7227, 'Fruit fly'],
  [6239, 'C. elegans'],
  [7955, 'Zebrafish'],
  [559292, 'Yeast'],
  [3702, 'Arabidopsis'],
]

// Draw as: the shapes around each group (actions/annotations.ts), as tiles
// with a sketch of the shape; the radio under each tile keeps its id
const SHAPE = (body: string) =>
  `<svg viewBox="0 0 40 28" width="40" height="28" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
const DOTS =
  '<g fill="currentColor" stroke="none"><circle cx="14" cy="11" r="1.6"/><circle cx="24" cy="10" r="1.6"/><circle cx="19" cy="17" r="1.6"/><circle cx="27" cy="18" r="1.6"/></g>'
const HULL_PATH = 'M7 20 11 6l15-2 8 11-9 9Z'
const DRAW_AS: [HullStyle, string, string, string][] = [
  [
    'hull',
    'Hull',
    'A translucent area on the floor around the members',
    SHAPE(
      `<path d="${HULL_PATH}" fill="currentColor" fill-opacity=".28"/>${DOTS}`
    ),
  ],
  [
    'outline',
    'Outline',
    'A band along the edge of that area, the floor inside left clear',
    SHAPE(`<path d="${HULL_PATH}" stroke-width="3"/>${DOTS}`),
  ],
  [
    'fog',
    'Fog cloud',
    'A haze over the members that follows their shape (as in NORMA)',
    SHAPE(
      `<g fill="currentColor" fill-opacity=".2" stroke="none"><circle cx="15" cy="13" r="9"/><circle cx="25" cy="12" r="8"/><circle cx="21" cy="19" r="7"/></g>${DOTS}`
    ),
  ],
  [
    'cloud',
    'Cloud',
    'A round cloud of soft puffs holding the members',
    SHAPE(
      '<path d="M12 23h17a6 6 0 0 0 .7-12 8.5 8.5 0 0 0-16.2 1.6A5.3 5.3 0 0 0 12 23Z" fill="currentColor" fill-opacity=".25"/>'
    ),
  ],
  [
    'sphere',
    'Sphere',
    'A translucent sphere holding the members',
    SHAPE(
      '<circle cx="20" cy="14" r="11" fill="currentColor" fill-opacity=".2"/><ellipse cx="20" cy="14" rx="11" ry="3.6" stroke-opacity=".7"/><ellipse cx="20" cy="14" rx="3.6" ry="11" stroke-opacity=".7"/>'
    ),
  ],
  [
    'ellipsoid',
    'Ellipsoid',
    'A translucent ellipsoid fitted to the members (a flat lens on a flat layer)',
    SHAPE(
      '<ellipse cx="20" cy="14" rx="16" ry="8.5" fill="currentColor" fill-opacity=".2"/><ellipse cx="20" cy="14" rx="16" ry="2.8" stroke-opacity=".7"/><ellipse cx="20" cy="14" rx="4.5" ry="8.5" stroke-opacity=".7"/>'
    ),
  ],
  [
    'box',
    'Box',
    'A translucent box around the members',
    SHAPE(
      '<path d="M8 11h17v13H8Z" fill="currentColor" fill-opacity=".2"/><path d="M8 11l6-6h17l-6 6M25 24l6-6V5"/>'
    ),
  ],
]

// a card of View → Annotations: a title and its one-line hint
const card = (id: string, title: string, hint: string, body: string) => `
<details id="${id}" class="lp-section lp-more">
  <summary>${title}<span class="lp-hint">${hint}</span></summary>
  ${body}
</details>`

// a link that opens another panel (and a card there): ui/annotation_panel.ts
const go = (pane: string, text: string, cardId = '') =>
  `<a href="#" data-ann-go="${pane}"${cardId ? ` data-ann-card="${cardId}"` : ''}>${text}</a>`

// View → Annotations' first three cards (ui/annotation_panel.ts; the Groups
// and reports cards are ui/groups.ts): what is drawn, how, and on the nodes.
// The Layout panel's Group Layout card keeps the radios in step.
export const ANNOTATION_VIEW_HTML = `
${card(
  'annCard_show',
  'What to show',
  'annotation terms or clusters',
  `
  <div class="ann-seg mb-2" role="radiogroup" aria-label="Draw around">${(
    [
      ['none', 'Nothing'],
      ['cluster', 'Clusters'],
      ['annotation', 'Annotations'],
    ] as const
  )
    .map(
      ([v, l]) => `
    <label class="ann-seg__item">
      <input class="ann-pick" type="radio" name="hullSource" id="hull_${v}" value="${v}" ${v === 'none' ? 'checked' : ''} />
      <span>${l}</span>
    </label>`
    )
    .join('')}
  </div>
  <label class="form-label small mb-1" for="annotationSet">Annotation set</label>
  <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
    <select id="annotationSet" class="form-select form-select-sm" style="width:auto;max-width:100%" aria-label="Annotation set"><option value="-1">(none)</option></select>
    <button type="button" id="annotationSetRename" class="btn btn-outline-secondary btn-sm" title="Rename the annotation set shown" disabled>Rename</button>
    <button type="button" id="annotationSetDelete" class="btn btn-outline-secondary btn-sm" title="Delete the annotation set shown" disabled>Delete</button>
  </div>
  <div id="annSummary" class="ann-summary mb-2" aria-live="polite"></div>
  <div id="annotationsNote" class="form-text mb-2 d-none">No annotations in this network yet: the annotation options are off until then.</div>
  <div class="form-text mb-0">Every file, enrichment or cluster run is kept as a set. Get annotations from ${go('#panel-file', 'a node attributes or group file', 'fileCard_groups')}, ${go('#panel-databases', 'STRING groupings', 'card_string')}, ${go('#panel-annotations', 'an enrichment')}, or communities from ${go('#panel-clustering', 'Clustering')}.</div>
`
)}
${card(
  'annCard_draw',
  'How to draw',
  'the shape around each group',
  `
  <div class="ann-tiles mb-1" role="radiogroup" aria-label="Draw as">${DRAW_AS.map(
    ([v, l, hint, icon]) => `
    <label class="ann-tile" title="${hint}">
      <input class="ann-pick" type="radio" name="hullStyle" id="hullStyle_${v}" value="${v}" ${v === 'hull' ? 'checked' : ''} />
      <span class="ann-tile__body">${icon}<span>${l}</span></span>
    </label>`
  ).join('')}
  </div>
  <div class="form-text mt-0 mb-2">Hull and Outline lie on the floor; Fog cloud and Cloud are soft; Sphere, Ellipsoid and Box hold each group whole, also in 3D layouts.</div>
  <div class="lp-grid mb-2">
    <div>
      <label class="form-label small mb-0" for="hullOpacity">Opacity: <span id="hullOpacityValue">${HULL_OPACITY.toFixed(2)}</span></label>
      <input type="range" class="form-range" id="hullOpacity" min="0.05" max="1" step="0.05" value="${HULL_OPACITY}" />
    </div>
    <div>
      <label class="form-label small mb-0" for="hullPadding">Padding: <span id="hullPaddingValue">1.00</span>×</label>
      <input type="range" class="form-range" id="hullPadding" min="0.25" max="3" step="0.25" value="1" />
    </div>
  </div>
  <div class="form-text mb-0">${go('#panel-layouts', 'Layout → Group Layout', 'groupLayoutCard')} pulls the groups apart.</div>
`
)}
${card(
  'annCard_nodes',
  'On the nodes',
  'pie charts and group colours',
  `
  <div class="form-check form-switch mb-2">
    <input class="form-check-input" type="checkbox" role="switch" id="showPies" />
    <label class="form-check-label" for="showPies">Show Annotations as Pie Charts</label>
  </div>
  <div class="d-flex flex-wrap gap-2 mb-1">
    <button type="button" id="annColorNodes" class="btn btn-outline-primary btn-sm" title="Every node takes its first group's colour, as its pie and shape show it">Colour Nodes by Group</button>
    <button type="button" id="annColorLabels" class="btn btn-outline-primary btn-sm" title="Every label takes its node's first group's colour, made to read on the background">Colour Labels by Group</button>
  </div>
  <div class="form-text mb-0">The groups of <i>What to show</i> (annotations unless clusters are chosen); Undo brings the old colours back. ${go('#panel-style', 'Edit → Style')} has other palettes.</div>
`
)}
`

// "Enrichment" card of Analyze → Annotations & Groups
export const ANNOTATIONS_HTML = `
<details id="annotation_card" class="lp-section lp-more">
  <summary>Enrichment (STRING)</summary>
  <div class="mt-2">
    <label class="form-label" for="enrichSpecies">Enrichment of Selected Nodes (STRING):</label>
    <div class="d-flex gap-2 mb-2">
      <select id="enrichSpecies" class="form-select form-select-sm">${SPECIES.map(([t, n]) => `<option value="${t}">${n}</option>`).join('')}</select>
      <button id="runEnrichment" class="btn btn-primary btn-sm text-nowrap">Run</button>
    </div>
    <div id="enrich_status" class="small mb-2"></div>
    <div id="enrich_results" style="max-height: 40vh; overflow: auto"></div>
    <button id="annotateTopTerms" class="btn btn-outline-primary btn-sm mt-2" hidden>Annotate Nodes with Top 5 Terms</button>
  </div>
</details>
`

let results: EnrichedTerm[] = []

function status(msg: string, isError = false): void {
  const el = document.getElementById('enrich_status')
  if (!el) return
  el.textContent = msg
  el.className = `small mb-2 ${isError ? 'text-danger' : 'text-success'}`
}

function renderResults(): void {
  const box = document.getElementById('enrich_results')!
  box.innerHTML = results.length
    ? `<table class="table table-sm table-hover enrich-table">
        <thead><tr><th>Term</th><th>FDR</th><th>Genes</th></tr></thead>
        <tbody>${results
          .map(
            (
              t,
              i
            ) => `<tr data-term="${i}" style="cursor:pointer" title="${escapeHtml(t.term)} — click to select its genes">
              <td><span class="badge me-1" style="background:${escapeHtml(safeColor(groupColor(t.description)))}">&nbsp;</span>${escapeHtml(t.description)} <small class="text-secondary">${escapeHtml(t.category)}</small></td>
              <td>${t.fdr.toExponential(1)}</td>
              <td>${t.genes.length}</td>
            </tr>`
          )
          .join('')}</tbody></table>`
    : ''
  box.querySelectorAll<HTMLTableRowElement>('tr[data-term]').forEach((row) =>
    row.addEventListener('click', () => {
      const t = results[Number(row.dataset.term)]
      unselectAllNodes()
      selectNodesByName(t.genes.join(','))
    })
  )
  ;(document.getElementById('annotateTopTerms') as HTMLButtonElement).hidden =
    results.length === 0
}

async function onRunEnrichment(): Promise<void> {
  const genes = [
    ...new Set(ctx.nodeObjects.filter((n) => n.isSelected).map((n) => n.name)),
  ]
  if (genes.length === 0)
    return status(
      'Select some nodes first (double-click, lasso or search).',
      true
    )
  status(`Running enrichment on ${genes.length} genes…`)
  try {
    results = await api.enrichment({
      genes,
      species: Number(
        (document.getElementById('enrichSpecies') as HTMLSelectElement).value
      ),
    })
    status(
      results.length
        ? `${results.length} enriched terms (FDR-sorted). Click a term to select its genes.`
        : 'No enriched terms for this selection.'
    )
    renderResults()
  } catch (err) {
    status(err instanceof Error ? err.message : String(err), true)
  }
}

// Top terms become node annotations (per gene, across layers) -> pies/hulls.
function annotateTopTerms(): void {
  const top = results.slice(0, 5)
  const byGene = new Map<string, string[]>()
  for (const t of top)
    for (const g of t.genes)
      byGene.set(g.toUpperCase(), [
        ...(byGene.get(g.toUpperCase()) ?? []),
        t.description,
      ])
  for (const node of ctx.nodeObjects)
    node.annotations = byGene.get(node.name.toUpperCase()) ?? node.annotations
  ;(document.getElementById('showPies') as HTMLInputElement).checked = true
  showAnnotationPies(true)
  ;(document.getElementById('hull_annotation') as HTMLInputElement).checked =
    true
  setHullSource('annotation')
  registerAnnotationSet('Enrichment: top terms', (n) =>
    byGene.has(n.toUpperCase())
  )
  bus.emit('groups:changed', { source: 'annotation' })
  status('Annotated nodes with the top 5 terms (pies + hulls on).')
}

// Pies, annotation hulls and annotation groups only mean something once the
// network carries annotations (attribute or group file, enrichment, session);
// until then those options are disabled and a note says what to load.
export function hasAnnotations(): boolean {
  return ctx.nodeObjects.some((n) => n.annotations.length > 0)
}

export function syncAnnotationControls(): void {
  const on = hasAnnotations()
  const input = (id: string) =>
    document.getElementById(id) as HTMLInputElement | null
  const option = (selector: string) =>
    document.querySelector<HTMLOptionElement>(selector)
  for (const id of ['showPies', 'groupPies', 'hull_annotation']) {
    const el = input(id)
    if (el) el.disabled = !on
  }
  document.getElementById('annotationsNote')?.classList.toggle('d-none', on)
  if (!on) {
    // nothing to draw: fall back from the annotation choices
    const hull = input('hull_annotation')
    if (hull?.checked) {
      const none = input('hull_none')
      if (none) none.checked = true
      setHullSource('none')
    }
    for (const id of ['showPies', 'groupPies']) {
      const el = input(id)
      if (el?.checked) {
        el.checked = false
        showAnnotationPies(false)
      }
    }
  }
  for (const [selector, fallback] of [
    ['#groupSource option[value="annotations"]', 'clusters'],
    ['#groupsSource option[value="annotation"]', 'cluster'],
    ['#styleColorBy option[value="annotation"]', 'layer'],
  ] as const) {
    const opt = option(selector)
    if (!opt) continue
    opt.disabled = !on
    const select = opt.parentElement as HTMLSelectElement
    if (!on && select.value === opt.value) {
      // step aside while there is nothing to show, and come back with the data
      select.dataset.annotationFallback = '1'
      select.value = fallback
      select.dispatchEvent(new Event('change', { bubbles: true }))
    } else if (on && select.dataset.annotationFallback) {
      delete select.dataset.annotationFallback
      select.value = opt.value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }
}

// A saved session's drawing settings: the controls show them and the scene
// draws them. Without annotations the annotation choices fall back, as above.
function restoreAnnotationView(view: AnnotationView): void {
  const input = (id: string) =>
    document.getElementById(id) as HTMLInputElement | null
  const on = hasAnnotations()
  const source = view.source === 'annotation' && !on ? 'none' : view.source
  const pies = view.pies && on
  for (const [id, checked] of [
    [`hull_${source}`, true],
    [`hullStyle_${view.style}`, true],
    ['showPies', pies],
    ['groupPies', pies],
  ] as const) {
    const el = input(id)
    if (el) el.checked = checked
  }
  for (const [id, value] of [
    ['hullOpacity', view.opacity],
    ['hullPadding', view.padding],
  ] as const) {
    const el = input(id)
    if (el) el.value = String(value)
    const shown = document.getElementById(`${id}Value`)
    if (shown) shown.textContent = value.toFixed(2)
  }
  setHullSource('none') // nothing to redraw while the rest is set
  setGroupsHidden(
    view.hidden,
    true,
    view.source === 'cluster' ? 'cluster' : 'annotation'
  )
  setHullStyle(view.style)
  setHullOpacity(view.opacity)
  setHullPadding(view.padding)
  showAnnotationPies(pies)
  setHullSource(source)
}

// the stored annotation sets of the active network, newest first
function syncAnnotationSets(): void {
  const select = document.getElementById(
    'annotationSet'
  ) as HTMLSelectElement | null
  if (!select) return
  const slot = activeSlot()
  const sets = slot?.annotationSets ?? []
  select.innerHTML =
    '<option value="-1">(none)</option>' +
    sets
      .map(
        (set, i) =>
          `<option value="${i}">${escapeHtml(set.name)} (${Object.keys(set.byNode).length} nodes)</option>`
      )
      .join('')
  select.value = String(slot?.activeSet ?? -1)
  select.disabled = sets.length === 0
  // rename / delete the set shown
  for (const id of ['annotationSetRename', 'annotationSetDelete'])
    (document.getElementById(id) as HTMLButtonElement).disabled =
      select.value === '-1'
}

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

// the groups What to show draws (annotations while it draws nothing)
const chosenGroups = (): GroupSource =>
  document.querySelector<HTMLInputElement>('input[name="hullSource"]:checked')
    ?.value === 'cluster'
    ? 'cluster'
    : 'annotation'

// What to show, in one line: the set or the clusters, their groups and nodes
function syncSummary(): void {
  const el = document.getElementById('annSummary')
  if (!el) return
  const describe = (name: string, source: GroupSource) => {
    const groups = listGroups(source)
    const nodes = new Set(groups.flatMap((g) => g.members)).size
    return groups.length
      ? `${name}: ${count(groups.length, 'group')} over ${count(nodes, 'node')}`
      : ''
  }
  const slot = activeSlot()
  const set = slot?.annotationSets[slot.activeSet]?.name ?? 'Annotations'
  const drawn = document.querySelector<HTMLInputElement>(
    'input[name="hullSource"]:checked'
  )?.value
  el.textContent =
    drawn === 'cluster'
      ? describe('Clusters', 'cluster') ||
        'No clusters yet: find communities in Clustering.'
      : drawn === 'annotation'
        ? describe(set, 'annotation')
        : [
            'Nothing drawn',
            describe(set, 'annotation'),
            describe('Clusters', 'cluster'),
          ]
            .filter(Boolean)
            .join(' · ')
}

export function initAnnotations(): void {
  bus.on('network:loaded', syncAnnotationControls)
  bus.on('groups:changed', syncAnnotationControls)
  bus.on('workspace:changed', syncAnnotationSets)
  bus.on('network:loaded', syncAnnotationSets)
  syncAnnotationControls()
  syncAnnotationSets()
  const setSelect = document.getElementById(
    'annotationSet'
  ) as HTMLSelectElement | null
  setSelect?.addEventListener('change', () =>
    applyAnnotationSet(Number(setSelect.value))
  )
  document
    .getElementById('annotationSetRename')
    ?.addEventListener('click', () => {
      const slot = activeSlot()
      if (slot && setSelect && slot.activeSet >= 0)
        renameSet(setSelect, slot.id, slot.activeSet)
    })
  document
    .getElementById('annotationSetDelete')
    ?.addEventListener('click', () => {
      const slot = activeSlot()
      if (slot && slot.activeSet >= 0)
        void askDeleteSet(slot.id, slot.activeSet)
    })
  document
    .getElementById('showPies')
    ?.addEventListener('change', (e) =>
      showAnnotationPies((e.target as HTMLInputElement).checked)
    )
  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="hullSource"]'
  ))
    radio.addEventListener('change', () => {
      setHullSource(radio.value as HullSource)
      // the group list follows: the groups drawn are the groups listed
      const list = document.getElementById(
        'groupsSource'
      ) as HTMLSelectElement | null
      const option = list?.querySelector<HTMLOptionElement>(
        `option[value="${radio.value}"]`
      )
      if (list && option && !option.disabled && list.value !== radio.value) {
        list.value = radio.value
        list.dispatchEvent(new Event('change', { bubbles: true }))
      }
      syncSummary()
    })
  for (const [id, what] of [
    ['annColorNodes', 'nodes'],
    ['annColorLabels', 'labels'],
  ] as const)
    document.getElementById(id)?.addEventListener('click', () => {
      const source = chosenGroups()
      const n = colorByGroups(source, what)
      groupsStatus(
        n
          ? `${count(n, what === 'nodes' ? 'node' : 'label')} coloured by ${source === 'cluster' ? 'cluster' : 'their first annotation'}; Undo brings the old colours back.`
          : 'No groups to colour by yet.',
        !n
      )
    })
  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="hullStyle"]'
  ))
    radio.addEventListener('change', () =>
      setHullStyle(radio.value as HullStyle)
    )
  for (const [id, set] of [
    ['hullOpacity', setHullOpacity],
    ['hullPadding', setHullPadding],
  ] as const)
    document.getElementById(id)?.addEventListener('input', (e) => {
      const value = Number((e.target as HTMLInputElement).value)
      const shown = document.getElementById(`${id}Value`)
      if (shown) shown.textContent = value.toFixed(2)
      set(value)
    })
  bus.on('network:loaded', resetAnnotationOverlays)
  // after the reset, and before the Groups card lists the hull switches
  bus.on('network:loaded', () => {
    const view = takeAnnotationView()
    if (view) restoreAnnotationView(view)
  })
  // after the restore, which sets Draw around
  for (const event of [
    'network:loaded',
    'groups:changed',
    'clustering:applied',
    'workspace:changed',
    'history:changed',
  ] as const)
    bus.on(event, syncSummary)
  syncSummary()
}

export function initEnrichment(): void {
  document.getElementById('runEnrichment')?.addEventListener('click', () => {
    void onRunEnrichment()
  })
  document
    .getElementById('annotateTopTerms')
    ?.addEventListener('click', annotateTopTerms)
  bus.on('network:loaded', () => {
    results = []
    renderResults()
  })
}
