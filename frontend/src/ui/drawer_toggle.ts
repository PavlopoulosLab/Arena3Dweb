// Collapse handle for the right-side action-panel drawer (File/Layouts/
// Scene/.../Data — everything except Home, Main View and Help, which aren't
// canvas-overlay drawers). Lets a drawer be dismissed/reopened without going
// back through the navbar tabs.

import { showTab } from './tabs'

const NON_DRAWER_IDS = new Set([
  'panel-home',
  'panel-main-view',
  'panel-help',
  'panel-api',
])

let lastDrawerSelector: string | null = null

// Bootstrap fires shown.bs.tab as soon as the (unanimated) nav button itself
// finishes activating — before the target pane's own fade transition adds its
// 'show' class. Querying '.tab-pane.show' at that moment can still match the
// pane being deactivated, so read the pane id straight from the event's
// tab-trigger target instead of asking the DOM which pane is "showing".
function activePaneId(): string | null {
  return document.querySelector('#panelContent .tab-pane.active')?.id ?? null
}

function isDrawerPane(id: string | null): boolean {
  return !!id && !NON_DRAWER_IDS.has(id)
}

function updateToggle(paneId?: string | null): void {
  const btn = document.getElementById('panelDrawerToggle')
  if (!btn) return
  const id = paneId ?? activePaneId()

  if (id === 'panel-home' || id === 'panel-help' || id === 'panel-api') {
    // Full-width reading panes, not a drawer to collapse.
    btn.style.display = 'none'
    return
  }

  const open = isDrawerPane(id)
  if (open) lastDrawerSelector = `#${id}`

  btn.style.display = 'flex'
  btn.classList.toggle('is-open', open)
  btn.innerHTML = open ? '&#8250;' : '&#8249;'
  btn.setAttribute('aria-label', open ? 'Hide panel' : 'Show panel')
  btn.style.right =
    open && id
      ? `${document.getElementById(id)!.getBoundingClientRect().width}px`
      : '0'
}

export function registerDrawerToggle(): void {
  const btn = document.getElementById('panelDrawerToggle')
  if (!btn) return

  btn.addEventListener('click', () => {
    if (isDrawerPane(activePaneId())) showTab('#panel-main-view')
    else if (lastDrawerSelector) showTab(lastDrawerSelector)
  })

  document.addEventListener('shown.bs.tab', (e) => {
    const paneSelector = (e.target as HTMLElement).getAttribute(
      'data-bs-target'
    )
    updateToggle(paneSelector?.replace('#', ''))
  })
  window.addEventListener('resize', () => updateToggle())
  updateToggle()
}
