// Export panel (top menu): the view as an image, 3D model or video; the
// network for Cytoscape (cyREST, CX2, .cyjs, SIF), GraphML, MuxViz and NORMA;
// and the complete session. Moved out of the File panel.

import { exportSceneImage } from '../actions/screen'
import { exportSession } from '../actions/session'
import {
  NORMA_DEFAULT_SERVER,
  normaLink,
  normaPayload,
  sendToNorma,
  type NormaPayload,
} from '../actions/norma'
import { store } from '../store'
import { ctx } from '../three'
import {
  adjacencyCsv,
  chordSvg,
  circosFiles,
  gephiLiteUrl,
  heatmapSvg,
  SANKEY_LEVELS,
  sankeyMaticText,
  sankeyPlotlyJson,
  sankeySvg,
  type SankeyLevel,
  hostGraphml,
  stringUrl,
  vegaEditorUrl,
} from '../actions/visualizations'
import {
  CYTOSCAPE_DEFAULT_SERVER,
  ExportError,
  cx2Json,
  cyjsJson,
  download,
  glbBlob,
  graphmlText,
  muxvizFiles,
  recordRotation,
  sendToCytoscape,
  sifFiles,
  svgText,
  zip,
} from '../actions/export'
import {
  FLAME_DEFAULT_SERVER,
  flameLists,
  flameText,
  flameUrl,
  type FlameMode,
} from '../actions/flame'

const EXPORT_HTML = `
<div class="col-md-8 col-lg-6 layout-panel export-panel">
  <details class="lp-section lp-more" id="exportCard_image" open>
    <summary>Image &amp; 3D</summary>
    <div class="d-flex flex-wrap align-items-center gap-2">
      <button id="export_scene_image" class="btn btn-primary btn-sm">PNG (current view)</button>
      <select id="png_size" class="form-select form-select-sm" style="width:auto" aria-label="PNG size">
        <option value="2048">2048 px</option>
        <option value="4096" selected>4096 px</option>
        <option value="8192">8192 px</option>
      </select>
      <button id="export_png_sized" class="btn btn-outline-primary btn-sm">PNG</button>
      <button id="export_svg" class="btn btn-outline-primary btn-sm">SVG</button>
      <button id="export_glb" class="btn btn-outline-primary btn-sm" title="3D scene for Blender, PowerPoint, journal 3D viewers">3D model (GLB)</button>
      <button id="export_video" class="btn btn-outline-primary btn-sm" title="Records one auto-rotation of the scene">Rotation Video (WebM)</button>
    </div>
    <div class="form-text">Sized PNGs for print, SVG for a vector editor, GLB for 3D viewers and slides, one full turn as a video for talks.</div>
  </details>

  <details class="lp-section lp-more" id="exportCard_cytoscape">
    <summary>Cytoscape</summary>
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
      <input id="cytoscape_server" class="form-control form-control-sm" style="max-width: 13rem" value="${CYTOSCAPE_DEFAULT_SERVER}" aria-label="cyREST address" />
      <button id="export_cytoscape" class="btn btn-primary btn-sm" title="Open the network in a running Cytoscape desktop through cyREST">Send to Cytoscape</button>
    </div>
    <div class="d-flex flex-wrap align-items-center gap-2">
      <button id="export_cx2" class="btn btn-outline-primary btn-sm" title="Cytoscape 3.9+ and NDEx">CX2</button>
      <button id="export_cyjs" class="btn btn-outline-primary btn-sm" title="Cytoscape.js JSON — File → Import → Network from File">Cytoscape.js JSON</button>
      <button id="export_sif" class="btn btn-outline-primary btn-sm" title="SIF network plus node and edge attribute tables">SIF + tables (zip)</button>
    </div>
    <div class="form-text">A running Cytoscape 3 answers on port 1234; layers go side by side, and node colour, size, shape and layer and edge channel and weight become table columns.</div>
  </details>

  <details class="lp-section lp-more" id="exportCard_tools">
    <summary>Other tools</summary>
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
      <button id="export_graphml" class="btn btn-outline-primary btn-sm" title="Gephi, igraph, NetworkX, yEd">GraphML</button>
      <button id="export_muxviz" class="btn btn-outline-primary btn-sm">MuxViz (zip)</button>
    </div>
    <label class="form-label small mb-1" for="norma_server">Send to NORMA (each layer becomes a group):</label>
    <div class="d-flex flex-wrap gap-2">
      <input id="norma_server" class="form-control form-control-sm" style="max-width: 16rem" value="${NORMA_DEFAULT_SERVER}" aria-label="NORMA server address" />
      <button id="export_norma" class="btn btn-primary btn-sm" title="Store the network on the NORMA server and open it there">Open in NORMA</button>
      <button id="export_norma_link" class="btn btn-outline-primary btn-sm" title="A link carrying the network itself — no server storage; small networks">Copy NORMA Link</button>
      <button id="export_norma_json" class="btn btn-outline-primary btn-sm">NORMA JSON</button>
    </div>
    <div class="form-text">The layers ticked in the Layer selection tab (all if none). Copies of a node become one NORMA node in several groups.</div>
    <label class="form-label small mt-2 mb-1" for="flame_server">Send to Flame (functional enrichment of the gene names):</label>
    <div class="d-flex flex-wrap align-items-center gap-2">
      <input id="flame_server" class="form-control form-control-sm" style="max-width: 16rem" value="${FLAME_DEFAULT_SERVER}" aria-label="Flame server address" />
      <select id="flame_mode" class="form-select form-select-sm" style="width:auto" aria-label="Gene lists for Flame">
        <option value="perLayer">one gene list per layer</option>
        <option value="combined">selected layers as one list</option>
      </select>
      <button id="open_flame" class="btn btn-primary btn-sm" title="Opens Flame with the gene lists in the link (its url_genes API)">Open in Flame</button>
      <button id="copy_flame" class="btn btn-outline-primary btn-sm" title="The gene lists as text, to paste into Flame">Copy Gene Lists</button>
    </div>
    <div class="form-text">Node names are taken as gene symbols or identifiers: the layers ticked in Layer selection (all if none), one list per layer (Flame keeps up to ten) or combined into one. Large lists go through <i>Copy Gene Lists</i>.</div>
  </details>

  <details class="lp-section lp-more" id="exportCard_visualizations">
    <summary>Visualizations</summary>
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
      <button id="export_chord" class="btn btn-outline-primary btn-sm" title="Layers as arcs, nodes along them, edges as chords">Chord diagram (SVG)</button>
      <button id="export_heatmap" class="btn btn-outline-primary btn-sm" title="Adjacency matrix with the nodes grouped by layer">Heatmap (SVG)</button>
      <button id="export_matrix" class="btn btn-outline-primary btn-sm" title="Adjacency matrix for R, Python or Morpheus">Matrix (CSV)</button>
      <button id="export_circos" class="btn btn-outline-primary btn-sm" title="karyotype, links and a circos.conf for the Circos software">Circos files (zip)</button>
    </div>
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
      <button id="export_sankey" class="btn btn-outline-primary btn-sm" title="Layers as columns, inter-layer edges as flows">Sankey (SVG)</button>
      <button id="export_sankey_matic" class="btn btn-outline-primary btn-sm" title="Source [amount] Target lines for sankeymatic.com">SankeyMATIC (text)</button>
      <button id="export_sankey_plotly" class="btn btn-outline-primary btn-sm" title="A Plotly figure: plotly.js, Python, Chart Studio">Plotly Sankey (JSON)</button>
      <select id="sankey_level" class="form-select form-select-sm" style="width:auto" aria-label="Sankey bands">
        ${SANKEY_LEVELS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
      </select>
    </div>
    <div class="d-flex flex-wrap align-items-center gap-2">
      <button id="open_vega" class="btn btn-primary btn-sm" title="Interactive heatmap in the Vega editor; the chart travels in the link, nothing is uploaded">Heatmap in Vega Editor</button>
      <button id="open_gephi" class="btn btn-primary btn-sm" title="The network as GraphML in Gephi Lite, hosted on this server for one hour">Open in Gephi Lite</button>
      <button id="open_string" class="btn btn-primary btn-sm" title="The selected proteins (or all) on the STRING website">Open in STRING</button>
      <select id="string_species" class="form-select form-select-sm" style="width:auto" aria-label="Organism for STRING">
        <option value="9606">Human</option>
        <option value="10090">Mouse</option>
        <option value="10116">Rat</option>
        <option value="7227">Fruit fly</option>
        <option value="6239">C. elegans</option>
        <option value="7955">Zebrafish</option>
        <option value="4932">Yeast</option>
        <option value="3702">Arabidopsis</option>
        <option value="511145">E. coli K-12</option>
      </select>
    </div>
    <div class="form-text">Chord, heatmap and Sankey views of the same network (the Sankey flows along the inter-layer edges, per node, group or layer) and Circos input files; one-click hand-offs to the Vega editor, Gephi Lite and STRING.</div>
  </details>

  <details class="lp-section lp-more" id="exportCard_session">
    <summary>Session</summary>
    <button id="export_session" class="btn btn-outline-primary btn-sm">Save Session (JSON)</button>
    <div class="form-text">The complete scene — layers, nodes, edges, colours, shapes, containers — to load again with File → Load Session or to hand off through the API.</div>
  </details>

  <div id="export_status" class="small mt-2"></div>
</div>
`

function status(msg: string, isError = false): void {
  const el = document.getElementById('export_status')
  if (!el) return
  el.textContent = msg
  el.className = `small mt-2 ${isError ? 'text-danger' : 'text-success'}`
}

export function initExportPanel(): void {
  const pane = document.getElementById('panel-export')
  if (!pane) return
  pane.innerHTML = EXPORT_HTML

  // `fn` may return its own done message in place of `done`
  const run = (
    id: string,
    fn: () => void | string | Promise<void | string>,
    done: string
  ) =>
    document.getElementById(id)?.addEventListener('click', () => {
      Promise.resolve()
        .then(fn)
        .then((r) => status(typeof r === 'string' ? r : done))
        .catch((err: unknown) => {
          if (!(err instanceof ExportError) && !(err instanceof Error))
            throw err
          status(err.message, true)
        })
    })
  const text = (t: string, type: string) => new Blob([t], { type })

  run(
    'export_scene_image',
    () => {
      if (!exportSceneImage())
        throw new ExportError('Nothing to export — load a network first.')
    },
    'Image exported.'
  )
  run(
    'export_png_sized',
    () => {
      const size = Number(
        (document.getElementById('png_size') as HTMLSelectElement).value
      )
      if (!exportSceneImage(size))
        throw new ExportError('Nothing to export — load a network first.')
    },
    'Image exported.'
  )
  run(
    'export_svg',
    () => download(text(svgText(), 'image/svg+xml'), 'arena3d_scene.svg'),
    'SVG exported.'
  )
  run(
    'export_glb',
    async () => download(await glbBlob(), 'arena3d_scene.glb'),
    '3D scene exported (GLB).'
  )
  run(
    'export_graphml',
    () =>
      download(
        text(graphmlText(), 'application/graphml+xml'),
        'arena3d_network.graphml'
      ),
    'GraphML exported.'
  )
  run(
    'export_cx2',
    () =>
      download(
        text(JSON.stringify(cx2Json()), 'application/json'),
        'arena3d_network.cx2'
      ),
    'CX2 exported.'
  )
  run(
    'export_cyjs',
    () =>
      download(
        text(JSON.stringify(cyjsJson(), null, 1), 'application/json'),
        'arena3d_network.cyjs'
      ),
    'Cytoscape.js JSON exported.'
  )
  run(
    'export_sif',
    () => download(zip(sifFiles()), 'arena3d_cytoscape_sif.zip'),
    'SIF and attribute tables exported.'
  )
  run(
    'export_muxviz',
    () => download(zip(muxvizFiles()), 'arena3d_muxviz.zip'),
    'MuxViz files exported.'
  )
  run('export_session', () => exportSession(), 'Session saved.')
  run(
    'export_chord',
    () => download(text(chordSvg(), 'image/svg+xml'), 'arena3d_chord.svg'),
    'Chord diagram exported.'
  )
  run(
    'export_heatmap',
    () => download(text(heatmapSvg(), 'image/svg+xml'), 'arena3d_heatmap.svg'),
    'Heatmap exported.'
  )
  run(
    'export_matrix',
    () => download(text(adjacencyCsv(), 'text/csv'), 'arena3d_matrix.csv'),
    'Adjacency matrix exported.'
  )
  run(
    'export_circos',
    () => download(zip(circosFiles()), 'arena3d_circos.zip'),
    'Circos files exported.'
  )
  const sankeyLevel = () =>
    (document.getElementById('sankey_level') as HTMLSelectElement)
      .value as SankeyLevel
  // the level the diagram was drawn at (a coarser one when the asked level
  // had too many bands)
  const sankeyDone = (what: string, level: SankeyLevel) =>
    `${what} exported (${level === sankeyLevel() ? level : `${level}: too many bands per ${sankeyLevel().replace(/s$/, '')}`}).`
  run(
    'export_sankey',
    () => {
      const { svg, level } = sankeySvg(sankeyLevel())
      download(text(svg, 'image/svg+xml'), `arena3d_sankey_${level}.svg`)
      return sankeyDone('Sankey diagram', level)
    },
    'Sankey diagram exported.'
  )
  run(
    'export_sankey_matic',
    () => {
      const { text: t, level } = sankeyMaticText(sankeyLevel())
      download(text(t, 'text/plain'), `arena3d_sankey_${level}.txt`)
      return sankeyDone('SankeyMATIC text', level)
    },
    'SankeyMATIC text exported.'
  )
  run(
    'export_sankey_plotly',
    () => {
      const { json, level } = sankeyPlotlyJson(sankeyLevel())
      download(text(json, 'application/json'), `arena3d_sankey_${level}.json`)
      return sankeyDone('Plotly Sankey', level)
    },
    'Plotly Sankey exported.'
  )
  document.getElementById('open_vega')?.addEventListener('click', () => {
    try {
      window.open(vegaEditorUrl(), '_blank')
      status('Opened the heatmap in the Vega editor.')
    } catch (err) {
      status(err instanceof Error ? err.message : String(err), true)
    }
  })
  document.getElementById('open_gephi')?.addEventListener('click', () => {
    // open the tab now (inside the click) so popup blockers allow it
    const tab = window.open('', '_blank')
    status('Hosting the GraphML for Gephi Lite…')
    hostGraphml()
      .then((url) => {
        const target = gephiLiteUrl(url)
        if (tab) tab.location.href = target
        else window.open(target, '_blank')
        status(
          `Opened in Gephi Lite: ${ctx.nodeObjects.length} nodes, ${ctx.edgeObjects.length} edges (the file is kept for one hour).`
        )
      })
      .catch((err: unknown) => {
        tab?.close()
        status(err instanceof Error ? err.message : String(err), true)
      })
  })
  document.getElementById('open_string')?.addEventListener('click', () => {
    try {
      const species = Number(
        (document.getElementById('string_species') as HTMLSelectElement).value
      )
      window.open(stringUrl(species), '_blank')
      status('Opened the proteins in STRING.')
    } catch (err) {
      status(err instanceof Error ? err.message : String(err), true)
    }
  })

  document.getElementById('export_cytoscape')?.addEventListener('click', () => {
    const server = (
      document.getElementById('cytoscape_server') as HTMLInputElement
    ).value
    status('Sending to Cytoscape…')
    sendToCytoscape(server)
      .then(({ nodes, edges }) =>
        status(
          `Opened in Cytoscape: ${nodes} nodes, ${edges} edges (one network, layers side by side).`
        )
      )
      .catch((err: unknown) =>
        status(err instanceof Error ? err.message : String(err), true)
      )
  })

  const normaServer = () =>
    (
      document.getElementById('norma_server') as HTMLInputElement
    ).value.trim() || NORMA_DEFAULT_SERVER
  const payload = () =>
    normaPayload('Arena3D network', store.get().selectedLayers)
  document.getElementById('export_norma')?.addEventListener('click', () => {
    let data: NormaPayload
    try {
      data = payload()
    } catch (err) {
      return status(err instanceof Error ? err.message : String(err), true)
    }
    // open the tab now (inside the click) so popup blockers allow it
    const tab = window.open('', '_blank')
    status('Sending to NORMA…')
    sendToNorma(normaServer(), data)
      .then(({ url, expiresInHours }) => {
        if (tab) tab.location.href = url
        else window.open(url, '_blank')
        status(
          `Opened in NORMA (${Object.keys(data.groups).length} groups, ${data.edges.length} edges)` +
            (expiresInHours
              ? `; the link is kept for ${expiresInHours} h.`
              : '.')
        )
      })
      .catch((err: unknown) => {
        tab?.close()
        status(err instanceof Error ? err.message : String(err), true)
      })
  })
  const flameMode = () =>
    (document.getElementById('flame_mode') as HTMLSelectElement)
      .value as FlameMode
  const flameServer = () =>
    (document.getElementById('flame_server') as HTMLInputElement).value
  run(
    'open_flame',
    () => {
      const lists = flameLists(flameMode())
      const url = flameUrl(flameServer(), lists)
      if (!window.open(url, '_blank'))
        throw new ExportError('The browser blocked the Flame tab (pop-ups).')
      const genes = lists.reduce((a, l) => a + l.genes.length, 0)
      return `Opened in Flame: ${lists.length} gene list${lists.length === 1 ? '' : 's'}, ${genes} genes.`
    },
    'Opened in Flame.'
  )
  document.getElementById('copy_flame')?.addEventListener('click', () => {
    try {
      const lists = flameLists(flameMode())
      if (!navigator.clipboard)
        throw new ExportError('The browser blocks clipboard access here.')
      navigator.clipboard.writeText(flameText(lists)).then(
        () =>
          status(
            `${lists.length} gene list${lists.length === 1 ? '' : 's'} copied to the clipboard: paste into Flame.`
          ),
        () => status('The clipboard refused the lists.', true)
      )
    } catch (err) {
      status(err instanceof Error ? err.message : String(err), true)
    }
  })
  document
    .getElementById('export_norma_link')
    ?.addEventListener('click', () => {
      try {
        const link = normaLink(normaServer(), payload())
        const note =
          link.length > 8000
            ? ` (${Math.round(link.length / 1000)} kB — long links may fail in some browsers; use Open in NORMA instead)`
            : ''
        if (!navigator.clipboard)
          throw new Error(
            'The browser blocks clipboard access here; use NORMA JSON or Open in NORMA instead.'
          )
        // report what actually happened, not just the attempt
        navigator.clipboard.writeText(link).then(
          () => status(`NORMA link copied to the clipboard${note}.`),
          () =>
            status(
              'The clipboard refused the link; use NORMA JSON or Open in NORMA instead.',
              true
            )
        )
      } catch (err) {
        status(err instanceof Error ? err.message : String(err), true)
      }
    })
  run(
    'export_norma_json',
    () =>
      download(
        text(JSON.stringify(payload(), null, 2), 'application/json'),
        'arena3d_norma.json'
      ),
    'NORMA payload exported.'
  )

  let stop: (() => void) | null = null
  const videoBtn = document.getElementById('export_video') as HTMLButtonElement
  videoBtn.addEventListener('click', () => {
    if (stop) return stop()
    try {
      // 0.5° per frame at ~60 fps -> a full turn in ~12 s
      stop = recordRotation(12, (blob) => {
        stop = null
        videoBtn.textContent = 'Rotation Video (WebM)'
        download(blob, 'arena3d_rotation.webm')
        status('Video exported.')
      })
      videoBtn.textContent = 'Stop Recording'
      status('Recording one rotation (about 12 s)…')
    } catch (err) {
      status(err instanceof Error ? err.message : String(err), true)
    }
  })
}
