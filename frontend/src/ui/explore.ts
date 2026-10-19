import { ctx } from '../three'
// Analyze → Explore — PLAN-ROADMAP Phase 7, with the
// whole-selection tools and the live highlight of paths between selected nodes.

import { bus } from '../bus'
import { registerSelectionAction } from '../actions/right_click_menu'
import { showStyleSection } from './style'
import { showTab } from './tabs'
import {
  MAX_PATH_ENDS,
  clearPathHighlight,
  clearSelection,
  expandSelection,
  forgetPathHighlight,
  highlightPathsBetweenSelected,
  invertSelection,
  selectAll,
  selectByAttribute,
  selectByLinks,
  selectComponents,
  selectNodesOfSelectedLayers,
  selectPathBetweenSelected,
  type WalkMode,
} from '../actions/explore'

export const EXPLORE_HTML = `
<details id="explore_card" class="lp-section lp-more" open>
  <summary>Explore</summary>
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
    <div class="d-flex flex-wrap gap-2 mb-2" role="group" aria-label="Whole selection">
      <button id="selectEverything" class="btn btn-outline-primary btn-sm">Select All</button>
      <button id="invertSelection" class="btn btn-outline-primary btn-sm">Invert</button>
      <button id="clearSelection" class="btn btn-outline-primary btn-sm" title="Unselect every node and edge">Clear</button>
      <button id="selectComponent" class="btn btn-outline-primary btn-sm" title="Every node connected to the selected nodes, within or across layers">Connected Component</button>
      <button id="selectLayerNodes" class="btn btn-outline-primary btn-sm" data-multilayer-only title="Every node on the selected layers (double-click a floor to select it)">Nodes of Selected Layers</button>
    </div>
    <div class="d-flex align-items-center flex-wrap gap-2 mb-2">
      <label for="minLinks" class="small text-nowrap">Nodes with at least</label>
      <input id="minLinks" type="number" min="1" step="1" value="5" class="form-control form-control-sm" style="width:4.5rem" />
      <span class="small">links</span>
      <button id="selectHubs" class="btn btn-outline-primary btn-sm" title="Select the hubs: within layers counts each node's links in its own layer, across layers also its inter-layer links">Select</button>
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
    <hr class="my-2" />
    <div class="form-check form-switch">
      <input class="form-check-input" type="checkbox" role="switch" id="highlightPaths" />
      <label class="form-check-label" for="highlightPaths">Highlight paths between selected nodes</label>
    </div>
    <div class="form-check ms-3">
      <input class="form-check-input" type="checkbox" id="pathNodes" disabled />
      <label class="form-check-label" for="pathNodes">Also select the nodes along the paths</label>
    </div>
    <div id="path_status" class="small text-muted" aria-live="polite"></div>
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const checked = (id: string) =>
  (document.getElementById(id) as HTMLInputElement | null)?.checked ?? false

// The shortest paths joining every pair of selected nodes, kept up to date as
// the selection or the walk mode changes (its own changes don't re-trigger it)
let updatingPaths = false
function updatePaths(): void {
  const out = document.getElementById('path_status')
  if (updatingPaths) return
  updatingPaths = true
  try {
    if (!checked('highlightPaths')) {
      clearPathHighlight()
      if (out) out.textContent = ''
      return
    }
    const r = highlightPathsBetweenSelected(mode(), checked('pathNodes'))
    if (!out) return
    out.className = `small ${r.ends > 1 && !r.joined ? 'text-danger' : 'text-muted'}`
    out.textContent =
      r.ends < 2
        ? `Select two or more nodes (up to ${MAX_PATH_ENDS}).`
        : `${r.joined} of ${plural(r.pairs, 'pair')} joined: ${plural(r.edges, 'link')} highlighted` +
          (r.nodes
            ? `, ${plural(r.nodes, 'node')} along the paths selected.`
            : '.')
  } catch (err) {
    if (out) {
      out.className = 'small text-danger'
      out.textContent = err instanceof Error ? err.message : String(err)
    }
  } finally {
    updatingPaths = false
  }
}

// The right-click menu's "Selected nodes" group: Explore's walks and paths,
// Style for the selection, invert and clear
function registerMenuActions(): void {
  const say = (msg: string) => status(msg)
  registerSelectionAction({
    label: 'Expand Selection by 1 Hop',
    order: 10,
    run: () => {
      const n = expandSelection(1, mode())
      say(`Added ${plural(n, 'node')} to the selection.`)
    },
  })
  registerSelectionAction({
    label: 'Select Connected Component',
    order: 11,
    run: () =>
      say(
        `Added ${plural(selectComponents(mode()), 'connected node')} to the selection.`
      ),
  })
  registerSelectionAction({
    label: 'Select Shortest Path Between the 2',
    order: 12,
    when: (sel) => sel.length === 2,
    run: () => {
      const path = selectPathBetweenSelected(mode())
      say(
        path
          ? `Path of ${plural(path.length - 1, 'step')} selected.`
          : 'No path between the two nodes in this mode.'
      )
    },
  })
  const highlight = () =>
    document.getElementById('highlightPaths') as HTMLInputElement | null
  registerSelectionAction({
    label: () =>
      highlight()?.checked
        ? 'Stop Highlighting Paths'
        : 'Highlight Paths Between Selected',
    order: 13,
    when: (sel) =>
      !!highlight() &&
      (highlight()!.checked || (sel.length > 1 && sel.length <= MAX_PATH_ENDS)),
    run: () => {
      const box = highlight()!
      box.checked = !box.checked
      box.dispatchEvent(new Event('change'))
    },
  })
  registerSelectionAction({
    label: 'Style Selected Nodes…',
    order: 70,
    run: () => {
      showTab('#panel-style')
      showStyleSection('nodes')
      const target = document.getElementById(
        'styleNodeTarget'
      ) as HTMLSelectElement | null
      if (!target) return
      target.value = 'selected'
      target.dispatchEvent(new Event('change'))
    },
  })
  registerSelectionAction({
    label: 'Invert Selection',
    order: 80,
    run: () =>
      say(`Selection inverted: ${plural(invertSelection(), 'node')} selected.`),
  })
  registerSelectionAction({
    label: 'Clear Selection',
    order: 90,
    run: () => {
      clearSelection()
      say('Nothing selected.')
    },
  })
}

export function initExplore(): void {
  registerMenuActions()
  const on = (id: string, run: () => void) =>
    document.getElementById(id)?.addEventListener('click', () => {
      try {
        run()
      } catch (err) {
        status(err instanceof Error ? err.message : String(err), true)
      }
    })
  on('selectEverything', () => {
    selectAll()
    status(`Selected all ${plural(ctx.nodeObjects.length, 'node')}.`)
  })
  on('invertSelection', () =>
    status(`Selection inverted: ${plural(invertSelection(), 'node')} selected.`)
  )
  on('clearSelection', () => {
    clearSelection()
    status('Nothing selected.')
  })
  on('selectComponent', () =>
    status(
      `Added ${plural(selectComponents(mode()), 'connected node')} to the selection.`
    )
  )
  on('selectLayerNodes', () =>
    status(
      `Added ${plural(selectNodesOfSelectedLayers(), 'node')} of the selected layers.`
    )
  )
  const hubs = () => {
    const min = Math.max(
      1,
      Math.round(
        Number((document.getElementById('minLinks') as HTMLInputElement).value)
      ) || 1
    )
    const n = selectByLinks(min, mode())
    status(`${plural(n, 'node')} with at least ${plural(min, 'link')}.`, !n)
  }
  on('selectHubs', hubs)
  document.getElementById('minLinks')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') hubs()
  })

  const pathNodes = document.getElementById('pathNodes') as HTMLInputElement
  document.getElementById('highlightPaths')?.addEventListener('change', () => {
    if (pathNodes) pathNodes.disabled = !checked('highlightPaths')
    updatePaths()
  })
  pathNodes?.addEventListener('change', updatePaths)
  for (const r of document.querySelectorAll('input[name="walkMode"]'))
    r.addEventListener('change', updatePaths)
  bus.on('selection:changed', updatePaths)
  bus.on('mode:changed', updatePaths)
  // a new network or workspace: the old highlight's objects are gone
  for (const event of ['network:loaded', 'workspace:changed'] as const)
    bus.on(event, () => {
      forgetPathHighlight()
      updatePaths()
    })

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
