// The scene side of a knockout (Analyze → Perturbation): fade or hide the
// knocked-out nodes and edges, colour nodes by their change, and put it all
// back. One command for the three: it sets node colours and opacities and
// edge opacities, and undoes to what was there before.

import { bus } from '../bus'
import { redrawIntraLayerEdges } from '../actions/edge'
import { repaintNode } from '../actions/node'
import { ctx, type ColorPrioritySource } from '../three'
import type { Command } from './base'

export interface NodeLook {
  color?: string
  imported?: string
  alpha?: number
}

export interface Looks {
  nodes: Map<number, NodeLook> // node index -> look
  edges: Map<number, number> // edge index -> opacity factor
  priority?: ColorPrioritySource // node colour source, when colours change
}

/** How the given nodes and edges look now, in full. */
export function captureLooks(nodes: number[], edges: number[]): Looks {
  return {
    nodes: new Map(
      nodes.map((i) => {
        const n = ctx.nodeObjects[i]
        return [
          i,
          { color: n.color, imported: n.importedColor, alpha: n.alpha },
        ]
      })
    ),
    edges: new Map(edges.map((i) => [i, ctx.edgeObjects[i].opacityFactor])),
    priority: ctx.nodeColorPrioritySource,
  }
}

function applyLooks(l: Looks): void {
  if (l.priority) ctx.nodeColorPrioritySource = l.priority
  for (const [i, s] of l.nodes) {
    const n = ctx.nodeObjects[i]
    if (!n) continue
    if (s.alpha !== undefined) n.setAlpha(s.alpha)
    if (s.color === undefined && s.imported === undefined) continue
    if (s.color !== undefined) n.color = s.color
    if (s.imported !== undefined) n.importedColor = s.imported
    // the colour the priority shows, or the selection colour
    repaintNode(i)
    bus.emit('node:color-changed', { nodeId: n.nodeLayerName, color: n.color })
  }
  for (const [i, f] of l.edges) {
    const e = ctx.edgeObjects[i]
    if (e) e.opacityFactor = f
  }
  if (l.edges.size) {
    redrawIntraLayerEdges()
    ctx.renderInterLayerEdgesFlag = true
  }
}

export class LookCommand implements Command {
  private readonly before: Looks
  constructor(
    public description: string,
    private readonly after: Looks
  ) {
    this.before = captureLooks([...after.nodes.keys()], [...after.edges.keys()])
  }
  execute(): void {
    applyLooks(this.after)
  }
  undo(): void {
    applyLooks(this.before)
  }
}
