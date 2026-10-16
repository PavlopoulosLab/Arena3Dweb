from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import config
from app.routers import attributes as attributes_router
from app.routers import config as config_router
from app.routers import databases as databases_router
from app.routers import enrichment as enrichment_router
from app.routers import external as external_router
from app.routers import layout as layout_router
from app.routers import network as network_router
from app.routers import open as open_router
from app.routers import session as session_router
from app.routers import topology as topology_router

DESCRIPTION = """Arena3D's server: parse, lay out and analyse multilayered networks, and open
them in the application from other tools.

* **POST /api/open** is the simplest way in: a list of edges (or Arena3D TSV text) comes back
  as a link that opens the network, laid out, in Arena3D.
* **POST /api/external** stores a complete session (positions, colours, …) and returns the same
  kind of link; **GET /api/external/{token}** resolves one.
* The analysis endpoints take and return JSON, so scripts can run layouts, metrics, statistics,
  enrichment and database imports without the browser.

No key is needed. Bodies are limited to the upload size, networks to the limits reported by
GET /api/config. Errors are JSON with a `detail` message: 400 for bad input, 413 for oversized
bodies, 422 for a body that does not match the schema.
"""

TAGS = [
    {"name": "Sharing", "description": "Open a network in Arena3D from another application."},
    {"name": "Networks", "description": "Parse network and attribute files."},
    {
        "name": "Layouts",
        "description": "Layouts, clustering, cross-layer alignment, group layouts.",
    },
    {
        "name": "Analysis",
        "description": "Node metrics, network statistics, layer similarity, enrichment.",
    },
    {"name": "Import", "description": "Live import from STRING, IntAct, OmniPath and NDEx."},
    {"name": "Sessions", "description": "Session files (File → Save / Load Session)."},
    {"name": "Configuration", "description": "Server limits, defaults and health."},
]

# docs live under /api/ so the production proxy (nginx: location /api/) reaches them
app = FastAPI(
    title="Arena3D API",
    version="3.0.0",
    description=DESCRIPTION,
    openapi_tags=TAGS,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)
# Other web applications (e.g. NORMA in a browser) post networks here; nothing
# uses cookies or credentials, so any origin may call the API.
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST"], allow_headers=["*"]
)
app.include_router(config_router.router)
app.include_router(network_router.router)
app.include_router(layout_router.router)
app.include_router(topology_router.router)
app.include_router(session_router.router)
app.include_router(external_router.router)
app.include_router(open_router.router)
app.include_router(attributes_router.router)
app.include_router(databases_router.router)
app.include_router(enrichment_router.router)


# Defense-in-depth: JSON body endpoints (layout/topology/external) validate
# node/edge counts only *after* Starlette buffers + Pydantic parses the full
# body, so an oversized payload is fully read into memory before rejection.
# Reject early using the declared Content-Length. This is a backstop for
# direct/non-nginx exposure (e.g. docker-compose dev) — the prod deploy's
# nginx client_max_body_size already enforces this at the edge. A request
# without Content-Length (chunked transfer) isn't caught here; it still hits
# the per-endpoint UploadFile checks for the file-upload routes.
@app.middleware("http")
async def limit_body_size(request: Request, call_next):  # type: ignore[no-untyped-def]
    content_length = request.headers.get("content-length")
    if content_length is not None:
        try:
            too_large = int(content_length) > config.MAX_UPLOAD_BYTES
        except ValueError:
            too_large = False  # malformed header — let normal parsing reject it
        if too_large:
            return JSONResponse(status_code=413, content={"detail": "Payload too large."})
    return await call_next(request)


@app.get("/api/health", summary="Health check", tags=["Configuration"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
