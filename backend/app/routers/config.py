"""GET /api/config — replaces handler_initializeGlobals push (functions/init.R)."""

from typing import Any

from fastapi import APIRouter

from app import config
from app.services.clustering import CLUSTERING
from app.services.layouts import LAYOUTS, LAYOUTS_3D, UMAP

API_VERSION = "3.0.0"  # as in main.py's FastAPI(version=…)

router = APIRouter()


@router.get(
    "/api/config",
    summary="Server limits, defaults and what it can compute",
    tags=["Configuration"],
)
async def get_config() -> dict[str, Any]:
    """The server's version and limits (edges, nodes, layers, channels, upload size,
    seconds per computation), the default colours, and the names the other
    endpoints accept: layout and 3D layout algorithms, clustering algorithms and
    node metrics. A script can read this first to know what it may send."""
    return {
        "version": API_VERSION,
        "docs": {"swagger": "/api/docs", "redoc": "/api/redoc", "openapi": "/api/openapi.json"},
        "max_nodes": config.MAX_NODES,
        "max_upload_bytes": config.MAX_UPLOAD_BYTES,
        "compute_seconds": config.COMPUTE_SECONDS,
        "layouts": [*LAYOUTS, UMAP],
        "layouts_3d": list(LAYOUTS_3D),
        "clustering_algorithms": list(CLUSTERING),
        "max_edges": config.MAX_EDGES,
        "max_channels": config.MAX_CHANNELS,
        "max_layers": config.MAX_LAYERS,
        "edge_default_color": config.EDGE_DEFAULT_COLOR,
        "channel_colors_dark": config.CHANNEL_COLORS_DARK,
        "channel_colors_light": config.CHANNEL_COLORS_LIGHT,
        "node_colors": config.NODE_COLORS,
        "floor_default_color": config.FLOOR_DEFAULT_COLOR,
        "floor_default_width": config.FLOOR_DEFAULT_WIDTH,
        "topology_metrics": config.TOPOLOGY_METRICS,
        "no_edge_layouts": config.NO_EDGE_LAYOUTS,
    }
