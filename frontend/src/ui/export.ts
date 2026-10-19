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
  svgToPng,
  umapCsv,
  umapEmbedding,
  umapPoints,
  umapScatterSvg,
  umapTitle,
  UMAP_COLOURS,
  vegaUmapUrl,
  type UmapColour,
  type UmapPoints,
} from '../actions/umap'
import { initUmapForm, readUmapChoice, umapFormHtml } from './umap'
import {
  cosmographLink,
  cosmographLinksCsv,
  cosmographNodesCsv,
} from '../actions/cosmograph'
import {
  FLAME_DEFAULT_SERVER,
  flameLists,
  flameText,
  flameUrl,
  type FlameMode,
} from '../actions/flame'
import {
  circosjsData,
  circosjsHtml,
  goslingEditorLink,
  goslingSpec,
  html,
  jbrowseFiles,
  jbrowseLink,
  ngcircosHtml,
  ngcircosInput,
  ringNetwork,
  ringSize,
  ringWarning,
  type Ring,
  type RingTrack,
} from '../actions/circular_tools'
import { valueColumns } from '../actions/values'
import { bus } from '../bus'
import { FOLD_ALL_HTML } from './sections'
import { selectedChannels } from './layouts'

const EXPORT_HTML = `
<div class="col-md-8 col-lg-6 layout-panel export-panel">
  ${FOLD_ALL_HTML}
  <details class="lp-section lp-more" id="exportCard_image">
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
    <details class="lp-more lp-sub" id="exportSub_formats">
      <summary>GraphML &amp; MuxViz<span class="lp-hint">files for other network software</span></summary>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button id="export_graphml" class="btn btn-outline-primary btn-sm" title="Gephi, igraph, NetworkX, yEd">GraphML</button>
        <button id="export_muxviz" class="btn btn-outline-primary btn-sm">MuxViz (zip)</button>
      </div>
      <div class="form-text">GraphML opens in Gephi, igraph, NetworkX and yEd; MuxViz gets its files in one zip.</div>
    </details>
    <details class="lp-more lp-sub" id="exportSub_norma">
      <summary>NORMA<span class="lp-hint">each layer becomes a group</span></summary>
      <div class="d-flex flex-wrap gap-2">
        <input id="norma_server" class="form-control form-control-sm" style="max-width: 16rem" value="${NORMA_DEFAULT_SERVER}" aria-label="NORMA server address" />
        <button id="export_norma" class="btn btn-primary btn-sm" title="Store the network on the NORMA server and open it there">Open in NORMA</button>
        <button id="export_norma_link" class="btn btn-outline-primary btn-sm" title="A link carrying the network itself — no server storage; small networks">Copy NORMA Link</button>
        <button id="export_norma_json" class="btn btn-outline-primary btn-sm">NORMA JSON</button>
      </div>
      <div class="form-text">The layers ticked in the Layer selection tab (all if none). Copies of a node become one NORMA node in several groups.</div>
    </details>
    <details class="lp-more lp-sub" id="exportSub_flame">
      <summary>Flame<span class="lp-hint">functional enrichment of the gene names</span></summary>
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
    <details class="lp-more lp-sub" id="exportSub_cosmograph">
      <summary>Cosmograph<span class="lp-hint">GPU viewer for large networks</span></summary>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button id="open_cosmograph" class="btn btn-primary btn-sm" title="The two CSV files hosted on this server for one hour and opened in cosmograph.app by link">Open in Cosmograph</button>
        <button id="export_cosmograph_links" class="btn btn-outline-primary btn-sm" title="source, target, weight, channel, source_layer, target_layer">Cosmograph links (CSV)</button>
        <button id="export_cosmograph_nodes" class="btn btn-outline-primary btn-sm" title="id, label, layer, color, size, cluster, annotations, values, metrics, UMAP x/y">Cosmograph nodes (CSV)</button>
      </div>
      <div class="form-text">The whole network; nodes are named node_layer, so copies in different layers stay apart. Without a link to this server, download both files and drop them on cosmograph.app.</div>
    </details>
    <details class="lp-more lp-sub" id="exportSub_umap">
      <summary>UMAP view<span class="lp-hint">the nodes as a 2D map</span></summary>
      <div id="umapExport" class="umap-export">
        <div class="lp-grid mb-2">
          <div>
            <label class="form-label small" for="umapxPoints">Points</label>
            <select id="umapxPoints" class="form-select form-select-sm">
              <option value="copies">one per node copy (layers as one network)</option>
              <option value="names">one per node name (copies merged)</option>
            </select>
          </div>
          <div>
            <label class="form-label small" for="umapxColour">Colour by</label>
            <select id="umapxColour" class="form-select form-select-sm">
              ${UMAP_COLOURS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
        </div>
        ${umapFormHtml('umapx')}
        <div class="d-flex flex-wrap align-items-center gap-2 mt-2">
          <button id="export_umap_svg" class="btn btn-outline-primary btn-sm" title="A 2D scatter of the nodes, coloured as chosen, with a legend">UMAP scatter (SVG)</button>
          <button id="export_umap_png" class="btn btn-outline-primary btn-sm">UMAP scatter (PNG)</button>
          <button id="export_umap_csv" class="btn btn-outline-primary btn-sm" title="node_id, node, layer, umap_1, umap_2, cluster, annotation: for Python, R or a spreadsheet">UMAP coordinates (CSV)</button>
          <button id="open_umap_vega" class="btn btn-primary btn-sm" title="Interactive scatter in the Vega editor; the chart travels in the link, nothing is uploaded">UMAP in Vega Editor</button>
        </div>
        <div class="form-text">The layers ticked in Layer selection (all if none), computed on the server once per set of options. The same modes as the UMAP layout (Layout panel), without moving the nodes.</div>
      </div>
    </details>
  </details>

  <details class="lp-section lp-more" id="exportCard_visualizations">
    <summary>Visualizations</summary>
    <details class="lp-more lp-sub" id="exportSub_chord">
      <summary>Chord diagram &amp; Circos<span class="lp-hint">layers as arcs, edges as chords</span></summary>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button id="export_chord" class="btn btn-outline-primary btn-sm" title="Layers as arcs, nodes along them, edges as chords">Chord diagram (SVG)</button>
        <button id="export_circos" class="btn btn-outline-primary btn-sm" title="karyotype, links and a circos.conf for the Circos software">Circos files (zip)</button>
      </div>
      <div class="form-text">The chord diagram as an SVG; Circos gets a karyotype, the links and a circos.conf to draw it in the Circos software.</div>
    </details>
    <details class="lp-more lp-sub" id="exportSub_gosling">
      <summary>Gosling.js<span class="lp-hint">interactive circular view with zoom and tooltips</span></summary>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button id="open_gosling" class="btn btn-primary btn-sm" title="The node and edge tables hosted on this server for one hour, opened in the Gosling editor with a spec that reads them">Open in Gosling Editor</button>
        <button id="export_gosling" class="btn btn-outline-primary btn-sm" title="A Gosling JSON spec with the data inside">Gosling spec (JSON)</button>
      </div>
      <div class="form-text">Layers as segments, nodes as positions along them with degree bars, edges as arcs within a layer and links between layers, coloured by channel. The ticked layers (all if none) and the channels ticked for layouts.</div>
    </details>
    <details class="lp-more lp-sub" id="exportSub_ngcircos">
      <summary>NGCircos.js<span class="lp-hint">the most Circos-like web library</span></summary>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button id="export_ngcircos_html" class="btn btn-outline-primary btn-sm" title="A page that loads NGCircos.js from a CDN and draws the network">NGCircos page (HTML)</button>
        <button id="export_ngcircos_json" class="btn btn-outline-primary btn-sm" title="The genome, modules and settings for new NGCircos(...modules, genome, settings)">NGCircos modules (JSON)</button>
        <select id="ngcircos_track" class="form-select form-select-sm ring-track" style="width:auto" aria-label="NGCircos ring track"></select>
      </div>
      <div class="form-text">Layers as the genome, nodes as coloured arcs, a histogram or heatmap ring of degree (or a File → Values column) and the edges as links. The page opens in any browser online.</div>
    </details>
    <details class="lp-more lp-sub" id="exportSub_circosjs">
      <summary>CircosJS<span class="lp-hint">D3 chords with heatmap and histogram tracks</span></summary>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button id="export_circosjs_html" class="btn btn-outline-primary btn-sm" title="A page that loads CircosJS from a CDN and draws the network">CircosJS page (HTML)</button>
        <button id="export_circosjs_json" class="btn btn-outline-primary btn-sm" title="Layout, node, track and chord data for CircosJS">CircosJS data (JSON)</button>
        <select id="circosjs_track" class="form-select form-select-sm ring-track" style="width:auto" aria-label="CircosJS ring track"></select>
      </div>
      <div class="form-text">Layers as the layout, nodes as a coloured ring, a histogram or heatmap track of degree (or a File → Values column) and the edges as chords. The page opens in any browser online.</div>
    </details>
    <details class="lp-more lp-sub" id="exportSub_jbrowse">
      <summary>JBrowse 2<span class="lp-hint">the genome browser's circular view</span></summary>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button id="open_jbrowse" class="btn btn-primary btn-sm" title="The files hosted on this server for one hour, opened in JBrowse Web's Circular View">Open in JBrowse 2</button>
        <button id="export_jbrowse" class="btn btn-outline-primary btn-sm" title="config.json, the edges as VCF breakends, the layers as FASTA, and a README">JBrowse 2 files (zip)</button>
      </div>
      <div class="form-text">JBrowse reads genomes, so the network stands in for one: each layer a sequence (2 bp per node), each edge a VCF breakend drawn as a chord. The zip loads into JBrowse 2 Web or Desktop.</div>
    </details>
    <details class="lp-more lp-sub" id="exportSub_heatmap">
      <summary>Heatmap &amp; matrix<span class="lp-hint">the adjacency matrix, by layer</span></summary>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button id="export_heatmap" class="btn btn-outline-primary btn-sm" title="Adjacency matrix with the nodes grouped by layer">Heatmap (SVG)</button>
        <button id="export_matrix" class="btn btn-outline-primary btn-sm" title="Adjacency matrix for R, Python or Morpheus">Matrix (CSV)</button>
        <button id="open_vega" class="btn btn-primary btn-sm" title="Interactive heatmap in the Vega editor; the chart travels in the link, nothing is uploaded">Heatmap in Vega Editor</button>
      </div>
      <div class="form-text">An SVG, a CSV for R, Python or Morpheus, or an interactive heatmap in the Vega editor (the chart travels in the link; nothing is uploaded).</div>
    </details>
    <details class="lp-more lp-sub" id="exportSub_sankey">
      <summary>Sankey<span class="lp-hint">inter-layer edges as flows</span></summary>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button id="export_sankey" class="btn btn-outline-primary btn-sm" title="Layers as columns, inter-layer edges as flows">Sankey (SVG)</button>
        <button id="export_sankey_matic" class="btn btn-outline-primary btn-sm" title="Source [amount] Target lines for sankeymatic.com">SankeyMATIC (text)</button>
        <button id="export_sankey_plotly" class="btn btn-outline-primary btn-sm" title="A Plotly figure: plotly.js, Python, Chart Studio">Plotly Sankey (JSON)</button>
        <select id="sankey_level" class="form-select form-select-sm" style="width:auto" aria-label="Sankey bands">
          ${SANKEY_LEVELS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-text">Layers as columns and the inter-layer edges as flows, banded per node, group or layer: an SVG, text for sankeymatic.com or a Plotly figure (plotly.js, Python, Chart Studio).</div>
    </details>
    <details class="lp-more lp-sub" id="exportSub_web">
      <summary>Gephi Lite &amp; STRING<span class="lp-hint">open the network on their websites</span></summary>
      <div class="d-flex flex-wrap align-items-center gap-2">
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
      <div class="form-text">Gephi Lite gets the network as GraphML, hosted on this server for one hour; STRING shows the selected proteins (or all) for the organism chosen.</div>
    </details>
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

  // Gosling, NGCircos, CircosJS and JBrowse 2 (actions/circular_tools.ts):
  // the ticked layers and the channels ticked for layouts
  const ring = (column: string | null = null) =>
    ringNetwork(selectedChannels(), column)
  const ringDone = (what: string, r: Ring) =>
    `${what} exported: ${ringSize(r)}${ringWarning(r)}.`
  // the ring track choice: "histogram:-1" (degree) or "heatmap:<column index>"
  const trackOptions = () =>
    [
      ...(['histogram', 'heatmap'] as const).flatMap((style) => [
        [`${style}:-1`, `degree as ${style}`],
        ...valueColumns().map((c, i) => [
          `${style}:${i}`,
          `${html(c)} as ${style}`,
        ]),
      ]),
      ['none:-1', 'no ring track'],
    ]
      .map(([v, l]) => `<option value="${v}">${l}</option>`)
      .join('')
  const fillTracks = () =>
    pane
      .querySelectorAll<HTMLSelectElement>('select.ring-track')
      .forEach((s) => {
        const was = s.value
        s.innerHTML = trackOptions()
        if ([...s.options].some((o) => o.value === was)) s.value = was
      })
  fillTracks()
  bus.on('values:loaded', fillTracks)
  const trackOf = (id: string): { track: RingTrack; r: Ring } => {
    const [style, at] = (
      document.getElementById(id) as HTMLSelectElement
    ).value.split(':')
    const column = valueColumns()[Number(at)] ?? null
    return { track: style as RingTrack, r: ring(column) }
  }
  run(
    'export_gosling',
    () => {
      const r = ring()
      download(
        text(JSON.stringify(goslingSpec(r), null, 1), 'application/json'),
        'arena3d_gosling.json'
      )
      return ringDone('Gosling spec', r)
    },
    'Gosling spec exported.'
  )
  run(
    'export_ngcircos_html',
    () => {
      const { track, r } = trackOf('ngcircos_track')
      download(
        text(ngcircosHtml(r, track), 'text/html'),
        'arena3d_ngcircos.html'
      )
      return ringDone('NGCircos page', r)
    },
    'NGCircos page exported.'
  )
  run(
    'export_ngcircos_json',
    () => {
      const { track, r } = trackOf('ngcircos_track')
      download(
        text(
          JSON.stringify(ngcircosInput(r, track), null, 1),
          'application/json'
        ),
        'arena3d_ngcircos.json'
      )
      return ringDone('NGCircos modules', r)
    },
    'NGCircos modules exported.'
  )
  run(
    'export_circosjs_html',
    () => {
      const { track, r } = trackOf('circosjs_track')
      download(
        text(circosjsHtml(r, track), 'text/html'),
        'arena3d_circosjs.html'
      )
      return ringDone('CircosJS page', r)
    },
    'CircosJS page exported.'
  )
  run(
    'export_circosjs_json',
    () => {
      const { track, r } = trackOf('circosjs_track')
      download(
        text(
          JSON.stringify(circosjsData(r, track), null, 1),
          'application/json'
        ),
        'arena3d_circosjs.json'
      )
      return ringDone('CircosJS data', r)
    },
    'CircosJS data exported.'
  )
  run(
    'export_jbrowse',
    () => {
      const r = ring()
      download(zip(jbrowseFiles(r)), 'arena3d_jbrowse.zip')
      return ringDone('JBrowse 2 files', r)
    },
    'JBrowse 2 files exported.'
  )
  // host the files, then open the tool on them (the tab opens inside the
  // click, so popup blockers allow it)
  const openHosted = (
    id: string,
    tool: string,
    link: (r: Ring) => Promise<string>
  ) =>
    document.getElementById(id)?.addEventListener('click', () => {
      let r: Ring
      try {
        r = ring()
      } catch (err) {
        return status(err instanceof Error ? err.message : String(err), true)
      }
      const tab = window.open('', '_blank')
      if (tab) tab.opener = null // the site opened cannot steer this tab
      status(`Hosting the files for ${tool}…`)
      link(r)
        .then((url) => {
          if (tab) tab.location.href = url
          else window.open(url, '_blank', 'noopener,noreferrer')
          status(
            `Opened in ${tool}: ${ringSize(r)}${ringWarning(r)} (the files are kept for one hour).`
          )
        })
        .catch((err: unknown) => {
          tab?.close()
          status(err instanceof Error ? err.message : String(err), true)
        })
    })
  openHosted('open_gosling', 'the Gosling editor', goslingEditorLink)
  openHosted('open_jbrowse', 'JBrowse 2', jbrowseLink)
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
  // Cosmograph (actions/cosmograph.ts)
  run(
    'export_cosmograph_links',
    () => {
      download(
        text(cosmographLinksCsv(), 'text/csv'),
        'arena3d_cosmograph_links.csv'
      )
    },
    'Cosmograph links exported.'
  )
  run(
    'export_cosmograph_nodes',
    () => {
      download(
        text(cosmographNodesCsv(), 'text/csv'),
        'arena3d_cosmograph_nodes.csv'
      )
    },
    'Cosmograph nodes exported.'
  )
  document.getElementById('open_cosmograph')?.addEventListener('click', () => {
    // open the tab inside the click, so popup blockers allow it
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null // the site opened cannot steer this tab
    status('Hosting the CSV files for Cosmograph…')
    cosmographLink()
      .then((url) => {
        if (tab) tab.location.href = url
        else window.open(url, '_blank', 'noopener,noreferrer')
        status(
          `Opened in Cosmograph: ${ctx.nodeObjects.length} nodes, ${ctx.edgeObjects.length} edges (the files are kept for one hour).`
        )
      })
      .catch((err: unknown) => {
        tab?.close()
        status(err instanceof Error ? err.message : String(err), true)
      })
  })

  // UMAP view: computed once per network and options (actions/umap.ts)
  initUmapForm('umapx')
  const umapView = async () => {
    const choice = readUmapChoice('umapx')
    const pick = (id: string) =>
      (document.getElementById(id) as HTMLSelectElement).value
    const points = pick('umapxPoints') as UmapPoints
    const colour = pick('umapxColour') as UmapColour
    status('Computing the UMAP view on the server…')
    const positions = await umapEmbedding(choice, points)
    const pts = umapPoints(positions, colour, points)
    return { pts, colour, title: `Arena3D ${umapTitle(choice)}` }
  }
  const umapDone = (what: string, n: number) => `${what} exported: ${n} points.`
  run(
    'export_umap_svg',
    async () => {
      const v = await umapView()
      const svg = umapScatterSvg(v.pts, v.title, v.colour)
      download(text(svg, 'image/svg+xml'), 'arena3d_umap.svg')
      return umapDone('UMAP scatter', v.pts.length)
    },
    'UMAP scatter exported.'
  )
  run(
    'export_umap_png',
    async () => {
      const v = await umapView()
      download(
        await svgToPng(umapScatterSvg(v.pts, v.title, v.colour)),
        'arena3d_umap.png'
      )
      return umapDone('UMAP scatter', v.pts.length)
    },
    'UMAP scatter exported.'
  )
  run(
    'export_umap_csv',
    async () => {
      const v = await umapView()
      download(text(umapCsv(v.pts), 'text/csv'), 'arena3d_umap.csv')
      return umapDone('UMAP coordinates', v.pts.length)
    },
    'UMAP coordinates exported.'
  )
  document.getElementById('open_umap_vega')?.addEventListener('click', () => {
    // open the tab inside the click, so popup blockers allow it
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null // the site opened cannot steer this tab
    umapView()
      .then((v) => {
        const url = vegaUmapUrl(v.pts, v.title, v.colour)
        if (tab) tab.location.href = url
        else window.open(url, '_blank', 'noopener,noreferrer')
        status(
          `Opened the UMAP scatter in the Vega editor: ${v.pts.length} points.`
        )
      })
      .catch((err: unknown) => {
        tab?.close()
        status(err instanceof Error ? err.message : String(err), true)
      })
  })
  document.getElementById('open_vega')?.addEventListener('click', () => {
    try {
      window.open(vegaEditorUrl(), '_blank', 'noopener,noreferrer')
      status('Opened the heatmap in the Vega editor.')
    } catch (err) {
      status(err instanceof Error ? err.message : String(err), true)
    }
  })
  document.getElementById('open_gephi')?.addEventListener('click', () => {
    // open the tab now (inside the click) so popup blockers allow it
    const tab = window.open('', '_blank')
    if (tab) tab.opener = null // the site opened cannot steer this tab
    status('Hosting the GraphML for Gephi Lite…')
    hostGraphml()
      .then((url) => {
        const target = gephiLiteUrl(url)
        if (tab) tab.location.href = target
        else window.open(target, '_blank', 'noopener,noreferrer')
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
      window.open(stringUrl(species), '_blank', 'noopener,noreferrer')
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
    if (tab) tab.opener = null // the site opened cannot steer this tab
    status('Sending to NORMA…')
    sendToNorma(normaServer(), data)
      .then(({ url, expiresInHours }) => {
        if (tab) tab.location.href = url
        else window.open(url, '_blank', 'noopener,noreferrer')
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
      const tab = window.open(url, '_blank')
      if (!tab)
        throw new ExportError('The browser blocked the Flame tab (pop-ups).')
      tab.opener = null // Flame cannot steer this tab
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
