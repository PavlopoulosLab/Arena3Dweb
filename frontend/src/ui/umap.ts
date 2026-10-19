// The UMAP options form (actions/umap.ts), used twice: under the Layout
// panel's algorithm when UMAP is chosen (prefix 'umap') and in Export →
// Other tools for the UMAP view (prefix 'umapx'). Element ids are
// `${prefix}Mode`, `${prefix}Features`, `${prefix}Balance`, … so both can
// live in the page at once.

import { bus } from '../bus'
import { escapeHtml } from '../utils'
import {
  currentFeatureData,
  featureSources,
  UMAP_DEFAULTS,
  UMAP_MODES,
  type FeatureKind,
  type UmapChoice,
} from '../actions/umap'

const KIND_TITLE: Record<FeatureKind, string> = {
  value: 'Values (File → Values)',
  set: 'Annotation sets (one column per term)',
  clusters: 'Clusters (one column per cluster)',
  metric: 'Node metrics (computed on the server)',
}

export function umapFormHtml(p: string): string {
  const d = UMAP_DEFAULTS
  return `
<div class="umap-form">
  <label class="form-label small" for="${p}Mode">UMAP mode</label>
  <select id="${p}Mode" class="form-select form-select-sm mb-1">
    ${UMAP_MODES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
  </select>
  <div id="${p}ModeNote" class="form-text mt-0 mb-2"></div>
  <div id="${p}FeatureBox" class="d-none mb-2">
    <div class="small mb-1">Features (standardised; missing values take the column mean):</div>
    <div id="${p}Features" class="umap-features"></div>
  </div>
  <div id="${p}BalanceBox" class="d-none mb-2">
    <label class="form-label small mb-0" for="${p}Balance">Balance: <span id="${p}BalanceValue">${d.balance.toFixed(2)}</span> (0 = topology, 1 = attributes)</label>
    <input type="range" class="form-range" id="${p}Balance" min="0" max="1" step="0.05" value="${d.balance}" />
  </div>
  <div class="lp-grid umap-params">
    <div>
      <label class="form-label small" for="${p}Neighbors">Neighbours (n_neighbors)</label>
      <input id="${p}Neighbors" type="number" class="form-control form-control-sm" min="2" max="200" step="1" value="${d.n_neighbors}" />
    </div>
    <div>
      <label class="form-label small" for="${p}MinDist">Minimum distance (min_dist)</label>
      <input id="${p}MinDist" type="number" class="form-control form-control-sm" min="0" max="1" step="0.05" value="${d.min_dist}" />
    </div>
    <div>
      <label class="form-label small" for="${p}Metric">Distance</label>
      <select id="${p}Metric" class="form-select form-select-sm">
        <option value="euclidean">Euclidean</option>
        <option value="cosine">Cosine</option>
      </select>
    </div>
    <div>
      <label class="form-label small" for="${p}Seed">Random seed</label>
      <input id="${p}Seed" type="number" class="form-control form-control-sm" min="0" max="2147483647" step="1" value="${d.seed}" />
    </div>
  </div>
</div>`
}

const MODE_NOTES: Record<UmapChoice['mode'], string> = {
  topology:
    'Each node is placed by its connections (its one- and two-step random-walk neighbourhood): nodes that share neighbours land together.',
  attributes:
    'Each node is placed by the features ticked below, whatever its edges: nodes with similar values or terms land together.',
  hybrid:
    'Connections and features together; the balance sets how much each counts.',
}

const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T | null

// the feature checkboxes, grouped by kind; ticks survive a rebuild, and a
// value column is ticked when it first appears
function buildFeatures(p: string, known: Set<string>): void {
  const box = el(`${p}Features`)
  if (!box) return
  const ticked = new Set(
    [...box.querySelectorAll<HTMLInputElement>('input:checked')].map(
      (i) => i.dataset.key!
    )
  )
  const sources = featureSources(currentFeatureData())
  box.innerHTML = ''
  for (const kind of ['value', 'set', 'clusters', 'metric'] as FeatureKind[]) {
    const ofKind = sources.filter((s) => s.kind === kind)
    if (!ofKind.length) continue
    const title = document.createElement('div')
    title.className = 'umap-features__kind'
    title.textContent = KIND_TITLE[kind]
    box.appendChild(title)
    for (const s of ofKind) {
      const id = `${p}Feature_${sources.indexOf(s)}`
      const row = document.createElement('div')
      row.className = 'form-check'
      row.innerHTML = `<input class="form-check-input" type="checkbox" id="${id}" /><label class="form-check-label" for="${id}">${escapeHtml(s.label)}</label>`
      const input = row.querySelector('input')!
      input.dataset.key = s.key
      input.checked =
        ticked.has(s.key) || (s.kind === 'value' && !known.has(s.key))
      known.add(s.key)
      box.appendChild(row)
    }
  }
}

export function initUmapForm(p: string): void {
  const mode = el<HTMLSelectElement>(`${p}Mode`)
  if (!mode) return
  const known = new Set<string>()
  const sync = () => {
    const m = mode.value as UmapChoice['mode']
    el(`${p}ModeNote`)!.textContent = MODE_NOTES[m]
    el(`${p}FeatureBox`)!.classList.toggle('d-none', m === 'topology')
    el(`${p}BalanceBox`)!.classList.toggle('d-none', m !== 'hybrid')
  }
  mode.addEventListener('change', sync)
  sync()
  const balance = el<HTMLInputElement>(`${p}Balance`)!
  balance.addEventListener('input', () => {
    el(`${p}BalanceValue`)!.textContent = Number(balance.value).toFixed(2)
  })
  const rebuild = () => buildFeatures(p, known)
  rebuild()
  for (const event of [
    'network:loaded',
    'values:loaded',
    'groups:changed',
    'clustering:applied',
    'workspace:changed',
  ] as const)
    bus.on(event, rebuild)
}

const clamp = (v: number, lo: number, hi: number, fallback: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback

// The form's values, clamped to what the server accepts
export function readUmapChoice(p: string): UmapChoice {
  const value = (id: string) => el<HTMLInputElement>(`${p}${id}`)!.value
  const num = (id: string) => Number.parseFloat(value(id)) // '' -> NaN
  const d = UMAP_DEFAULTS
  return {
    mode: value('Mode') as UmapChoice['mode'],
    features: [
      ...document.querySelectorAll<HTMLInputElement>(
        `#${p}Features input:checked`
      ),
    ].map((i) => i.dataset.key!),
    balance: clamp(num('Balance'), 0, 1, d.balance),
    n_neighbors: Math.round(clamp(num('Neighbors'), 2, 200, d.n_neighbors)),
    min_dist: clamp(num('MinDist'), 0, 1, d.min_dist),
    metric: value('Metric') as UmapChoice['metric'],
    seed: Math.round(clamp(num('Seed'), 0, 2147483647, d.seed)),
  }
}
