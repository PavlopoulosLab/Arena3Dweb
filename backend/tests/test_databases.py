"""PPI importers with the HTTP layer mocked — no network in CI."""

import json
import urllib.parse

import pytest
from fastapi.testclient import TestClient

from app import config
from app.main import app
from app.services import databases as db

client = TestClient(app)

STRING_ROWS = [
    # pair listed twice (both directions) -> counted once
    {
        "preferredName_A": "TP53",
        "preferredName_B": "MDM2",
        "score": 0.999,
        "escore": 0.99,
        "dscore": 0.9,
        "tscore": 0.97,
        "ascore": 0,
        "nscore": 0,
        "fscore": 0,
        "pscore": 0,
    },
    {
        "preferredName_A": "MDM2",
        "preferredName_B": "TP53",
        "score": 0.999,
        "escore": 0.99,
        "dscore": 0.9,
        "tscore": 0.97,
        "ascore": 0,
        "nscore": 0,
        "fscore": 0,
        "pscore": 0,
    },
    {
        "preferredName_A": "TP53",
        "preferredName_B": "ATM",
        "score": 0.9,
        "escore": 0,
        "dscore": 0,
        "tscore": 0.8,
        "ascore": 0.2,
        "nscore": 0,
        "fscore": 0,
        "pscore": 0,
    },
]


def _mitab(a: str, b: str, score: float) -> str:
    cols = [
        f"uniprotkb:P{a}",
        f"uniprotkb:P{b}",
        "-",
        "-",
        f"uniprotkb:{a}(gene name)",
        f"uniprotkb:{b}(gene name)",
    ]
    cols += ["-"] * 8 + [f"intact-miscore:{score}"]
    return "\t".join(cols)


INTACT_TEXT = "\n".join(
    [
        _mitab("TP53", "MDM2", 0.98),
        _mitab("MDM2", "TP53", 0.6),  # same pair, lower score -> max kept
        _mitab("TP53", "USP7", 0.2),  # below min_score 0.4
        _mitab("MDM2", "DAXX", 0.9),  # partner outside the query
    ]
)

OMNIPATH_ROWS = [
    {"source_genesymbol": "MDM2", "target_genesymbol": "TP53", "curation_effort": 20},
    {"source_genesymbol": "ATM", "target_genesymbol": "TP53", "curation_effort": 8},
    {"source_genesymbol": "CDK1", "target_genesymbol": "TP53", "curation_effort": 3},
]


REACTOME_SEARCH = {
    "results": [
        {
            "typeName": "Pathway",
            "entries": [
                {
                    "stId": "R-HSA-109581",
                    "name": '<span class="highlighting">Apoptosis</span>',
                    "species": ["Homo sapiens"],
                },
                {
                    "stId": "R-HSA-5357801",
                    "name": "Programmed Cell Death",
                    "species": ["Homo sapiens"],
                },
            ],
        }
    ]
}
REACTOME_PARTICIPANTS = [
    {"databaseName": "UniProt", "identifier": "P04637", "name": ["TP53"]},
    {"databaseName": "UniProt", "identifier": "Q00987", "name": ["MDM2"]},
    {"databaseName": "UniProt", "identifier": "Q13315", "name": ["ATM"]},
    {"databaseName": "UniProt", "identifier": "P04637", "name": ["TP53"]},  # repeated entity
    {"databaseName": "ChEBI", "identifier": "15422", "name": ["ATP"]},  # not a gene
]
GO_SEARCH = {
    "numberOfHits": 2,
    "results": [
        {"id": "GO:0006915", "name": "apoptotic process", "aspect": "biological_process"},
        {"id": "GO:1903210", "name": "podocyte apoptotic process", "aspect": "biological_process"},
    ],
}
GO_ANNOTATIONS = {
    "1": {
        "pageInfo": {"total": 2, "current": 1},
        "results": [{"symbol": "TP53"}, {"symbol": "MDM2"}, {"symbol": "TP53"}],
    },
    "2": {"pageInfo": {"total": 2, "current": 2}, "results": [{"symbol": "ATM"}]},
}


@pytest.fixture
def fake_http(monkeypatch):
    calls: list[str] = []

    def fake_get(url, params=None, *, accept="application/json"):
        calls.append(f"{url}?{urllib.parse.urlencode(params)}" if params else url)
        if url.startswith(config.STRING_API):
            return json.dumps(STRING_ROWS)
        if url.startswith(config.INTACT_PSICQUIC):
            return INTACT_TEXT
        if url.startswith(config.OMNIPATH_API):
            return json.dumps(OMNIPATH_ROWS)
        if url.startswith(config.REACTOME_API):
            if "/search/query" in url:
                return json.dumps(REACTOME_SEARCH)
            if url.endswith("/displayName"):
                return "Apoptosis" if "R-HSA-109581" in url else "Programmed Cell Death"
            if "/referenceEntities" in url:
                return json.dumps(REACTOME_PARTICIPANTS)
        if url.startswith(config.QUICKGO_API):
            if "/ontology/go/search" in url:
                return json.dumps(GO_SEARCH)
            if "/ontology/go/terms/" in url:
                return json.dumps({"results": [{"id": "GO:0006915", "name": "apoptotic process"}]})
            if "/annotation/search" in url:
                page = params.get("page", "1") if params else "1"
                return json.dumps(GO_ANNOTATIONS[page])
        raise AssertionError(url)

    monkeypatch.setattr(db, "_get", fake_get)
    return calls


def test_string_rows_split_into_evidence_channels(fake_http) -> None:
    rows = db.fetch_string(["TP53", "MDM2", "ATM"], 9606, 0.4)
    channels = {(r.source, r.target, r.channel) for r in rows}
    assert ("MDM2", "TP53", "Experiments") in channels
    assert ("MDM2", "TP53", "Text mining") in channels
    assert ("ATM", "TP53", "Co-expression") in channels
    assert not any(r.channel == "Gene fusion" for r in rows)  # zero scores dropped
    assert len([r for r in rows if {r.source, r.target} == {"TP53", "MDM2"}]) == 3


def test_string_channel_subset(fake_http) -> None:
    rows = db.fetch_string(["TP53"], 9606, 0.4, channels=["escore"])
    assert {r.channel for r in rows} == {"Experiments"}


def test_string_endpoint_builds_one_layer(fake_http) -> None:
    res = client.post("/api/import/string", json={"identifiers": ["TP53", "MDM2", "ATM"]})
    assert res.status_code == 200
    net = res.json()
    assert net["layers"] == ["STRING"]
    assert set(net["channels"]) == {"Experiments", "Databases", "Text mining", "Co-expression"}


def test_intact_parses_mitab(fake_http) -> None:
    rows = db.fetch_intact(["TP53", "MDM2"], 9606, min_score=0.4)
    got = {(r.source, r.target): r.weight for r in rows}
    assert got == {("MDM2", "TP53"): 0.98, ("DAXX", "MDM2"): 0.9}


def test_per_database_layers_and_coupling(fake_http) -> None:
    res = client.post(
        "/api/import/databases",
        json={
            "identifiers": ["TP53", "MDM2", "ATM"],
            "databases": ["STRING", "IntAct", "OmniPath"],
        },
    )
    assert res.status_code == 200
    net = res.json()
    assert net["layers"] == ["STRING", "IntAct", "OmniPath"]
    labels = {n["label"] for n in net["nodes"]}
    assert labels == {"TP53", "MDM2", "ATM"}  # only_among drops DAXX / CDK1
    coupling = [e for e in net["edges"] if e["source_layer"] != e["target_layer"]]
    assert coupling and all(e["source_node"] == e["target_node"] for e in coupling)
    # TP53 is in all three layers -> joined STRING-IntAct and IntAct-OmniPath
    tp53 = {(e["source_layer"], e["target_layer"]) for e in coupling if e["source_node"] == "TP53"}
    assert tp53 == {("STRING", "IntAct"), ("IntAct", "OmniPath")}


def test_per_database_keeps_partners_when_asked(fake_http) -> None:
    net = db.import_per_database(["TP53", "MDM2"], 9606, ["OmniPath"], 0.4, only_among=False)
    assert "CDK1" in {n.label for n in net.nodes}


def test_unknown_database_400(fake_http) -> None:
    res = client.post("/api/import/databases", json={"identifiers": ["TP53"], "databases": ["Foo"]})
    assert res.status_code == 400


def test_nothing_found_400(monkeypatch) -> None:
    monkeypatch.setattr(db, "_get", lambda *a, **k: "[]")
    res = client.post("/api/import/string", json={"identifiers": ["NOPE"]})
    assert res.status_code == 400
    assert "No interactions" in res.json()["detail"]


def test_upstream_failure_502(monkeypatch) -> None:
    def boom(*a, **k):
        raise db.UpstreamError("Could not reach string-db.org")

    monkeypatch.setattr(db, "_get", boom)
    res = client.post("/api/import/string", json={"identifiers": ["TP53"]})
    assert res.status_code == 502


def test_string_error_payload_400(monkeypatch) -> None:
    monkeypatch.setattr(db, "_get", lambda *a, **k: json.dumps({"Error": "species unknown"}))
    res = client.post("/api/import/string", json={"identifiers": ["TP53"], "species": 1})
    assert res.status_code == 400


def test_edge_cap_enforced(monkeypatch) -> None:
    monkeypatch.setattr(config, "MAX_EDGES", 2)
    monkeypatch.setattr(db, "_get", lambda *a, **k: json.dumps(STRING_ROWS))
    res = client.post("/api/import/string", json={"identifiers": ["TP53"]})
    assert res.status_code == 400
    assert "no more than 2 edges" in res.json()["detail"]


def test_request_limits_422() -> None:
    assert client.post("/api/import/string", json={"identifiers": []}).status_code == 422
    too_many = {"identifiers": ["X"] * (config.MAX_DB_IDENTIFIERS + 1)}
    assert client.post("/api/import/string", json=too_many).status_code == 422


def test_reactome_pathways_become_layers_with_string_edges(fake_http) -> None:
    r = client.post(
        "/api/import/reactome",
        json={"pathways": ["R-HSA-109581", "R-HSA-5357801"], "required_score": 0.4},
    )
    assert r.status_code == 200, r.text
    net = r.json()
    assert net["layers"] == ["Apoptosis", "Programmed Cell Death"]
    # STRING answered TP53-MDM2 and TP53-ATM; all three genes are in each pathway
    intra = [e for e in net["edges"] if e["source_layer"] == e["target_layer"]]
    apoptosis = [e for e in intra if e["source_layer"] == "Apoptosis"]
    assert {frozenset((e["source_node"], e["target_node"])) for e in apoptosis} == {
        frozenset(("TP53", "MDM2")),
        frozenset(("TP53", "ATM")),
    }
    # copies linked across the two layers
    inter = [e for e in net["edges"] if e["source_layer"] != e["target_layer"]]
    assert {e["source_node"] for e in inter} == {"TP53", "MDM2", "ATM"}
    assert all("ATP" != n["label"] for n in net["nodes"])  # ChEBI entities are not genes
    assert any(c.startswith(config.REACTOME_API) for c in fake_http)


def test_reactome_gene_cap_is_reported(fake_http) -> None:
    r = client.post("/api/import/reactome", json={"pathways": ["R-HSA-109581"], "max_genes": 2})
    assert r.status_code == 200, r.text
    assert any("first 2 of 3 genes" in w for w in r.json()["warnings"])


def test_reactome_bad_identifier_400(fake_http) -> None:
    r = client.post("/api/import/reactome", json={"pathways": ["apoptosis"]})
    assert r.status_code == 400
    assert "R-HSA" in r.json()["detail"]


def test_reactome_search_strips_highlighting(fake_http) -> None:
    r = client.get("/api/import/reactome/search", params={"q": "apopt", "species": 9606})
    assert r.status_code == 200, r.text
    assert r.json()[0] == {"id": "R-HSA-109581", "name": "Apoptosis", "detail": "Homo sapiens"}
    assert any("species=Homo+sapiens" in c for c in fake_http)


def test_go_terms_become_layers_paging_through_annotations(fake_http) -> None:
    r = client.post("/api/import/go", json={"terms": ["go:0006915"], "taxon": 9606})
    assert r.status_code == 200, r.text
    net = r.json()
    assert net["layers"] == ["apoptotic process"]
    assert {n["label"] for n in net["nodes"]} == {"TP53", "MDM2", "ATM"}
    assert sum("page=2" in c for c in fake_http) == 1


def test_go_search_and_bad_id(fake_http) -> None:
    r = client.get("/api/import/go/search", params={"q": "apoptotic"})
    assert r.status_code == 200
    assert r.json()[0]["id"] == "GO:0006915" and r.json()[0]["detail"] == "biological process"
    assert client.post("/api/import/go", json={"terms": ["apoptosis"]}).status_code == 400


def test_http_404_from_a_database_is_a_400(monkeypatch) -> None:
    import urllib.error

    def boom(req, *args, **kwargs):
        raise urllib.error.HTTPError(req.full_url, 404, "Not Found", None, None)  # type: ignore[arg-type]

    monkeypatch.setattr(db.urllib.request, "urlopen", boom)
    r = client.post("/api/import/reactome", json={"pathways": ["R-HSA-0000001"]})
    assert r.status_code == 400
    assert "nothing for this request" in r.json()["detail"]
