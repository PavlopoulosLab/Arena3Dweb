"""The examples in the API documentation (/api/docs, the app's API panel) run
as they are: each is posted to its endpoint here. Database imports reach other
servers, so their examples are only checked against their request models."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import databases as dbm
from app.models import examples as ex
from app.routers.databases import NdexImportRequest
from app.routers.enrichment import EnrichmentRequest

client = TestClient(app)

LOCAL = [
    ("/api/layout", ex.LAYOUT),
    ("/api/clustering", ex.CLUSTERING),
    ("/api/topology", ex.TOPOLOGY),
    ("/api/layer-similarity", ex.ANALYSED),
    ("/api/network-stats", ex.ANALYSED),
    ("/api/perturbation/knockout", ex.KNOCKOUT),
    ("/api/perturbation/attack", ex.ATTACK),
    ("/api/plots", ex.PLOTS),
    ("/api/share", ex.SHARE),
    ("/api/external", ex.SESSION),
    ("/api/session/export", ex.SESSION),
]


@pytest.mark.parametrize(("path", "body"), LOCAL, ids=[p for p, _ in LOCAL])
def test_each_documented_example_runs(path: str, body: dict[str, Any]) -> None:
    r = client.post(path, json=body)
    assert r.status_code == 200, r.text


def test_the_open_example_runs() -> None:
    schema = app.openapi()["components"]["schemas"]["OpenRequest"]
    r = client.post("/api/open", json=schema["examples"][0])
    assert r.status_code == 200, r.text
    assert "/?session=" in r.json()["url"]


@pytest.mark.parametrize(
    ("model", "body"),
    [
        (dbm.StringImportRequest, ex.STRING_IMPORT),
        (dbm.StringGroupingsRequest, ex.STRING_GROUPINGS),
        (dbm.DatabaseImportRequest, ex.DATABASES_IMPORT),
        (dbm.ReactomeImportRequest, ex.REACTOME_IMPORT),
        (dbm.GoImportRequest, ex.GO_IMPORT),
        (NdexImportRequest, ex.NDEX_IMPORT),
        (EnrichmentRequest, ex.ENRICHMENT),
    ],
)
def test_import_examples_match_their_models(model: Any, body: dict[str, Any]) -> None:
    model(**body)


def test_every_json_endpoint_has_an_example() -> None:
    spec = app.openapi()
    schemas = spec["components"]["schemas"]
    missing = []
    for path, ops in spec["paths"].items():
        for method, op in ops.items():
            body = op.get("requestBody", {}).get("content", {}).get("application/json")
            if not body:
                continue
            ref = body["schema"].get("$ref", "")
            has = bool(body.get("examples")) or bool(
                schemas.get(ref.split("/")[-1], {}).get("examples")
            )
            if not has:
                missing.append(f"{method.upper()} {path}")
    assert missing == []


def test_config_lists_what_the_endpoints_accept() -> None:
    cfg = client.get("/api/config").json()
    assert cfg["version"] == app.version
    assert "Fruchterman-Reingold" in cfg["layouts"] and "UMAP" in cfg["layouts"]
    assert "Louvain" in cfg["clustering_algorithms"]
    assert cfg["docs"]["openapi"] == "/api/openapi.json"
