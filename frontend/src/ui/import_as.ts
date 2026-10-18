// "Import as": every load — a network file, an example, a database import, a
// saved session or a shared link — first asks in a popup how to show it, as a
// multilayered network (every layer on its own floor) or as a single 3D
// network (one graph in space), and whether it replaces the current network
// or is added to it: as new layers (multilayered), or into the graph itself
// (single 3D). A new network is laid out with Fruchterman-Reingold unless the
// user unticks it (random positions). A saved session always replaces the
// current network and keeps its coordinates.

import type { NetworkData } from '../api/client'
import { loadNetwork } from '../actions/network'
import { applyLayout } from '../actions/layout'
import {
  expandNetwork,
  linkSameNames,
  mergeAsLayers,
  unlinkSameNames,
} from '../actions/merge'
import { redrawIntraLayerEdges, setChannelColor } from '../actions/edge'
import { restyleNodeLabels } from '../actions/labels'
import { nodeStyle } from '../actions/style'
import {
  network3dSessionState,
  reconcileNetworkMode,
  restoreNetwork3dState,
  setNetworkMode,
} from '../actions/modes'
import { registerLoad, snapshotActive } from '../actions/workspace'
import { store } from '../store'
import { ctx } from '../three'
import type { NetworkMode } from '../three/runtime'
import { escapeHtml } from '../utils'
import {
  dismissOneLayerPrompt,
  showAsSingle3d,
  showOneLayerOnFloor,
} from './mode'

// show as × into the view: replace (multilayered), layer (multilayered, add),
// single (single 3D), expand (single 3D, add)
export type ImportMode = 'replace' | 'layer' | 'single' | 'expand'
// layout: Fruchterman-Reingold on what is new (multilayered); a single 3D
// network is always laid out in 3D
export interface ImportChoice {
  mode: ImportMode
  layout: boolean
  // lines between copies of a node (same name) in different layers: add the
  // missing ones, remove the ones an importer drew, or keep what came in
  sameNames: 'add' | 'remove' | 'keep'
}

const DIALOG_HTML = `
<dialog id="importAsDialog" class="import-as" aria-labelledby="importAsTitle">
  <form method="dialog">
    <div class="import-as__title" id="importAsTitle">Import as</div>
    <div class="import-as__what" id="importAsWhat"></div>
    <fieldset class="import-as__group">
      <legend>Show as</legend>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="importAsShow" id="importAs_multilayer" value="multilayer" />
        <label class="form-check-label" for="importAs_multilayer">Multilayered network — every layer on its own floor</label>
      </div>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="importAsShow" id="importAs_single3d" value="single" />
        <label class="form-check-label" for="importAs_single3d">Single 3D network — one graph in space, no floors</label>
      </div>
    </fieldset>
    <fieldset class="import-as__group">
      <legend>Into the view</legend>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="importAsWhere" id="importAs_replace" value="replace" />
        <label class="form-check-label" for="importAs_replace">Replace the current network</label>
      </div>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="importAsWhere" id="importAs_add" value="add" />
        <label class="form-check-label" for="importAs_add" id="importAs_addLabel"></label>
      </div>
      <div class="form-text d-none" id="importAsAddNote"></div>
    </fieldset>
    <div class="form-check" id="importAsLinkRow">
      <input class="form-check-input" type="checkbox" id="importAs_link" />
      <label class="form-check-label" for="importAs_link">Link nodes with the same name across layers — a line between each node’s copies</label>
    </div>
    <div class="form-check" id="importAsLayoutRow">
      <input class="form-check-input" type="checkbox" id="importAs_layout" checked />
      <label class="form-check-label" for="importAs_layout">Lay out with Fruchterman-Reingold — unticked, nodes get random positions</label>
    </div>
    <div class="d-flex justify-content-end gap-2 mt-3">
      <button type="submit" value="cancel" class="btn btn-outline-secondary btn-sm" id="importAsCancel">Cancel</button>
      <button type="submit" value="ok" class="btn btn-primary btn-sm" id="importAsOk">Load</button>
    </div>
  </form>
</dialog>`

// the popup offers the previous answers again
let lastShow: NetworkMode = 'multilayer'
let lastAdd = false

const hasNetwork = () => !!store.get().network && !!ctx.scene?.exists()

const radio = (id: string) => document.getElementById(id) as HTMLInputElement

// What "add" means for the chosen view, and for what is on screen; the layout
// box only for networks shown multilayered (single 3D is always laid out)
function syncAddLabel(): void {
  const single = radio('importAs_single3d').checked
  document
    .getElementById('importAsLayoutRow')!
    .classList.toggle('d-none', single || asking === 'session')
  // expanding merges names into one node: nothing to link
  document
    .getElementById('importAsLinkRow')!
    .classList.toggle(
      'd-none',
      asking === 'session' || (single && radio('importAs_add').checked)
    )
  document.getElementById('importAs_addLabel')!.textContent = !single
    ? 'Add to the current network as new layer(s) — copies of a node are linked across layers'
    : hasNetwork() && ctx.networkMode === 'single'
      ? 'Add to the current network — new nodes and edges join the graph; what is there stays put'
      : 'Add to the current network — the two become one graph, laid out in 3D'
}

function dialog(): HTMLDialogElement {
  let d = document.getElementById('importAsDialog') as HTMLDialogElement | null
  if (!d) {
    document.body.insertAdjacentHTML('beforeend', DIALOG_HTML)
    d = document.getElementById('importAsDialog') as HTMLDialogElement
    d.querySelectorAll(
      'input[name="importAsShow"], input[name="importAsWhere"]'
    ).forEach((r) => r.addEventListener('change', syncAddLabel))
  }
  return d
}

let asking: 'network' | 'session' = 'network'

const preset = () =>
  (window as unknown as { __arenaImportAs?: ImportMode }).__arenaImportAs

// The popup: how to show `what` and where it goes; null when cancelled.
// `importer`: a database import, whose layers come linked by name already
function ask(
  what: string,
  canAdd: boolean,
  why: string,
  importer = false
): Promise<ImportChoice | null> {
  const d = dialog()
  if (d.open) return Promise.resolve(null) // already asking about another load
  asking = canAdd || why.startsWith('Nothing') ? 'network' : 'session'
  radio('importAs_layout').checked = true // Fruchterman-Reingold by default
  // same-name links: on for database imports (as they always were), off for
  // files, which bring their own inter-layer edges
  radio('importAs_link').checked = importer
  radio(
    `importAs_${lastShow === 'single' ? 'single3d' : 'multilayer'}`
  ).checked = true
  const add = radio('importAs_add')
  add.disabled = !canAdd
  radio(canAdd && lastAdd ? 'importAs_add' : 'importAs_replace').checked = true
  const note = document.getElementById('importAsAddNote')!
  note.textContent = why
  note.classList.toggle('d-none', canAdd)
  syncAddLabel()
  document.getElementById('importAsWhat')!.innerHTML =
    `Loading <b>${escapeHtml(what)}</b>`
  d.returnValue = ''
  return new Promise((resolve) => {
    d.addEventListener(
      'close',
      () => {
        if (d.returnValue !== 'ok') return resolve(null)
        lastShow = radio('importAs_single3d').checked ? 'single' : 'multilayer'
        lastAdd = canAdd && add.checked
        resolve({
          mode:
            lastShow === 'single'
              ? lastAdd
                ? 'expand'
                : 'single'
              : lastAdd
                ? 'layer'
                : 'replace',
          layout: radio('importAs_layout').checked,
          sameNames: radio('importAs_link').checked
            ? 'add'
            : importer
              ? 'remove'
              : 'keep',
        })
      },
      { once: true }
    )
    d.showModal()
    document.getElementById('importAsOk')?.focus()
  })
}

// A network (file, example, database import): how to show it, where it goes.
export function askImportAs(
  what: string,
  { importer = false } = {}
): Promise<ImportChoice | null> {
  // automation (e2e tests) may preset the answer; nodes stay where they land
  const given = preset()
  if (given)
    return Promise.resolve({ mode: given, layout: false, sameNames: 'keep' })
  return ask(what, hasNetwork(), 'Nothing is loaded yet to add to.', importer)
}

// A saved session or a shared link replaces the current network; only the
// view is asked. 'keep' = the session's own view (automation only).
export async function askSessionView(
  what: string
): Promise<NetworkMode | 'keep' | null> {
  if (preset()) return 'keep'
  const choice = await ask(
    what,
    false,
    'A saved session replaces the current network.'
  )
  if (!choice) return null
  return choice.mode === 'single' ? 'single' : 'multilayer'
}

// After a session loads: the view the user asked for.
export async function showSessionAs(view: NetworkMode | 'keep'): Promise<void> {
  if (view === 'single' && ctx.networkMode !== 'single') await showAsSingle3d()
  else if (view === 'multilayer' && ctx.networkMode !== 'multilayer')
    await setNetworkMode('multilayer')
  dismissOneLayerPrompt()
}

// Adding layers reloads the merged network; the loaded layers and nodes get
// their positions back and the new layers line up after the last one.
type Transforms = {
  scene: number[]
  layers: Map<string, number[]>
  nodes: Map<string, number[]>
}
function snapshotTransforms(): Transforms {
  const s = ctx.scene!
  return {
    scene: [
      s.getPosition('x'),
      s.getPosition('y'),
      s.getScale(),
      s.getRotation('x'),
      s.getRotation('y'),
      s.getRotation('z'),
    ],
    layers: new Map(
      ctx.layers.map((l) => [
        l.name,
        [
          l.getPosition('x'),
          l.getPosition('y'),
          l.getPosition('z'),
          l.getRotation('x'),
          l.getRotation('y'),
          l.getRotation('z'),
          l.getScale(),
        ],
      ])
    ),
    nodes: new Map(
      ctx.nodeObjects.map((n, i) => [
        ctx.nodeLayerNames[i],
        [n.getPosition('x'), n.getPosition('y'), n.getPosition('z')],
      ])
    ),
  }
}
function restoreTransforms(t: Transforms): void {
  const s = ctx.scene
  if (!s?.exists()) return
  const [px, py, sc, rx, ry, rz] = t.scene
  s.setPosition('x', px)
  s.setPosition('y', py)
  s.setScale(sc)
  s.setRotation('x', rx)
  s.setRotation('y', ry)
  s.setRotation('z', rz)
  let maxX = -Infinity
  for (const v of t.layers.values()) maxX = Math.max(maxX, v[0])
  let added = 0
  for (const l of ctx.layers) {
    const v = t.layers.get(l.name)
    if (v) {
      l.setPosition('x', v[0])
      l.setPosition('y', v[1])
      l.setPosition('z', v[2])
      l.setRotation('x', v[3])
      l.setRotation('y', v[4])
      l.setRotation('z', v[5])
      l.setScale(v[6])
    } else if (Number.isFinite(maxX)) {
      added++
      l.setPosition('x', maxX + 480 * added)
      l.setPosition('y', 0)
      l.setPosition('z', 0)
    }
  }
  ctx.nodeObjects.forEach((n, i) => {
    const v = t.nodes.get(ctx.nodeLayerNames[i])
    if (!v) return
    n.setPosition('x', v[0])
    n.setPosition('y', v[1])
    n.setPosition('z', v[2])
  })
  redrawIntraLayerEdges()
  ctx.renderInterLayerEdgesFlag = true
  ctx.renderLayerLabelsFlag = true
  ctx.renderNodeLabelsFlag = true
}

// Fruchterman-Reingold for the given layers (each in its own plane)
async function layOut(
  layers: string[],
  onStage?: (stage: string) => void
): Promise<string> {
  const net = store.get().network
  if (!net || layers.length === 0) return ''
  onStage?.('Laying out (Fruchterman-Reingold)')
  try {
    await applyLayout({
      nodes: net.nodes,
      edges: net.edges,
      algorithm: 'Fruchterman-Reingold',
      scope: 'perLayer',
      selected_layers: layers,
      selected_channels: store.get().selectedChannels,
    })
    return ' Laid out with Fruchterman-Reingold.'
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err)
    return ` The Fruchterman-Reingold layout failed (${why}); the nodes keep random positions.`
  }
}

// Put a fetched network in the scene as the user chose; the status line text.
// `onStage` names each step (for a progress bar).
export async function placeNetwork(
  data: NetworkData,
  choice: ImportChoice,
  name: string,
  onStage?: (stage: string) => void
): Promise<string> {
  const { mode } = choice
  onStage?.('Building the scene')
  // copies of a node across layers: linked, unlinked, or as they came
  let linked = ''
  if (mode !== 'expand' && choice.sameNames === 'add') {
    const done = linkSameNames(data)
    data = done.network
    if (done.links)
      linked = ` Linked ${done.links} cop${done.links === 1 ? 'y' : 'ies'} of nodes across layers.`
  } else if (mode !== 'expand' && choice.sameNames === 'remove')
    data = unlinkSameNames(data).network
  if (mode === 'layer' && hasNetwork()) {
    // layers go on floors: a single 3D network is spread back into its layers
    if (ctx.networkMode === 'single') await setNetworkMode('multilayer')
    const current = store.get().network!
    const kept = snapshotTransforms()
    const merged = mergeAsLayers(current, data, choice.sameNames === 'add')
    loadNetwork(merged.network)
    restoreTransforms(kept)
    dismissOneLayerPrompt()
    const s = merged.layers.length === 1 ? '' : 's'
    // only the new layers are laid out; the others stay as they were
    const laid = choice.layout ? await layOut(merged.layers, onStage) : ''
    return `Added layer${s} ${merged.layers.join(', ')}: ${data.nodes.length} nodes, ${data.edges.length} edges, ${merged.links} link${merged.links === 1 ? '' : 's'} to copies in the other layers.${linked}${laid || ` Run a layout for the new layer${s}.`}`
  }
  if (mode === 'expand' && hasNetwork()) {
    const in3d = ctx.networkMode === 'single'
    const grown = expandView(store.get().network!, data)
    const n = `${grown.added} new node${grown.added === 1 ? '' : 's'}, ${grown.edges} new edge${grown.edges === 1 ? '' : 's'}`
    if (in3d)
      return `Expanded the view: ${n}; the nodes already there stayed where they were.`
    // from floors to one graph: the joined network is laid out in 3D
    onStage?.('Laying out in 3D (Fruchterman-Reingold)')
    await showAsSingle3d()
    return `Joined into one graph: ${n}, laid out as one 3D network.`
  }
  snapshotActive()
  loadNetwork(data)
  registerLoad(name)
  // the popup already answered the one-layer question: floor, or 3D
  if (mode === 'single') {
    onStage?.('Laying out in 3D (Fruchterman-Reingold)')
    await showAsSingle3d()
    return `Loaded network: ${data.layers.length} layers, ${data.nodes.length} nodes, ${data.edges.length} edges as one 3D network.${linked}`
  }
  if (ctx.layers.length === 1) await showOneLayerOnFloor()
  const laid = choice.layout ? await layOut(data.layers, onStage) : ''
  return `Loaded network: ${data.layers.length} layers, ${data.nodes.length} nodes, ${data.edges.length} edges.${linked}${laid}`
}

// Expand the network on screen with another: the merged graph is rebuilt,
// then everything that was there gets its place and look back, and the new
// nodes are put next to the neighbours they link to.
function expandView(
  current: NetworkData,
  data: NetworkData
): { added: number; edges: number } {
  const kept = snapshotTransforms()
  const layered = network3dSessionState() // stacked layers remember their floors
  const floors = new Map(ctx.layers.map((l) => [l.name, l.floorVisible]))
  const channelColors = { ...ctx.channelColors }
  const looks = new Map(
    ctx.nodeObjects.map((n, i) => [
      ctx.nodeLayerNames[i],
      {
        color: n.getColor(),
        scale: n.getScale(),
        url: n.url,
        descr: n.descr,
        annotations: [...n.annotations],
        style: nodeStyle(i), // Edit → Style
      },
    ])
  )
  const grown = expandNetwork(current, data)
  loadNetwork(grown.network)
  restoreTransforms(kept)
  for (const l of ctx.layers) {
    const floor = floors.get(l.name)
    if (floor !== undefined) l.toggleFloor(floor)
  }
  for (const [channel, color] of Object.entries(channelColors))
    if (channel in ctx.channelColors) setChannelColor(channel, color)
  ctx.nodeObjects.forEach((n, i) => {
    const look = looks.get(ctx.nodeLayerNames[i])
    if (!look) return
    n.setColor(look.color)
    n.setScale(look.scale)
    n.url = look.url
    n.descr = look.descr
    n.annotations = look.annotations
    const st = look.style
    n.setGeometry(st.shape)
    n.setAlpha(st.alpha)
    n.setBorder(st.border.color, st.border.width)
    n.setStretch(st.stretch)
    n.label = st.label
    n.labelColor = st.labelColor
    n.labelSize = st.labelSize
  })
  restyleNodeLabels()
  if (layered) restoreNetwork3dState(layered.layers, layered.nodes)
  placeNearNeighbours(new Set(grown.added))
  redrawIntraLayerEdges()
  ctx.renderInterLayerEdgesFlag = true
  reconcileNetworkMode()
  dismissOneLayerPrompt()
  return { added: grown.added.length, edges: grown.edges }
}

type Point = [number, number, number]
const AXES = ['x', 'y', 'z'] as const

// New nodes go next to their placed neighbours (in rounds, so a chain of new
// nodes grows outwards); nodes linked to nothing placed are scattered across
// the view. An axis the view is flat on (a 2D network) stays flat.
function placeNearNeighbours(added: Set<string>): void {
  if (added.size === 0) return
  const pos = new Map<string, Point>()
  ctx.nodeObjects.forEach((n, i) => {
    const id = ctx.nodeLayerNames[i]
    if (!added.has(id))
      pos.set(id, [n.getPosition('x'), n.getPosition('y'), n.getPosition('z')])
  })
  const placed = [...pos.values()]
  if (placed.length === 0) return // nothing to grow from: keep the load's own spread
  const lo = AXES.map((_, a) => Math.min(...placed.map((p) => p[a])))
  const hi = AXES.map((_, a) => Math.max(...placed.map((p) => p[a])))
  const span = AXES.map((_, a) => hi[a] - lo[a])
  const flat = span.map((s) => s < 1e-6)
  const radius = Math.max(...span) * 0.06 || 10
  const neighbours = new Map<string, string[]>()
  for (const e of store.get().network?.edges ?? []) {
    neighbours.set(e.src, [...(neighbours.get(e.src) ?? []), e.trg])
    neighbours.set(e.trg, [...(neighbours.get(e.trg) ?? []), e.src])
  }
  let pending = [...added]
  while (pending.length > 0) {
    const waiting: string[] = []
    for (const id of pending) {
      const near = (neighbours.get(id) ?? [])
        .map((m) => pos.get(m))
        .filter((p): p is Point => p !== undefined)
      if (near.length === 0) {
        waiting.push(id)
        continue
      }
      pos.set(
        id,
        AXES.map((_, a) => {
          const mean = near.reduce((sum, p) => sum + p[a], 0) / near.length
          return flat[a] ? mean : mean + (Math.random() * 2 - 1) * radius
        }) as Point
      )
    }
    if (waiting.length === pending.length) {
      for (const id of waiting)
        pos.set(
          id,
          AXES.map((_, a) => lo[a] + Math.random() * span[a]) as Point
        )
      break
    }
    pending = waiting
  }
  ctx.nodeObjects.forEach((n, i) => {
    const p = pos.get(ctx.nodeLayerNames[i])
    if (!p || !added.has(ctx.nodeLayerNames[i])) return
    AXES.forEach((axis, a) => n.setPosition(axis, p[a]))
  })
}
