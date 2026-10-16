// Performance panel (View → Performance): frame rate, render resolution,
// node detail, what to skip while moving, the navigator's refresh rate,
// three presets and a live readout of what the renderer is doing.

import { ctx } from '../three'
import { applyRenderScale, perfStats } from '../actions/screen'
import { setNodeDetail } from '../actions/node'
import { setMinimapVisible } from './minimap'

const PRESETS = {
  quality: {
    fps: 60,
    scale: 'auto',
    detail: 'high',
    hideLabels: false,
    pauseInter: false,
    minimap: '1',
  },
  balanced: {
    fps: 30,
    scale: 'auto',
    detail: 'medium',
    hideLabels: true,
    pauseInter: false,
    minimap: '3',
  },
  fast: {
    fps: 15,
    scale: '0.75',
    detail: 'low',
    hideLabels: true,
    pauseInter: true,
    minimap: '0',
  },
} as const

const FPS_HTML = `
<div class="col-md-8 col-lg-6 layout-panel perf-panel">
  <div class="lp-section">
    <div class="lp-title">Presets</div>
    <div class="d-flex flex-wrap gap-2">
      <button id="perf_quality" class="btn btn-outline-primary btn-sm">Quality</button>
      <button id="perf_balanced" class="btn btn-outline-primary btn-sm">Balanced</button>
      <button id="perf_fast" class="btn btn-outline-primary btn-sm">Fast (large networks)</button>
    </div>
    <div class="form-text">Quality: 60 FPS, full resolution, smooth spheres. Fast: 15 FPS, 0.75× resolution, simple spheres, labels and inter-layer edges hidden while moving, navigator off.</div>
  </div>

  <div class="lp-section">
    <div class="lp-title">Rendering</div>
    <label class="form-label small mb-1">Frame rate</label>
    <div class="mb-2">
      ${[15, 30, 60]
        .map(
          (f) => `
      <div class="form-check form-check-inline">
        <input class="form-check-input" type="radio" name="fps" id="fps_${f}" value="${f}" ${f === ctx.fps ? 'checked' : ''} />
        <label class="form-check-label" for="fps_${f}">${f} FPS</label>
      </div>`
        )
        .join('')}
    </div>
    <div class="lp-grid">
      <div>
        <label class="form-label small" for="perf_scale">Render resolution</label>
        <select id="perf_scale" class="form-select form-select-sm">
          <option value="auto">Device (sharpest)</option>
          <option value="1">1× (standard)</option>
          <option value="0.75">0.75×</option>
          <option value="0.5">0.5× (fastest)</option>
        </select>
      </div>
      <div>
        <label class="form-label small" for="perf_detail">Node detail</label>
        <select id="perf_detail" class="form-select form-select-sm">
          <option value="low">Low (6 segments)</option>
          <option value="medium" selected>Medium (8)</option>
          <option value="high">High (18)</option>
        </select>
      </div>
    </div>
    <div class="form-text">Resolution is the pixel ratio the scene is drawn at — fewer pixels on 4K and retina screens is the biggest saving; node detail is the sphere's mesh.</div>
  </div>

  <div class="lp-section">
    <div class="lp-title">While moving</div>
    <div class="form-check">
      <input class="form-check-input" type="checkbox" id="perf_hideLabels" />
      <label class="form-check-label" for="perf_hideLabels">Hide labels while panning, orbiting or dragging</label>
    </div>
    <div class="form-check mb-2">
      <input class="form-check-input" type="checkbox" id="perf_pauseInter" />
      <label class="form-check-label" for="perf_pauseInter">Hide inter-layer edges while moving</label>
    </div>
    <label class="form-label small" for="perf_minimap">Navigator (2D) refresh</label>
    <select id="perf_minimap" class="form-select form-select-sm" style="width:auto">
      <option value="1">Every frame</option>
      <option value="3">Every 3rd frame</option>
      <option value="10">Every 10th frame</option>
      <option value="0">Off</option>
    </select>
  </div>

  <div class="lp-section">
    <div class="lp-title">Live stats</div>
    <table class="perf-stats" id="perf_stats">
      <tr><td>Frames per second</td><td id="perf_fps_now">–</td></tr>
      <tr><td>Draw calls / frame</td><td id="perf_calls">–</td></tr>
      <tr><td>Triangles / frame</td><td id="perf_triangles">–</td></tr>
      <tr><td>Line segments / frame</td><td id="perf_lines">–</td></tr>
      <tr><td>Nodes · edges</td><td id="perf_counts">–</td></tr>
      <tr><td>Geometries · textures in memory</td><td id="perf_memory">–</td></tr>
      <tr><td>Pixel ratio</td><td id="perf_ratio">–</td></tr>
    </table>
  </div>
</div>
`

const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T

function applyControls(): void {
  const scale = el<HTMLSelectElement>('perf_scale').value
  applyRenderScale(scale === 'auto' ? null : Number(scale))
  setNodeDetail(
    el<HTMLSelectElement>('perf_detail').value as 'low' | 'medium' | 'high'
  )
  ctx.hideLabelsWhileMoving = el<HTMLInputElement>('perf_hideLabels').checked
  ctx.pauseInterWhileMoving = el<HTMLInputElement>('perf_pauseInter').checked
  const every = Number(el<HTMLSelectElement>('perf_minimap').value)
  ctx.minimapEvery = every
  setMinimapVisible(every > 0)
  const checked = document.querySelector<HTMLInputElement>(
    'input[name="fps"]:checked'
  )
  ctx.fps = Number(checked?.value) || 60
}

function applyPreset(name: keyof typeof PRESETS): void {
  const p = PRESETS[name]
  el<HTMLInputElement>(`fps_${p.fps}`).checked = true
  el<HTMLSelectElement>('perf_scale').value = p.scale
  el<HTMLSelectElement>('perf_detail').value = p.detail
  el<HTMLInputElement>('perf_hideLabels').checked = p.hideLabels
  el<HTMLInputElement>('perf_pauseInter').checked = p.pauseInter
  el<HTMLSelectElement>('perf_minimap').value = p.minimap
  applyControls()
}

function refreshStats(): void {
  const pane = document.getElementById('panel-fps')
  if (!pane?.classList.contains('show')) return
  const s = perfStats()
  const n = (v: number) => v.toLocaleString()
  el('perf_fps_now').textContent = s.fps ? s.fps.toFixed(0) : '–'
  el('perf_calls').textContent = n(s.calls)
  el('perf_triangles').textContent = n(s.triangles)
  el('perf_lines').textContent = n(s.lines)
  el('perf_counts').textContent = `${n(s.nodes)} · ${n(s.edges)}`
  el('perf_memory').textContent = `${n(s.geometries)} · ${n(s.textures)}`
  el('perf_ratio').textContent = s.pixelRatio.toFixed(2)
}

export function initFpsPanel(): void {
  const pane = document.getElementById('panel-fps')
  if (!pane) return
  pane.innerHTML = FPS_HTML
  for (const id of [
    'perf_scale',
    'perf_detail',
    'perf_hideLabels',
    'perf_pauseInter',
    'perf_minimap',
  ])
    document.getElementById(id)?.addEventListener('change', applyControls)
  for (const radio of document.querySelectorAll<HTMLInputElement>(
    'input[name="fps"]'
  ))
    radio.addEventListener('change', applyControls)
  for (const name of ['quality', 'balanced', 'fast'] as const)
    document
      .getElementById(`perf_${name}`)
      ?.addEventListener('click', () => applyPreset(name))
  window.setInterval(refreshStats, 500)
}
