"""Request/response schemas for POST /api/plots (Analyze → Plots)."""

from typing import Literal

from pydantic import BaseModel, Field

from app import config
from app.models.perturbation import AnalysedRequest

PlotScope = Literal["perLayer", "combined"]
Extra = Literal["components", "paths", "clustering_by_degree", "neighbour_degree", "rich_club"]


class PlotRequest(AnalysedRequest):
    # each analysed layer (intra-layer edges) or the analysed layers as one graph
    scope: PlotScope = "perLayer"
    # node metrics by name, as in GET /api/config topology_metrics
    metrics: list[str] = Field(default=[], max_length=len(config.TOPOLOGY_METRICS))
    extras: list[Extra] = []
    # rich club: average over this many degree-preserving rewired graphs to
    # normalise (0 = the raw coefficient)
    rich_club_random: int = Field(default=0, ge=0, le=10)
    seed: int = 1


class RichClubPoint(BaseModel):
    k: int
    phi: float  # edge density among the nodes of degree > k
    phi_random: float | None = None  # the same on rewired graphs (mean)


class ScopeData(BaseModel):
    name: str  # a layer, or "Whole network"
    nodes: list[str]  # Node_Layer ids
    metrics: dict[str, list[float]] = {}  # metric -> values, in `nodes` order
    components: list[int] | None = None  # sizes, largest first
    path_lengths: dict[int, int] | None = None  # hops -> pairs of nodes
    unconnected: int | None = None  # pairs with no path
    clustering_by_degree: list[tuple[int, float]] | None = None  # C(k), k >= 2
    neighbour_degree: list[tuple[int, float]] | None = None  # knn(k)
    rich_club: list[RichClubPoint] | None = None


class PlotResponse(BaseModel):
    scopes: list[ScopeData]
    warnings: list[str] = []
