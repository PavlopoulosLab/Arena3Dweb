// Port of v2 www/js/object_actions/themes.js. The theme buttons (Phase 13
// UI) dispatch ChangeThemeCommand; its theme:changed event lands here and
// applyTheme does the concrete recolour. Channel palettes come from
// /api/config (v2 CHANNEL_COLORS_LIGHT/DARK).

import { Color } from 'three'
import { bus } from '../bus'
import { history } from '../commands/base'
import { ChangeThemeCommand } from '../commands/scene'
import { store } from '../store'
import { ctx } from '../three'
import { assignChannelColorsFromPalette, redrawIntraLayerEdges } from './edge'
import { setLabelColor } from './labels'
import { repaintLayers } from './layer'
import { setRendererColor } from './screen'

export interface Theme {
  label: string // shown in the theme picker
  background: string
  floor: string
  edge: string
  channelPalette: 'light' | 'dark' // channel colours readable on this background
  text: string // node and layer labels
  container: string // cube / sphere / fog-cloud default, contrasting with the background
}

// Scene presets: v2's Light / Dark / Gray plus more. The menus and panels
// keep their own (dark) styling, so every preset leaves them legible; each
// preset's label colour is chosen to read on its background.
export const THEMES: Record<string, Theme> = {
  dark: {
    label: 'Dark',
    background: '#000000',
    floor: '#777777',
    edge: '#ffffff',
    channelPalette: 'light',
    text: '#ffffff',
    container: '#5b8def',
  },
  light: {
    label: 'Light',
    background: '#ffffff',
    floor: '#8aa185',
    edge: '#5c5c5c',
    channelPalette: 'dark',
    text: '#000000',
    container: '#2f6fcf',
  },
  gray: {
    label: 'Gray',
    background: '#999999',
    floor: '#1d4991',
    edge: '#6e2a5a',
    channelPalette: 'light',
    text: '#ffffff',
    container: '#ffd166',
  },
  midnight: {
    label: 'Midnight',
    background: '#0b1426',
    floor: '#2b4a7a',
    edge: '#9fb7d9',
    channelPalette: 'light',
    text: '#e8eefa',
    container: '#7fb3ff',
  },
  blueprint: {
    label: 'Blueprint',
    background: '#0d2b52',
    floor: '#3d6fae',
    edge: '#d6e6ff',
    channelPalette: 'light',
    text: '#ffffff',
    container: '#ffd166',
  },
  solarized: {
    label: 'Solarized',
    background: '#002b36',
    floor: '#586e75',
    edge: '#93a1a1',
    channelPalette: 'light',
    text: '#eee8d5',
    container: '#b58900',
  },
  forest: {
    label: 'Forest',
    background: '#0f1f17',
    floor: '#3e6b4f',
    edge: '#c8e0b4',
    channelPalette: 'light',
    text: '#f1f7ea',
    container: '#9ccc65',
  },
  paper: {
    label: 'Paper',
    background: '#f6f1e7',
    floor: '#c9b99a',
    edge: '#5a4a3a',
    channelPalette: 'dark',
    text: '#2b2118',
    container: '#8a4b1f',
  },
  pastel: {
    label: 'Pastel',
    background: '#fbf7ff',
    floor: '#c8b6e2',
    edge: '#6c5b7b',
    channelPalette: 'dark',
    text: '#2d2340',
    container: '#6c4fb3',
  },
  contrast: {
    label: 'High Contrast',
    background: '#000000',
    floor: '#3a3a3a',
    edge: '#ffd400',
    channelPalette: 'light',
    text: '#ffffff',
    container: '#ffd400',
  },
}

export function applyTheme(name: string, fromInit = false): void {
  const theme = THEMES[name]
  if (!theme || !ctx.scene?.exists()) return

  setRendererColor(theme.background)
  ctx.edgeDefaultColor = theme.edge
  ctx.labelColor = theme.text
  // containers that follow the theme get a colour that reads on this background
  ctx.containerDefaultColor = theme.container
  const containerInput =
    typeof document !== 'undefined' &&
    (document.getElementById('containerColor') as HTMLInputElement | null)
  if (containerInput) containerInput.value = theme.container

  const config = store.get().config
  const palette =
    theme.channelPalette === 'dark'
      ? config?.channel_colors_dark
      : config?.channel_colors_light
  if (palette) assignChannelColorsFromPalette(palette)

  if (!fromInit) {
    // v2 repaintLayersFromPicker: switch layers to picker priority with the
    // theme's floor color. The floor_color input is the source of truth on the
    // picker path (repaintLayers()/Layer.getColor() read it on hover-exit), so
    // update it too — otherwise hover-exit reverts to the stale (dark) color.
    ctx.layerColorPrioritySource = 'picker'
    const floorInput =
      typeof document !== 'undefined' &&
      (document.getElementById('floor_color') as HTMLInputElement | null)
    if (floorInput) floorInput.value = theme.floor
    repaintLayers(theme.floor)
    for (const l of ctx.layers)
      if (l.containerColor === null && l.volume) l.rebuildVolume()
    redrawIntraLayerEdges()
    ctx.renderInterLayerEdgesFlag = true
    setLabelColor(theme.text)
    // v2 also rebuilt the channel edit list — Phase 13 UI
  }
}

// Called once from main.ts.
export function registerThemeListener(): void {
  bus.on('theme:changed', ({ theme }) => applyTheme(theme))
}

// The theme picker sits in the top bar (always visible, also with a panel
// open). Enabled on first network load (themes only recolour a live scene),
// routed through ChangeThemeCommand so theme switches are undoable.
export function registerThemePicker(): void {
  const select = document.getElementById(
    'themeSelect'
  ) as HTMLSelectElement | null
  if (!select) return
  select.innerHTML = Object.entries(THEMES)
    .map(([name, t]) => `<option value="${name}">${t.label}</option>`)
    .join('')
  select.value = store.get().currentTheme
  select.addEventListener('change', () => {
    // store.currentTheme is the single source of truth (defaults to 'dark').
    history.execute(
      new ChangeThemeCommand(
        select.value,
        () => store.get().currentTheme,
        (t) => store.update({ currentTheme: t })
      )
    )
  })
  // undo/redo of a theme switch moves the picker too
  bus.on('theme:changed', ({ theme }) => (select.value = theme))
  bus.on('network:loaded', () => {
    select.disabled = false
    select.title = 'Scene theme'
    // a session brings its own background: show the theme it matches
    const bg = ctx.renderer
      ? `#${ctx.renderer.getClearColor(new Color()).getHexString()}`
      : null
    const match = Object.entries(THEMES).find(
      ([, t]) => t.background.toLowerCase() === bg
    )
    if (match && match[0] !== store.get().currentTheme) {
      store.update({ currentTheme: match[0] })
      select.value = match[0]
    }
  })
}
