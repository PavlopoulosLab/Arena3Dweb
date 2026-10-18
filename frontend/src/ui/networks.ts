// Networks menu (top bar): every loaded network with its source and size,
// the one on screen marked, and under each its annotation sets — pick a
// network, a set, or both at once; rename either (✎) or delete either (×).
// The menu's button says what is on screen at a glance. Everything goes
// through the workspace actions (the same as File → Loaded networks and
// Analyze → Annotations, which use the rename and delete helpers below).

import { Collapse, Dropdown } from 'bootstrap'
import { bus } from '../bus'
import {
  activeSlot,
  applyAnnotationSet,
  deleteAnnotationSet,
  deleteSlot,
  describeSlots,
  listSlots,
  onScreen,
  renameAnnotationSet,
  renameSlot,
  sizeText,
  switchTo,
  type SlotRow,
} from '../actions/workspace'
import { escapeHtml } from '../utils'
import { confirmDialog } from './confirm'
import { editInPlace } from './inline_edit'
import { showTab } from './tabs'

const e = escapeHtml

const icon = (
  kind: 'rename' | 'delete',
  cls: string,
  data: string,
  what: string
) =>
  `<button type="button" class="networks-icon ${cls}" ${data} title="${kind === 'rename' ? 'Rename' : 'Delete'}" aria-label="${kind === 'rename' ? 'Rename' : 'Delete'} ${e(what)}">${kind === 'rename' ? '✎' : '×'}</button>`

function setsHtml(row: SlotRow): string {
  if (row.sets.length === 0)
    return row.active
      ? '<div class="networks-empty">No annotation sets yet: add an attribute or group file (File), an enrichment or a cluster run.</div>'
      : ''
  const choice = (index: number, label: string, nodes?: number) => {
    const on = row.activeSet === index
    return `<button type="button" class="networks-set" data-id="${row.id}" data-set="${index}" aria-pressed="${on}" title="${on ? 'Shown' : row.active ? 'Show this annotation' : 'Switch to this network with this annotation'}">
      <span class="networks-set__name">${e(label)}</span>${nodes === undefined ? '' : `<span class="networks-set__n">${nodes.toLocaleString('en-GB')} node${nodes === 1 ? '' : 's'}</span>`}
    </button>`
  }
  const data = (index: number) => `data-id="${row.id}" data-set="${index}"`
  return `<div class="networks-sets" role="group" aria-label="Annotation of ${e(row.name)}">
    ${row.sets
      .map(
        (s) => `<div class="networks-set-row">
      ${choice(s.index, s.name, s.nodes)}
      ${icon('rename', 'networks-set__rename', data(s.index), s.name)}
      ${icon('delete', 'networks-set__delete', data(s.index), s.name)}
    </div>`
      )
      .join('')}
    ${choice(-1, 'No annotation')}
  </div>`
}

function rowHtml(row: SlotRow): string {
  const added = row.added.length
    ? `<span class="networks-net__added">+ ${row.added.map(e).join(' + ')}</span>`
    : ''
  const from = row.origin ? ` (${e(row.origin)})` : ''
  return `<section class="networks-net${row.active ? ' is-active' : ''}" data-id="${row.id}">
    <div class="networks-net__head">
      <button type="button" class="networks-net__switch" data-id="${row.id}" ${row.active ? 'aria-current="true"' : ''} title="${row.active ? 'On screen' : 'Switch to this network'}">
        <span class="networks-net__name">${e(row.name)}</span>${added}
        <span class="networks-net__meta">${e(row.source)}${from} · ${sizeText(row.layers, row.nodes, row.edges)}</span>
      </button>
      ${row.active ? '<span class="networks-net__badge">on screen</span>' : ''}
      ${icon('rename', 'networks-net__rename', `data-id="${row.id}"`, row.name)}
      ${icon('delete', 'networks-net__delete', `data-id="${row.id}"`, row.name)}
    </div>
    ${setsHtml(row)}
  </section>`
}

// the whole menu: what is on screen, every network, the way to load more
export function networksMenuHtml(rows: SlotRow[]): string {
  const now = onScreen()
  const active = rows.find((r) => r.active)
  const head =
    now && active
      ? `<div class="networks-now">
      <div class="networks-now__label">On screen</div>
      <div class="networks-now__name">${e(now.network)}</div>
      <div class="networks-now__ann">${now.annotation ? `Annotation: <b>${e(now.annotation)}</b>` : 'No annotation shown'}</div>
    </div>`
      : '<div class="networks-now networks-now--empty">Nothing loaded yet.</div>'
  return `${head}
    ${rows.length ? `<div class="networks-list">${rows.map(rowHtml).join('')}</div>` : ''}
    <div class="networks-foot">
      <button type="button" class="networks-link" data-go="#panel-file">Load another network…</button>
      ${rows.length ? '<button type="button" class="networks-link" data-go="#panel-analyze">Annotation options…</button>' : ''}
    </div>`
}

// ---------------------------------------------------------------- rename, delete
// shared with File → Loaded networks and Analyze → Annotations

const rowOf = (id: number) => describeSlots().find((r) => r.id === id)

// a box in place of `target` (the network's name)
export function renameNetwork(target: HTMLElement, id: number): void {
  const row = rowOf(id)
  if (row)
    editInPlace(
      target,
      row.name,
      (name) => renameSlot(id, name),
      'Network name'
    )
}

// a box in place of `target` (the set's name)
export function renameSet(
  target: HTMLElement,
  slotId: number,
  index: number
): void {
  const set = rowOf(slotId)?.sets[index]
  if (set)
    editInPlace(
      target,
      set.name,
      (name) => renameAnnotationSet(slotId, index, name),
      'Annotation set name'
    )
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

// asks first; the last network gone, the Home page shows
export async function askDeleteNetwork(id: number): Promise<boolean> {
  const rows = describeSlots()
  const row = rows.find((r) => r.id === id)
  if (!row) return false
  const sets = row.sets.length
  const instead = !row.active
    ? ''
    : rows.length > 1
      ? ' Another loaded network is shown in its place.'
      : ' The scene will be empty.'
  const ok = await confirmDialog({
    title: 'Delete network',
    text: `Delete “${row.name}”${sets ? ` and its ${plural(sets, 'annotation set')}` : ''}?${instead} The undo history is cleared too; this cannot be undone.`,
    ok: 'Delete',
  })
  if (!ok || !deleteSlot(id)) return false
  if (listSlots().length === 0) {
    closeMenus()
    showTab('#panel-home')
  }
  return true
}

export async function askDeleteSet(
  slotId: number,
  index: number
): Promise<boolean> {
  const row = rowOf(slotId)
  const set = row?.sets[index]
  if (!row || !set) return false
  const shown = row.activeSet === index
  const ok = await confirmDialog({
    title: 'Delete annotation set',
    text: `Delete the annotation set “${set.name}” of “${row.name}”?${shown ? ' It is shown now; the network will show no annotation.' : ''} This cannot be undone.`,
    ok: 'Delete',
  })
  return ok && deleteAnnotationSet(slotId, index)
}

// ---------------------------------------------------------------- the menu

// the button's second line: network · annotation
function renderNow(): void {
  const el = document.getElementById('networksNow')
  if (!el) return
  const now = onScreen()
  el.classList.toggle('d-none', !now)
  el.parentElement?.classList.toggle('has-now', !!now)
  el.textContent = now
    ? `${now.network} · ${now.annotation ?? 'no annotation'}`
    : ''
  const full = now
    ? `On screen: ${now.network} — ${now.annotation ? `annotation: ${now.annotation}` : 'no annotation'}`
    : ''
  el.title = full
  document.title = now ? `${now.network} · Arena3D` : 'Arena3D'
}

function render(): void {
  const menu = document.getElementById('networksMenu')
  if (menu) menu.innerHTML = networksMenuHtml(describeSlots())
  renderNow()
}

// close the menu, and the ☰ drawer on phones, so the scene shows
function closeMenus(): void {
  const toggle = document.getElementById('menu-networks')
  if (toggle) Dropdown.getOrCreateInstance(toggle).hide()
  const bar = document.getElementById('navbarTabs')
  if (bar?.classList.contains('show')) Collapse.getOrCreateInstance(bar).hide()
}

// a network (and, with `set`, one of its annotation sets, -1 = none)
function pick(id: number, set?: number): void {
  if (activeSlot()?.id !== id && !switchTo(id)) return
  if (set !== undefined && activeSlot()?.activeSet !== set)
    applyAnnotationSet(set)
}

export function initNetworksMenu(): void {
  const menu = document.getElementById('networksMenu')
  if (!menu) return
  menu.addEventListener('click', (ev) => {
    const target = (ev.target as HTMLElement).closest<HTMLElement>('button')
    if (!target) return
    const id = Number(target.dataset.id)
    const set = Number(target.dataset.set)
    const cls = target.classList
    // rename and delete keep the menu open
    if (cls.contains('networks-net__rename'))
      return renameNetwork(
        target.parentElement!.querySelector('.networks-net__switch')!,
        id
      )
    if (cls.contains('networks-set__rename'))
      return renameSet(
        target.parentElement!.querySelector('.networks-set')!,
        id,
        set
      )
    if (cls.contains('networks-net__delete')) return void askDeleteNetwork(id)
    if (cls.contains('networks-set__delete')) return void askDeleteSet(id, set)
    if (cls.contains('networks-net__switch')) pick(id)
    else if (cls.contains('networks-set')) pick(id, set)
    else if (target.dataset.go) {
      showTab(target.dataset.go)
      if (target.dataset.go === '#panel-analyze') {
        const card = document.getElementById('annotation_card')
        if (card instanceof HTMLDetailsElement) card.open = true
        card?.scrollIntoView({ block: 'nearest' })
      }
    } else return
    closeMenus()
  })
  // fresh sizes each time it opens (layers may have been split or merged)
  document
    .getElementById('menu-networks')
    ?.addEventListener('show.bs.dropdown', render)
  bus.on('workspace:changed', render)
  bus.on('network:loaded', render)
  render()
}
