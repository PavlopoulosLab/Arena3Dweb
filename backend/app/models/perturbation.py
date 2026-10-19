"""Request/response schemas for POST /api/perturbation/knockout and /attack."""

from typing import Literal

from pydantic import BaseModel, Field

from app import config
from app.models import examples as ex
from app.models.limits import ChannelNames
from app.models.network import EdgeModel, NodeModel

RankMetric = Literal["degree", "betweenness", "pagerank"]
AttackStrategy = Literal["random", "degree", "betweenness"]


class TopK(BaseModel):
    """The k highest-ranking nodes by a metric."""

    metric: RankMetric
    k: int = Field(ge=1, le=config.MAX_NODES)
    # k in each analysed layer (intra-layer edges) instead of k in the whole network
    per_layer: bool = False


class EdgePair(BaseModel):
    """An edge as the scene draws it: every channel between src and trg."""

    src: str  # Node_Layer id
    trg: str


class AnalysedRequest(BaseModel):
    """A network and the layers to analyse (perturbation, plots)."""

    nodes: list[NodeModel] = Field(max_length=config.MAX_NODES)
    edges: list[EdgeModel] = Field(max_length=config.MAX_EDGES)
    # the analysed layers; the whole network is these layers with the
    # inter-layer edges among them
    layers: list[str] = Field(min_length=1, max_length=config.MAX_LAYERS)
    selected_channels: ChannelNames | None = None


class KnockoutRequest(AnalysedRequest):
    model_config = ex.config(ex.KNOCKOUT)

    # nodes: Node_Layer ids, names (every copy in the analysed layers, any
    # case) and the top k by a metric
    remove_nodes: list[str] = Field(default=[], max_length=config.MAX_NODES)
    remove_names: list[str] = Field(default=[], max_length=config.MAX_NODES)
    top_k: TopK | None = None
    # also every other copy, in the analysed layers, of each removed node
    every_copy: bool = False
    # edges: scene edges, whole channels, the inter-layer edges, a random share
    remove_edges: list[EdgePair] = Field(default=[], max_length=config.MAX_EDGES)
    remove_channels: list[str] = Field(default=[], max_length=config.MAX_CHANNELS)
    remove_inter_layer: bool = False
    random_edge_fraction: float = Field(default=0.0, ge=0.0, le=1.0)
    seed: int = 1
    # network propagation (random walk with restart) from these names or ids,
    # before and after the knockout; empty = none
    propagation_seeds: list[str] = Field(default=[], max_length=config.MAX_NODES)
    restart: float = Field(default=0.5, gt=0.0, lt=1.0)


class GlobalMeasures(BaseModel):
    name: str  # a layer, or "Whole network"
    nodes: int
    edges: int
    components: int
    largest_component: int
    density: float
    average_path_length: float  # of the largest component, in hops
    diameter: int  # of the largest component, in hops
    efficiency: float  # global efficiency: mean 1/distance over all pairs
    cut_off: int = 0  # nodes no longer in the largest component (after only)


class NodeChange(BaseModel):
    id: str  # Node_Layer
    label: str
    layer: str
    removed: bool
    # was in the largest component of its layer / of the whole network (the
    # layer itself when only one is analysed), is not now
    cut_off_layer: bool = False
    cut_off_whole: bool = False
    # in the whole network (hops; parallel edges merged); after = None if removed
    degree: float
    degree_after: float | None
    betweenness: float
    betweenness_after: float | None
    # harmonic closeness: mean 1 / distance to the other nodes (0 when cut off),
    # both divided by the node count before, so the two compare
    closeness: float
    closeness_after: float | None
    propagation: float | None = None
    propagation_after: float | None = None


class KnockoutResponse(BaseModel):
    removed_nodes: list[str]  # Node_Layer ids
    # indices into the request's `edges` of the rows removed as edges (rows of
    # removed nodes are not listed: they go with their nodes)
    removed_edges: list[int]
    before: list[GlobalMeasures]
    after: list[GlobalMeasures]
    nodes: list[NodeChange]
    warnings: list[str] = []


class AttackRequest(AnalysedRequest):
    model_config = ex.config(ex.ATTACK)

    strategy: AttackStrategy = "random"
    # targeted: rank again after each step (adaptive) or once at the start
    recalculate: bool = True
    runs: int = Field(default=5, ge=1, le=config.MAX_ATTACK_RUNS)  # random only
    steps: int = Field(default=20, ge=1, le=config.MAX_ATTACK_STEPS)
    max_fraction: float = Field(default=1.0, gt=0.0, le=1.0)
    efficiency: bool = False
    seed: int = 1
    # only the whole network's curve (the app asks for one curve per request,
    # to show its progress)
    whole_only: bool = False


class Curve(BaseModel):
    name: str  # a layer, or "Whole network"
    nodes: int  # before any removal
    fraction: list[float]  # share of the nodes removed at each point
    largest: list[float]  # largest component / nodes before
    largest_sd: list[float] | None = None  # over the random runs
    components: list[float]
    efficiency: list[float] | None = None  # relative to the start
    # robustness R: the area under the largest-component curve (Schneider
    # et al. 2011), over the fraction removed
    robustness: float
    complete: bool = True  # False: stopped by the time budget


class AttackResponse(BaseModel):
    strategy: AttackStrategy
    recalculate: bool
    curves: list[Curve]
    warnings: list[str] = []
