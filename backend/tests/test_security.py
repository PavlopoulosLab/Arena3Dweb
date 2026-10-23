"""Security hardening: request caps, time limits, body limits and the checks
on session contents (see the security review in CHANGELOG.md)."""

import asyncio
import os
import time

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import config
from app.main import app
from app.models.layout import LayoutRequest
from app.models.network import NodeModel
from app.services import compute_pool
from app.services.alignment import misalignment
from app.services.session import SessionValidationError, normalize_session

client = TestClient(app)


def _edge(a: str, b: str, la: str = "L1", lb: str = "L1") -> dict:
    return {
        "src": f"{a}_{la}",
        "trg": f"{b}_{lb}",
        "source_node": a,
        "source_layer": la,
        "target_node": b,
        "target_layer": lb,
        "weight": 1.0,
        "scaled_weight": 0.5,
        "channel": None,
    }


NODES = [{"id": f"{n}_L1", "label": n, "layer": "L1"} for n in ("A", "B", "C")]
EDGES = [_edge("A", "B"), _edge("B", "C")]


def test_a_layer_named_many_times_is_refused_or_counted_once() -> None:
    r = client.post(
        "/api/topology",
        json={"nodes": NODES, "edges": EDGES, "metric": "Degree", "selected_layers": ["L1"] * 1000},
    )
    assert r.status_code == 422
    req = LayoutRequest(
        nodes=NODES, edges=EDGES, algorithm="Circle", selected_layers=["L1", "L1", "L1"]
    )
    assert req.selected_layers == ["L1"]


def test_group_layout_groups_are_capped() -> None:
    with pytest.raises(ValidationError):
        LayoutRequest(
            nodes=NODES,
            edges=EDGES,
            algorithm="Circle",
            selected_layers=["L1"],
            groups={"A_L1": [f"g{i}" for i in range(13)]},
        )
    with pytest.raises(ValidationError):
        LayoutRequest(
            nodes=NODES,
            edges=EDGES,
            algorithm="Circle",
            selected_layers=["L1"],
            groups={f"n{i}": [f"g{i}"] for i in range(2001)},
        )


def test_misalignment_counts_one_copy_per_layer() -> None:
    # 4000 nodes with one label over two layers: every pair would be 16 M
    nodes = [NodeModel(id=f"X_{i}", label="X", layer="A" if i % 2 else "B") for i in range(4000)]
    positions = {n.id: (float(i), 0.0) for i, n in enumerate(nodes)}
    start = time.monotonic()
    misalignment(positions, nodes, [], ["A", "B"])
    assert time.monotonic() - start < 2


def test_weighted_3d_kamada_kawai_is_refused() -> None:
    r = client.post(
        "/api/layout",
        json={
            "nodes": NODES,
            "edges": EDGES,
            "algorithm": "Kamada-Kawai",
            "selected_layers": ["L1"],
            "dimensions": 3,
            "use_weights": True,
        },
    )
    assert r.status_code == 400
    assert "cannot use edge weights" in r.json()["detail"]


def test_a_compute_job_past_the_time_limit_is_stopped(monkeypatch) -> None:
    monkeypatch.setattr(config, "COMPUTE_SECONDS", 1.0)

    async def run() -> None:
        with pytest.raises(compute_pool.ComputeTimeout):
            await compute_pool.run_isolated(time.sleep, 30)
        # the pool is fresh afterwards
        assert await compute_pool.run_isolated(sum, [1, 2]) == 3

    start = time.monotonic()
    asyncio.run(run())
    compute_pool.stop()
    assert time.monotonic() - start < 25


def test_a_timed_out_job_does_not_crash_a_concurrent_healthy_one(monkeypatch) -> None:
    # each concurrency slot is its own single-worker pool: killing a slot whose
    # job overran must not affect a healthy job actively running in another
    # slot at that exact moment (not just one that finished earlier — COMPUTE_
    # SECONDS is set differently per call, read fresh each time, so the
    # healthy job is still mid-sleep, in its own process, when the stuck
    # job's kill fires).
    monkeypatch.setattr(config, "LAYOUT_WORKERS", 2)
    compute_pool.stop()  # drop any pool an earlier test sized differently

    async def run() -> None:
        monkeypatch.setattr(config, "COMPUTE_SECONDS", 0.5)
        stuck = asyncio.create_task(compute_pool.run_isolated(time.sleep, 30))
        await asyncio.sleep(0.1)  # let it claim its slot first
        monkeypatch.setattr(config, "COMPUTE_SECONDS", 5.0)
        # sleeps from t≈0.1 to t≈1.1, spanning the stuck job's kill at t≈0.5
        await compute_pool.run_isolated(time.sleep, 1.0)
        with pytest.raises(compute_pool.ComputeTimeout):
            await stuck

    start = time.monotonic()
    asyncio.run(run())
    compute_pool.stop()
    assert time.monotonic() - start < 25


def test_a_chunked_body_cannot_stream_past_the_cap(monkeypatch) -> None:
    monkeypatch.setattr(config, "MAX_UPLOAD_BYTES", 1000)

    def chunks():  # no Content-Length: the body streams in
        for _ in range(10):
            yield b"x" * 200

    r = client.post("/api/external", content=chunks())
    assert r.status_code == 413


def test_attribute_files_with_too_many_rows_are_refused() -> None:
    rows = "Node\tValue\n" + "a\t1\n" * (2 * config.MAX_NODES + 5)
    r = client.post("/api/attributes/values", files={"file": ("v.tsv", rows, "text/plain")})
    assert r.status_code == 400
    assert "rows" in r.json()["detail"]


def test_deeply_nested_gml_is_a_clean_error() -> None:
    gml = "graph [ " + "a [ " * 5000 + "] " * 5000 + "]"
    r = client.post("/api/network", files={"file": ("deep.gml", gml, "text/plain")})
    assert r.status_code == 400


def test_sessions_drop_unsafe_links_and_colours() -> None:
    session = {
        "layers": [{"name": "L1", "floor_current_color": '#fff"><img src=x onerror=alert(1)>'}],
        "nodes": [
            {"name": "A", "layer": "L1", "url": "javascript:alert(1)", "color": "red;inset:0"},
            {"name": "B", "layer": "L1", "url": "https://example.org/b", "color": "#00ff00"},
        ],
        "edges": [{"src": "A_L1", "trg": "B_L1", "color": "url(https://evil.example)"}],
    }
    out = normalize_session(session)
    a, b = out["nodes"]
    assert a["url"] == "" and b["url"] == "https://example.org/b"
    assert a["color"].startswith("#") and ";" not in a["color"]
    assert b["color"] == "#00ff00"
    assert out["layers"][0]["floor_current_color"] == config.FLOOR_DEFAULT_COLOR
    assert out["edges"][0]["color"] == config.EDGE_DEFAULT_COLOR


def test_session_names_must_be_text() -> None:
    with pytest.raises(SessionValidationError):
        normalize_session({"layers": [{"name": {}}], "nodes": [], "edges": []})
    r = client.post(
        "/api/external",
        json={"layers": [{"name": "L1"}], "nodes": [{"name": ["x"], "layer": "L1"}], "edges": []},
    )
    assert r.status_code == 400


def test_share_names_are_ascii() -> None:
    r = client.post(
        "/api/share", json={"content": "x", "media_type": "text/plain", "name": "名前.txt"}
    )
    assert r.status_code == 422


def test_the_store_is_capped_by_bytes(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("app.routers.external.config.TMP_PATH", str(tmp_path) + "/")
    monkeypatch.setattr(config, "MAX_STORE_BYTES", 3000)
    for _ in range(6):
        r = client.post("/api/share", json={"content": "x" * 1000, "media_type": "text/plain"})
        assert r.status_code == 200
    total = sum(os.path.getsize(tmp_path / f) for f in os.listdir(tmp_path))
    assert total <= 3000 + 1200  # the cap, plus the file just written
