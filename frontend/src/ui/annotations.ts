// "Annotations & Enrichment" card of Analyze → Annotations & Groups — PLAN-ROADMAP
// Phase 6. Pie-chart nodes, convex hulls per cluster/annotation, and STRING
// functional enrichment of the selected nodes (results can annotate nodes).

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
import {
  groupColor,
  resetAnnotationOverlays,
  setHullSource,
  setHullStyle,
  showAnnotationPies,
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

export const ANNOTATIONS_HTML = `
<details id="annotation_card" class="lp-section lp-more" open>
  <summary>Annotations &amp; Enrichment</summary>
  <div class="mt-2">
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
      <label class="form-label small m-0" for="annotationSet">Annotation set</label>
      <select id="annotationSet" class="form-select form-select-sm" style="width:auto" aria-label="Annotation set"><option value="-1">(none)</option></select>
      <button type="button" id="annotationSetRename" class="btn btn-outline-secondary btn-sm" title="Rename the annotation set shown" disabled>Rename</button>
      <button type="button" id="annotationSetDelete" class="btn btn-outline-secondary btn-sm" title="Delete the annotation set shown" disabled>Delete</button>
      <span class="form-text m-0">every attribute or group file, enrichment or cluster run is kept; switch between them</span>
    </div>
    <div class="form-check mb-2">
      <input class="form-check-input" type="checkbox" id="showPies" />
      <label class="form-check-label" for="showPies">Show Annotations as Pie Charts</label>
    </div>
    <div id="annotationsNote" class="form-text mb-2 d-none">No annotations in this network: upload a node attributes or group file (File), or annotate nodes from an enrichment below. The annotation options are off until then.</div>
    <label class="form-label">Hulls Around:</label>
    <div class="mb-3">
      ${(
        [
          ['none', 'Nothing'],
          ['cluster', 'Clusters'],
          ['annotation', 'Annotations'],
        ] as const
      )
        .map(
          ([v, l]) => `
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="radio" name="hullSource" id="hull_${v}" value="${v}" ${v === 'none' ? 'checked' : ''} />
        <label class="form-check-label" for="hull_${v}">${l}</label>
      </div>`
        )
        .join('')}
      <div class="mt-1">
        <span class="small me-2">Draw as:</span>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" name="hullStyle" id="hullStyle_hull" value="hull" checked />
          <label class="form-check-label" for="hullStyle_hull">Hull</label>
        </div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" name="hullStyle" id="hullStyle_fog" value="fog" />
          <label class="form-check-label" for="hullStyle_fog">Fog cloud</label>
        </div>
      </div>
    </div>
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
  document.getElementById('runEnrichment')?.addEventListener('click', () => {
    void onRunEnrichment()
  })
  document
    .getElementById('annotateTopTerms')
    ?.addEventListener('click', annotateTopTerms)
  bus.on('network:loaded', () => {
    results = []
    renderResults()
    resetAnnotationOverlays()
  })
}
