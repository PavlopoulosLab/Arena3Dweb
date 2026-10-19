// Edit → Nodes → Labels to show: every node with a tick box, to choose the
// labels that stay on screen (Show Labels: Chosen) without the mouse in the
// scene. A filter (text, layer, group, as in Edit → Attributes), All / None /
// Invert / The selected nodes on the listed rows, and a count. Rows are
// virtual — only those in view exist — so 20,000 nodes scroll smoothly; rows
// still in view are kept on a scroll, so a focused tick box keeps its focus
// and Tab walks the whole list. Every change is one undo step.

import { bus } from '../bus'
import { ctx } from '../three'
import { escapeHtml } from '../utils'
import { filterNodes } from '../actions/attributes'
import { listGroups } from '../actions/groups'
import { nodeLabelState } from '../actions/node'
import { chooseLabels, showLabelsOf, type LabelChoice } from '../actions/style'

const e = escapeHtml
const ROW_H = 28 // px; every row the same height, so rows are placed by index
const OVERSCAN = 6

export const LABEL_PICKER_HTML = `
  <details class="lp-section lp-more" id="nodeCard_labelPicker">
  <summary>Labels to show</summary>
  <div class="label-pick__filters">
    <input type="search" id="labelPickSearch" class="form-control form-control-sm" placeholder="Filter: name, label, description — Enter ticks every match" aria-label="Filter the labels" />
    <select id="labelPickLayer" class="form-select form-select-sm" aria-label="Layer"></select>
    <select id="labelPickGroup" class="form-select form-select-sm" aria-label="Group"></select>
  </div>
  <div class="btn-group btn-group-sm mb-1" role="group" aria-label="Tick the listed labels">
    <button type="button" id="labelPickAll" class="btn btn-outline-secondary">All</button>
    <button type="button" id="labelPickNone" class="btn btn-outline-secondary">None</button>
    <button type="button" id="labelPickInvert" class="btn btn-outline-secondary">Invert</button>
    <button type="button" id="labelPickSelected" class="btn btn-outline-secondary" title="Tick the selected nodes in the list, untick the others">The selected nodes</button>
  </div>
  <div id="labelPickCount" class="small label-pick__count" aria-live="polite"></div>
  <div id="labelPickList" class="label-pick__list" role="list" aria-label="Labels to show">
    <div class="label-pick__spacer"></div>
  </div>
  <div id="labelPickStatus" class="small mb-2" aria-live="polite"></div>
  <div class="form-text">A ticked label stays on screen whatever is selected (Show Labels: Chosen). Tab and Space tick; Enter in the filter ticks every match.</div>
  </details>`

const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T | null

let list: number[] = [] // the listed node indices
const rows = new Map<number, HTMLLabelElement>() // position -> row

const card = () => el<HTMLDetailsElement>('nodeCard_labelPicker')
const visible = () =>
  !!card()?.open && !!el('panel-node')?.classList.contains('active')

function status(msg: string): void {
  const s = el('labelPickStatus')
  if (s) s.textContent = msg
}

function count(): void {
  const c = el('labelPickCount')
  if (!c) return
  const chosen = ctx.nodeObjects.filter((n) => n.labelShown).length
  const total = ctx.nodeObjects.length
  c.textContent = `${chosen.toLocaleString('en-GB')} of ${total.toLocaleString('en-GB')} labels chosen · ${list.length.toLocaleString('en-GB')} listed`
}

function rowFor(k: number): HTMLLabelElement {
  const i = list[k]
  const n = ctx.nodeObjects[i]
  const row = document.createElement('label')
  row.className = 'label-pick__row'
  row.setAttribute('role', 'listitem')
  row.style.top = `${k * ROW_H}px`
  row.dataset.i = String(i)
  row.innerHTML = `<input type="checkbox" class="form-check-input" aria-label="Show the label of ${e(n.name)} (${e(n.layer)})" /><span class="label-pick__name">${e(n.getLabel())}</span><span class="label-pick__layer">${e(n.layer)}</span>`
  row.querySelector('input')!.checked = n.labelShown
  return row
}

// the rows in view (and a few around), the others dropped
function render(): void {
  const box = el('labelPickList')
  if (!box) return
  const first = Math.max(0, Math.floor(box.scrollTop / ROW_H) - OVERSCAN)
  const last = Math.min(
    list.length - 1,
    Math.ceil((box.scrollTop + box.clientHeight) / ROW_H) + OVERSCAN
  )
  for (const [k, row] of rows)
    if (k < first || k > last) {
      row.remove()
      rows.delete(k)
    }
  for (let k = first; k <= last; k++)
    if (!rows.has(k)) {
      const row = rowFor(k)
      rows.set(k, row)
      box.appendChild(row)
    }
}

// the tick boxes in view say what the nodes have now
function refresh(): void {
  if (!visible()) return
  for (const row of rows.values()) {
    const input = row.querySelector('input')!
    input.checked = ctx.nodeObjects[Number(row.dataset.i)]?.labelShown ?? false
  }
  count()
}

function rebuild(): void {
  if (!visible()) return
  const box = el('labelPickList')
  if (!box) return
  // the text looks in names, labels and descriptions (the layer has its own
  // filter, and "1" should not list all of Layer1)
  const text = el<HTMLInputElement>('labelPickSearch')!
    .value.trim()
    .toLowerCase()
  list = filterNodes({
    layer: el<HTMLSelectElement>('labelPickLayer')!.value,
    group: el<HTMLSelectElement>('labelPickGroup')!.value,
  }).filter((i) => {
    const n = ctx.nodeObjects[i]
    return (
      !text ||
      [n.name, n.label, n.descr].some((v) => v.toLowerCase().includes(text))
    )
  })
  for (const row of rows.values()) row.remove()
  rows.clear()
  box.querySelector<HTMLElement>('.label-pick__spacer')!.style.height =
    `${list.length * ROW_H}px`
  render()
  count()
}

function fillFilters(): void {
  const layer = el<HTMLSelectElement>('labelPickLayer')
  const group = el<HTMLSelectElement>('labelPickGroup')
  if (!layer || !group) return
  const was = layer.value
  layer.innerHTML =
    '<option value="">All layers</option>' +
    ctx.layers
      .map((l) => `<option value="${e(l.name)}">${e(l.name)}</option>`)
      .join('')
  layer.value = ctx.layers.some((l) => l.name === was) ? was : ''
  const wasGroup = group.value
  const block = (source: 'annotation' | 'cluster', label: string) => {
    const gs = listGroups(source)
    return gs.length
      ? `<optgroup label="${label}">${gs
          .map(
            (g) =>
              `<option value="${source}:${e(g.name)}">${e(g.name)} (${g.members.length})</option>`
          )
          .join('')}</optgroup>`
      : ''
  }
  group.innerHTML =
    '<option value="">All groups</option>' +
    block('annotation', 'Annotations') +
    block('cluster', 'Clusters')
  group.value = [...group.options].some((o) => o.value === wasGroup)
    ? wasGroup
    : ''
}

// a change made here, and what Show Labels did about it
function after(before: string, done: string): void {
  const now = nodeLabelState().mode
  status(
    now !== before && now === 'chosen'
      ? `${done} Show Labels switched to Chosen.`
      : done
  )
  refresh()
}

const plural = (n: number) =>
  `${n.toLocaleString('en-GB')} label${n === 1 ? '' : 's'}`

export function initLabelPicker(): void {
  const box = el('labelPickList')
  if (!box) return
  fillFilters()

  box.addEventListener('scroll', render)
  // a tick box reached with Tab comes into view (and its neighbours with it)
  box.addEventListener('focusin', (ev) =>
    (ev.target as HTMLElement)
      .closest('.label-pick__row')
      ?.scrollIntoView({ block: 'nearest' })
  )
  box.addEventListener('change', (ev) => {
    const input = ev.target as HTMLInputElement
    const i = Number(input.closest<HTMLElement>('.label-pick__row')?.dataset.i)
    if (!Number.isInteger(i)) return
    const before = nodeLabelState().mode
    showLabelsOf([i], input.checked)
    const n = ctx.nodeObjects[i]
    after(
      before,
      `${n.name} (${n.layer}): label ${input.checked ? 'chosen' : 'no longer chosen'}.`
    )
  })

  const choose = (how: LabelChoice) => {
    if (list.length === 0) return status('No node in the list.')
    const before = nodeLabelState().mode
    const shown = chooseLabels(list, how)
    after(before, `${plural(shown)} of the ${list.length} listed chosen.`)
  }
  const buttons: [string, LabelChoice][] = [
    ['labelPickAll', 'all'],
    ['labelPickNone', 'none'],
    ['labelPickInvert', 'invert'],
    ['labelPickSelected', 'selected'],
  ]
  for (const [id, how] of buttons)
    el(id)?.addEventListener('click', () => choose(how))

  // typing waits for a pause; Enter ticks every match
  let typing = 0
  const search = el<HTMLInputElement>('labelPickSearch')!
  search.addEventListener('input', () => {
    clearTimeout(typing)
    typing = window.setTimeout(rebuild, 150)
  })
  search.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return
    ev.preventDefault()
    clearTimeout(typing)
    rebuild()
    choose('all')
  })
  for (const id of ['labelPickLayer', 'labelPickGroup'])
    el(id)?.addEventListener('change', rebuild)

  card()?.addEventListener('toggle', rebuild)
  document
    .querySelector('[data-bs-target="#panel-node"]')
    ?.addEventListener('shown.bs.tab', rebuild)
  const again = () => {
    fillFilters()
    rebuild()
  }
  bus.on('network:loaded', again)
  bus.on('workspace:changed', again)
  bus.on('groups:changed', fillFilters)
  bus.on('history:changed', refresh)
}
