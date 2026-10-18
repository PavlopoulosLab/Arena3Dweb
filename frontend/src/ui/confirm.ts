// A yes/no question in a popup of the page's own (not the browser's), for
// steps that cannot be undone, such as deleting a network. Cancel, Esc or a
// click outside answer no.

let dialog: HTMLDialogElement | null = null

function ensureDialog(): HTMLDialogElement {
  if (dialog) return dialog
  const d = document.createElement('dialog')
  d.id = 'confirmDialog'
  d.className = 'confirm-dialog'
  d.setAttribute('aria-labelledby', 'confirmDialogTitle')
  d.innerHTML = `
    <form method="dialog">
      <div class="confirm-dialog__title" id="confirmDialogTitle"></div>
      <p class="confirm-dialog__text" id="confirmDialogText"></p>
      <div class="confirm-dialog__buttons">
        <button type="submit" value="cancel" class="btn btn-outline-secondary btn-sm" id="confirmDialogCancel">Cancel</button>
        <button type="submit" value="ok" class="btn btn-danger btn-sm" id="confirmDialogOk"></button>
      </div>
    </form>`
  // a click on the backdrop (outside the form) is a no
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close('cancel')
  })
  document.body.appendChild(d)
  dialog = d
  return d
}

export function confirmDialog(opts: {
  title: string
  text: string
  ok: string
}): Promise<boolean> {
  const d = ensureDialog()
  d.querySelector('#confirmDialogTitle')!.textContent = opts.title
  d.querySelector('#confirmDialogText')!.textContent = opts.text
  d.querySelector('#confirmDialogOk')!.textContent = opts.ok
  d.returnValue = ''
  return new Promise((resolve) => {
    d.addEventListener('close', () => resolve(d.returnValue === 'ok'), {
      once: true,
    })
    d.showModal()
    // the safe answer has the focus, so Enter does not delete by accident
    d.querySelector<HTMLButtonElement>('#confirmDialogCancel')?.focus()
  })
}
