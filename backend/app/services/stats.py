"""Network statistics — PLAN-ROADMAP Phase 21.

One block of whole-graph statistics per selected layer (intra-layer edges)
and one for the whole network (all selected layers, intra + inter-layer
edges, every Node_Layer a vertex). Everything is guarded so empty or
edgeless graphs never reach an igraph call that would raise (an igraph error
off the main thread aborts the process).
"""

from collections import Counter

import igraph as ig
from pydantic import BaseModel

from app.models.network import EdgeModel, NodeModel
from app.services import graph as g


class GraphStats(BaseModel):
    name: str
    nodes: int
    edges: int
    density: float
    average_degree: float
    max_degree: int
    components: int
    largest_component: int
    diameter: int  # of the largest component, in hops
    average_path_length: float
    average_clustering: float
    transitivity: float  # global clustering coefficient
    assortativity: float | None  # degree assortativity; None when undefined
    degree_distribution: dict[int, int]  # degree -> number of nodes


def _finite(x: float) -> float:
    return float(x) if x == x else 0.0


def graph_stats(name: str, graph: ig.Graph) -> GraphStats:
    n, m = graph.vcount(), graph.ecount()
    degrees = graph.degree() if n else []
    comps = graph.connected_components() if n else None
    giant = comps.giant() if comps is not None else None
    has_paths = giant is not None and giant.vcount() > 1
    assort: float | None = None
    if m and len(set(degrees)) > 1:
        a = graph.assortativity_degree(directed=False)
        assort = a if a == a else None
    return GraphStats(
        name=name,
        nodes=n,
        edges=m,
        density=_finite(graph.density()) if n > 1 else 0.0,
        average_degree=(2 * m / n) if n else 0.0,
        max_degree=max(degrees, default=0),
        components=len(comps) if comps is not None else 0,
        largest_component=giant.vcount() if giant is not None else 0,
        diameter=int(giant.diameter()) if has_paths and giant is not None else 0,
        average_path_length=_finite(giant.average_path_length()) if has_paths and giant else 0.0,
        average_clustering=_finite(graph.transitivity_avglocal_undirected(mode="zero"))
        if m
        else 0.0,
        transitivity=_finite(graph.transitivity_undirected()) if m else 0.0,
        assortativity=assort,
        degree_distribution=dict(sorted(Counter(degrees).items())),
    )


def network_stats(
    nodes: list[NodeModel], edges: list[EdgeModel], layers: list[str]
) -> list[GraphStats]:
    """Per-layer stats (in `layers` order), then "Whole network"."""
    out = []
    for layer in layers:
        ids = [n.id for n in nodes if n.layer == layer]
        graph = g.build_graph(
            g.intra_layer_edges(edges, layer), remove_multiple=True, extra_vertices=ids
        )
        graph.simplify(multiple=True, loops=True)
        out.append(graph_stats(layer, graph))
    selected = set(layers)
    ids = [n.id for n in nodes if n.layer in selected]
    whole = g.build_graph(
        g.within_layers_edges(edges, selected), remove_multiple=True, extra_vertices=ids
    )
    whole.simplify(multiple=True, loops=True)
    out.append(graph_stats("Whole network", whole))
    return out
