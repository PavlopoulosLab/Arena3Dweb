// Help panel: one page per menu panel. Static HTML fragment + inner tab switching.

import { ABOUT_HTML, initAbout } from './about'
import { decorateHelp } from './help_layout'
import { showTab } from './tabs'
import { tourChapters, tourPlayer, wireTour } from './video'

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

// the files of a neural network example (scripts/neural_network_examples.py)
function nnFiles(what: string, stem: string): string {
  const link = (file: string, text: string) =>
    `<a href="${import.meta.env.BASE_URL}data/${file}" download>${text}</a>`
  return `${what}: ${link(`${stem}.tsv`, 'network file')}, ${link(`${stem}_node_attributes.tsv`, 'node attributes file')} and ${link(`${stem}.json`, 'session')}. <br />`
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
  <button class="tablinks" data-help-tab="Clustering_tab">Clustering</button>
  <button class="tablinks" data-help-tab="Scene_tab">Scene &amp; Camera</button>
  <button class="tablinks" data-help-tab="Annotations_tab">Annotations</button>
  <button class="tablinks" data-help-tab="Style_tab">Edit → Style</button>
  <button class="tablinks" data-help-tab="Attributes_tab">Edit → Attributes</button>
  <button class="tablinks" data-help-tab="Node_tab">Edit → Nodes</button>
  <button class="tablinks" data-help-tab="Edge_tab">Edit → Edges</button>
  <button class="tablinks" data-help-tab="Layer_tab">Edit → Layers</button>
  <button class="tablinks" data-help-tab="Analyze_tab">Analyze</button>
  <button class="tablinks" data-help-tab="Export_tab">Export</button>
  <button class="tablinks" data-help-tab="API_tab">API</button>
  <button class="tablinks" data-help-tab="Cytoscape_tab">Cytoscape App</button>
  <button class="tablinks" data-help-tab="Privacy_tab">Privacy &amp; Data</button>
  <button class="tablinks" data-help-tab="About_tab">About</button>
</div>

<div id="Start_tab" class="tabcontent">
  <h2>Getting Started</h2>
  <p class="help-lead">A four-minute video tour, Arena3D in five steps, then the menus, the Networks menu, undo, network mode and touch screens.</p>
  <div class="help-tour">
    ${tourPlayer('helpTour')}
    <p class="help-tour__intro">
      <b>Video tour</b>: loading and importing networks, layouts and layer arrangements, 3D containers, edge bundling,
      communities and groups, analysis, search, themes, alternative views and the REST API, with captions. Pick a
      chapter to start there.
    </p>
    ${tourChapters('helpTour')}
  </div>
  <img class="help-shot" src="${import.meta.env.BASE_URL}images/help/ui/topbar.png" alt="The top bar: Home, File, Database Importers, Networks, View, Find, Layer selection, Layout, Clustering, Edit, Analyze, Export and Help menus, the Multilayered / Single network switch, the theme picker and Undo / Redo" loading="lazy">
  <p>
    Arena3D shows a multilayered network in 3D: every layer is a floor (or a disk, cube, sphere or cloud), a node
    may appear in several layers, and edges run within layers (intra-layer) or between them (inter-layer). Edges can
    carry weights, directions and several information channels.
  </p>
  <ol>
    <li><b>Load a network</b> — File → upload a file or load a saved session; Database Importers → import from STRING, IntAct,
      OmniPath or NDEx; or pick an example on the Home page.</li>
    <li><b>Lay it out</b> — Layer selection → tick the layers to work on; Layout → an algorithm; optionally align
      layers or run a group layout, with communities from the Clustering panel.</li>
    <li><b>Explore</b> — search nodes, expand neighbourhoods, follow paths, hide weak edges.</li>
    <li><b>Analyse</b> — Analyze → metrics, statistics, plots, knockouts and robustness, enrichment.</li>
    <li><b>Style and export</b> — Edit → Style for colours, sizes, shapes, borders, labels, line types and colour-blind tools;
      Edit → Attributes to set them node by node and edge by edge (or for a selection) in a table; File for images,
      3D models, video, other formats or NORMA.</li>
  </ol>
  <p class="help-tip">Step-by-step recipes for the usual tasks are on the <i>How to…</i> page.</p>
  <h3>Menus</h3>
  <p>
    The menu bar is grouped by task, and every menu has its own colour (the open or active menu is tinted with
    it). <b>File</b>: load networks, attributes and sessions. <b>Database Importers</b>: fetch from STRING, Reactome,
    OmniPath, NDEx, IntAct and Gene Ontology. <b>Networks</b>: which network and annotation are on screen, and
    every loaded network with its annotation sets, to switch between them. <b>View</b>: Scene &amp; Camera (background, axes,
    arrangements, rotation, legend), Annotations (a hull, cloud or 3D container around every annotation
    group or cluster, pies, and the group list) and Performance (frame rate, resolution, detail). <b>Find</b>: search nodes
    and edges. <b>Layer selection</b>: the layers the layouts, analyses and exports work on, with a Hide and a
    Labels switch per layer (Multilayered mode). <b>Layout</b>: algorithms, alignment and group
    layouts. <b>Clustering</b>: communities, a summary of them, and saving them as an annotation set. <b>Edit</b>, in two groups:
    <i>Appearance</i> — Style (colours, sizes, borders, labels, line types, palettes, colour vision) and Attributes (a table of
    every node and edge, edited one at a time or many at once, and an inspector) — and <i>Network parts</i> — Nodes (labels,
    shapes), Edges and Layers (floors, shapes, containers, split/merge); each item has a one-line hint under its name. <b>Analyze</b>: Metrics, Statistics (with layer
    and network comparison), Plots, Perturbation, Explore, Annotations &amp; Groups (enrichment) and Data Tables. <b>Export</b>: images, 3D, video, Cytoscape, visualizations, other tools and the
    session. On phones and narrow windows the menus fold into a drawer.
  </p>
  <p>
    The panels are made of cards: the first card of every panel starts open and the others folded (and inside a
    card, its first sub-section starts open); a folded card's title, and the short hint after the title of a
    sub-section, says what is inside. Click a title to open or fold it. In the long panels (File,
    Edit → Nodes, Edges and Layers, Layout, Clustering, Analyze → Perturbation and Export), <i>Expand all</i> and <i>Collapse all</i>
    at the top open or fold every card at once. Arena3D remembers in this browser which cards you open or fold.
  </p>
  <h3>Networks menu</h3>
  <p>
    The <b>Networks</b> button always says what is on screen: under its name, the network shown and its annotation
    set (or <i>no annotation</i>); the browser tab's title names the network too. The menu starts with the same, in
    full, then lists every loaded network: its name (with <i>+ name</i> for each network added to it as layers or
    into the graph), where it came from (file, example, session file, database or shared link), its layers, nodes
    and edges, and <i>on screen</i> for the one shown. Under each network are its annotation sets — every
    attribute or group file, enrichment, cluster run or STRING grouping it received, and the annotations a saved
    session brought (<i>Saved with the session</i>) — with the one it shows ticked, and <i>No annotation</i>.
    Click a network to switch to it, or a set to show it; a set of another network switches to that network with
    that set in one click. <i>Load another network…</i> opens File and <i>Annotation options…</i> opens
    View → Annotations (pies, hulls, clouds, 3D containers). The menu, File → Loaded networks and View → Annotations
    always agree.
  </p>
  <p>
    <b>Rename and delete.</b> ✎ beside a network or an annotation set renames it in place: type the new name and
    press <kbd>Enter</kbd> (or click elsewhere); <kbd>Esc</kbd> keeps the old one. Annotation sets of one network
    need different names, and a name already taken is refused with a note. The network's list entry keeps where it
    came from, e.g. <i>File (figure2A_data.tsv)</i>. × deletes for good, after asking: an annotation set (the
    network then shows no annotation, if it was the one shown), or a whole network with all its annotation sets.
    Deleting the network on screen shows the loaded network before it instead, or the empty start and the Home page
    if it was the last one. Deleting a network also clears the undo history, so no Undo can bring it back, and frees
    the memory its scenes used. A saved session keeps the network's name and the name of the annotation set shown.
  </p>
  <h3>Undo and redo</h3>
  <p>
    Every change to the scene — loading, layouts, moves, styling, camera focus — can be undone and redone with the
    Undo / Redo buttons at the top right (on narrower windows only their arrows show) or <kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>.
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
  <p>
    On a touch screen, drag with one finger to orbit the scene, pinch with two fingers to zoom (around your fingers)
    and move them together to pan, double-tap a node or a layer to select it, and long-press a node for its menu (a
    tap elsewhere closes it). Panels open as a sheet over the lower part of the screen, so the network stays visible
    above; the navigation table starts closed and the 2D navigator is hidden to leave room for the scene.
  </p>
  <h3>Browsers</h3>
  <p class="last_p">
    Arena3D runs in current versions of Chrome, Edge, Firefox and Safari, on Windows, macOS and Linux and on phones
    and tablets, with nothing to install. The 3D view needs WebGL 2, which these browsers have on by default: if the
    scene stays empty, turn on hardware acceleration in the browser's settings. Large networks are smoothest on a
    computer with a graphics card; View → Performance trades detail for speed.
  </p>
</div>

<div id="Howto_tab" class="tabcontent">
  <h2>How to…</h2>
  <p class="help-lead">
    Short recipes for common tasks. Panel names are those of the menu bar (View, File, Database Importers, Layout, Clustering, Edit,
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

  <h3>…find communities and lay them out</h3>
  <ol>
    <li><i>Clustering</i> (top bar, next to Layout): pick an algorithm (Louvain, Walktrap, Fast Greedy, Label Propagation or Leiden)
      and, in Multilayered mode, whether communities are found within each layer, over the selected layers as one
      graph, or shared across layers by node name; <i>Find Communities</i>. The nodes take their community's colour
      and the panel lists the communities by size.</li>
    <li>Optionally <i>Save as Annotation Set</i>, so pies, hulls, fog clouds and the Networks menu treat the
      communities like an annotation file.</li>
    <li><i>Lay Out by Cluster…</i> opens Layout → <i>Group Layout (NORMA-2.0)</i> with the clusters as groups: pick a
      strategy and <i>Run Group Layout</i>.</li>
  </ol>

  <h3>…show pathways, GO terms or clusters as groups</h3>
  <ol>
    <li>Give nodes groups: a node attribute file with an <i>Annotation</i> column, a NORMA-format group file
      (File → <i>Upload GROUP file</i>), or Analyze → <i>Enrichment of Selected Nodes</i> → <i>Annotate Nodes with
      Top 5 Terms</i>. Clusters come from the <i>Clustering</i> panel.</li>
    <li>View → Annotations → <i>Show on the network</i>: the annotation set; <i>Draw around</i> clusters or
      annotations; <i>Draw as</i> a hull or outline on the floor, a fog cloud or cloud, or a sphere, ellipsoid or box,
      with its <i>Opacity</i> and <i>Padding</i>; pies on the nodes.</li>
    <li>View → Annotations → Groups: recolour, hide a group's shape, select its members, show them in the legend, open
      the Groups and Overlap tables, or <i>Collapse into Super Nodes</i>.</li>
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
      the two copies you mean), or switch on <i>Highlight paths between selected nodes</i> to see the paths joining
      every selected node as the selection changes.</li>
    <li>Right-click a node for its neighbours, a multilayer path or its link and description; with nodes selected,
      right-click also offers actions on the whole selection.</li>
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
  <p class="help-lead">Ready-made networks to open with one click, and every file behind them to download.</p>
  <img class="help-shot" src="${import.meta.env.BASE_URL}images/help/ui/home.jpg" alt="The Home page: six featured examples that open with one click, and the All examples picker" loading="lazy">
  <p>
    Click a card under <i>Start from an example</i> on the Home page to open it at once, or pick any example from
    <i>All examples</i> there (or in File → <i>Example</i>) and press <i>Load Example</i>. Both pickers list the
    examples by category, in the order of the sections below; each opens as its saved session where there is one, and
    every file can be downloaded here.
  </p>
  <h3>Biological networks</h3>
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
  <h3>Layer geometry and 3D</h3>
  <p>
    <b>Four layers forming a cube (session): </b> <br />
    An <a href="${import.meta.env.BASE_URL}data/figure2A_export.json" download>exported session</a> of the weighted
    four-layer network (under <i>Small examples and file formats</i>) with its layers turned to form a cube in 3D
    space. <br />
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
    <b>Layers in glowing spheres: </b> <br />
    A <a href="${import.meta.env.BASE_URL}data/figure2A_spheres.json" download>session</a> of the four weighted layers,
    each in a glowing sphere (Edit → Layers → <i>Layer Shape</i> → <i>Bubble</i>) with its nodes laid out in 3D inside,
    the spheres in a row (Layout → Layer Arrangement → <i>Parallel Coordinates</i>) and the links between them bundled
    (Edit → Edges → <i>Inter-Layer Edge Bundling</i>). <br />
  </p>
  <h3>Hive plots</h3>
  <p>
    <b>Hive plots, layers as axes: </b> <br />
    Six examples open as hive plots (Layout → Layer Arrangement → <i>Hive plot</i>; Krzywinski et al., 2012): every
    layer becomes an axis and every node sits on its axis by degree. In a plane: PREGO (three axes, by rank, as most of
    its nodes have one or two links), GPCR signalling (four axes) and the SARS-CoV-2 host–virus network (five). With the
    axes spread in 3D, so that every two of them are neighbours: GPCR signalling as a tetrahedron, the SARS-CoV-2
    network with five axes on a sphere, and the six random layers along ±X, ±Y and ±Z. They use the network files of
    those examples, found in the other sections. <br />
  </p>
  <h3>Neural networks</h3>
  <p class="help-note">
    <b>Illustrative, not trained models.</b> Six neural networks drawn as multilayer networks: each network layer is an Arena3D layer, and the kind of each
    link is its channel. Filters and attention patterns are written by hand to show how these networks work, and
    the other weights are random, so none of them has learned anything.
  </p>
  <p>
    <b>Convolutional network (LeNet-like, 7 layers):</b> <br />
    A 10×10 drawing of the digit 7 goes through four 3×3 edge
    filters (Conv 1), 2×2 max-pooling, six 3×3 filters that each read two pooled maps (Conv 2, as in LeNet-5), a
    second pooling, a dense layer and ten output classes. Each unit links to its receptive field (channels
    <i>Convolution</i>, <i>Pooling</i>, <i>Dense</i>; the link weights are the filter weights, and the strongest link
    of a pooling window is the one that wins), and node sizes show how strongly each unit responds to the 7, up to
    Max-pool 2. <br />
    ${nnFiles('The convolutional network', 'cnn_lenet')}
  </p>
  <p>
    <b>Transformer (decoder-only, LLM-like, 10 layers):</b> <br />
    Nine tokens through two blocks of attention, MLP and
    Add &amp; Norm, then next-token predictions. In each attention layer, every one of four heads is a column of keys
    and a column of queries linked by attention weights; a token attends only to itself and earlier tokens (the causal
    mask). Block 1 has previous-token, attention-sink, local and broad heads. Block 2 has an induction head: the second
    "draws" looks at "networks", the token after the first "draws", so the output predicts "networks" next. The MLP
    acts on each token on its own, and the Add &amp; Norm layers carry the residual stream (channels
    <i>Projection</i>, <i>Residual</i>, <i>Feed-forward</i>, <i>Attention</i>). <br />
    ${nnFiles('The transformer', 'transformer_tiny')}
  </p>
  <p>
    <b>LSTM unrolled over time (6 layers):</b> <br />
    One layer per time step of the sentence "Arena draws networks in 3D
    space", each holding the input, the four gates of four memory cells, the cells and the hidden state. The gates are
    the channels (<i>Forget gate</i>, <i>Input gate</i>, <i>Candidate</i>, <i>Output gate</i>), with <i>Input</i>,
    <i>Recurrent</i> (the previous hidden state into this step's gates) and <i>Cell state</i>, the line each memory
    cell runs along from step to step. A real forward pass with random weights gives the gate values: they are the
    weights of the gates' links and set the node sizes. <br />
    ${nnFiles('The LSTM', 'lstm_unrolled')}
  </p>
  <p>
    <b>U-Net encoder–decoder (7 layers):</b> <br />
    A noisy 8×8 image of a blob goes down through two stride-2 convolutions
    to a 2×2 bottleneck and back up through two up-sampling steps to a segmentation mask; the layers are placed as a
    U, and the <i>Skip connection</i> channel copies each encoder map across to the decoder of the same size. The
    output mask is drawn as a trained U-Net should return it, not computed. <br />
    ${nnFiles('The U-Net', 'unet')}
  </p>
  <p>
    <b>Graph neural network on the karate club (5 layers):</b> <br />
    The same 34 members of Zachary's karate club (1977) in
    every layer — a multiplex, its floors stacked upwards, one per round of message passing. Two members start
    labelled, the instructor (Mr. Hi) and the administrator (the Officer); each round every member takes in its
    friends' values (<i>Message</i>) and its own (<i>Self</i>), as a graph convolution does (here without learned
    weights), and the colours show the two clubs spreading. The output splits the club as it really split, but for
    member 9. Annotation terms (View → Annotations) give each member's real club, the prediction and
    <i>misclassified</i>. <br />
    ${nnFiles('The graph neural network', 'gnn_karate')}
  </p>
  <p>
    <b>Variational autoencoder (8 layers):</b> <br />
    A 6×6 drawing of the digit 3 is squeezed through two encoder layers into
    the mean and log-variance of three latent dimensions, sampled as z = μ + σ·ε (with random noise ε, the
    reparameterisation trick) and decoded back to 6×6 — an hourglass with the bottleneck in the middle (channels
    <i>Encoder</i>, <i>Mean</i>, <i>Log-variance</i>, <i>Sampling</i>, <i>Noise</i>, <i>Decoder</i>). The
    reconstruction is drawn as a blurred copy of the input, not computed. <br />
    ${nnFiles('The variational autoencoder', 'vae')}
  </p>
  <p>
    A script in the <a href="https://github.com/Pavlopoulos-Lab/Arena3D" target="_blank" rel="noopener">source code</a>,
    <code>frontend/scripts/neural_network_examples.py</code>, writes these files. <br />
  </p>
  <h3>Small examples and file formats</h3>
  <p>
    <b>Weighted network with 4 layers (the Load Example network): </b> <br />
    The <a href="${import.meta.env.BASE_URL}data/figure2A_data.tsv" download>network file</a>. A session of it with the
    layers forming a cube is under <i>Layer geometry and 3D</i>. <br />
  </p>
  <hr>
  <p>
    <b>Random networks with different topologies mapped in 6 layers: </b> <br />
    The <a href="${import.meta.env.BASE_URL}data/figure1_data.tsv" download>network file</a>. <br />
    An <a href="${import.meta.env.BASE_URL}data/figure1_export.json" download>exported session</a> of this example. <br />
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
    <b>Network without layers (SARS-CoV-2 interactome): </b> <br />
    A <a href="${import.meta.env.BASE_URL}data/covid19_no_layers.tsv" download>2-column edgelist</a> of the SARS-CoV-2 network (under <i>Biological networks</i>): no
    layer columns, so all nodes share one layer and no floor is drawn. Try Layout → <i>3D Layout</i> to lift it into
    3D. <br />
  </p>
  <hr>
  <p>
    <b>Minimal 2-column edgelist (single default layer): </b> <br />
    A <a href="${import.meta.env.BASE_URL}data/edgelist_2columns.tsv" download>minimal edgelist</a> with only SourceNode and TargetNode columns. <br />
  </p>
  <h3>Scripts</h3>
  <p>
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
  <p class="help-lead">Load networks, sessions, attributes, groups and values, and the file formats Arena3D reads.</p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/file.png" alt="The File panel" loading="lazy">
  <p>
    The panel has five cards — <i>Network</i> (Upload Network, Load Session), <i>Node &amp; edge attributes</i>,
    <i>Groups &amp; values</i>, <i>Examples</i> and <i>Loaded networks</i> — all folded at first: click a title to
    open one, or use <i>Expand all</i> at the top. <i>Save Session</i> and <i>Load Example</i> sit below the cards.
  </p>

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
  <p class="help-note">
    The online version accepts up to 10,000 edges, 20 layers and 10 channels. Running Arena3D locally (see About),
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
    Nodes are matched by name in every layer, and the groups appear as pies and hulls and in View → Annotations.
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
    of every layer of both networks. ✎ renames a network; × deletes it with its annotation sets, after asking (the
    undo history is cleared). The <i>Networks</i> menu in the top bar lists the same networks, with their annotation
    sets, and says which is on screen.
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
    Edit → Attributes writes these columns too, and they are read back: <i>Shape</i> (sphere, box or Cube, diamond,
    cone, …), <i>Opacity</i> (0–1), <i>Label</i>, <i>LabelColor</i> and <i>LabelSize</i> (px).
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

  <p>
    Edge attributes — <i>Color</i> in hex; optional <i>Channel</i>, and the columns Edit → Attributes writes:
    <i>Width</i> (× the edge width), <i>Opacity</i> (× the edge opacity, 0–1), <i>LineType</i> (solid, dashed or
    dotted) and <i>ArrowColor</i>:
  </p>
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

  <p class="help-tip last_p">The session JSON format is described in the <i>API</i> tab.</p>
</div>

<div id="Databases_tab" class="tabcontent">
  <h2>Database Importers</h2>
  <p class="help-lead">Fetch networks from STRING, Reactome, OmniPath, NDEx, IntAct and Gene Ontology without leaving the app.</p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/databases.png" alt="The Database Importers panel: one card per source" loading="lazy">
  <p>
    The Database Importers panel (top menu) fetches networks straight from public resources. As in NORMA, every source is an
    expandable, colour-coded card with its own fields and Import button, and a <b>?</b> that opens this page; the
    first card (STRING) starts open and the others folded — click a card's title to open or fold it.
    Proteins, organism and score typed in one card are copied to the other cards that take them. Each card shows a
    progress bar under its button while it fetches, builds the scene and lays the network out. A query with
    something missing — no proteins, no pathways or GO terms picked, a search under two characters, no NDEx UUID —
    is not sent: the card says what to fill in under its button and outlines the empty field; a failed import is
    reported there too.
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
      hulls and the Groups card; switch between the sets in View → Annotations. <i>Enriched in the network</i>
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
  <p class="help-note">STRING asks callers to wait a second between requests and to identify themselves; both are respected.</p>
  <p class="last_p">
    Imports use the same size limits as uploaded files and can be undone. The API equivalents are
    <i>POST /api/import/string</i> (with <i>/api/import/string/groupings</i> for the groupings of a list of names), <i>/api/import/reactome</i>, <i>/api/import/go</i>, <i>/api/import/databases</i>
    (IntAct, OmniPath and the comparison) and <i>/api/import/ndex</i>; <i>GET /api/import/reactome/search</i> and
    <i>/api/import/go/search</i> find pathways and terms by name.
  </p>
</div>

<div id="Find_tab" class="tabcontent">
  <h2>Find</h2>
  <p class="help-lead">The Find panel (top menu) searches nodes and edges by name and selects what it finds.</p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/find.png" alt="The Find panel: node and edge search" loading="lazy">
  <h3>Nodes</h3>
  <p>
    Type one or more names (comma-separated) and press Enter. The mode decides how names match: <i>Exact</i>,
    <i>Contains</i>, <i>Starts with</i>, <i>Ends with</i> (suffix) or a <i>Regular expression</i> (for example
    <code>^MDM[24]$</code>); tick <i>Case-sensitive</i> if needed. Matches replace the selection and are listed under
    the box in a table of node and layer (the first 200); with <i>Focus camera</i> the view pans and zooms onto them.
    Click a row to focus on that node alone.
  </p>
  <h3>Edges</h3>
  <p class="last_p">
    Type node names (comma-separated) or a regular expression and choose what to match: <i>Either end</i>, the
    <i>Source</i> or the <i>Target</i> only, <i>Both ends</i> (each end must match) or the edge <i>Channel</i>; the
    modes are the same as for nodes. Matching edges are selected — Analyze → Data Tables → Selected Edges lists
    them with their layers, channels and weights — and listed under the box in a table of source, target,
    layer and channel; click a row to focus on its two nodes, or keep <i>Focus camera</i> ticked to fly to all of them.
  </p>
</div>

<div id="Navigation_tab" class="tabcontent">
  <h2>3D View &amp; Navigation</h2>
  <p class="help-lead">Zoom, pan, orbit and select with the mouse, the keyboard or touch, and move layers and nodes with the navigation table.</p>
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
      <b>Select an area</b>: hold <kbd>Shift</kbd> and drag — a rectangle, or a freehand <b>lasso</b> chosen under
      <i>Area Shape</i> in the Navigation Controls; <i>Area Mode</i> there makes the area replace the selection
      (<i>New</i>), add to it (<i>Add</i>, the default) or take its nodes out (<i>Remove</i>, or hold <kbd>Alt</kbd> /
      <kbd>Option</kbd> as you release). Both choices are remembered in the browser. <b>Unselect all</b> (and fit the
      view): double-click the background.</li>
    <li><b>Right-click a node</b> to select its neighbours (in every layer), a multilayer path starting from it, or a
      downstream path through the following layers, and to open its URL or description. With nodes selected, the
      menu (on a node or on the background) also has a <i>Selected nodes</i> group: expand the selection by one hop,
      select its connected component, the shortest path between two selected nodes, highlight the paths between
      them, focus the camera on them, copy their names, style them (Edit → Style), invert or clear the selection,
      or <i>Delete</i> them: after asking, the selected nodes and every edge touching them leave the network, the
      rest stays where it was, and one Undo brings them back (not offered with every node selected).
      With nothing selected, right-click the background to save the view as an image.</li>
  </ul>
  <h3>Navigation table</h3>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/navcontrols.png" alt="The navigation controls: shortcuts, scene, layer and node controls" loading="lazy">
  <p>
    <i>Navigation Controls</i> shows or hides the table. Its list of mouse and keyboard shortcuts (with <i>Area
    Shape</i> and <i>Area Mode</i>) is folded under <i>Mouse &amp; keyboard</i> at first: click it to open or fold the
    list, and the browser remembers. <i>Pause Inter-Layer Edges</i> hides inter-layer edges while
    you work on large networks. <i>Redraw</i> (&#8635;) puts the scene right if something gets stuck: it lets go of a
    drag, a held key or an area outline left half done (say, the mouse was released outside the window), hides a
    loading veil left up by a failed request, and redraws nodes, edges, bundles and labels at the window's size; the
    view, the selection and undo stay as they are. The coloured buttons act on the red (X), green (Y) and blue (Z) axes. Every button
    takes one step as soon as you press it; keep it pressed and it keeps going — rotating, moving or spreading —
    until you let go (or move off the button). Each press is one undo step.
  </p>
  <ul>
    <li><b>Scene</b>: rotate the whole network by the chosen angle (1°–15°); with <i>Enable Scene Auto Rotate</i>
      (Scene &amp; Camera) it keeps turning. <i>Recenter Network</i> fits the whole network back into the window
      (as does a double-click on the background).</li>
    <li><b>Single network mode</b> has no layers to drag or turn: the left button rotates the network, the middle
      button (or the arrow keys) pans it, and <kbd>Z</kbd>, <kbd>X</kbd> or <kbd>C</kbd> + drag turns it about one
      axis; the table lists the controls of the current mode. Under <i>Recenter Network</i>, <i>Spread</i>
      (0.25×–4×) gives the network more or less room: every node's distance from the centre scales, so the layout
      keeps its shape and the nodes their size while crowded nodes move apart (or a sprawling network gathers).
      Each drag is one undo step; the slider counts from the positions it started from, so after a layout, an
      undo or a drag it reads 1× again.</li>
    <li><b>Layers</b>: rotate and move the selected layers, scale them (0.2×–5×), and spread out or gather all
      layers along X.</li>
    <li><b>Nodes</b>: spread out or gather the selected nodes in their layers, move them, and scale them
      (0.2×–5×).</li>
  </ul>
  <p>
    The 2D navigator at the bottom right shows the whole network; click or drag in it to pan the 3D view (turn it off
    in Scene &amp; Camera). The theme picker in the top bar sets the scene's theme, one of 27 in three groups:
    <i>Dark</i> (Dark, Midnight, Blueprint, Solarized, Forest, High Contrast, and Universe, Marquee and Ripple after
    Cytoscape's styles), <i>Light</i> (Light, Gray, Paper, Pastel, and Cytoscape, Sample, Directed, Nested, Minimal and
    Solid after Cytoscape's) and <i>Colour-blind safe</i> (Okabe–Ito; Paul Tol's bright, muted and vibrant schemes;
    ColorBrewer Set2, Dark2 and Paired; viridis). The thin bar under the picker shows the theme's channel colours.
    Menus and panels keep their own colours, so they stay legible with every theme.
  </p>
  <p class="last_p">
    Every theme has a background, a floor, edge and label colour, a colour for each layer's nodes and one for each
    of ten channels, all chosen to stand out from the background and from one another. Pick a theme before loading
    and the next network takes its colours. With a network on screen, every switch asks first:
    <i>Keep the current colours</i> changes only the background, the labels and the 3D containers that follow the
    theme; <i>Apply the theme's colours</i> also recolours the nodes (by layer), the floors, every channel (a distinct
    colour each) and the edges, and colours set by hand per edge give way to them. The answer you gave last is
    offered first; <i>Cancel</i> keeps the theme on screen. One Undo takes a switch back, colours and all. A saved
    session keeps its theme and whether its colours were applied.
  </p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/theme_dialog.png" alt="Switching theme with a network on screen: keep the current colours, or apply the theme's colours to nodes, floors, channels and edges" loading="lazy">
</div>

<div id="Layouts_tab" class="tabcontent">
  <h2>Layout</h2>
  <p class="help-lead">Place the nodes on their layers: algorithms, scopes, UMAP, cross-layer alignment, 3D layouts, layer arrangements, hive plots and group layouts.</p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/layout.png" alt="The Layout panel" loading="lazy">

  <p>
    The panel follows the order of work: <b>1 · Layers</b> (how many layers are ticked in the <i>Layer selection</i>
    tab, with a button to it), <b>2 · Layout</b> (algorithm, what to apply it to and options), then <i>Run Layout</i> in the bar that stays at the bottom of the
    panel, with the result and the misalignment score next to it. Every section is a card, and every card starts
    folded, the <i>Run Layout</i> bar aside: click a title to open or fold it, or use <i>Expand all</i> /
    <i>Collapse all</i> at the top; the browser remembers what you open. Inside <i>2 · Layout</i>, under the
    algorithm and <i>Apply to</i>, <i>Weights &amp; 3D</i> (its title says what is on, such as <i>2D layout, no edge
    weights</i>) and <i>Selected nodes</i> (the layout inside them) fold too, as do the Group Layout card's
    <i>Force &amp; size</i> sliders; Layer Arrangement, Cross-Layer Alignment and Group Layout follow below. In <i>Single network</i> mode (top bar) the panel works the
    NORMA way: the layer section, the scope and the alignment are hidden, every layout applies to the whole network,
    and the <i>Groups</i> card — clusters or annotation terms, drawn as fog clouds or hulls, with pie charts for
    nodes in several groups — is the main tool. The Layout panel runs no clustering algorithm: communities are
    found in the <i>Clustering</i> panel (top bar, next to Layout), and the layouts use them.
  </p>
  <h3>Layer selection (top bar)</h3>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/layer_selection.png" alt="The Layer selection panel" loading="lazy">
  <p>
    The layers to work on are ticked in the <i>Layer selection</i> tab of the top bar (Multilayered mode): the
    layouts, the alignment, the analyses and the NORMA and Flame exports run on the ticked layers, or on every
    layer while none is ticked. Each row shows the floor colour and the node count, and can also hide the layer
    with its inter-layer edges or show its node labels; <i>Select/Deselect All Layers</i> and <i>Invert</i> act on
    the whole list, and the count under them says what is selected. Below the list, <i>Layout…</i>,
    <i>Clustering…</i>, <i>Metrics…</i>, <i>Statistics…</i>, <i>Plots…</i>, <i>Perturbation…</i> and <i>Export…</i>
    open the panels that work on the selection.
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
      the selected nodes</i> algorithm (or the main one if none is chosen).</li>
    <li><i>Align Nodes Across Selected Layers</i> — the layers are merged by node name and laid out once, so every
      copy of a node sits in the same spot in each layer and inter-layer edges run straight. Links between copies of
      a node are ignored while computing it.</li>
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

  <h3>UMAP</h3>
  <p>
    <b>UMAP</b> (McInnes, Healy &amp; Melville, 2018), last in the algorithm list, places nodes with similar profiles
    together. It is computed on the server (umap-learn), in 2D or 3D, on any scope. The <i>UMAP mode</i> says what a
    node's profile is:
  </p>
  <ul>
    <li><b>Topology UMAP</b>: its connections, as its row of the random-walk matrix one and two steps out (with
      <i>Use Edge Weights</i>, heavier edges count more). Nodes that share neighbours land together, even without an
      edge between them.</li>
    <li><b>Attribute UMAP</b>: the features ticked under the mode, whatever the edges: the numeric columns of
      File → <i>Values</i> (matched by node name, so every copy alike; ticked as they load), annotation sets and the
      current clusters (one 0/1 column per term; a set's 50 most frequent terms), and node metrics (degree,
      clustering coefficient, betweenness, closeness, eigenvector centrality, PageRank, coreness and eccentricity,
      computed on the server on the graph being laid out). Numeric columns are standardised (z-scores), 0/1 columns
      stay 0/1, a missing value takes its column's mean, and a column that is the same for every node counts for
      nothing.</li>
    <li><b>Hybrid UMAP</b>: both side by side. <i>Balance</i> runs from 0 (topology only) to 1 (attributes only);
      each part is scaled so that the balance is its share of the distance between two nodes.</li>
  </ul>
  <p>
    The parameters are UMAP's own: <i>Neighbours</i> (n_neighbors, default 15; fewer keep local detail, more show
    the broader structure), <i>Minimum distance</i> (min_dist, 0.1; how tightly points may pack), <i>Distance</i>
    (Euclidean or cosine) and <i>Random seed</i> (42; the same options and seed give the same layout, another seed
    another run). With <i>Align Nodes Across Selected Layers</i> every node name is embedded once and its copies
    share the spot (their features averaged); <i>Selected Nodes Only</i> embeds just the selected nodes. UMAP runs
    without alignment or group layouts, on up to 5,000 nodes per layout; the first UMAP after the server starts
    takes about 20 seconds while UMAP gets ready. Like every layout it is one undo step, and sessions keep the
    positions. Export → Other tools draws the same embedding as a scatter or a table (<i>UMAP view</i>).
  </p>

  <h3>Clusters in layouts</h3>
  <p>
    Communities are found in their own panel, <i>Clustering</i> in the top bar (see its page). To lay them out, open the
    <i>Group Layout</i> card below with <i>Groups: Clusters</i> (or the annotation set saved from them); while there
    are no clusters the card says so and links to the Clustering panel.
  </p>
  <h3>Weighted layouts</h3>
  <p>
    <i>Use Edge Weights (and Channel Weights)</i> lets heavier edges pull their nodes closer (Fruchterman-Reingold,
    Kamada-Kawai, DrL and UMAP). In multi-channel networks each channel then gets a weight (0.1–10,
    default 1) that multiplies its edges' weights, so a network can be laid out mainly by one evidence type.
    Unchecking a channel leaves its edges out of the layout.
  </p>

  <h3>Cross-Layer Alignment</h3>
  <p>
    With the <i>Per Layer</i> scope and a 2D layout, you can trade alignment against each layer keeping
    its own shape, to reduce crossings between layers. <i>Soft</i> turns each layer's own layout, mirrored if that
    fits better, to lie as close as it can to the fully aligned one, then blends it toward that layout, so a layer
    keeps its shape and is never folded flat; <i>Anchor to a reference layer</i> lays out the chosen layer first and starts every other layer from
    the positions of its counterparts (the same node, or partners through inter-layer edges); <i>Chain</i> anchors
    each layer to the previous one, which suits time series and long stacks. <i>Strength</i> runs from 0 (independent
    layers) to 1 (shared nodes exactly aligned). After every multi-layer layout the panel reports the
    <i>inter-layer misalignment</i> — the average in-plane distance between linked nodes of different layers, as a %
    of the layout size. Lower means straighter links, so options can be compared directly. The alignment is applied
    by <i>Run Aligned Layout</i> in the card (it sets the Per Layer scope and a 2D layout, then runs
    the chosen algorithm) or by <i>Run Layout</i> with those settings; choosing a mode alone changes nothing yet.
  </p>

  <h3>3D Layout</h3>
  <p>
    <i>3D Layout</i> lets Fruchterman-Reingold, Kamada-Kawai, DrL, Random, Grid, Circle or UMAP place nodes in 3D, off the
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
    shelves), <i>Fan</i> (pages around a vertical spine), <i>By Inter-Layer Links</i> and <i>Hive plot</i> (below).
    <i>Arrange Layers</i> applies the choice; undo brings the previous arrangement back.
  </p>
  <h3>Hive plot</h3>
  <p>
    A hive plot (Krzywinski M, Birol I, Jones S, Marra MA. Hive plots — rational approach to visualizing networks.
    <i>Briefings in Bioinformatics</i> 2012;13(5):627–644, doi:10.1093/bib/bbr069; hiveplot.com) replaces an
    aesthetic layout by a rule you can state: here, <b>every layer is an axis</b> radiating from one centre (evenly
    spread; two layers sit 120° apart), its floor drawn as a thin bar with the layer's name at its outer end, and
    <b>every node sits on its layer's axis</b> by a network property, so two hive plots built with the same rules can
    be compared by eye. In Layout → <i>Layer Arrangement</i>, choose <i>Hive plot (layers as axes)</i>, then:
  </p>
  <ul>
    <li><b>Position on axis</b>: <i>Degree</i> (all a node's connections, inter-layer links included — the paper's
      default), <i>Betweenness centrality</i> or <i>Clustering coefficient</i> (computed within each layer), or
      <i>Name</i> (A→Z).</li>
    <li><b>Scale</b>: <i>Value, each axis full length</i> (value ÷ that axis's largest — "absolute connectivity with
      normalized axis length", the variant the paper finds most revealing); <i>Value, one scale for all axes</i>
      (comparable across axes); or <i>Rank</i> (evenly spaced in value order — use it when many nodes share a value
      and would otherwise sit on one spot).</li>
    <li><b>Axes</b>: <i>In a plane (classic)</i>, or <i>Spread in 3D</i> — three axes at right angles to each
      other (a tripod), four towards a tetrahedron's corners (109.5° apart), six along ±X, ±Y and ±Z, any other number
      spread evenly over a sphere. In a plane, links between axes that are not neighbours (four axes or more) pass
      over the axes between — the reason the paper keeps to three axes; spread in 3D, every two axes are
      neighbours, so no link crosses an axis. Turn the view to read it (drag, or the Navigation Controls).</li>
    <li><b>Height off the plane</b> (axes in a plane): a second property — degree, betweenness, clustering
      coefficient or name, on the same scale — lifts each node off the plane, the best-scored node of its axis
      the highest, so two of the paper's hive panel views share one plot. The view tilts to show the depth.</li>
    <li><b>Curved links</b>: links between axes curve round the centre from one axis to the other, in the plane
      the two axes span — between opposite axes round the centre rather than through it — carrying any height
      from one end to the other; links between nodes of one axis arc beside it, where the paper draws them between
      the axis and its clone. Unticked, links are straight.</li>
  </ul>
  <p>
    A flat hive turns to face you (with axes spread in 3D or a height, the view tilts instead) and the scene's own
    axes are hidden while the hive plot is on; any other
    arrangement or undo brings floors, straight links and the axes back, and saved sessions keep the hive plot.
    3D containers (cubes, spheres, fog clouds) give way to the axes while the plot is on and come back, with the
    nodes where they were, when it ends; choosing a 3D container during a hive plot ends the plot first.
    The example list (Home page, or File → <i>Load Example</i>) has three ready to load: <i>PREGO</i> (three layers, the classic three axes, by degree
    rank), <i>GPCR signalling</i> (four axes) and the <i>SARS-CoV-2 host–virus network</i> (five axes), and three
    with the axes spread in 3D: GPCR signalling as a tetrahedron, the SARS-CoV-2 network on a sphere, and six layers along
    ±X, ±Y and ±Z.
  </p>
  <h3>What goes together</h3>
  <p class="help-note">
    The panel never offers a combination the layout service would refuse: as soon as a choice rules another out, the
    other control is disabled and a note under the section says why.
  </p>
  <ul>
    <li><i>Layout inside the selected nodes</i> only applies with the <i>Selected Nodes Only</i> scope.</li>
    <li><i>Use Edge Weights</i> works with Fruchterman-Reingold, Kamada-Kawai, DrL and UMAP on the <i>Per Layer</i> or
      <i>All Selected Layers</i> scope, without alignment.</li>
    <li><i>Cross-Layer Alignment</i> needs the <i>Per Layer</i> scope and a 2D layout (and layers to
      align, so not in Single network mode); UMAP runs without it.</li>
    <li>Group layouts run without alignment on the <i>Per Layer</i> or <i>All Selected Layers</i>
      scope. In the Group Layout card, <i>Group gravity</i> runs Fruchterman-Reingold, Kamada-Kawai or DrL (it works
      through edge weights, which the other algorithms ignore), <i>Virtual node per group</i> any algorithm that reads
      edges (not Circle, Grid or Random), and <i>Super nodes per group</i> any algorithm; layers as groups and
      sphere, cube or cloud layers are laid out in 3D, so only algorithms with a 3D version are offered there.</li>
  </ul>

  <h3>Group Layout (NORMA-2.0)</h3>
  <p class="last_p">
    Lays nodes out so that groups stay apart, with the three strategies of NORMA-2.0 (Karatzas <i>et al.</i>, 2022):
    <i>Virtual node per group</i> (a hidden hub pulls each group together), <i>Group gravity</i> (members attract each
    other; <i>Force strength</i> strengthens links inside groups and weakens those between them) and <i>Super nodes
    per group</i> (each group is laid out as one node, then each group's own layout fills its disc). <i>Groups</i> can
    be clusters (from the <i>Clustering</i> panel), annotations, or the layers themselves: then the whole network is laid
    out once in 3D, each floor moves to its group's place and turns to face outward, and its nodes are laid out within
    it. <i>Layout inside each group</i> picks the local layout; <i>Group size</i> scales the groups. Sphere, cube and
    cloud layers get their local layouts in 3D.
  </p>
  <p>
    In <i>Single network</i> mode the card becomes <i>Groups (NORMA-2.0)</i>: the groups are the clusters
    or the annotation terms, the whole network is laid out at once (a group spanning layers stays together),
    <i>Draw groups as</i> shows them as fog clouds or hulls the way NORMA draws its groups
    (after a group layout they appear as fog clouds unless you chose otherwise), and <i>Pie charts for annotated
    nodes</i> splits nodes that belong to several groups.
  </p>
</div>

<div id="Scene_tab" class="tabcontent">
  <h2>Scene &amp; Camera</h2>
  <p class="help-lead">Axes, rotation, overlays, the background, layer arrangements and rendering performance.</p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/scene.png" alt="The Scene & Camera panel" loading="lazy">
  <p>Four cards, all folded at first: <i>Axes &amp; rotation</i>, <i>Overlays</i>, <i>Layer arrangement</i> (Multilayered mode) and <i>Background</i>.</p>
  <ul>
    <li><i>Show Scene Coord System</i> shows the X (red), Y (green) and Z (blue) axes as arrows with tick marks and
      letters through the centre of the scene; <i>Scene axes opacity</i> fades them.</li>
    <li><i>Enable Scene Auto Rotate</i> keeps the scene turning; set the axis and angle with the Scene buttons of the
      navigation table.</li>
    <li><i>Node Glow</i> makes nodes glow on dark backgrounds.</li>
    <li><i>Show Navigator (2D)</i> shows or hides the overview at the bottom right. It and View → Performance →
      <i>Navigator refresh</i> agree: a refresh of <i>Off</i> unticks it, and ticking it turns the refresh back on.
      On phones and narrow windows the navigator always steps aside.</li>
    <li><i>Show Legend</i> shows or hides the legend at the bottom of the view: the layers after a load, then
      whatever was coloured last — groups (click an entry to select its members), a metric or value gradient. A
      selected layer's entry is framed in the yellow its floor turns.</li>
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
    a vertical spine), <i>By Inter-Layer Links</i> (layers with many links between them sit next to each other) and
    <i>Hive plot</i> (every layer an axis, nodes on it by degree — see Layout → Hive plot).
    The same choices sit in Layout → <i>Layer Arrangement</i>; every arrangement is undoable.
  </p>
  <img src="${import.meta.env.BASE_URL}images/help/predefined_layouts.png" alt="Predefined layer arrangements" style="max-width:100%;" loading="lazy">
  <h3>Performance</h3>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/performance.png" alt="The Performance panel: presets, rendering, while moving, live stats" loading="lazy">
  <p class="last_p">
    View → Performance tunes rendering for the network at hand; its first card (<i>Presets</i>) starts open and the other three folded. <i>Presets</i>: <i>Quality</i> (60 FPS, device
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
  <p class="help-lead">Node labels and their style, node shapes and colour priority.</p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/nodes.png" alt="The Edit → Nodes panel" loading="lazy">
  <p>Four cards, all folded at first: <i>Selection &amp; labels</i>, <i>Label style</i>, <i>Shape</i> and <i>Colours</i>.</p>
  <ul>
    <li><i>Select / Deselect all Nodes</i>. Selected nodes can be moved with the navigation table, laid out locally
      or rescaled by a metric.</li>
    <li><i>Show Labels</i>: all, selected, <i>Chosen</i> or none; <i>Resize Labels</i> sets their size.
      <i>Chosen</i> shows the labels you chose to keep on screen, whatever is selected later — and the selected
      nodes' labels too while <i>and the selection's labels</i> is ticked. Choose them without the mouse: select
      nodes with Find (names, comma-separated, or a regular expression) or a group, then <i>Show Labels of Selected
      Nodes</i>; or tick <i>Label shown</i> in Edit → Attributes (every ticked row at once), set <i>Label shown</i>
      in Edit → Style for a layer or all, use right-click → Selected nodes → <i>Show Their Labels</i> / <i>Hide
      Their Labels</i>, or load a node attribute file with a <i>LabelShown</i> column (yes). Choosing labels while
      Show Labels is on Selected or None switches it to Chosen (keeping the selection's labels when it was on
      Selected). <i>Clear Chosen Labels</i> lets them all go. Each change is one undo step; sessions keep the chosen
      labels and the Show Labels choice.</li>
    <li><i>Labels to show</i>: every node with a tick box — a ticked label is a chosen one. Filter the list by text
      (names, labels, descriptions), layer or group; <i>All</i>, <i>None</i>, <i>Invert</i> and <i>The selected
      nodes</i> (ticks the selected nodes in the list and unticks the others) act on the listed rows, and the count
      says how many labels are chosen. Without the mouse: type in the filter and press Enter to tick every match,
      or Tab to a tick box and press Space. Ticking switches Show Labels to <i>Chosen</i> when it was on Selected or
      None, and says so. Only the rows in view are drawn, so long lists scroll smoothly.</li>
    <li><i>Label Style</i>: colour, font (system, serif, monospace), bold, italic, a dark halo for light backgrounds,
      a background pill and opacity — applied to all node labels or to the labels of the layers selected in
      Layout, so each layer can read differently; undoable. Labels keep the theme colour until a colour is
      applied. A node's own label text, colour and font size (Edit → Style) win over these.</li>
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
  <p class="help-lead">Edge weights, direction, appearance, channels and edge bundling.</p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/edges.png" alt="The Edit → Edges panel" loading="lazy">
  <p>Five cards, all folded at first: <i>Weights</i>, <i>Bundling</i>, <i>Direction</i>, <i>Appearance</i> and <i>Colours</i>.</p>
  <ul>
    <li><i>Hide Edges with Weight Below</i> filters weak edges (and weak channels of multi-channel edges) out of the
      view.</li>
    <li><i>Enable Edge Direction</i> draws arrows from source to target; two sliders size the intra- and
      inter-layer arrows. <i>Arrowheads in</i> ticks the layers that get them, so a network can mix directed and
      undirected layers (untick STRING next to OmniPath signalling, say), and <i>Links between layers</i> turns
      them on or off on the inter-layer links; both are saved in sessions.</li>
    <li><i>Show Edge Weight As</i>: opacity, width, both or neither. Whichever property weight does not drive is set
      with the intra- and inter-layer opacity and width sliders.</li>
    <li><i>Edge Shape</i> (multi-channel networks): <i>Parallel</i> (the default) draws every channel as its own
      straight line, side by side, the way STRING draws its evidence channels; <i>Bézier curves</i> bend each channel
      away from the others; <i>Straight</i> lets the channels of a pair share one line. Sessions remember it.</li>
    <li><i>Channel Curvature</i> (Bézier curves) pulls the curved channel edges apart, within and between
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
  <p class="help-lead">Layer labels and axes, floors, 3D containers and restructuring layers.</p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/layers.png" alt="The Edit → Layers panel" loading="lazy">
  <p>Five cards, all folded at first: <i>Labels &amp; axes</i>, <i>Shape &amp; container</i>, <i>Floor</i>, <i>Colours</i> and <i>Restructure</i>.</p>
  <ul>
    <li><i>Show Labels</i>: all, selected or no layer labels; <i>Resize Labels</i> sets their size.</li>
    <li><i>Label style</i> (layer labels; the halo is their default too): <i>Style</i> — halo, plain, box or shadow,
      with the rim, box or shadow colour (<i>Auto</i>: against the text) and the halo width or box opacity;
      <i>Font</i> — as the app, sans-serif, serif, monospace or condensed, with <i>Bold</i> and <i>Italic</i>;
      <i>Colour</i> — the theme's, one colour for every label, <i>Match layer colour</i> (each label takes its
      layer's colour, as the legend shows it) or a <i>Palette</i> (one colour per layer); <i>Position</i> — the
      floor's outer corner (as always), centred above the floor or under it. <i>Apply Label Style</i> for all layers
      or the selected layers; <i>Reset</i> goes back to the default. Undoable and saved in sessions; switching to a
      theme with <i>Apply the theme's colours</i> gives the labels the theme's colour again (the rest stays), while
      <i>Keep the current colours</i> keeps theirs. Image exports draw them with their look and place.</li>
    <li><i>Layer Coord Systems</i>: <i>All</i>, <i>Selected</i> (the selected layers, following the selection) or <i>None</i> shows each layer's own axes (arrows with ticks and letters at the layer's
      centre, turning with it); <i>Layer axes opacity</i> fades them. Layer selection → <i>Axes</i> shows or hides one layer's coordinate system at a time (no choice above is then marked); a layer keeps its axes through any change to its floor.</li>
    <li><i>Layer Shape</i> turns the selected layers (or all) into 3D containers, or back to a flat shape.
      <img class="help-shot" src="${import.meta.env.BASE_URL}images/help/ui/containers.jpg" alt="Four layers in four containers: a cylinder, a torus, a cone and a bubble, each with its nodes laid out inside" loading="lazy">
      The list is grouped:
      <ul>
        <li><b>Flat</b> — <i>Floor (2D)</i>, nodes laid out on the floor; <i>None</i>, no floor and no container.</li>
        <li><b>Solid</b> — translucent shapes with an outline: <i>Cube</i>; <i>Sphere</i>; <i>Cylinder</i>, an upright
          column (on the surface, nodes go on its wall); <i>Cone</i> and <i>Pyramid</i>, a hierarchy — nodes sit in up
          to five tiers by degree, most at the wide base and the hubs at the narrow top; <i>Dome</i>, a hemisphere over a
          round base, like a sky; <i>Ellipsoid</i>, an upright egg for elongated layouts; <i>Torus</i>, a ring standing
          across the floor and facing you in the Parallel arrangement, for cycles and periodic data — the floor's layout
          wraps round the ring (its angle on the floor becomes its place on the ring) and depth goes across the tube;
          <i>Hexagonal prism</i>, a honeycomb cell (prisms side by side tile); <i>Geodesic sphere</i>, a faceted globe;
          <i>Disc stack</i>, five thin plates with the nodes sorted by degree into slices.</li>
        <li><b>Soft</b> — <i>Fog cloud</i>, soft puffs of fog filling the volume with no hard boundary, as in NORMA;
          <i>Bubble</i>, a soft sphere with a glowing rim and no outline.</li>
      </ul>
      The shapes stand upright in the Parallel arrangement and fit the cube's room, so layers are spaced as for cubes and
      volumes don't overlap. <i>Nodes: Inside</i> or <i>On the surface</i> (every solid shape and the bubble): a layer
      that was flat gets a 3D layout, placed inside the shape, clear of its walls, or on its surface (round the rim of
      each tier for the cone, pyramid and discs). A layer already in 3D keeps its layout when it changes shape: the
      nodes move from the old shape into the new one, in the same undo step. Leaving a surface or tiers (which keep no
      depth) lays the nodes out again. The placement is the same every time, and later layouts and group layouts stay
      inside the shape.</li>
    <li><i>3D Container Look</i>, for the selected layers (or all): the colour (or the <i>Theme default</i>, a colour
      chosen to contrast with each theme's background), the <i>Opacity</i> (every part fades with it), the
      <i>Outline</i> (on or off, in the container's colour or one of its own), a <i>Wireframe</i> cage of lines over
      the whole surface, a <i>Glow</i> (a rim light, brighter where the surface turns away, like glass) and the
      <i>Floor under it</i> (the layer's floor stays visible inside or under the container). A hovered or selected
      layer's container takes the highlight colour. Saved in sessions (older sessions load as before) and undoable;
      layers with the same container share one drawing, so many layers stay smooth.</li>
    <li><i>Floor Shape</i> makes the floors square or round (disk); nodes outside a disk are pulled inside, and
      layouts on disk floors stay inside the circle.</li>
    <li><i>Floor Style</i> draws the floors of the selected layers (or all) as a <i>Solid</i> plane, a
      <i>Wireframe</i>, a <i>Grid</i> or <i>Dotted grid</i> over a faint plane, or the <i>Outline</i> only; saved in
      sessions and undoable. <i>Show Layer Floors</i> hides or shows them (single-layer networks load without
      one).</li>
    <li><i>Floor Opacity</i> fades the floors.</li>
    <li><i>Colours</i>: <i>Color Priority</i> (colours from a session, or from the theme and colour picker) and
      <i>Floor Color</i>.</li>
  </ul>
  <h3>Restructure Layers</h3>
  <p class="last_p">
    <i>Split Selected Layer by Cluster</i> turns every cluster of one selected layer into its own layer — find its
    communities first (the Clustering panel); edges between clusters become inter-layer edges. <i>Merge Selected Layers</i>
    flattens the selected layers into one: copies of the same node merge and the links between them disappear.
    <i>Lift Nodes by Degree</i> raises each node off its floor in proportion to its degree; any 2D layout flattens
    them again.
  </p>
</div>

<div id="Style_tab" class="tabcontent">
  <h2>Edit → Style</h2>
  <p class="help-lead">Colours, sizes, borders, shapes, labels and line types of nodes and edges, palettes and colour vision tools.</p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/style.png" alt="The Edit → Style panel" loading="lazy">
  <p>
    The <i>Nodes</i> and <i>Edges</i> buttons at the top switch between the two tables (each with its total), as
    in Edit → Attributes; <i>Colour Vision</i> stays below both.
  </p>
  <p>
    <b>Nodes.</b> Choose what to change (<i>Selected nodes</i>, <i>All nodes</i> or one layer); the count beside it
    says how many nodes that is. The table works like Cytoscape's Style panel: each row shows what those nodes have
    <i>Now</i> (one value, or <i>mixed</i> when they differ), a new value and <i>Set</i>; <i>Reset</i> takes a
    per-node setting away again. The rows are fill colour; opacity; border (a rim of the chosen colour and width
    around the node); size; proportions (width, height and depth: stretched along the floor's two sides and out of
    it, on top of the size; <i>Lock width, height and depth</i> keeps the three equal); shape (sphere, cube,
    diamond, cone, cylinder, tetrahedron and more); label (text in place of the node name); label colour and font
    size (over the label style of Edit → Nodes); label style; label position; and description (shown when the
    pointer rests on the node, and by right-click → Description). Every Set and Reset is one undo step.
  </p>
  <p>
    <b>Label style</b> makes labels read over any node, edge or background. <b>Halo is the default</b>: every
    label has a thin rim against its colour unless it is given another style here (or the label style of Edit →
    Nodes asks for its dark halo or background), in new networks, every theme and older sessions alike.
    <i>Halo (outline)</i> draws a rim
    around the letters (adjustable width), <i>Box</i> a rounded box behind them (adjustable opacity), <i>Shadow</i> a
    soft shadow; <i>Bold</i> goes with any of them, and <i>Plain</i> is text alone. With <i>Auto</i> ticked the rim,
    box or shadow takes a colour against the text — white around dark text (light themes), dark around light text
    (dark themes); pick a colour to use your own. <b>Label position</b> puts the label right of the node (as
    always), centred on it, above or below it — centred with a halo and bold gives the classic look of a label
    sitting on its node. <i>Reset</i> hands a label back to the label style of Edit → Nodes. Image exports draw labels
    with their style and position. Labels show as chosen in Edit → Nodes → <i>Show Labels</i>; <i>Label shown</i>
    keeps the labels of the nodes in <i>Apply to</i> on screen (Show Labels: <i>Chosen</i>), whatever is selected.
  </p>
  <img class="help-shot" src="${import.meta.env.BASE_URL}images/help/ui/label_styles.png" alt="Node labels with a bold halo, centred on their nodes, on the Light theme" loading="lazy">
  <p>
    <b>Colour labels by</b> colours the labels of the nodes in <i>Apply to</i>, leaving the nodes as they are:
    one palette colour per layer, cluster or first annotation term (the theme's node or channel colours,
    <i>Distinct</i>, <i>Okabe–Ito</i> or <i>Tol bright</i>, each made to read on the background), the node's own
    colour (<i>Node colour</i>, darkened or lightened just enough to read on the background) or a colour that reads
    on top of the node (<i>Contrast with node</i>: white on dark nodes, near-black on light ones; for centred labels).
    The <i>Label colour</i> row sets one colour for them all. Each colouring is one undo step.
  </p>
  <p>
    <i>Colour by</i> colours nodes by layer,
    cluster, first annotation or degree, with a palette: <i>Distinct</i> (checked for colour-blind readers),
    <i>Okabe–Ito</i> (the standard colour-blind-safe set), <i>Tol bright</i> (Paul Tol's colour-blind-safe set) or,
    for degree, <i>Blues</i> / <i>Cividis</i> (colour-blind
    optimised). Palettes have 8 colours; further groups are grey rather than repeating a colour. <i>Uploaded values</i>
    (after a values file) colours nodes by a column of that file: a sequential ramp, or a diverging blue–pale–red scale
    centred on zero when the column has values on both sides of it. Every colouring updates the legend.
  </p>
  <p>
    <b>Edges.</b> Choose all, selected, intra-layer or inter-layer edges; the same table sets their colour, width
    (×0.25–5), opacity (×0.05–1, multiplying the opacity set in Edit → Edges or by weight), line type (solid,
    dashed or dotted) and arrow colour (arrows show when Direction is on; <i>Reset</i> makes them follow the edge
    colour again). <i>Channel Palette</i> recolours the channels with the palette chosen beside it.
  </p>
  <p>
    <b>Colour vision.</b> <i>Colour-Blind Friendly Mode</i> switches to Okabe–Ito colours by layer (or by cluster
    after clustering), recolours channels, and gives each layer its own node shape, so groups never rely on colour
    alone. <i>Preview as</i> simulates protanopia, deuteranopia, tritanopia or achromatopsia on the view, to check a
    figure before publishing. Everything set in this panel is saved in sessions.
  </p>
  <p class="help-tip last_p">
    To set these node by node or edge by edge, or for the rows ticked in a table, use <i>Edit → Attributes</i>.
  </p>
</div>

<div id="Attributes_tab" class="tabcontent">
  <h2>Edit → Attributes</h2>
  <p class="help-lead">Every node and edge in a table: edit one or many at once, or inspect a single node or edge.</p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/attributes.png" alt="The Edit → Attributes panel: the node table, with ticked rows" loading="lazy">
  <p>
    <b>Tables.</b> After Cytoscape's Node and Edge Tables: one row per node or per edge (<i>Nodes</i> / <i>Edges</i>
    at the top, with their counts). Nodes show their name, layer, colour, shape, size, opacity, label (text in place of
    the name; empty shows the name), label colour (a faded swatch is the label style's colour; × takes a colour of
    its own away), label size (blank: as the label style), label style (<i>Auto</i>: the default halo, or the
    label style of Edit → Nodes; or plain, halo, box, shadow — each node keeps its own rim colour, width and bold),
    bold, label position (right, centre, above, below), label shown (kept on screen with Edit → Nodes → Show
    Labels: <i>Chosen</i>, whatever is selected) and description (shown on hover). Like every column, the label
    columns sort and change all ticked rows at once. Edges show their source, target, layers,
    channels, colour, width (× the edge width of Edit → Edges), opacity (× the edge opacity), line type (solid,
    dashed, dotted) and arrow colour (a faded swatch follows the edge colour; × takes a colour of its own away).
    Every cell but the names, layers and channels is edited in place: pick a colour or a shape, or type a number or
    text and press Enter (Esc keeps the old value). Each change is one undo step, and sessions keep it.
  </p>
  <p>
    <b>Finding rows.</b> Filter by text (name, label or description; for edges, source or target), by layer and by
    group (annotation terms and clusters, as in the Groups card); edges by channel and by intra- or inter-layer.
    <i>Selected only</i> lists the selected nodes or edges. Click a column title to sort (again for descending, a
    third time for the loaded order). Only the rows in view are drawn, so tables of up to 20,000 nodes scroll
    smoothly.
  </p>
  <p>
    <b>Many at once.</b> The tick boxes are the selection: ticking a row selects its node or edge in the scene, and a
    selection made in the scene (a double-click, Shift + Drag with a rectangle or a lasso, Find, Explore, a group)
    ticks its rows. Shift-click ticks a run of rows; the box in the header ticks every row in the list. Editing a
    ticked row changes every ticked row in the list (the line above the table says how many), as one undo step;
    editing a row that is not ticked changes that row alone. With nodes selected, right-click → <i>Edit Attributes…</i> (under
    <i>Selected nodes</i>) opens the table on them.
  </p>
  <p>
    <b>Inspector.</b> Right-click a node → <i>Edit Attributes…</i>, Alt (Option) + double-click a node, or ⋯ at the end
    of a row opens a small card beside it with all its attributes: colour, shape, size, opacity, border (colour and
    width; 0 is none), label, label colour and size (blank: as the label style of Edit → Nodes), label style (with
    the rim, box or shadow colour — × makes it automatic again —, the halo width or box opacity, and bold), label
    shown, label position and description.
    Right-click an edge, away from its nodes → <i>Edit Edge Attributes…</i> for its colour, width, opacity, line type
    and arrow colour (<i>Select Edge</i> selects it). Each change is one undo step; drag the card by its title, Esc or
    × closes it, <i>Select</i> selects the node or edge and <i>Show in table</i> opens its row.
  </p>
  <p>
    <b>Export.</b> <i>Export node attributes</i> and <i>Export edge attributes</i> save tab-separated files in the
    node and edge attribute formats of the File tab, every node or edge with all its attributes (edges one row per
    channel); File → Node attributes / Edge attributes loads them back, onto the same network or another with the
    same names and layers. Node files carry <i>Label</i>, <i>LabelColor</i>, <i>LabelSize</i>, <i>LabelStyle</i>
    (e.g. <code>halo #ffffff 3</code>, <code>box 0.6</code>, <code>plain</code>), <i>LabelPosition</i> (right,
    centre, above, below), <i>LabelBold</i> (yes) and <i>LabelShown</i> (yes for a chosen label); a value the
    loader cannot read is refused with a message naming the column. Edit → Style sets the same properties for a
    layer, the selection or all, with palettes.
  </p>
  <p class="last_p">
    <b>Label colours.</b> Above the node table, <i>Label colours</i> colours the labels of the ticked rows (or of
    every row in the list when none is ticked) by layer, cluster or first annotation with a palette, from the node
    colour, or against it, as in Edit → Style; one undo step.
  </p>
</div>

<div id="Analyze_tab" class="tabcontent">
  <h2>Analyze</h2>
  <p class="help-lead">Metrics, statistics, plots, perturbation, exploring, enrichment and the Data Tables.</p>
  <p>
    The Analyze menu holds one panel per kind of analysis: <b>Metrics</b> (node metrics for sizes and colours),
    <b>Statistics</b> (network statistics, layer and network comparison), <b>Plots</b> (distributions and plots of
    topological features), <b>Perturbation</b> (knockouts, attacks and robustness, propagation), <b>Explore</b>
    (selection tools and paths), <b>Annotations &amp; Groups</b> (STRING enrichment; the annotation sets, pies,
    hulls, clouds and the group list are in View → Annotations) and <b>Data Tables</b>, where their reports land. Metrics, Statistics, Plots and Perturbation work on
    the layers ticked in Layer selection (every layer while none is), as their first line says.
  </p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/analyze.png" alt="The Metrics panel" loading="lazy">

  <h3>Metrics</h3>
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

  <h3>Statistics</h3>
  <p>
    <i>Network Statistics</i> reports, for each selected layer (or every layer) and the whole network: nodes, edges,
    density, average and maximum degree, connected components and the largest one, diameter and average path length,
    average clustering, transitivity and degree assortativity, plus a degree-distribution chart. <i>Compare
    Layers</i> shows how many nodes and edges each pair of layers shares (Jaccard index) as heatmaps, and an
    <i>UpSet plot</i> of the layers' node sets: one bar per combination, so a bar with one dot holds the nodes only
    that layer has and a bar with several dots the nodes exactly those layers share. The plot is interactive (see
    Data Tables below) and downloads as SVG. <i>Compare Networks</i> (File → Loaded networks) sets two loaded
    networks side by side.
  </p>

  <h3>Plots</h3>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/plots.png" alt="The Plots panel: a histogram of degree with each layer overlaid, and its summary table per layer" loading="lazy">
  <p>
    <i>Plot</i> picks a chart and shows the options it needs; <i>Graphs</i> draws <i>each layer, overlaid</i> in the
    layer colours with a legend, or <i>the analysed layers as one graph</i> (Single network mode always does). The
    server computes what a chart needs once per network, so other charts of the same measures come at once; a
    progress bar shows the computing, with <i>Cancel</i>.
  </p>
  <p>
    <b>Distributions</b> of one measure — any node metric of the Metrics panel (the same values), the edge weights
    (one series per channel), a column of node values (File → Values), the component sizes or the shortest-path
    lengths: a <i>Histogram</i> (a number of bins or a bin width; the layers side by side in each bin), a
    <i>Density</i> curve (a Gaussian kernel, Silverman's bandwidth), the <i>Cumulative distribution</i> (CDF, or the
    complementary CCDF, P(X ≥ x), optionally on log axes), a <i>Log–log distribution</i> with an optional power-law
    fit (the exponent γ above k_min by maximum likelihood, after Clauset, Shalizi &amp; Newman 2009: a simple fit
    without a goodness-of-fit test, and a straight line on log–log axes is no proof of a power law) and <i>Box and
    violin per layer</i>, to compare layers side by side. A table under the chart gives n, mean, median, standard
    deviation, minimum and maximum per series.
  </p>
  <p>
    <b>Topological features together</b>: a <i>Scatter</i> of one metric (or node value) against another, every
    node a point (hover for its name), with Pearson's r and Spearman's ρ in the corner; the <i>Metric correlation
    matrix</i>, the Spearman correlation of every pair of metrics as a heatmap; <i>C(k)</i>, the mean clustering
    coefficient of the nodes of degree k, and <i>knn(k)</i>, their neighbours' mean degree (rising for an
    assortative network, falling for a disassortative one), both usually read on log axes; the <i>Rich-club
    coefficient</i> φ(k), the density of links among the nodes of degree above k (Zhou &amp; Mondragón 2004),
    by default divided by its mean on three random graphs with the same degrees, so values above 1 mean the hubs
    link to each other more than chance (Colizza et al. 2006); the <i>k-core shells</i>, the number of nodes per
    coreness; the <i>Centrality ranking</i>, the top nodes by a metric as bars with their rank in every layer as
    coloured dots (who is a hub where); and the <i>Layer profiles</i>, the layers and the whole network over density,
    degree, clustering, transitivity, path length, diameter, components and assortativity as small charts.
  </p>
  <p>
    A click on a bar, a box or a point selects its nodes in the scene (Shift adds to the selection); on a scatter,
    drag a box to select the points in it. Every chart downloads as SVG or PNG (light, with a white background) and
    its numbers as CSV.
  </p>

  <h3>Explore</h3>
  <p>
    <i>Expand Selection</i> adds the neighbours of the selected nodes, 1 or 2 hops away — <i>Within layers</i>
    follows intra-layer edges; <i>Across layers</i> also follows inter-layer edges and copies of the same node.
    <i>Shortest Path Between 2 Selected</i> selects the path between exactly two selected nodes (layer hops allowed
    across layers). The text box selects nodes whose description, annotations or URL contain the text.
  </p>
  <p>
    <i>Select All</i>, <i>Invert</i> and <i>Clear</i> (nodes and edges) act on the whole selection;
    <i>Connected Component</i> adds every node the selected ones reach, within or across layers; <i>Nodes of Selected
    Layers</i> adds every node on the selected floors; <i>Nodes with at least N links</i> selects the hubs (within
    layers counts each node's links in its own layer, across layers its inter-layer links too). These tools add to
    the selection, so <i>Clear</i> first to start afresh.
  </p>
  <p>
    <i>Highlight paths between selected nodes</i> draws, in the edge selection colour, the shortest paths joining
    every pair of selected nodes (up to 25 of them), within or across layers, and follows the selection as it
    changes; <i>Also select the nodes along the paths</i> selects the nodes in between too. The highlight never
    treats its own nodes as path ends, and switching it off takes back only what it added. To keep a path,
    use <i>Shortest Path Between 2 Selected</i>.
  </p>

  <h3>Perturbation</h3>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/perturbation.png" alt="The Perturbation panel: a knockout of the top 5 nodes by degree, and the robustness curves of a degree attack and random failure" loading="lazy">
  <p>
    Analyze → Perturbation has two cards, folded at first. Inside, the options fold too — <i>Knock out</i> into
    <i>Nodes</i>, <i>Edges</i>, <i>Propagation</i> and <i>Scene &amp; reports</i> (opened for you once a knockout has
    run), <i>Attack and robustness</i> into <i>Strategy</i> and <i>Steps</i> — while <i>Run Knockout</i> and
    <i>Run Attack</i> stay in their card, and <i>Expand all</i> at the top opens everything. <i>Knock out</i> removes nodes — the selected nodes, nodes by name (every copy in the analysed layers), or the
    top <i>k</i> by degree, betweenness or PageRank, in the whole network or in each layer — with <i>Every copy
    across layers</i> all their copies too (a multiplex knockout); and edges — the selected edges, a channel, the
    inter-layer edges or a random share of them (the same share on every run). It works on the layers ticked in
    Layer selection (every layer while none is): each layer's own graph and the whole network (those layers with the
    inter-layer edges among them), undirected, parallel edges merged, distances in hops. With nodes selected,
    right-click → <i>Selected nodes</i> → <i>Knock Out the N Nodes…</i> runs it on them.
  </p>
  <p>
    Data Tables → <i>Knockout</i> compares each graph before and after: nodes, edges, connected components, the
    largest component, density, average path length and diameter (of the largest component), global efficiency
    (the mean of 1/distance over all pairs of nodes, 0 for pairs no longer joined) and the nodes cut off from the
    largest component. <i>Knockout Nodes</i> lists every node's degree, betweenness and closeness in the whole
    network before and after, with the change, most affected first, and marks the nodes knocked out or cut off.
    Closeness here is the harmonic closeness (the mean of 1/distance to the other nodes), so a node that is cut off
    loses closeness rather than gaining it. Above 2,000 nodes, betweenness and closeness are estimated from 200
    sampled nodes, the same ones before and after.
  </p>
  <p>
    In the scene the knocked-out nodes and their edges are <i>faded</i>, <i>hidden</i> or left <i>as they are</i>
    (an edge drawn for several channels fades once all of them are removed). <i>Colour by Change</i> colours the
    nodes by their change in degree, betweenness, closeness or propagation: blue lost, red gained, pale unchanged,
    knocked-out nodes grey, with the scale in the legend. <i>Restore</i> brings back how the nodes and edges looked
    before the knockout; each of these is one undo step. <i>Apply as a New Network</i> loads the network without the
    knocked-out nodes and edges through the Import as popup, as a network of its own in the Networks menu.
  </p>
  <p>
    <i>Propagate from</i> (optional) runs a network propagation from the named seed nodes, before and after the
    knockout: a random walk with restart (personalised PageRank) that goes back to the seeds at each step with the
    <i>Restart probability</i>, so a node's score is the share of the signal that reaches it. With a drug's targets
    as seeds and a gene knocked out, <i>Knockout Nodes</i> and <i>Colour by Change</i> show which nodes lose or gain
    the signal.
  </p>
  <p>
    <i>Attack and robustness</i> removes nodes step by step and follows the largest component (the share of the
    starting nodes still in it), the number of components and, if ticked, the global efficiency (relative to the
    start; graphs up to 2,000 nodes). <i>At random</i> is a failure, averaged over several runs, with their spread
    as a band; <i>By degree</i> and <i>By betweenness</i> are targeted attacks on the highest-ranked nodes first,
    the ranking <i>Recalculated after each step</i> (an adaptive attack) or <i>Computed once</i> at the start (above
    2,000 nodes, betweenness is estimated from 200 sampled nodes). Up to 50 steps, one node a step for smaller
    graphs; one curve per layer and one for the whole network, with the robustness <i>R</i> in the legend: the area
    under the largest-component curve (Schneider et al. 2011), lower for a network that falls apart sooner.
    Scale-free networks typically shrug off random failure yet break quickly under a targeted attack (Albert, Jeong
    &amp; Barabási 2000). <i>Keep earlier runs on the chart</i> puts strategies side by side; the chart downloads as
    SVG and its points as CSV, and the points fill Data Tables → <i>Robustness</i>. Each curve is computed on its own
    (the whole network first), so the progress bar counts the curves and <i>Cancel</i> stops after the current one,
    keeping those done; a knockout shows its seconds and can be cancelled too. A curve stops after 30 seconds and
    returns what it has, saying so.
  </p>

  <h3>Annotations &amp; Groups</h3>
  <p>
    The annotation sets, pies, hulls, clouds, 3D containers and the group list have their own panel, View →
    Annotations (see its page); <i>Open Annotations…</i> at the top of this panel goes there. The panel keeps the
    enrichment: <i>Enrichment of Selected Nodes</i> sends the selected names to STRING's enrichment service (GO,
    KEGG, Reactome, WikiPathways) for the chosen organism; click a term to select its genes, or <i>Annotate Nodes
    with Top 5 Terms</i> to turn the results into an annotation set, shown as pies and hulls.
  </p>

  <h3>Data Tables</h3>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/data.png" alt="The Data Tables panel" loading="lazy">
  <p>
    Analyze → Data Tables holds every report as a tab — the network on loading, the selected edges, the clusters,
    every computed metric, layer similarity, network statistics, group statistics and overlap, the network comparison,
    the node values, a knockout's networks and nodes, and the robustness curves — each drawn as a table with a header that stays put while the rows scroll, numbers
    right-aligned, the row count and a CSV download. Click a column title to sort the report by it (numbers largest
    first, text A→Z) and click again to turn the order round; the order is kept while the report refreshes and the
    CSV follows it. The comparison tabs add an UpSet plot of the sets they compare.
  </p>
  <p class="last_p">
    <b>Interactive UpSet plots.</b> Hover a bar, its column of dots or a set on the left to see the exact sets, the
    count and the first members. Click a bar to pick what is in exactly those sets; Shift- or Ctrl-click adds more
    bars. Click set names (or their size bars) to pick their <i>Union</i> or <i>Intersection</i> — the switch
    under the plot chooses which, and the bars it is made of are tinted. The pick's count and members show below:
    <i>Copy names</i> copies them, <i>Select in scene</i> selects every copy of them in the picked layers (or the
    group members), and <i>Load as new network</i> loads the subnetwork they induce — those nodes, every edge
    among them, their layers — through the Import as popup, so it can replace the network or be added to it, and
    it joins the loaded networks. With two networks compared, the layers of each are named after their network.
    <i>Sort</i> orders the bars by size or by degree (the number of sets). The bars and set names take the
    keyboard too: Tab to them, Enter or Space to pick, the arrow keys to move, Escape to clear. The SVG download
    is the plot as drawn, without the highlights.
  </p>
</div>

<div id="Clustering_tab" class="tabcontent">
  <h2>Clustering</h2>
  <p class="help-lead">Find communities within layers, across them or by node name, and use them for colours, layouts and annotation sets.</p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/clustering.png" alt="The Clustering panel" loading="lazy">
  <p>
    The <i>Clustering</i> panel (top bar, next to Layout) finds communities without moving the nodes, with <b>Louvain</b>, <b>Walktrap</b>,
    <b>Fast Greedy</b>, <b>Label Propagation</b> or <b>Leiden</b>. In Multilayered mode <i>Communities</i> chooses
    where they are found: <i>Within each layer</i>, over the <i>selected layers as one graph</i>, or <i>shared across
    layers by node name</i> (multiplex Leiden for Leiden, the label-merged graph for the others); it runs on the layers
    ticked in Layer selection, or on every layer while none is. In Single network mode the whole network is one graph.
    The first card starts open and the second folded; inside <i>Clustering</i>, <i>How it works</i> under the buttons folds the longer notes
    away.
  </p>
  <p>
    <i>Find Communities</i> colours the nodes by community and fills Data Tables → Clustering Data. Under
    <i>Communities</i> the panel sums the result up — how many communities, over how many nodes, their sizes — and
    lists the largest with their colour, size and the number of layers they span. Untick a community (or
    <i>Show: None</i>, then tick the ones you want) to show only the chosen communities: the others' nodes and
    edges fade and their shapes are not drawn; <i>Show: All</i> brings everything back, and the smaller communities
    have their switches in View → Annotations → Groups. <i>Save as Annotation Set</i>
    turns them into annotation terms (<i>Cluster 1</i>, <i>Cluster 2</i>, …) kept as a set in the Networks menu, so
    pies, hulls, fog clouds, the Groups card and group layouts treat them like an annotation file. <i>Draw Around
    Clusters…</i> opens View → Annotations with a shape (a hull unless another is chosen) around every cluster and
    the clusters in its group list. <i>Lay Out by
    Cluster…</i> opens Layout → <i>Group Layout (NORMA-2.0)</i> with the clusters as groups; layouts only use the
    communities, they never compute them. Every step is undoable.
  </p>
</div>

<div id="Annotations_tab" class="tabcontent">
  <h2>View → Annotations</h2>
  <p class="help-lead">Highlight annotation groups and clusters in the scene: a hull, outline, cloud or 3D container around each, pies on the nodes, and the group list.</p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/annotations.png" alt="The Annotations panel" loading="lazy">
  <p>
    View → Annotations decides how annotation terms and clusters are highlighted on the network. Groups come from a
    node attributes file with an <i>Annotation</i> column, a group file (File), an enrichment (Analyze → Annotations
    &amp; Groups), STRING groupings (Database Importers), a saved session, or communities from the Clustering panel.
    The panel has five cards, each with a one-line hint after its title; the first starts open, and <i>Expand
    all</i> / <i>Collapse all</i> open or fold them together. Three links lead here too: <i>Open Annotations…</i> in
    Analyze → Annotations &amp; Groups, <i>Annotation options…</i> in the Networks menu, and <i>Draw Around
    Clusters…</i> in the Clustering panel, which also draws around the clusters.
  </p>

  <h3>What to show</h3>
  <p>
    One choice at the top: draw around <i>Nothing</i>, the <i>Clusters</i> or the <i>Annotations</i>; the Groups card's
    list follows it. <i>Annotation set</i> keeps every set of annotations the network received — each attribute or
    group file, an enrichment, a cluster run — and switches between them (or to none); the newest set is the one
    shown. <i>Rename</i> and <i>Delete</i> beside it act on the set shown (after asking, for Delete); the Networks
    menu does the same for any loaded network. A line under them sums up what is drawn, for example <i>GO BP: 42
    groups over 310 nodes</i>, and the links below lead to where annotations come from.
  </p>
  <p>
    The annotation options (pie charts, shapes around annotations, annotations as groups or colours) are disabled
    until the network carries annotations — from a node attributes or group file, a session, or an enrichment's
    <i>Annotate Nodes with Top 5 Terms</i>; the card says so. Shapes around clusters need communities from the
    Clustering panel.
  </p>

  <h3>How to draw</h3>
  <p>
    <i>Draw as</i> is a set of tiles, each with a sketch of its shape, drawn around every group on each layer in the
    group's colour:
  </p>
  <ul>
    <li><b>On the floor</b> — <i>Hull</i>, a translucent area around the members, or <i>Outline</i>, a band along its
      edge that leaves the floor inside clear.</li>
    <li><b>Soft</b> — <i>Fog cloud</i>, as in NORMA, a haze over the members that follows their shape, or
      <i>Cloud</i>, a round cloud of soft puffs holding them (like a layer's cloud container, one per group).</li>
    <li><b>3D container</b> — <i>Sphere</i>, <i>Ellipsoid</i> (fitted to the group's extent along each axis: a flat
      lens on a flat layer) or <i>Box</i>, translucent with their outline drawn, holding every member.</li>
  </ul>
  <p>
    The soft shapes and the 3D containers hold groups whole in 3D layouts and sphere, cube or cloud layers too.
    <i>Opacity</i> sets how solid the shapes are (clouds and container walls stay softer by the same proportion) and
    <i>Padding</i> how far they reach beyond the members (1× is the usual margin, about three node radii). They
    follow the nodes when a layout, a drag or an undo moves them. In Single network mode, the Layout panel's Group
    Layout card sets the same drawing with <i>Draw groups as</i>, and Layout → Group Layout pulls the groups apart.
    A saved session keeps all of this, and the groups whose shape is switched off in the Groups card.
  </p>

  <h3>On the nodes</h3>
  <p>
    <i>Show Annotations as Pie Charts</i> draws annotated nodes as pies with one slice per term. <i>Colour Nodes by
    Group</i> gives every node its first group's colour — the colour its pie and shape show — and <i>Colour Labels by
    Group</i> does the same for the labels, made to read on the background; both use the groups chosen in <i>What to
    show</i> (annotations unless clusters are chosen), and one Undo brings the old colours back. Edit → Style colours
    nodes and labels with other palettes.
  </p>

  <h3>Groups</h3>
  <p>
    The <i>Groups</i> card lists every annotation term or every cluster, as in NORMA, under a header row: its colour
    (click the swatch to recolour the group, its pies and shapes), its name, the number of members (hover for the
    count per layer), a <i>Show</i> switch that draws or hides that group's shape, and <i>select</i>. Above the list,
    the count of groups (and how many match the filter) and <i>Show: All</i> / <i>None</i>, which switch every group
    that matches the filter. With some groups switched off, the scene shows only the chosen ones: the nodes in none
    of the groups still shown (and those in no group) fade, with the edges touching them, so <i>None</i> and then a
    tick or two picks out a few groups. The Clustering panel's list of communities has the same switches, in step.
  </p>

  <h3>Legend &amp; reports</h3>
  <p>
    <i>Legend</i> shows the groups in the on-canvas legend. <i>Groups Table</i>, <i>Overlap Table</i> (the Jaccard
    overlap of every pair of groups, with an UpSet plot of the members the groups share) and <i>Group Stats</i> open
    in Data Tables; <i>Group Stats</i> reports, per group and as NORMA does, the members, the layers they span, the
    edges inside the group (intra- and inter-layer), the density, the mean degree inside, the share of the network's
    edges and the members that belong to other groups too. Set apart below them, <i>Collapse into Super Nodes</i>
    turns every group into one node per layer, sized by its members and coloured like the group, with member edges
    summed into the edges between them — undo restores the network.
  </p>
</div>

<div id="Export_tab" class="tabcontent">
  <h2>Export</h2>
  <p class="help-lead">Images, 3D models and video, Cytoscape and other tools, other views of the network, and the session.</p>
  <img class="help-shot help-shot--panel" src="${import.meta.env.BASE_URL}images/help/ui/export.png" alt="The Export panel" loading="lazy">
  <p>
    The Export panel (top menu) writes the current view and the network in the formats other tools read. It is
    five cards — <i>Image &amp; 3D</i>, <i>Cytoscape</i>, <i>Other tools</i>, <i>Visualizations</i>,
    <i>Session</i> — all folded at first; click a title to open or fold one. <i>Other tools</i>
    and <i>Visualizations</i> list one folded sub-section per tool, each with a one-line hint after its name:
    <i>GraphML &amp; MuxViz</i>, <i>NORMA</i>, <i>Flame</i>, <i>Cosmograph</i> and <i>UMAP view</i>; <i>Chord
    diagram &amp; Circos</i>, <i>Gosling.js</i>, <i>NGCircos.js</i>, <i>CircosJS</i>, <i>JBrowse 2</i>,
    <i>Heatmap &amp; matrix</i>, <i>Sankey</i> and <i>Gephi Lite &amp; STRING</i>.
    <i>Expand all</i> opens every card and sub-section, <i>Collapse all</i> folds them, and the browser remembers
    what you open.
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
  <p>
    <b>Interactive circular views</b>, four alternatives to Circos that run in a browser. All four draw the layers
    ticked in Layer selection (all if none) and the edges of the channels ticked for layouts (Layout page) and shown
    in the scene, the layers as segments of a ring sized by their node counts, the nodes in order along them and the
    node, layer and edge colours of the scene; above 3,000 edges the status line warns that the view may be slow,
    and 20,000 is the limit. Names are escaped wherever a tool shows them as HTML.
  </p>
  <ul>
    <li><b>Gosling.js</b> (<a href="https://gosling-lang.org" target="_blank">gosling-lang.org</a>): a spec of the
      grammar's circular layout — the layers as a custom assembly, a ring of nodes, their degree as bars and the
      edges as arcs within a layer and links between layers, coloured by channel, with zoom, tooltips and legends.
      <i>Gosling spec (JSON)</i> carries the data inside; <i>Open in Gosling Editor</i> hosts the node and edge
      tables on this server for one hour and opens the online editor with a spec that reads them.</li>
    <li><b>NGCircos.js</b> (NG-Circos, Cui <i>et al.</i>, 2020): <i>NGCircos page (HTML)</i> loads the library from a
      CDN and draws the layers as the genome, the nodes as coloured arcs, a histogram or heatmap ring of node degree
      or of a File → Values column, and the edges as links (one LINK module per edge colour);
      <i>NGCircos modules (JSON)</i> holds the genome, modules and settings for a page of your own.</li>
    <li><b>CircosJS</b> (D3): <i>CircosJS page (HTML)</i> draws the layers as the layout, the nodes as a coloured
      ring, the same choice of histogram or heatmap track and the edges as chords; <i>CircosJS data (JSON)</i> is
      its layout, track and chord data. Both pages need a connection for the library.</li>
    <li><b>JBrowse 2</b> (<a href="https://jbrowse.org/jb2/" target="_blank">jbrowse.org</a>): a genome browser,
      so the network stands in for a genome — each layer a reference sequence of 2 bp per node, each edge a VCF
      breakend (<code>SVTYPE=BND</code>) from the middle of one node to the other's, which the Circular View draws
      as a chord in the edge's colour; the names, channel and weight are in the record's INFO. <i>Open in JBrowse
      2</i> hosts the VCF and a config on this server for one hour and opens JBrowse Web on its Circular View;
      <i>JBrowse 2 files (zip)</i> holds the config, the VCF, the layers as FASTA with its index and a README, for
      JBrowse Web or Desktop. Characters a VCF sequence name cannot hold (spaces, <code>:</code>, brackets) become
      <code>_</code>.</li>
  </ul>
  <p>
    Tools on other sites read the hosted files only if they can reach this server: on a private network, use the
    downloads instead.
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
  <p>
    <b>Send to Cosmograph</b> opens the network in <a href="https://cosmograph.app" target="_blank">Cosmograph</a>,
    the GPU graph viewer for large networks. <i>Cosmograph links (CSV)</i> has one row per edge: <code>source</code>
    and <code>target</code> (nodes named node_layer, so the copies of a node in different layers stay apart),
    <code>weight</code>, <code>channel</code>, <code>source_layer</code> and <code>target_layer</code>.
    <i>Cosmograph nodes (CSV)</i> has one row per node: <code>id</code>, <code>label</code> (the plain name),
    <code>layer</code>, <code>color</code>, <code>size</code>, <code>cluster</code> and <code>annotations</code>
    (the shown annotation set's terms), then the File → Values columns, the node metrics applied so far and, once a
    UMAP view has been computed (below), <code>umap_x</code> and <code>umap_y</code>. <i>Open in Cosmograph</i> hosts
    both files on this server for one hour (like the Gephi Lite hand-off: served as downloads, readable by
    Cosmograph's page) and opens Cosmograph with them by link, nodes coloured, sized and labelled as here. If
    Cosmograph cannot reach this server (a private network), download the two files and drop them on cosmograph.app.
  </p>
  <p>
    <b>UMAP view</b> draws the nodes as a 2D UMAP map without moving them in the scene, with the modes, features and
    parameters of the UMAP layout (Layout page): the layers ticked in Layer selection (all if none), <i>one point per
    node copy</i> (the layers as one network) or <i>one per node name</i> (copies merged), coloured by the scene
    colours, layer, cluster or annotation term. <i>UMAP scatter</i> downloads it as SVG or PNG with a legend;
    <i>UMAP coordinates (CSV)</i> writes node_id, node, layer, umap_1, umap_2, cluster and annotation for Python, R
    or a spreadsheet; <i>UMAP in Vega Editor</i> opens an interactive scatter (zoom, tooltips) in the
    <a href="https://vega.github.io/editor/" target="_blank">Vega editor</a>, the chart travelling in the link (up to
    3,000 points). The embedding is computed once per set of options, so the downloads after the first are instant.
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
  <p class="help-lead">Open networks and sessions in Arena3D from your own code, and run analyses without the browser.</p>
  <p>
    Arena3D's server is a plain HTTPS/JSON API, open to any application: no key, and cross-origin requests are
    allowed. Interactive documentation of every endpoint — schemas, examples and a "Try it out" button — is served at
    <i>/api/docs</i> on every Arena3D server (<a href="https://www.arena3d.org/api/docs" target="_blank">www.arena3d.org/api/docs</a>);
    the OpenAPI description is at <i>/api/openapi.json</i>.
  </p>
  <p>
    Inside the app, <b>API</b> in the top bar (before Help) shows the same reference: the base URL, the version and
    the server's limits, code to copy in curl, Python, R and JavaScript, and the interactive reference, where every
    request comes with a worked example — a small two-layer gene network — that runs as it is (open an endpoint,
    <i>Try it out</i>, <i>Execute</i>). <b>GET /api/config</b> tells a script what it may send: the version, the
    limits (nodes, edges, layers, channels, upload size, seconds per computation) and the names of the layout, 3D
    layout and clustering algorithms and node metrics.
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
  <pre class="help-code">curl -X POST https://www.arena3d.org/api/open -H "Content-Type: application/json" -d @network.json</pre>
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
  ${json({ token: '…', url: 'https://www.arena3d.org/?session=…', layers: 2, nodes: 5, edges: 4, channels: [], warnings: [] })}
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
    A node that appears in two layers is the same node in both. The limits are those of uploads (10,000 edges, 20
    layers, 10 channels). From Python:
  </p>
  <pre class="help-code">import requests, webbrowser

edges = [{"source": s, "target": t, "source_layer": layer} for s, t, layer in my_edges]
r = requests.post("https://www.arena3d.org/api/open", json={"edges": edges, "directed": True})
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
      'layers[].container, container_placement, container_color, container_opacity, container_outline, container_outline_color, container_wireframe, container_glow, container_floor, floor_visible',
      'floor | none | cube | sphere | cylinder | cone | pyramid | dome | ellipsoid | torus | hexprism | geodesic | discs | cloud | bubble; inside | surface; hex | null; 0–1; booleans and hex | null',
      'The 3D container, where its nodes sit, and its look (a <code>null</code> colour follows the theme, a <code>null</code> outline colour the container); whether the floor shows.',
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
    [
      'annotationView',
      'object',
      'How the annotation groups are drawn (View → Annotations): <code>source</code> (none, cluster or annotation), <code>style</code> (hull, outline, fog, cloud, sphere, ellipsoid or box), <code>opacity</code> (0.05–1), <code>padding</code> (0.25–3), <code>pies</code> (boolean) and <code>hidden</code> (the groups whose shape is off).',
    ],
    [
      'theme',
      'object',
      'The scene theme: <code>name</code> (a theme id such as <code>light</code> or <code>okabe</code>) and <code>applied</code> (whether its colours were applied to the network or it kept its own). Optional; without it the theme matching the background is shown.',
    ],
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
    node metrics; <b>/api/network-stats</b> and <b>/api/layer-similarity</b> statistics;
    <b>/api/perturbation/knockout</b> and <b>/api/perturbation/attack</b> knockouts and robustness curves;
    <b>/api/plots</b> node metrics, distances, C(k), knn(k) and the rich-club coefficient for plotting; <b>/api/enrichment</b>
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
  <p class="help-lead">Send a network from Cytoscape to Arena3D with the Cytoscape app, and back again.</p>
  <p>
    <a href="https://apps.cytoscape.org/apps/arena3dwebapp" target="_blank">Arena3DApp</a> in the
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

<div id="Privacy_tab" class="tabcontent">
  <h2>Privacy &amp; Data</h2>
  <p class="help-lead">Free and open to all users, with no login: what happens to your data, how long anything is kept and when other services are contacted.</p>
  <h3>Free and open to all</h3>
  <p>
    Arena3D is free and open to all users. There is no login, no registration and no e-mail address to give, and
    nothing to install. The source code is open under the GNU AGPL v3 licence, so you can also run the whole
    application on your own computer (see <i>Running it yourself</i> below).
  </p>
  <h3>Your data</h3>
  <ul>
    <li><b>In your browser</b>: the networks you open, with their layouts, styles and annotations, live in the
      browser tab. Closing or reloading the tab discards them; File → Save Session writes them to a file on your
      computer.</li>
    <li><b>Processed, not stored</b>: to read a file, lay out a network, find communities or compute metrics,
      statistics, plots and perturbations, the browser sends the data to the Arena3D server, which computes the
      answer and sends it back. Nothing is written to disk and no copy is kept, so no one else can see your data.</li>
    <li><b>Links, for one hour</b>: something is stored only when you ask for a link — the files behind <i>Open in
      Gephi Lite</i>, <i>Open in Gosling Editor</i>, <i>Open in JBrowse 2</i> and <i>Cosmograph</i>, and the links a
      program gets from <i>POST /api/open</i> or <i>/api/external</i> (API page). Each is kept under a random,
      unguessable address and deleted after one hour. Anyone with the address can open it during that hour, so share
      it only with people you trust; the addresses are not listed anywhere.</li>
    <li><b>Server logs</b>: like any web server, the server logs each request — its time, the address asked for,
      the answer's status and the IP address it came from — to keep the service running and secure. The contents of
      your files are not logged.</li>
  </ul>
  <h3>No cookies, no tracking</h3>
  <p>
    Arena3D sets no cookies and uses no analytics, tracking or advertising, and the page loads nothing from other
    sites (the video tour's player comes from YouTube only when you press play, see below). The browser's local storage keeps a few interface preferences on your computer — which cards are open,
    the selection shape, whether the shortcuts list is folded — and they are never sent anywhere.
  </p>
  <h3>Other services, only when you ask</h3>
  <p>Arena3D contacts another service only when you click for it, and sends it only what that step needs:</p>
  <ul>
    <li><b>Database Importers</b>: the server sends your search (names or identifiers, organism, options) to
      STRING, IntAct, OmniPath, NDEx, Reactome or Gene Ontology (QuickGO) and builds the network from the answer;
      with <i>Connect: Directly</i>, the STRING card asks STRING from your browser.</li>
    <li><b>Enrichment</b> (Analyze → Annotations &amp; Groups): the node names of the chosen layers or groups go to
      STRING's enrichment service, through the server.</li>
    <li><b>Hand-offs</b> (Export and File): <i>Send to NORMA</i> sends the network to NORMA's server; <i>Send to
      Flame</i> and <i>Open in STRING</i> put the node names in the link they open; <i>Heatmap in Vega Editor</i>
      carries the chart in its link; <i>Open in Gephi Lite</i>, <i>Gosling Editor</i>, <i>JBrowse 2</i> and
      <i>Cosmograph</i> let that site read the files hosted here for an hour; <i>Send to Cytoscape</i> talks only to
      Cytoscape on your own computer.</li>
    <li><b>Links in the data</b>: a node's URL, and the database links in the tables, open the other site in a new
      tab.</li>
    <li><b>Video tour</b> (Home and Getting Started): the pages show a still picture of the tour; YouTube's player,
      in its privacy-enhanced mode (youtube-nocookie.com), loads only when you press play or pick a chapter, and
      YouTube's privacy policy applies from then on.</li>
  </ul>
  <p>
    Each of those sites has its own privacy policy. Downloaded NGCircos and CircosJS pages load their libraries from
    a public CDN when you open them.
  </p>
  <h3>Running it yourself</h3>
  <p class="last_p">
    For confidential data, run Arena3D on your own computer or server with Docker (the image is
    <i>pavlopouloslab/arena3dweb</i>; the README on <a href="https://github.com/Pavlopoulos-Lab/Arena3D" target="_blank" rel="noopener">GitHub</a>
    explains how): everything then stays on your machine, apart from the database imports and hand-offs you choose.
  </p>
</div>

${ABOUT_HTML}
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
  initAbout(pane)
  decorateHelp(pane)
  wireTour(pane)
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
  document.getElementById('footerPrivacy')?.addEventListener('click', (e) => {
    e.preventDefault()
    openHelpPage('Privacy_tab')
  })
}

// open one Help page from elsewhere (Home, the footer)
export function openHelpPage(tabName: string): void {
  showTab('#panel-help')
  document
    .querySelector<HTMLElement>(`#helpDiv [data-help-tab="${tabName}"]`)
    ?.click()
}
