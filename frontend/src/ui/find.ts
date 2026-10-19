// Find panel (top menu): search nodes and edges by name — exact, contains,
// starts/ends with or a regular expression — select the matches, list them
// and fly the camera to them. The node search moved here from Edit → Nodes.

import { ctx } from '../three'
import { escapeHtml } from '../utils'
import {
  findEdges,
  findNodes,
  focusOnNodes,
  selectEdges,
  selectNodes,
  type EdgeField,
  type SearchMode,
} from '../actions/search'

const MODES = `
        <option value="exact">Exact</option>
        <option value="contains">Contains</option>
        <option value="prefix">Starts with</option>
        <option value="suffix">Ends with</option>
        <option value="regex">Regular expression</option>`

const FIND_HTML = `
<div class="col-md-8 col-lg-6 layout-panel find-panel">
  <details class="lp-section lp-more" id="findCard_nodes" open>
    <summary>Nodes</summary>
    <textarea class="form-control mb-2" id="nodeSearchBar" rows="2"
      placeholder="Names (comma-separated) or a regular expression, then Enter" aria-label="Node names"></textarea>
    <div class="d-flex flex-wrap align-items-center gap-2">
      <select id="nodeSearchMode" class="form-select form-select-sm" style="width:auto" aria-label="Search mode">${MODES}
      </select>
      <div class="form-check form-check-inline m-0">
        <input class="form-check-input" type="checkbox" id="nodeSearchCase" />
        <label class="form-check-label" for="nodeSearchCase">Case-sensitive</label>
      </div>
      <div class="form-check form-check-inline m-0">
        <input class="form-check-input" type="checkbox" id="nodeSearchFocus" checked />
        <label class="form-check-label" for="nodeSearchFocus">Focus camera</label>
      </div>
      <button id="nodeSearchButton" class="btn btn-primary btn-sm">Search</button>
    </div>
    <div class="form-text">Matches replace the selection; click a listed node to focus on it alone.</div>
    <div id="nodeSearchStatus" class="small mt-1"></div>
    <div id="nodeSearchResults" class="search-results mt-1" style="max-height: 12rem; overflow: auto"></div>
  </details>

  <details class="lp-section lp-more" id="findCard_edges" open>
    <summary>Edges</summary>
    <textarea class="form-control mb-2" id="edgeSearchBar" rows="2"
      placeholder="Node names (comma-separated) or a regular expression, then Enter" aria-label="Edge end names"></textarea>
    <div class="d-flex flex-wrap align-items-center gap-2">
      <select id="edgeSearchField" class="form-select form-select-sm" style="width:auto" aria-label="What to match">
        <option value="any">Either end</option>
        <option value="source">Source</option>
        <option value="target">Target</option>
        <option value="both">Both ends</option>
        <option value="channel">Channel</option>
      </select>
      <select id="edgeSearchMode" class="form-select form-select-sm" style="width:auto" aria-label="Search mode">${MODES}
      </select>
      <div class="form-check form-check-inline m-0">
        <input class="form-check-input" type="checkbox" id="edgeSearchCase" />
        <label class="form-check-label" for="edgeSearchCase">Case-sensitive</label>
      </div>
      <div class="form-check form-check-inline m-0">
        <input class="form-check-input" type="checkbox" id="edgeSearchFocus" checked />
        <label class="form-check-label" for="edgeSearchFocus">Focus camera</label>
      </div>
      <button id="edgeSearchButton" class="btn btn-primary btn-sm">Search</button>
    </div>
    <div class="form-text">Matches are selected (Analyze → Data Tables → Selected Edges lists them with their weights); click one to focus on its two nodes.</div>
    <div id="edgeSearchStatus" class="small mt-1"></div>
    <div id="edgeSearchResults" class="search-results mt-1" style="max-height: 12rem; overflow: auto"></div>
  </details>
</div>
`

const say = (el: HTMLElement, msg: string, isError = false) => {
  el.textContent = msg
  el.className = `small mt-1 ${isError ? 'text-danger' : 'text-success'}`
}
const count = (n: number, what: string) =>
  n
    ? `${n} ${what}${n === 1 ? '' : what === 'match' ? 'es' : 's'}.`
    : 'No matches.'
const onEnter = (el: HTMLElement, run: () => void) =>
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault() // bypass the newline
      run()
    }
  })

// Node search: select matches (replacing the selection), list them, focus
// the camera on them; click a result to focus on that node alone.
function initNodeSearch(): void {
  const bar = document.getElementById('nodeSearchBar') as HTMLTextAreaElement
  const statusEl = document.getElementById('nodeSearchStatus')!
  const list = document.getElementById('nodeSearchResults')!
  const run = () => {
    const mode = (
      document.getElementById('nodeSearchMode') as HTMLSelectElement
    ).value as SearchMode
    const caseSensitive = (
      document.getElementById('nodeSearchCase') as HTMLInputElement
    ).checked
    let hits: number[]
    try {
      hits = findNodes(bar.value.replace(/\n/g, ''), mode, caseSensitive)
    } catch (err) {
      list.innerHTML = ''
      return say(
        statusEl,
        err instanceof Error ? err.message : String(err),
        true
      )
    }
    selectNodes(hits, true)
    say(statusEl, count(hits.length, 'match'), !hits.length)
    list.innerHTML = hits
      .slice(0, 200)
      .map(
        (i) =>
          `<button type="button" class="btn btn-link btn-sm p-0 me-2" data-node="${i}">${escapeHtml(ctx.nodeObjects[i].name)} <small class="text-secondary">${escapeHtml(ctx.nodeObjects[i].layer)}</small></button>`
      )
      .join('')
    list
      .querySelectorAll<HTMLButtonElement>('[data-node]')
      .forEach((b) =>
        b.addEventListener('click', () =>
          focusOnNodes([Number(b.dataset.node)])
        )
      )
    if (
      hits.length &&
      (document.getElementById('nodeSearchFocus') as HTMLInputElement).checked
    )
      focusOnNodes(hits)
  }
  onEnter(bar, run)
  document.getElementById('nodeSearchButton')?.addEventListener('click', run)
}

// Edge search: the same modes on the end names (or the channel); matches are
// selected and listed as "A — B"; click one to focus on its two nodes.
function initEdgeSearch(): void {
  const bar = document.getElementById('edgeSearchBar') as HTMLTextAreaElement
  const statusEl = document.getElementById('edgeSearchStatus')!
  const list = document.getElementById('edgeSearchResults')!
  const run = () => {
    const field = (
      document.getElementById('edgeSearchField') as HTMLSelectElement
    ).value as EdgeField
    const mode = (
      document.getElementById('edgeSearchMode') as HTMLSelectElement
    ).value as SearchMode
    const caseSensitive = (
      document.getElementById('edgeSearchCase') as HTMLInputElement
    ).checked
    let hits: number[]
    try {
      hits = findEdges(bar.value.replace(/\n/g, ''), field, mode, caseSensitive)
    } catch (err) {
      list.innerHTML = ''
      return say(
        statusEl,
        err instanceof Error ? err.message : String(err),
        true
      )
    }
    selectEdges(hits, true)
    say(statusEl, count(hits.length, 'match'), !hits.length)
    const ends = (i: number) => {
      const e = ctx.edgeObjects[i]
      return [e.sourceNodeIndex, e.targetNodeIndex]
    }
    list.innerHTML = hits
      .slice(0, 200)
      .map((i) => {
        const e = ctx.edgeObjects[i]
        const [s, t] = ends(i)
        const ls = ctx.layers[e.sourceLayerIndex]?.name ?? ''
        const lt = ctx.layers[e.targetLayerIndex]?.name ?? ''
        const where = ls === lt ? ls : `${ls} → ${lt}`
        const channel = e.channels.length ? ` · ${e.channels.join(', ')}` : ''
        return `<button type="button" class="btn btn-link btn-sm p-0 me-2" data-edge="${i}">${escapeHtml(ctx.nodeObjects[s]?.name ?? '')} — ${escapeHtml(ctx.nodeObjects[t]?.name ?? '')} <small class="text-secondary">${escapeHtml(where + channel)}</small></button>`
      })
      .join('')
    list
      .querySelectorAll<HTMLButtonElement>('[data-edge]')
      .forEach((b) =>
        b.addEventListener('click', () =>
          focusOnNodes(ends(Number(b.dataset.edge)))
        )
      )
    if (
      hits.length &&
      (document.getElementById('edgeSearchFocus') as HTMLInputElement).checked
    )
      focusOnNodes([...new Set(hits.flatMap(ends))])
  }
  onEnter(bar, run)
  document.getElementById('edgeSearchButton')?.addEventListener('click', run)
}

export function initFindPanel(): void {
  const pane = document.getElementById('panel-find')
  if (!pane) return
  pane.innerHTML = FIND_HTML
  initNodeSearch()
  initEdgeSearch()
}
