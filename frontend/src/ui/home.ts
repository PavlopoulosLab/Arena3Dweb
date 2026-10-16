// Home panel — port of v2 views/home.R.

import { showTab } from './tabs'
import { EXAMPLES, loadExample } from './file'

const HOME_HTML = `
<div class="home-wrap">
  <header class="home-hero">
    <div id="logo1"></div>
    <p class="home-tagline">Interactive 3D visualization of multilayered networks</p>
  </header>

  <div class="home-grid">
    <figure class="home-figure">
      <img src="${import.meta.env.BASE_URL}images/help/mainview2.png" alt="A multilayered network rendered across stacked 3D layers" class="img-fluid" />
    </figure>
    <div class="home-intro">
      <p>
        Arena3D is an interactive web application for visualizing and analysing multilayered
        networks in 3D space. Integrate several networks in one view with their intra- and
        inter-layer connections, lay layers out individually, together or aligned across layers,
        group nodes by cluster, annotation or layer, and highlight topological features. Layers can
        be floors, disks, cubes, spheres or fog clouds, and edges can be bundled; nodes, edges and colours adjust on the fly, with
        colour-blind-friendly palettes. Weighted, directed and multi-channel graphs are supported,
        networks can be imported from STRING, IntAct, OmniPath and NDEx, and the app runs on
        desktops, tablets and phones.
      </p>

      <div class="home-actions">
        <a href="#" id="link_to_fileInput" class="home-action home-action--primary">
          <span class="home-action__title">Upload a network</span>
          <span class="home-action__sub">Open the File tab and load your TSV</span>
        </a>
        <div class="home-action home-action--example">
          <label class="home-action__title" for="homeExampleChoice">Try an example</label>
          <div class="d-flex gap-2 mt-1">
            <select id="homeExampleChoice" class="form-select form-select-sm">
              ${EXAMPLES.map((e, i) => `<option value="${i}">${e.label}</option>`).join('')}
            </select>
            <button id="homeLoadExample" class="btn btn-primary btn-sm text-nowrap">Load Example</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <section class="home-cite">
    <h2 class="home-cite__heading">Please cite Arena3D</h2>
    <p>
      Kokoli, M., Karatzas, E., Baltoumas, F.A., Schneider, R., Pafilis, E., Paragkamian, S., Doncheva, N.T., Jensen, L.J.
      and Pavlopoulos, G., 2023.
      Arena3D<sup>web</sup>: interactive 3D visualization of multilayered networks
      supporting multiple directional information channels, clustering analysis and application integration.
      NAR Genomics and Bioinformatics, 5(2), p.lqad053.<br />
      <b>doi:</b> <a href="https://doi.org/10.1093/nargab/lqad053" target="_blank">10.1093/nargab/lqad053</a>
      &nbsp;·&nbsp;
      <b>PubMed:</b> <a href="https://pubmed.ncbi.nlm.nih.gov/37260509/" target="_blank">37260509</a>
    </p>
    <p>
      Karatzas, E., Baltoumas, F.A., Panayiotou, N.A., Schneider, R. and Pavlopoulos, G.A., 2021.
      Arena3D<sup>web</sup>: Interactive 3D visualization of multilayered networks.
      Nucleic Acids Research, 49(W1), pp.W36-W45.<br />
      <b>doi:</b> <a href="https://doi.org/10.1093/nar/gkab278" target="_blank">10.1093/nar/gkab278</a>
      &nbsp;·&nbsp;
      <b>PubMed:</b> <a href="https://pubmed.ncbi.nlm.nih.gov/33885790/" target="_blank">33885790</a>
    </p>
  </section>
</div>
`

export function initHomePanel(): void {
  const pane = document.getElementById('panel-home')
  if (!pane) return
  pane.innerHTML = HOME_HTML
  document
    .getElementById('link_to_fileInput')
    ?.addEventListener('click', (e) => {
      e.preventDefault()
      showTab('#panel-file')
    })
  document.getElementById('homeLoadExample')?.addEventListener('click', () => {
    const choice = document.getElementById(
      'homeExampleChoice'
    ) as HTMLSelectElement
    void loadExample(Number(choice.value))
  })
}
