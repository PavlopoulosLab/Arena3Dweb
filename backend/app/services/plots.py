"""Data for Analyze → Plots: node metrics per graph, and the curves of
topological features that need the whole graph.

The graphs are those of Network Statistics: each analysed layer (intra-layer
edges) or the analysed layers as one graph. Node metrics are the Metrics
panel's own (services/topology.py and services/multilayer.py: weighted where
they are, parallel edges merged), so a plot shows the values the nodes are
sized by. The structural series use the simple unweighted graph: component
sizes, the number of node pairs at each distance, C(k) (the mean clustering
coefficient of the nodes of degree k), knn(k) (their neighbours' mean degree:
rising for an assortative network, falling for a disassortative one) and the
rich-club coefficient φ(k) (Zhou & Mondragón 2004), optionally beside its mean
on degree-preserving rewired graphs (Colizza et al. 2006).
"""

import math
import random
from collections import Counter, defaultdict

import igraph as ig

from app.models.plots import PlotRequest, PlotResponse, RichClubPoint, ScopeData
from app.services import graph as g
from app.services.multilayer import MULTILAYER_METRICS, multilayer_values
from app.services.perturbation import analysed, path_hist, simple_graph
from app.services.topology import METRICS


class PlotError(ValueError):
    """An unknown metric, or nothing to plot."""


def rich_club(graph: ig.Graph) -> dict[int, float]:
    """φ(k): the edge density among the nodes of degree > k, for every k with
    at least two such nodes."""
    deg = graph.degree()
    if not deg:
        return {}
    kmax = max(deg)
    nodes_above = [0] * (kmax + 1)  # nodes of degree > k
    edges_above = [0] * (kmax + 1)  # edges whose ends both have degree > k
    by_degree = Counter(deg)
    by_min = Counter(min(deg[a], deg[b]) for a, b in graph.get_edgelist())
    n_run = e_run = 0
    for k in range(kmax, -1, -1):
        nodes_above[k], edges_above[k] = n_run, e_run
        n_run += by_degree.get(k, 0)
        e_run += by_min.get(k, 0)
    return {
        k: 2 * edges_above[k] / (nodes_above[k] * (nodes_above[k] - 1))
        for k in range(kmax)
        if nodes_above[k] > 1
    }


def _rich_club_points(graph: ig.Graph, rewired: int) -> list[RichClubPoint]:
    phi = rich_club(graph)
    if not rewired or graph.ecount() < 2:
        return [RichClubPoint(k=k, phi=v) for k, v in phi.items()]
    sums: dict[int, float] = defaultdict(float)
    for _ in range(rewired):
        r = graph.copy()
        r.rewire(n=10 * graph.ecount(), allowed_edge_types="simple")  # same degrees
        for k, v in rich_club(r).items():
            sums[k] += v
    return [
        RichClubPoint(k=k, phi=v, phi_random=sums[k] / rewired if k in sums else None)
        for k, v in phi.items()
    ]


def clustering_by_degree(graph: ig.Graph) -> list[tuple[int, float]]:
    """C(k) for k >= 2 (a node with fewer links has no triangles to close)."""
    if graph.vcount() == 0:
        return []
    local = graph.transitivity_local_undirected(mode="zero")
    groups: dict[int, list[float]] = defaultdict(list)
    for k, c in zip(graph.degree(), local, strict=True):
        if k >= 2:
            groups[k].append(float(c))
    return [(k, sum(v) / len(v)) for k, v in sorted(groups.items())]


def neighbour_degree(graph: ig.Graph) -> list[tuple[int, float]]:
    """knn(k): the mean degree of the neighbours of the nodes of degree k."""
    if graph.ecount() == 0:
        return []
    _, knnk = graph.knn()
    return [(k + 1, float(v)) for k, v in enumerate(knnk) if v == v and math.isfinite(v)]


def plot_data(req: PlotRequest) -> PlotResponse:
    known = set(METRICS) | set(MULTILAYER_METRICS)
    unknown = [m for m in req.metrics if m not in known]
    if unknown:
        raise PlotError(f"Unknown metric: {', '.join(unknown)}")
    net = analysed(req)
    if req.scope == "combined":
        scopes = [net.whole]
    else:
        scopes = net.scopes[:-1] if len(net.scopes) > 1 else net.scopes
    edges = [net.edges[i] for i in net.rows]  # the analysed layers and channels
    layers = list(dict.fromkeys(req.layers))
    multi = {
        m: multilayer_values(m, req.nodes, edges, layers)
        for m in req.metrics
        if m in MULTILAYER_METRICS
    }
    random.seed(req.seed)  # igraph's rewiring draws from Python's random
    out: list[ScopeData] = []
    for scope in scopes:
        data = ScopeData(name=scope.name, nodes=scope.ids)
        rows = [net.edges[i] for i in scope.rows]
        weighted = g.build_graph(rows, remove_multiple=True, extra_vertices=scope.ids)
        at = {v: i for i, v in enumerate(weighted.vs["name"] if weighted.vcount() else [])}
        for m in req.metrics:
            if m in multi:
                data.metrics[m] = [multi[m].get(v, 0.0) for v in scope.ids]
            elif weighted.vcount():
                values = METRICS[m](weighted, False)
                data.metrics[m] = [
                    float(values[at[v]]) if values[at[v]] == values[at[v]] else 0.0
                    for v in scope.ids
                ]
            else:
                data.metrics[m] = []
        simple = simple_graph(scope.ids, ((e.src, e.trg) for e in rows))
        n = simple.vcount()
        if "components" in req.extras:
            sizes = simple.connected_components().sizes() if n else []
            data.components = sorted(sizes, reverse=True)
        if "paths" in req.extras:
            data.path_lengths = path_hist(simple)
            data.unconnected = n * (n - 1) // 2 - sum(data.path_lengths.values())
        if "clustering_by_degree" in req.extras:
            data.clustering_by_degree = clustering_by_degree(simple)
        if "neighbour_degree" in req.extras:
            data.neighbour_degree = neighbour_degree(simple)
        if "rich_club" in req.extras:
            data.rich_club = _rich_club_points(simple, req.rich_club_random)
        out.append(data)
    return PlotResponse(scopes=out)
