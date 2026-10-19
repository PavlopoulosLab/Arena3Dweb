// Delete nodes for good (right-click → Selected nodes → Delete …): the nodes
// and every edge touching them leave the network. The scene is rebuilt from
// its own session without them, as switching between loaded networks does,
// so positions, styles, colours, annotations and the view stay; one undo
// step brings everything back.

import type { SessionData } from '../api/client'
import { history } from '../commands/base'
import { LoadNetworkCommand } from '../commands/scene'
import { ctx } from '../three'
import { buildFromSession } from './network'
import { collectSession } from './session'

/** The session without the nodes `ids` (name_layer) and the edges touching them. */
export function withoutNodes(s: SessionData, ids: Set<string>): SessionData {
  return {
    ...s,
    nodes: s.nodes.filter((n) => !ids.has(`${n.name}_${n.layer}`)),
    edges: s.edges.filter((e) => !ids.has(e.src) && !ids.has(e.trg)),
  }
}

/** How many edges on screen touch the nodes at `indices`. */
export function edgesTouching(indices: number[]): number {
  const gone = new Set(indices)
  return ctx.edgeObjects.filter(
    (e) => gone.has(e.sourceNodeIndex) || gone.has(e.targetNodeIndex)
  ).length
}

/** Deletes the nodes at `indices` and their edges, as one undoable step. */
export function deleteNodes(indices: number[]): void {
  const ids = new Set(indices.map((i) => ctx.nodeLayerNames[i]))
  if (ids.size === 0) return
  // communities are not part of a session: the nodes that stay keep theirs
  const clusters = new Map(
    ctx.nodeObjects
      .filter((n) => n.cluster && !ids.has(n.nodeLayerName))
      .map((n) => [n.nodeLayerName, [n.cluster, n.clusterColor] as const])
  )
  const session = withoutNodes(collectSession(), ids)
  const command = new LoadNetworkCommand(() => {
    buildFromSession(session)
    for (const n of ctx.nodeObjects) {
      const kept = clusters.get(n.nodeLayerName)
      if (kept) [n.cluster, n.clusterColor] = kept
    }
  })
  command.description = `Delete ${ids.size === 1 ? 'a node' : `${ids.size} nodes`}`
  ctx.lastLoadSource = 'session'
  history.execute(command)
}
