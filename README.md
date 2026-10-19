<!-- Badges -->

[![Docker Pulls](https://img.shields.io/docker/pulls/pavlopouloslab/arena3dweb.svg)](https://hub.docker.com/r/pavlopouloslab/arena3dweb)
[![Live Demo](https://img.shields.io/badge/demo-online-brightgreen)](https://www.arena3d.org)
[![GitHub Repo](https://img.shields.io/badge/GitHub-PavlopoulosLab%2FArena3D-blue)](https://github.com/pavlopoulos-lab/arena3d)

# Arena3D

> Interactive 3D visualization of multilayered networks.

---

## 📖 Table of Contents

1. [Overview](#-overview)
2. [What's New in Arena3D 3.0](#-whats-new-in-arena3d-30)
3. [Key Features](#-key-features)
4. [Getting Started](#-getting-started)
   - [Online Demo](#online-demo)
   - [Local Installation](#local-installation)
5. [Example Data](#-example-data)
6. [Usage](#-usage)
7. [REST API](#-rest-api)
8. [Development & Testing](#-development--testing)
9. [Citing Arena3D](#-citing-arena3d)
10. [License](#-license)

---

## 📝 Overview

Arena3D is a web application for visualizing and analysing multilayered networks in 3D space. Each layer is a floor (square, disk, cube, sphere or fog cloud), nodes can appear in several layers, and intra- and inter-layer edges can carry weights, directions and multiple information channels.

It pairs a **FastAPI** backend (Python + python-igraph and leidenalg for layouts, clustering, alignment and topology) with a **Vite / TypeScript / Three.js** frontend. It runs in any modern browser, on desktops, tablets and phones.

---

## ✨ What's New in Arena3D 3.0

Arena3D 3.0 is a full rewrite of Arena3D<sup>web</sup> (R/Shiny) and adds:

- **Cross-layer alignment**: lay out several layers at once so copies of a node line up (_coupled_), or trade alignment against each layer's own structure (_soft_, _anchor to a reference layer_, _chain_). Every multi-layer layout reports a misalignment score.
- **NORMA-2.0 group layouts**: virtual node, group gravity and super-node layouts on clusters, annotations or the layers themselves, with a local layout inside each group.
- **3D layers and 3D networks**: floors as squares or disks; layers as cubes, spheres or fog clouds with 3D layouts inside, each with its own colour and opacity; a _Single network_ mode (top bar) that treats the data as one graph.
- **Edge bundling**: force-directed bundling of intra- and inter-layer edges, each with its own strength, or of the whole graph in Single network mode, to untangle dense views.
- **Weighted and multi-channel layouts**: edge weights and per-channel weights drive force-directed layouts.
- **Multilayer analytics**: multiplex degree, participation coefficient, multilayer PageRank, multiplex Leiden clustering, layer similarity heatmaps with UpSet plots, and network statistics (density, components, diameter, path length, clustering, assortativity, degree distribution), on an undirected, directed or multi-edged graph; every report in sortable tables.
- **Live database import**: a Database Importers panel with one expandable, colour-coded card per source, as in NORMA — STRING (evidence types as channels), Reactome pathways and Gene Ontology terms as layers, IntAct, OmniPath, NDEx and a STRING · IntAct · OmniPath comparison; a fetched network can replace the loaded one, join it as new layers with copies of a node linked across layers, or load as a single 3D network.
- **Export and hand-offs**: an Export panel with high-resolution PNG, SVG, GLB (3D) and WebM video; Cytoscape (_Send to Cytoscape_ through cyREST, CX2, Cytoscape.js JSON, SIF + tables), GraphML, MuxViz and sessions; chord diagrams, adjacency heatmaps, Sankey diagrams (SVG, SankeyMATIC, Plotly) and Circos input files; one click to an interactive heatmap in the Vega editor, the network in Gephi Lite (hosted by `/api/share`), the proteins on STRING, the gene lists of the layers in [Flame](https://flame.pavlopouloslab.info) for functional enrichment, or [NORMA](https://normaviz.org) with each layer as an annotation group.
- **Exploration**: a Find panel for nodes and edges (exact, contains, prefix, suffix, regular expression; edges by either end, source, target, both or channel) with camera focus; unlimited zoom with a double-click to fit the network; neighbourhood expansion; shortest paths across layers; weight-threshold filtering.
- **Groups, the NORMA way**: a group list with colours, counts, per-group hulls and selection; NORMA-format group files; pie-chart nodes, convex hulls or fog clouds; a super-node view; group overlap tables; STRING functional enrichment of selected nodes.
- **Node values and a legend**: upload expression or score tables and colour nodes by any column; an on-canvas legend for layers, groups, metrics and values.
- **Rich styling and accessibility**: fourteen node shapes, per node or per layer; floors as solid planes, wireframes, grids, dotted grids or outlines; axes drawn as coordinate systems; palettes including Okabe–Ito and cividis; ten scene themes with contrasting container colours; a colour-blind-friendly mode and a colour-vision-deficiency preview; a Performance panel (resolution, detail, presets, live stats).
- **Phones and tablets**: touch gestures (orbit, pinch, pan, double-tap, long-press) and bottom-sheet panels.
- **Layout per network mode**: in Single network mode the Layout panel works the NORMA way (one graph, clustering, groups drawn as fog clouds or hulls); layer arrangements (parallel, zig-zag, star, cube, helix, sphere, grid, circle, chord diagram, stack, fan, by links); impossible layout/clustering combinations are disabled with a note; communities can be found as a step of their own and reused as annotations.
- **Several networks at once**: every load is kept in a list, switching restores each network as left, two networks can be compared; annotation sets per network; NORMA-style group statistics; label styles per layer.
- **Menus grouped by task, each with its own colour**: Home · File · Database Importers · View · Find · Layer selection · Layout · Edit · Analyze · Export · Help; the Export panel folds into cards and the Edit panels have titled sections; Help pages open with screenshots of their panels.

See [CHANGELOG.md](CHANGELOG.md) for full details.

---

## 🚀 Key Features

- **Multilayer integration**: load and combine network layers with cross-layer edges, from TSV files, standard formats, sessions or public databases.
- **3D interactivity**: translate, rotate and scale the scene or individual layers; arrange layers in parallel, helix, sphere, grid or by inter-layer links.
- **Layouts and clustering**: force-directed, circular, grid, tree and other layouts in 2D and 3D, per layer, across layers or aligned; Louvain, Walktrap, fast greedy, label propagation and Leiden clustering.
- **Styling**: colour by layer, cluster, annotation, degree or any metric; shape, size and edge-width controls; themes.
- **Graph support**: weighted/unweighted, directed/undirected, multi-channel graphs; up to 10,000 edges online, more locally.
- **Undo/redo**: every scene change can be undone.
- **Sessions**: save and reload complete scenes as JSON.

---

## 🛠 Getting Started

### Online Demo

Access the live app at: [https://www.arena3d.org](https://www.arena3d.org)

### Local Installation

#### Docker (Recommended)

```bash
git clone https://github.com/pavlopoulos-lab/arena3d.git
cd Arena3D
docker-compose up          # builds + runs backend (8000) and frontend (5173)
```

For a single production image (nginx serving the built frontend + Uvicorn):

```bash
docker build -t arena3d .
docker run -p 8080:8080 arena3d   # http://localhost:8080
```

#### From Source

**Backend** (Python, managed with [`uv`](https://docs.astral.sh/uv/)):

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload   # http://localhost:8000
```

**Frontend** (Node + npm):

```bash
cd frontend
npm install
npm run dev                            # http://localhost:5173 (/api proxied to :8000)
```

---

## 📂 Example Data

Bundled networks in [`frontend/public/data/`](frontend/public/data) (also listed under Help → Examples):

| File                    | Content                                                                |
| ----------------------- | ---------------------------------------------------------------------- |
| `figure2A_data.tsv`     | Four-layer weighted network (the **Load Example** button)              |
| `covid19_data.tsv`      | SARS-CoV-2 host–virus interactions with drugs, processes and complexes |
| `GPCRs_data.tsv`        | GPCRs, G proteins, GRKs and effectors                                  |
| `aspirin_3channels.tsv` | Drug–protein network with three weighted channels                      |
| `prego.tsv`             | PREGO organism–environment–process associations                        |
| `edgelist_2columns.tsv` | Minimal two-column edge list (one layer)                               |

Node and edge attribute files and saved sessions (`*_export.json`) sit next to them.

---

## 💻 Usage

1. **Load** a network: File → upload a file or open a session; Database Importers → import from STRING, IntAct, OmniPath or NDEx; or pick an example on the Home page.
2. **Lay out** the layers: Layout → choose the layers, an algorithm and what to apply it to (per layer, across layers, selected nodes, aligned), then optionally alignment or a group layout. Edge bundling is under Edit → Edges.
3. **Explore**: search nodes, expand neighbourhoods, find shortest paths, filter by weight.
4. **Analyse**: Analyze → node metrics, network statistics, layer comparison, enrichment.
5. **Style**: Edit → nodes, edges, layers and palettes; switch on the colour-blind-friendly mode.
6. **Export**: session JSON, GraphML, CX2, MuxViz, SVG, GLB, PNG, video, or send to NORMA.

On touch screens, drag with one finger to orbit, pinch to zoom, drag with two fingers to pan, double-tap to select and long-press a node for its menu.

---

## 🔌 REST API

Every Arena3D server documents its API at `/api/docs` (OpenAPI at `/api/openapi.json`); no key is needed and cross-origin requests are allowed.

**Open a network from any tool** — `POST /api/open` takes a list of edges (or the text of an Arena3D TSV file), lays it out on the server and returns a link that opens it in Arena3D:

```bash
curl -X POST https://www.arena3d.org/api/open -H "Content-Type: application/json" \
  -d '{"edges": [{"source": "TP53", "target": "MDM2", "source_layer": "PPI"},
                 {"source": "TP53", "target": "BAX", "source_layer": "Regulation"},
                 {"source": "TP53", "target": "TP53", "source_layer": "PPI", "target_layer": "Regulation"}],
       "layout": "Fruchterman-Reingold"}'
```

Other endpoints:

| Endpoint                                                               | Purpose                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `POST /api/external`, `GET /api/external/{token}`                      | Hand off a complete session (positions, colours) and resolve a link |
| `POST /api/network`                                                    | Parse TSV, GraphML, GML, SIF or CX2 into nodes, edges and layers    |
| `POST /api/layout`                                                     | Layouts, clustering, cross-layer alignment and group layouts        |
| `POST /api/topology`, `/api/network-stats`, `/api/layer-similarity`    | Node metrics, network statistics, layer overlap                     |
| `POST /api/enrichment`                                                 | STRING functional enrichment                                        |
| `POST /api/import/string`, `/api/import/databases`, `/api/import/ndex` | Database import                                                     |
| `GET /api/config`                                                      | Server limits and defaults                                          |

Links returned by `/api/open` and `/api/external` are valid for one hour; set `ARENA_PUBLIC_URL` (e.g. `https://www.arena3d.org`) so they carry the public host.

--- | --- |
| `POST /api/layout` | Layouts, clustering, alignment and group layouts |
| `POST /api/network-stats` | Per-layer and whole-network statistics |
| `POST /api/layer-similarity` | Node and edge overlap between layers |
| `POST /api/enrichment` | STRING functional enrichment |
| `POST /api/import/string`, `/api/import/databases`, `/api/import/ndex` | Database import |

External applications can also open a network in Arena3D directly through the API.

---

## 🧪 Development & Testing

```bash
# backend
cd backend
uv run ruff check . && uv run mypy app && uv run pytest

# frontend
cd frontend
npm run lint && npx tsc --noEmit && npm test -- --run
npx playwright install chromium     # first time only
npm run test:e2e                    # desktop, phone and tablet projects
npm run help:shots                  # refresh the Help screenshots (frontend/public/images/help/ui)
```

See [AGENTS.md](AGENTS.md) for contribution conventions and [PLAN-ROADMAP.md](PLAN-ROADMAP.md) for the roadmap.

---

## 📚 Citing Arena3D

The following publications refer to Arena3D under its former name, Arena3Dweb.

- **Arena3D<sup>web</sup>: interactive 3D visualization of multilayered networks**  
  Karatzas E., Baltoumas F.A., Panayiotou N.A., Schneider R., Pavlopoulos G.A.  
  _Nucleic Acids Research_, 2021;49(W1):W36-W45.  
  doi: [10.1093/nar/gkab278](https://doi.org/10.1093/nar/gkab278)

- **Arena3D<sup>web</sup>: interactive 3D visualization of multilayered networks supporting multiple directional information channels, clustering analysis and application integration**  
  Kokoli M., Karatzas E., Baltoumas F.A., Schneider R., Pafilis E., Paragkamian S., Doncheva N.T., Jensen L.J., Pavlopoulos G.A.  
  _NAR Genomics and Bioinformatics_, 2023;5(2):lqad053.  
  doi: [10.1093/nargab/lqad053](https://doi.org/10.1093/nargab/lqad053)

---

## 📄 License

This project is released under the **GNU Affero General Public License v3.0**. See [LICENSE](LICENSE) for details.
