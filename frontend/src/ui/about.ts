// Help → About: the project and the lab at a glance, the publications as
// cards along a release timeline (each with DOI, PubMed and Copy citation),
// related tools and the developers. The two Arena3Dweb papers are also the
// Home page's citation cards (ui/home.ts), so both read the list below.

export interface Publication {
  release: string // the release the paper describes, shown as a tag
  tone: string // the tag's colour (CSS modifier)
  introduced: string // what that release introduced, in one line
  authors: string
  year: number
  title: string
  journal: string
  volume: string // volume(issue):pages
  doi: string
  pmid: string
  cite?: boolean // one of the papers to cite for Arena3D
}

// newest first; checked against PubMed
export const PUBLICATIONS: Publication[] = [
  {
    release: 'Arena3Dweb update',
    tone: 'teal',
    introduced:
      'Directed edges, several information channels per pair of nodes, clustering, an API and a Cytoscape app.',
    authors:
      'Kokoli M, Karatzas E, Baltoumas FA, Schneider R, Pafilis E, Paragkamian S, Doncheva NT, Jensen LJ, Pavlopoulos GA',
    year: 2023,
    title:
      'Arena3Dweb: interactive 3D visualization of multilayered networks supporting multiple directional information channels, clustering analysis and application integration',
    journal: 'NAR Genomics and Bioinformatics',
    volume: '5(2):lqad053',
    doi: '10.1093/nargab/lqad053',
    pmid: '37260509',
    cite: true,
  },
  {
    release: 'Arena3Dweb',
    tone: 'violet',
    introduced:
      'Multilayered networks in an interactive 3D scene, in the browser.',
    authors:
      'Karatzas E, Baltoumas FA, Panayiotou NA, Schneider R, Pavlopoulos GA',
    year: 2021,
    title: 'Arena3Dweb: interactive 3D visualization of multilayered networks',
    journal: 'Nucleic Acids Research',
    volume: '49(W1):W36–W45',
    doi: '10.1093/nar/gkab278',
    pmid: '33885790',
    cite: true,
  },
  {
    release: 'Arena3D',
    tone: 'amber',
    introduced:
      'Time-course data: expression levels over time, compared through clustering and correlations.',
    authors: 'Secrier M, Pavlopoulos GA, Aerts J, Schneider R',
    year: 2012,
    title:
      'Arena3D: visualizing time-driven phenotypic differences in biological systems',
    journal: 'BMC Bioinformatics',
    volume: '13:45',
    doi: '10.1186/1471-2105-13-45',
    pmid: '22439608',
  },
  {
    release: 'Arena3D',
    tone: 'amber',
    introduced:
      'Staggered layers in 3D space: the first Arena3D, a desktop application in Java.',
    authors:
      'Pavlopoulos GA, O’Donoghue SI, Satagopam VP, Soldatos TG, Pafilis E, Schneider R',
    year: 2008,
    title: 'Arena3D: visualization of biological networks in 3D',
    journal: 'BMC Systems Biology',
    volume: '2:104',
    doi: '10.1186/1752-0509-2-104',
    pmid: '19040715',
  },
]

// the reference as a line of text, and with its DOI as Copy citation copies it
export const reference = (p: Publication): string =>
  `${p.authors} (${p.year}). ${p.title}. ${p.journal} ${p.volume}.`
export const citationText = (p: Publication): string =>
  `${reference(p)} doi:${p.doi}`

// Arena3Dweb → Arena3D<sup>web</sup>, as the papers write it
export const webName = (text: string): string =>
  text.replace(/Arena3Dweb/g, 'Arena3D<sup>web</sup>')

// copy a citation and say so on the button for a moment
export function copyCitation(button: HTMLElement, text: string): void {
  // the button's own label, kept from the first click on
  const label = (button.dataset.label ??= button.textContent ?? '')
  const done = (msg: string) => {
    button.textContent = msg
    setTimeout(() => (button.textContent = label), 1800)
  }
  // navigator.clipboard is missing outside secure (https) pages: the throw
  // lands in the catch too
  Promise.resolve()
    .then(() => navigator.clipboard.writeText(text))
    .then(() => done('Copied'))
    .catch(() => done('Copy failed'))
}

const BASE = import.meta.env.BASE_URL
const GITHUB = 'https://github.com/Pavlopoulos-Lab/Arena3D'
const DOCKER = 'https://hub.docker.com/r/pavlopouloslab/arena3dweb'

// line icons (24×24, stroke = currentColor), as on the Home page
const ICONS: Record<string, string> = {
  licence:
    '<path d="M12 3v18M5 21h14M4 7h16M7 7l-3 7a3 3 0 0 0 6 0L7 7ZM17 7l-3 7a3 3 0 0 0 6 0l-3-7Z"/>',
  code: '<path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>',
  box: '<path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
  quote:
    '<path d="M9 7H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3v1a3 3 0 0 1-3 3M20 7h-4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3v1a3 3 0 0 1-3 3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
  shield:
    '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
}
const icon = (name: string, size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`
const out = (href: string, text: string, cls = '') =>
  `<a href="${href}" target="_blank" rel="noopener"${cls ? ` class="${cls}"` : ''}>${text}</a>`

// key facts under the intro: [icon, label, value, link (or a button id)]
const FACTS: [string, string, string, string][] = [
  ['licence', 'Open source', 'GNU AGPL v3', `${GITHUB}/blob/main/LICENSE`],
  ['code', 'Source code', 'GitHub', GITHUB],
  ['box', 'Docker image', 'pavlopouloslab/arena3dweb', DOCKER],
  ['quote', 'How to cite', 'The two Arena3Dweb papers', '#aboutToPubs'],
  [
    'mail',
    'Contact',
    'pavlopoulos@fleming.gr',
    'mailto:pavlopoulos@fleming.gr',
  ],
  ['shield', 'Privacy &amp; data', 'Free for all, no login', '#aboutToPrivacy'],
]

const TOOLS: [string, string, string, string, [string, string][]][] = [
  [
    'NORMA',
    'The NetwORk Makeup Artist: annotation groups drawn on a network as hulls and pie charts, with group layouts.',
    'https://normaviz.org',
    'normaviz.org',
    [
      ['2022', '10.1016/j.gpb.2021.02.005'],
      ['NORMA-2.0', '10.1093/bioadv/vbac036'],
    ],
  ],
  [
    'Flame',
    'Functional and literature enrichment of several gene lists; Export → Other tools sends it the layers.',
    'https://flame.pavlopouloslab.info',
    'flame.pavlopouloslab.info',
    [
      ['2021', '10.3390/biology10070665'],
      ['v2.0', '10.1093/bioinformatics/btad490'],
    ],
  ],
  [
    'Arena3DwebApp',
    'A Cytoscape app that sends a Cytoscape network to Arena3D as layers.',
    'https://apps.cytoscape.org/apps/arena3dwebapp',
    'Cytoscape App Store',
    [['2023', '10.1093/nargab/lqad053']],
  ],
]

const DEVELOPERS: [string, string][] = [
  ['Evangelos Karatzas', 'karatzas@fleming.gr'],
  ['Fotis Baltoumas', 'baltoumas@fleming.gr'],
  ['Georgios A. Pavlopoulos', 'pavlopoulos@fleming.gr'],
]

// a line-break opportunity after @ and / in addresses
const wrap = (text: string) => text.replace(/([@/])/g, '$1<wbr>')

const initials = (name: string) =>
  name
    .split(' ')
    .filter((w) => !w.endsWith('.'))
    .map((w) => w[0])
    .join('')

function pubCard(p: Publication, k: number): string {
  return `
    <li class="about-pub${p.cite ? ' about-pub--cite' : ''}" style="--tone:var(--about-${p.tone})">
      <article class="about-pub__card">
        <header class="about-pub__head">
          <span class="about-tag">${webName(p.release)}</span>
          <span class="about-pub__year">${p.year}</span>
          ${p.cite ? '<span class="about-pub__cite">Please cite</span>' : ''}
        </header>
        <h4 class="about-pub__title">${webName(p.title)}</h4>
        <p class="about-pub__authors">${p.authors}</p>
        <p class="about-pub__venue"><i>${p.journal}</i>, ${p.year}; ${p.volume}</p>
        <p class="about-pub__new"><b>Introduced:</b> ${p.introduced}</p>
        <div class="about-pub__actions">
          ${out(`https://doi.org/${p.doi}`, `${icon('link', 14)}DOI <span class="about-chip__id">${p.doi}</span>`, 'about-chip')}
          ${out(`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`, `${icon('book', 14)}PubMed <span class="about-chip__id">${p.pmid}</span>`, 'about-chip')}
          <button type="button" class="about-chip about-copy" data-pub="${k}">Copy citation</button>
        </div>
      </article>
    </li>`
}

export const ABOUT_HTML = `
<div id="About_tab" class="tabcontent about">
  <section class="about-hero">
    <img class="about-logo" src="${BASE}images/logo_dark.webp" alt="Arena3D" width="220" height="67">
    <p class="about-eyebrow">Arena3D 3.0 · free and open to all users, no login required</p>
    <h2 class="about-title">Multilayered networks in 3D, <span class="about-title__accent">from the Pavlopoulos Lab</span></h2>
    <p class="about-lead">
      Arena3D shows multilayered networks in one 3D scene — every layer a floor, a disk, a cube, a sphere or a
      cloud, with the links between layers running through space — so you can lay them out, analyse them and share
      what you find. It is developed by the
      ${out('https://sites.google.com/site/pavlopoulossite', 'Bioinformatics and Integrative Biology Lab')} at the
      ${out('https://www.fleming.gr', 'Biomedical Sciences Research Center “Alexander Fleming”')}.
      Arena3D 3.0 is a complete rewrite of Arena3D<sup>web</sup>, the name the 2021 and 2023 papers use.
    </p>
    <ul class="about-facts">
      ${FACTS.map(([ic, label, value, href]) => {
        const body = `<span class="about-fact__icon">${icon(ic)}</span><span class="about-fact__label">${label}</span><span class="about-fact__value">${webName(wrap(value))}</span>`
        return `<li>${
          href.startsWith('#')
            ? `<button type="button" class="about-fact" id="${href.slice(1)}">${body}</button>`
            : href.startsWith('mailto:')
              ? `<a class="about-fact" href="${href}">${body}</a>`
              : out(href, body, 'about-fact')
        }</li>`
      }).join('')}
    </ul>
  </section>

  <section class="about-install">
    <h3>Install Arena3D</h3>
    <p>
      Arena3D is open source (GNU AGPL v3). Run it locally with Docker or from source — see the README on
      ${out(GITHUB, 'GitHub')}, or pull the image from ${out(DOCKER, 'DockerHub')}.
    </p>
    <div class="about-install__ctas">
      ${out(`${GITHUB}#readme`, `${icon('code', 16)}README on GitHub`, 'btn btn-primary about-btn')}
      ${out(DOCKER, `${icon('box', 16)}Image on DockerHub`, 'btn about-btn about-btn--ghost')}
    </div>
  </section>

  <section class="about-section" id="aboutPubs">
    <h3>Cite Arena3D</h3>
    <p class="about-sub">
      Please cite the two Arena3D<sup>web</sup> papers. The papers from 2008 and 2012 describe the original
      Arena3D desktop application.
    </p>
    <ol class="about-timeline">
      <li class="about-pub about-pub--now" style="--tone:var(--arena-accent)">
        <div class="about-pub__card about-pub__card--now">
          <header class="about-pub__head">
            <span class="about-tag">Arena3D 3.0</span>
            <span class="about-pub__year">2026</span>
            <span class="about-pub__cite">This version</span>
          </header>
          <p class="about-pub__new">
            Rewritten as a FastAPI and python-igraph service with a TypeScript and Three.js client: 2D and 3D
            layouts, hive plots, group layouts, database importers, and phones and tablets too.
          </p>
        </div>
      </li>
      ${PUBLICATIONS.map(pubCard).join('')}
    </ol>
  </section>

  <section class="about-section">
    <h3>Related Software</h3>
    <div class="about-tools">
      ${TOOLS.map(
        ([name, line, href, site, papers]) => `
      <article class="about-tool">
        <h4 class="about-tool__name">${name}</h4>
        <p class="about-tool__text">${line}</p>
        <div class="about-tool__links">
          ${out(href, `${site} →`, 'about-tool__go')}
          <span class="about-tool__papers">${papers.length > 1 ? 'Papers' : 'Paper'} ${papers.map(([label, doi]) => out(`https://doi.org/${doi}`, label)).join('')}</span>
        </div>
      </article>`
      ).join('')}
    </div>

    <h3>Related Literature</h3>
    <a class="about-read" href="https://www.frontiersin.org/articles/10.3389/fbioe.2020.00034/full" target="_blank" rel="noopener">
      <span class="about-read__icon">${icon('book', 22)}</span>
      <span>
        <span class="about-read__title">A Guide to Conquer the Biological Network Era Using Graph Theory</span>
        <span class="about-read__venue">Koutrouli M, Karatzas E, Paez-Espino D, Pavlopoulos GA · <i>Frontiers in Bioengineering and Biotechnology</i>, 2020</span>
      </span>
    </a>
  </section>

  <section class="about-section last_p">
    <h3>Developers</h3>
    <ul class="about-team">
      ${DEVELOPERS.map(
        ([name, email]) => `
      <li class="about-person">
        <span class="about-person__avatar" aria-hidden="true">${initials(name)}</span>
        <span class="about-person__text">
          <span class="about-person__name">${name}</span>
          <a class="about-person__email" href="mailto:${email}">${wrap(email)}</a>
        </span>
      </li>`
      ).join('')}
    </ul>
  </section>
</div>
`

// wire Copy citation, How to cite and Privacy & data
export function initAbout(pane: HTMLElement): void {
  pane
    .querySelectorAll<HTMLElement>('.about-copy')
    .forEach((b) =>
      b.addEventListener('click', () =>
        copyCitation(b, citationText(PUBLICATIONS[Number(b.dataset.pub)]))
      )
    )
  pane
    .querySelector('#aboutToPubs')
    ?.addEventListener('click', () =>
      pane
        .querySelector('#aboutPubs')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    )
  pane
    .querySelector('#aboutToPrivacy')
    ?.addEventListener('click', () =>
      pane.querySelector<HTMLElement>('[data-help-tab="Privacy_tab"]')?.click()
    )
}
