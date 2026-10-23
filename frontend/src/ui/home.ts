// Home panel — the landing page: what Arena3D is, what it does, and a quick
// way in (an example, your own file, a database import), then how to cite it.

import { showTab } from './tabs'
import { openCard } from './sections'
import { openHelpPage } from './help'
import { EXAMPLES, exampleOptions, loadExample } from './file'
import { tourChapters, tourPlayer, wireTour } from './video'
import {
  PUBLICATIONS,
  citationText,
  copyCitation,
  reference,
  webName,
} from './about'

const IMG = `${import.meta.env.BASE_URL}images/help`

// ------------------------------------------------------------ hero picture
// Three layers stacked in perspective, nodes and edges on each, links running
// between them: drawn once from a seeded generator so it is the same each time.
function heroSvg(): string {
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  const colors = ['#39d0b4', '#ff7a6b', '#a78bfa']
  const centres = [96, 212, 328]
  const nodes = centres.map((cy) =>
    Array.from({ length: 8 }, () => {
      const a = rand() * 1.5 - 0.75
      const b = rand() * 1.5 - 0.75
      return [260 + 100 * (a + b), cy + 36 * (b - a)] as const
    })
  )
  const line = (
    [x1, y1]: readonly [number, number],
    [x2, y2]: readonly [number, number],
    cls: string
  ) =>
    `<line class="${cls}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`
  const layers = centres
    .map((cy, i) => {
      const ns = nodes[i]
      const edges = ns
        .slice(1)
        .map((n, k) => line(ns[k], n, 'hero-edge'))
        .concat(
          line(ns[0], ns[5], 'hero-edge'),
          line(ns[2], ns[7], 'hero-edge')
        )
        .join('')
      const dots = ns
        .map(
          ([x, y], k) =>
            `<circle class="hero-node${k % 3 === 0 ? ' hero-node--pulse' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${k % 3 === 0 ? 6 : 4.5}" fill="${colors[i]}"/>`
        )
        .join('')
      return `<g class="hero-layer" style="animation-delay:${-i * 1.4}s">
        <polygon class="hero-floor" points="60,${cy} 260,${cy - 72} 460,${cy} 260,${cy + 72}" style="--layer:${colors[i]}"/>
        ${edges}${dots}</g>`
    })
    .join('')
  const links = [0, 1]
    .flatMap((i) =>
      [1, 3, 4, 6].map((k) =>
        line(nodes[i][k], nodes[i + 1][(k * 3) % 8], 'hero-link')
      )
    )
    .join('')
  return `<svg class="hero-svg" viewBox="20 0 480 420" role="img" aria-label="Three network layers stacked in 3D, linked to each other">
    <defs>
      <linearGradient id="heroLinkGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#39d0b4"/><stop offset="1" stop-color="#a78bfa"/>
      </linearGradient>
    </defs>
    ${layers}<g class="hero-links">${links}</g>
  </svg>`
}

// ------------------------------------------------------------ content
const FEATURES: [string, string, string][] = [
  [
    'layers',
    'Layers you can see through',
    'Each network a floor, disk, cube, sphere or fog cloud — arranged as a stack, a cube, a helix, a chord diagram or a hive plot, among 13 arrangements.',
  ],
  [
    'database',
    'Your data, one click away',
    'Import from STRING (evidence types as channels, enrichment groupings), IntAct, OmniPath, Reactome, Gene Ontology and NDEx — or open TSV, GraphML, GML, SIF and Cytoscape CX files.',
  ],
  [
    'layout',
    'Layouts that respect the layers',
    '11 layout algorithms per layer or across them, in 2D or 3D, with cross-layer alignment, clustering-aware and NORMA-style group layouts.',
  ],
  [
    'analytics',
    'Analysis across layers',
    'Multiplex degree, participation coefficient, multilayer PageRank, community detection, layer similarity, shortest paths and functional enrichment.',
  ],
  [
    'channels',
    'Every channel, every colour',
    'Weighted, directed and multi-channel edges as parallel lines, curves or bundles, with themes and colour-blind-friendly palettes.',
  ],
  [
    'share',
    'Share and publish',
    'Save sessions, share a link, export PNG, SVG, 3D models and videos, hand over to Cytoscape or NORMA, or drive it all through the REST API.',
  ],
]

// line icons for the feature cards (24×24, stroke = currentColor)
const ICONS: Record<string, string> = {
  layers:
    '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 18 9 5 9-5" opacity=".55"/>',
  database:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
  layout:
    '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="m8.3 7 7.4.5M7.3 8.2l3.6 7.6M16.8 9.2l-3.7 6.7"/>',
  analytics: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  channels:
    '<path d="M3 7c6-4 12 4 18 0M3 12c6-4 12 4 18 0M3 17c6-4 12 4 18 0"/>',
  share:
    '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
}

const STATS: [string, string][] = [
  ['20', 'layers in one scene'],
  ['10', 'edge channels per network'],
  ['11', 'layout algorithms'],
  ['13', 'layer arrangements'],
  ['6', 'database importers'],
]

// featured examples (by file) with a line on what they show
const FEATURED: [string, string, string][] = [
  [
    'figure1_export.json',
    'Six layers',
    'Six random topologies side by side — 1,600 nodes in one scene.',
  ],
  [
    'covid19_export.json',
    'SARS-CoV-2 host–virus',
    'Five layers of viral and human proteins and what they touch.',
  ],
  [
    'figure2A_spheres.json',
    'Layers in 3D spheres',
    'Four layers, each in a glowing sphere, with the links between them bundled.',
  ],
  [
    'prego.tsv',
    'Hive plot',
    'Three layers as three axes, nodes placed by their links.',
  ],
  [
    'cnn_lenet.json',
    'Convolutional network',
    'A small CNN reading a drawn 7: feature maps as layers, filters as links.',
  ],
  [
    'transformer_tiny.json',
    'LLM-like transformer',
    'Attention heads, MLPs and the residual stream of two decoder blocks.',
  ],
]

const STEPS: [string, string][] = [
  ['Load', 'Upload a file, import from a database, or open an example.'],
  [
    'Arrange',
    'Lay out each layer, align them, stack them or turn them into a hive.',
  ],
  [
    'Explore & share',
    'Find, analyse and style — then save a session or export the view.',
  ],
]

const CITATIONS = PUBLICATIONS.filter((p) => p.cite)

const exampleIndex = (file: string) =>
  EXAMPLES.findIndex((e) => e.file === file)

const HOME_HTML = `
<div class="home-wrap">
  <section class="home-hero">
    <div class="home-hero__text">
      <div id="logo1" role="img" aria-label="Arena3D"></div>
      <p class="home-eyebrow">Free and open to all users · no login required</p>
      <h1 class="home-title">Multilayered networks, <span class="home-title__accent">in three dimensions.</span></h1>
      <p class="home-lead">
        Arena3D stacks networks as layers in one 3D scene — proteins, pathways, drugs, diseases or anything
        else you can link — so you can see how they connect, lay them out, analyse them and share what you find.
      </p>
      <div class="home-ctas">
        <button type="button" id="homeHeroExample" class="btn btn-primary btn-lg home-cta">Explore an example</button>
        <a href="#" id="link_to_fileInput" class="btn btn-lg home-cta home-cta--ghost">Upload your network</a>
      </div>
      <a href="#" id="homeToDatabases" class="home-textlink">Or import from STRING, Reactome, IntAct and more →</a>
      <p class="home-terms">
        Open source under the <a href="https://github.com/Pavlopoulos-Lab/Arena3D/blob/main/LICENSE" target="_blank" rel="noopener">GNU AGPL v3</a>
        licence · no cookies, no tracking · <a href="#" id="homeToPrivacy">Privacy &amp; data</a>
      </p>
    </div>
    <div class="home-hero__visual" aria-hidden="true">${heroSvg()}</div>
  </section>

  <section class="home-stats" aria-label="Arena3D in numbers">
    ${STATS.map(([n, l]) => `<div class="home-stat"><span class="home-stat__n">${n}</span><span class="home-stat__l">${l}</span></div>`).join('')}
  </section>

  <section class="home-section home-video" aria-labelledby="homeTourTitle">
    <div class="home-video__player">${tourPlayer('homeTour')}</div>
    <div class="home-video__text">
      <h2 class="home-h2" id="homeTourTitle">Take the four-minute tour</h2>
      <p class="home-sub">Arena3D 3.0 at work, from the first import to themes and the REST API. Pick a chapter to jump in.</p>
      ${tourChapters('homeTour')}
    </div>
  </section>

  <section class="home-section">
    <h2 class="home-h2">Everything a multilayered network needs</h2>
    <p class="home-sub">From the first import to the published figure, in one place.</p>
    <div class="home-features">
      ${FEATURES.map(
        ([icon, title, text]) => `
      <article class="home-feature">
        <span class="home-feature__icon"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[icon]}</svg></span>
        <h3 class="home-feature__title">${title}</h3>
        <p class="home-feature__text">${text}</p>
      </article>`
      ).join('')}
    </div>
  </section>

  <section class="home-section home-showcase">
    <figure class="home-shot">
      <div class="home-shot__bar" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="home-shot__frame">
        <img src="${IMG}/ui/view.jpg" alt="Four network layers forming the sides of a cube in Arena3D, linked across the cube" loading="lazy" />
      </div>
    </figure>
    <div class="home-steps">
      <h2 class="home-h2">From data to insight in three steps</h2>
      <ol class="home-steps__list">
        ${STEPS.map(([t, d], i) => `<li><span class="home-steps__n">${i + 1}</span><span><b>${t}</b><br />${d}</span></li>`).join('')}
      </ol>
    </div>
  </section>

  <section class="home-section">
    <h2 class="home-h2">Start from an example</h2>
    <p class="home-sub">One click opens a ready-made network — every example asks how to show it first.</p>
    <div class="home-examples">
      ${FEATURED.filter(([file]) => exampleIndex(file) >= 0)
        .map(
          ([file, title, text], k) => `
      <button type="button" class="home-example home-example--${k}" data-example="${exampleIndex(file)}">
        <span class="home-example__title">${title}</span>
        <span class="home-example__text">${text}</span>
        <span class="home-example__go">Open →</span>
      </button>`
        )
        .join('')}
    </div>
    <div class="home-allexamples">
      <label class="home-allexamples__label" for="homeExampleChoice">All examples</label>
      <select id="homeExampleChoice" class="form-select form-select-sm">
        ${exampleOptions()}
      </select>
      <button id="homeLoadExample" class="btn btn-outline-primary btn-sm text-nowrap">Load Example</button>
    </div>
  </section>

  <section class="home-section home-cite">
    <h2 class="home-h2">Please cite Arena3D</h2>
    <div class="home-cite__grid">
      ${CITATIONS.map(
        (p, k) => `
      <article class="home-cite__card">
        <span class="home-cite__venue">${p.journal}, ${p.year}</span>
        <p class="home-cite__text" id="homeCite${k}">${webName(reference(p))}</p>
        <div class="home-cite__links">
          <a href="https://doi.org/${p.doi}" target="_blank" rel="noopener">doi:${p.doi}</a>
          <a href="https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/" target="_blank" rel="noopener">PubMed ${p.pmid}</a>
          <button type="button" class="home-cite__copy" data-cite="${k}">Copy citation</button>
        </div>
      </article>`
      ).join('')}
    </div>
    <p class="home-links">
      <a href="https://github.com/Pavlopoulos-Lab/Arena3D" target="_blank" rel="noopener">Source code on GitHub</a>
      <a href="https://hub.docker.com/r/pavlopouloslab/arena3dweb" target="_blank" rel="noopener">Run it locally with Docker</a>
      <a href="#" id="homeToHelp">Read the help</a>
    </p>
  </section>
</div>
`

export function initHomePanel(): void {
  const pane = document.getElementById('panel-home')
  if (!pane) return
  pane.innerHTML = HOME_HTML
  wireTour(pane)
  const go = (id: string, tab: string) =>
    document.getElementById(id)?.addEventListener('click', (e) => {
      e.preventDefault()
      showTab(tab)
    })
  go('link_to_fileInput', '#panel-file')
  // …with its Network card open (every card starts folded)
  document
    .getElementById('link_to_fileInput')
    ?.addEventListener('click', () =>
      openCard(document.getElementById('input_network_file'))
    )
  go('homeToDatabases', '#panel-databases')
  go('homeToHelp', '#panel-help')
  document.getElementById('homeToPrivacy')?.addEventListener('click', (e) => {
    e.preventDefault()
    openHelpPage('Privacy_tab')
  })
  document.getElementById('homeHeroExample')?.addEventListener('click', () => {
    void loadExample(Math.max(0, exampleIndex(FEATURED[0][0])))
  })
  pane.querySelectorAll<HTMLElement>('.home-example').forEach((card) =>
    card.addEventListener('click', () => {
      void loadExample(Number(card.dataset.example))
    })
  )
  document.getElementById('homeLoadExample')?.addEventListener('click', () => {
    const choice = document.getElementById(
      'homeExampleChoice'
    ) as HTMLSelectElement
    void loadExample(Number(choice.value))
  })
  pane
    .querySelectorAll<HTMLButtonElement>('.home-cite__copy')
    .forEach((b) =>
      b.addEventListener('click', () =>
        copyCitation(b, citationText(CITATIONS[Number(b.dataset.cite)]))
      )
    )
}
