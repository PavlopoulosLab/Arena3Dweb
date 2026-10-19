// Clustering panel (top bar → Clustering, next to Layout): communities without a
// layout (POST /api/clustering) — Louvain, Walktrap, Fast Greedy, Label
// Propagation or Leiden, within each layer, over the selected layers as one
// graph, or shared across layers by node name (multiplex Leiden). The
// communities colour the nodes, fill Data Tables → Clustering Data, and can
// be saved as an annotation set. Layouts only use them: the Layout panel's
// Group Layout card lays clusters or annotation sets out; it no longer runs
// clustering algorithms itself.

import { store } from '../store'
import { api } from '../api/client'
import { history } from '../commands/base'
import {
  ApplyClustersCommand,
  ClustersAsAnnotationsCommand,
} from '../commands/scene'
import { registerAnnotationSet } from '../actions/workspace'
import { startLoader, finishLoader } from '../actions/screen'
import { bus } from '../bus'
import { ctx } from '../three'
import { escapeHtml, safeColor } from '../utils'
import { PROGRESS_HTML, ProgressBar } from './progress'
import { selectedChannels } from './layouts'
import { showTab } from './tabs'
import { FOLD_ALL_HTML } from './sections'
import { openAnnotationPanel } from './annotation_panel'
import {
  isGroupHidden,
  setGroupHidden,
  setGroupsHidden,
} from '../actions/annotations'

type ClusterScope = 'perLayer' | 'allLayers' | 'coupled'

const ALGORITHMS = [
  'Louvain',
  'Walktrap',
  'Fast Greedy',
  'Label Propagation',
  'Leiden', // multiplex Leiden when shared across layers by node name
]
const SCOPE_WORDS: Record<ClusterScope, string> = {
  perLayer: 'within each layer',
  allLayers: 'one graph',
  coupled: 'shared across layers',
}
const LISTED = 12 // communities listed in the summary, largest first

const HTML = `
<div class="col-md-8 col-lg-6 layout-panel clustering-panel">
  ${FOLD_ALL_HTML}
  <details class="lp-section lp-more" id="clusterCard_run">
    <summary>Clustering</summary>
    <div class="lp-grid mb-2">
      <div>
        <label class="form-label small" for="clusterAlgorithm">Algorithm</label>
        <select id="clusterAlgorithm" class="form-select form-select-sm">${ALGORITHMS.map((a) => `<option value="${a}">${a}</option>`).join('')}</select>
      </div>
      <div data-multilayer-only>
        <label class="form-label small" for="clusterScope">Communities</label>
        <select id="clusterScope" class="form-select form-select-sm">
          <option value="perLayer">Within each layer</option>
          <option value="allLayers">Over the selected layers as one graph</option>
          <option value="coupled">Shared across layers by node name</option>
        </select>
      </div>
    </div>
    <div class="form-text mt-0 mb-2" data-single-only>Runs on the whole network, as one graph.</div>
    <div class="d-flex flex-wrap align-items-center gap-2">
      <button id="runClustering" class="btn btn-primary btn-sm">Find Communities</button>
      <button id="clustersToAnnotations" class="btn btn-outline-primary btn-sm" disabled>Save as Annotation Set</button>
    </div>
    ${PROGRESS_HTML('clusterProgress', 'Clustering progress')}
    <div id="cluster_status" class="small mt-2"></div>
    <details class="lp-more lp-sub mt-2" id="clusterSub_about">
      <summary>How it works<span class="lp-hint">layers used, and where communities go</span></summary>
      <div class="form-text mt-0 mb-2">Finds communities without moving the nodes: they colour the nodes, fill Data Tables → Clustering Data, and can be saved as an annotation set for pies, hulls, fog clouds and the Layout panel's Group Layout card — like an annotation file.</div>
      <div class="form-text mt-0" data-multilayer-only>Runs on the layers ticked in Layer selection (every layer while none is). Leiden shared across layers is multiplex Leiden.</div>
    </details>
  </details>

  <details class="lp-section lp-more" id="clusterCard_communities">
    <summary>Communities</summary>
    <div id="clusterSummary" class="small"></div>
    <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
      <button id="clustersToGroupLayout" class="btn btn-outline-primary btn-sm" disabled title="Layout → Group Layout (NORMA-2.0), with the clusters as groups">Lay Out by Cluster…</button>
      <button id="clustersToHulls" class="btn btn-outline-primary btn-sm" disabled title="View → Annotations: a shape around every cluster, and the cluster list with colours">Draw Around Clusters…</button>
    </div>
  </details>
</div>
`

const progress = new ProgressBar('clusterProgress')
// what the last run was, for the summary heading and the annotation set name
let lastRun: { algorithm: string; scope: ClusterScope } | null = null

const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T

function status(msg: string, isError = false): void {
  const out = el('cluster_status')
  out.textContent = msg
  out.className = `small mt-2 ${isError ? 'text-danger' : 'text-success'}`
}

/** Communities on the nodes now, largest first: id, colour, size, layers. */
export function communities(): {
  id: string
  color: string
  size: number
  layers: number
}[] {
  const byId = new Map<
    string,
    { color: string; size: number; layers: Set<string> }
  >()
  for (const n of ctx.nodeObjects) {
    if (n.cluster === '') continue
    const c = byId.get(n.cluster) ?? {
      color: n.clusterColor,
      size: 0,
      layers: new Set<string>(),
    }
    c.size++
    c.layers.add(n.layer)
    byId.set(n.cluster, c)
  }
  return [...byId]
    .map(([id, c]) => ({
      id,
      color: c.color,
      size: c.size,
      layers: c.layers.size,
    }))
    .sort(
      (a, b) =>
        b.size - a.size ||
        a.id.localeCompare(b.id, undefined, { numeric: true })
    )
}

function renderSummary(): void {
  const list = communities()
  const clustered = list.reduce((s, c) => s + c.size, 0)
  el<HTMLButtonElement>('clustersToAnnotations').disabled = clustered === 0
  el<HTMLButtonElement>('clustersToGroupLayout').disabled = clustered === 0
  el<HTMLButtonElement>('clustersToHulls').disabled = clustered === 0
  const out = el('clusterSummary')
  if (clustered === 0) {
    out.textContent =
      'No communities yet — choose an algorithm and press Find Communities.'
    return
  }
  const total = ctx.nodeObjects.length
  const how = lastRun
    ? ` (${escapeHtml(lastRun.algorithm)}, ${SCOPE_WORDS[lastRun.scope]})`
    : ''
  const sizes = list.map((c) => c.size)
  const head =
    `<div id="clusterCount"><b>${list.length}</b> communit${list.length === 1 ? 'y' : 'ies'}${how}, ` +
    `${clustered} of ${total} nodes; sizes ${sizes[sizes.length - 1]}–${sizes[0]} ` +
    `(median ${sizes[Math.floor(sizes.length / 2)]}).</div>`
  // a tick per community: the scene shows the ticked ones, the rest fade
  const rows = list
    .slice(0, LISTED)
    .map(
      (c) =>
        `<tr><td><input type="checkbox" class="form-check-input cluster-show me-2" data-cluster="${escapeHtml(c.id)}" ${isGroupHidden(`Cluster ${c.id}`) ? '' : 'checked'} aria-label="Show Cluster ${escapeHtml(c.id)}" />` +
        `<span style="display:inline-block;width:0.8em;height:0.8em;border-radius:50%;margin-right:0.4em;vertical-align:-0.05em;background:${escapeHtml(safeColor(c.color))}"></span>Cluster ${escapeHtml(c.id)}</td>` +
        `<td class="text-end">${c.size}</td><td class="text-end">${c.layers}</td></tr>`
    )
    .join('')
  const more =
    list.length > LISTED
      ? `<div class="form-text">… and ${list.length - LISTED} smaller ones — tick them one by one in <a href="#" id="clusterShowMore">View → Annotations → Groups</a>; Data Tables → Clustering Data lists every node.</div>`
      : ''
  const all =
    list.length > 1
      ? `<div class="groups-show mt-2" role="group" aria-label="Show the communities"><span class="form-text m-0">Show:</span>` +
        `<button id="clusterShowAll" type="button" class="btn btn-link btn-sm p-0" title="Show every community">All</button>` +
        `<button id="clusterShowNone" type="button" class="btn btn-link btn-sm p-0" title="Fade every community; then tick the ones to show">None</button></div>`
      : ''
  out.innerHTML =
    head +
    all +
    `<table class="table table-sm mb-1 mt-2"><thead><tr><th>Community</th><th class="text-end">Nodes</th><th class="text-end">Layers</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>${more}`
}

function findCommunities(): void {
  const st = store.get()
  if (!st.network) return status('Upload a network first.', true)
  const single = ctx.networkMode === 'single'
  const layers =
    single || st.selectedLayers.length === 0
      ? st.network.layers
      : st.selectedLayers
  const algorithm = el<HTMLSelectElement>('clusterAlgorithm').value
  const scope: ClusterScope = single
    ? 'allLayers'
    : (el<HTMLSelectElement>('clusterScope').value as ClusterScope)
  status('Finding communities…')
  progress.computing(`Running ${algorithm} on the server`)
  startLoader()
  api
    .clustering({
      nodes: st.network.nodes,
      edges: st.network.edges,
      algorithm,
      scope,
      selected_layers: layers,
      selected_channels: selectedChannels(),
    })
    .then(({ clusters, count }) => {
      lastRun = { algorithm, scope }
      history.execute(new ApplyClustersCommand(clusters))
      progress.done('Communities found')
      status(
        `${count} communities (${algorithm}, ${SCOPE_WORDS[scope]}); nodes coloured by community — Data Tables lists them.`
      )
      renderSummary()
    })
    .catch((err: unknown) => {
      progress.hide()
      status(err instanceof Error ? err.message : String(err), true)
    })
    .finally(finishLoader)
}

export function initClusteringPanel(): void {
  const pane = document.getElementById('panel-clustering')
  if (!pane) return
  pane.innerHTML = HTML
  el('runClustering').addEventListener('click', findCommunities)
  el('clustersToAnnotations').addEventListener('click', () => {
    if (!ctx.nodeObjects.some((n) => n.cluster !== ''))
      return status('Find communities first.', true)
    history.execute(new ClustersAsAnnotationsCommand())
    registerAnnotationSet(
      `${lastRun?.algorithm ?? el<HTMLSelectElement>('clusterAlgorithm').value} clusters`
    )
    status(
      'The clusters are now an annotation set: View → Annotations draws them as pies, hulls, clouds or 3D containers, and the Group Layout card uses them.'
    )
  })
  // Layouts use the clusters: the Group Layout card, with the clusters as groups
  // the scene draws them: a shape around each in View → Annotations
  el('clustersToHulls').addEventListener('click', () =>
    openAnnotationPanel('cluster')
  )
  el('clustersToGroupLayout').addEventListener('click', () => {
    showTab('#panel-layouts')
    const card = document.getElementById(
      'groupLayoutCard'
    ) as HTMLDetailsElement | null
    if (card) card.open = true
    const source = document.getElementById(
      'groupSource'
    ) as HTMLSelectElement | null
    if (source) {
      source.value = 'clusters'
      source.dispatchEvent(new Event('change', { bubbles: true }))
    }
    card?.scrollIntoView({ block: 'nearest' })
  })
  bus.on('network:loaded', () => {
    lastRun = null
    renderSummary()
  })
  bus.on('clustering:applied', renderSummary)
  bus.on('history:changed', renderSummary) // undo / redo, sessions
  // Show: a tick per community, All / None for every one (not only those
  // listed); the scene shows the ticked communities and fades the rest
  const summary = el('clusterSummary')
  summary.addEventListener('change', (e) => {
    const box = e.target as HTMLInputElement
    if (box.matches('.cluster-show'))
      setGroupHidden(`Cluster ${box.dataset.cluster}`, !box.checked, 'cluster')
  })
  summary.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target.id === 'clusterShowAll' || target.id === 'clusterShowNone')
      setGroupsHidden(
        communities().map((c) => `Cluster ${c.id}`),
        target.id === 'clusterShowNone',
        'cluster'
      )
    else if (target.id === 'clusterShowMore') {
      e.preventDefault()
      openAnnotationPanel()
      const list = document.getElementById(
        'groupsSource'
      ) as HTMLSelectElement | null
      if (list && list.value !== 'cluster') {
        list.value = 'cluster'
        list.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
  })
  // switched here or in the Groups card: the ticks follow, in place
  bus.on('groups:shown', () =>
    summary
      .querySelectorAll<HTMLInputElement>('.cluster-show')
      .forEach(
        (box) =>
          (box.checked = !isGroupHidden(`Cluster ${box.dataset.cluster}`))
      )
  )
  renderSummary()
}
