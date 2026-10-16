// Global event listeners. Port of v2 www/js/event_listeners.js (window-level
// bits) plus new Ctrl+Z / Ctrl+Shift+Z undo/redo.
//
// ponytail: the canvas mouse/keyboard scene controls (clickDown/Drag/Up,
// sceneZoom, keyPressed, right-click menu) live in canvas_controls — deferred
// until that action lands. Only the window-level listeners are wired here.

import { bus } from './bus'
import { history } from './commands/base'
import { resetScreen } from './actions/screen'

export function registerGlobalListeners(): void {
  window.addEventListener('resize', resetScreen)
  window.addEventListener('keydown', handleUndoRedo)
  wireHistoryButtons()
  // closing the ☰ menu after a panel is chosen: ui/tabs.ts initMenuAutoClose
}

function wireHistoryButtons(): void {
  const undo = document.getElementById('undoButton') as HTMLButtonElement | null
  const redo = document.getElementById('redoButton') as HTMLButtonElement | null
  if (!undo || !redo) return
  undo.addEventListener('click', () => history.undo())
  redo.addEventListener('click', () => history.redo())
  bus.on('history:changed', ({ canUndo, canRedo }) => {
    undo.disabled = !canUndo
    redo.disabled = !canRedo
  })
}

function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return (
    el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
  )
}

function handleUndoRedo(e: KeyboardEvent): void {
  if (!(e.ctrlKey || e.metaKey)) return
  if (isTextEntry(e.target)) return // let the input handle its own undo/redo
  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    history.undo()
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault()
    history.redo()
  }
}
