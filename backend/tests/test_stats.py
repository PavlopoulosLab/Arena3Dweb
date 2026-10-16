"""Phase 21: network statistics + extra node metrics."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.network import EdgeModel, NodeModel
from app.services.stats import network_stats

client = TestClient(app)


def _edge(s, sl, t, tl):
    return {
        "src": f"{s}_{sl}",
        "trg": f"{t}_{tl}",
        "source_node": s,
        "source_layer": sl,
        "target_node": t,
        "target_layer": tl,
        "weight": 1.0,
        "scaled_weight": 1.0,
        "channel": None,
    }


def _net():
    # L1: triangle A-B-C + pendant D (on C); L2: E-F plus isolated G; A_L1-E_L2 inter
    edges = [
        _edge("A", "L1", "B", "L1"),
        _edge("B", "L1", "C", "L1"),
        _edge("A", "L1", "C", "L1"),
        _edge("C", "L1", "D", "L1"),
        _edge("E", "L2", "F", "L2"),
        _edge("A", "L1", "E", "L2"),
    ]
    nodes = [{"id": f"{x}_L1", "label": x, "layer": "L1"} for x in "ABCD"]
    nodes += [{"id": f"{x}_L2", "label": x, "layer": "L2"} for x in "EFG"]
    return nodes, edges


def test_per_layer_and_whole() -> None:
    nodes, edges = _net()
    st = network_stats(
        [NodeModel(**n) for n in nodes], [EdgeModel(**e) for e in edges], ["L1", "L2"]
    )
    l1, l2, whole = st
    assert (l1.nodes, l1.edges, l1.components, l1.diameter) == (4, 4, 1, 2)
    assert l1.degree_distribution == {1: 1, 2: 2, 3: 1}
    assert l1.transitivity == pytest.approx(0.6)  # 3 * 1 triangle / 5 connected triples
    assert (l2.nodes, l2.edges, l2.components, l2.largest_component) == (3, 1, 2, 2)
    assert whole.name == "Whole network"
    assert (whole.nodes, whole.edges, whole.components) == (7, 6, 2)


def test_degenerate_graphs_do_not_crash() -> None:
    nodes = [{"id": "X_L", "label": "X", "layer": "L"}]
    st = network_stats([NodeModel(**n) for n in nodes], [], ["L", "Empty"])
    assert st[0].nodes == 1 and st[0].edges == 0 and st[0].assortativity is None
    assert st[1].nodes == 0 and st[1].diameter == 0


def test_stats_endpoint() -> None:
    nodes, edges = _net()
    res = client.post("/api/network-stats", json={"nodes": nodes, "edges": edges, "layers": ["L1"]})
    assert res.status_code == 200
    assert [s["name"] for s in res.json()] == ["L1", "Whole network"]


@pytest.mark.parametrize(
    "metric",
    [
        "Closeness Centrality",
        "Eigenvector Centrality",
        "PageRank",
        "Coreness (k-core)",
        "Eccentricity",
    ],
)
def test_new_node_metrics(metric: str) -> None:
    nodes, edges = _net()
    res = client.post(
        "/api/topology",
        json={"nodes": nodes, "edges": edges, "metric": metric, "selected_layers": ["L1", "L2"]},
    )
    assert res.status_code == 200, res.text
    raw = res.json()["raw"]
    assert "C_L1" in raw
    if metric == "Coreness (k-core)":
        assert raw["A_L1"] == 2 and raw["D_L1"] == 1
    if metric == "Eccentricity":
        assert raw["D_L1"] == 2
