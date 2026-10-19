// The interactive UpSet plot under the comparison tables of Data Tables
// (Layer Similarity, Group Overlap, Network Comparison). Hovering a bar, its
// dot column or a set row shows the exact sets, the count and the first
// members. Clicking a bar picks what is in exactly those sets (Shift/Ctrl-
// click adds bars); clicking set rows picks their union or intersection. The
// members of a pick can be copied, selected in the scene (every copy in the
// picked sets), or loaded as a new network: the subnetwork they induce,
// through the "Import as" popup like any other load. Set logic and drawing:
// actions/upset.ts.

import {
  memberSets,
  pickMembers,
  selectionNodes,
  selectionSubnetwork,
  upsetBars,
  upsetSvg,
  type UpsetBar,
  type UpsetPick,
  type UpsetSelection,
  type UpsetSet,
  type UpsetSort,
} from '../actions/upset'
import {
  decideNodeLabelFlags,
  repaintNode,
  updateSelectedNodesStore,
} from '../actions/node'
import { finishLoader, startLoader } from '../actions/screen'
import { store } from '../store'
import { ctx } from '../three'
import { escapeHtml } from '../utils'
import { askImportAs, placeNetwork } from './import_as'
import { showTab } from './tabs'

const MAX_BARS = 40
const LISTED = 300 // members listed under the plot; Copy takes them all
const TIP_NAMES = 8
let uid = 0

type Op = 'union' | 'intersection'

function firstOf(items: Iterable<string>, n: number): string[] {
  const out: string[] = []
  for (const e of items) {
    if (out.length === n) break
    out.push(e)
  }
  return out
}

/** The plot with its controls; `fileName` names the SVG download. */
export function upsetBox(
  sets: UpsetSet[],
  element: string,
  fileName: string
): HTMLElement {
  const id = ++uid
  const members = memberSets(sets)
  let sort: UpsetSort = 'size'
  let bars: UpsetBar[] = upsetBars(sets, MAX_BARS, sort)
  let pickedBars = new Set<string>() // bar keys
  let pickedSets: number[] = [] // in click order
  let op: Op = 'union'
  let selection: UpsetSelection = { members: [], sets: [] }

  const one = element.replace(/s$/, '')
  const count = (n: number) => `${n} ${n === 1 ? one : element}`
  const setName = (i: number) => sets[i].name
  const barLabel = (b: UpsetBar) => `${b.sets.map(setName).join(' ∩ ')} only`

  const box = document.createElement('div')
  box.className = 'mt-3 upset-box'
  box.innerHTML = `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
      <span class="small fw-semibold">UpSet plot: ${escapeHtml(element)} the sets share</span>
      <label class="upset-sort-label small text-secondary">Sort
        <select class="form-select form-select-sm upset-sort" aria-label="Sort the bars">
          <option value="size">by size</option>
          <option value="degree">by degree, fewest sets first</option>
          <option value="degree-desc">by degree, most sets first</option>
        </select>
      </label>
      <button type="button" class="btn btn-sm btn-outline-primary upset-download">Download SVG</button>
    </div>
    <div class="small text-secondary mb-1">A bar with one dot: in that set only; with several dots: in exactly those sets. Click a bar to pick it (Shift/Ctrl-click adds bars), or click set names on the left for their union or intersection.</div>
    <div class="upset-stage">
      <div class="upset-plot"></div>
      <div class="upset-tip" role="tooltip" id="upsetTip-${id}" hidden></div>
    </div>
    <div class="upset-pick">
      <div class="d-flex flex-wrap align-items-center gap-2">
        <div class="btn-group btn-group-sm upset-op" role="group" aria-label="Combine the chosen sets" hidden>
          <input type="radio" class="btn-check" name="upsetOp-${id}" id="upsetUnion-${id}" value="union" checked>
          <label class="btn btn-outline-secondary" for="upsetUnion-${id}">Union</label>
          <input type="radio" class="btn-check" name="upsetOp-${id}" id="upsetIntersection-${id}" value="intersection">
          <label class="btn btn-outline-secondary" for="upsetIntersection-${id}">Intersection</label>
        </div>
        <span class="upset-what small" aria-live="polite"></span>
      </div>
      <div class="d-flex flex-wrap gap-2 mt-2">
        <button type="button" class="btn btn-sm btn-primary upset-select" disabled>Select in scene</button>
        <button type="button" class="btn btn-sm btn-outline-primary upset-load" disabled>Load as new network</button>
        <button type="button" class="btn btn-sm btn-outline-secondary upset-copy" disabled>Copy names</button>
        <button type="button" class="btn btn-sm btn-outline-secondary upset-clear" disabled>Clear</button>
      </div>
      <div class="upset-members small mt-2" hidden></div>
      <div class="upset-status small mt-1" aria-live="polite"></div>
    </div>`
  const q = <T extends Element>(sel: string) => box.querySelector<T>(sel)!
  const plot = q<HTMLDivElement>('.upset-plot')
  const tip = q<HTMLDivElement>('.upset-tip')
  const opGroup = q<HTMLDivElement>('.upset-op')
  const what = q<HTMLSpanElement>('.upset-what')
  const list = q<HTMLDivElement>('.upset-members')
  const statusLine = q<HTMLDivElement>('.upset-status')
  const button = (cls: string) => q<HTMLButtonElement>(`.upset-${cls}`)

  const say = (text: string, error = false) => {
    statusLine.textContent = text
    statusLine.classList.toggle('text-danger', error)
    statusLine.classList.toggle('text-secondary', !error)
  }

  // ------------------------------------------------------------- picking
  const currentPick = (): UpsetPick | null =>
    pickedBars.size
      ? { bars: bars.filter((b) => pickedBars.has(b.key)).map((b) => b.sets) }
      : pickedSets.length
        ? { sets: pickedSets, op }
        : null

  function pickLabel(): string {
    if (pickedBars.size) {
      const picked = bars.filter((b) => pickedBars.has(b.key))
      return picked.length > 3
        ? `${picked.length} bars`
        : picked.map(barLabel).join('; ')
    }
    return pickedSets.map(setName).join(op === 'union' ? ' ∪ ' : ' ∩ ')
  }

  function pickBar(key: string, additive: boolean): void {
    pickedSets = []
    if (additive) {
      if (!pickedBars.delete(key)) pickedBars.add(key)
    } else if (pickedBars.size === 1 && pickedBars.has(key)) pickedBars.clear()
    else pickedBars = new Set([key])
    update()
  }

  function pickSet(i: number): void {
    pickedBars.clear()
    pickedSets = pickedSets.includes(i)
      ? pickedSets.filter((s) => s !== i)
      : [...pickedSets, i]
    update()
  }

  function clear(): void {
    pickedBars.clear()
    pickedSets = []
    update()
  }

  // ------------------------------------------------------------- drawing
  function draw(): void {
    plot.innerHTML = upsetSvg(sets, { element, bars, interactive: true })
    plot.querySelector('svg')?.setAttribute('aria-describedby', tip.id)
  }

  // picked bars and sets; the bars that make up a union / intersection
  function paint(): void {
    const chosen = new Set(pickedSets)
    plot.querySelectorAll<SVGGElement>('.up-col').forEach((g) => {
      const b = bars[Number(g.dataset.bar)]
      const picked = pickedBars.has(b.key)
      const covered =
        chosen.size > 0 &&
        (op === 'union'
          ? b.sets.some((i) => chosen.has(i))
          : [...chosen].every((i) => b.sets.includes(i)))
      g.classList.toggle('is-picked', picked)
      g.classList.toggle('is-covered', covered)
      g.setAttribute('aria-pressed', String(picked))
    })
    plot.querySelectorAll<SVGGElement>('.up-set').forEach((g) => {
      const on = chosen.has(Number(g.dataset.set))
      g.classList.toggle('is-picked', on)
      g.setAttribute('aria-pressed', String(on))
    })
    plot
      .querySelectorAll<SVGRectElement>('.up-band')
      .forEach((r) =>
        r.classList.toggle('is-picked', chosen.has(Number(r.dataset.band)))
      )
  }

  function update(): void {
    const pick = currentPick()
    selection = pick ? pickMembers(members, pick) : { members: [], sets: [] }
    paint()
    const n = selection.members.length
    opGroup.hidden = pickedSets.length === 0
    what.innerHTML = pick
      ? `<strong class="upset-count">${n}</strong> ${escapeHtml(n === 1 ? one : element)} in ${escapeHtml(pickLabel())}`
      : 'Nothing picked yet.'
    const nodes = n > 0 && selectionNodes(sets, selection, members).length > 0
    button('select').disabled = !nodes
    button('load').disabled = !nodes
    button('copy').disabled = n === 0
    button('clear').disabled = !pick
    list.hidden = n === 0
    list.innerHTML =
      selection.members.slice(0, LISTED).map(escapeHtml).join(', ') +
      (n > LISTED
        ? ` <span class="text-secondary">… and ${n - LISTED} more (Copy names takes them all)</span>`
        : '')
    say('')
  }

  // ------------------------------------------------------ hover, tooltip
  function showTip(
    anchor: Element,
    title: string,
    n: number,
    names: string[],
    hint: string
  ): void {
    tip.innerHTML = `<div class="upset-tip__title">${escapeHtml(title)}</div>
      <div><strong>${n}</strong> ${escapeHtml(n === 1 ? one : element)}</div>
      ${names.length ? `<div class="upset-tip__names">${names.map(escapeHtml).join(', ')}${n > names.length ? ', …' : ''}</div>` : ''}
      <div class="upset-tip__hint">${hint}</div>`
    tip.hidden = false
    const stage = tip.parentElement!.getBoundingClientRect()
    const r = anchor.getBoundingClientRect()
    let x = r.right - stage.left + 8
    if (x + tip.offsetWidth > stage.width)
      x = r.left - stage.left - tip.offsetWidth - 8
    tip.style.left = `${Math.max(0, x)}px`
    tip.style.top = `${Math.max(0, r.top - stage.top)}px`
  }

  function hover(g: SVGGElement | null): void {
    plot
      .querySelectorAll('.is-hover, .is-related')
      .forEach((el) => el.classList.remove('is-hover', 'is-related'))
    if (!g) {
      tip.hidden = true
      return
    }
    g.classList.add('is-hover')
    if (g.classList.contains('up-col')) {
      const b = bars[Number(g.dataset.bar)]
      for (const i of b.sets) {
        plot
          .querySelector(`.up-set[data-set="${i}"]`)
          ?.classList.add('is-related')
        plot
          .querySelector(`.up-band[data-band="${i}"]`)
          ?.classList.add('is-related')
      }
      showTip(
        g.querySelector('.up-bar') ?? g,
        barLabel(b),
        b.count,
        b.members.slice(0, TIP_NAMES),
        'Click to pick · Shift/Ctrl-click to add'
      )
    } else {
      const i = Number(g.dataset.set)
      plot
        .querySelector(`.up-band[data-band="${i}"]`)
        ?.classList.add('is-hover')
      plot.querySelectorAll<SVGGElement>('.up-col').forEach((c) => {
        if (bars[Number(c.dataset.bar)].sets.includes(i))
          c.classList.add('is-related')
      })
      showTip(
        g,
        setName(i),
        members[i].size,
        firstOf(members[i], TIP_NAMES),
        'Click to add to the union / intersection'
      )
    }
  }

  // ------------------------------------------------------------- actions
  // the picked nodes in the network on screen
  function onScreen(): Set<string> {
    const net = store.get().network
    const ids = new Set<string>()
    for (const part of selectionNodes(sets, selection, members))
      if (part.origin.network === net) for (const i of part.ids) ids.add(i)
    return ids
  }

  function selectInScene(): void {
    const ids = onScreen()
    if (ids.size === 0)
      return say(
        'None of these nodes is in the network on screen; run the comparison again for this network.',
        true
      )
    let n = 0
    ctx.nodeObjects.forEach((node, i) => {
      const on = ids.has(ctx.nodeLayerNames[i])
      if (on) n++
      if (node.isSelected === on) return
      node.isSelected = on
      repaintNode(i)
    })
    decideNodeLabelFlags()
    updateSelectedNodesStore() // announces 'selection:changed'
    say(`Selected ${n} node${n === 1 ? '' : 's'} in the scene.`)
  }

  async function loadAsNetwork(): Promise<void> {
    const parts = selectionNodes(sets, selection, members)
    if (parts.length === 0) return
    const data = selectionSubnetwork(parts)
    const name = `UpSet: ${pickLabel()}`.slice(0, 80)
    const choice = await askImportAs(
      `${count(selection.members.length)} in ${pickLabel()} (UpSet plot)`
    )
    if (!choice) return
    startLoader()
    try {
      say(await placeNetwork(data, choice, name))
      showTab('#panel-main-view')
    } catch (err) {
      say(err instanceof Error ? err.message : 'Loading failed.', true)
    } finally {
      finishLoader()
    }
  }

  function copyNames(): void {
    const n = selection.members.length
    if (!navigator.clipboard)
      return say('The browser blocks clipboard access here.', true)
    navigator.clipboard.writeText(selection.members.join('\n')).then(
      () => say(`Copied ${count(n)} to the clipboard.`),
      () => say('The clipboard refused the names.', true)
    )
  }

  function download(): void {
    // static, in the order on screen
    const svg = upsetSvg(sets, { element, bars })
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}_upset.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  // -------------------------------------------------------------- wiring
  const target = (e: Event) =>
    (e.target as Element | null)?.closest<SVGGElement>('.up-col, .up-set') ??
    null
  const activate = (g: SVGGElement, additive: boolean) => {
    if (g.classList.contains('up-col'))
      pickBar(bars[Number(g.dataset.bar)].key, additive)
    else pickSet(Number(g.dataset.set))
  }
  plot.addEventListener('click', (e) => {
    const g = target(e)
    if (g) activate(g, e.shiftKey || e.ctrlKey || e.metaKey)
  })
  plot.addEventListener('keydown', (e) => {
    const g = target(e)
    if (!g) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activate(g, e.shiftKey || e.ctrlKey || e.metaKey)
    } else if (e.key === 'Escape') clear()
    else {
      const step =
        e.key === 'ArrowRight' || e.key === 'ArrowDown'
          ? 1
          : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
            ? -1
            : 0
      if (!step) return
      e.preventDefault()
      const kind = g.classList.contains('up-col') ? '.up-col' : '.up-set'
      const all = [...plot.querySelectorAll<SVGGElement>(kind)]
      all[(all.indexOf(g) + step + all.length) % all.length]?.focus()
    }
  })
  plot.addEventListener('pointerover', (e) => hover(target(e)))
  plot.addEventListener('pointerleave', () => hover(null))
  plot.addEventListener('focusin', (e) => hover(target(e)))
  plot.addEventListener('focusout', () => hover(null))
  plot.addEventListener('scroll', () => hover(null))

  opGroup.addEventListener('change', (e) => {
    op = (e.target as HTMLInputElement).value as Op
    update()
  })
  q<HTMLSelectElement>('.upset-sort').addEventListener('change', (e) => {
    sort = (e.target as HTMLSelectElement).value as UpsetSort
    bars = upsetBars(sets, MAX_BARS, sort)
    draw()
    paint()
  })
  button('select').addEventListener('click', selectInScene)
  button('load').addEventListener('click', () => void loadAsNetwork())
  button('copy').addEventListener('click', copyNames)
  button('clear').addEventListener('click', clear)
  q('.upset-download').addEventListener('click', download)

  draw()
  update()
  return box
}
