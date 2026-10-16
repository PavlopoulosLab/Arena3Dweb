"""POST /api/open: a plain edge list (or TSV text) becomes a laid-out session behind a link."""

import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app

client = TestClient(app)

EDGES = [
    {"source": "A", "target": "B", "source_layer": "L1"},
    {"source": "B", "target": "C", "source_layer": "L1", "weight": 2},
    {"source": "A", "target": "C", "source_layer": "L1"},
    {"source": "A", "target": "A", "source_layer": "L1", "target_layer": "L2"},
    {"source": "A", "target": "D", "source_layer": "L2", "weight": 0.5},
    {"source": "D", "target": "E", "source_layer": "L2"},
]


@pytest.fixture(autouse=True)
def _tmp_store(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("app.routers.external.config.TMP_PATH", str(tmp_path) + "/")


def test_edges_become_a_laid_out_session_behind_a_link() -> None:
    resp = client.post(
        "/api/open",
        json={
            "edges": EDGES,
            "nodes": [
                {"name": "A", "color": "#ff0000", "size": 2, "url": "https://example.org/A"},
                {"name": "D", "layer": "L2", "description": "a node", "annotations": ["T1"]},
            ],
            "directed": True,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert (body["layers"], body["nodes"], body["edges"]) == (2, 6, 6)
    assert body["url"].endswith(f"/?session={body['token']}")

    session = client.get(f"/api/external/{body['token']}").json()
    assert [row["name"] for row in session["layers"]] == ["L1", "L2"]
    assert session["direction"] is True
    assert session["scramble_nodes"] is False  # positions came from the layout
    nodes = {(n["name"], n["layer"]): n for n in session["nodes"]}
    assert len(nodes) == 6
    # laid out and fitted into the floor: not all at one spot, within the width
    ys = {float(n["position_y"]) for n in nodes.values()}
    assert len(ys) > 1
    half = config.FLOOR_DEFAULT_WIDTH / 2
    assert all(
        abs(float(n["position_y"])) <= half and abs(float(n["position_z"])) <= half
        for n in nodes.values()
    )
    # node extras: every copy of A, only the L2 copy of D
    for layer in ("L1", "L2"):
        assert nodes[("A", layer)]["color"] == "#ff0000"
        assert float(nodes[("A", layer)]["scale"]) == 2
        assert nodes[("A", layer)]["url"] == "https://example.org/A"
    assert nodes[("D", "L2")]["descr"] == "a node"
    assert nodes[("D", "L2")]["annotations"] == ["T1"]
    # weights scaled like an upload; no channels
    opacities = {float(e["opacity"]) for e in session["edges"]}
    assert max(opacities) == 1.0 and min(opacities) == pytest.approx(0.1)
    assert all("channel" not in e for e in session["edges"])


def test_tsv_text_and_random_placement() -> None:
    tsv = (
        "SourceNode\tSourceLayer\tTargetNode\tTargetLayer\tChannel\n"
        "A\tL1\tB\tL1\tppi\nA\tL1\tB\tL1\tcoexp\n"
    )
    resp = client.post("/api/open", json={"tsv": tsv, "layout": None})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["channels"] == ["coexp", "ppi"]
    session = client.get(f"/api/external/{body['token']}").json()
    assert session["scramble_nodes"] is True  # no layout: the client scatters the nodes
    assert {e["channel"] for e in session["edges"]} == {"ppi", "coexp"}


def test_channels_must_be_all_or_none() -> None:
    edges = [dict(EDGES[0], channel="ppi"), EDGES[1]]
    resp = client.post("/api/open", json={"edges": edges})
    assert resp.status_code == 400
    assert "channel" in resp.json()["detail"]


@pytest.mark.parametrize(
    ("payload", "fragment"),
    [
        ({}, "either"),
        ({"edges": EDGES, "tsv": "x"}, "either"),
        ({"edges": []}, "empty"),
        ({"edges": EDGES, "layout": "Spiral"}, "Unknown layout"),
        ({"edges": EDGES, "nodes": [{"name": "Z"}]}, "not in the network"),
        ({"edges": [{"source": "A\tB", "target": "C"}]}, "tabs"),
    ],
)
def test_bad_requests_are_400_with_a_message(payload, fragment) -> None:
    resp = client.post("/api/open", json=payload)
    assert resp.status_code == 400, resp.text
    assert fragment in resp.json()["detail"]


def test_upload_limits_apply(monkeypatch) -> None:
    monkeypatch.setattr("app.services.parser.config.MAX_EDGES", 3)
    resp = client.post("/api/open", json={"edges": EDGES})
    assert resp.status_code == 400
    assert "no more than 3 edges" in resp.json()["detail"]


def test_schema_errors_are_422() -> None:
    resp = client.post("/api/open", json={"edges": [{"source": "A"}]})
    assert resp.status_code == 422
    resp = client.post("/api/open", json={"edges": EDGES, "nodes": [{"name": "A", "color": "red"}]})
    assert resp.status_code == 422


def test_docs_reachable_under_api_and_cors_allowed() -> None:
    assert client.get("/api/docs").status_code == 200
    spec = client.get("/api/openapi.json").json()
    assert "/api/open" in spec["paths"]
    assert {t["name"] for t in spec["tags"]} >= {"Sharing", "Layouts", "Analysis"}
    assert spec["paths"]["/api/open"]["post"]["summary"] == "Open a network in Arena3D"
    resp = client.post(
        "/api/open", json={"edges": EDGES}, headers={"Origin": "https://normaviz.org"}
    )
    assert resp.headers.get("access-control-allow-origin") == "*"


def test_node_links_must_be_web_links() -> None:
    # a javascript: link would run in the viewer's browser; only http(s) and mailto
    bad = {"edges": EDGES, "nodes": [{"name": "A", "url": "javascript:alert(1)"}]}
    assert client.post("/api/open", json=bad).status_code == 422
    good = {"edges": EDGES, "nodes": [{"name": "A", "url": "https://example.org/A"}]}
    assert client.post("/api/open", json=good).status_code == 200
