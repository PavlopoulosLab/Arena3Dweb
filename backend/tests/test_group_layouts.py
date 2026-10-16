"""NORMA-2.0 group layouts (virtual node, group gravity, super nodes)."""

import math
import random

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.group_layouts import GroupLayoutError, group_layout

client = TestClient(app)


def _net(seed: int = 3):
    """3 groups of 12 nodes, dense inside, plenty of noise links between groups."""
    rng = random.Random(seed)
    groups = {f"G{g}": [f"n{g}_{i}" for i in range(12)] for g in range(3)}
    ids = [n for ms in groups.values() for n in ms]
    edges = set()
    for ms in groups.values():
        for _ in range(20):
            a, b = rng.sample(ms, 2)
            edges.add((a, b, 1.0))
    for _ in range(25):  # cross-group noise
        a, b = rng.sample(ids, 2)
        edges.add((a, b, 1.0))
    groups_of = {n: [g] for g, ms in groups.items() for n in ms}
    return ids, sorted(edges), groups_of, groups


def _separation(pos, groups):
    """mean distance between groups / mean distance inside groups (>1 = separated)."""

    def d(a, b):
        return math.dist(pos[a], pos[b])

    inside, between = [], []
    keys = list(groups)
    for g in keys:
        ms = groups[g]
        inside += [d(a, b) for i, a in enumerate(ms) for b in ms[i + 1 :]]
        for h in keys:
            if h > g:
                between += [d(a, b) for a in ms for b in groups[h]]
    return (sum(between) / len(between)) / (sum(inside) / len(inside))


@pytest.mark.parametrize(
    "strategy,local",
    [
        ("virtual", "keep"),
        ("gravity", "keep"),
        ("virtual", "Circle"),
        ("supernodes", "Fruchterman-Reingold"),
    ],
)
def test_strategies_separate_groups(strategy: str, local: str) -> None:
    ids, edges, groups_of, groups = _net()
    pos = group_layout(ids, edges, groups_of, strategy, "Fruchterman-Reingold", local=local)
    assert set(pos) == set(ids)
    assert _separation(pos, groups) > 1.8


def test_plain_layout_separates_less() -> None:
    ids, edges, groups_of, groups = _net()
    plain = group_layout(ids, edges, {}, "gravity", "Fruchterman-Reingold")  # no groups = plain FR
    grouped = group_layout(ids, edges, groups_of, "gravity", "Fruchterman-Reingold")
    assert _separation(grouped, groups) > _separation(plain, groups)


def test_gravity_force_strengthens_separation() -> None:
    ids, edges, groups_of, groups = _net()
    weak = group_layout(ids, edges, groups_of, "gravity", "Fruchterman-Reingold", force=1)
    strong = group_layout(ids, edges, groups_of, "gravity", "Fruchterman-Reingold", force=20)
    assert _separation(strong, groups) > _separation(weak, groups)


def test_supernode_discs_do_not_overlap() -> None:
    ids, edges, groups_of, groups = _net()
    pos = group_layout(ids, edges, groups_of, "supernodes", "Fruchterman-Reingold", local="Circle")
    centers = {
        g: [sum(c) / len(ms) for c in zip(*(pos[m] for m in ms), strict=True)]
        for g, ms in groups.items()
    }
    radius = {g: max(math.dist(pos[m], centers[g]) for m in ms) for g, ms in groups.items()}
    keys = list(groups)
    for i, a in enumerate(keys):
        for b in keys[i + 1 :]:
            assert math.dist(centers[a], centers[b]) >= radius[a] + radius[b] - 1e-6


def test_node_in_two_groups_sits_between() -> None:
    ids, edges, groups_of, groups = _net()
    groups_of["n0_0"] = ["G0", "G1"]
    pos = group_layout(ids, edges, groups_of, "supernodes", "Circle", local="Circle")
    c0 = [sum(c) / 11 for c in zip(*(pos[m] for m in groups["G0"][1:]), strict=True)]
    c1 = [sum(c) / 12 for c in zip(*(pos[m] for m in groups["G1"]), strict=True)]
    mid = [(a + b) / 2 for a, b in zip(c0, c1, strict=True)]
    assert math.dist(pos["n0_0"], mid) < math.dist(c0, c1) / 2


def test_3d_group_layout_for_containers() -> None:
    ids, edges, groups_of, groups = _net()
    pos = group_layout(
        ids, edges, groups_of, "supernodes", "Fruchterman-Reingold", local="Kamada-Kawai", dim=3
    )
    assert all(len(p) == 3 for p in pos.values())
    assert _separation(pos, groups) > 1.8


def test_validation() -> None:
    ids, edges, groups_of, _ = _net()
    with pytest.raises(GroupLayoutError):
        group_layout(ids, edges, groups_of, "supernodes", "Fruchterman-Reingold", local="keep")
    with pytest.raises(GroupLayoutError):
        group_layout(ids, edges, groups_of, "virtual", "Sugiyama", dim=3)  # no 3D version


def test_endpoint_per_layer_and_across_layers() -> None:
    ids, edges, groups_of, _ = _net()
    nodes = [{"id": f"{n}_{lay}", "label": n, "layer": lay} for lay in ("L1", "L2") for n in ids]
    e_rows = [
        {
            "src": f"{a}_{lay}",
            "trg": f"{b}_{lay}",
            "source_node": a,
            "source_layer": lay,
            "target_node": b,
            "target_layer": lay,
            "weight": 1.0,
            "scaled_weight": 1.0,
            "channel": None,
        }
        for lay in ("L1", "L2")
        for a, b, _ in edges
    ]
    groups = {f"{n}_{lay}": gs for lay in ("L1", "L2") for n, gs in groups_of.items()}
    body = {
        "nodes": nodes,
        "edges": e_rows,
        "algorithm": "Fruchterman-Reingold",
        "selected_layers": ["L1", "L2"],
        "group_strategy": "supernodes",
        "group_local": "Circle",
        "groups": groups,
    }
    res = client.post("/api/layout", json=body)
    assert res.status_code == 200, res.text
    assert len(res.json()["positions"]) == len(nodes)
    # layers as the groups, one 3D layout across layers
    by_layer = {n["id"]: [n["layer"]] for n in nodes}
    res = client.post(
        "/api/layout",
        json={
            **body,
            "scope": "allLayers",
            "groups": by_layer,
            "dimensions": 3,
            "group_local": "Fruchterman-Reingold",
        },
    )
    assert res.status_code == 200, res.text
    assert all(len(p) == 3 for p in res.json()["positions"].values())
    bad = client.post("/api/layout", json={**body, "scope": "coupled"})
    assert bad.status_code == 400
