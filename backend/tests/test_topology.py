import math

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.topology import TopologyRequest
from app.services.topology import METRICS, compute_topology

client = TestClient(app)


def _star_net():
    # star: hub H connected to A,B,C in L1 → H has degree 3, leaves degree 1
    nodes = [{"id": f"{n}_L1", "label": n, "layer": "L1"} for n in ("H", "A", "B", "C")]

    def edge(a, b):
        return {
            "src": f"{a}_L1",
            "trg": f"{b}_L1",
            "source_node": a,
            "source_layer": "L1",
            "target_node": b,
            "target_layer": "L1",
            "weight": 1.0,
            "scaled_weight": 0.5,
            "channel": None,
        }

    edges = [edge("H", "A"), edge("H", "B"), edge("H", "C")]
    return nodes, edges


def _req(metric="Degree", **kw):
    nodes, edges = _star_net()
    base = dict(nodes=nodes, edges=edges, metric=metric, scope="perLayer", selected_layers=["L1"])
    base.update(kw)
    return TopologyRequest(**base)


@pytest.mark.parametrize("metric", list(METRICS))
def test_every_metric_runs(metric: str) -> None:
    scales, raw = compute_topology(_req(metric=metric))
    assert set(scales) == {"H_L1", "A_L1", "B_L1", "C_L1"}
    assert set(raw) == set(scales)


def test_degree_is_raw_not_normalized() -> None:
    _, raw = compute_topology(_req(metric="Degree"))
    assert raw["H_L1"] == 3.0  # raw degree, not centrality (which would be 1.0)
    assert raw["A_L1"] == 1.0


def test_scales_mapped_into_target_range() -> None:
    scales, _ = compute_topology(_req(metric="Degree"))
    assert min(scales.values()) == pytest.approx(0.5)
    assert max(scales.values()) == pytest.approx(2.5)


def test_constant_metric_defaults_to_one() -> None:
    # a triangle: every node has degree 2 → constant → scale defaults to 1
    nodes = [{"id": f"{n}_L1", "label": n, "layer": "L1"} for n in ("A", "B", "C")]

    def edge(a, b):
        return {
            "src": f"{a}_L1",
            "trg": f"{b}_L1",
            "source_node": a,
            "source_layer": "L1",
            "target_node": b,
            "target_layer": "L1",
            "weight": 1.0,
            "scaled_weight": 0.5,
            "channel": None,
        }

    edges = [edge("A", "B"), edge("B", "C"), edge("A", "C")]
    scales, _ = compute_topology(
        TopologyRequest(
            nodes=nodes,
            edges=edges,
            metric="Degree",
            scope="perLayer",
            selected_layers=["L1"],
        )
    )
    assert all(v == pytest.approx(1.0) for v in scales.values())


def test_single_edge_layer_is_scored() -> None:
    # one edge forms a valid 2-node graph; both endpoints get the default scale
    nodes = [{"id": f"{n}_L1", "label": n, "layer": "L1"} for n in ("A", "B")]
    edges = [
        {
            "src": "A_L1",
            "trg": "B_L1",
            "source_node": "A",
            "source_layer": "L1",
            "target_node": "B",
            "target_layer": "L1",
            "weight": 1.0,
            "scaled_weight": 0.5,
            "channel": None,
        }
    ]
    scales, _ = compute_topology(
        TopologyRequest(
            nodes=nodes, edges=edges, metric="Degree", scope="perLayer", selected_layers=["L1"]
        )
    )
    assert set(scales) == {"A_L1", "B_L1"}


@pytest.mark.parametrize("bad", [-1.0, 0.0, float("inf"), float("nan")])
def test_nonpositive_or_nonfinite_weight_clamped_not_500(bad: float) -> None:
    # #3/#4: negative/zero crashed igraph betweenness (500) and inf/nan poisoned
    # responses; build_graph now clamps to a positive floor so metrics compute
    # and every scale stays finite.
    nodes, edges = _star_net()
    for e in edges:
        e["scaled_weight"] = bad
    scales, raw = compute_topology(_req(metric="Betweenness Centrality"))
    assert set(scales) == {"H_L1", "A_L1", "B_L1", "C_L1"}
    assert all(math.isfinite(v) for v in {**scales, **raw}.values())


def test_unknown_metric_400() -> None:
    nodes, edges = _star_net()
    resp = client.post(
        "/api/topology",
        json={
            "nodes": nodes,
            "edges": edges,
            "metric": "Nope",
            "scope": "perLayer",
            "selected_layers": ["L1"],
        },
    )
    assert resp.status_code == 400


def test_endpoint_returns_scales_and_raw() -> None:
    nodes, edges = _star_net()
    resp = client.post(
        "/api/topology",
        json={
            "nodes": nodes,
            "edges": edges,
            "metric": "Betweenness Centrality",
            "scope": "perLayer",
            "selected_layers": ["L1"],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["scales"] and body["raw"]


def _chain_edges(pairs, channel=None):
    def edge(a, b):
        return {
            "src": f"{a}_L1",
            "trg": f"{b}_L1",
            "source_node": a,
            "source_layer": "L1",
            "target_node": b,
            "target_layer": "L1",
            "weight": 1.0,
            "scaled_weight": 1.0,
            "channel": channel,
        }

    return [edge(a, b) for a, b in pairs]


def test_graph_mode_directed_and_multi() -> None:
    # A → B, A → C, B → C: undirected, A and C both have two links; directed, C
    # is the sink that PageRank favours and A the source it starves
    nodes = [{"id": f"{n}_L1", "label": n, "layer": "L1"} for n in "ABC"]
    edges = _chain_edges([("A", "B"), ("A", "C"), ("B", "C")])
    base = dict(nodes=nodes, edges=edges, metric="PageRank", selected_layers=["L1"])
    _, undirected = compute_topology(TopologyRequest(**base))
    assert undirected["A_L1"] == pytest.approx(undirected["C_L1"])
    _, directed = compute_topology(TopologyRequest(**base, graph="directed"))
    assert directed["C_L1"] > directed["A_L1"]

    # two channels between A and B: merged by default, two edges as a multigraph
    multi = _chain_edges([("A", "B")], "ppi") + _chain_edges([("A", "B")], "coexp")
    base = dict(nodes=nodes[:2], edges=multi, metric="Degree", selected_layers=["L1"])
    _, merged = compute_topology(TopologyRequest(**base))
    assert merged["A_L1"] == 1
    _, kept = compute_topology(TopologyRequest(**base, graph="multi"))
    assert kept["A_L1"] == 2
    # the clustering coefficient merges parallel edges itself rather than failing
    _, cc = compute_topology(
        TopologyRequest(**dict(base, metric="Clustering Coefficient"), graph="multi")
    )
    assert cc["A_L1"] == 0.0
    resp = client.post("/api/topology", json={**base, "graph": "sideways"})
    assert resp.status_code == 422
