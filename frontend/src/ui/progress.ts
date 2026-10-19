// Progress bars for server calls (layouts, analyses): upload percentage while
// the network is sent, a striped bar with elapsed seconds while the server
// computes, 100% on apply; the same look as the File panel's loading bar.

import type { UploadProgress } from '../api/client'

export const PROGRESS_HTML = (id: string, label: string) =>
  `<div id="${id}" class="progress mt-2 d-none" role="progressbar" aria-label="${label}" style="height: 1.1rem"><div class="progress-bar" style="width: 0%"></div></div>`

export class ProgressBar {
  private timer: ReturnType<typeof setInterval> | null = null
  // done()/fail() hide the bar later; a new run showing it again cancels that
  private hideTimer: ReturnType<typeof setTimeout> | null = null
  private started = 0
  constructor(private readonly id: string) {}

  private get bar(): [HTMLElement, HTMLElement] | null {
    const wrap = document.getElementById(this.id)
    const bar = wrap?.firstElementChild as HTMLElement | null
    return wrap && bar ? [wrap, bar] : null
  }

  // fraction null = indeterminate; `busy`: striped and animated (still working)
  set(label: string, fraction: number | null, busy = fraction === null): void {
    const el = this.bar
    if (!el) return
    const [wrap, bar] = el
    if (this.hideTimer) clearTimeout(this.hideTimer)
    this.hideTimer = null
    wrap.classList.remove('d-none')
    bar.textContent = label
    bar.style.width = `${Math.round((fraction ?? 1) * 100)}%`
    bar.classList.toggle('progress-bar-striped', busy)
    bar.classList.toggle('progress-bar-animated', busy)
    bar.classList.remove('bg-success', 'bg-danger')
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

  // "Curve 2 of 5 (7 s)": a known share done, still working, the seconds
  // since `since` ticking until done() or fail()
  working(what: string, fraction: number, since = performance.now()): void {
    this.stopTicking()
    const tick = () => {
      const s = Math.round((performance.now() - since) / 1000)
      this.set(`${what} (${s} s)`, fraction, true)
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
    this.hideTimer = setTimeout(() => this.hide(), hideAfterMs)
  }

  // red, with what went wrong
  fail(label: string, hideAfterMs = 6000): void {
    this.stopTicking()
    this.set(label, 1)
    const el = this.bar
    if (el) el[1].classList.add('bg-danger')
    this.hideTimer = setTimeout(() => this.hide(), hideAfterMs)
  }

  hide(): void {
    this.stopTicking()
    const el = this.bar
    if (!el) return
    el[0].classList.add('d-none')
    el[1].classList.remove('bg-success', 'bg-danger')
  }

  private stopTicking(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}
