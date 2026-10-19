"""Request/response schemas for POST /api/layout."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

from app import config
from app.models import examples as ex
from app.models.limits import ChannelNames, GroupMap, LayerNames, NodeIds
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


class UmapOptions(BaseModel):
    """algorithm "UMAP" (services/umap_layout.py)."""

    mode: Literal["topology", "attributes", "hybrid"] = "topology"
    n_neighbors: int = Field(default=15, ge=2, le=200)
    min_dist: float = Field(default=0.1, ge=0, le=1)
    metric: Literal["euclidean", "cosine"] = "euclidean"
    # hybrid: 0 = topology only .. 1 = attributes only
    balance: float = Field(default=0.5, ge=0, le=1)
    # attribute columns assembled by the client (File → Values, one-hot
    # annotation terms): Node_Layer id -> one value per name, null = missing
    feature_names: list[str] = Field(default=[], max_length=config.MAX_UMAP_FEATURES)
    features: (
        dict[str, Annotated[list[float | None], Field(max_length=config.MAX_UMAP_FEATURES)]] | None
    ) = Field(default=None, max_length=config.MAX_NODES)
    # node metrics (topology METRICS names) computed on each scope's graph
    metrics: list[str] = Field(default=[], max_length=20)

    @model_validator(mode="after")
    def _rows_match_names(self) -> "UmapOptions":
        width = len(self.feature_names)
        if any(len(row) != width for row in (self.features or {}).values()):
            raise ValueError(f"every feature row needs {width} values, one per feature name")
        return self


class LayoutRequest(BaseModel):
    model_config = ex.config(ex.LAYOUT)

    # Unauthenticated DoS fix: this endpoint is reachable directly (not just via
    # the TSV-upload flow), so the MAX_EDGES/MAX_NODES cap must be enforced here
    # too, or a caller can force an O(V*E) layout algorithm over an arbitrarily
    # large graph.
    nodes: list[NodeModel] = Field(max_length=config.MAX_NODES)
    edges: list[EdgeModel] = Field(max_length=config.MAX_EDGES)
    algorithm: str
    scope: Scope = "perLayer"
    selected_layers: LayerNames
    selected_nodes: NodeIds | None = None  # Node_Layer ids, for nodesPerLayers
    selected_channels: ChannelNames | None = None
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
    groups: GroupMap | None = None
    group_local: str = "keep"  # a layout name, or "keep" (virtual/gravity only)
    group_force: float = Field(default=10, ge=1, le=20)
    group_scale: float = Field(default=1, ge=0.25, le=4)
    channel_weights: (
        dict[str, Annotated[float, Field(ge=MIN_CHANNEL_WEIGHT, le=MAX_CHANNEL_WEIGHT)]] | None
    ) = Field(default=None, max_length=config.MAX_CHANNELS)
    umap: UmapOptions | None = None  # algorithm "UMAP" only


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

    model_config = ex.config(ex.CLUSTERING)

    nodes: list[NodeModel] = Field(max_length=config.MAX_NODES)
    edges: list[EdgeModel] = Field(max_length=config.MAX_EDGES)
    algorithm: str  # Louvain | Walktrap | Fast Greedy | Label Propagation | Leiden
    # perLayer: communities within each selected layer; allLayers: one graph of
    # the selected layers; coupled: shared across layers by node name
    # (multiplex Leiden, or the other algorithms on the label-merged graph)
    scope: Literal["perLayer", "allLayers", "coupled"] = "perLayer"
    selected_layers: LayerNames
    selected_channels: ChannelNames | None = None
    seed: int = 123


class ClusteringResponse(BaseModel):
    clusters: dict[str, int]  # Node_Layer id -> community id
    count: int
