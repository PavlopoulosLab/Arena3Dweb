// Port of v2 www/js/object_actions/themes.js, grown: the theme picker in the
// top bar switches the scene's theme (actions/theme_presets.ts) through
// ChangeThemeCommand; its theme:changed event lands here and applyTheme does
// the concrete recolour. With a network on screen the picker asks first
// (ui/theme_dialog.ts) whether to keep the network's colours — only the
// background, labels and 3D containers change — or to apply the theme's:
// nodes by layer, floors, channels and edges, each distinct and readable.

import { Color } from 'three'
import { bus } from '../bus'
import { history } from '../commands/base'
import { ChangeThemeCommand } from '../commands/scene'
import { store } from '../store'
import { ctx, type ColorPrioritySource } from '../three'
import { askThemeColours, type ThemeColours } from '../ui/theme_dialog'
import { redrawIntraLayerEdges } from './edge'
import { layerLegend, legend, setLegend } from './legend'
import { restyleLayerLabels, setLabelColor } from './labels'
import { getLastFloorColor, repaintLayers } from './layer'
import { repaintNodes } from './node'
import { themeChannelColor, themeNodeColor } from './palette'
import { setRendererColor } from './screen'
import { THEME_GROUPS, THEMES, type Theme } from './theme_presets'

export { THEME_GROUPS, THEMES, type Theme } from './theme_presets'

const input = (id: string) =>
  typeof document === 'undefined'
    ? null
    : (document.getElementById(id) as HTMLInputElement | null)

function checkedRadio(name: string): string | null {
  if (typeof document === 'undefined') return null
  return (
    document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)
      ?.value ?? null
  )
}

function syncRadio(name: string, value: string | null): void {
  if (typeof document === 'undefined') return
  for (const radio of document.querySelectorAll<HTMLInputElement>(
    `input[name="${name}"]`
  ))
    radio.checked = radio.value === value
}

// Edit → Edges lists a colour picker per channel
function syncChannelPickers(): void {
  for (const [channel, color] of Object.entries(ctx.channelColors)) {
    const picker = input(`color${channel}`)
    if (picker) picker.value = color
  }
}

function redrawEdges(): void {
  redrawIntraLayerEdges()
  ctx.renderInterLayerEdgesFlag = true
  // the on-canvas legend of the layers shows their nodes' new colours
  if (legend()?.title === 'Layers') setLegend(layerLegend())
}

// whether the theme on screen has its colours on the network (sessions keep it)
let applied = true

// The background and what has to stay legible on it, whatever the choice:
// the labels and the 3D containers that follow the theme.
function applyInterface(theme: Theme): void {
  setRendererColor(theme.background)
  ctx.containerDefaultColor = theme.container
  const containerInput = input('containerColor')
  if (containerInput) containerInput.value = theme.container
  for (const l of ctx.layers)
    if (l.containerColor === null && l.volume) l.rebuildVolume()
  setLabelColor(theme.text)
}

// The theme's colours on the network: every layer's nodes, the floors, every
// channel (a distinct colour each), the edges; colours set by hand per edge
// (Edit → Style, a loaded file) give way to them.
function applyColours(theme: Theme): void {
  for (const node of ctx.nodeObjects)
    node.color = node.importedColor = themeNodeColor(
      theme,
      ctx.layerGroups[node.layer] ?? 0
    )
  repaintNodes()
  // v2 repaintLayersFromPicker: layers on picker priority with the theme's
  // floor colour. The floor_color input is the source of truth on the picker
  // path (repaintLayers()/Layer.getColor() read it on hover-exit), so update
  // it too — otherwise hover-exit reverts to the stale colour.
  ctx.layerColorPrioritySource = 'picker'
  syncRadio('layerColorPriorityRadio', 'picker')
  const floor = input('floor_color')
  if (floor) floor.value = theme.floor
  repaintLayers(theme.floor)
  Object.keys(ctx.channelColors).forEach(
    (channel, i) => (ctx.channelColors[channel] = themeChannelColor(theme, i))
  )
  syncChannelPickers()
  ctx.edgeDefaultColor = theme.edge
  ctx.edgeFileColorPriority = false
  const filePriority = input('edgeFileColorPriority')
  if (filePriority) filePriority.checked = false
  for (const e of ctx.edgeObjects) e.arrowColor = ''
  redrawEdges()
  // layer labels set to a colour of their own (Labels & axes) take the
  // theme's label colour again
  for (const l of ctx.layers) l.labelColor = ''
  restyleLayerLabels()
}

export interface ColourSnapshot {
  applied: boolean
  nodes: [string, string][] // color, importedColor
  layers: string[]
  layerPriority: ColorPrioritySource
  layerRadio: string | null
  floorInput: string
  lastFloor: string
  channels: Record<string, string>
  edgeDefault: string
  edgeFilePriority: boolean
  arrows: string[]
  layerLabels: string[] // Labels & axes: each layer label's own colour
}

// what applying a theme's colours changes, so the switch's undo puts it back
export function snapshotColours(): ColourSnapshot {
  return {
    applied,
    nodes: ctx.nodeObjects.map((n) => [n.color, n.importedColor]),
    layers: ctx.layers.map((l) => l.color),
    layerPriority: ctx.layerColorPrioritySource,
    layerRadio: checkedRadio('layerColorPriorityRadio'),
    floorInput: input('floor_color')?.value ?? getLastFloorColor(),
    lastFloor: getLastFloorColor(),
    channels: { ...ctx.channelColors },
    edgeDefault: ctx.edgeDefaultColor,
    edgeFilePriority: ctx.edgeFileColorPriority,
    arrows: ctx.edgeObjects.map((e) => e.arrowColor),
    layerLabels: ctx.layers.map((l) => l.labelColor),
  }
}

export function restoreColours(s: ColourSnapshot): void {
  applied = s.applied
  ctx.nodeObjects.forEach((n, i) => {
    if (s.nodes[i]) [n.color, n.importedColor] = s.nodes[i]
  })
  repaintNodes()
  ctx.layerColorPrioritySource = s.layerPriority
  syncRadio('layerColorPriorityRadio', s.layerRadio)
  const floor = input('floor_color')
  if (floor) floor.value = s.floorInput
  // through repaintLayers, so the tracked last floor colour rewinds too
  if (s.layerPriority === 'picker') repaintLayers(s.lastFloor)
  ctx.layers.forEach((l, i) => {
    if (s.layers[i] !== undefined) l.setColor(s.layers[i])
  })
  Object.assign(ctx.channelColors, s.channels)
  syncChannelPickers()
  ctx.edgeDefaultColor = s.edgeDefault
  ctx.edgeFileColorPriority = s.edgeFilePriority
  const filePriority = input('edgeFileColorPriority')
  if (filePriority) filePriority.checked = s.edgeFilePriority
  ctx.edgeObjects.forEach((e, i) => {
    if (s.arrows[i] !== undefined) e.arrowColor = s.arrows[i]
  })
  redrawEdges()
  ctx.layers.forEach((l, i) => {
    if (s.layerLabels?.[i] !== undefined) l.labelColor = s.layerLabels[i]
  })
  restyleLayerLabels()
}

/** Switches the scene to theme `name`; `colours`: its colours on the network too. */
export function applyTheme(name: string, colours = true): void {
  const theme = THEMES[name]
  if (!theme || !ctx.scene?.exists()) return
  applyInterface(theme)
  if (colours) applyColours(theme)
  applied = colours
}

// The theme a loading session was saved with (actions/network.ts): the
// picker shows it once the session is on screen.
let sessionTheme: { name: string; applied: boolean } | null = null
export function stashSessionTheme(
  theme?: { name: string; applied: boolean } | null
): void {
  sessionTheme = theme ?? null
}

/** The theme on screen, for the session file (actions/session.ts). */
export function themeState(): { name: string; applied: boolean } {
  return { name: store.get().currentTheme, applied }
}

// Called once from main.ts.
export function registerThemeListener(): void {
  bus.on('theme:changed', ({ theme, recolour }) =>
    applyTheme(theme, recolour === true)
  )
}

const escapeAttr = (v: string) => v.replace(/[&"<>]/g, '')

// The theme picker sits in the top bar (always visible, also with a panel
// open), grouped as dark, light and colour-blind safe, with the chosen theme's
// channel colours as a thin bar under it. It works before a network is loaded
// (the next network takes the theme's colours). With a network on screen
// every switch asks whether to keep its colours or apply the theme's; the
// last answer is offered first. A switch is one undo step.
export function registerThemePicker(): void {
  const select = document.getElementById(
    'themeSelect'
  ) as HTMLSelectElement | null
  if (!select) return
  select.innerHTML = THEME_GROUPS.map(
    ([group, label]) =>
      `<optgroup label="${escapeAttr(label)}">${Object.entries(THEMES)
        .filter(([, t]) => t.group === group)
        .map(
          ([name, t]) =>
            `<option value="${escapeAttr(name)}">${escapeAttr(t.label)}</option>`
        )
        .join('')}</optgroup>`
  ).join('')
  const swatch = document.createElement('span')
  swatch.className = 'nav-theme__swatch'
  swatch.setAttribute('aria-hidden', 'true')
  select.parentElement?.appendChild(swatch)
  const show = (name: string) => {
    select.value = name
    const colours = THEMES[name]?.channels ?? []
    swatch.style.background = colours.length
      ? `linear-gradient(90deg, ${colours
          .map(
            (c, i) =>
              `${c} ${(i * 100) / colours.length}% ${((i + 1) * 100) / colours.length}%`
          )
          .join(', ')})`
      : ''
  }
  show(store.get().currentTheme)

  let lastChoice: ThemeColours = 'apply'
  const switchTo = async (name: string): Promise<void> => {
    const theme = THEMES[name]
    if (!theme) return
    let recolour = true // no network yet: the next one takes the colours
    if (ctx.nodeObjects.length > 0) {
      // e2e specs answer up front, as for the Import as popup
      const preset = (
        window as unknown as { __arenaThemeColours?: ThemeColours }
      ).__arenaThemeColours
      const choice = preset ?? (await askThemeColours(theme, lastChoice))
      if (!choice) return show(store.get().currentTheme) // cancelled
      lastChoice = choice
      recolour = choice === 'apply'
    }
    // store.currentTheme is the single source of truth (defaults to 'dark').
    history.execute(
      new ChangeThemeCommand(
        name,
        () => store.get().currentTheme,
        (t) => store.update({ currentTheme: t }),
        { recolour, snapshot: snapshotColours, restore: restoreColours }
      )
    )
  }
  select.addEventListener('change', () => void switchTo(select.value))
  // undo/redo of a theme switch moves the picker too
  bus.on('theme:changed', ({ theme }) => show(theme))
  bus.on('network:loaded', ({ session }) => {
    const current = store.get().currentTheme
    if (!session) {
      // a new network was built in the theme's colours: its floors, labels
      // and edges follow too
      if (current !== 'dark') applyTheme(current)
      applied = true
      return
    }
    // a session saved with a theme shows it, and its answer is offered next
    const saved = sessionTheme
    sessionTheme = null
    if (saved && THEMES[saved.name]) {
      store.update({ currentTheme: saved.name })
      applied = saved.applied
      lastChoice = saved.applied ? 'apply' : 'keep'
      return show(saved.name)
    }
    // an older session brings its own background: show the theme it matches
    const bg = ctx.renderer
      ? `#${ctx.renderer.getClearColor(new Color()).getHexString()}`
      : null
    const match = Object.entries(THEMES).find(
      ([, t]) => t.background.toLowerCase() === bg
    )
    if (match && match[0] !== current) {
      store.update({ currentTheme: match[0] })
      show(match[0])
    }
  })
}
