"""Analyze → Plots data: node metrics per graph and topological curves."""

import igraph as ig
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.network import EdgeModel, NodeModel
from app.models.plots import PlotRequest
from app.models.topology import TopologyRequest
from app.services import plots as pl
from app.services.topology import compute_topology

client = TestClient(app)


def _edge(s: str, sl: str, t: str, tl: str) -> EdgeModel:
    return EdgeModel(
        src=f"{s}_{sl}",
        trg=f"{t}_{tl}",
        source_node=s,
        source_layer=sl,
        target_node=t,
        target_layer=tl,
        weight=1.0,
        scaled_weight=1.0,
    )


def _net(graph: ig.Graph, layer: str = "L") -> tuple[list[NodeModel], list[EdgeModel]]:
    names = [f"n{i}" for i in range(graph.vcount())]
    nodes = [NodeModel(id=f"{x}_{layer}", label=x, layer=layer) for x in names]
    return nodes, [_edge(names[a], layer, names[b], layer) for a, b in graph.get_edgelist()]


def _two_layers() -> tuple[list[NodeModel], list[EdgeModel]]:
    # L1: triangle A-B-C plus D on C; L2: path A-B-C; A_L1-A_L2 inter-layer
    a, ea = _net(ig.Graph(n=4, edges=[(0, 1), (1, 2), (0, 2), (2, 3)]), "L1")
    b, eb = _net(ig.Graph(n=3, edges=[(0, 1), (1, 2)]), "L2")
    return a + b, ea + eb + [_edge("n0", "L1", "n0", "L2")]


def test_rich_club_of_known_graphs() -> None:
    # a complete graph: every k below n - 1 keeps all nodes, density 1
    assert pl.rich_club(ig.Graph.Full(5)) == {k: 1.0 for k in range(4)}
    # a star: above degree 1 only the hub is left, so only k = 0 counts
    assert pl.rich_club(ig.Graph.Star(5)) == {0: pytest.approx(4 / 10)}
    # two hubs joined, each with leaves: the hubs alone are fully joined
    g = ig.Graph(n=6, edges=[(0, 1), (0, 2), (0, 3), (1, 4), (1, 5)])
    phi = pl.rich_club(g)
    assert phi[0] == pytest.approx(5 / 15)
    assert phi[1] == pytest.approx(1.0)  # nodes 0 and 1, one edge


def test_degree_curves() -> None:
    # triangle plus a pendant: C(2) = 1 (A, B), C(3) = 1/3 (C)
    g = ig.Graph(n=4, edges=[(0, 1), (1, 2), (0, 2), (2, 3)])
    assert pl.clustering_by_degree(g) == [(2, 1.0), (3, pytest.approx(1 / 3))]
    # knn: degree-1 D sees C (3); degree-2 A, B see 2 and 3; C sees 2, 2, 1
    assert pl.neighbour_degree(g) == [
        (1, 3.0),
        (2, pytest.approx(2.5)),
        (3, pytest.approx(5 / 3)),
    ]
    assert pl.neighbour_degree(ig.Graph(n=3)) == []
    assert pl.clustering_by_degree(ig.Graph()) == []


def test_metrics_match_the_metrics_panel() -> None:
    nodes, edges = _two_layers()
    metrics = ["Degree", "Betweenness Centrality", "Clustering Coefficient", "PageRank"]
    res = pl.plot_data(PlotRequest(nodes=nodes, edges=edges, layers=["L1", "L2"], metrics=metrics))
    assert [s.name for s in res.scopes] == ["L1", "L2"]
    for metric in metrics:
        _, raw = compute_topology(
            TopologyRequest(nodes=nodes, edges=edges, metric=metric, selected_layers=["L1", "L2"])
        )
        for scope in res.scopes:
            got = dict(zip(scope.nodes, scope.metrics[metric], strict=True))
            for v, x in got.items():
                assert x == pytest.approx(raw.get(v, 0.0)), (metric, v)


def test_combined_graph_and_extras() -> None:
    nodes, edges = _two_layers()
    res = pl.plot_data(
        PlotRequest(
            nodes=nodes,
            edges=edges,
            layers=["L1", "L2"],
            scope="combined",
            metrics=["Degree", "Multiplex Degree"],
            extras=["components", "paths", "clustering_by_degree", "neighbour_degree"],
        )
    )
    (whole,) = res.scopes
    assert whole.name == "Whole network" and len(whole.nodes) == 7
    assert whole.components == [7]
    # all 21 pairs joined; the farthest are D_L1 and C_L2 (D-C-A-A'-B'-C')
    assert sum((whole.path_lengths or {}).values()) == 21 and whole.unconnected == 0
    assert max(whole.path_lengths or {}) == 5
    by = dict(zip(whole.nodes, whole.metrics["Multiplex Degree"], strict=True))
    assert by["n0_L1"] == by["n0_L2"] == 3  # 2 links in L1 + 1 in L2
    assert whole.clustering_by_degree and whole.neighbour_degree


def test_rich_club_normalised_by_rewired_graphs() -> None:
    graph = ig.Graph.Barabasi(200, 3)
    graph.simplify()
    nodes, edges = _net(graph)
    req = PlotRequest(
        nodes=nodes, edges=edges, layers=["L"], extras=["rich_club"], rich_club_random=3
    )
    a = pl.plot_data(req).scopes[0].rich_club
    assert a and all(p.phi_random is not None for p in a[:5])
    assert a == pl.plot_data(req).scopes[0].rich_club  # seeded
    raw = pl.plot_data(req.model_copy(update={"rich_club_random": 0})).scopes[0].rich_club
    assert raw and raw[0].phi_random is None


def test_unknown_metric_and_endpoint() -> None:
    nodes, edges = _two_layers()
    with pytest.raises(pl.PlotError):
        pl.plot_data(PlotRequest(nodes=nodes, edges=edges, layers=["L1"], metrics=["Nope"]))
    body = {
        "nodes": [n.model_dump() for n in nodes],
        "edges": [e.model_dump() for e in edges],
        "layers": ["L1", "L2"],
        "metrics": ["Coreness (k-core)"],
        "extras": ["rich_club"],
    }
    r = client.post("/api/plots", json=body)
    assert r.status_code == 200, r.text
    assert [s["name"] for s in r.json()["scopes"]] == ["L1", "L2"]
    assert client.post("/api/plots", json={**body, "metrics": ["Nope"]}).status_code == 400
    assert client.post("/api/plots", json={**body, "extras": ["nope"]}).status_code == 422
    assert client.post("/api/plots", json={**body, "rich_club_random": 11}).status_code == 422
