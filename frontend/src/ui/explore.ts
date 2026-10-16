import { ctx } from '../three'
// "Explore" card of the Analysis panel — PLAN-ROADMAP Phase 7.

import {
  expandSelection,
  selectByAttribute,
  selectPathBetweenSelected,
  type WalkMode,
} from '../actions/explore'

export const EXPLORE_HTML = `
<details id="explore_card" class="mb-3">
  <summary class="form-label">Explore</summary>
  <div class="mt-2">
    <div class="mb-2">
      <div class="form-check form-check-inline" data-multilayer-only>
        <input class="form-check-input" type="radio" name="walkMode" id="walk_within" value="within" checked />
        <label class="form-check-label" for="walk_within">Within layers</label>
      </div>
      <div class="form-check form-check-inline" data-multilayer-only>
        <input class="form-check-input" type="radio" name="walkMode" id="walk_across" value="across" />
        <label class="form-check-label" for="walk_across">Across layers</label>
      </div>
    </div>
    <div class="d-flex flex-wrap gap-2 mb-2">
      <button id="expand1" class="btn btn-outline-primary btn-sm">Expand Selection 1 Hop</button>
      <button id="expand2" class="btn btn-outline-primary btn-sm">2 Hops</button>
      <button id="shortestPath" class="btn btn-outline-primary btn-sm" title="Select exactly two nodes first">Shortest Path Between 2 Selected</button>
    </div>
    <div class="d-flex gap-2 mb-2">
      <input id="attributeSearch" class="form-control form-control-sm" placeholder="Description / annotation / URL contains…" />
      <button id="attributeSearchButton" class="btn btn-outline-primary btn-sm text-nowrap">Select</button>
    </div>
    <div id="explore_status" class="small"></div>
  </div>
</details>
`

function status(msg: string, isError = false): void {
  const el = document.getElementById('explore_status')
  if (!el) return
  el.textContent = msg
  el.className = `small ${isError ? 'text-danger' : 'text-success'}`
}

const mode = () =>
  ctx.networkMode === 'single'
    ? 'across'
    : ((document.querySelector<HTMLInputElement>(
        'input[name="walkMode"]:checked'
      )?.value ?? 'within') as WalkMode)

export function initExplore(): void {
  for (const hops of [1, 2])
    document.getElementById(`expand${hops}`)?.addEventListener('click', () => {
      const added = expandSelection(hops, mode())
      status(`Added ${added} node${added === 1 ? '' : 's'} to the selection.`)
    })
  document.getElementById('shortestPath')?.addEventListener('click', () => {
    try {
      const path = selectPathBetweenSelected(mode())
      status(
        path
          ? `Path of ${path.length - 1} step${path.length === 2 ? '' : 's'} selected.`
          : 'No path between the two nodes in this mode.',
        !path
      )
    } catch (err) {
      status(err instanceof Error ? err.message : String(err), true)
    }
  })
  const search = () => {
    const text = (
      document.getElementById('attributeSearch') as HTMLInputElement
    ).value
    const n = selectByAttribute(text)
    status(`Selected ${n} matching node${n === 1 ? '' : 's'}.`, n === 0)
  }
  document
    .getElementById('attributeSearchButton')
    ?.addEventListener('click', search)
  document
    .getElementById('attributeSearch')
    ?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') search()
    })
}
