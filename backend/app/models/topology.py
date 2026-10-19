"""Request/response schemas for POST /api/topology."""

from typing import Literal

from pydantic import BaseModel, Field

from app import config
from app.models import examples as ex
from app.models.limits import ChannelNames, LayerNames, NodeIds
from app.models.network import EdgeModel, NodeModel

Scope = Literal["perLayer", "allLayers", "nodesPerLayers"]
# How the edges make a graph: parallel edges (channels) merged into one undirected
# edge, kept as a directed graph (source → target), or kept as a multigraph in
# which every channel is an edge of its own.
GraphMode = Literal["undirected", "directed", "multi"]


class TopologyRequest(BaseModel):
    model_config = ex.config(ex.TOPOLOGY)

    # Same unauthenticated-DoS fix as LayoutRequest — Betweenness Centrality is
    # O(V*E) and this endpoint had no size limit of its own.
    nodes: list[NodeModel] = Field(max_length=config.MAX_NODES)
    edges: list[EdgeModel] = Field(max_length=config.MAX_EDGES)
    metric: str  # Degree | Clustering Coefficient | Betweenness Centrality
    scope: Scope = "perLayer"
    selected_layers: LayerNames
    selected_nodes: NodeIds | None = None
    selected_channels: ChannelNames | None = None
    directed: bool = False  # v2 edgeDirectionToggle (affects betweenness)
    graph: GraphMode = Field(
        default="undirected",
        description="undirected (parallel edges merged), directed, or multi (a channel = an edge)",
    )


class TopologyResponse(BaseModel):
    # Node_Layer id -> node scale mapped into [0.5, 2.5]
    scales: dict[str, float]
    # Node_Layer id -> raw metric value (for the View Data table)
    raw: dict[str, float]


class LayerSimilarityRequest(BaseModel):
    model_config = ex.config(ex.ANALYSED)

    nodes: list[NodeModel] = Field(max_length=config.MAX_NODES)
    edges: list[EdgeModel] = Field(max_length=config.MAX_EDGES)
    layers: list[str] = Field(min_length=1, max_length=config.MAX_LAYERS)


class LayerSimilarityResponse(BaseModel):
    layers: list[str]
    # Jaccard overlap per layer pair, rows/columns in `layers` order
    node_jaccard: list[list[float]]
    edge_jaccard: list[list[float]]
