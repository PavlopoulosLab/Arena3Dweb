"""Pseudo-alignment modes (soft / anchor / chain) and the misalignment score."""

import random

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.layout import LayoutRequest
from app.models.network import EdgeModel, NodeModel
from app.services.alignment import misalignment
from app.services.layouts import LayoutError, compute_layout

client = TestClient(app)
LAYERS = ["L1", "L2", "L3"]


def _net():
    """3 layers over 20 shared labels; each layer its own random wiring."""
    rng = random.Random(7)
    labels = [f"N{i}" for i in range(20)]
    nodes = [{"id": f"{x}_{lay}", "label": x, "layer": lay} for lay in LAYERS for x in labels]
    edges = []
    for lay in LAYERS:
        pairs = set()
        while len(pairs) < 30:
            a, b = rng.sample(labels, 2)
            pairs.add((min(a, b), max(a, b)))
        edges += [
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
            for a, b in pairs
        ]
    return nodes, edges


def _run(**kw):
    nodes, edges = _net()
    req = LayoutRequest(
        nodes=nodes, edges=edges, algorithm="Fruchterman-Reingold", selected_layers=LAYERS, **kw
    )
    pos, _ = compute_layout(req)
    score = misalignment(
        pos, [NodeModel(**n) for n in nodes], [EdgeModel(**e) for e in edges], LAYERS
    )
    return pos, score


def test_independent_layout_is_misaligned() -> None:
    _, score = _run()
    assert score is not None and score > 10


def test_soft_strength_interpolates() -> None:
    _, free = _run(alignment="soft", alignment_strength=0.0)
    _, half = _run(alignment="soft", alignment_strength=0.5)
    pos, full = _run(alignment="soft", alignment_strength=1.0)
    assert full == pytest.approx(0, abs=1e-6)
    assert full < half < free
    assert pos["N3_L1"] == pytest.approx(pos["N3_L3"])


def test_anchor_pins_shared_nodes_to_reference() -> None:
    pos, pinned = _run(alignment="anchor", alignment_strength=1.0, reference_layer="L2")
    for x in ("N0", "N5", "N19"):
        assert pos[f"{x}_L1"] == pytest.approx(pos[f"{x}_L2"], abs=1e-6)
        assert pos[f"{x}_L3"] == pytest.approx(pos[f"{x}_L2"], abs=1e-6)
    scores = [
        _run(alignment="anchor", alignment_strength=k, reference_layer="L2")[1]
        for k in (0.2, 0.5, 0.8)
    ]
    _, free = _run()
    assert pinned < scores[2] < scores[1] < scores[0]  # stronger = straighter
    assert scores[1] < free


def test_chain_aligns_each_layer_to_the_previous() -> None:
    _, chained = _run(alignment="chain", alignment_strength=0.8)
    _, free = _run()
    assert chained < free


def test_alignment_validation() -> None:
    with pytest.raises(LayoutError):
        _run(alignment="soft", scope="allLayers")
    with pytest.raises(LayoutError):
        _run(alignment="anchor", reference_layer="Nope")
    with pytest.raises(LayoutError):
        _run(alignment="chain", dimensions=3)


def test_endpoint_reports_misalignment() -> None:
    nodes, edges = _net()
    body = {
        "nodes": nodes,
        "edges": edges,
        "algorithm": "Fruchterman-Reingold",
        "selected_layers": LAYERS,
        "alignment": "anchor",
        "alignment_strength": 1.0,
    }
    res = client.post("/api/layout", json=body)
    assert res.status_code == 200
    assert res.json()["misalignment"] == pytest.approx(0, abs=0.01)
    one = client.post("/api/layout", json={**body, "selected_layers": ["L1"], "alignment": "none"})
    assert one.json()["misalignment"] is None
