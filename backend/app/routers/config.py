"""GET /api/config — replaces handler_initializeGlobals push (functions/init.R)."""

from typing import Any

from fastapi import APIRouter

from app import config

router = APIRouter()


@router.get("/api/config", summary="Server limits and defaults", tags=["Configuration"])
async def get_config() -> dict[str, Any]:
    """Edge, node, layer and channel limits, default colours and the available metrics."""
    return {
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
