# PLAN-ROADMAP.md — Arena3D feature roadmap (post 3.1.0)

Phased checklist for the next round of features. Rules from [AGENTS.md](AGENTS.md) apply:
one feature per commit, tick the boxes as you go, verify each feature at runtime (Playwright)
before moving on, and run build + lint + typecheck + relevant tests before every commit.

Paths are relative to `backend/app/` and `frontend/src/` unless written in full.
"New" marks a file that does not exist yet.

**Conventions every phase must keep**

- Node ids are `Node_Layer` (`NodeModel.id`); the node's own name is `NodeModel.label`.
  Cross-layer features match nodes **by `label`**.
- Scene mutations that should be undoable go through a `Command` in `commands/scene.ts`.
- New request models need the `MAX_NODES` / `MAX_EDGES` caps from `config.py` (DoS fix pattern
  in `models/layout.py`).
- New scene state that should survive reloads goes into `collectSession()` (`actions/session.ts`),
  `buildFromSession()` (`actions/network.ts`) and `services/session.py` normalisation, with a
  default so older session files still load.
- Every new user-facing option gets a Help entry (`ui/help.ts`) and a CHANGELOG line.

---

## Phase 1 — Channel-based layouts

**Already exists:** channel filtering for layouts. `ui/layouts.ts` `buildChannelList()` sends
`selected_channels`, and `services/graph.py` `filter_edges()` drops unselected channels.
Layout functions ignore weights (`services/layouts.py` docstring: matches v2).

**Status:** done on `feat/channel-weighted-layouts` (min weight 0.1, max 10).

**Goal:** let channels *shape* the layout, not just filter it.

Touches: `services/layouts.py`, `services/graph.py`, `models/layout.py`,
`ui/layouts.ts`, `api/client.ts`, `actions/layout.ts`, `tests/test_layout.py`.

- [x] `LayoutRequest.channel_weights: dict[str, float] | None` — per-channel multiplier applied
      to `scaled_weight` in `build_graph()` before `simplify(combine_edges="sum")`.
- [x] `LayoutRequest.use_weights: bool = False` — pass `weights="weight"` to the igraph layouts
      that accept it (Fruchterman-Reingold, Kamada-Kawai, DrL, Graphopt). Default `False` keeps
      v2 behaviour.
- [x] `ui/layouts.ts`: number input (0–5, default 1) next to each channel checkbox, and a
      "Use edge weights" checkbox.
- [x] Mirror the new fields in `api/client.ts` `LayoutRequest`.
- [x] Tests: a two-channel graph where boosting one channel moves its endpoints closer;
      `use_weights=False` gives identical output to today (regression).

- [ ] Follow-up: "Layout per channel" mode — one layout per channel (each channel's edges only),
      shown side by side so channels can be compared.
- Note: weights are not applied when clustering is on (the clustered layout's padding edges are
  tuned for unweighted v2 output); the UI says so.

Done when: changing a channel weight visibly changes the layout and the result is one undo step.

---

## Phase 2 — Node alignment across layers (coupled layout)

**Status:** done (scope `coupled`; "Align to layer…" left as a follow-up). Implemented as
`merge_by_label(edges)` — edges carry `source_node`/`target_node` labels, so nodes are not needed.

**Goal:** a node with the same `label` sits at the same in-plane position in every layer.

Touches: `models/layout.py`, `services/layouts.py`, `services/graph.py`, `ui/layouts.ts`,
`actions/layout.ts` (`normalizeLayoutPositions`), `commands/scene.ts`, `tests/test_layout.py`,
`actions/layout.test.ts`, new `frontend/e2e/coupled-layout.spec.ts`.

- [x] New scope `"coupled"` on `Scope` (models/layout.py and models/topology.py share the type —
      reject `"coupled"` in topology for now).
- [x] `services/graph.py` `merge_by_label(edges, nodes)` → one graph whose vertices are labels;
      inter-layer edges between two copies of the same label are dropped, all other edges are
      collapsed onto label pairs (weights summed).
- [x] `compute_layout`: for `"coupled"`, lay out the merged graph once and copy each label's
      coordinate to every `Node_Layer` id carrying that label in the selected layers.
- [x] `normalizeLayoutPositions` currently uses one global min/max — fine for coupled, but check
      that per-layer `getScale()` differences do not break the alignment; if they do, normalise
      before scaling.
- [ ] Optional "Align to layer…" action: copy positions of one reference layer to the others
      (pure frontend, new `AlignLayersCommand` in `commands/scene.ts`).
- [x] UI: add "Coupled (align nodes across layers)" to the scope selector in `ui/layouts.ts`.
- [x] Tests: same label in 3 layers → identical `[y, z]`; labels unique to one layer still placed.

Done when: in `figure2A_data.tsv` (Help → Examples) shared nodes line up through the stack.

---

## Phase 2b — Pseudo-alignment (fewer inter-layer crossovers)

**Status:** done (2026-10-15). `services/alignment.py`.

- [x] Soft alignment: blend per-layer layouts with the coupled layout by a strength 0–1.
- [x] Anchor to a reference layer: FR seeded at counterparts' positions (same label or inter-layer
      partners); strength 1 pins, lower strengths pull anchored nodes by that fraction.
- [x] Chain: each layer anchored to the previous one (time series, long stacks).
- [x] Misalignment score for every multi-layer layout (mean in-plane stretch of cross-layer links,
      % of layout diagonal), shown in the Layouts panel.
- [ ] Follow-up: an "auto" mode that searches reference layer / layer order for the lowest score
      at a fixed strength; true crossing counts between consecutive layers.

---

## Phase 3 — STRING import with evidence types as channels

**Status:** done. Implemented in `services/databases.py` / `routers/databases.py` /
`ui/databases.ts` with stdlib `urllib` (no new dependency); STRING gene names are used as labels.
Per-database mode covers STRING, IntAct and OmniPath — **Reactome is not included** (its API is
pathway-centred and needs a multi-call crawl; follow-up). "Only among the typed proteins" is on by
default because IntAct/OmniPath otherwise return every partner.

**Goal:** fetch a STRING network for a list of identifiers and map each evidence score
(experiments, database, textmining, coexpression, neighborhood, fusion, cooccurrence) to a
channel. `MAX_CHANNELS = 9` fits all seven.

Touches: new `routers/string_db.py`, new `services/string_db.py`, `models/network.py`
(request model), `main.py` (register router), `config.py` (STRING base URL, timeout,
default score cut-off), `backend/pyproject.toml` (an HTTP client in the main deps — today `httpx2` is dev-only, used
by the test client),
`ui/file.ts`, `api/client.ts`, `actions/network.ts` (`loadNetwork` reused as-is),
new `tests/test_string_db.py`.

- [x] Request: `identifiers: list[str]`, `species: int` (NCBI taxon), `required_score`,
      `channels: list[str]`, optional `layer_by` (single layer, or one layer per evidence type).
- [x] Service calls STRING `/api/json/network`, explodes each interaction into one edge per
      evidence channel whose sub-score > 0, `Weight` = sub-score, and returns a `NetworkModel`
      through the same path as `parser.parse_network_tsv` (re-use `_build_nodes/_build_edges`
      by building a DataFrame).
- [x] Enforce `MAX_EDGES` after explosion; return a clear 400 if exceeded.
- [x] Timeouts and upstream errors → 502 with a readable message.
- [x] `ui/file.ts`: "Import from STRING" card (textarea, species select with common taxa,
      score slider, channel checkboxes).
- [x] Tests: mock the HTTP call (no network in CI); check channel explosion and the edge cap.

Done when: pasting `TP53 MDM2 CDKN1A ATM` for human loads a network coloured by evidence type.

**Additions (2026-10-14):**
- [x] Port NORMA's importers instead of starting from scratch: NORMA already has relays for
      STRING, IntAct, Reactome, OmniPath, NDEx and Gene Ontology (`~/Documents/GitHub/NORMA`).
- [x] "One database per layer" mode: for one gene list, fetch STRING, IntAct and Reactome, put
      each in its own layer, and add inter-layer edges between copies of the same protein.

---

## Phase 4 — More 3D layer arrangements

**Status:** done. Arrangements were already undoable (`PredefinedLayoutCommand`) and layer transforms
already persist in sessions, so the work was the new arrangements plus the NORMA additions
(split/merge live in `actions/restructure.ts`, merge also covers Phase 16).

**Already exists:** `actions/layout.ts` `applyPredefinedLayout()` with `parallel`, `zigZag`,
`starLike`, `cube` (not undoable, not saved in sessions).

Touches: `actions/layout.ts`, `actions/layer.ts`, `commands/scene.ts`, `ui/layouts.ts`,
`actions/session.ts`, `actions/network.ts`, `services/session.py`, `actions/layout.test.ts`.

- [x] New arrangements: `helix` (layers rotate around x as they spread), `sphere` (layers
      tangent to a sphere), `grid` (2D tile of layers, for many layers ≤ `MAX_LAYERS = 18`).
- [x] Wrap arrangements in an `ApplyArrangementCommand` that snapshots every
      `layer.plane` position + quaternion, so they become undoable.
- [x] Persist the active arrangement (or raw per-layer transforms) in the session so a shared
      `?session=` link reopens the same view.
- [x] Tests: each arrangement then undo restores exact transforms.

**Additions (2026-10-14) — NORMA-style 3D ideas that carry over:**
- [x] Split a layer by cluster: run Louvain on one layer, each community becomes its own layer
      (`actions/network.ts` rebuild path; reverse of Phase 16 "merge layers").
- [x] Place layers by connectivity: force layout where each layer is one point and inter-layer
      edge counts are the weights, so tightly linked layers sit next to each other.
- [x] Height by metric: optional offset of each node off its layer plane by degree/centrality
      (`three/Node.ts` position along the plane normal).

---

## Phase 5 — Multilayer analytics

**Status:** done. Multilayer metrics plug into `/api/topology` (so scaling + View Data work
unchanged); colouring is `ColorNodesByValueCommand`; similarity is `POST /api/layer-similarity`;
"Leiden" is igraph Leiden on one graph and leidenalg multiplex with the coupled scope.

### 5a. Multilayer metrics

Touches: `services/topology.py`, `models/topology.py`, `ui/layouts.ts` (topology controls),
`ui/data.ts` (View Data table columns), `api/client.ts`, `tests/test_topology.py`.

- [x] Metrics keyed by `label`, written back to every `Node_Layer` copy:
  - [x] Multiplex degree (sum of degrees across layers).
  - [x] Participation coefficient `P = (L/(L-1)) * (1 - Σ (k_l / K)^2)`.
  - [x] Multilayer PageRank / versatility — start with PageRank on the supra-adjacency
        graph (copies of a label joined by inter-layer coupling edges of weight `omega`).
- [x] Option to colour nodes by a metric (continuous palette) — new branch in
      `actions/node.ts` `repaintNode()` colour priority.

- [x] Layer similarity heatmap: node and edge overlap (Jaccard) between every pair of layers,
      shown in `ui/data.ts`.

### 5b. Multilayer community detection

Touches: `services/clustering.py`, `models/layout.py` (`ClusteringOptions`),
`backend/pyproject.toml` (add `leidenalg`), `ui/layouts.ts`, `tests/test_cluster.py`.

- [x] `leidenalg.find_partition_multiplex` on one igraph per layer over the shared label set.
- [x] Return cluster ids per `Node_Layer`; reuse the existing clustered-layout path.
- [x] Confirm `leidenalg` wheels exist for the Docker base image (`Dockerfile`).

---

## Phase 6 — Annotation overlays and enrichment

**Status:** done. Hulls/pies live in `actions/annotations.ts` (not a `three/Hull.ts` class); pies
are canvas-texture sprites; enrichment uses STRING only (it returns the genes per term, which
g:Profiler does not without extra mapping) — g:Profiler is a possible follow-up.

Touches: new `three/Hull.ts`, `actions/node.ts`, `three/Node.ts`, `ui/node.ts`,
`services/attributes.py` (multi-annotation column), new `routers/enrichment.py`,
new `services/enrichment.py`, `config.py`, `api/client.ts`, `commands/scene.ts`.

- [x] Translucent convex hull per cluster / group, per layer (2D hull in the layer plane,
      `THREE.ShapeGeometry`); toggle in the Node panel; colours from the cluster palette.
- [x] Pie-chart nodes: node attribute file accepts several annotations per node
      (`;`-separated); render as a sprite/canvas texture or segmented disc.
- [x] Enrichment endpoint: proxy to g:Profiler (`/api/gost/profile`) and STRING enrichment;
      input = selected node labels or a cluster id; returns top terms with p-values.
- [x] Results table in a new tab of the Node panel; clicking a term highlights its genes.
- [x] Tests: hull of collinear points, enrichment service with mocked HTTP.

---

## Phase 7 — Exploration tools

**Status:** done, all client-side in `actions/explore.ts` (no `routers/paths.py` needed). The
attribute filter selects matches rather than hiding the rest; paths are unweighted BFS.

Touches: `actions/node.ts` (`selectNodesByName`), `ui/node.ts`, `ui/edge.ts`,
`three/Edge.ts`, `three/runtime.ts` (`channelVisibility`), new `routers/paths.py` (or
frontend-only BFS), `commands/scene.ts`.

- [x] Search + expand: after `selectNodesByName`, "Expand 1 hop / 2 hops", with
      "within layer" vs "across layers" toggle (frontend BFS on `ctx` edges).
- [x] Shortest path between two selected nodes, allowed to hop layers; highlight the path
      edges and dim the rest.
- [x] Weight-threshold slider in the Edge panel: hide edges with `scaled_weight` below it.
- Per-channel visibility toggles already exist (`ui/edge.ts` → `actions/edge.ts`
  `setChannelVisibility`); nothing to do beyond making the threshold respect them.

**Additions (2026-10-14):**
- [x] Filter by node/edge attribute (not only weight).
- [x] Cytoscape-style navigation — see Phase 15.

---

## Phase 8 — Import / export formats

**Status:** done. GraphML/GML parsed in Python (`services/formats.py`) — igraph's readers abort
the process on errors off the main thread. MuxViz export is a zip (edges, layers, layout, config).
The rotation recording is WebM (MediaRecorder); GIF was not added (needs an encoder library).

Touches: `services/parser.py`, `routers/network.py`, `ui/file.ts` (`accept=` list),
`actions/screen.ts` (`exportSceneImage`), new `actions/export.ts`, `tests/test_network.py`.

Import:
- [x] GraphML and GML via igraph `Graph.Read_GraphML` / `Read_GML`; map a `layer` vertex
      attribute (or default single layer like the 2-column path).
- [x] SIF (`node rel node…`; `rel` → channel).
- [x] Cytoscape CX2 JSON, and NDEx by UUID (fetches CX2 from the public NDEx API).

Export:
- [x] glTF/GLB via `three/examples/jsm/exporters/GLTFExporter.js`.
- [x] High-DPI PNG (scale factor option on the existing export) and SVG (2D projection).
- [x] Camera fly-through video with `MediaRecorder` on the canvas stream (WebM).

**Additions (2026-10-14):**
- [x] MuxViz-style multilayer edge list export, GraphML export, Cytoscape CX/NDEx export.
- [x] GIF/video of the auto-rotation.

---

## Phase 9 — Scaling past 10k edges

Touches: `three/Node.ts`, `three/Edge.ts`, `three/Scene.ts`, `actions/node.ts`,
`actions/labels.ts`, `config.py` (`MAX_EDGES`, `MAX_NODES`), new `workers/`.

- [ ] Benchmark first: FPS (`ui/fps.ts`) at 5k / 10k / 20k / 50k edges, record in this file.
- [ ] Nodes: one `THREE.InstancedMesh` per layer instead of a `Mesh` per node; raycasting by
      `instanceId`; per-instance colour.
- [ ] Edges: batch straight intra-layer edges into one `LineSegments2`; keep curved channel
      edges as-is.
- [ ] Labels: level-of-detail (show only for selected / high-degree / near-camera nodes).
- [ ] Optional: client-side force layout in a Web Worker for big graphs.
- [ ] Raise `ARENA_MAX_EDGES` default only after the benchmark passes.

---

## Phase 10 — Temporal / condition layers

Touches: `ui/layer.ts`, `actions/layer.ts`, `three/Layer.ts`, new `actions/timeline.ts`.

- [ ] Mark layers as an ordered series (layer order = time).
- [ ] Slider / play button that shows one layer at a time, tweening node positions and
      colours between consecutive layers (match by `label`; uses Phase 2 alignment).

---

## Phase 11 — WebXR / VR mode

Touches: `actions/screen.ts` (`setRenderer`, `animate`), `ui/scene.ts`, `main.ts`.

- [ ] `renderer.xr.enabled = true`, `VRButton` from three examples; switch the loop to
      `renderer.setAnimationLoop`.
- [ ] Check the orthographic camera: XR needs a perspective camera — add a perspective camera
      used only in XR sessions.
- [ ] Controller ray selection of nodes (reuse `raycaster()`).

---

## Phase 12 — Python and R client packages

Touches: new top-level `clients/python/` and `clients/r/`; backend unchanged
(`routers/external.py` `POST /api/external` already returns a token URL).

- [ ] Python `arena3d.show(G, layer_attr="layer", channel_attr="channel")` accepting networkx
      or igraph; builds the session JSON, posts to `/api/external`, opens the browser
      (or an IFrame in Jupyter).
- [ ] R `arena3d::show(g)` for igraph with the same contract.
- [ ] Document the session JSON schema the clients emit (derive from `services/session.py`).
- [ ] Publish to PyPI / CRAN later; start with install-from-GitHub.

**Additions (2026-10-14):**
- [x] NORMA ↔ Arena3D round trip (2026-10-15): File → Send to NORMA posts the whole network with
      each layer as an annotation group (a single selected layer can be sent after Merge/Split).
- [x] `POST /api/open` (2026-10-15): edges or TSV text in, laid-out session behind a link out, so
      clients need no knowledge of the session format; API docs at `/api/docs`; CORS on.
- [ ] Python client modelled on NORMA's `norma_api_client.py`.

- [x] Export to NORMA via its API (2026-10-15): layers → annotation groups, `/api/external`, `#json`
      link, payload download (`actions/norma.ts`). Verified live against a local NORMA server.

---

## Phase 13 — Single-layer networks

**Status:** done. 3D algorithms: Fruchterman-Reingold, Kamada-Kawai, DrL, Random, Grid; node
depth is normalised into the same [-t, t] range as the plane.

When a network has one layer (e.g. the 2-column edgelist upload), the floor and the
layer machinery get in the way.

Touches: `three/Layer.ts` (`createPlane`), `actions/layer.ts`, `actions/network.ts`
(`buildNetwork`), `services/layouts.py`, `models/layout.py`, `actions/layout.ts`
(`normalizeLayoutPositions`), `commands/scene.ts`, `ui/layouts.ts`.

- [x] Hide the layer floor (plane + wireframe + layer label) by default when there is only one
      layer; keep a toggle in the Layer panel to bring it back.
- [x] 3D layouts for one layer: igraph supports `dim=3` for Fruchterman-Reingold, Kamada-Kawai,
      DrL, Random, Grid and Sphere. Add `LayoutRequest.dimensions: 2 | 3`, return `[x, y, z]`,
      and let nodes leave the plane (x is fixed by the layer today — `LayoutResponse` comment).
- [x] Only offer 3D layouts when exactly one layer is selected; returning to 2D re-flattens.
- [x] Session: store the third coordinate (nodes already save x/y/z positions — verify).

## Phase 26 — NORMA-2.0 group layouts

**Status:** done (2026-10-15). `services/group_layouts.py` (ported from NORMA: virtual node, group
gravity, super nodes, local layouts in discs/balls, overlap resolution) + `actions/group_layout.ts`
(groups = clusters / annotations / layers; layers as groups place and angle the floors).

## Phase 14a — Menu reorganisation

**Status:** done (2026-10-15). Grouped navbar (View / File / Layout / Edit / Analyze / Help) with
Bootstrap dropdown tab items; new `ui/analyze.ts` panel; ☰ menu auto-closes on narrow screens.

## Phase 14 — Mobile-friendly

**Status:** done (2026-10-15). `actions/touch_controls.ts` replays one-finger orbit and double tap as the
mouse events the canvas already handles; pinch is applied directly (one undo step).

Today the canvas listens for mouse and wheel events only (`actions/canvas_controls.ts`
`mousedown` / `wheel`), and `src/style.css` has no responsive rules.

Touches: `actions/canvas_controls.ts`, `actions/drag_controls.ts`, `actions/nav_controls.ts`,
`ui/drawer_toggle.ts`, `ui/tabs.ts`, `src/style.css`, `index.html`, `main.ts`.

- [x] Switch canvas handlers to Pointer Events; add touch gestures: one-finger rotate, two-finger
      pinch-zoom and pan, long-press for the right-click menu.
- [x] Responsive panels: drawer becomes a bottom sheet under ~768px; navbar collapses.
- [x] Larger hit targets for node selection on touch (raycaster threshold by pointer type).
- [x] Lower default render cost on mobile (bloom off, lower pixel ratio).
- [x] Playwright mobile project (`devices['Pixel 7']`, `devices['iPhone 14']`) in
      `playwright.config.ts`.

## Phase 15 — Cytoscape-like navigation

Today navigation is the v2 button table (`actions/nav_controls.ts`) plus wheel zoom and drag
(`actions/canvas_controls.ts`).

- [ ] Left-drag on empty space pans; scroll zooms toward the cursor; right-drag (or
      Shift+drag) rotates — matching Cytoscape/Cytoscape.js habits.
- [ ] Box (rubber-band) selection with Shift/Ctrl+drag; click empty space to deselect.
- [ ] "Fit" (zoom to network) and "Fit selection" buttons and keyboard shortcuts.
- [ ] Keep the old v2 controls behind a setting for existing users.

## Phase 16 — Merge layers

- [x] Flatten selected layers into one (nodes matched by label, edges unioned, channels kept);
      reverse of Phase 4 "split a layer by cluster". Undoable.

## Phase 17 — Cross-software exchange (Obsidian, graphify, others)

Needs scoping first: confirm which "graphify" tool is meant and what each side should send.

- [ ] Obsidian export: one Markdown note per node with `[[links]]` to neighbours, layer and
      channel as tags/front-matter, so the vault's graph view shows the network.
- [ ] Obsidian import: read a vault folder (or its `.obsidian` graph) — notes as nodes, wiki-links
      as edges, folders or tags as layers.
- [ ] graphify: import its graph JSON output (nodes/edges with communities → layers).
- [ ] Generic: document the session JSON + `POST /api/external` as the integration point, and
      add GraphML/JSON-graph import (Phase 8) so most tools are covered by one format.

## Phase 18 — Round (disk) floors

- [x] Layer Actions: floor shape Square / Disk, for the selected layers (or all when none selected).
- [x] Disk = `CircleGeometry` in the same plane; width/scale/colour/opacity/wireframe keep working;
      shape saved in sessions (`floor_shape`, default square).

## Phase 19 — 3D network without layers

- [x] "3D network" mode: all nodes in one space (no floors, no layer planes), 3D force layouts
      (FR/KK/DrL 3D) on the whole network; layer becomes just a node attribute (colour).
- [x] Switch back restores the layered view. Saved in sessions.

## Phase 20 — Layers as 3D containers (cubes, spheres, clouds)

- [x] Per layer, choose Floor / Cube / Sphere / Cloud: nodes are laid out in 3D *inside* the
      container (local 3D layouts per layer, like the 2D per-layer layouts).
- [x] Cube/sphere drawn as translucent wireframe volumes; cloud = no volume, just a soft halo.
- [x] Layer arrangements (Phase 4) and coupled layouts work with containers.

## Phase 21 — Topological analysis

- [x] Per layer and whole-network stats: nodes, edges, density, components, diameter, average
      path length, average clustering, assortativity, degree distribution.
- [x] More node metrics: closeness, eigenvector, PageRank, k-core, eccentricity.
- [x] Shown in View Data (table + degree-distribution chart); CSV download.

## Phase 22 — Loading feedback and format checks

- [x] Progress bar while a file uploads/parses and while the scene builds.
- [x] Check the file before sending (size, extension, header/columns for TSV) and show a clear
      message with the line/column at fault; backend errors shown as readable messages.

## Phase 23 — Node search (NORMA-style)

- [x] Search box with modes: contains, exact, prefix, suffix, regular expression.
- [x] Results list; "focus" moves/zooms the camera onto the node (or fits all matches).

## Phase 24 — Rich editing

- [x] Per node / per selection: colour, size, shape, label; per edge / selection: colour, width.
- [x] Colour palettes (categorical + sequential) applied by layer, cluster, channel or attribute.
- [x] Node shapes per selection (sphere, cube, cone, …); everything undoable and saved in sessions.

- [x] Colour-blind support (added 2026-10-15): Okabe–Ito and cividis palettes, a colour-blind
      friendly mode (palette + shape per layer as a second cue) and a CVD simulation preview.
      Palettes were checked with the dataviz validator against the scene backgrounds.

## Phase 25 — Help pages

- [x] Full pass over Help (2026-10-15): one page per menu panel, every option documented; the v2
      panel screenshots were removed rather than refreshed (the text follows the live labels), and
      "What's new" lives in CHANGELOG.md / the README.

## Convex hulls

Already planned in Phase 6 (translucent hull per cluster/group, per layer).

---

## Suggested order

**Update (2026-10-14):** phases 1–8, 13 and 16 are done. Next, the newest requests first:
18 → 22 → 23 → 21 → 19 → 20 → 24, then 9, 14 + 15, 10, 11, 12, 17, and 25 (Help) last.

1 (done) → 2 → 13 → 3 → 4 → 5, as in the original list, with Phase 13 moved up because
single-layer uploads are common and it is small. Phase 14 (mobile) and 15 (navigation) touch the
same input handlers, so do them together. Phase 7 (threshold slider, hop expansion) is cheap
and can slot in any time. Phase 9 should land before anything that makes graphs bigger by
default (STRING import with a high node count, NDEx import).
