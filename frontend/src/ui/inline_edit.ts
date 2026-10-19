// Rename in place: a text box takes the place of a name; Enter or leaving
// the box saves, Esc cancels. A refused name (empty, too long, taken) keeps
// the box open and says why.

import { MAX_NAME } from '../actions/workspace'

// `target` is hidden while the box is open; `save` returns why the name was
// refused, or null once saved.
export function editInPlace(
  target: HTMLElement,
  current: string,
  save: (name: string) => string | null,
  label: string
): void {
  if (target.nextElementSibling?.classList.contains('inline-edit')) return
  const wrap = document.createElement('span')
  wrap.className = 'inline-edit'
  wrap.innerHTML = `<input type="text" class="form-control form-control-sm inline-edit__input" maxlength="${MAX_NAME}" spellcheck="false" /><span class="inline-edit__msg" role="alert"></span>`
  const input = wrap.querySelector('input')!
  const msg = wrap.querySelector<HTMLElement>('.inline-edit__msg')!
  input.value = current
  input.setAttribute('aria-label', label)
  target.hidden = true
  target.after(wrap)
  input.focus()
  input.select()

  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    window.removeEventListener('keydown', onKey, true)
    wrap.remove()
    target.hidden = false
  }
  const commit = () => {
    if (closed) return
    const name = input.value.trim()
    if (name === current) return close()
    // saving may redraw the list and drop the box (a blur): no second save
    closed = true
    const problem = save(name)
    closed = false
    if (!problem) return close()
    msg.textContent = problem
    input.classList.add('is-invalid')
  }
  // Enter and Esc are the box's: caught before the menu around it sees them
  // (Bootstrap's dropdown listens in the capture phase, and Esc closes it)
  function onKey(e: KeyboardEvent): void {
    if (!input.isConnected) {
      window.removeEventListener('keydown', onKey, true)
      return
    }
    if (e.target !== input || (e.key !== 'Enter' && e.key !== 'Escape')) return
    e.stopPropagation()
    e.preventDefault()
    if (e.key === 'Enter') return commit()
    close()
    target.focus()
  }
  window.addEventListener('keydown', onKey, true)
  input.addEventListener('input', () => {
    msg.textContent = ''
    input.classList.remove('is-invalid')
  })
  input.addEventListener('blur', commit)
  // clicks in the box stay in it (the row around it may switch networks)
  wrap.addEventListener('click', (e) => e.stopPropagation())
}
