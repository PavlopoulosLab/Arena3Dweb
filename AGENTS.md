# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Arena3D is a web application for interactive 3D visualization of multilayered networks: **FastAPI backend** (Python, `uv`) + **Vite / TypeScript / Three.js frontend** (npm).

The app was migrated from R/Shiny to this stack. All R/Shiny source is gone; the migration history lives in:
- **`SPEC.md`** — architecture decisions, chosen stack, design patterns, API contract, and rationale.
- **`PLAN.md`** — phased implementation checklist (essentially complete).
- **`MIGRATION.md`** — old R/Shiny file → new equivalent map (all rows done).

## Rules for Agents

- **Never push to remote.** Commit only when explicitly asked, one commit per feature.
- **Always use the `token-saviour` skill** — and the tools/skills it routes to across its layers — wherever it makes sense.
- **When a plan is active** (e.g. a `PLAN*.md` file): one feature per commit, tick the checkboxes as you go, and verify each feature at runtime before moving to the next.
- **Before every commit**: run the build, lint, typecheck, and the relevant test suite (see commands below). Verify UI/UX changes at runtime with Playwright.
- **Keep responses concise** — summarize rather than dumping full files, to stay within output token limits.

## Running the App

**Backend** (package management via `uv` — no manual venv/pip):
```bash
cd backend
uv sync                                  # installs deps + dev group into .venv
uv run uvicorn app.main:app --reload     # http://localhost:8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev                     # http://localhost:5173 — /api proxied to localhost:8000
```

**Both together (Docker):**
```bash
docker-compose up
```

**Backend tests:**
```bash
cd backend && uv run pytest
```

**Frontend tests:**
```bash
cd frontend && npm test          # Vitest unit tests
cd frontend && npm run test:e2e  # Playwright E2E
cd frontend && npm run help:shots  # re-capture the Help panel screenshots after a panel changes (run alone; needs the backend)
```

**Lint / format / typecheck:**
```bash
cd backend && uv run ruff check . && uv run ruff format . && uv run mypy app
cd frontend && npm run lint && npm run format && npx tsc --noEmit
```

## Architecture Overview

### Backend (`backend/app/`)
Stateless FastAPI — the frontend holds all scene state; the server validates input and runs the graph algorithms.

- `main.py` — app + router registration; `config.py` — constants (limits, palettes, scale targets) served at `GET /api/config`.
- `models/` — Pydantic request/response models (`network`, `layout`, `topology`, `session`, `attributes`).
- `routers/` — one per endpoint: `config`, `network` (TSV upload), `layout`, `topology`, `session` (import/export), `external` (token-shared sessions), `attributes` (node/edge attribute files).
- `services/` — logic: `parser` (TSV parse/validate), `graph` (igraph construction + scopes), `layouts` (11 layout algos), `clustering` (4 community algos, optional layout step), `topology` (Degree / Clustering Coefficient / Betweenness), `session`, `attributes`.
- Algorithms use **python-igraph** — same C core as R's igraph, so layouts/clustering/topology port 1:1.

### Frontend (`frontend/src/`)
- `main.ts` — entry point: fetch config → set up Three.js → mount canvas → wire panels + listeners → `animate()`. Exposes `window.__arena = { ctx, history }` as a Playwright test hook (the WebGL canvas is opaque to the a11y tree).
- `three/` — `Scene`, `Layer`, `Node`, `Edge` classes on npm `three` r170; `runtime.ts` holds the shared mutable `ctx` (replaces v2 ambient globals); `constants.ts` static geometry/palette constants.
- `actions/` — one module per domain (`network`, `layout`, `layer`, `node`, `edge`, `labels`, `themes`, `screen`, `canvas_controls`, `nav_controls`, `drag_controls`, `right_click_menu`, `session`). These mutate the object model + `ctx`.
- `commands/` — `Command` interface + `CommandHistory` (undo/redo); `scene.ts` holds the concrete commands. Every scene mutation that should be undoable routes through a command.
- `ui/` — one module per navbar panel (`home`, `find`, `file`, `databases`, `export`, `layouts`, `scene`, `layer`, `node`, `edge`, `style`, `analyze`, `data`, `fps`, `help`), each filling its `#panel-*` pane with Bootstrap DOM and wiring controls to `actions`/`commands`.
- `bus/` — typed `EventBus` singleton (returns unsubscribe fns); `store/` — typed `AppState` store. Together they replace the old Shiny input/output sync.
- `api/client.ts` — hand-written typed client mirroring the Pydantic models.

### Communication
- **Frontend → backend**: `api.*` calls to `/api/*` (network parse, layout, topology, session, attributes).
- **Within frontend**: components emit/subscribe on the `EventBus` and read/write the `store`; the render loop reacts to `ctx` flags (`renderInterLayerEdgesFlag`, label flags, etc.).

### Network Data Model
- Networks upload as TSV with mandatory columns `SourceNode`, `SourceLayer`, `TargetNode`, `TargetLayer` (optional: `Weight`, `Channel`, edge color columns). A minimal 2-column edgelist (`SourceNode`, `TargetNode`) is also accepted — all nodes land in a single default layer.
- Node/edge attribute files add per-node color/size/url/description and per-edge (optionally per-channel) color.
- Sessions export/import as JSON with full node/edge/layer/scene state. `POST /api/external` returns a token URL so another app can hand off a session.
