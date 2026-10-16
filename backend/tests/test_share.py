"""Export → Open in Gephi Lite: a file hosted for one hour behind a token."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

GRAPHML = '<?xml version="1.0"?><graphml><graph id="G"><node id="A"/></graph></graphml>'


def test_share_round_trip() -> None:
    r = client.post(
        "/api/share",
        json={"content": GRAPHML, "media_type": "application/graphml+xml", "name": "net.graphml"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["url"].endswith(f"/api/share/{body['token']}")
    got = client.get(f"/api/share/{body['token']}")
    assert got.status_code == 200
    assert got.text == GRAPHML
    assert got.headers["content-type"].startswith("application/graphml+xml")
    assert "net.graphml" in got.headers["content-disposition"]
    # served as a download in a sandbox, never as a page of this origin
    assert got.headers["content-disposition"].startswith("attachment")
    assert "sandbox" in got.headers["content-security-policy"]
    assert got.headers["x-content-type-options"] == "nosniff"
    # served with CORS so a web tool on another origin can fetch it
    cors = client.get(f"/api/share/{body['token']}", headers={"Origin": "https://gephi.org"})
    assert cors.headers.get("access-control-allow-origin") == "*"


def test_share_rejects_other_types_and_unknown_tokens() -> None:
    r = client.post("/api/share", json={"content": "x", "media_type": "application/octet-stream"})
    assert r.status_code == 400
    assert client.get("/api/share/not-a-token!").status_code == 404
    assert client.get("/api/share/abcdefghijklmnop").status_code == 404


def test_share_size_cap() -> None:
    r = client.post(
        "/api/share", json={"content": "x" * (5 * 1024 * 1024 + 1), "media_type": "text/plain"}
    )
    assert r.status_code == 413
