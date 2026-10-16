"""Request/response schemas for POST /api/layout."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app import config
from app.models.network import EdgeModel, NodeModel

# "coupled": one layout on the selected layers merged by node label, applied to
# every layer so the same node sits at the same spot in each (multiplex view).
Scope = Literal["perLayer", "allLayers", "nodesPerLayers", "coupled"]

# A zero factor would turn into near-infinite Kamada-Kawai edge lengths;
# leaving a channel out is what the channel checkboxes are for.
MIN_CHANNEL_WEIGHT = 0.1
MAX_CHANNEL_WEIGHT = 10.0


class ClusteringOptions(BaseModel):
    algorithm: str  # Louvain | Walktrap | Fast Greedy | Label Propagation
    local_layout: str  # layout name for members within a cluster


class LayoutRequest(BaseModel):
    # Unauthenticated DoS fix: this endpoint is reachable directly (not just via
    # the TSV-upload flow), so the MAX_EDGES/MAX_NODES cap must be enforced here
    # too, or a caller can force an O(V*E) layout algorithm over an arbitrarily
    # large graph.
    nodes: list[NodeModel] = Field(max_length=config.MAX_NODES)
    edges: list[EdgeModel] = Field(max_length=config.MAX_EDGES)
    algorithm: str
    scope: Scope = "perLayer"
    selected_layers: list[str]
    selected_nodes: list[str] | None = None  # Node_Layer ids, for nodesPerLayers
    selected_channels: list[str] | None = None
    clustering: ClusteringOptions | None = None
    seed: int = 123  # v2 uses set.seed(123)
    # Weighted layouts (off by default = v2 behaviour). When on, edge weights
    # drive the layouts that support them; channel_weights multiplies each
    # edge's weight by its channel's factor (missing channels count as 1).
    use_weights: bool = False
    # 3 = 3D layout of a single layer: nodes leave the layer plane (Phase 13).
    dimensions: Literal[2, 3] = 2
    # Pseudo-alignment across layers (perLayer scope, 2D, no clustering) —
    # services/alignment.py. strength: 0 = independent .. 1 = aligned/pinned.
    alignment: Literal["none", "soft", "anchor", "chain"] = "none"
    alignment_strength: float = Field(default=0.7, ge=0, le=1)
    reference_layer: str | None = None
    # NORMA-2.0 group layouts (services/group_layouts.py): `groups` maps a
    # Node_Layer id to its groups (clusters, annotations or its layer)
    group_strategy: Literal["none", "virtual", "gravity", "supernodes"] = "none"
    groups: dict[str, list[str]] | None = Field(default=None, max_length=config.MAX_NODES)
    group_local: str = "keep"  # a layout name, or "keep" (virtual/gravity only)
    group_force: float = Field(default=10, ge=1, le=20)
    group_scale: float = Field(default=1, ge=0.25, le=4)
    channel_weights: (
        dict[str, Annotated[float, Field(ge=MIN_CHANNEL_WEIGHT, le=MAX_CHANNEL_WEIGHT)]] | None
    ) = Field(default=None, max_length=config.MAX_CHANNELS)


class LayoutResponse(BaseModel):
    # Node_Layer id -> [y, z] within the layer plane, or [y, z, x] for a 3D
    # layout where x is the depth off the plane
    positions: dict[str, tuple[float, float] | tuple[float, float, float]]
    # Node_Layer id -> cluster id, only when clustering was requested
    clusters: dict[str, int] | None = None
    # mean in-plane stretch of cross-layer links, % of the layout diagonal
    # (0 = straight links); None for single-layer / 3D layouts
    misalignment: float | None = None


class ClusteringRequest(BaseModel):
    """POST /api/clustering: communities only, positions untouched."""

    nodes: list[NodeModel] = Field(max_length=config.MAX_NODES)
    edges: list[EdgeModel] = Field(max_length=config.MAX_EDGES)
    algorithm: str  # Louvain | Walktrap | Fast Greedy | Label Propagation | Leiden
    # perLayer: communities within each selected layer; allLayers: one graph of
    # the selected layers; coupled: shared across layers by node name
    # (multiplex Leiden, or the other algorithms on the label-merged graph)
    scope: Literal["perLayer", "allLayers", "coupled"] = "perLayer"
    selected_layers: list[str]
    selected_channels: list[str] | None = None
    seed: int = 123


class ClusteringResponse(BaseModel):
    clusters: dict[str, int]  # Node_Layer id -> community id
    count: int
