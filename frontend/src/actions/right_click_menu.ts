// Port of v2 www/js/object_actions/right_click_menu.js + the context-menu
// builder from event_listeners.js. The graph commands (neighbors, multilayer
// path, downstream path) are pure; the menu is a <select> appended to
// #labelDiv over the clicked node, as in v2. Loader spinner + description
// panel content stay with Phase 13 UI.
//
// With nodes selected, the menu also lists what can be done to the selection
// ("Selected nodes (N)"), on a node or on the background: focus the camera,
// copy the names, and whatever the panels register with
// registerSelectionAction (Explore's walks and paths, Style, …).

import { ctx, SPHERE_RADIUS } from '../three'
import { exists } from '../utils'
import { redrawIntraLayerEdges } from './edge'
import {
  decideNodeLabelFlags,
  repaintNode,
  updateSelectedNodesStore,
} from './node'
import { focusOnNodes } from './search'

let optionsList: HTMLSelectElement | null = null

// An action on the selected nodes (indices into ctx.nodeObjects)
export interface SelectionAction {
  label: string | ((selected: number[]) => string)
  when?: (selected: number[]) => boolean // offered only when true
  run: (selected: number[]) => void
  order?: number // place in the menu, low first (default 50)
}

const selected = () =>
  ctx.nodeObjects.flatMap((n, i) => (n.isSelected ? [i] : []))

const uniqueNames = (indices: number[]) => [
  ...new Set(indices.map((i) => ctx.nodeObjects[i].name)),
]

// built in; the panels add theirs after these
const selectionActions: SelectionAction[] = [
  {
    label: 'Focus Camera on Selection',
    order: 60,
    run: (sel) => {
      focusOnNodes(sel)
    },
  },
  {
    label: (sel) => `Copy Names (${uniqueNames(sel).length})`,
    order: 61,
    run: (sel) => {
      void navigator.clipboard?.writeText(uniqueNames(sel).join('\n'))
    },
  },
]

export function registerSelectionAction(action: SelectionAction): void {
  selectionActions.push(action)
}

// the actions offered for this selection, with their labels
export function selectionMenu(
  sel: number[]
): { label: string; run: () => void }[] {
  if (!sel.length) return []
  return [...selectionActions]
    .sort((a, b) => (a.order ?? 50) - (b.order ?? 50))
    .filter((a) => !a.when || a.when(sel))
    .map((a) => ({
      label: typeof a.label === 'string' ? a.label : a.label(sel),
      run: () => a.run(sel),
    }))
}

function selectNodeAndEdge(nodeIndex: number, edgeIndex: number): void {
  ctx.nodeObjects[nodeIndex].isSelected = true
  repaintNode(nodeIndex)
  ctx.edgeObjects[edgeIndex].select()
}

// Select every direct neighbor of `node` and the connecting edges.
export function selectNeighbors(node: number): void {
  ctx.edgeObjects.forEach((edge, i) => {
    const index1 = ctx.nodeLayerNames.indexOf(edge.source)
    const index2 = ctx.nodeLayerNames.indexOf(edge.target)
    if (index1 === node) selectNodeAndEdge(index2, i)
    else if (index2 === node) selectNodeAndEdge(index1, i)
  })
}

// Walk outward from `node`, selecting neighbors that sit on layers other
// than the starting layer and the current node's layer (v2 semantics).
export function selectMultiLayerPath(node: number): void {
  const startingLayer = ctx.nodeGroups[ctx.nodeLayerNames[node]]
  const selected: number[] = []
  const checked: number[] = []
  let currentNode = node

  for (;;) {
    ctx.edgeObjects.forEach((edge, i) => {
      const index1 = ctx.nodeLayerNames.indexOf(edge.source)
      const index2 = ctx.nodeLayerNames.indexOf(edge.target)
      const currentLayer = ctx.nodeGroups[ctx.nodeLayerNames[currentNode]]

      const trySelect = (other: number): void => {
        const otherLayer = ctx.nodeGroups[ctx.nodeLayerNames[other]]
        if (
          otherLayer !== startingLayer && // path must not re-enter the starting layer
          otherLayer !== currentLayer && // or stay on its own layer
          !exists(selected, other)
        ) {
          selected.push(other)
          selectNodeAndEdge(other, i)
        }
      }

      if (index1 === currentNode) trySelect(index2)
      else if (index2 === currentNode) trySelect(index1)
    })

    checked.push(currentNode)
    const unchecked = selected.filter((x) => !checked.includes(x))
    if (unchecked.length === 0) return
    currentNode = unchecked[0]
  }
}

// Recursively select the downstream path: follow neighbors whose layer has
// not been visited on the current path.
export function selectDownstreamPath(node: number): void {
  const layerPath = [ctx.nodeGroups[ctx.nodeLayerNames[node]]]
  recursiveDownstreamHighlight(layerPath, node, null, [])
}

function recursiveDownstreamHighlight(
  layerPath: string[],
  currentNode: number,
  previousNode: number | null,
  checkedNodes: number[]
): void {
  if (exists(checkedNodes, currentNode)) return
  checkedNodes.push(currentNode)

  if (previousNode !== null) {
    const edge = getInterLayerEdge(currentNode, previousNode)
    if (edge !== null) selectNodeAndEdge(currentNode, edge)
  }

  for (const neighbor of getNeighbors(currentNode)) {
    const toCheckLayer = ctx.nodeGroups[ctx.nodeLayerNames[neighbor]]
    if (!exists(layerPath, toCheckLayer)) {
      layerPath.push(toCheckLayer)
      recursiveDownstreamHighlight(
        layerPath,
        neighbor,
        currentNode,
        checkedNodes
      )
      layerPath.pop()
    }
  }
}

// Index of the inter-layer edge connecting the two nodes, or null.
function getInterLayerEdge(node1: number, node2: number): number | null {
  for (let i = 0; i < ctx.edgeObjects.length; i++) {
    if (!ctx.edgeObjects[i].interLayer) continue
    const index1 = ctx.nodeLayerNames.indexOf(ctx.edgeObjects[i].source)
    const index2 = ctx.nodeLayerNames.indexOf(ctx.edgeObjects[i].target)
    if (
      (node1 === index1 && node2 === index2) ||
      (node1 === index2 && node2 === index1)
    )
      return i
  }
  return null
}

// All neighbor node indexes (v2's getInterLayerNeighbors — despite the name
// it walks every edge; the layerPath check filters same-layer hops).
function getNeighbors(node: number): number[] {
  const neighbors: number[] = []
  ctx.edgeObjects.forEach((edge) => {
    const index1 = ctx.nodeLayerNames.indexOf(edge.source)
    const index2 = ctx.nodeLayerNames.indexOf(edge.target)
    if (node === index1) neighbors.push(index2)
    else if (node === index2) neighbors.push(index1)
  })
  return neighbors
}

// v2 executeCommand's tail: redraw + labels + store sync after any command.
function finishCommand(): void {
  ctx.renderInterLayerEdgesFlag = true
  redrawIntraLayerEdges()
  decideNodeLabelFlags()
  updateSelectedNodesStore()
}

export function removeContextMenu(): void {
  if (optionsList) {
    optionsList.remove()
    optionsList = null
  }
}

// Right-click on a node: build the options <select> over it (v2
// replaceContextMenuOverNode from event_listeners.js).
export function replaceContextMenuOverNode(event: {
  layerX: number
  layerY: number
  preventDefault: () => void
  // a fingertip covers more than a cursor: touch passes a larger radius
  hitRadius?: number
}): void {
  removeContextMenu()
  const container =
    typeof document === 'undefined' ? null : document.getElementById('labelDiv')
  if (!container) return
  const sel = selected()

  for (let i = 0; i < ctx.nodeObjects.length; i++) {
    const nodeX = ctx.xBoundMax + ctx.nodeObjects[i].getWorldPosition('x')
    const nodeY = ctx.yBoundMax - ctx.nodeObjects[i].getWorldPosition('y')
    if (
      (nodeX - event.layerX) ** 2 + (nodeY - event.layerY) ** 2 >
      (event.hitRadius ?? SPHERE_RADIUS + 1) ** 2
    )
      continue

    event.preventDefault()
    optionsList = buildMenu(i, nodeX, nodeY, sel)
    container.appendChild(optionsList)
    return
  }
  // the background, with nodes selected: the selection's actions alone
  if (!sel.length) return
  event.preventDefault()
  optionsList = buildMenu(null, event.layerX, event.layerY, sel)
  container.appendChild(optionsList)
}

function buildMenu(
  nodeIndex: number | null,
  x: number,
  y: number,
  sel: number[]
): HTMLSelectElement {
  const select = document.createElement('select')
  select.className = 'optionsBox'
  select.style.position = 'absolute'
  select.style.left = `${x}px`
  select.style.top = `${y}px`
  select.style.display = 'inline-block'
  const add = (parent: HTMLElement, text: string, value = text) => {
    const option = document.createElement('option')
    option.text = text
    option.value = value
    parent.appendChild(option)
  }
  add(select, '-')

  if (nodeIndex !== null) {
    const node = ctx.nodeObjects[nodeIndex]
    const options = [
      'Select Neighbors',
      'Select MultiLayer Path',
      'Select Downstream Path',
    ]
    if (node.url !== '') options.push('Link')
    if (node.descr !== '') options.push('Description')
    // a group of its own only when the selection's group follows
    const group = sel.length ? document.createElement('optgroup') : select
    if (group instanceof HTMLOptGroupElement) {
      group.label = node.name
      select.appendChild(group)
    }
    for (const text of options) add(group, text)
  }

  const actions = selectionMenu(sel)
  if (actions.length) {
    const group = document.createElement('optgroup')
    group.label = `Selected nodes (${sel.length})`
    actions.forEach((a, i) => add(group, a.label, `selection:${i}`))
    select.appendChild(group)
  }

  select.addEventListener('change', () => {
    const value = select.value
    if (value.startsWith('selection:')) {
      actions[Number(value.slice('selection:'.length))]?.run()
      finishCommand()
      select.value = '-' // ready for another action on the same selection
    } else if (nodeIndex !== null) executeCommand(nodeIndex, value)
  })
  return select
}

// v2 setupDescrDiv + 'Description' command: close button + paragraph created
// once, paragraph text swapped per node. textContent (not v2's innerHTML) —
// descriptions come from uploaded/external session files.
function showDescription(descr: string): void {
  const descrDiv = document.getElementById('descrDiv')
  if (!descrDiv) return
  let p = descrDiv.querySelector('p')
  if (!p) {
    const btn = document.createElement('button')
    btn.id = 'closeButton'
    btn.textContent = 'X'
    btn.onclick = () => (descrDiv.style.display = 'none')
    p = document.createElement('p')
    p.className = 'descrDiv_paragraph'
    descrDiv.appendChild(btn)
    descrDiv.appendChild(p)
  }
  p.textContent = descr
  descrDiv.style.display = 'inline-block'
}

// XSS fix: only http(s)/mailto — blocks javascript:/data: payloads smuggled
// in via an uploaded node-attributes file's Url column. noopener/noreferrer
// so the opened tab can't reach back into this window via window.opener.
function openNodeLink(url: string): void {
  if (!/^(https?:|mailto:)/i.test(url.trim())) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function executeCommand(nodeIndex: number, option: string): void {
  const node = ctx.nodeObjects[nodeIndex]
  if (option === '-') return

  if (option === 'Select Neighbors') selectNeighbors(nodeIndex)
  else if (option === 'Select MultiLayer Path') selectMultiLayerPath(nodeIndex)
  else if (option === 'Select Downstream Path') selectDownstreamPath(nodeIndex)
  else if (option === 'Link') openNodeLink(node.url)
  else if (option === 'Description') showDescription(node.descr)

  finishCommand()
}
