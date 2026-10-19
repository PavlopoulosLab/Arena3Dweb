// The question a theme switch asks while a network is on screen (actions/
// themes.ts): keep the network's colours, or apply the theme's — in a popup
// like Import as (ui/import_as.ts), with a preview of the theme's colours.

import type { Theme } from '../actions/theme_presets'
import { escapeHtml } from '../utils'

export type ThemeColours = 'keep' | 'apply'

const DIALOG_HTML = `
<dialog id="themeDialog" class="import-as theme-dialog" aria-labelledby="themeDialogTitle">
  <form method="dialog">
    <div class="import-as__title" id="themeDialogTitle"></div>
    <div class="import-as__what">The background and the labels change. And the network's colours?</div>
    <div class="theme-dialog__preview" id="themeDialogPreview" aria-hidden="true"></div>
    <fieldset class="import-as__group">
      <legend>Network colours</legend>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="themeColours" id="themeColours_keep" value="keep" />
        <label class="form-check-label" for="themeColours_keep">Keep the current colours — only the background, labels and 3D containers change</label>
      </div>
      <div class="form-check">
        <input class="form-check-input" type="radio" name="themeColours" id="themeColours_apply" value="apply" />
        <label class="form-check-label" for="themeColours_apply">Apply the theme's colours — nodes by layer, floors, a distinct colour per channel and the edges; colours set by hand give way</label>
      </div>
    </fieldset>
    <div class="form-text">Undo takes the switch back, colours and all.</div>
    <div class="d-flex justify-content-end gap-2 mt-3">
      <button type="submit" value="cancel" class="btn btn-outline-secondary btn-sm" id="themeDialogCancel">Cancel</button>
      <button type="submit" value="ok" class="btn btn-primary btn-sm" id="themeDialogOk">Switch Theme</button>
    </div>
  </form>
</dialog>`

function dialog(): HTMLDialogElement {
  let d = document.getElementById('themeDialog') as HTMLDialogElement | null
  if (!d) {
    document.body.insertAdjacentHTML('beforeend', DIALOG_HTML)
    d = document.getElementById('themeDialog') as HTMLDialogElement
  }
  return d
}

// the theme in small: its background, a node per layer colour, a bar per channel
function preview(theme: Theme): string {
  const c = escapeHtml
  return `<div class="theme-dialog__scene" style="background:${c(theme.background)};border-color:${c(theme.floor)}">
      <span class="theme-dialog__nodes">${theme.nodes
        .slice(0, 8)
        .map((n) => `<i style="background:${c(n)}"></i>`)
        .join('')}</span>
      <span class="theme-dialog__channels">${theme.channels
        .map((n) => `<i style="background:${c(n)}"></i>`)
        .join('')}</span>
    </div>`
}

/** Keep or apply, `preferred` offered first; null when cancelled (no switch). */
export function askThemeColours(
  theme: Theme,
  preferred: ThemeColours
): Promise<ThemeColours | null> {
  const d = dialog()
  if (d.open) return Promise.resolve(null)
  d.querySelector('#themeDialogTitle')!.textContent = `Switch to ${theme.label}`
  d.querySelector('#themeDialogPreview')!.innerHTML = preview(theme)
  const radio = (v: ThemeColours) =>
    d.querySelector<HTMLInputElement>(`#themeColours_${v}`)!
  radio(preferred).checked = true
  d.returnValue = ''
  return new Promise((resolve) => {
    d.addEventListener(
      'close',
      () =>
        resolve(
          d.returnValue !== 'ok'
            ? null
            : radio('apply').checked
              ? 'apply'
              : 'keep'
        ),
      { once: true }
    )
    d.showModal()
    d.querySelector<HTMLButtonElement>('#themeDialogOk')?.focus()
  })
}
