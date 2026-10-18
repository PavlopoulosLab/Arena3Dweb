// On-canvas legend (NORMA shows one for its groups): the colour mapping last
// applied — layers after a load, groups, a metric or value gradient. Entries
// select what they stand for. Scene & Camera → Show Legend hides it.

import { bus } from '../bus'
import { ctx } from '../three'
import { escapeHtml } from '../utils'
import {
  layerLegend,
  legend,
  setLegend,
  type LegendEntry,
} from '../actions/legend'
import { selectGroup } from '../actions/groups'
import { updateSelectedNodesStore } from '../actions/node'
import { metricColor } from '../commands/scene'

let shown = true

function select(entry: LegendEntry): number {
  if (entry.select === 'layer') {
    let n = 0
    for (const node of ctx.nodeObjects) {
      node.isSelected = node.layer === entry.label
      if (node.isSelected) n++
    }
    updateSelectedNodesStore()
    return n
  }
  if (entry.select) return selectGroup(entry.label, entry.select)
  return 0
}

const fmt = (v: number) =>
  Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0)
    ? v.toExponential(1)
    : String(Math.round(v * 100) / 100)

export function renderLegend(): void {
  const el = document.getElementById('legend')
  if (!el) return
  const l = legend()
  el.classList.toggle('d-none', !shown || !l)
  if (!l) return
  const parts = [`<span class="legend-title">${escapeHtml(l.title)}</span>`]
  if (l.gradient) {
    const { min, max, stops } = l.gradient
    parts.push(
      `<span class="legend-min">${fmt(min)}</span>` +
        `<span class="legend-gradient" style="background: linear-gradient(to right, ${stops.join(', ')})"></span>` +
        `<span class="legend-max">${fmt(max)}</span>`
    )
  }
  for (const e of l.entries ?? [])
    parts.push(
      `<span class="legend-entry" data-label="${escapeHtml(e.label)}" title="Select ${escapeHtml(e.label)}"><span class="legend-swatch" style="background:${escapeHtml(e.color)}"></span>${escapeHtml(e.label)}${e.count !== undefined ? ` <span class="legend-count">${e.count}</span>` : ''}</span>`
    )
  el.innerHTML = parts.join('')
  el.querySelectorAll<HTMLElement>('.legend-entry').forEach((span) => {
    const entry = (l.entries ?? []).find((e) => e.label === span.dataset.label)
    if (entry?.select) span.addEventListener('click', () => select(entry))
  })
  syncSelectedLayers()
}

// The entries of selected layers are framed in the selection yellow their
// floors turn (style.css), whichever way the layers were selected
function syncSelectedLayers(): void {
  const selected = new Set(
    ctx.layers.filter((l) => l.isSelected).map((l) => l.name)
  )
  const entries = legend()?.entries ?? []
  document
    .querySelectorAll<HTMLElement>('#legend .legend-entry')
    .forEach((span) => {
      const entry = entries.find((e) => e.label === span.dataset.label)
      const on = entry?.select === 'layer' && selected.has(entry.label)
      span.classList.toggle('is-selected', on)
      if (entry?.select === 'layer')
        span.title = `Select the nodes of ${entry.label}${on ? ' (layer selected)' : ''}`
    })
}

export function setLegendShown(flag: boolean): void {
  shown = flag
  renderLegend()
}

export function initLegend(): void {
  bus.on('legend:changed', renderLegend)
  bus.on('layers:selected', syncSelectedLayers)
  bus.on('network:loaded', () => setLegend(layerLegend()))
  // Also Colour Nodes by Metric: the metric's gradient
  bus.on('topology:applied', ({ metric, scales }) => {
    const box = document.getElementById(
      'colorByMetricCheckbox'
    ) as HTMLInputElement | null
    if (!box?.checked) return
    const vals = Object.values(scales)
    if (!vals.length) return
    setLegend({
      title: metric,
      gradient: {
        min: Math.min(...vals),
        max: Math.max(...vals),
        stops: [0, 0.5, 1].map((t) => `#${metricColor(t)}`),
      },
    })
  })
  renderLegend()
}
