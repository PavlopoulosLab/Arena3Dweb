// Progress bars for server calls (layouts, analyses): upload percentage while
// the network is sent, a striped bar with elapsed seconds while the server
// computes, 100% on apply; the same look as the File panel's loading bar.

import type { UploadProgress } from '../api/client'

export const PROGRESS_HTML = (id: string, label: string) =>
  `<div id="${id}" class="progress mt-2 d-none" role="progressbar" aria-label="${label}" style="height: 1.1rem"><div class="progress-bar" style="width: 0%"></div></div>`

export class ProgressBar {
  private timer: ReturnType<typeof setInterval> | null = null
  private started = 0
  constructor(private readonly id: string) {}

  private get bar(): [HTMLElement, HTMLElement] | null {
    const wrap = document.getElementById(this.id)
    const bar = wrap?.firstElementChild as HTMLElement | null
    return wrap && bar ? [wrap, bar] : null
  }

  // fraction null = indeterminate (striped, animated)
  set(label: string, fraction: number | null): void {
    const el = this.bar
    if (!el) return
    const [wrap, bar] = el
    wrap.classList.remove('d-none')
    bar.textContent = label
    bar.style.width = `${Math.round((fraction ?? 1) * 100)}%`
    bar.classList.toggle('progress-bar-striped', fraction === null)
    bar.classList.toggle('progress-bar-animated', fraction === null)
    wrap.setAttribute(
      'aria-valuenow',
      String(Math.round((fraction ?? 1) * 100))
    )
  }

  // "Computing… (3 s)" ticking until done()
  computing(what: string): void {
    this.stopTicking()
    this.started = performance.now()
    const tick = () => {
      const s = Math.round((performance.now() - this.started) / 1000)
      this.set(`${what} (${s} s)`, null)
    }
    tick()
    this.timer = setInterval(tick, 1000)
  }

  // Upload stage from the API client: 0–1 sent, then computing
  upload(what: string): UploadProgress {
    return (stage, f) =>
      stage === 'upload'
        ? this.set(`Sending network ${Math.round(f * 100)}%`, f * 0.3)
        : this.computing(what)
  }

  done(label = 'Done', hideAfterMs = 1500): void {
    this.stopTicking()
    this.set(label, 1)
    const el = this.bar
    if (el) el[1].classList.add('bg-success')
    setTimeout(() => this.hide(), hideAfterMs)
  }

  hide(): void {
    this.stopTicking()
    const el = this.bar
    if (!el) return
    el[0].classList.add('d-none')
    el[1].classList.remove('bg-success')
  }

  private stopTicking(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
