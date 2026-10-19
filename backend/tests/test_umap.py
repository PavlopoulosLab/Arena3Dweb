"""UMAP layouts (services/umap_layout.py) through POST /api/layout."""

import math

import igraph as ig
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.models.layout import LayoutRequest
from app.services.layouts import LayoutError, compute_layout
from app.services.umap_layout import standardize

client = TestClient(app)


def _edge(a: str, b: str, la: str = "L1", lb: str = "L1") -> dict[str, object]:
    return {
        "src": f"{a}_{la}",
        "trg": f"{b}_{lb}",
        "source_node": a,
        "source_layer": la,
        "target_node": b,
        "target_layer": lb,
        "weight": 1.0,
        "scaled_weight": 1.0,
        "channel": None,
    }


def _karate(**umap: object) -> LayoutRequest:
    """Zachary's karate club; feature `faction` (0/1 by the club split) and a
    numeric `score` with one missing value."""
    graph = ig.Graph.Famous("Zachary")
    nodes = [{"id": f"{v}_L1", "label": str(v), "layer": "L1"} for v in range(34)]
    edges = [_edge(str(a), str(b)) for a, b in graph.get_edgelist()]
    faction = {0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 16, 17, 19, 21}
    features = {
        f"{v}_L1": [1.0 if v in faction else 0.0, None if v == 5 else float(v)] for v in range(34)
    }
    options = {"feature_names": ["faction", "score"], "features": features, **umap}
    return LayoutRequest(
        nodes=nodes,
        edges=edges,
        algorithm="UMAP",
        selected_layers=["L1"],
        umap=options,
    )


def _two_cliques() -> tuple[list[dict[str, str]], list[dict[str, object]]]:
    """Two disjoint 6-cliques a0..a5 and b0..b5 in layer L1."""
    nodes = [
        {"id": f"{p}{i}_L1", "label": f"{p}{i}", "layer": "L1"} for p in "ab" for i in range(6)
    ]
    edges = [_edge(f"{p}{i}", f"{p}{j}") for p in "ab" for i in range(6) for j in range(i + 1, 6)]
    return nodes, edges


def _spread(points: list[tuple[float, ...]]) -> float:
    return float(np.mean([math.dist(p, q) for p in points for q in points]))


def test_seed_makes_umap_deterministic() -> None:
    first, _ = compute_layout(_karate())
    again, _ = compute_layout(_karate())
    other, _ = compute_layout(_karate().model_copy(update={"seed": 7}))
    assert first == again
    assert first != other


@pytest.mark.parametrize("mode", ["topology", "attributes", "hybrid"])
@pytest.mark.parametrize("dim", [2, 3])
def test_each_mode_places_every_node(mode: str, dim: int) -> None:
    req = _karate(mode=mode, metrics=["Degree", "PageRank"]).model_copy(update={"dimensions": dim})
    pos, clusters = compute_layout(req)
    assert clusters is None
    assert len(pos) == 34
    assert all(len(p) == dim and all(math.isfinite(v) for v in p) for p in pos.values())


def test_topology_umap_separates_components() -> None:
    nodes, edges = _two_cliques()
    # fewer neighbours than a clique has nodes, so the kNN graph can split
    req = LayoutRequest(
        nodes=nodes,
        edges=edges,
        algorithm="UMAP",
        selected_layers=["L1"],
        umap={"n_neighbors": 4},
    )
    pos, _ = compute_layout(req)
    a = [pos[f"a{i}_L1"] for i in range(6)]
    b = [pos[f"b{i}_L1"] for i in range(6)]
    between = math.dist(np.mean(a, axis=0), np.mean(b, axis=0))
    assert between > 2 * max(_spread(a), _spread(b))


def test_attribute_umap_follows_the_features_not_the_edges() -> None:
    # the features cut across the cliques: half of each clique is "x", half "y"
    nodes, edges = _two_cliques()
    features = {n["id"]: [1.0 if int(n["label"][1]) < 3 else 0.0] for n in nodes}
    req = LayoutRequest(
        nodes=nodes,
        edges=edges,
        algorithm="UMAP",
        selected_layers=["L1"],
        umap={"mode": "attributes", "n_neighbors": 4, "feature_names": ["x"], "features": features},
    )
    pos, _ = compute_layout(req)
    x = [pos[n] for n, f in features.items() if f[0] == 1.0]
    y = [pos[n] for n, f in features.items() if f[0] == 0.0]
    between = math.dist(np.mean(x, axis=0), np.mean(y, axis=0))
    assert between > 2 * max(_spread(x), _spread(y))


def test_hybrid_balance_moves_the_layout() -> None:
    topo, _ = compute_layout(_karate(mode="hybrid", balance=0.0))
    attr, _ = compute_layout(_karate(mode="hybrid", balance=1.0))
    assert topo != attr


def test_node_metrics_alone_are_features() -> None:
    req = _karate(mode="attributes", feature_names=[], features=None, metrics=["Degree"])
    pos, _ = compute_layout(req)
    assert len(pos) == 34


def test_attribute_umap_needs_features() -> None:
    with pytest.raises(LayoutError, match="need features"):
        compute_layout(_karate(mode="attributes", feature_names=[], features=None))


def test_unknown_metric_is_refused() -> None:
    with pytest.raises(LayoutError, match="Unknown node metric"):
        compute_layout(_karate(mode="attributes", metrics=["Charisma"]))


def test_umap_node_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "MAX_UMAP_NODES", 10)
    with pytest.raises(LayoutError, match="limited to 10 nodes"):
        compute_layout(_karate())


def test_feature_rows_must_match_the_names() -> None:
    body = _karate().model_dump()
    body["umap"]["features"]["0_L1"] = [1.0]
    assert client.post("/api/layout", json=body).status_code == 422


def test_umap_rejects_clustering_and_alignment() -> None:
    req = _karate().model_copy(update={"alignment": "soft"})
    with pytest.raises(LayoutError, match="without clustering"):
        compute_layout(req)


def test_coupled_scope_shares_positions_across_copies() -> None:
    edges = [_edge(a, b, layer, layer) for layer in ("L1", "L2") for a, b in ("AB", "BC", "CD")]
    edges += [_edge("D", "E", "L2", "L2"), _edge("A", "A", "L1", "L2")]
    nodes = [
        {"id": f"{n}_{layer}", "label": n, "layer": layer}
        for layer, names in (("L1", "ABCD"), ("L2", "ABCDE"))
        for n in names
    ]
    req = LayoutRequest(
        nodes=nodes,
        edges=edges,
        algorithm="UMAP",
        scope="coupled",
        selected_layers=["L1", "L2"],
    )
    pos, _ = compute_layout(req)
    assert len(pos) == 9
    for n in "ABCD":
        assert pos[f"{n}_L1"] == pos[f"{n}_L2"]


def test_per_layer_and_selected_nodes_scopes() -> None:
    nodes, edges = _two_cliques()
    per_layer, _ = compute_layout(
        LayoutRequest(nodes=nodes, edges=edges, algorithm="UMAP", selected_layers=["L1"])
    )
    assert len(per_layer) == 12
    chosen = ["a0_L1", "a1_L1", "a2_L1", "b0_L1", "b1_L1"]
    local, _ = compute_layout(
        LayoutRequest(
            nodes=nodes,
            edges=edges,
            algorithm="UMAP",
            scope="nodesPerLayers",
            selected_layers=["L1"],
            selected_nodes=chosen,
        )
    )
    assert sorted(local) == sorted(chosen)


@pytest.mark.parametrize("count", [1, 2, 3, 4])
def test_tiny_graphs(count: int) -> None:
    nodes = [{"id": f"n{i}_L1", "label": f"n{i}", "layer": "L1"} for i in range(count)]
    edges = [_edge(f"n{i}", f"n{i + 1}") for i in range(count - 1)]
    for dim in (2, 3):
        req = LayoutRequest(
            nodes=nodes, edges=edges, algorithm="UMAP", selected_layers=["L1"], dimensions=dim
        )
        pos, _ = compute_layout(req)
        assert len(pos) == count
        assert all(len(p) == dim for p in pos.values())


def test_standardize_imputes_and_keeps_binary_columns() -> None:
    table = np.array([[1.0, 0.0, 5.0], [3.0, 1.0, 5.0], [np.nan, 1.0, 5.0]])
    out = standardize(table)
    assert out[:, 0].tolist() == pytest.approx([-math.sqrt(1.5), math.sqrt(1.5), 0.0])
    assert out[:, 1].tolist() == [0.0, 1.0, 1.0]  # a 0/1 column stays as it is
    assert out[:, 2].tolist() == [0.0, 0.0, 0.0]  # constant: no information


def test_endpoint_runs_umap() -> None:
    resp = client.post("/api/layout", json=_karate(metric="cosine").model_dump())
    assert resp.status_code == 200
    assert len(resp.json()["positions"]) == 34
