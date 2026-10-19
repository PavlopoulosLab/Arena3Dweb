"""Phase 5 multilayer analytics."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.layout import LayoutRequest
from app.models.network import EdgeModel, NodeModel
from app.services.layouts import compute_layout
from app.services.multilayer import layer_similarity, multilayer_values, multiplex_membership

client = TestClient(app)


def _edge(s: str, sl: str, t: str, tl: str) -> dict:
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
    """Hub H: 2 links in L1 and 2 in L2 (even). X: 2 links, both in L1."""
    layout = {
        "L1": [("H", "A"), ("H", "B"), ("X", "A"), ("X", "B")],
        "L2": [("H", "C"), ("H", "D")],
    }
    edges = [_edge(s, lay, t, lay) for lay, pairs in layout.items() for s, t in pairs]
    labels = {lay: {n for p in pairs for n in p} for lay, pairs in layout.items()}
    nodes = [
        {"id": f"{lab}_{lay}", "label": lab, "layer": lay}
        for lay, labs in labels.items()
        for lab in sorted(labs)
    ]
    return nodes, edges


def _models():
    nodes, edges = _net()
    return [NodeModel(**n) for n in nodes], [EdgeModel(**e) for e in edges]


def test_multiplex_degree_sums_layers() -> None:
    nodes, edges = _models()
    v = multilayer_values("Multiplex Degree", nodes, edges, ["L1", "L2"])
    assert v["H_L1"] == v["H_L2"] == 4.0
    assert v["X_L1"] == 2.0


def test_participation_coefficient() -> None:
    nodes, edges = _models()
    v = multilayer_values("Participation Coefficient", nodes, edges, ["L1", "L2"])
    assert v["H_L1"] == pytest.approx(1.0)  # 2 + 2 -> perfectly even
    assert v["X_L1"] == pytest.approx(0.0)  # all links in one layer


def test_participation_single_layer_is_zero() -> None:
    nodes, edges = _models()
    v = multilayer_values("Participation Coefficient", nodes, edges, ["L1"])
    assert set(v.values()) == {0.0}


def test_multilayer_pagerank_ranks_hub_highest_and_is_shared() -> None:
    nodes, edges = _models()
    v = multilayer_values("Multilayer PageRank", nodes, edges, ["L1", "L2"])
    assert v["H_L1"] == v["H_L2"]
    assert v["H_L1"] == max(v.values())


def test_topology_endpoint_accepts_multilayer_metrics() -> None:
    nodes, edges = _net()
    for metric in ("Multiplex Degree", "Participation Coefficient", "Multilayer PageRank"):
        res = client.post(
            "/api/topology",
            json={
                "nodes": nodes,
                "edges": edges,
                "metric": metric,
                "selected_layers": ["L1", "L2"],
            },
        )
        assert res.status_code == 200, metric
        body = res.json()
        assert set(body["raw"]) == {n["id"] for n in nodes}
        assert all(0.5 <= s <= 2.5 for s in body["scales"].values())


def test_layer_similarity() -> None:
    nodes, edges = _models()
    node_sim, edge_sim = layer_similarity(nodes, edges, ["L1", "L2"])
    assert node_sim[0][0] == 1.0
    # L1 {H,A,B,X}, L2 {H,C,D}: overlap {H} / union of 6
    assert node_sim[0][1] == pytest.approx(1 / 6)
    assert edge_sim[0][1] == 0.0


def test_layer_similarity_endpoint() -> None:
    nodes, edges = _net()
    res = client.post(
        "/api/layer-similarity", json={"nodes": nodes, "edges": edges, "layers": ["L1", "L2"]}
    )
    assert res.status_code == 200
    assert res.json()["layers"] == ["L1", "L2"]


def test_multiplex_membership_is_shared_and_deterministic() -> None:
    _, edges = _models()
    labels = ["H", "A", "B", "X", "C", "D"]
    m1 = multiplex_membership(edges, labels, ["L1", "L2"], seed=1)
    assert m1 == multiplex_membership(edges, labels, ["L1", "L2"], seed=1)
    assert set(m1) == set(labels)


def test_coupled_leiden_layout_uses_multiplex_communities() -> None:
    nodes, edges = _net()
    req = LayoutRequest(
        nodes=nodes,
        edges=edges,
        algorithm="Fruchterman-Reingold",
        scope="coupled",
        selected_layers=["L1", "L2"],
        clustering={"algorithm": "Leiden", "local_layout": "Circle"},
    )
    pos, clusters = compute_layout(req)
    assert clusters is not None
    assert clusters["H_L1"] == clusters["H_L2"]
    assert pos["H_L1"] == pos["H_L2"]


def test_leiden_single_graph_clustering() -> None:
    nodes, edges = _net()
    req = LayoutRequest(
        nodes=nodes,
        edges=edges,
        algorithm="Circle",
        scope="perLayer",
        selected_layers=["L1"],
        clustering={"algorithm": "Leiden", "local_layout": "Circle"},
    )
    _, clusters = compute_layout(req)
    assert clusters and set(clusters) == {"H_L1", "A_L1", "B_L1", "X_L1"}
