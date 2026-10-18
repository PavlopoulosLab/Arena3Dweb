// Edit → Attributes' inspector: a small card over the scene for one node or
// one edge, with every attribute it has, edited directly; each change is one
// undo step (the Style commands). Opened by right-click → Edit Attributes
// (nodes and edges), Alt + double-click on a node, or ⋯ in the Attributes
// tables. Its head drags it aside; Esc or × closes it.

import { bus } from '../bus'
import { ctx } from '../three'
import { NODE_SHAPE_LABELS } from '../three/Node'
import { LINE_TYPE_LABELS } from '../three/Edge'
import { escapeHtml } from '../utils'
import {
  borderPatch,
  edgeCell,
  edgePatch,
  editEdges,
  editNodes,
  hex,
  nodeCell,
  nodeOnCanvas,
  nodePatch,
  round,
  tickEdges,
  tickNodes,
  LIMITS,
  type EdgeField,
  type NodeField,
} from '../actions/attributes'
import type { Node } from '../three/Node'
import type { Edge } from '../three/Edge'
import { revealRow } from './attributes'

const e = escapeHtml
const opts = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([v, l]) => `<option value="${v}">${l}</option>`)
    .join('')

type Open = { kind: 'node' | 'edge'; index: number; obj: Node | Edge }
let open: Open | null = null

const field = (id: string, name: string, control: string) =>
  `<label class="attr-insp__name" for="${id}">${name}</label><span class="attr-insp__value">${control}</span>`
const num = (
  id: string,
  f: string,
  [lo, hi]: readonly [number, number],
  step: number,
  extra = ''
) =>
  `<input type="number" id="${id}" data-f="${f}" class="form-control form-control-sm" min="${lo}" max="${hi}" step="${step}" ${extra} />`

function nodeHtml(i: number): string {
  const n = ctx.nodeObjects[i]
  return `
  <div class="attr-insp__head">
    <div class="attr-insp__titles">
      <div class="attr-insp__title" id="attrInspectorTitle">${e(n.name)}</div>
      <div class="attr-insp__sub">Node · layer ${e(n.layer)}</div>
    </div>
    <button type="button" class="attr-insp__close" data-act="close" aria-label="Close the inspector">×</button>
  </div>
  <div class="attr-insp__grid">
    ${field('inspNodeColor', 'Colour', '<input type="color" id="inspNodeColor" data-f="color" />')}
    ${field('inspNodeShape', 'Shape', `<select id="inspNodeShape" data-f="shape" class="form-select form-select-sm">${opts(NODE_SHAPE_LABELS)}</select>`)}
    ${field('inspNodeSize', 'Size (×)', num('inspNodeSize', 'scale', LIMITS.scale, 0.1))}
    ${field('inspNodeAlpha', 'Opacity', num('inspNodeAlpha', 'alpha', LIMITS.alpha, 0.05))}
    ${field('inspNodeBorderWidth', 'Border', `<input type="color" id="inspNodeBorderColor" data-f="borderColor" aria-label="Border colour" />${num('inspNodeBorderWidth', 'borderWidth', LIMITS.borderWidth, 0.5, 'title="Border width (0: none)"')}`)}
    ${field('inspNodeLabel', 'Label', `<input type="text" id="inspNodeLabel" data-f="label" class="form-control form-control-sm" maxlength="200" placeholder="${e(n.name)}" />`)}
    ${field('inspNodeLabelColor', 'Label colour', '<input type="color" id="inspNodeLabelColor" data-f="labelColor" /><button type="button" class="attr-reset" data-act="labelColorReset" title="As the label style (Edit → Nodes)" aria-label="Label colour: as the label style">×</button>')}
    ${field('inspNodeLabelSize', 'Label size', num('inspNodeLabelSize', 'labelSize', LIMITS.labelSize, 1, 'placeholder="auto"'))}
    ${field('inspNodeDescr', 'Description', '<input type="text" id="inspNodeDescr" data-f="descr" class="form-control form-control-sm" maxlength="2000" placeholder="Shown on hover" />')}
  </div>
  <div class="attr-insp__foot">
    <button type="button" class="btn btn-outline-secondary btn-sm" data-act="select"></button>
    <button type="button" class="btn btn-outline-primary btn-sm" data-act="table">Show in table</button>
  </div>`
}

function edgeHtml(i: number): string {
  const ed = ctx.edgeObjects[i]
  const where = ed.interLayer
    ? `inter-layer, ${e(String(edgeCell(i, 'layers')))}`
    : `layer ${e(String(edgeCell(i, 'layers')))}`
  const channels = ed.channels.length
    ? ` · ${ed.channels.length === 1 ? 'channel' : 'channels'} ${e(ed.channels.join(', '))}`
    : ''
  return `
  <div class="attr-insp__head">
    <div class="attr-insp__titles">
      <div class="attr-insp__title" id="attrInspectorTitle">${e(String(edgeCell(i, 'source')))} – ${e(String(edgeCell(i, 'target')))}</div>
      <div class="attr-insp__sub">Edge · ${where}${channels}</div>
    </div>
    <button type="button" class="attr-insp__close" data-act="close" aria-label="Close the inspector">×</button>
  </div>
  <div class="attr-insp__grid">
    ${field('inspEdgeColor', 'Colour', '<input type="color" id="inspEdgeColor" data-f="color" />')}
    ${field('inspEdgeWidth', 'Width (×)', num('inspEdgeWidth', 'width', LIMITS.width, 0.25))}
    ${field('inspEdgeOpacity', 'Opacity (×)', num('inspEdgeOpacity', 'opacity', LIMITS.opacity, 0.05))}
    ${field('inspEdgeLineType', 'Line type', `<select id="inspEdgeLineType" data-f="lineType" class="form-select form-select-sm">${opts(LINE_TYPE_LABELS)}</select>`)}
    ${field('inspEdgeArrowColor', 'Arrow colour', '<input type="color" id="inspEdgeArrowColor" data-f="arrowColor" /><button type="button" class="attr-reset" data-act="arrowReset" title="Arrows follow the edge colour" aria-label="Arrow colour: follow the edge">×</button>')}
  </div>
  <div class="form-text">Arrows show when Direction is on (Edit → Edges).</div>
  <div class="attr-insp__foot">
    <button type="button" class="btn btn-outline-secondary btn-sm" data-act="select"></button>
    <button type="button" class="btn btn-outline-primary btn-sm" data-act="table">Show in table</button>
  </div>`
}

const card = () => document.getElementById('attrInspector')

const set = (id: string, v: string | number) => {
  const el = document.getElementById(id) as HTMLInputElement | null
  if (el && el !== document.activeElement) el.value = String(v)
}

// the controls show what the node or edge has now
function fill(): void {
  const c = card()
  if (!open || !c) return
  const i = open.index
  if (open.kind === 'node') {
    const n = ctx.nodeObjects[i]
    set('inspNodeColor', nodeCell(i, 'color'))
    set('inspNodeShape', n.shape)
    set('inspNodeSize', nodeCell(i, 'scale'))
    set('inspNodeAlpha', nodeCell(i, 'alpha'))
    set('inspNodeBorderColor', hex(n.borderColor))
    set('inspNodeBorderWidth', round(n.borderWidth))
    set('inspNodeLabel', n.label)
    set('inspNodeLabelColor', hex(n.labelColor || ctx.labelColor || '#ffffff'))
    set('inspNodeLabelSize', n.labelSize || '')
    set('inspNodeDescr', n.descr)
    c.classList.toggle('has-label-color', n.labelColor !== '')
    c.querySelector('[data-act="select"]')!.textContent = n.isSelected
      ? 'Unselect'
      : 'Select'
  } else {
    const ed = ctx.edgeObjects[i]
    set('inspEdgeColor', edgeCell(i, 'color'))
    set('inspEdgeWidth', edgeCell(i, 'width'))
    set('inspEdgeOpacity', edgeCell(i, 'opacity'))
    set('inspEdgeLineType', ed.lineType)
    set('inspEdgeArrowColor', edgeCell(i, 'arrowColor') || edgeCell(i, 'color'))
    c.classList.toggle('has-arrow', ed.arrowColor !== '')
    c.querySelector('[data-act="select"]')!.textContent = ed.isSelected
      ? 'Unselect'
      : 'Select'
  }
}

// beside the node (or the edge's middle), inside the window
function place(c: HTMLElement): void {
  if (!open) return
  const canvas = ctx.renderer?.domElement.getBoundingClientRect()
  let [x, y] = [window.innerWidth / 2, window.innerHeight / 2]
  if (canvas) {
    const [ax, ay] =
      open.kind === 'node'
        ? nodeOnCanvas(open.index)
        : (() => {
            const ed = ctx.edgeObjects[open.index]
            const a = nodeOnCanvas(ed.sourceNodeIndex)
            const b = nodeOnCanvas(ed.targetNodeIndex)
            return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
          })()
    x = canvas.left + ax + 24
    y = canvas.top + ay - 24
  }
  const w = c.offsetWidth || 280
  const h = c.offsetHeight || 320
  c.style.left = `${Math.max(8, Math.min(x, window.innerWidth - w - 8))}px`
  c.style.top = `${Math.max(64, Math.min(y, window.innerHeight - h - 8))}px`
}

export function closeInspector(): void {
  open = null
  card()?.classList.add('d-none')
}

export function openInspector(kind: 'node' | 'edge', index: number): void {
  const obj = kind === 'node' ? ctx.nodeObjects[index] : ctx.edgeObjects[index]
  const c = card()
  if (!obj || !c) return
  open = { kind, index, obj }
  c.innerHTML = kind === 'node' ? nodeHtml(index) : edgeHtml(index)
  c.dataset.kind = kind
  c.classList.remove('d-none')
  fill()
  place(c)
  c.focus({ preventScroll: true })
}

function commit(f: string, value: string): void {
  if (!open) return
  const i = open.index
  if (open.kind === 'node') {
    const patch =
      f === 'borderColor' || f === 'borderWidth'
        ? borderPatch(
            (document.getElementById('inspNodeBorderColor') as HTMLInputElement)
              .value,
            (document.getElementById('inspNodeBorderWidth') as HTMLInputElement)
              .value
          )
        : nodePatch(f as NodeField, value)
    if (patch) editNodes([i], patch)
  } else {
    const patch = edgePatch(f as EdgeField, value)
    if (patch) editEdges([i], patch)
  }
  fill() // an invalid value: back to what it is
}

// the head drags the card
function draggable(c: HTMLElement): void {
  let from: { x: number; y: number; left: number; top: number } | null = null
  c.addEventListener('pointerdown', (ev) => {
    const t = ev.target as HTMLElement
    if (!t.closest('.attr-insp__head') || t.closest('button')) return
    from = {
      x: ev.clientX,
      y: ev.clientY,
      left: c.offsetLeft,
      top: c.offsetTop,
    }
    c.setPointerCapture(ev.pointerId)
  })
  c.addEventListener('pointermove', (ev) => {
    if (!from) return
    c.style.left = `${from.left + ev.clientX - from.x}px`
    c.style.top = `${Math.max(56, from.top + ev.clientY - from.y)}px`
  })
  const end = () => (from = null)
  c.addEventListener('pointerup', end)
  c.addEventListener('pointercancel', end)
}

export function initInspector(): void {
  const c = document.createElement('div')
  c.id = 'attrInspector'
  c.className = 'attr-insp d-none'
  c.tabIndex = -1
  c.setAttribute('role', 'dialog')
  c.setAttribute('aria-labelledby', 'attrInspectorTitle')
  document.body.appendChild(c)
  draggable(c)

  c.addEventListener('change', (ev) => {
    const t = ev.target as HTMLInputElement
    if (t.dataset.f) commit(t.dataset.f, t.value)
  })
  c.addEventListener('keydown', (ev) => {
    const t = ev.target as HTMLElement
    if (ev.key === 'Escape') {
      ev.preventDefault()
      if (t instanceof HTMLInputElement && t !== c) {
        t.blur()
        fill() // the old value back
      } else closeInspector()
    } else if (ev.key === 'Enter' && t instanceof HTMLInputElement) {
      ev.preventDefault()
      t.blur() // commits through 'change'
    }
  })
  c.addEventListener('click', (ev) => {
    const act = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]')
      ?.dataset.act
    if (!act || !open) return
    const { kind, index } = open
    if (act === 'close') closeInspector()
    else if (act === 'labelColorReset') commit('labelColor', '')
    else if (act === 'arrowReset') commit('arrowColor', '')
    else if (act === 'table') revealRow(kind, index)
    else if (act === 'select') {
      const on =
        kind === 'node'
          ? !ctx.nodeObjects[index].isSelected
          : !ctx.edgeObjects[index].isSelected
      if (kind === 'node') tickNodes([index], on)
      else tickEdges([index], on)
      fill()
    }
  })

  bus.on('attributes:inspect', ({ kind, index }) => openInspector(kind, index))
  // an undo, or another edit of the same node, shows here too; a network
  // that is gone closes it
  const follow = () => {
    if (!open) return
    const now =
      open.kind === 'node'
        ? ctx.nodeObjects[open.index]
        : ctx.edgeObjects[open.index]
    if (now !== open.obj) closeInspector()
    else fill()
  }
  bus.on('history:changed', follow)
  bus.on('selection:changed', follow)
  bus.on('network:loaded', closeInspector)
  bus.on('workspace:changed', closeInspector)
}
