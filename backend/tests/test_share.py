"""Export → Open in Gephi Lite: a file hosted for one hour behind a token."""

import os
import time

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.routers.external import _tmp_path

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


def test_tmp_path_stays_in_tmp() -> None:
    base = os.path.abspath(config.TMP_PATH)
    assert _tmp_path("abcdefghijklmnop", ".share.json") == os.path.join(
        base, "abcdefghijklmnop.share.json"
    )
    for bad in ["../secrets", "a/b", "/etc/passwd", "../"]:
        with pytest.raises(HTTPException):
            _tmp_path(bad, ".json")


def test_share_size_cap() -> None:
    r = client.post(
        "/api/share", json={"content": "x" * (5 * 1024 * 1024 + 1), "media_type": "text/plain"}
    )
    assert r.status_code == 413


def test_share_hosts_cosmograph_csvs() -> None:
    """Export → Open in Cosmograph: the links and nodes CSVs, fetched by
    cosmograph.app (another origin), which reads the whole file by its length."""
    links = "source,target,weight,channel,source_layer,target_layer\nA_L1,B_L1,1,,L1,L1\n"
    nodes = "id,label,layer,color,size,cluster,annotations\nA_L1,A,L1,#ff0000,1,,\n"
    for content, name in ((links, "arena3d_cosmograph_links.csv"), (nodes, "x_nodes.csv")):
        r = client.post(
            "/api/share", json={"content": content, "media_type": "text/csv", "name": name}
        )
        assert r.status_code == 200, r.text
        got = client.get(
            f"/api/share/{r.json()['token']}", headers={"Origin": "https://cosmograph.app"}
        )
        assert got.text == content
        assert got.headers["content-type"].startswith("text/csv")
        assert got.headers["access-control-allow-origin"] == "*"
        assert got.headers["content-length"] == str(len(content.encode()))
        assert got.headers["content-disposition"].startswith("attachment")
        assert got.headers["x-content-type-options"] == "nosniff"


def test_links_expire_after_the_ttl_without_a_new_upload(tmp_path, monkeypatch) -> None:
    """A shared link and a hosted file stop working an hour after they were made,
    and are deleted then, even when no later upload has run the sweep."""
    from app.routers import external

    monkeypatch.setattr("app.routers.external.config.TMP_PATH", str(tmp_path) + "/")
    hosted = client.post("/api/share", json={"content": "a\tb\n", "media_type": "text/plain"})
    session = {"layers": [{"name": "L1"}], "nodes": [{"name": "A", "layer": "L1"}], "edges": []}
    shared = client.post("/api/external", json=session)
    assert hosted.status_code == 200 and shared.status_code == 200, shared.text
    share_url = f"/api/share/{hosted.json()['token']}"
    external_url = f"/api/external/{shared.json()['token']}"
    assert client.get(share_url).status_code == 200
    assert client.get(external_url).status_code == 200

    old = time.time() - external.TTL_SECONDS - 1
    for f in tmp_path.glob("*.json"):
        os.utime(f, (old, old))
    assert client.get(share_url).status_code == 404
    assert client.get(external_url).status_code == 404
    assert list(tmp_path.glob("*.json")) == []
