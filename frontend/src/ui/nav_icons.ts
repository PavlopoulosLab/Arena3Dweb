// Line icons for the Navigation Controls (replacing v2's PNG arrows). Same
// colours as before — X red, Y green, Z blue, expand/collapse yellow — drawn
// as 24px strokes in currentColor, so they stay crisp at any zoom and on
// high-density screens, and hover/active only change brightness.

const svg = (body: string, label: string, w = 24): string =>
  `<svg class="nav-icon${w > 24 ? ' nav-icon-wide' : ''}" viewBox="0 0 ${w} 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}">${body}</svg>`

// rotate: an open circle with an arrowhead (counter-clockwise for minus)
const ROTATE_CCW =
  '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'
const ROTATE_CW =
  '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'
// move: a straight arrow
const MOVE_MINUS = '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>'
const MOVE_PLUS = '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'

const AXIS_NAME = { X: 'x', Y: 'y', Z: 'z' } as const

// `name` = minusX … plusZ; `move` = translation (true) or rotation (false)
export function axisIcon(name: string, move: boolean): string {
  const plus = name.startsWith('plus')
  const axis = name.slice(-1) as 'X' | 'Y' | 'Z'
  const body = move
    ? plus
      ? MOVE_PLUS
      : MOVE_MINUS
    : plus
      ? ROTATE_CW
      : ROTATE_CCW
  const verb = move ? 'Move' : 'Rotate'
  return `<span class="nav-axis nav-axis-${AXIS_NAME[axis]}">${svg(body, `${verb} ${plus ? '+' : '−'}${axis}`)}</span>`
}

// spread apart / pull together: two floors drawn as slanted sheets (layers)
// or a dot with four arrows (nodes)
const SHEETS =
  '<path d="M3 7l5-3v14l-5 3z" class="nav-sheet"/><path d="M36 7l5-3v14l-5 3z" class="nav-sheet"/>'
const LAYERS_EXPAND = `${SHEETS}<path d="M14 12h16m-16 0 4-4m-4 4 4 4m12-4-4-4m4 4-4 4"/>`
const LAYERS_COLLAPSE = `${SHEETS}<path d="M12 12h7m-3-4 3 4-3 4M32 12h-7m3-4-3 4 3 4"/>`
const NODES_EXPAND =
  '<circle cx="12" cy="12" r="2.5" class="nav-dot"/><path d="M15 9l5-5m0 0h-4m4 0v4M9 9 4 4m0 0h4M4 4v4M15 15l5 5m0 0h-4m4 0v-4M9 15l-5 5m0 0h4m-4 0v-4"/>'
const NODES_COLLAPSE =
  '<circle cx="12" cy="12" r="2.5" class="nav-dot"/><path d="M20 4l-5 5m0 0h4m-4 0V5M4 4l5 5m0 0H5m4 0V5M20 20l-5-5m0 0h4m-4 0v4M4 20l5-5m0 0H5m4 0v4"/>'

export const GROUP_ICONS = {
  expandLayers: svg(LAYERS_EXPAND, 'Spread layers apart', 44),
  collapseLayers: svg(LAYERS_COLLAPSE, 'Pull layers together', 44),
  expandNodes: svg(NODES_EXPAND, 'Spread selected nodes apart'),
  collapseNodes: svg(NODES_COLLAPSE, 'Pull selected nodes together'),
}
