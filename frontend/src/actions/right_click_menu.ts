// Port of v2 www/js/object_actions/right_click_menu.js + the context-menu
// builder from event_listeners.js. The graph commands (neighbors, multilayer
// path, downstream path) are pure; the menu is a <select> appended to
// #labelDiv over the clicked node, as in v2. Loader spinner + description
// panel content stay with Phase 13 UI.

import { ctx, SPHERE_RADIUS } from '../three'
import { exists } from '../utils'
import { redrawIntraLayerEdges } from './edge'
import {
  decideNodeLabelFlags,
  repaintNode,
  updateSelectedNodesStore,
} from './node'

let optionsList: HTMLSelectElement | null = null

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

  for (let i = 0; i < ctx.nodeObjects.length; i++) {
    const nodeX = ctx.xBoundMax + ctx.nodeObjects[i].getWorldPosition('x')
    const nodeY = ctx.yBoundMax - ctx.nodeObjects[i].getWorldPosition('y')
    if (
      (nodeX - event.layerX) ** 2 + (nodeY - event.layerY) ** 2 >
      (event.hitRadius ?? SPHERE_RADIUS + 1) ** 2
    )
      continue

    event.preventDefault()
    optionsList = buildMenu(i, nodeX, nodeY)
    container.appendChild(optionsList)
    return
  }
}

function buildMenu(nodeIndex: number, x: number, y: number): HTMLSelectElement {
  const node = ctx.nodeObjects[nodeIndex]
  const select = document.createElement('select')
  select.className = 'optionsBox'
  select.style.position = 'absolute'
  select.style.left = `${x}px`
  select.style.top = `${y}px`
  select.style.display = 'inline-block'

  const options = [
    '-',
    'Select Neighbors',
    'Select MultiLayer Path',
    'Select Downstream Path',
  ]
  if (node.url !== '') options.push('Link')
  if (node.descr !== '') options.push('Description')
  for (const text of options) {
    const option = document.createElement('option')
    option.text = text
    select.appendChild(option)
  }

  select.addEventListener('change', () => {
    executeCommand(nodeIndex, select.options[select.selectedIndex].text)
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
