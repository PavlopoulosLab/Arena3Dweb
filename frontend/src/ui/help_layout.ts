// Help as documentation: a side navigation of the pages with an icon each (a
// strip on narrow screens), and on every page a header (group, title and the
// one-line .help-lead), framed screenshots with captions, "On this page" links
// for long pages, option lists set as definition lists, menu paths as small
// chips and the examples as cards. It decorates the markup of help.ts once,
// after it is inserted, so pages and paragraphs added there later get the same
// treatment. The About page (ui/about.ts) has a design of its own.

import { EXAMPLES, loadExample } from './file'

// line icons (24×24, stroke = currentColor), as on the Home page
const ICONS: Record<string, string> = {
  Start_tab:
    '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5v-7Z"/>',
  Howto_tab:
    '<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3.5 6 1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11M3.5 18l1.5 1.5L7.5 17"/>',
  Examples_tab:
    '<rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/>',
  File_tab:
    '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M12 17v-6M9.5 13.5 12 11l2.5 2.5"/>',
  Databases_tab:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  Find_tab: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
  Navigation_tab:
    '<circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.3 5.3-5.3 2.3 2.3-5.3 5.3-2.3Z"/>',
  Layouts_tab:
    '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="m8.3 7 7.4.5M7.3 8.2l3.6 7.6M16.8 9.2l-3.7 6.7"/>',
  Clustering_tab:
    '<circle cx="7.5" cy="8.5" r="3.5"/><circle cx="16.5" cy="8.5" r="3.5"/><circle cx="12" cy="16" r="3.5"/>',
  Annotations_tab:
    '<path d="M12 3a9 9 0 1 0 9 9h-9V3Z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15V3.5Z"/>',
  Scene_tab:
    '<path d="M4 8h3l2-3h6l2 3h3v11H4V8Z"/><circle cx="12" cy="13" r="3.5"/>',
  Node_tab:
    '<circle cx="8" cy="12" r="4.5"/><path d="M15.5 10h5M15.5 14h3.5"/>',
  Edge_tab:
    '<circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="5.5" r="2.5"/><path d="M7.4 16.6 16.6 7.4"/>',
  Layer_tab:
    '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 18 9 5 9-5" opacity=".55"/>',
  Style_tab:
    '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1.1.3-2.2 1.5-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10Z"/><circle cx="7.5" cy="11.5" r="1.1"/><circle cx="10.5" cy="7.5" r="1.1"/><circle cx="15.5" cy="8.5" r="1.1"/>',
  Attributes_tab:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14.5h18M9 9v11"/>',
  Analyze_tab: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  Export_tab:
    '<path d="M12 15V3M7.5 7.5 12 3l4.5 4.5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  API_tab: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  Cytoscape_tab: '<path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0V7ZM12 16v5"/>',
  Privacy_tab:
    '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
  About_tab: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  page: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/>',
}

// the navigation's groups, each named before its first page
const GROUPS: Record<string, string> = {
  Start_tab: 'Start',
  File_tab: 'Load & find',
  Navigation_tab: 'View & layout',
  Node_tab: 'Edit',
  Analyze_tab: 'Analyse & share',
  API_tab: 'Reference',
}

const icon = (id: string) =>
  `<svg class="help-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[id] ?? ICONS.page}</svg>`

// menu paths written in the text, e.g. Edit → Style or View → Scene & Camera:
// a menu, then one or more panel names in title case (a few names go on in
// lower case: Loaded networks, Other tools, Hive plot, Node attributes)
const ROOTS =
  'Home|Getting Started|File|Database Importers|Networks|View|Find|Layer selection|Layout|Clustering|Edit|Analyze|Export|Help|Data Tables'
const WORD = '[A-Z][\\w-]*'
const SEGMENT = `${WORD}(?:(?: &)? (?:${WORD}|networks|mode|tools|plot|attributes|selection))*`
const MENU_PATH = new RegExp(`\\b(?:${ROOTS})(?: → ${SEGMENT})+`, 'g')
const NO_PATHS = 'a, button, code, pre, kbd, h2, h3, h4, figcaption, .help-path'

// the first child that is not blank text
function leadNode(el: Element): ChildNode | null {
  for (const n of el.childNodes)
    if (n.nodeType !== Node.TEXT_NODE || n.textContent?.trim()) return n
  return null
}
const leadElement = (el: Element): Element | null => {
  const n = leadNode(el)
  return n instanceof Element ? n : null
}
const isFiller = (n: ChildNode | null) =>
  !!n &&
  ((n.nodeType === Node.TEXT_NODE && !n.textContent?.trim()) ||
    n.nodeName === 'BR')

// icons, group names and a label span on the page buttons
function decorateNav(pane: HTMLElement): Map<string, string> {
  const groupOf = new Map<string, string>()
  const nav = pane.querySelector<HTMLElement>('#helpDiv > .tab')
  if (!nav) return groupOf
  nav.classList.add('help-nav')
  nav.setAttribute('role', 'navigation')
  nav.setAttribute('aria-label', 'Help pages')
  let group = ''
  nav.querySelectorAll<HTMLElement>('.tablinks').forEach((btn) => {
    const id = btn.dataset.helpTab ?? ''
    if (GROUPS[id]) {
      group = GROUPS[id]
      btn.insertAdjacentHTML(
        'beforebegin',
        `<div class="help-nav__group">${group}</div>`
      )
    }
    groupOf.set(id, group)
    btn.innerHTML = `${icon(id)}<span class="help-nav__label">${btn.innerHTML}</span>`
  })
  return groupOf
}

// the title, the group above it and the one-line summary under it
function pageHeader(page: HTMLElement, group: string): HTMLElement | null {
  const h2 = page.querySelector(':scope > h2')
  if (!h2) return null
  const head = document.createElement('header')
  head.className = 'help-head'
  if (group)
    head.insertAdjacentHTML(
      'afterbegin',
      `<p class="help-head__group">${group}</p>`
    )
  h2.before(head)
  head.append(h2)
  const lead = page.querySelector(':scope > p.help-lead')
  if (lead) head.append(lead)
  return head
}

// every picture in a frame, its alt text as the caption
function figures(page: HTMLElement): void {
  page.querySelectorAll('img').forEach((img) => {
    // the video tour's poster stays inside its play button
    if (img.closest('figure, .tour')) return
    const fig = document.createElement('figure')
    fig.className = 'help-figure'
    if (img.classList.contains('help-shot--panel'))
      fig.classList.add('help-figure--panel')
    img.before(fig)
    fig.append(img)
    const alt = img.getAttribute('alt')
    if (alt) {
      const cap = document.createElement('figcaption')
      cap.textContent = alt
      fig.append(cap)
    }
  })
}

// lists whose every item opens with an option or a term in bold or italics
function definitionLists(page: HTMLElement): void {
  page.querySelectorAll('ul').forEach((ul) => {
    const items = [...ul.children].filter((li) => li.tagName === 'LI')
    const terms = items.map(leadElement)
    if (
      items.length &&
      terms.every((t) => t?.tagName === 'B' || t?.tagName === 'I')
    ) {
      ul.classList.add('help-defs')
      terms.forEach((t) => t?.classList.add('help-term'))
    }
  })
}

function menuPaths(page: HTMLElement): void {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    MENU_PATH.lastIndex = 0
    if (
      MENU_PATH.test(n.nodeValue ?? '') &&
      !n.parentElement?.closest(NO_PATHS)
    )
      nodes.push(n as Text)
  }
  for (const node of nodes) {
    const text = node.nodeValue ?? ''
    const frag = document.createDocumentFragment()
    let last = 0
    for (const m of text.matchAll(MENU_PATH)) {
      frag.append(text.slice(last, m.index))
      const chip = document.createElement('span')
      chip.className = 'help-path'
      m[0].split(' → ').forEach((part, i) => {
        if (i)
          chip.insertAdjacentHTML(
            'beforeend',
            '<span class="help-path__sep"> → </span>'
          )
        chip.append(part)
      })
      frag.append(chip)
      last = m.index + m[0].length
    }
    frag.append(text.slice(last))
    node.replaceWith(frag)
  }
}

// "On this page": a link to every section of a long page
function contents(page: HTMLElement, head: HTMLElement | null): void {
  const sections = [...page.querySelectorAll<HTMLElement>(':scope > h3')]
  if (sections.length < 4) return
  const toc = document.createElement('nav')
  toc.className = 'help-toc'
  toc.setAttribute('aria-label', 'On this page')
  toc.innerHTML = '<span class="help-toc__label">On this page</span>'
  sections.forEach((h3) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = h3.textContent
    b.addEventListener('click', () =>
      h3.scrollIntoView({ behavior: 'smooth', block: 'start' })
    )
    toc.append(b)
  })
  if (head) head.after(toc)
  else page.prepend(toc)
}

// the examples page: under each category, every example (a paragraph that
// opens with its name in bold) as a card, with Open for the bundled ones
function exampleCards(page: HTMLElement): void {
  const isExample = (el: Element) =>
    el.tagName === 'P' &&
    !el.matches('.help-note, .help-tip') &&
    leadElement(el)?.tagName === 'B'
  let k = 0
  let grid: HTMLElement | null = null
  for (const el of [...page.children]) {
    if (el.tagName === 'HR') {
      el.remove()
      continue
    }
    if (!isExample(el)) {
      grid = null
      continue
    }
    if (!grid) {
      grid = document.createElement('div')
      grid.className = 'help-examples'
      el.before(grid)
    }
    grid.append(exampleCard(el as HTMLElement, k++))
  }
}

function exampleCard(p: HTMLElement, k: number): HTMLElement {
  const card = document.createElement('article')
  card.className = `help-example help-example--${k % 6}`
  const name = leadElement(p) as HTMLElement
  const title = document.createElement('h4')
  title.className = 'help-example__title'
  title.append(...name.childNodes)
  // the name ends with a colon in the text
  const end = title.lastChild
  if (end?.nodeType === Node.TEXT_NODE)
    end.textContent = (end.textContent ?? '').replace(/[\s:]+$/, '')
  name.remove()
  while (isFiller(p.firstChild)) p.firstChild?.remove()
  while (isFiller(p.lastChild)) p.lastChild?.remove()
  p.className = 'help-example__body'
  card.append(title, p)
  // the bundled example these files belong to, its session first
  const files = [...p.querySelectorAll('a[download]')].map(
    (a) => a.getAttribute('href')?.split('/').pop() ?? ''
  )
  files.sort(
    (a, b) => Number(b.endsWith('.json')) - Number(a.endsWith('.json'))
  )
  const index = files
    .map((f) => EXAMPLES.findIndex((e) => e.file === f))
    .find((i) => i >= 0)
  if (index !== undefined) {
    const open = document.createElement('button')
    open.type = 'button'
    open.className = 'help-example__open'
    open.textContent = 'Open in Arena3D →'
    open.addEventListener('click', () => void loadExample(index))
    card.append(open)
  }
  return card
}

// field names such as nodes[].annotations may break after . ] or , on phones
function fieldBreaks(page: HTMLElement): void {
  page.querySelectorAll('.help-fields td:first-child code').forEach((code) => {
    const parts = (code.textContent ?? '').split(/(?<=[.\],])/)
    code.replaceChildren(
      ...parts.flatMap((part, i) =>
        i ? [document.createElement('wbr'), part] : [part]
      )
    )
  })
}

export function decorateHelp(pane: HTMLElement): void {
  const groupOf = decorateNav(pane)
  pane
    .querySelectorAll<HTMLElement>('#helpDiv > .tabcontent:not(.about)')
    .forEach((page) => {
      page.classList.add('help-page')
      const head = pageHeader(page, groupOf.get(page.id) ?? '')
      figures(page)
      definitionLists(page)
      if (page.id === 'Examples_tab') exampleCards(page)
      menuPaths(page)
      fieldBreaks(page)
      contents(page, head)
    })
  // a new page starts at its top, its button in view in the strip
  pane.querySelectorAll<HTMLElement>('.tablinks').forEach((btn) =>
    btn.addEventListener('click', () => {
      pane.scrollTo({ top: 0 })
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  )
}
