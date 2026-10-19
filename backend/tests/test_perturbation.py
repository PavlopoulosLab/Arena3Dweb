"""Network perturbation: knockouts, edge removal, propagation, attack curves."""

import igraph as ig
import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.models.network import EdgeModel, NodeModel
from app.models.perturbation import AttackRequest, EdgePair, KnockoutRequest, TopK
from app.services import perturbation as p
from app.services.stats import network_stats

client = TestClient(app)


def _edge(s: str, sl: str, t: str, tl: str, channel: str | None = None) -> EdgeModel:
    return EdgeModel(
        src=f"{s}_{sl}",
        trg=f"{t}_{tl}",
        source_node=s,
        source_layer=sl,
        target_node=t,
        target_layer=tl,
        weight=1.0,
        scaled_weight=1.0,
        channel=channel,
    )


def _nodes(names: str, layer: str) -> list[NodeModel]:
    return [NodeModel(id=f"{x}_{layer}", label=x, layer=layer) for x in names]


def _path() -> tuple[list[NodeModel], list[EdgeModel]]:
    # A-B-C-D-E-F in one layer
    names = "ABCDEF"
    edges = [_edge(a, "L", b, "L") for a, b in zip(names, names[1:], strict=False)]
    return _nodes(names, "L"), edges


def _two_layers() -> tuple[list[NodeModel], list[EdgeModel]]:
    # L1: A-B-C (path), L2: A-B; inter-layer A_L1-A_L2 and C_L1-B_L2
    nodes = _nodes("ABC", "L1") + _nodes("AB", "L2")
    edges = [
        _edge("A", "L1", "B", "L1"),
        _edge("B", "L1", "C", "L1"),
        _edge("A", "L2", "B", "L2"),
        _edge("A", "L1", "A", "L2"),
        _edge("C", "L1", "B", "L2"),
    ]
    return nodes, edges


def _graph_net(graph: ig.Graph, layer: str = "L") -> tuple[list[NodeModel], list[EdgeModel]]:
    names = [f"n{i}" for i in range(graph.vcount())]
    edges = [_edge(names[a], layer, names[b], layer) for a, b in graph.get_edgelist()]
    return _nodes_list(names, layer), edges


def _nodes_list(names: list[str], layer: str) -> list[NodeModel]:
    return [NodeModel(id=f"{x}_{layer}", label=x, layer=layer) for x in names]


def _by_id(res: p.KnockoutResponse) -> dict[str, p.NodeChange]:
    return {n.id: n for n in res.nodes}


# ---------------------------------------------------------------- knockout
def test_knockout_splits_a_path() -> None:
    nodes, edges = _path()
    res = p.knockout(KnockoutRequest(nodes=nodes, edges=edges, layers=["L"], remove_nodes=["C_L"]))
    assert res.removed_nodes == ["C_L"]
    assert res.removed_edges == []  # C's two edges go with C
    (before,), (after,) = res.before, res.after
    assert (before.nodes, before.edges, before.components, before.largest_component) == (6, 5, 1, 6)
    assert before.diameter == 5
    assert (after.nodes, after.edges, after.components, after.largest_component) == (5, 3, 2, 3)
    assert after.diameter == 2
    assert after.efficiency < before.efficiency
    # A and B are no longer in the largest component (D-E-F)
    assert after.cut_off == 2
    by = _by_id(res)
    assert by["A_L"].cut_off_layer and by["B_L"].cut_off_layer
    assert by["A_L"].cut_off_whole  # one layer: the layer is the whole network
    assert not by["D_L"].cut_off_layer and not by["C_L"].cut_off_layer
    # D: between {A,B,C} and {E,F} before (6 pairs), an end node after
    d = by["D_L"]
    assert (d.degree, d.degree_after) == (2, 1)
    assert (d.betweenness, d.betweenness_after) == (6, 0)
    assert d.closeness_after is not None and d.closeness_after < d.closeness
    assert by["C_L"].removed and by["C_L"].degree_after is None


def test_global_efficiency_of_known_graphs() -> None:
    assert p._efficiency(ig.Graph.Full(5)) == pytest.approx(1.0)
    # path of 3: pairs at distance 1, 1, 2 -> (1 + 1 + 0.5) / 3
    assert p._efficiency(ig.Graph(n=3, edges=[(0, 1), (1, 2)])) == pytest.approx(2.5 / 3)
    assert p._efficiency(ig.Graph(n=4)) == 0.0
    # karate club, by the definition (mean of 1/d over all pairs)
    g = ig.Graph.Famous("Zachary")
    d = g.distances()
    n = g.vcount()
    expected = sum(1 / d[i][j] for i in range(n) for j in range(n) if i != j) / (n * (n - 1))
    assert p._efficiency(g) == pytest.approx(expected)


def test_measures_match_network_statistics() -> None:
    # two components: the karate club and a path of 4
    graph = ig.Graph.Famous("Zachary") + ig.Graph(n=4, edges=[(0, 1), (1, 2), (2, 3)])
    nodes, edges = _graph_net(graph)
    (stats, *_) = network_stats(nodes, edges, ["L"])
    m = p._measures("L", p.simple_graph([n.id for n in nodes], [(e.src, e.trg) for e in edges]))
    assert (m.nodes, m.edges, m.components, m.largest_component) == (
        stats.nodes,
        stats.edges,
        stats.components,
        stats.largest_component,
    )
    assert m.diameter == stats.diameter
    assert m.average_path_length == pytest.approx(stats.average_path_length)
    assert m.density == pytest.approx(stats.density)
    assert m.efficiency == pytest.approx(p._efficiency(graph))


def test_sampled_centralities_match_exact_with_every_node(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    nodes, edges = _path()
    req = KnockoutRequest(nodes=nodes, edges=edges, layers=["L"], remove_nodes=["C_L"])
    exact = p.knockout(req)
    monkeypatch.setattr(config, "MAX_QUADRATIC_NODES", 3)
    monkeypatch.setattr(config, "BETWEENNESS_SAMPLE", 6)  # every node: no error
    sampled = p.knockout(req)
    assert any("estimated" in w for w in sampled.warnings)
    for a, b in zip(exact.nodes, sampled.nodes, strict=True):
        assert a.betweenness == pytest.approx(b.betweenness)
        assert a.closeness == pytest.approx(b.closeness)
        assert (a.betweenness_after or 0) == pytest.approx(b.betweenness_after or 0)
        assert (a.closeness_after or 0) == pytest.approx(b.closeness_after or 0)


def test_star_hub_knockout_isolates_every_leaf() -> None:
    nodes, edges = _graph_net(ig.Graph.Star(8))
    res = p.knockout(
        KnockoutRequest(
            nodes=nodes,
            edges=edges,
            layers=["L"],
            top_k=TopK(metric="degree", k=1),
        )
    )
    assert res.removed_nodes == ["n0_L"]  # the hub ranks first
    (after,) = res.after
    assert (after.components, after.largest_component, after.edges) == (7, 1, 0)
    assert after.efficiency == 0.0 and after.density == 0.0


@pytest.mark.parametrize("metric", ["degree", "betweenness", "pagerank"])
def test_top_k_metrics_pick_the_hub(metric: str) -> None:
    # a star of 6 with a tail: the hub ranks first by every metric
    graph = ig.Graph.Star(6)
    graph.add_vertices(1)
    graph.add_edges([(5, 6)])
    nodes, edges = _graph_net(graph)
    res = p.knockout(
        KnockoutRequest(
            nodes=nodes,
            edges=edges,
            layers=["L"],
            top_k=TopK(metric=metric, k=1),  # type: ignore[arg-type]
        )
    )
    assert res.removed_nodes == ["n0_L"]


def test_multiplex_knockout_removes_every_copy() -> None:
    nodes, edges = _two_layers()
    one = p.knockout(
        KnockoutRequest(nodes=nodes, edges=edges, layers=["L1", "L2"], remove_nodes=["A_L1"])
    )
    assert one.removed_nodes == ["A_L1"]
    every = p.knockout(
        KnockoutRequest(
            nodes=nodes,
            edges=edges,
            layers=["L1", "L2"],
            remove_nodes=["A_L1"],
            every_copy=True,
        )
    )
    assert every.removed_nodes == ["A_L1", "A_L2"]
    assert [m.name for m in every.after] == ["L1", "L2", p.WHOLE]
    l1, l2, whole = every.after
    assert (l1.nodes, l1.edges) == (2, 1)
    assert (l2.nodes, l2.edges) == (1, 0)
    # whole network: B_L1-C_L1-B_L2 still joined by the inter-layer edge
    assert (whole.nodes, whole.edges, whole.components) == (3, 2, 1)


def test_cut_off_in_the_layer_but_not_the_whole_network() -> None:
    # without B_L1, C_L1 is alone in L1 but still reached through B_L2
    nodes, edges = _two_layers()
    res = p.knockout(
        KnockoutRequest(nodes=nodes, edges=edges, layers=["L1", "L2"], remove_nodes=["B_L1"])
    )
    c = _by_id(res)["C_L1"]
    assert c.cut_off_layer and not c.cut_off_whole
    assert [m.cut_off for m in res.after] == [1, 0, 0]


def test_a_layer_called_whole_network() -> None:
    # the layer and the whole network keep apart: A stays in its layer's giant
    # ({A} once B is gone) but is cut off from the whole network's (C-D)
    w = p.WHOLE
    nodes = _nodes("AB", w) + _nodes("CD", "L2")
    edges = [_edge("A", w, "B", w), _edge("C", "L2", "D", "L2"), _edge("B", w, "C", "L2")]
    res = p.knockout(
        KnockoutRequest(nodes=nodes, edges=edges, layers=[w, "L2"], remove_nodes=[f"B_{w}"])
    )
    assert [m.name for m in res.after] == [w, "L2", w]
    a = _by_id(res)[f"A_{w}"]
    assert a.cut_off_whole and not a.cut_off_layer
    curves = p.attack(AttackRequest(nodes=nodes, edges=edges, layers=[w, "L2"])).curves
    assert [(c.name, c.nodes) for c in curves] == [(w, 2), ("L2", 2), (w, 4)]


def test_knockout_by_names_ignores_case_and_reports_missing() -> None:
    nodes, edges = _two_layers()
    res = p.knockout(
        KnockoutRequest(nodes=nodes, edges=edges, layers=["L1", "L2"], remove_names=["b", "Zzz"])
    )
    assert res.removed_nodes == ["B_L1", "B_L2"]  # every analysed copy of B
    assert any("Zzz" in w for w in res.warnings)
    # only one layer analysed: only its copy, and no "Whole network"
    res = p.knockout(KnockoutRequest(nodes=nodes, edges=edges, layers=["L2"], remove_names=["B"]))
    assert res.removed_nodes == ["B_L2"]
    assert [m.name for m in res.after] == ["L2"]


def test_top_k_per_layer() -> None:
    nodes, edges = _two_layers()
    res = p.knockout(
        KnockoutRequest(
            nodes=nodes,
            edges=edges,
            layers=["L1", "L2"],
            top_k=TopK(metric="degree", k=1, per_layer=True),
        )
    )
    # B_L1 leads L1 (degree 2); in L2 A and B tie at 1, the first in network order wins
    assert res.removed_nodes == ["B_L1", "A_L2"]


def test_edge_removals() -> None:
    nodes = _nodes("ABC", "L1") + _nodes("A", "L2")
    edges = [
        _edge("A", "L1", "B", "L1", "ppi"),
        _edge("A", "L1", "B", "L1", "coexp"),
        _edge("B", "L1", "C", "L1", "ppi"),
        _edge("A", "L1", "A", "L2", "ppi"),
    ]
    req = KnockoutRequest(nodes=nodes, edges=edges, layers=["L1", "L2"])
    # a scene edge: every channel of the pair
    res = p.knockout(req.model_copy(update={"remove_edges": [EdgePair(src="A_L1", trg="B_L1")]}))
    assert res.removed_edges == [0, 1] and res.removed_nodes == []
    assert res.after[0].edges == 1  # B-C left in L1
    # a channel
    res = p.knockout(req.model_copy(update={"remove_channels": ["coexp"]}))
    assert res.removed_edges == [1]
    assert res.after[0].edges == 2  # A-B still joined by ppi
    # the inter-layer edges
    res = p.knockout(req.model_copy(update={"remove_inter_layer": True}))
    assert res.removed_edges == [3]
    assert res.after[-1].components == 2
    # an unselected channel is not analysed at all: nothing to remove
    with pytest.raises(p.PerturbationError):
        p.knockout(
            req.model_copy(update={"remove_channels": ["coexp"], "selected_channels": ["ppi"]})
        )


def test_random_edge_fraction_is_seeded() -> None:
    nodes, edges = _graph_net(ig.Graph.Full(6))  # 15 edges
    req = KnockoutRequest(nodes=nodes, edges=edges, layers=["L"], random_edge_fraction=0.4)
    a = p.knockout(req)
    assert len(a.removed_edges) == 6
    assert a.after[0].edges == 9
    assert p.knockout(req).removed_edges == a.removed_edges
    assert p.knockout(req.model_copy(update={"seed": 2})).removed_edges != a.removed_edges


def test_nothing_to_knock_out() -> None:
    nodes, edges = _path()
    with pytest.raises(p.PerturbationError):
        p.knockout(KnockoutRequest(nodes=nodes, edges=edges, layers=["L"], remove_names=["Q"]))


def test_propagation_before_and_after() -> None:
    nodes, edges = _path()
    res = p.knockout(
        KnockoutRequest(
            nodes=nodes,
            edges=edges,
            layers=["L"],
            remove_nodes=["C_L"],
            propagation_seeds=["A"],
        )
    )
    by = _by_id(res)
    assert sum(n.propagation or 0 for n in res.nodes) == pytest.approx(1.0)
    assert by["A_L"].propagation == max(n.propagation or 0 for n in res.nodes)
    # cut off from the seed, D-E-F get nothing; A and B keep it all
    assert by["D_L"].propagation and by["D_L"].propagation > 0
    assert by["D_L"].propagation_after == pytest.approx(0.0)
    assert (by["A_L"].propagation_after or 0) + (by["B_L"].propagation_after or 0) == (
        pytest.approx(1.0)
    )
    res = p.knockout(
        KnockoutRequest(
            nodes=nodes, edges=edges, layers=["L"], remove_nodes=["A_L"], propagation_seeds=["A"]
        )
    )
    assert any("seed" in w for w in res.warnings)


# ---------------------------------------------------------------- attack
def test_curve_points_and_shape() -> None:
    nodes, edges = _graph_net(ig.Graph.Ring(40))
    res = p.attack(AttackRequest(nodes=nodes, edges=edges, layers=["L"], steps=10, runs=3))
    (curve,) = res.curves
    assert curve.nodes == 40 and len(curve.fraction) == 11
    assert curve.fraction[0] == 0 and curve.fraction[-1] == 1
    assert curve.largest[0] == 1 and curve.largest[-1] == 0
    assert curve.largest_sd is not None and curve.largest_sd[0] == 0
    assert curve.complete and 0 < curve.robustness < 0.5
    # fewer nodes than steps: one node a step
    nodes, edges = _graph_net(ig.Graph.Ring(5))
    (small,) = p.attack(AttackRequest(nodes=nodes, edges=edges, layers=["L"], steps=50)).curves
    assert len(small.fraction) == 6
    # up to a share only
    (part,) = p.attack(
        AttackRequest(nodes=nodes, edges=edges, layers=["L"], steps=5, max_fraction=0.4)
    ).curves
    assert part.fraction[-1] == pytest.approx(0.4)


def test_targeted_attack_breaks_a_scale_free_network_faster() -> None:
    graph = ig.Graph.Barabasi(300, 2)
    graph.simplify()
    nodes, edges = _graph_net(graph)
    base = AttackRequest(nodes=nodes, edges=edges, layers=["L"], steps=20, max_fraction=0.5)
    rnd = p.attack(base.model_copy(update={"strategy": "random", "runs": 5})).curves[0]
    for strategy in ("degree", "betweenness"):
        for recalculate in (True, False):
            hit = p.attack(
                base.model_copy(update={"strategy": strategy, "recalculate": recalculate})
            ).curves[0]
            assert hit.robustness < rnd.robustness
            assert hit.largest_sd is None


def test_targeted_order_on_a_star() -> None:
    nodes, edges = _graph_net(ig.Graph.Star(10))
    for strategy in ("degree", "betweenness"):
        for recalculate in (True, False):
            (curve,) = p.attack(
                AttackRequest(
                    nodes=nodes,
                    edges=edges,
                    layers=["L"],
                    strategy=strategy,  # type: ignore[arg-type]
                    recalculate=recalculate,
                    steps=10,
                )
            ).curves
            # the hub goes first: one node per component right away
            assert curve.largest[1] == pytest.approx(0.1)
            assert curve.components[1] == 9


def test_recalculated_ranking_follows_the_damage() -> None:
    # H (degree 6) links a-e and W; W (4) links H, a, b, c; V (4) links e, x, y, z.
    # W and V tie at 4, W first. Once H is gone W drops to 3: a fixed ranking
    # removes W next, a recalculated one V, which leaves a smaller giant.
    names = ["H", "W", "V", "a", "b", "c", "d", "e", "x", "y", "z"]
    links = ["Ha", "Hb", "Hc", "Hd", "He", "HW", "Wa", "Wb", "Wc", "Ve", "Vx", "Vy", "Vz"]
    nodes = _nodes_list(names, "L")
    edges = [_edge(s[0], "L", s[1], "L") for s in links]
    req = AttackRequest(nodes=nodes, edges=edges, layers=["L"], strategy="degree", steps=11)
    once = p.attack(req.model_copy(update={"recalculate": False})).curves[0]
    again = p.attack(req).curves[0]
    assert once.largest[1] == again.largest[1] == pytest.approx(5 / 11)  # H first in both
    assert once.largest[2] == pytest.approx(5 / 11)  # W out: e-V-x-y-z stays
    assert again.largest[2] == pytest.approx(4 / 11)  # V out: W-a-b-c is the giant


def test_multilayer_curves_and_efficiency() -> None:
    nodes, edges = _two_layers()
    res = p.attack(
        AttackRequest(nodes=nodes, edges=edges, layers=["L1", "L2"], steps=5, efficiency=True)
    )
    assert [c.name for c in res.curves] == ["L1", "L2", p.WHOLE]
    for c in res.curves:
        assert c.efficiency is not None and c.efficiency[0] == pytest.approx(1.0)
        assert c.efficiency[-1] == 0


def test_whole_network_curve_only() -> None:
    nodes, edges = _two_layers()
    req = AttackRequest(nodes=nodes, edges=edges, layers=["L1", "L2"], whole_only=True)
    assert [c.name for c in p.attack(req).curves] == [p.WHOLE]


def test_efficiency_skipped_above_the_quadratic_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "MAX_QUADRATIC_NODES", 5)
    nodes, edges = _graph_net(ig.Graph.Ring(12))
    res = p.attack(
        AttackRequest(
            nodes=nodes, edges=edges, layers=["L"], strategy="betweenness", efficiency=True
        )
    )
    assert res.curves[0].efficiency is None
    assert any("efficiency" in w for w in res.warnings)
    assert res.curves[0].complete  # betweenness from sampled sources still ranks


def test_time_budget_stops_the_curves(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(config, "PERTURBATION_TIME_BUDGET", 0.0)
    nodes, edges = _two_layers()
    res = p.attack(AttackRequest(nodes=nodes, edges=edges, layers=["L1", "L2"]))
    # the whole network starts (its first point), the layers are skipped
    assert [c.name for c in res.curves] == [p.WHOLE]
    assert not res.curves[0].complete and res.curves[0].fraction == [0.0]
    assert any("time budget" in w for w in res.warnings)
    assert any("Out of time" in w for w in res.warnings)


def test_empty_layers() -> None:
    nodes, edges = _path()
    with pytest.raises(p.PerturbationError):
        p.attack(AttackRequest(nodes=nodes, edges=edges, layers=["Nope"]))
    res = p.attack(AttackRequest(nodes=nodes, edges=edges, layers=["L", "Nope"]))
    assert [c.name for c in res.curves] == ["L", "Nope", p.WHOLE]
    assert res.curves[1].nodes == 0


# ---------------------------------------------------------------- endpoints
def _json(nodes: list[NodeModel], edges: list[EdgeModel]) -> dict[str, object]:
    return {
        "nodes": [n.model_dump() for n in nodes],
        "edges": [e.model_dump() for e in edges],
    }


def test_knockout_endpoint() -> None:
    nodes, edges = _path()
    r = client.post(
        "/api/perturbation/knockout",
        json={**_json(nodes, edges), "layers": ["L"], "remove_names": ["c"]},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["removed_nodes"] == ["C_L"]
    assert body["after"][0]["components"] == 2
    r = client.post(
        "/api/perturbation/knockout",
        json={**_json(nodes, edges), "layers": ["L"]},
    )
    assert r.status_code == 400 and "Nothing to knock out" in r.json()["detail"]


def test_attack_endpoint_and_limits() -> None:
    nodes, edges = _path()
    body = {**_json(nodes, edges), "layers": ["L"], "strategy": "degree"}
    r = client.post("/api/perturbation/attack", json=body)
    assert r.status_code == 200, r.text
    assert r.json()["curves"][0]["fraction"][0] == 0
    for bad in (
        {"steps": config.MAX_ATTACK_STEPS + 1},
        {"runs": config.MAX_ATTACK_RUNS + 1},
        {"max_fraction": 0},
        {"strategy": "closeness"},
        {"layers": []},
    ):
        assert client.post("/api/perturbation/attack", json={**body, **bad}).status_code == 422
    too_many = [edges[0].model_dump()] * (config.MAX_EDGES + 1)
    r = client.post("/api/perturbation/attack", json={**body, "edges": too_many})
    assert r.status_code == 422
    r = client.post(
        "/api/perturbation/knockout",
        json={**_json(nodes, edges), "layers": ["L"], "random_edge_fraction": 1.5},
    )
    assert r.status_code == 422
