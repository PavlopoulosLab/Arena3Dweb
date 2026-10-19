// "Groups" card of Analyze → Annotations & Groups — NORMA's group list: every annotation
// term or cluster with its colour, members per layer, a hull switch and a
// select button; tables of groups and their overlap; the super-node view.

import { bus } from '../bus'
import { ctx } from '../three'
import { escapeHtml } from '../utils'
import { setGroupColor, setGroupHidden } from '../actions/annotations'
import {
  collapseToSuperNodes,
  colorGroup,
  groupOverlap,
  listGroups,
  selectGroup,
  type GroupInfo,
  type GroupSource,
  groupStats,
} from '../actions/groups'
import { setLegend, type Legend } from '../actions/legend'
import {
  renderGroupOverlapTable,
  renderGroupStatsTable,
  renderGroupsTable,
} from './data'
import { showTab } from './tabs'

const MAX_ROWS = 300

export const GROUPS_HTML = `
<details id="groups_card" class="lp-section lp-more" open>
  <summary>Groups (annotations &amp; clusters)</summary>
  <div class="mt-2">
    <div class="d-flex gap-2 mb-2">
      <select id="groupsSource" class="form-select form-select-sm" style="width:auto" aria-label="Group source">
        <option value="annotation">Annotations</option>
        <option value="cluster">Clusters</option>
      </select>
      <input id="groupsFilter" class="form-control form-control-sm" placeholder="Filter groups" aria-label="Filter groups" />
    </div>
    <div id="groupsEmpty" class="form-text">No groups yet — upload a group or attribute file, run an enrichment, or cluster a layout.</div>
    <div id="groupsList" class="groups-list"></div>
    <div class="d-flex flex-wrap gap-2 mt-2">
      <button id="groupsLegend" class="btn btn-outline-primary btn-sm" title="Show these groups in the legend">Legend</button>
      <button id="groupsTable" class="btn btn-outline-primary btn-sm">Groups Table</button>
      <button id="groupsOverlap" class="btn btn-outline-primary btn-sm" title="Jaccard overlap of every pair of groups">Overlap Table</button>
      <button id="groupsStats" class="btn btn-outline-primary btn-sm" title="Nodes, edges inside, density, mean degree and share per group, as NORMA reports">Group Stats</button>
      <button id="groupsCollapse" class="btn btn-outline-primary btn-sm" title="One node per group and layer, sized by its members; undo restores the network">Collapse into Super Nodes</button>
    </div>
    <div id="groups_status" class="small mt-2"></div>
  </div>
</details>
`

function status(msg: string, isError = false): void {
  const el = document.getElementById('groups_status')
  if (!el) return
  el.textContent = msg
  el.className = `small mt-2 ${isError ? 'text-danger' : 'text-success'}`
}

const source = () =>
  (document.getElementById('groupsSource') as HTMLSelectElement)
    .value as GroupSource

export function groupsLegend(src: GroupSource): Legend | null {
  const groups = listGroups(src)
  return groups.length
    ? {
        title: src === 'cluster' ? 'Clusters' : 'Annotations',
        entries: groups.map((g) => ({
          label: g.name,
          color: g.color,
          count: g.members.length,
          select: src,
        })),
      }
    : null
}

function perLayer(g: GroupInfo): string {
  return Object.entries(g.perLayer)
    .map(([l, n]) => `${l} ${n}`)
    .join(' · ')
}

export function renderGroups(): void {
  const list = document.getElementById('groupsList')
  const empty = document.getElementById('groupsEmpty')
  if (!list || !empty) return
  const filter = (
    document.getElementById('groupsFilter') as HTMLInputElement
  ).value
    .trim()
    .toLowerCase()
  const src = source()
  const groups = listGroups(src).filter(
    (g) => !filter || g.name.toLowerCase().includes(filter)
  )
  empty.classList.toggle('d-none', groups.length > 0)
  list.innerHTML =
    groups
      .slice(0, MAX_ROWS)
      .map(
        (g) => `
    <div class="group-row" data-group="${escapeHtml(g.name)}">
      <input type="color" class="group-color" value="${escapeHtml(g.color)}" title="Colour of ${escapeHtml(g.name)}" aria-label="Colour of ${escapeHtml(g.name)}" />
      <span class="group-name" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</span>
      <span class="group-count" title="${escapeHtml(perLayer(g))}">${g.members.length}</span>
      <label class="group-hull" title="Draw this group's hull / fog cloud"><input type="checkbox" ${g.hidden ? '' : 'checked'} /> hull</label>
      <button type="button" class="btn btn-link btn-sm p-0 group-select">select</button>
    </div>`
      )
      .join('') +
    (groups.length > MAX_ROWS
      ? `<div class="form-text">… and ${groups.length - MAX_ROWS} more — use the filter.</div>`
      : '')
  list.querySelectorAll<HTMLElement>('.group-row').forEach((row) => {
    const name = row.dataset.group!
    row
      .querySelector<HTMLInputElement>('.group-color')
      ?.addEventListener('change', (e) => {
        const color = (e.target as HTMLInputElement).value
        colorGroup(name, src, color)
        if (src === 'annotation') setGroupColor(name, color)
        status(`${name} recoloured.`)
      })
    row
      .querySelector<HTMLInputElement>('.group-hull input')
      ?.addEventListener('change', (e) =>
        setGroupHidden(name, !(e.target as HTMLInputElement).checked)
      )
    row.querySelector('.group-select')?.addEventListener('click', () => {
      status(`${selectGroup(name, src)} nodes of ${name} selected.`)
    })
  })
}

export function initGroups(): void {
  document
    .getElementById('groupsSource')
    ?.addEventListener('change', renderGroups)
  document
    .getElementById('groupsFilter')
    ?.addEventListener('input', renderGroups)
  document
    .getElementById('groups_card')
    ?.addEventListener('toggle', renderGroups)
  document.getElementById('groupsLegend')?.addEventListener('click', () => {
    const legend = groupsLegend(source())
    setLegend(legend)
    status(
      legend ? 'Groups shown in the legend.' : 'No groups to show.',
      !legend
    )
  })
  document.getElementById('groupsTable')?.addEventListener('click', () => {
    const groups = listGroups(source())
    if (!groups.length) return status('No groups yet.', true)
    renderGroupsTable(
      groups.map((g) => ({
        name: g.name,
        color: g.color,
        total: g.members.length,
        perLayer: g.perLayer,
        members: g.members.map((i) => ctx.nodeObjects[i].nodeLayerName),
      })),
      ctx.layers.map((l) => l.name)
    )
    showTab('#panel-data')
  })
  document.getElementById('groupsStats')?.addEventListener('click', () => {
    const rows = groupStats(source())
    if (rows.length === 0) return status('No groups to report on.', true)
    renderGroupStatsTable(rows)
    status(
      `Statistics of ${rows.length} groups are in Data Tables → Group Statistics.`
    )
  })
  document.getElementById('groupsOverlap')?.addEventListener('click', () => {
    const { names, jaccard, members, colors } = groupOverlap(source())
    if (names.length < 2) return status('Two or more groups are needed.', true)
    renderGroupOverlapTable(names, jaccard, members, colors)
    showTab('#panel-data')
  })
  document.getElementById('groupsCollapse')?.addEventListener('click', () => {
    try {
      const n = collapseToSuperNodes(source())
      status(`${n} super nodes; undo restores the network.`)
      showTab('#panel-main-view')
    } catch (err) {
      status(err instanceof Error ? err.message : String(err), true)
    }
  })
  bus.on('groups:changed', renderGroups)
  bus.on('clustering:applied', renderGroups)
  bus.on('network:loaded', renderGroups)
}
