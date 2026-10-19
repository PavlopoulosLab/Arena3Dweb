// The "Groups" and "Legend & reports" cards of View → Annotations — NORMA's
// group list: every annotation term or cluster with its colour, members per
// layer, a switch for its shape and a select button; the legend, tables of
// groups and their overlap, and the super-node view.

import { bus } from '../bus'
import { ctx } from '../three'
import { escapeHtml } from '../utils'
import {
  isGroupHidden,
  setGroupColor,
  setGroupHidden,
  setGroupsHidden,
} from '../actions/annotations'
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

// View → Annotations' last two cards (ui/annotation_panel.ts), then the status
// line every card reports in
export const GROUPS_HTML = `
<details id="groups_card" class="lp-section lp-more">
  <summary>Groups<span class="lp-hint">colour, show or select each one</span></summary>
  <div class="d-flex gap-2 mb-2">
    <select id="groupsSource" class="form-select form-select-sm" style="width:auto" aria-label="Group source">
      <option value="annotation">Annotations</option>
      <option value="cluster">Clusters</option>
    </select>
    <input id="groupsFilter" class="form-control form-control-sm" placeholder="Filter groups" aria-label="Filter groups" />
  </div>
  <div class="groups-bar">
    <span id="groupsCount" class="form-text m-0"></span>
    <span id="groupsShowAllNone" class="groups-show d-none" role="group" aria-label="Show the groups">
      <span class="form-text m-0">Show:</span>
      <button id="groupsShowAll" type="button" class="btn btn-link btn-sm p-0" title="Draw every group in the list (all that match the filter)">All</button>
      <button id="groupsShowNone" type="button" class="btn btn-link btn-sm p-0" title="Draw none of the groups in the list (all that match the filter)">None</button>
    </span>
  </div>
  <div id="groupsEmpty" class="form-text">No groups yet — upload a group or attribute file, run an enrichment, or find communities.</div>
  <div class="groups-head d-none" aria-hidden="true"><span></span><span>Group</span><span>Nodes</span><span>Show</span><span></span></div>
  <div id="groupsList" class="groups-list"></div>
</details>
<details id="annCard_reports" class="lp-section lp-more">
  <summary>Legend &amp; reports<span class="lp-hint">the legend, tables, super nodes</span></summary>
  <div class="d-flex flex-wrap gap-2">
    <button id="groupsLegend" class="btn btn-outline-primary btn-sm" title="Show these groups in the legend">Legend</button>
    <button id="groupsTable" class="btn btn-outline-primary btn-sm" title="Every group with its members per layer, in Data Tables">Groups Table</button>
    <button id="groupsOverlap" class="btn btn-outline-primary btn-sm" title="Jaccard overlap of every pair of groups, with an UpSet plot, in Data Tables">Overlap Table</button>
    <button id="groupsStats" class="btn btn-outline-primary btn-sm" title="Nodes, edges inside, density, mean degree and share per group, as NORMA reports">Group Stats</button>
  </div>
  <div class="form-text mt-1 mb-0">The groups of the Groups card's list (annotations or clusters).</div>
  <div class="ann-action">
    <div class="form-label small mb-1">Simplify the network</div>
    <div class="form-text mt-0 mb-2">One node per group and layer, sized by its members and coloured like the group; Undo restores the network.</div>
    <button id="groupsCollapse" class="btn btn-outline-warning btn-sm">Collapse into Super Nodes</button>
  </div>
</details>
<div id="groups_status" class="small mt-2"></div>
`

/** The status line under View → Annotations' cards. */
export function groupsStatus(msg: string, isError = false): void {
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
  document
    .querySelector('#groups_card .groups-head')
    ?.classList.toggle('d-none', groups.length === 0)
  document
    .getElementById('groupsShowAllNone')
    ?.classList.toggle('d-none', groups.length < 2)
  const all = filter ? listGroups(src).length : groups.length
  const counted = document.getElementById('groupsCount')
  if (counted)
    counted.textContent = !all
      ? ''
      : filter
        ? `${groups.length} of ${all} groups`
        : `${all} group${all === 1 ? '' : 's'}`
  list.innerHTML =
    groups
      .slice(0, MAX_ROWS)
      .map(
        (g) => `
    <div class="group-row" data-group="${escapeHtml(g.name)}">
      <input type="color" class="group-color" value="${escapeHtml(g.color)}" title="Colour of ${escapeHtml(g.name)}" aria-label="Colour of ${escapeHtml(g.name)}" />
      <span class="group-name" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</span>
      <span class="group-count" title="${escapeHtml(perLayer(g))}">${g.members.length}</span>
      <label class="group-hull" title="Draw the shape around this group (Draw as)"><input type="checkbox" ${g.hidden ? '' : 'checked'} aria-label="Show ${escapeHtml(g.name)}" /></label>
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
        groupsStatus(`${name} recoloured.`)
      })
    row
      .querySelector<HTMLInputElement>('.group-hull input')
      ?.addEventListener('change', (e) =>
        setGroupHidden(name, !(e.target as HTMLInputElement).checked, src)
      )
    row.querySelector('.group-select')?.addEventListener('click', () => {
      groupsStatus(`${selectGroup(name, src)} nodes of ${name} selected.`)
    })
  })
}

// Show: All / None — every group matching the filter, not only the rows
// listed, as one redraw
function showAllGroups(show: boolean): void {
  const filter = (
    document.getElementById('groupsFilter') as HTMLInputElement
  ).value
    .trim()
    .toLowerCase()
  const names = listGroups(source())
    .filter((g) => !filter || g.name.toLowerCase().includes(filter))
    .map((g) => g.name)
  setGroupsHidden(names, !show, source())
  renderGroups()
  groupsStatus(
    `${show ? 'Showing' : 'Hiding'} ${names.length} group${names.length === 1 ? '' : 's'}.`
  )
}

export function initGroups(): void {
  document
    .getElementById('groupsShowAll')
    ?.addEventListener('click', () => showAllGroups(true))
  document
    .getElementById('groupsShowNone')
    ?.addEventListener('click', () => showAllGroups(false))
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
    groupsStatus(
      legend ? 'Groups shown in the legend.' : 'No groups to show.',
      !legend
    )
  })
  document.getElementById('groupsTable')?.addEventListener('click', () => {
    const groups = listGroups(source())
    if (!groups.length) return groupsStatus('No groups yet.', true)
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
    if (rows.length === 0) return groupsStatus('No groups to report on.', true)
    renderGroupStatsTable(rows)
    groupsStatus(
      `Statistics of ${rows.length} groups are in Data Tables → Group Statistics.`
    )
  })
  document.getElementById('groupsOverlap')?.addEventListener('click', () => {
    const { names, jaccard, members, colors } = groupOverlap(source())
    if (names.length < 2)
      return groupsStatus('Two or more groups are needed.', true)
    renderGroupOverlapTable(names, jaccard, members, colors)
    showTab('#panel-data')
  })
  document.getElementById('groupsCollapse')?.addEventListener('click', () => {
    try {
      const n = collapseToSuperNodes(source())
      groupsStatus(`${n} super nodes; undo restores the network.`)
      showTab('#panel-main-view')
    } catch (err) {
      groupsStatus(err instanceof Error ? err.message : String(err), true)
    }
  })
  bus.on('groups:changed', renderGroups)
  bus.on('clustering:applied', renderGroups)
  bus.on('network:loaded', renderGroups)
  // switched here or in the Clustering summary: the ticks follow, in place
  // (a new render would scroll a long list back to the top)
  bus.on('groups:shown', () =>
    document
      .querySelectorAll<HTMLElement>('#groupsList .group-row')
      .forEach((row) => {
        const box = row.querySelector<HTMLInputElement>('.group-hull input')
        if (box) box.checked = !isGroupHidden(row.dataset.group!)
      })
  )
}
