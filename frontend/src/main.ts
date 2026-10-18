// Entry point — port of v2 www/js/on_page_load.js.
// Fetches config, sets up the Three.js renderer/camera/scene, mounts the
// canvas, wires global listeners and starts the render loop.

import 'bootstrap/dist/css/bootstrap.min.css'
import { registerLoad } from './actions/workspace'
import 'bootstrap' // data-bs-* tab + collapse behavior for the navbar
import './style.css'

import { api } from './api/client'
import { fetchConfig } from './api/config'
import { loadSession } from './actions/network'
import { askSessionView, showSessionAs } from './ui/import_as'
import { initMenuAutoClose, showTab } from './ui/tabs'
import { initHomePanel } from './ui/home'
import { initDatabasesPanel } from './ui/databases'
import { initExportPanel } from './ui/export'
import { initFindPanel } from './ui/find'
import { initNetworkMode } from './ui/mode'
import { initLegend } from './ui/legend'
import { initFilePanel } from './ui/file'
import { initNetworksMenu } from './ui/networks'
import { initLayerSelectionPanel } from './ui/layer_selection'
import { initLayoutsPanel } from './ui/layouts'
import { initScenePanel } from './ui/scene'
import { initLayerPanel } from './ui/layer'
import { initNodePanel } from './ui/node'
import { initEdgePanel } from './ui/edge'
import { initStylePanel } from './ui/style'
import { initAttributesPanel } from './ui/attributes'
import { initInspector } from './ui/inspector'
import { initAnalyzePanel } from './ui/analyze'
import { initClusteringPanel } from './ui/clustering'
import { initFpsPanel } from './ui/fps'
import { initDataPanel } from './ui/data'
import { initHelpPanel } from './ui/help'
import { initMinimap } from './ui/minimap'
import { registerDrawerToggle } from './ui/drawer_toggle'
import { store } from './store'
import { ctx, Scene } from './three'
import { history } from './commands/base'
import { registerCanvasControls } from './actions/canvas_controls'
import { executeCommand } from './actions/right_click_menu'
import { registerLayerDragControls } from './actions/drag_controls'
import { registerLabelRendering } from './actions/labels'
import { registerNavControls } from './actions/nav_controls'
import { setRenderer, resetScreen, animate } from './actions/screen'
import { registerThemePicker, registerThemeListener } from './actions/themes'
import { registerGlobalListeners } from './event_listeners'

async function main(): Promise<void> {
  const config = await fetchConfig().catch((err: unknown) => {
    console.error('[arena3d] config fetch failed', err)
    return null
  })
  if (config) {
    store.update({ config })
    ctx.edgeDefaultColor = config.edge_default_color
  }

  setRenderer()
  resetScreen()

  ctx.scene = new Scene()
  ctx.scene.tiltDefault()
  ctx.scene.setScale(0.9)

  const app = document.getElementById('app')
  if (app && ctx.renderer) {
    ctx.renderer.setClearColor('#000000') // dark default until a theme is applied
    ctx.renderer.domElement.style.display = 'block'
    app.appendChild(ctx.renderer.domElement)
  }

  initHomePanel()
  initFilePanel()
  initDatabasesPanel()
  initFindPanel()
  initExportPanel()
  initLayerSelectionPanel()
  initLayoutsPanel()
  initScenePanel()
  initLayerPanel()
  initNodePanel()
  initEdgePanel()
  initStylePanel()
  initAttributesPanel()
  initInspector()
  initAnalyzePanel()
  initClusteringPanel()
  initMenuAutoClose()
  initNetworksMenu()
  initFpsPanel()
  initNetworkMode()
  initLegend()
  initDataPanel()
  initHelpPanel()
  initMinimap()
  registerDrawerToggle()
  registerGlobalListeners()
  registerThemeListener()
  registerThemePicker()
  registerLabelRendering()
  registerCanvasControls()
  registerLayerDragControls()
  registerNavControls()
  const year = document.getElementById('footer-year')
  if (year) year.textContent = String(new Date().getFullYear())
  animate()

  // Test hook: lets Playwright read scene state via page.evaluate (WebGL is
  // opaque to the a11y tree). See PLAN Phase 13.
  ;(window as unknown as { __arena: unknown }).__arena = {
    ctx,
    history,
    executeCommand,
  }

  await loadExternalSession()
}

// A partner app can hand off a session via POST /api/external, which returns a
// URL of the form `/?session=<token>`. Resolve that token back to a normalized
// session and load it, same as a file import.
async function loadExternalSession(): Promise<void> {
  if (typeof window === 'undefined') return
  const token = new URLSearchParams(window.location.search).get('session')
  if (!token) return
  try {
    const view = await askSessionView('the shared network')
    if (!view) return
    const session = await api.resolveExternal(token)
    loadSession(session)
    await showSessionAs(view)
    registerLoad('Shared session', 'link', session)
    showTab('#panel-main-view')
  } catch (err) {
    console.error('[arena3d] external session load failed', err)
    // say so where the user looks next, instead of a silent empty scene
    const el = document.getElementById('file_status')
    if (el) {
      el.textContent =
        'This shared link has expired or is not valid (links last one hour). Load a file or pick an example instead.'
      el.className = 'mt-3 small text-danger'
    }
    showTab('#panel-file')
  }
}

void main()
