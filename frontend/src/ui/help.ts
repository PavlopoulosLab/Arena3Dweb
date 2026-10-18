// Help panel: one page per menu panel. Static HTML fragment + inner tab switching.

// Tab-separated examples as tables: real tabs render as uneven gaps once
// names differ in length, so columns are shown as cells and the caption
// reminds that the file itself is tab-separated.
// A JSON example, indented, with keys, strings, numbers and booleans
// coloured (CSS .help-json), so the structure can be followed at a glance.
function json(value: unknown): string {
  const text = JSON.stringify(value, null, 2)
  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g,
      (m, str: string | undefined, colon: string | undefined, kw, num) => {
        if (str !== undefined)
          return colon
            ? `<span class="j-k">${str}</span>${colon}`
            : `<span class="j-s">${str}</span>`
        if (kw !== undefined) return `<span class="j-b">${m}</span>`
        if (num !== undefined) return `<span class="j-n">${m}</span>`
        return m
      }
    )
  return `<pre class="help-json">${html}</pre>`
}

// Field | Type | Meaning table for a JSON object
function fields(rows: [string, string, string][]): string {
  const cell = (t: string) => `<td>${t}</td>`
  return `<table class="help-tsv help-fields"><thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead><tbody>${rows
    .map(
      ([name, type, meaning]) =>
        `<tr><td><code>${name}</code></td>${cell(type)}${cell(meaning)}</tr>`
    )
    .join('')}</tbody></table>`
}

function tsv(
  rows: string[][],
  opts: { header?: boolean; note?: string } = {}
): string {
  const header = opts.header ?? true
  const width = Math.max(...rows.map((r) => r.length))
  const cell = (tag: string, v: string | undefined) =>
    `<${tag}>${v === undefined || v === '' ? '<span class="help-empty">(empty)</span>' : v}</${tag}>`
  const body = (header ? rows.slice(1) : rows)
    .map(
      (r) =>
        `<tr>${Array.from({ length: width }, (_, i) => cell('td', r[i])).join('')}</tr>`
    )
    .join('')
  const head = header
    ? `<thead><tr>${rows[0].map((c) => cell('th', c)).join('')}</tr></thead>`
    : ''
  // the note sits above the table, not in a caption that would wrap to the
  // table's width
  return `<div class="help-tsv-note">${opts.note ?? 'Tab-separated columns, shown as a table'}</div><table class="help-tsv">${head}<tbody>${body}</tbody></table>`
}

const HELP_HTML = `
<div id="helpDiv">
<div class="tab">
  <button class="tablinks" data-help-tab="Start_tab">Getting Started</button>
  <button class="tablinks" data-help-tab="Howto_tab">How to…</button>
  <button class="tablinks" data-help-tab="Examples_tab">Examples</button>
  <button class="tablinks" data-help-tab="File_tab">File</button>
  <button class="tablinks" data-help-tab="Databases_tab">Database Importers</button>
  <button class="tablinks" data-help-tab="Find_tab">Find</button>
  <button class="tablinks" data-help-tab="Navigation_tab">3D View &amp; Navigation</button>
  <button class="tablinks" data-help-tab="Layouts_tab">Layout</button>
  <button class="tablinks" data-help-tab="Scene_tab">Scene &amp; Camera</button>
  <button class="tablinks" data-help-tab="Node_tab">Edit → Nodes</button>
  <button class="tablinks" data-help-tab="Edge_tab">Edit → Edges</button>
  <button class="tablinks" data-help-tab="Layer_tab">Edit → Layers</button>
  <button class="tablinks" data-help-tab="Style_tab">Edit → Style</button>
  <button class="tablinks" data-help-tab="Analyze_tab">Analyze</button>
  <button class="tablinks" data-help-tab="Export_tab">Export</button>
  <button class="tablinks" data-help-tab="API_tab">API</button>
  <button class="tablinks" data-help-tab="Cytoscape_tab">Cytoscape App</button>
  <button class="tablinks" data-help-tab="About_tab">About</button>
</div>

<div id="Start_tab" class="tabcontent">
  <h2>Getting Started</h2>
  <img class="help-shot" src="${import.meta.env.BASE_URL}images/help/ui/topbar.png" alt="The top bar: Home, View, Find, File, Database Importers, Layout, Edit, Analyze, Export and Help menus, the Multilayered / Single network switch, the theme picker and Undo / Redo" loading="lazy">
  <p>
    Arena3D shows a multilayered network in 3D: every layer is a floor (or a disk, cube, sphere or cloud), a node
    may appear in several layers, and edges run within layers (intra-layer) or between them (inter-layer). Edges can
    carry weights, directions and several information channels.
  </p>
  <ol>
    <li><b>Load a network</b> — File → upload a file or load a saved session; Database Importers → import from STRING, IntAct,
      OmniPath or NDEx; or pick an example on the Home page.</li>
    <li><b>Lay it out</b> — Layer selection → tick the layers to work on; Layout → an algorithm; optionally align
      layers, cluster, or run a group layout.</li>
    <li><b>Explore</b> — search nodes, expand neighbourhoods, follow paths, hide weak edges.</li>
    <li><b>Analyse</b> — Analyze → node metrics, network statistics, layer comparison, enrichment.</li>
    <li><b>Style and export</b> — Edit → Style for colours, sizes, shapes and colour-blind tools; File for images,
      3D models, video, other formats or NORMA.</li>
  </ol>
  <p>Step-by-step recipes for the usual tasks are on the <i>How to…</i> page.</p>
  <h3>Menus</h3>
  <p>
    The menu bar is grouped by task, and every menu has its own colour (the open or active menu is tinted with
    it). <b>File</b>: load networks, attributes and sessions. <b>Database Importers</b>: fetch from STRING, Reactome,
    OmniPath, NDEx, IntAct and Gene Ontology. <b>View</b>: the 3D view, Scene &amp; Camera (background, axes,
    arrangements, rotation, legend) and Performance (frame rate, resolution, detail). <b>Find</b>: search nodes
    and edges. <b>Layer selection</b>: the layers the layouts, analyses and exports work on, with a Hide and a
    Labels switch per layer (Multilayered mode). <b>Layout</b>: algorithms, clustering, alignment and group
    layouts. <b>Edit</b>: Nodes (labels,
    shapes), Edges, Layers (floors, shapes, containers, split/merge) and Style (colours, sizes, palettes, colour
    vision). <b>Analyze</b>: Analysis (metrics, statistics, layer comparison, explore, annotations, enrichment,
    groups) and Data Tables. <b>Export</b>: images, 3D, video, Cytoscape, visualizations, other tools and the
    session. On phones and narrow windows the menus fold into a drawer.
  </p>
  <h3>Undo and redo</h3>
  <p>
    Every change to the scene — loading, layouts, moves, styling, camera focus — can be undone and redone with the
    Undo / Redo buttons at the top right or <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>.
  </p>
  <h3>Network mode</h3>
  <p>
    Every load — an uploaded network file, an example, a database import, a saved session or a shared link —
    first asks in an <b>Import as</b> popup, always, two things. <b>Show as</b>: a <i>Multilayered network</i>
    (every layer on its own floor) or a <i>Single 3D network</i> (one graph in space, no floors, laid out at once).
    <b>Into the view</b>: <i>Replace the current network</i>, or <i>Add to the current network</i> (needs a loaded
    network). Added to a multilayered view, the network comes in as new layers and copies of a node are linked
    across layers; added to a single 3D network it expands the view — the new nodes and edges join the graph (a
    protein already there is the same node, not a copy), the nodes already there keep their places, colours and
    sizes, and the new ones are placed next to the nodes they link to. A saved session or shared link always
    replaces the current network; only the view is asked. Two more choices: <i>Link nodes with the same name across
    layers</i> draws a line between the copies of a node in consecutive layers (ticked for database imports, which
    link copies themselves; unticked for files, which bring their own inter-layer edges — and unticking it for a
    database import leaves its links out), and <i>Lay out with Fruchterman-Reingold</i> (ticked) lays every new
    layer out at once instead of leaving random positions. The popup offers your previous answers again;
    <i>Cancel</i> (or <kbd>Esc</kbd>) loads nothing. For a network with one layer the answer also settles how it is
    shown: multilayered, it sits on a floor; single 3D, it is laid out in space. The top-bar switch changes the mode
    any time.
  </p>
  <p>
    The switch in the top bar chooses how the data are treated. <b>Multilayered</b>: every layer on its own floor,
    with all the layer controls — layer selection and cross-layer alignment in Layout, the Layers panel, layer
    arrangements, the inter-layer sliders in Edges, layer comparison in Analysis. <b>Single network</b>: one graph.
    Several layers are stacked into one 3D space and the whole network is laid out at once; floors disappear; every
    edge follows the same settings and one <i>Edge Bundling</i> slider bundles them all together; and the layer-only
    controls step aside. A network with one layer (for example a
    two-column edge list) opens in Single-network mode; Multilayered shows its floor. Switching back restores the
    layers exactly as they were, and sessions remember the mode.
  </p>
  <h3>Phones and tablets</h3>
  <p class="last_p">
    On a touch screen, drag with one finger to orbit the scene, pinch with two fingers to zoom (around your fingers)
    and move them together to pan, double-tap a node or a layer to select it, and long-press a node for its menu (a
    tap elsewhere closes it). Panels open as a sheet over the lower part of the screen, so the network stays visible
    above; the navigation table starts closed and the 2D navigator is hidden to leave room for the scene.
  </p>
</div>

<div id="Howto_tab" class="tabcontent">
  <h2>How to…</h2>
  <p>
    Short recipes for common tasks. Panel names are those of the menu bar (View, File, Database Importers, Layout, Edit,
    Analyze); every step can be undone with Undo in the top bar.
  </p>

  <h3>…load my own network</h3>
  <ol>
    <li>In a spreadsheet make the columns <i>SourceNode</i>, <i>SourceLayer</i>, <i>TargetNode</i>, <i>TargetLayer</i>
      and, if you have them, <i>Weight</i> and <i>Channel</i> — one edge per row (the File page shows an example). A
      plain two-column <i>SourceNode</i> / <i>TargetNode</i> list works too and opens as a single network.</li>
    <li>Save it as tab-separated text (.tsv or .txt); GraphML, GML, SIF and Cytoscape CX2 files load as they are.</li>
    <li>File → <i>Upload Network</i>. A problem is reported with the line at fault.</li>
    <li>Layout → choose an algorithm → <i>Run Layout</i>.</li>
  </ol>

  <h3>…build a multilayer network from databases</h3>
  <ol>
    <li>Database Importers → type the proteins (gene names or IDs) and choose the organism and a minimum score.</li>
    <li>Either <i>STRING — evidence types as channels</i> (one layer, each evidence type a curved channel) or
      <i>STRING · IntAct · OmniPath — one layer each</i> (copies of a protein linked across the layers).</li>
    <li>Layout → <i>Apply to: Align Nodes Across Selected Layers</i> → <i>Run Layout</i>: every protein sits in the
      same spot on every floor, so the databases can be compared by eye; Analyze → <i>Compare Layers</i> gives the
      overlap as numbers.</li>
  </ol>

  <h3>…line up the same node across layers</h3>
  <ol>
    <li>Layout → <i>Apply to: Align Nodes Across Selected Layers</i> for an exact alignment, or open
      <i>Cross-Layer Alignment</i> and choose <i>Soft</i>, <i>Anchor</i> or <i>Chain</i> with a strength when each
      layer should keep its own shape.</li>
    <li><i>Run Layout</i>. The misalignment score under the Run bar says how straight the inter-layer links are;
      lower is better, so settings can be compared.</li>
  </ol>

  <h3>…show pathways, GO terms or clusters as groups</h3>
  <ol>
    <li>Give nodes groups: a node attribute file with an <i>Annotation</i> column, a NORMA-format group file
      (File → <i>Upload GROUP file</i>), or Analyze → <i>Enrichment of Selected Nodes</i> → <i>Annotate Nodes with
      Top 5 Terms</i>. Clusters come from Layout → <i>Clustering</i>.</li>
    <li>Analyze → Annotations &amp; Enrichment: pies on the nodes; <i>Hulls Around</i> clusters or annotations, as
      hulls or fog clouds.</li>
    <li>Analyze → Groups: recolour, hide a group's hull, select its members, show them in the legend, open the
      Groups and Overlap tables, or <i>Collapse into Super Nodes</i>.</li>
    <li>Layout → <i>Group Layout (NORMA-2.0)</i> pulls the groups apart.</li>
  </ol>

  <h3>…colour nodes by expression or any score</h3>
  <ol>
    <li>File → <i>Upload node VALUES</i>: a <i>Node</i> column, then one numeric column per condition.</li>
    <li>Edit → Style → <i>Colour by: Uploaded values</i> → pick the column → <i>Apply Palette</i>. Values crossing
      zero get a diverging scale centred on zero; the legend shows the range. Data Tables lists the values.</li>
  </ol>

  <h3>…find nodes, neighbours and paths</h3>
  <ol>
    <li>Find → <i>Nodes</i> (or <i>Edges</i>): exact, contains, starts/ends with, or a regular expression;
      <i>Focus camera</i> flies to the matches.</li>
    <li>Analyze → Explore: <i>Expand Selection</i> by one or two hops, within or across layers; <i>Shortest Path</i>
      between exactly two selected nodes (double-click each; a name search selects every copy of a node, so pick
      the two copies you mean).</li>
    <li>Right-click a node for its neighbours, a multilayer path or its link and description.</li>
  </ol>

  <h3>…untangle a dense network</h3>
  <ol>
    <li>Edit → Edges: <i>Intra-</i> and <i>Inter-Layer Edge Bundling</i> merge similar edges into flows;
      <i>Hide Edges with Weight Below</i> drops the weak ones.</li>
    <li><i>Pause Inter-Layer Edges</i> (top left) while arranging; hide a layer in Layout → Layers.</li>
    <li>View → Scene &amp; Camera → <i>By Inter-Layer Links</i> places strongly connected layers next to each other.</li>
  </ol>

  <h3>…treat the data as one graph</h3>
  <ol>
    <li>Top bar → <i>Single network</i>: the layers are stacked into one 3D space, floors disappear and the layer
      controls step aside; <i>Multilayered</i> brings everything back.</li>
    <li>To really merge copies of a node, Edit → Layers → <i>Merge Selected Layers</i> (undoable).</li>
  </ol>

  <h3>…make a figure for a paper or a talk</h3>
  <ol>
    <li>Pick a theme in the top bar (<i>Light</i> or <i>Paper</i> print well); Edit → Style → <i>Colour-Blind
      Friendly Mode</i>, and <i>Preview as</i> to check it.</li>
    <li>Labels: Edit → Nodes and Edit → Layers → <i>Show Labels</i>; the legend: View → Scene &amp; Camera →
      <i>Show Legend</i>.</li>
    <li>Export: PNG at 4096 or 8192 px, SVG for a vector editor, GLB for 3D viewers and slides, <i>Rotation
      Video</i> for a talk.</li>
  </ol>

  <h3>…save, share or hand off</h3>
  <ol>
    <li>File → <i>Save Session</i> keeps everything — positions, colours, shapes, bundling, the network mode;
      <i>Load Session</i> restores it.</li>
    <li>File → <i>Send to NORMA</i> opens the network in NORMA with each layer as a group; <i>Copy NORMA Link</i>
      makes a link.</li>
    <li>From your own code, <i>POST /api/open</i> with a list of edges returns a link that opens the network here
      (Help → API).</li>
  </ol>

  <h3>…work on a phone or tablet</h3>
  <ol>
    <li>One finger orbits, two fingers pinch to zoom and move to pan, double-tap selects, long-press opens the
      node menu.</li>
    <li>Panels open as a sheet from the bottom; the ☰ button holds the menu, the network mode and the theme.</li>
  </ol>

  <h3>…undo anything</h3>
  <p class="last_p">
    <i>Undo</i> / <i>Redo</i> in the top bar, or <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>:
    layouts, colours, moves, mode switches, restructuring, imports — every change to the scene.
  </p>
</div>

<div id="Examples_tab" class="tabcontent">
  <h2>Example Data</h2>
  <img class="help-shot" src="${import.meta.env.BASE_URL}images/help/ui/home.jpg" alt="The Home page with the example picker" loading="lazy">
  <p>
    Choose an example on the Home page (<i>Try an example</i>) or in File → <i>Example</i> and press
    <i>Load Example</i>: every network below is listed, opened as its saved session where there is one — among
    them a network without layers, a 3D network with the layers ignored and layers drawn as spheres. Every file can
    also be downloaded below.
  </p>
  <p>
    <b>Network without layers (SARS-CoV-2 interactome): </b> <br />
    A <a href="${import.meta.env.BASE_URL}data/covid19_no_layers.tsv" download>2-column edgelist</a> of the COVID-19 network below: no
    layer columns, so all nodes share one layer and no floor is drawn. Try Layout → <i>3D Layout</i> to lift it into
    3D. <br />
  </p>
  <hr>
  <p>
    <b>3D network, layers ignored (SARS-CoV-2): </b> <br />
    A <a href="${import.meta.env.BASE_URL}data/covid19_3d_network.json" download>session</a> saved in <i>Single network</i>
    mode: virus proteins, host proteins, drugs, complexes and processes share one 3D space and keep
    their layer colours. Untick the option to get the five layers back. <br />
  </p>
  <hr>
  <p>
    <b>Layers as spheres (GPCR signalling): </b> <br />
    A <a href="${import.meta.env.BASE_URL}data/GPCRs_spheres.json" download>session</a> in which the GPCR, G-protein, GRK and effector
    layers are spheres (Edit → Layers → <i>Layer Shape</i>) with a 3D layout inside each. <br />
  </p>
  <hr>
  <p>
    <b>Minimal 2-column edgelist (single default layer): </b> <br />
    A <a href="${import.meta.env.BASE_URL}data/edgelist_2columns.tsv" download>minimal edgelist</a> with only SourceNode and TargetNode columns. <br />
  </p>
  <hr>
  <p>
    <b>Random networks with different topologies mapped in 6 layers: </b> <br />
    The <a href="${import.meta.env.BASE_URL}data/figure1_data.tsv" download>network file</a>. <br />
    An <a href="${import.meta.env.BASE_URL}data/figure1_export.json" download>exported session</a> of this example. <br />
  </p>
  <hr>
  <p>
    <b>Weighted network with 4 layers (the Load Example network): </b> <br />
    The <a href="${import.meta.env.BASE_URL}data/figure2A_data.tsv" download>network file</a>. <br />
    An <a href="${import.meta.env.BASE_URL}data/figure2A_export.json" download>exported session</a> of this example forming a cube in 3D space. <br />
  </p>
  <hr>
  <p>
    <b>Network with 4 layers, with node and edge attribute files: </b> <br />
    The <a href="${import.meta.env.BASE_URL}data/figure2B_data.tsv" download>network file</a>. <br />
    <a href="${import.meta.env.BASE_URL}data/figure2B_data_node_attributes.tsv" download>Node attributes file</a>.<br />
    <a href="${import.meta.env.BASE_URL}data/figure2B_data_edge_attributes.tsv" download>Edge attributes file</a>. <br />
    An <a href="${import.meta.env.BASE_URL}data/figure2B_export.json" download>exported session</a> of this example. <br />
  </p>
  <hr>
  <p>
    <b>SARS-CoV-2 example: </b> <br />
    A <a href="${import.meta.env.BASE_URL}data/covid19_data.tsv" download>COVID-19 network</a> (virus proteins, host proteins, drugs,
    complexes and processes) based on <a href="https://www.nature.com/articles/s41586-020-2286-9" target="_blank">Gordon et al.</a> <br />
    <a href="${import.meta.env.BASE_URL}data/covid19_data_node_attributes.tsv" download>Node attributes file</a>.<br />
    <a href="${import.meta.env.BASE_URL}data/covid19_data_edge_attributes.tsv" download>Edge attributes file</a>.<br />
    An <a href="${import.meta.env.BASE_URL}data/covid19_export.json" download>exported session</a> of this example. <br />
  </p>
  <hr>
  <p>
    <b>GPCR example (GPCRs, G proteins, GRKs and effectors): </b> <br />
    The <a href="${import.meta.env.BASE_URL}data/GPCRs_data.tsv" download>network file</a>. <br />
    <a href="${import.meta.env.BASE_URL}data/GPCRs_data_node_attributes.tsv" download>Node attributes file</a>.<br />
    <a href="${import.meta.env.BASE_URL}data/GPCRs_data_edge_attributes.tsv" download>Edge attributes file</a>.<br />
    An <a href="${import.meta.env.BASE_URL}data/GPCRs_export.json" download>exported session</a> of this example. <br />
  </p>
  <hr>
  <p>
    <b>Aspirin network with 3 weighted data channels: </b> <br />
    The <a href="${import.meta.env.BASE_URL}data/aspirin_3channels.tsv" download>network file</a>. <br />
    An <a href="${import.meta.env.BASE_URL}data/aspirin_3channels_directed.json" download>exported session</a> of this example (directed). <br />
  </p>
  <hr>
  <p>
    <b><a href="https://imbbc.hcmr.gr/project/prego/" target="_blank">PREGO</a> 3-channel example
      for 'anaerobic ammonium oxidation' process associations:</b> <br />
    The <a href="${import.meta.env.BASE_URL}data/prego.tsv" download>network file</a>. <br />
    An <a href="${import.meta.env.BASE_URL}data/prego.json" download>exported session</a> of this example. <br />
  </p>
  <hr>
  <p>
    <b>Cytoscape–Arena3D aspirin multi-channel interoperability example: </b> <br />
    The <a href="${import.meta.env.BASE_URL}data/StringApp_aspirin.cys" download>network file</a> in Cytoscape format. <br />
    An <a href="${import.meta.env.BASE_URL}data/Arena3DApp_aspirin.json" download>exported session</a> of this example. <br />
  </p>
  <hr>
  <p>
    <b>Scripts: </b> <br />
    A <a href="${import.meta.env.BASE_URL}data/transpose.py" download>Python script</a> that turns grouped lists into one pair per line.
    This input:
  </p>
  ${tsv(
    [
      ['Group1', 'A,B,C,D'],
      ['Group2', 'X,Y,Z'],
    ],
    { header: false, note: 'Input: tab-separated, no header line' }
  )}
  <p>becomes:</p>
  ${tsv(
    [
      ['Group1', 'A'],
      ['Group1', 'B'],
      ['Group1', 'C'],
      ['Group1', 'D'],
      ['Group2', 'X'],
      ['Group2', 'Y'],
      ['Group2', 'Z'],
    ],
    { header: false, note: 'Output: one pair per line' }
  )}
  <p class="last_p">Run it as <code>python transpose.py filename.txt</code>; the result is saved as
    <i>reformatted_filename.txt</i>.</p>
</div>

<div id="File_tab" class="tabcontent">
  <h2>File</h2>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/file.png" alt="The File panel" loading="lazy">

  <h3>Upload Network</h3>
  <p>
    The Arena3D format is a TAB-separated file with the headers <b><i>SourceNode, TargetNode, SourceLayer and
    TargetLayer</i></b> and two optional columns, <b><i>Weight</i></b> and <b><i>Channel</i></b>; column order does not
    matter. A minimal 2-column edgelist (<i>SourceNode, TargetNode</i>) is also accepted and puts all nodes in one
    layer. Weights are mapped to [0–1] and shown as edge opacity, width or both (Edit → Edges). Channels are
    parallel information types (for example evidence sources) drawn as curved parallel edges.
  </p>
  <p>
    <i>Upload Network</i> also reads <b>GraphML</b> (.graphml/.xml), <b>GML</b>, <b>SIF</b> and Cytoscape
    <b>CX2</b> (.cx2/.cx), recognised by the file extension. A node attribute called <i>layer</i> puts nodes in layers
    (otherwise everything lands in one layer); edge attributes <i>weight</i> and <i>channel</i>/<i>interaction</i>
    become weights and channels (SIF relation types become channels).
  </p>
  <p>
    The online version accepts up to 10,000 edges, 18 layers and 9 channels. Running Arena3D locally (see About),
    the edge and node limits are set with the <i>ARENA_MAX_EDGES</i> and <i>ARENA_MAX_NODES</i> environment
    variables.
  </p>

  <h3>Checks and progress</h3>
  <p>
    Files are checked in the browser before they are sent: size (20 MB), file type, TAB separation (comma- or
    semicolon-separated files are refused), the required columns (names are case-sensitive), rows with too few
    columns and non-numeric weights — the message names the line at fault. A progress bar shows the upload, the
    server-side check and the scene build. Errors found on the server are shown as plain messages, with the line
    number where possible.
  </p>

  <h3>Group and value files</h3>
  <p>
    <i>Upload GROUP file</i> reads annotation groups in NORMA's format — one group per line: the group name, a TAB,
    then its members separated by commas or semicolons (a <i>Node</i> / <i>Group</i> two-column file works too).
    Nodes are matched by name in every layer, and the groups appear as pies and hulls and in Analyze → Groups.
    <i>Upload node VALUES</i> reads a numeric table — a <i>Node</i> column, then one column per condition or score
    (expression values, say); blank cells are allowed. Edit → Style then colours nodes by any column, with a
    diverging scale when the values cross zero, and the legend shows the range.
  </p>
  ${tsv(
    [
      ['Apoptosis', 'TP53, BAX, BBC3'],
      ['DNA repair', 'TP53, ATM, BRCA1'],
    ],
    {
      header: false,
      note: 'Group file: no header line — group name, TAB, its members',
    }
  )}
  ${tsv(
    [
      ['Node', 'control', 'treated'],
      ['TP53', '1.5', '-2.0'],
      ['BAX', '', '3.1'],
    ],
    { note: 'Values file: tab-separated; blank cells are allowed' }
  )}

  <h3>Loaded networks</h3>
  <p>
    Every network loaded from a file, an example, a database or a link is kept in the <i>Loaded networks</i> list:
    switch between them and each comes back exactly as left (layout, colours, shapes, annotations, mode) — a
    switch is one undo step. <i>Compare Networks</i> puts the active network against another one in Data Tables →
    Network Comparison: layers, nodes by name, node copies, edges by name and by copy, and the nodes of every
    shared layer, with the counts in both, in one only and the Jaccard index, plus an UpSet plot of the node sets
    of every layer of both networks. Remove a network from the list with ×.
  </p>
  <h3>Sessions and attributes</h3>
  <p>
    <i>Save Session</i> writes the whole scene — layers, positions, colours, shapes, sizes, annotations, floor shapes,
    hidden floors, layer shapes (cube, sphere, cloud) and the camera — to a JSON file; <i>Load Session</i> restores
    it. A session saved in <i>Single network</i> mode reloads in that mode and still remembers the
    layers, so unticking the option brings them back. <i>Upload NODE attributes</i> adds per-node
    colour, size, URL, description and annotations (shown when right-clicking a node);
    <i>Upload EDGE attributes</i> colours individual edges.
  </p>

  <h3>File formats</h3>
  <p>Network file:</p>
  ${tsv(
    [
      [
        'SourceNode',
        'SourceLayer',
        'TargetNode',
        'TargetLayer',
        'Weight',
        'Channel',
      ],
      ['An', 'Group1', 'Cn', 'Group1', '2', '1'],
      ['An', 'Group1', 'Bn', 'Group1', '10', '1'],
      ['Bn', 'Group1', 'Cn', 'Group1', '1', '1'],
      ['Cn', 'Group1', 'Dn', 'Group1', '3', '1'],
      ['En', 'Group2', 'Fn', 'Group2', '4', '1'],
      ['En', 'Group2', 'Hn', 'Group2', '5', '1'],
      ['In', 'Group3', 'Jn', 'Group3', '8', '1'],
      ['Bn', 'Group1', 'Fn', 'Group2', '9', '1'],
      ['Dn', 'Group1', 'Hn', 'Group2', '11', '1'],
      ['Dn', 'Group1', 'In', 'Group3', '1', '1'],
      ['Hn', 'Group2', 'In', 'Group3', '1', '1'],
    ],
    {
      note: 'Network file: tab-separated; Weight and Channel are optional, column order is free',
    }
  )}

  <p>Minimal 2-column edgelist (one layer):</p>
  ${tsv(
    [
      ['SourceNode', 'TargetNode'],
      ['An', 'Bn'],
      ['An', 'Cn'],
      ['Bn', 'Cn'],
      ['Cn', 'Dn'],
    ],
    { note: 'Two-column edge list: every node lands in one layer' }
  )}

  <p>
    Node attributes — only <i>Node</i> and <i>Layer</i> are required, and only the nodes of interest need to be listed.
    <i>Annotation</i> takes several terms separated by <i>;</i> (shown as pie charts and hulls, see Analyze).
  </p>
  ${tsv(
    [
      ['Node', 'Layer', 'Color', 'Size', 'Url', 'Description', 'Annotation'],
      [
        'An',
        'Group1',
        '#6b6a4c',
        '1',
        '',
        "A node's description.",
        'Pathway A;Pathway B',
      ],
      ['Bn', 'Group1', '#ccccff', '2', '', '', 'Pathway A'],
      ['En', 'Group2', '', '4', 'https://normaviz.org', 'Opens NORMA.', ''],
      ['Kn', 'Group4', '#e0f2f2', '', '', '', ''],
    ],
    {
      note: 'Node attribute file: only Node and Layer are required; leave a cell empty to keep the default',
    }
  )}

  <p>Edge attributes — <i>Color</i> in hex; optional <i>Channel</i>:</p>
  ${tsv(
    [
      ['SourceNode', 'SourceLayer', 'TargetNode', 'TargetLayer', 'Color'],
      ['An', 'Group1', 'Cn', 'Group1', '#4EFBE9'],
      ['Bn', 'Group1', 'Fn', 'Group2', '#D64EFB'],
    ],
    {
      note: 'Edge attribute file: Color in hex; an optional Channel column targets one channel',
    }
  )}

  <p class="last_p">The session JSON format is described in the <i>API</i> tab.</p>
</div>

<div id="Databases_tab" class="tabcontent">
  <h2>Database Importers</h2>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/databases.png" alt="The Database Importers panel: one card per source" loading="lazy">
  <p>
    The Database Importers panel (top menu) fetches networks straight from public resources. As in NORMA, every source is an
    expandable, colour-coded card with its own fields and Import button, and a <b>?</b> that opens this page; the
    cards start folded — click a card's title to open it.
    Proteins, organism and score typed in one card are copied to the other cards that take them. Each card shows a
    progress bar under its button while it fetches, builds the scene and lays the network out.
  </p>
  <ul>
    <li><b>STRING</b>: the options of NORMA's STRING importer (see <i>STRING in detail</i> below).
      Type proteins or genes (Ctrl+Enter fetches), choose the organism (or <i>Other</i> and an NCBI taxon ID), the
      network (functional associations or physical interactions only), how many interactors STRING adds and the
      minimum confidence; the result is one layer whose edges are STRING's evidence channels.</li>
    <li><b>Reactome</b>: pathways as layers. Search a pathway by name — the hits sort by name, ID or as found — and
      click a hit, or type identifiers such as
      <i>R-HSA-109581</i>, one per line; each pathway becomes a layer holding its proteins, with STRING's interactions
      among them as the layer's edges, and copies of a protein are linked across the pathway layers. <i>Genes per
      pathway</i> caps large pathways (the first N genes are kept and the warning says so).</li>
    <li><b>OmniPath</b>: curated signalling interactions among (or around) the proteins, one layer; human, mouse
      and rat. Gene symbols in any case or UniProt IDs.</li>
    <li><b>NDEx</b>: paste the UUID (or the link) of a public network from ndexbio.org, or load one of the examples
      (NCI-PID p53 pathway, SIGNOR Inhibition of Apoptosis, SARS-CoV-2/Human interactome) with one click.</li>
    <li><b>IntAct</b>: experimentally verified interactions with their MI-score, one layer; gene names or UniProt
      IDs.</li>
    <li><b>Only interactions among these proteins</b> (IntAct, OmniPath, Compare databases): ticked, only the edges
      between two of the typed proteins; unticked, their other interaction partners join too and the network grows
      around them. With one protein its partners are always included. When nothing is found among the proteins, the
      message says how many interactions with other partners there are.</li>
    <li><b>Gene Ontology</b>: GO terms as layers. Search a term by name or type identifiers such as
      <i>GO:0006915</i>; each term becomes a layer holding the genes annotated to it in the chosen organism
      (QuickGO), with STRING's interactions among them; <i>Include genes of child terms</i> (ticked by default)
      widens the set. The search hits sort by name, ID or as found.</li>
    <li><b>Compare databases</b>: STRING, IntAct and OmniPath each become a layer, and copies of the same protein
      are linked between layers, so the databases can be compared side by side (try Layout → Align Nodes Across
      Selected Layers). By default only interactions among the typed proteins are kept.</li>
  </ul>
  <p>
    Before fetching, the <b>Import as</b> popup asks how to show the network (multilayered or single 3D) and
    whether it replaces the current network or is added to it. Added as layers, every layer and node already there
    stays where it was, the new layers line up after the last one and every copy of a node is linked to the copies
    with the same name in the other layers (channel <i>same node</i> when the network has channels) — run a layout
    for the new layers afterwards. Added to a single 3D network, the view expands in place (see Home → Network mode).
  </p>
  <h3>STRING in detail</h3>
  <ul>
    <li><b>Interactors to add</b> (0–500): STRING's best partners of the typed proteins join the network.</li>
    <li><b>Minimum confidence</b>: Highest (0.900), High (0.700), Medium (0.400), Low (0.150) or a custom value.</li>
    <li><b>Evidence channels</b>: gene neighborhood, gene fusion, co-occurrence, co-expression, experiments, curated
      databases and text mining, each drawn in STRING's colour. Untick a channel to leave that evidence out: each
      connection's confidence is then recomputed from the ticked channels only, the way STRING combines them
      (the prior is removed from every channel, the channels are combined as independent evidence and the prior is
      added back), and connections that fall below the minimum are left out (the status line says how many).
      <i>Edges</i>: one edge per channel (a multi-edge, one curved line per evidence type, weighted by that
      channel's score) or one edge per pair carrying the combined score.</li>
    <li><b>Groupings from functional terms</b>: each ticked term collection (GO processes, functions and components,
      KEGG, Reactome, WikiPathways, UniProt keywords, Pfam, InterPro and SMART domains, diseases, tissues,
      subcellular localization, Monarch phenotypes, STRING's local network clusters, reference publications — and,
      if ticked, any other collection STRING offers) becomes an annotation set, with one group per term, ready for pies,
      hulls and the Groups card; switch between the sets in the Annotations card. <i>Enriched in the network</i>
      (recommended) keeps the terms enriched among the network's proteins with an FDR at most the given value;
      <i>All annotations of its proteins</i> keeps every term (KEGG pathways come only with enriched terms, because
      STRING does not share full KEGG annotations). <i>Groups per collection</i> keeps the best terms (lowest FDR, or
      the largest), and <i>Smallest group</i> drops terms with fewer proteins in the network. <i>None</i> turns
      groupings off. <i>Fetch groupings for the current view</i> does the same for whatever network is loaded,
      using its node names.</li>
    <li><b>STRING server</b>: <i>Connect</i> through this server, directly from the browser, or automatically (through
      this server, switching to the browser for the rest of the session if the server cannot reach STRING — decided
      at the first request). <i>Address</i>: https://string-db.org answers with the latest STRING version (the status
      line names it); a version address such as https://version-12-0.string-db.org gives the same answers every time.
      <i>Fetch protein descriptions</i> puts STRING's description of every protein on its node (right-click a node →
      Description; Find searches it too), and every node links to its STRING page (right-click → Link).</li>
  </ul>
  <p>STRING asks callers to wait a second between requests and to identify themselves; both are respected.</p>
  <p class="last_p">
    Imports use the same size limits as uploaded files and can be undone. The API equivalents are
    <i>POST /api/import/string</i> (with <i>/api/import/string/groupings</i> for the groupings of a list of names), <i>/api/import/reactome</i>, <i>/api/import/go</i>, <i>/api/import/databases</i>
    (IntAct, OmniPath and the comparison) and <i>/api/import/ndex</i>; <i>GET /api/import/reactome/search</i> and
    <i>/api/import/go/search</i> find pathways and terms by name.
  </p>
</div>

<div id="Find_tab" class="tabcontent">
  <h2>Find</h2>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/find.png" alt="The Find panel: node and edge search" loading="lazy">
  <p>The Find panel (top menu) searches nodes and edges by name and selects what it finds.</p>
  <h3>Nodes</h3>
  <p>
    Type one or more names (comma-separated) and press Enter. The mode decides how names match: <i>Exact</i>,
    <i>Contains</i>, <i>Starts with</i>, <i>Ends with</i> (suffix) or a <i>Regular expression</i> (for example
    <code>^MDM[24]$</code>); tick <i>Case-sensitive</i> if needed. Matches replace the selection and are listed under
    the box; with <i>Focus camera</i> the view pans and zooms onto them. Click a listed node to focus on it alone.
  </p>
  <h3>Edges</h3>
  <p class="last_p">
    Type node names (comma-separated) or a regular expression and choose what to match: <i>Either end</i>, the
    <i>Source</i> or the <i>Target</i> only, <i>Both ends</i> (each end must match) or the edge <i>Channel</i>; the
    modes are the same as for nodes. Matching edges are selected — Analyze → Data Tables → Selected Edges lists
    them with their layers, channels and weights — and listed under the box as <i>A — B</i> with their layers;
    click one to focus on its two nodes, or keep <i>Focus camera</i> ticked to fly to all of them.
  </p>
</div>

<div id="Navigation_tab" class="tabcontent">
  <h2>3D View &amp; Navigation</h2>
  <img class="help-shot" src="${import.meta.env.BASE_URL}images/help/ui/view.jpg" alt="The 3D view with the navigation controls, the legend and the navigator" loading="lazy">
  <p>The legend at the top of the navigation table lists the mouse and keyboard controls:</p>
  <ul>
    <li><b>Zoom</b>: mouse wheel (or pinch), without limits; <b>double-click the background</b> to fit the whole
      network back into the window. <b>Pan</b>: drag the background, or the arrow keys. <b>Orbit</b>: drag with the
      middle mouse button.</li>
    <li><b>Move a layer</b>: drag it. <b>Rotate selected layers</b>: hold <kbd>Z</kbd>, <kbd>X</kbd> or
      <kbd>C</kbd> and drag. <b>Move selected nodes</b> within their layer: hold <kbd>Z</kbd> or <kbd>C</kbd> and drag
      (selected nodes take priority over layers).</li>
    <li><b>Select</b> a node or layer: double-click it (it flashes on hover and changes colour when selected).
      <b>Lasso</b>: hold <kbd>Shift</kbd> and drag. <b>Unselect all</b> (and fit the view): double-click the background.</li>
    <li><b>Right-click a node</b> to select its neighbours (in every layer), a multilayer path starting from it, or a
      downstream path through the following layers, and to open its URL or description. Right-click the background
      to save the view as an image.</li>
  </ul>
  <h3>Navigation table</h3>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/navcontrols.png" alt="The navigation controls: shortcuts, scene, layer and node controls" loading="lazy">
  <p>
    <i>Navigation Controls</i> shows or hides the table; <i>Pause Inter-Layer Edges</i> hides inter-layer edges while
    you work on large networks. The coloured buttons act on the red (X), green (Y) and blue (Z) axes:
  </p>
  <ul>
    <li><b>Scene</b>: rotate the whole network by the chosen angle (1°–15°); with <i>Enable Scene Auto Rotate</i>
      (Scene &amp; Camera) it keeps turning. <i>Recenter Network</i> fits the whole network back into the window
      (as does a double-click on the background).</li>
    <li><b>Single network mode</b> has no layers to drag or turn: the left button rotates the network, the middle
      button (or the arrow keys) pans it, and <kbd>Z</kbd>, <kbd>X</kbd> or <kbd>C</kbd> + drag turns it about one
      axis; the table lists the controls of the current mode.</li>
    <li><b>Layers</b>: rotate and move the selected layers, scale them (0.2×–5×), and spread out or gather all
      layers along X.</li>
    <li><b>Nodes</b>: spread out or gather the selected nodes in their layers, move them, and scale them
      (0.2×–5×).</li>
  </ul>
  <p class="last_p">
    The 2D navigator at the bottom right shows the whole network; click or drag in it to pan the 3D view (turn it off
    in Scene &amp; Camera). The theme picker in the top bar recolours the scene — Dark, Light, Gray, Midnight,
    Blueprint, Solarized, Forest, Paper, Pastel or High Contrast; menus and panels keep their own colours, so they
    stay legible with every theme. Theme changes can be undone.
  </p>
</div>

<div id="Layouts_tab" class="tabcontent">
  <h2>Layout</h2>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/layout.png" alt="The Layout panel" loading="lazy">

  <p>
    The panel follows the order of work: <b>1 · Layers</b> (how many layers are ticked in the <i>Layer selection</i>
    tab, with a button to it), <b>2 · Layout</b> (algorithm, what to apply it to, options and clustering), then <i>Run Layout</i> in the bar that stays at the bottom of the
    panel, with the result and the misalignment score next to it. The optional extras — Cross-Layer Alignment and Group
    Layout — are folded below; click a title to open it. In <i>Single network</i> mode (top bar) the panel works the
    NORMA way: the layer section, the scope and the alignment are hidden, every layout applies to the whole network,
    and the <i>Groups</i> card — clusters or annotation terms, drawn as fog clouds or hulls, with pie charts for
    nodes in several groups — is the main tool.
  </p>
  <h3>Layer selection (top bar)</h3>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/layer_selection.png" alt="The Layer selection panel" loading="lazy">
  <p>
    The layers to work on are ticked in the <i>Layer selection</i> tab of the top bar (Multilayered mode): the
    layouts, the alignment, the analyses and the NORMA and Flame exports run on the ticked layers, or on every
    layer while none is ticked. Each row shows the floor colour and the node count, and can also hide the layer
    with its inter-layer edges or show its node labels; <i>Select/Deselect All Layers</i> and <i>Invert</i> act on
    the whole list, and the count under them says what is selected.
  </p>
  <h3>1 · Layers</h3>
  <p>
    The first section of the Layout panel reports how many layers are ticked and opens the Layer selection tab;
    multi-channel networks list their channels here, each with a weight for the layout.
  </p>
  <h3>2 · Layout: apply to</h3>
  <ul>
    <li><i>Per Layer</i> — each selected layer is laid out on its own.</li>
    <li><i>All Selected Layers</i> — the selected layers are combined into one network; nodes return to their own
      layers afterwards.</li>
    <li><i>Selected Nodes Only</i> — only the selected nodes move, within each layer, with the <i>Layout inside
      clusters / selected nodes</i> algorithm (or the main one if none is chosen).</li>
    <li><i>Align Nodes Across Selected Layers</i> — the layers are merged by node name and laid out once, so every
      copy of a node sits in the same spot in each layer and inter-layer edges run straight. Links between copies of
      a node are ignored while computing it. Applies to layouts and clustering.</li>
  </ul>

  <h3>Algorithms</h3>
  <ul>
    <li><b>Fruchterman-Reingold</b>, <b>Kamada-Kawai</b>, <b>DrL</b>, <b>Graphopt</b> and <b>Large Graph Layout</b>:
      force-directed layouts; DrL, Graphopt and LGL suit larger graphs.</li>
    <li><b>Reingold-Tilford</b> and <b>Sugiyama</b>: tree and layered layouts for hierarchies and directed acyclic
      graphs.</li>
    <li><b>Circle</b>, <b>Grid</b> and <b>Random</b>: simple placements (in 3D, Circle places nodes on a sphere).</li>
    <li><b>Multidimensional Scaling</b>: keeps graph distances as plane distances as far as possible.</li>
  </ul>
  <img src="${import.meta.env.BASE_URL}images/help/layouts_figure.png" alt="Examples of layout algorithms" style="max-width:100%;" loading="lazy">

  <h3>Clustering</h3>
  <p>
    <i>Clustering (optional)</i> finds communities with <b>Louvain</b>, <b>Walktrap</b>,
    <b>Fast Greedy</b>, <b>Label Propagation</b> or <b>Leiden</b>, colours them, arranges the clusters with the main
    algorithm and lays each cluster out with <i>Layout inside clusters / selected nodes</i> (the main algorithm if
    none is chosen). With <i>Align Nodes Across Selected Layers</i>, Leiden runs as multiplex
    Leiden and finds communities shared by all selected layers.
  </p>
  <img src="${import.meta.env.BASE_URL}images/help/clustering.png" alt="Clustered layout" style="max-width:100%;" loading="lazy">

  <h3>3 · Clustering as a step of its own</h3>
  <p>
    The <i>Clustering</i> section finds communities without moving the nodes — <i>Within each layer</i>, over the
    <i>selected layers as one graph</i>, or <i>shared across layers by node name</i> (multiplex Leiden for Leiden,
    the label-merged graph for the others). The nodes are coloured by community and Data Tables → Clustering Data
    lists the memberships. <i>Use Clusters as Annotations</i> turns them into annotation terms (<i>Cluster 1</i>,
    <i>Cluster 2</i>, …), so pies, hulls, fog clouds, the Groups card and group layouts treat them like an
    annotation file; both steps are undoable.
  </p>
  <h3>Weighted layouts</h3>
  <p>
    <i>Use Edge Weights (and Channel Weights)</i> lets heavier edges pull their nodes closer (Fruchterman-Reingold,
    Kamada-Kawai and DrL, without clustering). In multi-channel networks each channel then gets a weight (0.1–10,
    default 1) that multiplies its edges' weights, so a network can be laid out mainly by one evidence type.
    Unchecking a channel leaves its edges out of the layout.
  </p>

  <h3>Cross-Layer Alignment</h3>
  <p>
    With the <i>Per Layer</i> scope, a 2D layout and no clustering, you can trade alignment against each layer keeping
    its own shape, to reduce crossings between layers. <i>Soft</i> blends each layer's own layout toward the fully
    aligned one; <i>Anchor to a reference layer</i> lays out the chosen layer first and starts every other layer from
    the positions of its counterparts (the same node, or partners through inter-layer edges); <i>Chain</i> anchors
    each layer to the previous one, which suits time series and long stacks. <i>Strength</i> runs from 0 (independent
    layers) to 1 (shared nodes exactly aligned). After every multi-layer layout the panel reports the
    <i>inter-layer misalignment</i> — the average in-plane distance between linked nodes of different layers, as a %
    of the layout size. Lower means straighter links, so options can be compared directly. The alignment is applied
    by <i>Run Aligned Layout</i> in the card (it sets the Per Layer scope, a 2D layout and no clustering, then runs
    the chosen algorithm) or by <i>Run Layout</i> with those settings; choosing a mode alone changes nothing yet.
  </p>

  <h3>3D Layout</h3>
  <p>
    <i>3D Layout</i> lets Fruchterman-Reingold, Kamada-Kawai, DrL, Random, Grid or Circle place nodes in 3D, off the
    floor — per layer or across the selected layers. A 2D layout afterwards flattens them again. Cube, sphere and
    cloud layers (Edit → Layers) always get 3D layouts inside their volume.
  </p>
  <h3>Layer arrangement</h3>
  <p>
    The <i>Layer Arrangement</i> card (Multilayered mode) places the floors themselves, independently of the node
    layouts: <i>Parallel Coordinates</i>, <i>Zig Zag</i>, <i>Star</i>, <i>Cube</i>, <i>Helix</i> (a spiral staircase),
    <i>Sphere</i>, <i>Grid</i>, <i>Circle</i> (floors on a ring facing the centre), <i>Chord diagram</i> (the floors
    lie flat on one ring facing you, each a sector with its nodes strung along the arc, so intra-layer edges hug the
    ring and inter-layer edges cross it as chords — the nodes move with the floors, and the view zooms out to the
    ring; the floors read best as outlines or hidden, Edit → Layers), <i>Stack</i> (horizontal
    shelves), <i>Fan</i> (pages around a vertical spine) and <i>By Inter-Layer Links</i>. <i>Arrange Layers</i>
    applies the choice; undo brings the previous arrangement back.
  </p>
  <h3>What goes together</h3>
  <p>
    The panel never offers a combination the layout service would refuse: as soon as a choice rules another out, the
    other control is disabled and a note under the section says why.
  </p>
  <ul>
    <li><i>3D Layout</i> and <i>Clustering</i> exclude each other — clustering needs a 2D layout.</li>
    <li><i>Layout inside clusters / selected nodes</i> only applies with a clustering or the <i>Selected Nodes
      Only</i> scope.</li>
    <li><i>Use Edge Weights</i> works with Fruchterman-Reingold, Kamada-Kawai and DrL on the <i>Per Layer</i> or
      <i>All Selected Layers</i> scope, without clustering or alignment.</li>
    <li><i>Cross-Layer Alignment</i> needs the <i>Per Layer</i> scope, a 2D layout and no clustering (and layers to
      align, so not in Single network mode).</li>
    <li>Group layouts run without clustering or alignment on the <i>Per Layer</i> or <i>All Selected Layers</i>
      scope.</li>
  </ul>

  <h3>Group Layout (NORMA-2.0)</h3>
  <p class="last_p">
    Lays nodes out so that groups stay apart, with the three strategies of NORMA-2.0 (Karatzas <i>et al.</i>, 2022):
    <i>Virtual node per group</i> (a hidden hub pulls each group together), <i>Group gravity</i> (members attract each
    other; <i>Force strength</i> strengthens links inside groups and weakens those between them) and <i>Super nodes
    per group</i> (each group is laid out as one node, then each group's own layout fills its disc). <i>Groups</i> can
    be clusters (run a clustered layout first), annotations, or the layers themselves: then the whole network is laid
    out once in 3D, each floor moves to its group's place and turns to face outward, and its nodes are laid out within
    it. <i>Layout inside each group</i> picks the local layout; <i>Group size</i> scales the groups. Sphere, cube and
    cloud layers get their local layouts in 3D.
  </p>
  <p>
    In <i>Single network</i> mode the card becomes <i>Groups (NORMA-2.0)</i>: the groups are the clusters
    or the annotation terms, <i>Draw groups as</i> shows them as fog clouds or hulls the way NORMA draws its groups
    (after a group layout they appear as fog clouds unless you chose otherwise), and <i>Pie charts for annotated
    nodes</i> splits nodes that belong to several groups.
  </p>
</div>

<div id="Scene_tab" class="tabcontent">
  <h2>Scene &amp; Camera</h2>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/scene.png" alt="The Scene & Camera panel" loading="lazy">
  <ul>
    <li><i>Show Scene Coord System</i> shows the X (red), Y (green) and Z (blue) axes as arrows with tick marks and
      letters through the centre of the scene; <i>Scene axes opacity</i> fades them.</li>
    <li><i>Enable Scene Auto Rotate</i> keeps the scene turning; set the axis and angle with the Scene buttons of the
      navigation table.</li>
    <li><i>Node Glow</i> makes nodes glow on dark backgrounds.</li>
    <li><i>Show Navigator (2D)</i> shows or hides the overview at the bottom right.</li>
    <li><i>Show Legend</i> shows or hides the legend at the bottom of the view: the layers after a load, then
      whatever was coloured last — groups (click an entry to select its members), a metric or value gradient.</li>
    <li>Treating the data as one 3D graph is the <i>Single network</i> mode in the top bar (Getting Started → Network
      mode); nodes keep their layer colour and <i>Multilayered</i> brings the layers back exactly as they were.</li>
    <li><i>Background Color</i> sets the background. On light backgrounds, raise floor opacity (Edit → Layers) and
      edge opacity (Edit → Edges).</li>
  </ul>
  <h3>Predefined layer arrangements</h3>
  <p>
    <i>Parallel Coordinates</i> (the default), <i>Zig Zag</i>, <i>Star</i> and <i>Cube</i>, plus <i>Helix</i> (a
    spiral staircase), <i>Sphere</i> (floors tangent to a sphere), <i>Grid</i> (floors side by side in rows),
    <i>Circle</i> (floors on a ring, facing the centre), <i>Stack</i> (horizontal shelves), <i>Fan</i> (pages around
    a vertical spine) and <i>By Inter-Layer Links</i> (layers with many links between them sit next to each other).
    The same choices sit in Layout → <i>Layer Arrangement</i>; every arrangement is undoable.
  </p>
  <img src="${import.meta.env.BASE_URL}images/help/predefined_layouts.png" alt="Predefined layer arrangements" style="max-width:100%;" loading="lazy">
  <h3>Performance</h3>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/performance.png" alt="The Performance panel: presets, rendering, while moving, live stats" loading="lazy">
  <p class="last_p">
    View → Performance tunes rendering for the network at hand. <i>Presets</i>: <i>Quality</i> (60 FPS, device
    resolution, smooth spheres), <i>Balanced</i> and <i>Fast</i> for large networks (15 FPS, 0.75× resolution,
    simple spheres, labels and inter-layer edges hidden while moving, navigator off). The individual options:
    <i>Frame rate</i> (15, 30 or 60 FPS); <i>Render resolution</i>, the pixel ratio the scene is drawn at — fewer
    pixels on 4K and retina screens is the biggest saving; <i>Node detail</i>, the sphere mesh; <i>Hide labels</i>
    and <i>Hide inter-layer edges while moving</i>, which skip the costliest work during a pan, orbit or drag;
    and the <i>Navigator refresh</i> rate. <i>Live stats</i> shows the measured frame rate, draw calls, triangles
    and line segments per frame, node and edge counts, memory use and the pixel ratio, so a change can be judged
    on the spot.
  </p>
</div>

<div id="Node_tab" class="tabcontent">
  <h2>Edit → Nodes</h2>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/nodes.png" alt="The Edit → Nodes panel" loading="lazy">
  <ul>
    <li><i>Select / Deselect all Nodes</i>. Selected nodes can be moved with the navigation table, laid out locally
      or rescaled by a metric.</li>
    <li><i>Show Labels</i>: all, selected or none; <i>Resize Labels</i> sets their size.</li>
    <li><i>Label Style</i>: colour, font (system, serif, monospace), bold, italic, a dark halo for light backgrounds,
      a background pill and opacity — applied to all node labels or to the labels of the layers selected in
      Layout, so each layer can read differently; undoable. Labels keep the theme colour until a colour is
      applied.</li>
    <li><i>Node Geometry</i>: sphere, cube, diamond, cone, cylinder, tetrahedron, capsule, torus, icosahedron,
      dodecahedron, pyramid, disc, hexagonal prism or ring — for all nodes, or for the <i>Selected layers</i> so that
      each layer gets its own shape (Edit → Style sets shapes per node; Colour-Blind Mode gives every layer a
      different one).</li>
    <li><i>Color Priority</i>: colours from the file/attributes, or from clustering.</li>
    <li><i>Highlight Selected Nodes</i>: untick to keep the original colours of selected nodes, for example to show
      the labels of a coloured path in a figure.</li>
  </ul>
</div>

<div id="Edge_tab" class="tabcontent">
  <h2>Edit → Edges</h2>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/edges.png" alt="The Edit → Edges panel" loading="lazy">
  <ul>
    <li><i>Hide Edges with Weight Below</i> filters weak edges (and weak channels of multi-channel edges) out of the
      view.</li>
    <li><i>Enable Edge Direction</i> draws arrows from source to target; two sliders size the intra- and
      inter-layer arrows.</li>
    <li><i>Show Edge Weight As</i>: opacity, width, both or neither. Whichever property weight does not drive is set
      with the intra- and inter-layer opacity and width sliders.</li>
    <li><i>Channel Curvature</i> (multi-channel networks) pulls the parallel channel edges apart, within and between
      layers.</li>
    <li><i>Highlight Selected Edges in Color</i> and <i>Priority on Loaded Edge Color</i> (colours from the edge
      attribute file). Without priority, multi-channel networks show the channel list: rename, recolour or hide each
      channel.</li>
  </ul>
  <h3>Edge Bundling</h3>
  <p>
    Two sliders, <i>Intra-Layer Edge Bundling</i> and <i>Inter-Layer Edge Bundling</i>, merge similar edges into
    shared bundles with force-directed edge bundling (Holten &amp; van Wijk, 2009): edges that run in a similar
    direction, have a similar length and lie close together attract each other, so a dense network reads as a few
    flows. Intra-layer edges bundle within their own layer; inter-layer edges bundle across the whole stack. 0 keeps
    edges straight and 1 bundles fully; values in between blend. Bundles follow the nodes when they move and are
    recomputed once the scene settles; the strengths are saved in sessions and each change can be undone. Channels of
    a multi-channel edge run side by side along its bundle. In <i>Single network</i> mode there is one slider,
    <i>Edge Bundling</i>: the stacked layers share one space, so every edge — the former inter-layer edges included —
    bundles in a single set over the whole graph, as in NORMA; the inter-layer strength is kept for the return to
    layers, where the two kinds bundle apart again.
  </p>
  <img src="${import.meta.env.BASE_URL}images/help/directed_graph.png" alt="Directed edges" style="max-width:100%;" loading="lazy">
  <img src="${import.meta.env.BASE_URL}images/help/channels.png" alt="Multi-channel edges" style="max-width:100%;" loading="lazy">
  <p class="last_p"></p>
</div>

<div id="Layer_tab" class="tabcontent">
  <h2>Edit → Layers</h2>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/layers.png" alt="The Edit → Layers panel" loading="lazy">
  <ul>
    <li><i>Show Labels</i>: all, selected or no layer labels; <i>Resize Labels</i> sets their size.</li>
    <li><i>Show Layer Coord Systems</i> shows each layer's own axes (arrows with ticks and letters at the layer's
      centre, turning with it); <i>Layer axes opacity</i> fades them.</li>
    <li><i>Layer Shape</i> turns the selected layers (or all) into 3D containers — <i>Cube</i>, <i>Sphere</i> or
      <i>Fog cloud</i> (soft puffs of fog filling the volume, no hard boundary, as in NORMA) — or <i>None</i>, or back to a flat <i>Floor</i>. Nodes of a 3D layer
      are laid out in 3D inside it and kept inside spheres and cubes; layers are spaced so volumes don't overlap.</li>
    <li><i>3D Container Look</i> sets the colour (or the <i>Theme default</i>, a colour chosen to contrast with each
      theme's background) and the opacity of cube, sphere and fog-cloud containers for the selected layers (or
      all); saved in sessions and undoable.</li>
    <li><i>Floor Shape</i> makes the floors square or round (disk); nodes outside a disk are pulled inside, and
      layouts on disk floors stay inside the circle.</li>
    <li><i>Floor Style</i> draws the floors of the selected layers (or all) as a <i>Solid</i> plane, a
      <i>Wireframe</i>, a <i>Grid</i> or <i>Dotted grid</i> over a faint plane, or the <i>Outline</i> only; saved in
      sessions and undoable. <i>Show Layer Floors</i> hides or shows them (single-layer networks load without
      one).</li>
    <li><i>Floor Opacity</i>, <i>Floor Color</i> and <i>Color Priority</i> (colours from a session, or from the
      theme and colour picker).</li>
  </ul>
  <h3>Restructure Layers</h3>
  <p class="last_p">
    <i>Split Selected Layer by Cluster</i> turns every cluster of one selected layer into its own layer — run a
    clustered layout on it first; edges between clusters become inter-layer edges. <i>Merge Selected Layers</i>
    flattens the selected layers into one: copies of the same node merge and the links between them disappear.
    <i>Lift Nodes by Degree</i> raises each node off its floor in proportion to its degree; any 2D layout flattens
    them again.
  </p>
</div>

<div id="Style_tab" class="tabcontent">
  <h2>Edit → Style</h2>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/style.png" alt="The Edit → Style panel" loading="lazy">
  <p>
    <b>Nodes.</b> Choose what to change (<i>Selected nodes</i>, <i>All nodes</i> or one layer), then apply a colour, a
    size or a shape (sphere, cube, diamond, cone, cylinder, tetrahedron). <i>Colour by</i> colours nodes by layer,
    cluster, first annotation or degree, with a palette: <i>Distinct</i> (checked for colour-blind readers),
    <i>Okabe–Ito</i> (the standard colour-blind-safe set) or, for degree, <i>Blues</i> / <i>Cividis</i> (colour-blind
    optimised). Palettes have 8 colours; further groups are grey rather than repeating a colour. <i>Uploaded values</i>
    (after a values file) colours nodes by a column of that file: a sequential ramp, or a diverging blue–pale–red scale
    centred on zero when the column has values on both sides of it. Every colouring updates the legend.
  </p>
  <p>
    <b>Edges.</b> Choose all, selected, intra-layer or inter-layer edges and set a colour or a width (×0.25–5);
    <i>Channel Palette</i> recolours the channels.
  </p>
  <p class="last_p">
    <b>Colour vision.</b> <i>Colour-Blind Friendly Mode</i> switches to Okabe–Ito colours by layer (or by cluster
    after clustering), recolours channels, and gives each layer its own node shape, so groups never rely on colour
    alone. <i>Preview as</i> simulates protanopia, deuteranopia, tritanopia or achromatopsia on the view, to check a
    figure before publishing. Shapes, colours, sizes and widths are saved in sessions.
  </p>
</div>

<div id="Analyze_tab" class="tabcontent">
  <h2>Analyze</h2>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/analyze.png" alt="The Analysis panel" loading="lazy">

  <h3>Node Metrics</h3>
  <p>
    <i>Scale Nodes by Topology Metric</i> sizes nodes by Degree, Clustering Coefficient, Betweenness, Closeness or
    Eigenvector Centrality, PageRank, Coreness (k-core) or Eccentricity — per layer or across the selected layers —
    and by three multilayer metrics: <i>Multiplex Degree</i> (links summed over the layers), <i>Participation
    Coefficient</i> (0 when all of a node's links are in one layer, 1 when spread evenly) and <i>Multilayer
    PageRank</i> (PageRank on the whole stack with copies of a node linked). <i>Treat the network as</i> says how
    the edges make a graph: <i>undirected</i> merges parallel edges (the channels of a node pair) into one;
    <i>directed</i> keeps source → target, so betweenness, closeness, PageRank and eigenvector centrality follow the
    edge direction; <i>multi-edged</i> keeps every channel as an edge of its own, so degree and the centralities
    count them all (the clustering coefficient merges them, as it needs a simple graph). <i>Also Color Nodes by
    Metric</i> colours them from blue (low) to red (high).
  </p>

  <h3>Network</h3>
  <p>
    <i>Network Statistics</i> reports, for each selected layer (or every layer) and the whole network: nodes, edges,
    density, average and maximum degree, connected components and the largest one, diameter and average path length,
    average clustering, transitivity and degree assortativity, plus a degree-distribution chart. <i>Compare
    Layers</i> shows how many nodes and edges each pair of layers shares (Jaccard index) as heatmaps, and an
    <i>UpSet plot</i> of the layers' node sets: one bar per combination, so a bar with one dot holds the nodes only
    that layer has and a bar with several dots the nodes exactly those layers share (the plot downloads as SVG).
  </p>

  <h3>Explore</h3>
  <p>
    <i>Expand Selection</i> adds the neighbours of the selected nodes, 1 or 2 hops away — <i>Within layers</i>
    follows intra-layer edges; <i>Across layers</i> also follows inter-layer edges and copies of the same node.
    <i>Shortest Path Between 2 Selected</i> selects the path between exactly two selected nodes (layer hops allowed
    across layers). The text box selects nodes whose description, annotations or URL contain the text.
  </p>

  <h3>Groups</h3>
  <p>
    <i>Group Stats</i> reports, per group and as NORMA does, the members, the layers they span, the edges inside
    the group (intra- and inter-layer), the density, the mean degree inside, the share of the network's edges and
    the members that belong to other groups too, in Data Tables → Group Statistics. Every table a button produces
    opens the Data Tables panel on its tab.
  </p>
  <p>
    The <i>Groups</i> card lists every annotation term — from attribute or group files, or an enrichment — or every
    cluster, as in NORMA: its colour (click the swatch to recolour the group, its pies and hulls), the number of
    members (hover for the count per layer), a <i>hull</i> switch that draws or hides that group's hull or fog cloud,
    and <i>select</i>. <i>Legend</i> shows the groups in the on-canvas legend; <i>Groups Table</i> and <i>Overlap
    Table</i> (the Jaccard overlap of every pair of groups, with an UpSet plot of the members the groups share)
    open in Data Tables; <i>Collapse into Super Nodes</i>
    turns every group into one node per layer, sized by its members and coloured like the group, with member edges
    summed into the edges between them — undo restores the network.
  </p>

  <h3>Annotations &amp; Enrichment</h3>
  <p>
    <i>Annotation set</i> keeps every set of annotations the network received — each attribute or group file, an
    enrichment, a cluster run — and switches between them (or to none); the newest set is the one shown.
  </p>
  <p>
    The annotation options (pie charts, annotation hulls and fog clouds, annotations as groups or colours) are
    disabled until the network carries annotations — from a node attributes or group file, a session, or
    <i>Annotate Nodes with Top 5 Terms</i> below; the card says so.
  </p>
  <p>
    <i>Show Annotations as Pie Charts</i> draws annotated nodes as pies with one slice per term. <i>Hulls Around</i>
    marks every cluster or annotation term on each layer, drawn as a translucent <i>Hull</i> or, as in NORMA, a soft
    <i>Fog cloud</i> that follows the group's members (also in 3D layouts and sphere layers). <i>Enrichment of Selected Nodes</i> sends the selected
    names to STRING's enrichment service (GO, KEGG, Reactome, WikiPathways) for the chosen organism; click a term to
    select its genes, or <i>Annotate Nodes with Top 5 Terms</i> to turn the results into pies and hulls.
  </p>

  <h3>Data Tables</h3>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/data.png" alt="The Data Tables panel" loading="lazy">
  <p class="last_p">
    Analyze → Data Tables holds every report as a tab — the network on loading, the selected edges, the clusters,
    every computed metric, layer similarity, network statistics, group statistics and overlap, the network comparison
    and the node values — each drawn as a table with a header that stays put while the rows scroll, numbers
    right-aligned, the row count and a CSV download. Click a column title to sort the report by it (numbers largest
    first, text A→Z) and click again to turn the order round; the order is kept while the report refreshes and the
    CSV follows it. The comparison tabs add an UpSet plot of the sets they compare.
  </p>
</div>

<div id="Export_tab" class="tabcontent">
  <h2>Export</h2>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/export.png" alt="The Export panel" loading="lazy">
  <p>
    The Export panel (top menu) writes the current view and the network in the formats other tools read. It is
    five cards — <i>Image &amp; 3D</i>, <i>Cytoscape</i>, <i>Other tools</i>, <i>Visualizations</i>,
    <i>Session</i> — click a title to open or fold one.
  </p>
  <h3>Image &amp; 3D</h3>
  <p>
    <i>PNG (current view)</i> saves what you see. <i>PNG</i> with a size renders the view at 2048–8192 px for
    print; <i>SVG</i> is a vector drawing of the view for Illustrator or Inkscape; <i>3D model (GLB)</i> is the
    scene for Blender, PowerPoint and journal 3D viewers; <i>Rotation Video</i> records one full turn as WebM for
    a talk.
  </p>
  <h3>Cytoscape</h3>
  <p>
    <i>Send to Cytoscape</i> opens the network in a running Cytoscape desktop (3.x) through its cyREST service
    (port 1234 unless Cytoscape was told otherwise — change the address if so): the layers are placed side by
    side with each layer's own node positions, and node colour, size, shape and layer and edge channel and weight
    arrive as table columns for Cytoscape's style mappings. Without a running Cytoscape, save a <b>CX2</b> file
    (Cytoscape 3.9+ and NDEx), a <b>Cytoscape.js JSON</b> (.cyjs) file or <b>SIF + tables</b> (a zip with the
    classic SIF network and node and edge attribute CSVs) and use File → Import → Network from File. The
    Arena3D Cytoscape app (Cytoscape App page) goes the other way.
  </p>
  <h3>Visualizations</h3>
  <p>
    Other views of the same network. <i>Chord diagram</i> (SVG): the layers as arcs sized by their node counts,
    the nodes as ticks along them (with names up to 90 nodes) and the edges as chords — within a layer hugging its
    arc, between layers crossing the circle. <i>Heatmap</i> (SVG): the adjacency matrix with the nodes grouped by
    layer, up to 400 nodes; <i>Matrix</i> (CSV) is the same matrix for R, Python or Morpheus, up to 2,000 nodes.
    <i>Circos files</i> (zip): a karyotype with one chromosome per layer and a band per node, the edges as links
    and a <i>circos.conf</i> that draws them with the Circos software (<code>circos -conf circos.conf</code>).
    <i>Sankey</i> (SVG): the layers as columns in the order of the stack and the inter-layer edges as flows, their
    widths the summed weights, read from the earlier column to the later one — <i>per node</i>, <i>per group</i>
    (annotation term or cluster) or <i>per layer</i>; a level with more than 200 bands falls back to the next
    coarser one, and edges within a layer stay out. The same flows download as <i>SankeyMATIC</i> text
    (<code>Source [amount] Target</code> lines for <a href="https://sankeymatic.com/build/" target="_blank">sankeymatic.com</a>)
    and as a <i>Plotly</i> figure (JSON for plotly.js, Python or Chart Studio).
  </p>
  <p>
    Hand-offs to web tools, like the one to NORMA: <i>Heatmap in Vega Editor</i> opens an interactive heatmap in the
    <a href="https://vega.github.io/editor/" target="_blank">Vega editor</a> — the chart specification travels in the
    link itself (up to 2,000 edges), nothing is uploaded; <i>Open in Gephi Lite</i> hosts the GraphML on this server
    for one hour (<i>POST /api/share</i>) and opens it in
    <a href="https://gephi.org/gephi-lite/" target="_blank">Gephi Lite</a>; <i>Open in STRING</i> shows the selected
    proteins (or all, up to 150) on the <a href="https://string-db.org" target="_blank">STRING</a> website for the
    chosen organism.
  </p>
  <h3>Other tools</h3>
  <p>
    <b>GraphML</b> (Gephi, igraph, NetworkX, yEd) carries names, layers and the 3D coordinates; <b>MuxViz</b> is a
    zip with the edges, layers and layout files MuxViz asks for.
  </p>
  <p>
    <b>Send to NORMA</b> passes the network to <a href="https://normaviz.org" target="_blank">NORMA</a> (or any NORMA
    server you enter) through its API: each layer becomes a NORMA annotation group, copies of a node become one node in
    several groups (shown as pies), and edges keep their channel (or layer) as the edge type. <i>Open in NORMA</i>
    stores it on the server for 24 hours and opens it; <i>Copy NORMA Link</i> makes a link that carries the network
    itself (no server storage, best for small networks); <i>NORMA JSON</i> saves the payload.
  </p>
  <p>
    <b>Send to Flame</b> takes the node names as gene symbols or identifiers to
    <a href="https://flame.pavlopouloslab.info" target="_blank">Flame</a> (Koutrouli <i>et al.</i>, 2023) for
    functional and literature enrichment, through its <code>url_genes</code> link API: <i>one gene list per
    layer</i> (the layers ticked in Layer selection, or all; Flame keeps up to ten lists) or <i>the selected layers
    as one list</i>, without duplicate names. <i>Open in Flame</i> opens the tool with the lists in the link (the
    organism and the enrichment tools are chosen there); lists too long for a link, or any list, can be taken over
    with <i>Copy Gene Lists</i> and pasted into Flame. The server address can be changed for a local Flame.
  </p>

  <h3>Session</h3>
  <p class="last_p">
    <i>Save Session</i> (also File → Save Session) writes the complete scene as JSON — layers, nodes with
    positions, colours and shapes, edges, bundling, containers — to load again with File → Load Session or to hand
    off through the API.
  </p>
</div>

<div id="API_tab" class="tabcontent">
  <h2>API</h2>
  <p>
    Arena3D's server is a plain HTTPS/JSON API, open to any application: no key, and cross-origin requests are
    allowed. Interactive documentation of every endpoint — schemas, examples and a "Try it out" button — is served at
    <i>/api/docs</i> on every Arena3D server (<a href="https://arena3d.org/api/docs" target="_blank">arena3d.org/api/docs</a>);
    the OpenAPI description is at <i>/api/openapi.json</i>.
  </p>

  <h3>Open a network from your application</h3>
  <p>
    <b>POST /api/open</b> takes a list of edges (or the text of an Arena3D TSV file), lays the network out on the
    server, stores it for one hour and returns a link that opens it:
  </p>
  ${fields([
    [
      'edges[]',
      'list',
      'The network, one object per edge (or <code>tsv</code> below instead).',
    ],
    ['edges[].source, target', 'string', 'Node names.'],
    [
      'edges[].source_layer',
      'string',
      'Layer of the source node; default <i>Layer1</i>.',
    ],
    [
      'edges[].target_layer',
      'string',
      'Layer of the target node; the source layer when omitted. An edge between the copies of a node in two layers links the layers.',
    ],
    [
      'edges[].weight',
      'number',
      'Optional; missing = 1. Scaled to 0.1–1 like an upload.',
    ],
    [
      'edges[].channel',
      'string',
      'Optional evidence channel; all edges or none.',
    ],
    [
      'tsv',
      'string',
      'Instead of <code>edges</code>: the text of an Arena3D TSV file.',
    ],
    [
      'nodes[]',
      'list',
      'Optional node attributes, by name — in one <code>layer</code>, or in every copy when <code>layer</code> is left out.',
    ],
    ['nodes[].color, size', 'hex, 0.2–5', 'Colour and size of the node.'],
    [
      'nodes[].url, description',
      'string',
      'Link and description (right-click menu).',
    ],
    [
      'nodes[].annotations',
      'list ≤ 12',
      'Annotation terms (pies, hulls, groups).',
    ],
    [
      'layout',
      'string | null',
      'A Layout-panel algorithm, run per layer (default <i>Fruchterman-Reingold</i>); <code>null</code> scatters the nodes.',
    ],
    ['directed', 'boolean', 'Draw arrows.'],
  ])}
  <p>An example request and its answer:</p>
  <pre class="help-code">curl -X POST https://arena3d.org/api/open -H "Content-Type: application/json" -d @network.json</pre>
  ${json({
    edges: [
      { source: 'TP53', target: 'MDM2', source_layer: 'PPI' },
      { source: 'TP53', target: 'CDKN1A', source_layer: 'PPI', weight: 0.9 },
      {
        source: 'TP53',
        target: 'TP53',
        source_layer: 'PPI',
        target_layer: 'Regulation',
      },
      { source: 'TP53', target: 'BAX', source_layer: 'Regulation' },
    ],
    nodes: [
      {
        name: 'TP53',
        color: '#ff3333',
        size: 2,
        url: 'https://www.uniprot.org/uniprotkb/P04637',
      },
    ],
    layout: 'Fruchterman-Reingold',
    directed: false,
  })}
  ${json({ token: '…', url: 'https://arena3d.org/?session=…', layers: 2, nodes: 5, edges: 4, channels: [], warnings: [] })}
  ${fields([
    ['token', 'string', 'The stored network; valid for one hour.'],
    [
      'url',
      'string',
      'Opens it in Arena3D — in a browser, a link or an iframe.',
    ],
    ['layers, nodes, edges', 'number', 'What was parsed.'],
    ['channels', 'list', 'Channel names found.'],
    [
      'warnings',
      'list',
      'Anything that was adjusted (clamped weights, dropped duplicates).',
    ],
  ])}
  <p>
    A node that appears in two layers is the same node in both. The limits are those of uploads (10,000 edges, 18
    layers, 9 channels). From Python:
  </p>
  <pre class="help-code">import requests, webbrowser

edges = [{"source": s, "target": t, "source_layer": layer} for s, t, layer in my_edges]
r = requests.post("https://arena3d.org/api/open", json={"edges": edges, "directed": True})
r.raise_for_status()
webbrowser.open(r.json()["url"])</pre>

  <h3>Hand off a complete session</h3>
  <p>
    <b>POST /api/external</b> stores a full Arena3D session — what <i>File → Save Session</i> writes: scene, layers,
    nodes with positions, colours and shapes, edges — and returns the same <i>{token, url}</i>. Use it when your
    application controls every position and colour (the Cytoscape app does). <b>GET /api/external/{token}</b>
    returns the normalised session behind a link. Links expire after one hour.
  </p>
  <p>The session object, part by part (every field is optional: what is missing gets a default):</p>
  ${fields([
    [
      'scene',
      'object',
      '<code>position_x</code>, <code>position_y</code>, <code>scale</code>, <code>rotation_x/y/z</code> and the background <code>color</code>.',
    ],
    ['layers[]', 'list', 'One object per layer.'],
    ['layers[].name', 'string', 'The layer name (unique).'],
    [
      'layers[].position_x/y/z, rotation_x/y/z, last_layer_scale',
      'number',
      'Where the floor is and how it is turned and scaled; missing positions spread the layers out.',
    ],
    [
      'layers[].floor_current_color, geometry_parameters_width',
      'hex, number',
      'Floor colour and width.',
    ],
    [
      'layers[].floor_shape, floor_style',
      'square | disk; solid | wireframe | grid | dots | outline',
      'How the floor is drawn.',
    ],
    [
      'layers[].container, container_color, container_opacity, floor_visible',
      'floor | none | cube | sphere | cloud; hex | null; 0–1; boolean',
      'The 3D container (a <code>null</code> colour follows the theme) and whether the floor shows.',
    ],
    ['nodes[]', 'list', 'One object per node copy.'],
    [
      'nodes[].name, layer',
      'string',
      'The node and its layer; the id in edges is <code>name_layer</code>.',
    ],
    [
      'nodes[].position_x/y/z',
      'number',
      'Position on the floor (x is the height above it); missing = scattered.',
    ],
    [
      'nodes[].scale, color, shape',
      'number, hex, string',
      'Size, colour and geometry (sphere, box, diamond, …).',
    ],
    [
      'nodes[].url, descr, annotations',
      'string, string, list',
      'Link, description and annotation terms.',
    ],
    ['edges[]', 'list', 'One object per edge (per channel).'],
    ['edges[].src, trg', 'string', 'Node ids, <code>name_layer</code>.'],
    [
      'edges[].opacity, color, channel, width_factor',
      'number, hex, string, number',
      'Opacity (weight), colour, channel name and a width multiplier.',
    ],
    ['universalLabelColor, direction', 'hex, boolean', 'Label colour; arrows.'],
    ['edgeOpacityByWeight, edgeWidthByWeight', 'boolean', 'Weight encodings.'],
    ['intraEdgeBundling, interEdgeBundling', '0–1', 'Edge bundling strengths.'],
  ])}
  ${json({
    scene: {
      position_x: 0,
      position_y: 0,
      scale: 0.65,
      color: '#000000',
      rotation_x: 0.26,
      rotation_y: 0.26,
      rotation_z: 0.09,
    },
    layers: [
      {
        name: 'PPI',
        position_x: -480,
        position_y: 0,
        position_z: 0,
        last_layer_scale: 1,
        rotation_x: 0,
        rotation_y: 0,
        rotation_z: 0,
        floor_current_color: '#777777',
        geometry_parameters_width: 947,
        floor_shape: 'square',
        floor_style: 'grid',
      },
      {
        name: 'Regulation',
        position_x: 480,
        position_y: 0,
        position_z: 0,
        floor_current_color: '#777777',
        geometry_parameters_width: 947,
        container: 'cube',
        container_color: null,
        container_opacity: 0.3,
      },
    ],
    nodes: [
      {
        name: 'TP53',
        layer: 'PPI',
        position_x: 0,
        position_y: -410,
        position_z: 87,
        scale: 1,
        color: '#e41a1c',
        shape: 'sphere',
        url: '',
        descr: '',
      },
      {
        name: 'MDM2',
        layer: 'PPI',
        position_x: 0,
        position_y: 245,
        position_z: -204,
        scale: 1,
        color: '#e41a1c',
      },
      {
        name: 'TP53',
        layer: 'Regulation',
        position_x: 0,
        position_y: -10,
        position_z: 361,
        scale: 1.4,
        color: '#377eb8',
      },
    ],
    edges: [
      {
        src: 'TP53_PPI',
        trg: 'MDM2_PPI',
        opacity: 1,
        color: '#CFCFCF',
        channel: '',
      },
      {
        src: 'TP53_PPI',
        trg: 'TP53_Regulation',
        opacity: 1,
        color: '#CFCFCF',
        channel: '',
      },
    ],
    universalLabelColor: '#FFFFFF',
    direction: false,
    edgeOpacityByWeight: true,
    edgeWidthByWeight: false,
    intraEdgeBundling: 0,
    interEdgeBundling: 0,
  })}

  <h3>Analysis without the browser</h3>
  <p>
    The endpoints the panels use take JSON and return JSON, so a script can run them on its own data: <b>POST
    /api/network</b> parses an uploaded file (TSV, GraphML, GML, SIF, CX2) into nodes, edges and layers;
    <b>/api/layout</b> computes layouts, clustering, cross-layer alignment and group layouts; <b>/api/topology</b>
    node metrics; <b>/api/network-stats</b> and <b>/api/layer-similarity</b> statistics; <b>/api/enrichment</b>
    STRING enrichment; <b>/api/import/string</b>, <b>/api/import/databases</b> and <b>/api/import/ndex</b> fetch a
    network ready for <i>/api/layout</i>; <b>GET /api/config</b> reports the server's limits. Errors are JSON with a
    <i>detail</i> message: 400 for bad input, 413 for an oversized body, 422 for a body that does not match the
    schema. The exact request and response schemas are in <i>/api/docs</i>.
  </p>
  <p class="last_p">
    Example — an aligned layout of two layers from a parsed network: <i>POST /api/layout</i> with
    <i>{"nodes": …, "edges": …, "algorithm": "Fruchterman-Reingold", "scope": "coupled", "selected_layers":
    ["PPI", "Regulation"]}</i> returns <i>positions</i> (node id → [y, z]) and the <i>misalignment</i> score.
  </p>
</div>

<div id="Cytoscape_tab" class="tabcontent">
  <h2>Cytoscape App</h2>
  <p>
    <a href="https://apps.cytoscape.org/apps/arena3DApp" target="_blank">Arena3DApp</a> in the
    <a href="https://apps.cytoscape.org/" target="_blank">Cytoscape App Store</a> sends a 2D
    <a href="https://cytoscape.org/download.html" target="_blank">Cytoscape</a> network straight to Arena3D. Take this
    aspirin network, built in Cytoscape with the StringApp:
  </p>
  <img src="${import.meta.env.BASE_URL}images/help/cytoscape_aspirin.png" alt="Cytoscape example" style="max-width:100%;" loading="lazy">
  <img src="${import.meta.env.BASE_URL}images/help/arena3dapp.png" alt="Arena3DApp prompt window" style="width:500px;max-width:100%;" loading="lazy">
  <p>
    The app asks which node attribute holds the layers (any numeric or text value defining up to 18 non-overlapping
    groups) and which columns hold the node description and URL. It carries over node colours, sizes and
    coordinates, edge direction, colour, thickness and transparency, the label font and the background. Nodes in no
    layer go to an "unassigned" layer, or can be left out. The app sends the JSON to Arena3D and opens it in your
    browser; you can also save the JSON from Cytoscape and load it as a session. The result looks like this:
  </p>
  <img src="${import.meta.env.BASE_URL}images/help/arena_cytoscape_aspirin.png" alt="The aspirin network in Arena3D" style="max-width:100%;" loading="lazy">
  <p class="last_p">
    The Export panel takes networks back to Cytoscape and NDEx: <i>Send to Cytoscape</i> (cyREST), CX2, Cytoscape.js JSON or SIF files.
  </p>
</div>

<div id="About_tab" class="tabcontent">
  <h2>Developers</h2>
  <p>
    &#8226; Evangelos Karatzas, email: karatzas@fleming.gr<br />
    &#8226; Maria Kokoli, email: mariakokoli94@gmail.com <br />
    &#8226; Fotis Baltoumas, email: baltoumas@fleming.gr <br />
    &#8226; Georgios A. Pavlopoulos, email: pavlopoulos@fleming.gr <br />
  </p>

  <h2>Install Arena3D</h2>
  <p>
    Arena3D is open source (GNU AGPL v3). Run it locally with Docker or from source — see the README on
    <a href="https://github.com/pavlopoulos-lab/arena3d" target="_blank">GitHub</a>, or pull the image from
    <a href="https://hub.docker.com/r/pavlopouloslab/arena3dweb" target="_blank">DockerHub</a>.
  </p>

  <h2>Related Software</h2>
  <p>
    &#8226; <a href="https://normaviz.org" target="_blank">NORMA: The NetwORk Makeup Artist</a><br />
  </p>

  <h2>Related Literature</h2>
  <p>
    &#8226; <a href="https://www.frontiersin.org/articles/10.3389/fbioe.2020.00034/full" target="_blank">A Guide to
    Conquer the Biological Network Era Using Graph Theory</a><br />
  </p>

  <h2>Cite Arena3D</h2>
  <p class="last_p">
   - Kokoli, M., Karatzas, E., Baltoumas, F.A., Schneider, R., Pafilis, E., Paragkamian, S., Doncheva, N.T., Jensen, L.J.
    and Pavlopoulos, G.A., 2023. <br />
      Arena3D<sup>web</sup>: interactive 3D visualization of multilayered networks
      supporting multiple directional information channels, clustering analysis and application integration,<br>
    NAR Genomics and Bioinformatics, 5(2), p.lqad053. <br />
   <b>doi:</b> <a href="https://doi.org/10.1093/nargab/lqad053" target="_blank">10.1093/nargab/lqad053</a>; <b>PubMed:</b> <a href="https://pubmed.ncbi.nlm.nih.gov/37260509/" target="_blank">37260509</a>
   <br><br>
   - Karatzas, E., Baltoumas, F.A., Panayiotou, N.A., Schneider, R. and Pavlopoulos, G.A., 2021. <br />
   Arena3D<sup>web</sup>: interactive 3D visualization of multilayered networks,<br>
   Nucleic Acids Research, 49(W1), pp.W36-W45. <br />
    <b>doi:</b> <a href="https://doi.org/10.1093/nar/gkab278" target="_blank">10.1093/nar/gkab278</a>; <b>PubMed:</b> <a href="https://pubmed.ncbi.nlm.nih.gov/33885790/" target="_blank">33885790</a>
  </p>
</div>
</div>
`

function openHelpTab(
  pane: HTMLElement,
  tabName: string,
  btn: HTMLElement
): void {
  pane
    .querySelectorAll<HTMLElement>('.tabcontent')
    .forEach((el) => (el.style.display = 'none'))
  pane
    .querySelectorAll('.tablinks')
    .forEach((el) => el.classList.remove('active'))
  const target = pane.querySelector<HTMLElement>(`#${tabName}`)
  if (target) target.style.display = 'inline-block'
  btn.classList.add('active')
}

export function initHelpPanel(): void {
  const pane = document.getElementById('panel-help')
  if (!pane) return
  pane.innerHTML = HELP_HTML
  const buttons = pane.querySelectorAll<HTMLElement>('.tablinks')
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.helpTab
      if (tabName) openHelpTab(pane, tabName, btn)
    })
  })
  // open Getting Started
  const first = buttons[0]
  if (first?.dataset.helpTab) openHelpTab(pane, first.dataset.helpTab, first)
}
