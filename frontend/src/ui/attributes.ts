// Edit → Attributes: the node table and the edge table (actions/attributes.ts)
// — filter, sort, tick rows (the scene selection) and edit any cell in
// place; an edit in a ticked row changes every ticked row in the list, as
// one undo step. Only the rows in view are in the DOM, so 20,000 nodes
// scroll as smoothly as 20. Export node / edge attributes writes the files
// File → Node / Edge attributes read back.

import { bus } from '../bus'
import { ctx } from '../three'
import {
  DEFAULT_LABEL_LOOK,
  LABEL_LOOK_LABELS,
  NODE_SHAPE_LABELS,
  labelLookText,
  type LabelLookStyle,
} from '../three/Node'
import {
  colorLabelIndices,
  LABEL_PALETTE_LABELS,
  type LabelColorBy,
  type LabelPalette,
} from '../actions/style'
import { LINE_TYPE_LABELS } from '../three/Edge'
import { escapeHtml } from '../utils'
import { listGroups } from '../actions/groups'
import { registerSelectionAction } from '../actions/right_click_menu'
import {
  editEdges,
  editNodes,
  editTargets,
  edgeAttributesTsv,
  edgeCell,
  edgePatch,
  edgePatchName,
  filterEdges,
  filterNodes,
  hex,
  nodeAttributesTsv,
  nodeCell,
  nodePatch,
  nodePatchName,
  sortRows,
  tickEdges,
  tickNodes,
  LIMITS,
  type EdgeColumn,
  type EdgeField,
  type NodeColumn,
  type NodeField,
} from '../actions/attributes'
import { showTab } from './tabs'

const e = escapeHtml
const ROW_H = 34 // px; every row the same height, so rows are placed by index
const OVERSCAN = 8

const opts = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([v, l]) => `<option value="${v}">${l}</option>`)
    .join('')
const SHAPE_OPTIONS = opts(NODE_SHAPE_LABELS)
const LINE_OPTIONS = opts(LINE_TYPE_LABELS)
const LOOK_OPTIONS = opts({
  '': 'Auto',
  plain: 'Plain',
  halo: 'Halo',
  box: 'Box',
  shadow: 'Shadow',
})

type Kind = 'node' | 'edge'
type Column<C> = { key: C | null; name: string; title?: string }

const NODE_COLUMNS: Column<NodeColumn>[] = [
  { key: 'name', name: 'Node' },
  { key: 'layer', name: 'Layer' },
  { key: 'color', name: 'Colour' },
  { key: 'shape', name: 'Shape' },
  { key: 'scale', name: 'Size', title: 'Size (×)' },
  { key: 'alpha', name: 'Opacity' },
  { key: 'label', name: 'Label', title: 'Text in place of the node name' },
  {
    key: 'labelColor',
    name: 'Label colour',
    title: 'Label colour (faded: as the label style)',
  },
  {
    key: 'labelStyle',
    name: 'Label style',
    title: 'Plain, halo (outline), box or shadow (Auto: as the label style)',
  },
  {
    key: 'labelShown',
    name: 'Label shown',
    title:
      'Kept on screen whatever is selected (Edit → Nodes → Show Labels: Chosen)',
  },
  { key: 'descr', name: 'Description', title: 'Shown on hover' },
]
const EDGE_COLUMNS: Column<EdgeColumn>[] = [
  { key: 'source', name: 'Source' },
  { key: 'target', name: 'Target' },
  { key: 'layers', name: 'Layers' },
  { key: 'channel', name: 'Channel' },
  { key: 'color', name: 'Colour' },
  { key: 'width', name: 'Width', title: 'Width (× the edge width)' },
  { key: 'opacity', name: 'Opacity', title: 'Opacity (× the edge opacity)' },
  { key: 'lineType', name: 'Line' },
  {
    key: 'arrowColor',
    name: 'Arrow',
    title: 'Arrow colour (blank: the edge colour)',
  },
]

const head = <C extends string>(kind: Kind, cols: Column<C>[]) => `
  <div class="attr-row attr-row--head" role="row">
    <span class="attr-c attr-c--tick" role="columnheader"><input type="checkbox" class="form-check-input" id="attr${kind === 'node' ? 'Node' : 'Edge'}TickAll" aria-label="Tick every ${kind} in the list" /></span>
    ${cols
      .map(
        (c) =>
          `<span class="attr-c" role="columnheader" data-col="${c.key}" aria-sort="none"><button type="button" class="attr-sort" data-sort="${c.key}" title="${c.title ?? c.name} — click to sort">${c.name}</button></span>`
      )
      .join('')}
    <span class="attr-c attr-c--more" role="columnheader"><span class="visually-hidden">Inspect</span></span>
  </div>`

const ATTRIBUTES_HTML = `
<div class="attr-head">
  <div class="btn-group btn-group-sm" role="group" aria-label="Table">
    <button type="button" id="attrShowNodes" class="btn btn-outline-secondary active" aria-pressed="true">Nodes <span id="attrNodeTotal" class="attr-badge"></span></button>
    <button type="button" id="attrShowEdges" class="btn btn-outline-secondary" aria-pressed="false">Edges <span id="attrEdgeTotal" class="attr-badge"></span></button>
  </div>
  <div class="attr-head__export">
    <button type="button" id="attrExportNodes" class="btn btn-outline-primary btn-sm" title="Node, Layer, Color, Size, Shape, Opacity, Label… as a node attribute file (File → Node attributes reads it back)">Export node attributes</button>
    <button type="button" id="attrExportEdges" class="btn btn-outline-primary btn-sm" title="Source, target, channel, Color, Width, Opacity, LineType, ArrowColor as an edge attribute file (File → Edge attributes reads it back)">Export edge attributes</button>
  </div>
</div>
<p class="form-text attr-intro">Edit a cell to change that node or edge. Tick rows (or select in the scene) and edit a ticked row to change all ticked rows at once; each change is one undo step and is saved in sessions. ⋯ opens the inspector (also right-click a node or an edge → Edit Attributes…, or Alt + double-click a node).</p>

<section id="attrNodes" class="attr-section" aria-label="Node attributes">
  <div class="attr-toolbar">
    <input type="search" id="attrNodeSearch" class="form-control form-control-sm" placeholder="Filter: name, label, description" aria-label="Filter nodes" />
    <select id="attrNodeLayer" class="form-select form-select-sm" aria-label="Layer"></select>
    <select id="attrNodeGroup" class="form-select form-select-sm" aria-label="Group"></select>
    <span class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" role="switch" id="attrNodeSelectedOnly" /><label class="form-check-label small" for="attrNodeSelectedOnly">Selected only</label></span>
  </div>
  <div id="attrNodeSummary" class="attr-summary small" aria-live="polite"></div>
  <div class="attr-labels">
    <label class="small" for="attrLabelColorBy">Label colours:</label>
    <select id="attrLabelColorBy" class="form-select form-select-sm">
      ${opts({ layer: 'By layer', cluster: 'By cluster', annotation: 'By first annotation', match: 'Node colour', contrast: 'Contrast with node' })}
    </select>
    <select id="attrLabelPalette" class="form-select form-select-sm" aria-label="Label palette">${opts(LABEL_PALETTE_LABELS)}</select>
    <button type="button" id="attrLabelColorApply" class="btn btn-outline-primary btn-sm" title="The ticked rows, or every row in the list when none is ticked">Colour labels</button>
  </div>
  <div id="attrNodeTable" class="attr-table attr-table--node" role="table" aria-label="Node attributes">
    ${head('node', NODE_COLUMNS)}
    <div class="attr-body" role="rowgroup"></div>
    <div class="attr-empty d-none">No node matches.</div>
  </div>
</section>

<section id="attrEdges" class="attr-section" aria-label="Edge attributes" hidden>
  <div class="attr-toolbar">
    <input type="search" id="attrEdgeSearch" class="form-control form-control-sm" placeholder="Filter: source or target" aria-label="Filter edges" />
    <select id="attrEdgeChannel" class="form-select form-select-sm" aria-label="Channel"></select>
    <select id="attrEdgeKind" class="form-select form-select-sm" aria-label="Intra- or inter-layer">
      ${opts({ '': 'Intra- and inter-layer', intra: 'Intra-layer', inter: 'Inter-layer' })}
    </select>
    <span class="form-check form-switch m-0"><input class="form-check-input" type="checkbox" role="switch" id="attrEdgeSelectedOnly" /><label class="form-check-label small" for="attrEdgeSelectedOnly">Selected only</label></span>
  </div>
  <div id="attrEdgeSummary" class="attr-summary small" aria-live="polite"></div>
  <div id="attrEdgeTable" class="attr-table attr-table--edge" role="table" aria-label="Edge attributes">
    ${head('edge', EDGE_COLUMNS)}
    <div class="attr-body" role="rowgroup"></div>
    <div class="attr-empty d-none">No edge matches.</div>
  </div>
</section>
<div id="attr_status" class="small mt-2" aria-live="polite"></div>
`

// a field as the status line names it
const FIELD_NAMES: Record<string, string> = {
  color: 'colour',
  scale: 'size',
  alpha: 'opacity',
  descr: 'description',
  labelColor: 'label colour',
  labelStyle: 'label style',
  labelShown: 'label shown',
  lineType: 'line type',
  arrowColor: 'arrow colour',
}
const fieldName = (f: string) => FIELD_NAMES[f] ?? f

function status(msg: string, isError = false): void {
  const el = document.getElementById('attr_status')
  if (!el) return
  el.textContent = msg
  el.className = `small mt-2 ${isError ? 'text-danger' : 'text-success'}`
}

const plural = (n: number, what: string) =>
  `${n.toLocaleString('en-GB')} ${what}${n === 1 ? '' : 's'}`

// ---------------------------------------------------------------- rows
const nodeWho = (i: number) => {
  const n = ctx.nodeObjects[i]
  return `${n.name} (${n.layer})`
}
const edgeWho = (i: number) =>
  `${edgeCell(i, 'source')} – ${edgeCell(i, 'target')}`

function nodeRowHtml(i: number): string {
  const w = e(nodeWho(i))
  const [s0, s1] = LIMITS.scale
  const [a0, a1] = LIMITS.alpha
  return `
    <span class="attr-c attr-c--tick" role="cell"><input type="checkbox" class="form-check-input" data-f="tick" aria-label="Tick ${w}" /></span>
    <span class="attr-c attr-c--text" role="cell" data-f="name"></span>
    <span class="attr-c attr-c--text" role="cell" data-f="layer"></span>
    <span class="attr-c" role="cell"><input type="color" data-f="color" aria-label="Colour of ${w}" /></span>
    <span class="attr-c" role="cell"><select class="form-select form-select-sm" data-f="shape" aria-label="Shape of ${w}">${SHAPE_OPTIONS}</select></span>
    <span class="attr-c" role="cell"><input type="number" class="form-control form-control-sm" data-f="scale" min="${s0}" max="${s1}" step="0.1" aria-label="Size of ${w}" /></span>
    <span class="attr-c" role="cell"><input type="number" class="form-control form-control-sm" data-f="alpha" min="${a0}" max="${a1}" step="0.05" aria-label="Opacity of ${w}" /></span>
    <span class="attr-c" role="cell"><input type="text" class="form-control form-control-sm" data-f="label" maxlength="200" aria-label="Label of ${w}" /></span>
    <span class="attr-c attr-c--arrow" role="cell"><input type="color" data-f="labelColor" aria-label="${w}: label colour" /><button type="button" class="attr-reset" data-f="labelColorReset" title="As the label style (Edit → Nodes)" aria-label="${w}: label colour as the label style">×</button></span>
    <span class="attr-c" role="cell"><select class="form-select form-select-sm" data-f="labelStyle" aria-label="${w}: label style">${LOOK_OPTIONS}</select></span>
    <span class="attr-c attr-c--shown" role="cell"><input type="checkbox" class="form-check-input" data-f="labelShown" aria-label="${w}: label shown" /></span>
    <span class="attr-c" role="cell"><input type="text" class="form-control form-control-sm" data-f="descr" maxlength="2000" aria-label="Description of ${w}" /></span>
    <span class="attr-c attr-c--more" role="cell"><button type="button" class="attr-inspect" data-f="inspect" title="Inspector: every attribute of this node" aria-label="Inspect ${w}">⋯</button></span>`
}

function edgeRowHtml(i: number): string {
  const w = e(edgeWho(i))
  const [w0, w1] = LIMITS.width
  const [o0, o1] = LIMITS.opacity
  return `
    <span class="attr-c attr-c--tick" role="cell"><input type="checkbox" class="form-check-input" data-f="tick" aria-label="Tick ${w}" /></span>
    <span class="attr-c attr-c--text" role="cell" data-f="source"></span>
    <span class="attr-c attr-c--text" role="cell" data-f="target"></span>
    <span class="attr-c attr-c--text" role="cell" data-f="layers"></span>
    <span class="attr-c attr-c--text" role="cell" data-f="channel"></span>
    <span class="attr-c" role="cell"><input type="color" data-f="color" aria-label="Colour of ${w}" /></span>
    <span class="attr-c" role="cell"><input type="number" class="form-control form-control-sm" data-f="width" min="${w0}" max="${w1}" step="0.25" aria-label="Width of ${w}" /></span>
    <span class="attr-c" role="cell"><input type="number" class="form-control form-control-sm" data-f="opacity" min="${o0}" max="${o1}" step="0.05" aria-label="Opacity of ${w}" /></span>
    <span class="attr-c" role="cell"><select class="form-select form-select-sm" data-f="lineType" aria-label="Line type of ${w}">${LINE_OPTIONS}</select></span>
    <span class="attr-c attr-c--arrow" role="cell"><input type="color" data-f="arrowColor" aria-label="Arrow colour of ${w}" /><button type="button" class="attr-reset" data-f="arrowReset" title="Arrows follow the edge colour" aria-label="Arrow colour of ${w}: follow the edge">×</button></span>
    <span class="attr-c attr-c--more" role="cell"><button type="button" class="attr-inspect" data-f="inspect" title="Inspector: every attribute of this edge" aria-label="Inspect ${w}">⋯</button></span>`
}

// Write the values into a row's controls; the one being typed in is left
// alone so a refresh never eats a half-typed value.
function setControl(el: HTMLElement, value: string | number): void {
  if (el === document.activeElement) return
  if (el instanceof HTMLInputElement && el.type === 'checkbox') return
  if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement)
    el.value = String(value)
  else {
    el.textContent = String(value)
    el.title = String(value)
  }
}

function fillNodeRow(row: HTMLElement, i: number): void {
  const n = ctx.nodeObjects[i]
  row.classList.toggle('is-ticked', n.isSelected)
  row.querySelector<HTMLInputElement>('[data-f="tick"]')!.checked = n.isSelected
  for (const el of row.querySelectorAll<HTMLElement>('[data-f]')) {
    const f = el.dataset.f as NodeColumn
    if (['tick', 'inspect', 'labelColorReset'].includes(f)) continue
    // no label colour of its own: the picker shows the one on screen, faded
    setControl(
      el,
      f === 'labelColor'
        ? nodeCell(i, f) || hex(ctx.labelColor || '#ffffff')
        : nodeCell(i, f)
    )
  }
  row.classList.toggle('has-label-color', n.labelColor !== '')
  row.querySelector<HTMLInputElement>('[data-f="labelShown"]')!.checked =
    n.labelShown
  row
    .querySelector<HTMLInputElement>('[data-f="label"]')!
    .setAttribute('placeholder', n.name)
}

function fillEdgeRow(row: HTMLElement, i: number): void {
  const edge = ctx.edgeObjects[i]
  row.classList.toggle('is-ticked', edge.isSelected)
  row.querySelector<HTMLInputElement>('[data-f="tick"]')!.checked =
    edge.isSelected
  for (const el of row.querySelectorAll<HTMLElement>('[data-f]')) {
    const f = el.dataset.f as EdgeColumn
    if (!EDGE_COLUMNS.some((c) => c.key === f)) continue
    setControl(
      el,
      f === 'arrowColor'
        ? edgeCell(i, 'arrowColor') || edgeCell(i, 'color')
        : edgeCell(i, f)
    )
  }
  // no arrow colour of its own: the picker shows the edge's, dimmed
  row.classList.toggle('has-arrow', edge.arrowColor !== '')
}

// ---------------------------------------------------------------- table
// One table: the list of rows (filtered, sorted), the rows in view, ticks.
class Table {
  list: number[] = []
  sort: { key: string; dir: 1 | -1 } | null = null
  private rows = new Map<number, HTMLElement>() // model index → row
  private frame = 0
  private lastTick: number | null = null // place in the list, for Shift
  readonly scroller: HTMLElement
  readonly body: HTMLElement

  constructor(
    readonly kind: Kind,
    readonly id: string, // the table's element
    private readonly rowHtml: (i: number) => string,
    private readonly fill: (row: HTMLElement, i: number) => void,
    private readonly compute: () => number[],
    private readonly cell: (i: number, key: string) => string | number,
    private readonly ticked: (i: number) => boolean,
    private readonly tick: (ids: number[], on: boolean) => void,
    private readonly total: () => number,
    private readonly commit: (i: number, field: string, raw: string) => void,
    private readonly inspect: (i: number) => void
  ) {
    this.scroller = document.getElementById(id)!
    this.body = this.scroller.querySelector('.attr-body')!
    this.scroller.addEventListener('scroll', () => this.schedule())
    new ResizeObserver(() => this.schedule()).observe(this.scroller)
    this.wire()
  }

  // a new list: the filter, the sort or the network changed
  rebuild(): void {
    let list = this.compute()
    if (this.sort) {
      const { key, dir } = this.sort
      list = sortRows(list, (i) => this.cell(i, key), dir)
    }
    this.list = list
    this.lastTick = null
    this.body.style.height = `${list.length * ROW_H}px`
    this.scroller.setAttribute('aria-rowcount', String(list.length + 1))
    this.scroller
      .querySelector('.attr-empty')!
      .classList.toggle('d-none', list.length > 0 || this.total() === 0)
    const keep = new Set(list)
    for (const [i, row] of this.rows)
      if (!keep.has(i)) {
        row.remove()
        this.rows.delete(i)
      }
    this.render(true)
  }

  // values changed (an edit, an undo, the selection): refill the rows in view
  refresh(): void {
    this.render(true)
  }

  private schedule(): void {
    if (this.frame) return
    this.frame = requestAnimationFrame(() => {
      this.frame = 0
      this.render(false)
    })
  }

  private render(refill: boolean): void {
    const top = Math.max(0, this.scroller.scrollTop - this.body.offsetTop)
    const height = this.scroller.clientHeight || 600
    const first = Math.max(0, Math.floor(top / ROW_H) - OVERSCAN)
    const last = Math.min(
      this.list.length,
      Math.ceil((top + height) / ROW_H) + OVERSCAN
    )
    const want = new Map<number, number>() // model index → place
    for (let k = first; k < last; k++) want.set(this.list[k], k)
    const focused = document.activeElement
    for (const [i, row] of this.rows)
      if (!want.has(i) && !row.contains(focused)) {
        row.remove()
        this.rows.delete(i)
      }
    for (const [i, k] of want) {
      let row = this.rows.get(i)
      if (!row) {
        row = document.createElement('div')
        row.className = 'attr-row'
        row.setAttribute('role', 'row')
        row.dataset.i = String(i)
        row.innerHTML = this.rowHtml(i)
        this.rows.set(i, row)
        this.body.appendChild(row)
        this.fill(row, i)
      } else if (refill) this.fill(row, i)
      row.style.transform = `translateY(${k * ROW_H}px)`
      row.setAttribute('aria-rowindex', String(k + 2))
    }
    this.summarise()
  }

  tickedInList(): number[] {
    return this.list.filter(this.ticked)
  }

  private summarise(): void {
    const n = this.tickedInList().length
    const all = this.scroller.querySelector<HTMLInputElement>(
      '.attr-row--head input[type="checkbox"]'
    )!
    all.checked = n > 0 && n === this.list.length
    all.indeterminate = n > 0 && n < this.list.length
    const what = this.kind === 'node' ? 'node' : 'edge'
    const summary = document.getElementById(
      this.kind === 'node' ? 'attrNodeSummary' : 'attrEdgeSummary'
    )!
    summary.textContent =
      `${this.list.length.toLocaleString('en-GB')} of ${plural(this.total(), what)} · ${n.toLocaleString('en-GB')} ticked` +
      (n > 1
        ? ` — editing a ticked row changes all ${n.toLocaleString('en-GB')}`
        : '')
  }

  // the row of model index i into view, and lit for a moment
  reveal(i: number): boolean {
    const k = this.list.indexOf(i)
    if (k === -1) return false
    const top = this.body.offsetTop + k * ROW_H
    if (
      top < this.scroller.scrollTop + ROW_H ||
      top > this.scroller.scrollTop + this.scroller.clientHeight - ROW_H
    )
      this.scroller.scrollTop = Math.max(0, top - 3 * ROW_H)
    this.render(true)
    const row = this.rows.get(i)
    row?.classList.remove('is-flash')
    void row?.offsetWidth // restart the animation
    row?.classList.add('is-flash')
    return true
  }

  private wire(): void {
    const rowOf = (t: EventTarget | null) =>
      (t as HTMLElement | null)?.closest<HTMLElement>('.attr-row[data-i]')
    // ticks: Shift-click ticks (or unticks) the run from the last one
    this.body.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement
      const row = rowOf(t)
      if (!row) return
      const i = Number(row.dataset.i)
      if (t.dataset.f === 'tick') {
        const on = (t as HTMLInputElement).checked
        const k = this.list.indexOf(i)
        const ids =
          ev.shiftKey && this.lastTick !== null
            ? this.list.slice(
                Math.min(k, this.lastTick),
                Math.max(k, this.lastTick) + 1
              )
            : [i]
        this.lastTick = k
        this.tick(ids, on)
        this.refresh()
      } else if (t.dataset.f === 'inspect') this.inspect(i)
      else if (t.dataset.f === 'arrowReset') this.commit(i, 'arrowColor', '')
      else if (t.dataset.f === 'labelColorReset')
        this.commit(i, 'labelColor', '')
    })
    this.body.addEventListener('change', (ev) => {
      const t = ev.target as HTMLInputElement | HTMLSelectElement
      const row = rowOf(t)
      if (!row || !t.dataset.f || t.dataset.f === 'tick') return
      // a check box (Label shown) gives its state
      const raw =
        t instanceof HTMLInputElement && t.type === 'checkbox'
          ? String(t.checked)
          : t.value
      this.commit(Number(row.dataset.i), t.dataset.f, raw)
    })
    this.body.addEventListener('keydown', (ev) => {
      const t = ev.target as HTMLInputElement
      if (!(t instanceof HTMLInputElement) || t.type === 'checkbox') return
      const row = rowOf(t)
      if (!row) return
      if (ev.key === 'Enter') {
        ev.preventDefault()
        t.blur() // commits through 'change'
      } else if (ev.key === 'Escape') {
        ev.preventDefault()
        ev.stopPropagation()
        t.blur()
        this.fill(row, Number(row.dataset.i)) // the old value back
      }
    })
    // the header: tick every row in the list, or sort by a column
    const headRow = this.scroller.querySelector<HTMLElement>('.attr-row--head')!
    headRow
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!
      .addEventListener('change', (ev) => {
        const all = this.tickedInList().length === this.list.length
        ;(ev.target as HTMLInputElement).checked = !all
        this.tick(this.list, !all)
        this.refresh()
      })
    headRow.addEventListener('click', (ev) => {
      const key = (ev.target as HTMLElement).closest<HTMLElement>('[data-sort]')
        ?.dataset.sort
      if (!key) return
      // ascending, descending, then as loaded
      this.sort =
        this.sort?.key !== key
          ? { key, dir: 1 }
          : this.sort.dir === 1
            ? { key, dir: -1 }
            : null
      const sort = this.sort
      for (const h of headRow.querySelectorAll<HTMLElement>('[data-col]'))
        h.setAttribute(
          'aria-sort',
          sort && h.dataset.col === sort.key
            ? sort.dir === 1
              ? 'ascending'
              : 'descending'
            : 'none'
        )
      this.rebuild()
    })
  }
}

// ---------------------------------------------------------------- panel
let nodes: Table | null = null
let edges: Table | null = null
let dirty = true // the network changed while the panel was hidden

const pane = () => document.getElementById('panel-attributes')
const visible = () => pane()?.classList.contains('active') ?? false
const value = (id: string) =>
  (document.getElementById(id) as HTMLInputElement).value
const checked = (id: string) =>
  (document.getElementById(id) as HTMLInputElement).checked

function fillFilters(): void {
  const layer = document.getElementById('attrNodeLayer') as HTMLSelectElement
  const was = layer.value
  layer.innerHTML =
    '<option value="">All layers</option>' +
    ctx.layers
      .map((l) => `<option value="${e(l.name)}">${e(l.name)}</option>`)
      .join('')
  layer.value = ctx.layers.some((l) => l.name === was) ? was : ''

  // groups as the Groups card lists them (annotations, clusters)
  const group = document.getElementById('attrNodeGroup') as HTMLSelectElement
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
  group.disabled = group.options.length === 1

  const channel = document.getElementById(
    'attrEdgeChannel'
  ) as HTMLSelectElement
  const wasChannel = channel.value
  const names = Object.keys(ctx.channelColors)
  const bare = ctx.edgeObjects.some((ed) => ed.channels.length === 0)
  channel.innerHTML =
    '<option value="*">All channels</option>' +
    names.map((c) => `<option value="${e(c)}">${e(c)}</option>`).join('') +
    (names.length && bare ? '<option value="">No channel</option>' : '')
  channel.value = [...channel.options].some((o) => o.value === wasChannel)
    ? wasChannel
    : '*'
  channel.disabled = names.length === 0
}

function updateTotals(): void {
  document.getElementById('attrNodeTotal')!.textContent =
    ctx.nodeObjects.length.toLocaleString('en-GB')
  document.getElementById('attrEdgeTotal')!.textContent =
    ctx.edgeObjects.length.toLocaleString('en-GB')
}

// everything over again: a network loaded, or the panel opened after one
function rebuildAll(): void {
  if (!nodes || !edges) return
  if (!visible()) {
    dirty = true
    return
  }
  dirty = false
  fillFilters()
  updateTotals()
  nodes.rebuild()
  edges.rebuild()
}

function showSection(kind: Kind): void {
  const isNode = kind === 'node'
  document.getElementById('attrNodes')!.hidden = !isNode
  document.getElementById('attrEdges')!.hidden = isNode
  for (const [id, on] of [
    ['attrShowNodes', isNode],
    ['attrShowEdges', !isNode],
  ] as const) {
    const b = document.getElementById(id)!
    b.classList.toggle('active', on)
    b.setAttribute('aria-pressed', String(on))
  }
  // a hidden table measured nothing: place its rows now
  ;(isNode ? nodes : edges)?.refresh()
}

function download(text: string, name: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'text/tab-separated-values' })
  )
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// a cell's edit: the row, or every ticked row in the list with it
function commitNode(i: number, field: string, raw: string): void {
  // a style picked in the table keeps the row's halo / box colour, width,
  // opacity and bold
  if (field === 'labelStyle' && raw in LABEL_LOOK_LABELS)
    raw = labelLookText({
      ...(ctx.nodeObjects[i].labelLook ?? DEFAULT_LABEL_LOOK),
      style: raw as LabelLookStyle,
    })
  const patch = nodePatch(field as NodeField, raw)
  if (!patch) {
    status(`That is not a valid ${fieldName(field)} — nothing changed.`, true)
    return nodes?.refresh()
  }
  const ids = editTargets(i, nodes!.list, (k) => ctx.nodeObjects[k].isSelected)
  editNodes(ids, patch)
  status(
    ids.length > 1
      ? `Set the ${nodePatchName(patch)} of ${plural(ids.length, 'node')} (one undo step).`
      : `Set the ${nodePatchName(patch)} of ${nodeWho(i)}.`
  )
}

function commitEdge(i: number, field: string, raw: string): void {
  const patch = edgePatch(field as EdgeField, raw)
  if (!patch) {
    status(`That is not a valid ${fieldName(field)} — nothing changed.`, true)
    return edges?.refresh()
  }
  const ids = editTargets(i, edges!.list, (k) => ctx.edgeObjects[k].isSelected)
  editEdges(ids, patch)
  status(
    ids.length > 1
      ? `Set the ${edgePatchName(patch)} of ${plural(ids.length, 'edge')} (one undo step).`
      : `Set the ${edgePatchName(patch)} of ${edgeWho(i)}.`
  )
}

// Open the panel on a node's or an edge's row (the inspector's Show in
// table); filters that hide it are cleared.
export function revealRow(kind: Kind, i: number): void {
  showTab('#panel-attributes')
  if (dirty) rebuildAll()
  showSection(kind)
  const table = kind === 'node' ? nodes : edges
  if (!table) return
  if (!table.reveal(i)) {
    const ids =
      kind === 'node'
        ? ['attrNodeSearch', 'attrNodeLayer', 'attrNodeGroup']
        : ['attrEdgeSearch', 'attrEdgeKind']
    for (const id of ids)
      (document.getElementById(id) as HTMLInputElement).value = ''
    if (kind === 'edge')
      (document.getElementById('attrEdgeChannel') as HTMLSelectElement).value =
        '*'
    ;(
      document.getElementById(
        kind === 'node' ? 'attrNodeSelectedOnly' : 'attrEdgeSelectedOnly'
      ) as HTMLInputElement
    ).checked = false
    table.rebuild()
    table.reveal(i)
  }
}

export function initAttributesPanel(): void {
  const p = pane()
  if (!p) return
  p.innerHTML = ATTRIBUTES_HTML
  const inspect = (kind: Kind) => (i: number) =>
    bus.emit('attributes:inspect', { kind, index: i })

  nodes = new Table(
    'node',
    'attrNodeTable',
    nodeRowHtml,
    fillNodeRow,
    () =>
      filterNodes({
        text: value('attrNodeSearch'),
        layer: value('attrNodeLayer'),
        group: value('attrNodeGroup'),
        selectedOnly: checked('attrNodeSelectedOnly'),
      }),
    (i, key) => nodeCell(i, key as NodeColumn),
    (i) => ctx.nodeObjects[i].isSelected,
    tickNodes,
    () => ctx.nodeObjects.length,
    commitNode,
    inspect('node')
  )
  edges = new Table(
    'edge',
    'attrEdgeTable',
    edgeRowHtml,
    fillEdgeRow,
    () =>
      filterEdges({
        text: value('attrEdgeSearch'),
        channel: value('attrEdgeChannel'),
        kind: value('attrEdgeKind') as '' | 'intra' | 'inter',
        selectedOnly: checked('attrEdgeSelectedOnly'),
      }),
    (i, key) => edgeCell(i, key as EdgeColumn),
    (i) => ctx.edgeObjects[i].isSelected,
    tickEdges,
    () => ctx.edgeObjects.length,
    commitEdge,
    inspect('edge')
  )

  // label colours by palette or from the nodes: the ticked rows, or the list
  const labelBy = document.getElementById(
    'attrLabelColorBy'
  ) as HTMLSelectElement
  labelBy.addEventListener('change', () =>
    document
      .getElementById('attrLabelPalette')!
      .classList.toggle(
        'd-none',
        labelBy.value === 'match' || labelBy.value === 'contrast'
      )
  )
  document
    .getElementById('attrLabelColorApply')!
    .addEventListener('click', () => {
      const list = nodes!.list
      const ticked = list.filter((k) => ctx.nodeObjects[k].isSelected)
      const ids = ticked.length ? ticked : list
      if (
        !colorLabelIndices(
          ids,
          labelBy.value as LabelColorBy,
          value('attrLabelPalette') as LabelPalette
        )
      )
        return status('No node in the list — nothing changed.', true)
      status(
        `Coloured the labels of ${plural(ids.length, ticked.length ? 'ticked node' : 'node')} (one undo step).`
      )
    })

  // filters: typing waits for a pause, so 20,000 rows don't refilter per key
  let typing = 0
  for (const [id, table] of [
    ['attrNodeSearch', nodes],
    ['attrEdgeSearch', edges],
  ] as const)
    document.getElementById(id)!.addEventListener('input', () => {
      clearTimeout(typing)
      typing = window.setTimeout(() => table.rebuild(), 150)
    })
  for (const [id, table] of [
    ['attrNodeLayer', nodes],
    ['attrNodeGroup', nodes],
    ['attrNodeSelectedOnly', nodes],
    ['attrEdgeChannel', edges],
    ['attrEdgeKind', edges],
    ['attrEdgeSelectedOnly', edges],
  ] as const)
    document
      .getElementById(id)!
      .addEventListener('change', () => table.rebuild())

  document
    .getElementById('attrShowNodes')!
    .addEventListener('click', () => showSection('node'))
  document
    .getElementById('attrShowEdges')!
    .addEventListener('click', () => showSection('edge'))

  document.getElementById('attrExportNodes')!.addEventListener('click', () => {
    if (!ctx.nodeObjects.length) return status('Load a network first.', true)
    download(nodeAttributesTsv(), 'node_attributes.tsv')
    status(
      `Exported ${plural(ctx.nodeObjects.length, 'node')}; File → Node attributes loads the file back.`
    )
  })
  document.getElementById('attrExportEdges')!.addEventListener('click', () => {
    if (!ctx.edgeObjects.length) return status('Load a network first.', true)
    download(edgeAttributesTsv(), 'edge_attributes.tsv')
    status(
      `Exported ${plural(ctx.edgeObjects.length, 'edge')}; File → Edge attributes loads the file back.`
    )
  })

  // what the tables follow
  bus.on('network:loaded', rebuildAll)
  bus.on('workspace:changed', rebuildAll)
  bus.on('groups:changed', () => visible() && fillFilters())
  let count = -1
  bus.on('history:changed', () => {
    if (!visible()) return void (dirty = true)
    // an undo can bring back (or take away) a whole network
    if (ctx.nodeObjects.length + ctx.edgeObjects.length !== count) {
      count = ctx.nodeObjects.length + ctx.edgeObjects.length
      return rebuildAll()
    }
    nodes?.refresh()
    edges?.refresh()
  })
  bus.on('selection:changed', () => {
    if (!visible()) return
    if (checked('attrNodeSelectedOnly')) nodes?.rebuild()
    else nodes?.refresh()
    // node actions select edges too (neighbours, paths)
    if (checked('attrEdgeSelectedOnly')) edges?.rebuild()
    else edges?.refresh()
  })
  // edge selections (Find, Explore) announce nothing: look again on the way in
  p.addEventListener('pointerenter', () => {
    if (dirty) rebuildAll()
    else edges?.refresh()
  })
  document
    .querySelector('[data-bs-target="#panel-attributes"]')
    ?.addEventListener('shown.bs.tab', () => {
      count = ctx.nodeObjects.length + ctx.edgeObjects.length
      if (dirty) rebuildAll()
      else {
        nodes?.refresh()
        edges?.refresh()
      }
    })

  // the scene's right-click menu, with nodes selected
  registerSelectionAction({
    label: 'Edit Attributes…',
    order: 65, // after Focus / Copy, before Style Selected Nodes…
    run: () => {
      showTab('#panel-attributes')
      showSection('node')
      const only = document.getElementById(
        'attrNodeSelectedOnly'
      ) as HTMLInputElement
      only.checked = true
      if (dirty) rebuildAll()
      else nodes?.rebuild()
    },
  })
}
