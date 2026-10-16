"""Enrichment endpoint + annotation parsing (HTTP mocked)."""

import json

from fastapi.testclient import TestClient

from app.main import app
from app.services import databases as db
from app.services.attributes import parse_node_attributes_tsv
from app.services.session import normalize_session

client = TestClient(app)

ROWS = [
    {
        "category": "PMID",
        "term": "PMID:1",
        "description": "paper",
        "fdr": 1e-20,
        "p_value": 1e-21,
        "preferredNames": ["TP53"],
    },
    {
        "category": "KEGG",
        "term": "hsa04115",
        "description": "p53 signaling",
        "fdr": 1e-8,
        "p_value": 1e-9,
        "preferredNames": ["TP53", "MDM2"],
    },
    {
        "category": "Process",
        "term": "GO:0006977",
        "description": "DNA damage response",
        "fdr": 1e-5,
        "p_value": 1e-6,
        "preferredNames": ["TP53", "ATM"],
    },
]


def test_enrichment_filters_and_sorts(monkeypatch) -> None:
    monkeypatch.setattr(db, "_get", lambda *a, **k: json.dumps(ROWS))
    # enrichment imports _get by name — patch there too
    import app.services.enrichment as en

    monkeypatch.setattr(en, "_get", lambda *a, **k: json.dumps(ROWS))
    res = client.post("/api/enrichment", json={"genes": ["TP53", "MDM2", "ATM"]})
    assert res.status_code == 200
    body = res.json()
    assert [t["term"] for t in body] == ["hsa04115", "GO:0006977"]  # PMID dropped, FDR order
    assert body[0]["genes"] == ["TP53", "MDM2"]
    res = client.post(
        "/api/enrichment", json={"genes": ["TP53"], "categories": ["PMID"], "max_terms": 1}
    )
    assert [t["term"] for t in res.json()] == ["PMID:1"]


def test_enrichment_upstream_error(monkeypatch) -> None:
    import app.services.enrichment as en

    def boom(*a, **k):
        raise db.UpstreamError("down")

    monkeypatch.setattr(en, "_get", boom)
    assert client.post("/api/enrichment", json={"genes": ["TP53"]}).status_code == 502


def test_node_attribute_annotations() -> None:
    rows = parse_node_attributes_tsv(
        "Node\tLayer\tAnnotation\nA\tL1\tKEGG p53; DNA repair ;KEGG p53\nB\tL1\t\n"
    )
    assert rows[0].annotations == ["KEGG p53", "DNA repair"]
    assert rows[1].annotations is None


def test_session_keeps_annotations() -> None:
    data = {
        "layers": [{"name": "L1"}],
        "nodes": [
            {"name": "A", "layer": "L1", "annotations": ["x", "", "y"]},
            {"name": "B", "layer": "L1", "annotations": "not-a-list"},
        ],
        "edges": [],
    }
    out = normalize_session(data)
    assert out["nodes"][0]["annotations"] == ["x", "y"]
    assert out["nodes"][1]["annotations"] == []
