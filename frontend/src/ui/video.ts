// The Arena3D 3.0 tour on YouTube, on the Home and Getting Started pages. A
// still from the tour stands in for the player, so the page loads nothing from
// YouTube until someone presses play; the player then comes from
// youtube-nocookie.com, YouTube's privacy-enhanced mode.

const ID = 'M_uWFOXeXUc'
export const TOUR_URL = `https://www.youtube.com/watch?v=${ID}`
const POSTER = `${import.meta.env.BASE_URL}images/video/tour.jpg`
const LENGTH = '4:15'

// where each chapter of the tour starts, in seconds
export const CHAPTERS: [number, string][] = [
  [7, 'Getting started'],
  [30, 'Database import'],
  [49, 'Layouts'],
  [68, 'Layer arrangements'],
  [87, '3D containers'],
  [98, 'Edge bundling'],
  [115, 'Communities and groups'],
  [149, 'Analysis'],
  [184, 'Search and paths'],
  [199, 'Themes'],
  [218, 'Alternative views'],
  [230, 'Beyond biology'],
  [240, 'REST API'],
]

const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

// the poster with a play button; `id` names it for its chapter list
export function tourPlayer(id: string): string {
  return `
  <div class="tour" id="${id}">
    <button type="button" class="tour__poster" aria-label="Play the Arena3D 3.0 tour (${LENGTH}) from YouTube">
      <img src="${POSTER}" alt="" width="1280" height="720" loading="lazy" />
      <span class="tour__play" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor"/></svg></span>
      <span class="tour__length">${LENGTH}</span>
    </button>
  </div>
  <p class="tour__note">Plays from YouTube in its privacy-enhanced mode, only once you press play ·
    <a href="${TOUR_URL}" target="_blank" rel="noopener">Watch on YouTube</a></p>`
}

// the chapters of the tour, each starting the player named `id` there
export function tourChapters(id: string): string {
  return `<ol class="tour__chapters" aria-label="Chapters of the tour">${CHAPTERS.map(
    ([s, name]) =>
      `<li><button type="button" class="tour__chapter" data-tour="${id}" data-start="${s}"><time>${clock(s)}</time>${name}</button></li>`
  ).join('')}</ol>`
}

function play(box: HTMLElement, start: number): void {
  let frame = box.querySelector('iframe')
  if (!frame) {
    frame = document.createElement('iframe')
    frame.title = 'Arena3D 3.0 tour'
    frame.allow =
      'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen'
    frame.allowFullscreen = true
    frame.referrerPolicy = 'strict-origin-when-cross-origin'
    box.replaceChildren(frame)
  }
  frame.src = `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1&rel=0&start=${start}`
}

// play on a click of the poster or of a chapter
export function wireTour(root: HTMLElement): void {
  root
    .querySelectorAll<HTMLElement>('.tour')
    .forEach((box) =>
      box
        .querySelector('.tour__poster')
        ?.addEventListener('click', () => play(box, 0))
    )
  root.querySelectorAll<HTMLButtonElement>('.tour__chapter').forEach((b) =>
    b.addEventListener('click', () => {
      const box = document.getElementById(b.dataset.tour ?? '')
      if (!box) return
      play(box, Number(b.dataset.start))
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  )
}
