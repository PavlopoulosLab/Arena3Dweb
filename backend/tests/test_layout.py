import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.layout import LayoutRequest
from app.services.layouts import LAYOUTS, compute_layout

client = TestClient(app)


def _net():
    # two layers, a small clique each, one inter-layer edge
    nodes = [
        {"id": "A_L1", "label": "A", "layer": "L1"},
        {"id": "B_L1", "label": "B", "layer": "L1"},
        {"id": "C_L1", "label": "C", "layer": "L1"},
        {"id": "D_L2", "label": "D", "layer": "L2"},
        {"id": "E_L2", "label": "E", "layer": "L2"},
    ]

    def edge(src, trg, sl, tl):
        s, t = src.split("_")[0], trg.split("_")[0]
        return {
            "src": src,
            "trg": trg,
            "source_node": s,
            "source_layer": sl,
            "target_node": t,
            "target_layer": tl,
            "weight": 1.0,
            "scaled_weight": 0.5,
            "channel": None,
        }

    edges = [
        edge("A_L1", "B_L1", "L1", "L1"),
        edge("B_L1", "C_L1", "L1", "L1"),
        edge("A_L1", "C_L1", "L1", "L1"),
        edge("D_L2", "E_L2", "L2", "L2"),
        edge("C_L1", "D_L2", "L1", "L2"),  # inter-layer
    ]
    return nodes, edges


def _req(**kw):
    nodes, edges = _net()
    base = dict(
        nodes=nodes,
        edges=edges,
        algorithm="Fruchterman-Reingold",
        scope="perLayer",
        selected_layers=["L1", "L2"],
    )
    base.update(kw)
    return LayoutRequest(**base)


def test_all_registered_algorithms_run() -> None:
    for algo in LAYOUTS:
        pos, _ = compute_layout(_req(algorithm=algo))
        assert pos, f"{algo} produced no positions"
        for coord in pos.values():
            assert len(coord) == 2


def test_per_layer_excludes_inter_layer_edges() -> None:
    # perLayer L1 should place only L1 nodes reachable via intra-layer edges
    pos, _ = compute_layout(_req(selected_layers=["L1"]))
    assert set(pos) == {"A_L1", "B_L1", "C_L1"}


def test_all_layers_scope_places_both_layers() -> None:
    pos, _ = compute_layout(_req(scope="allLayers"))
    assert {"A_L1", "D_L2"} <= set(pos)


def test_no_edge_layout_places_isolated_nodes() -> None:
    # add a node with no intra-layer edge; Grid must still place it
    nodes, edges = _net()
    nodes.append({"id": "Z_L1", "label": "Z", "layer": "L1"})
    req = LayoutRequest(
        nodes=nodes,
        edges=edges,
        algorithm="Grid",
        scope="perLayer",
        selected_layers=["L1"],
    )
    pos, _ = compute_layout(req)
    assert "Z_L1" in pos


def test_seed_is_deterministic() -> None:
    a, _ = compute_layout(_req(algorithm="Fruchterman-Reingold", seed=7))
    b, _ = compute_layout(_req(algorithm="Fruchterman-Reingold", seed=7))
    assert a == b


def test_channel_filter_drops_unselected() -> None:
    nodes, edges = _net()
    for e in edges:
        e["channel"] = "keep"
    edges[0]["channel"] = "drop"  # A_L1-B_L1
    req = LayoutRequest(
        nodes=nodes,
        edges=edges,
        algorithm="Circle",
        scope="perLayer",
        selected_layers=["L1"],
        selected_channels=["keep"],
    )
    pos, _ = compute_layout(req)
    # A-B edge dropped but A,B still reachable via C's edges → all three present
    assert set(pos) == {"A_L1", "B_L1", "C_L1"}


def test_unknown_algorithm_400() -> None:
    resp = client.post(
        "/api/layout",
        json={
            "nodes": _net()[0],
            "edges": _net()[1],
            "algorithm": "Nope",
            "scope": "perLayer",
            "selected_layers": ["L1"],
        },
    )
    assert resp.status_code == 400


def test_endpoint_returns_positions() -> None:
    nodes, edges = _net()
    resp = client.post(
        "/api/layout",
        json={
            "nodes": nodes,
            "edges": edges,
            "algorithm": "Kamada-Kawai",
            "scope": "allLayers",
            "selected_layers": ["L1", "L2"],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["positions"]


def test_nodes_per_layer_scope() -> None:
    pos, _ = compute_layout(
        _req(
            scope="nodesPerLayers",
            selected_layers=["L1"],
            selected_nodes=["A_L1", "B_L1", "C_L1"],
            algorithm="Circle",
        )
    )
    assert set(pos) <= {"A_L1", "B_L1", "C_L1"}


@pytest.mark.parametrize("algo", ["Circle", "Grid", "Random"])
def test_no_edge_layouts_registered(algo: str) -> None:
    assert algo in LAYOUTS


def _weighted_triangle():
    """L1 triangle: A-B on channel 'strong', B-C and A-C on 'weak'."""
    nodes, edges = _net()
    channels = {("A_L1", "B_L1"): "strong", ("B_L1", "C_L1"): "weak", ("A_L1", "C_L1"): "weak"}
    for e in edges:
        e["channel"] = channels.get((e["src"], e["trg"]), "weak")
    return nodes, edges


def _dist(pos, a, b) -> float:
    (ay, az), (by, bz) = pos[a], pos[b]
    return float(((ay - by) ** 2 + (az - bz) ** 2) ** 0.5)


@pytest.mark.parametrize("algo", ["Fruchterman-Reingold", "Kamada-Kawai", "DrL"])
def test_channel_weight_pulls_channel_together(algo: str) -> None:
    nodes, edges = _weighted_triangle()
    pos, _ = compute_layout(
        _req(
            nodes=nodes,
            edges=edges,
            algorithm=algo,
            selected_layers=["L1"],
            use_weights=True,
            channel_weights={"strong": 10.0, "weak": 0.1},
        )
    )
    strong = _dist(pos, "A_L1", "B_L1")
    assert strong < _dist(pos, "B_L1", "C_L1")
    assert strong < _dist(pos, "A_L1", "C_L1")


def test_channel_weights_ignored_without_use_weights() -> None:
    nodes, edges = _weighted_triangle()
    base, _ = compute_layout(_req(nodes=nodes, edges=edges))
    same, _ = compute_layout(
        _req(nodes=nodes, edges=edges, channel_weights={"strong": 10.0, "weak": 0.1})
    )
    assert base == same


def test_use_weights_runs_for_every_algorithm() -> None:
    # algorithms without a weighted variant fall back to the unweighted one
    for algo in LAYOUTS:
        pos, _ = compute_layout(_req(algorithm=algo, use_weights=True))
        assert pos


@pytest.mark.parametrize("bad", [0.0, -1.0, 11.0])
def test_channel_weight_out_of_range_422(bad: float) -> None:
    nodes, edges = _net()
    body = {
        "nodes": nodes,
        "edges": edges,
        "algorithm": "Circle",
        "selected_layers": ["L1"],
        "use_weights": True,
        "channel_weights": {"x": bad},
    }
    assert client.post("/api/layout", json=body).status_code == 422


def _multiplex():
    """Labels A, B, C in three layers (A-B, B-C intra edges) + coupling edges + a D only in L3."""
    nodes = [
        {"id": f"{lab}_{lay}", "label": lab, "layer": lay}
        for lay in ("L1", "L2", "L3")
        for lab in ("A", "B", "C")
    ] + [{"id": "D_L3", "label": "D", "layer": "L3"}]

    def edge(s, t, sl, tl):
        return {
            "src": f"{s}_{sl}",
            "trg": f"{t}_{tl}",
            "source_node": s,
            "source_layer": sl,
            "target_node": t,
            "target_layer": tl,
            "weight": 1.0,
            "scaled_weight": 0.5,
            "channel": None,
        }

    edges = [edge("A", "B", lay, lay) for lay in ("L1", "L2")]
    edges += [edge("B", "C", lay, lay) for lay in ("L2", "L3")]
    edges += [edge("A", "A", "L1", "L2"), edge("B", "B", "L2", "L3"), edge("C", "D", "L3", "L3")]
    return nodes, edges


@pytest.mark.parametrize("algo", ["Fruchterman-Reingold", "Circle", "Kamada-Kawai"])
def test_coupled_aligns_labels_across_layers(algo: str) -> None:
    nodes, edges = _multiplex()
    pos, _ = compute_layout(
        _req(
            nodes=nodes,
            edges=edges,
            algorithm=algo,
            scope="coupled",
            selected_layers=["L1", "L2", "L3"],
        )
    )
    for lab in ("A", "B", "C"):
        assert pos[f"{lab}_L1"] == pos[f"{lab}_L2"] == pos[f"{lab}_L3"]
    assert "D_L3" in pos  # label only present in one layer is still placed


def test_coupled_only_places_selected_layers() -> None:
    nodes, edges = _multiplex()
    pos, _ = compute_layout(
        _req(nodes=nodes, edges=edges, scope="coupled", selected_layers=["L1", "L2"])
    )
    assert not any(k.endswith("_L3") for k in pos)
    assert pos["A_L1"] == pos["A_L2"]


def test_coupled_with_clustering_shares_cluster_ids() -> None:
    nodes, edges = _multiplex()
    pos, clusters = compute_layout(
        _req(
            nodes=nodes,
            edges=edges,
            scope="coupled",
            selected_layers=["L1", "L2", "L3"],
            clustering={"algorithm": "Louvain", "local_layout": "Circle"},
        )
    )
    assert clusters is not None
    assert clusters["B_L1"] == clusters["B_L2"] == clusters["B_L3"]
    assert pos["B_L1"] == pos["B_L3"]


def test_merge_by_label_drops_coupling_edges() -> None:
    from app.models.network import EdgeModel
    from app.services.graph import merge_by_label

    _, edges = _multiplex()
    merged = merge_by_label([EdgeModel(**e) for e in edges])
    assert all(e.src != e.trg for e in merged)
    assert {(e.src, e.trg) for e in merged} == {("A", "B"), ("B", "C"), ("C", "D")}


@pytest.mark.parametrize("algo", ["Fruchterman-Reingold", "Kamada-Kawai", "DrL", "Random", "Grid"])
def test_3d_layout_returns_depth(algo: str) -> None:
    pos, _ = compute_layout(_req(algorithm=algo, selected_layers=["L1"], dimensions=3))
    assert set(pos) == {"A_L1", "B_L1", "C_L1"}
    assert all(len(p) == 3 for p in pos.values())
    if algo != "Grid":  # a 3-node 3D grid fills one plane
        assert any(p[2] != 0 for p in pos.values())


def test_3d_layout_weighted_runs() -> None:
    pos, _ = compute_layout(_req(selected_layers=["L1"], dimensions=3, use_weights=True))
    assert all(len(p) == 3 for p in pos.values())


@pytest.mark.parametrize(
    "kw",
    [
        {"algorithm": "Sugiyama"},  # no 3D version
        {"clustering": {"algorithm": "Louvain", "local_layout": "Circle"}},
    ],
)
def test_3d_layout_rejects(kw: dict) -> None:
    from app.services.layouts import LayoutError

    base = {"selected_layers": ["L1"], "dimensions": 3} | kw
    with pytest.raises(LayoutError):
        compute_layout(_req(**base))


def test_2d_layout_still_returns_pairs() -> None:
    pos, _ = compute_layout(_req())
    assert all(len(p) == 2 for p in pos.values())


def test_3d_layout_per_layer_on_several_layers() -> None:
    # Phase 20: containers — each layer gets its own 3D layout
    pos, _ = compute_layout(_req(selected_layers=["L1", "L2"], dimensions=3))
    assert {k for k in pos} == {"A_L1", "B_L1", "C_L1", "D_L2", "E_L2"}
    assert all(len(p) == 3 for p in pos.values())


def test_3d_layout_all_layers_as_one_space() -> None:
    # Phase 19: "3D network" — one 3D layout over every selected layer
    pos, _ = compute_layout(_req(scope="allLayers", selected_layers=["L1", "L2"], dimensions=3))
    assert len(pos) == 5 and all(len(p) == 3 for p in pos.values())


def test_quadratic_layouts_are_capped(monkeypatch: pytest.MonkeyPatch) -> None:
    # Kamada-Kawai and friends build n×n structures: over the cap they are refused
    from app import config
    from app.services.layouts import LayoutError

    monkeypatch.setattr(config, "MAX_QUADRATIC_NODES", 2)
    with pytest.raises(LayoutError, match="limited to 2 nodes"):
        compute_layout(_req(algorithm="Kamada-Kawai"))
    compute_layout(_req(algorithm="Fruchterman-Reingold"))  # linear ones still run

    # HTTP path: /api/layout runs in a worker process (crash isolation), so a
    # monkeypatched config value in this process doesn't reach it — exercise
    # the real default cap with a genuinely oversized request instead.
    big_nodes = [{"id": f"N{i}_L1", "label": f"N{i}", "layer": "L1"} for i in range(2001)]
    big_edges = [
        {
            "src": f"N{i}_L1",
            "trg": f"N{i + 1}_L1",
            "source_node": f"N{i}",
            "source_layer": "L1",
            "target_node": f"N{i + 1}",
            "target_layer": "L1",
            "weight": 1.0,
            "scaled_weight": 1.0,
            "channel": None,
        }
        for i in range(2000)
    ]
    big_req = LayoutRequest(
        nodes=big_nodes,
        edges=big_edges,
        algorithm="Sugiyama",
        scope="perLayer",
        selected_layers=["L1"],
    )
    resp = client.post("/api/layout", json=big_req.model_dump())
    assert resp.status_code == 400
    assert "Sugiyama is limited" in resp.json()["detail"]
