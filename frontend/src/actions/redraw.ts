// Navigation Controls → Redraw: puts the scene right when something gets
// stuck — a drag, a held key or an area outline left half done (the mouse
// released outside the window), the loading veil left up by a failed
// request, a floor still grabbed — and redraws nodes, edges, bundles and
// labels at the window's size. The view, the selection and undo stay.

import { ctx } from '../three'
import { bundleStrength } from '../three/bundling'
import { computeBundles } from './bundling'
import { cancelPointerState } from './canvas_controls'
import { onPointerCancel } from './drag_controls'
import { redrawIntraLayerEdges } from './edge'
import { decideNodeLabelFlags, repaintNodes } from './node'
import { finishLoader, resetScreen } from './screen'

export function redrawScene(): void {
  onPointerCancel() // a grabbed floor: dropped where it is (one undo step)
  cancelPointerState()
  finishLoader()
  resetScreen() // renderer and camera to the window's size
  repaintNodes()
  decideNodeLabelFlags()
  for (const kind of ['intra', 'inter'] as const)
    if (bundleStrength(kind) > 0) computeBundles(kind)
  redrawIntraLayerEdges()
  ctx.renderInterLayerEdgesFlag = true // unless paused: that stays the user's
  ctx.renderNodeLabelsFlag = true
  ctx.renderLayerLabelsFlag = true
}
