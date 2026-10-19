// Annotations — PLAN-ROADMAP Phase 6. The Annotations menu's main card:
// annotation sets, pie-chart nodes, hulls or fog clouds per cluster/annotation;
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
import { escapeHtml } from '../utils'
import { askDeleteSet, renameSet } from './networks'
import { selectNodesByName, unselectAllNodes } from '../actions/node'
import type { AnnotationView } from '../api/client'
import {
  groupColor,
  HULL_OPACITY,
  resetAnnotationOverlays,
  setGroupHidden,
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

// The Annotations menu's main card (ui/annotation_panel.ts): which set or
// clustering the scene shows, and how — hulls or fog clouds, their opacity
// and padding, pies. The Layout panel's Group Layout card keeps its radios in step.
export const ANNOTATION_VIEW_HTML = `
<details id="annCard_show" class="lp-section lp-more" open>
  <summary>Show on the network</summary>
  <div class="form-text mt-0 mb-2">Draws the groups in the scene: a hull or a fog cloud around every annotation term or cluster on each layer, and pie charts on the annotated nodes.</div>
  <label class="form-label small" for="annotationSet">Annotation set</label>
  <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
    <select id="annotationSet" class="form-select form-select-sm" style="width:auto" aria-label="Annotation set"><option value="-1">(none)</option></select>
    <button type="button" id="annotationSetRename" class="btn btn-outline-secondary btn-sm" title="Rename the annotation set shown" disabled>Rename</button>
    <button type="button" id="annotationSetDelete" class="btn btn-outline-secondary btn-sm" title="Delete the annotation set shown" disabled>Delete</button>
  </div>
  <div class="form-text mt-0 mb-2">Every attribute or group file, enrichment or cluster run is kept; switch between them.</div>
  <div id="annotationsNote" class="form-text mb-2 d-none">No annotations in this network: upload a node attributes or group file (File), or annotate nodes from an enrichment (Analyze → Annotations &amp; Groups). The annotation options are off until then.</div>
  <div class="lp-grid mb-2" style="align-items: start">
    <div role="radiogroup" aria-label="Draw around">
      <div class="form-label small">Draw around</div>
      ${(
        [
          ['none', 'Nothing'],
          ['cluster', 'Clusters'],
          ['annotation', 'Annotations'],
        ] as const
      )
        .map(
          ([v, l]) => `
      <div class="form-check">
        <input class="form-check-input" type="radio" name="hullSource" id="hull_${v}" value="${v}" ${v === 'none' ? 'checked' : ''} />
        <label class="form-check-label" for="hull_${v}">${l}</label>
      </div>`
        )
        .join('')}
    </div>
    <div role="radiogroup" aria-label="Draw as">
      <div class="form-label small">Draw as</div>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="hullStyle" id="hullStyle_hull" value="hull" checked />
        <label class="form-check-label" for="hullStyle_hull">Hull</label>
      </div>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="hullStyle" id="hullStyle_fog" value="fog" />
        <label class="form-check-label" for="hullStyle_fog">Fog cloud</label>
      </div>
    </div>
  </div>
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
  <div class="form-check form-switch mb-2">
    <input class="form-check-input" type="checkbox" role="switch" id="showPies" />
    <label class="form-check-label" for="showPies">Show Annotations as Pie Charts</label>
  </div>
  <div class="form-text mb-0">Communities come from <a href="#" data-ann-go="#panel-clustering">Clustering</a>, terms from an enrichment in <a href="#" data-ann-go="#panel-annotations">Analyze → Annotations &amp; Groups</a>; <a href="#" data-ann-go="#panel-layouts">Layout → Group Layout</a> pulls the groups apart.</div>
</details>
`

// "Enrichment" card of Analyze → Annotations & Groups
export const ANNOTATIONS_HTML = `
<details id="annotation_card" class="lp-section lp-more" open>
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
              <td><span class="badge me-1" style="background:${escapeHtml(groupColor(t.description))}">&nbsp;</span>${escapeHtml(t.description)} <small class="text-secondary">${escapeHtml(t.category)}</small></td>
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
  for (const key of view.hidden) setGroupHidden(key, true)
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
    radio.addEventListener('change', () =>
      setHullSource(radio.value as HullSource)
    )
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
