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
        "stringId_A": "9606.P_TP53",
        "stringId_B": "9606.P_MDM2",
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
        "stringId_A": "9606.P_MDM2",
        "stringId_B": "9606.P_TP53",
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
        "stringId_A": "9606.P_TP53",
        "stringId_B": "9606.P_ATM",
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

STRING_GENES = {"TP53": "tumor protein p53", "MDM2": "E3 ubiquitin ligase", "ATM": "kinase"}
STRING_ENRICHMENT = [
    {
        "category": "KEGG",
        "term": "hsa04115",
        "description": "p53 signaling pathway",
        "inputGenes": "9606.P_TP53,9606.P_MDM2,9606.P_ATM",
        "preferredNames": "TP53,MDM2,ATM",
        "fdr": 1e-6,
        "p_value": 1e-8,
    },
    {  # two members by name only, mapped back by preferred name
        "category": "Process",
        "term": "GO:0006915",
        "description": "apoptotic process",
        "inputGenes": ["x", "y"],
        "preferredNames": ["tp53", "MDM2"],
        "fdr": 0.01,
    },
    {  # above the FDR cut-off
        "category": "Process",
        "term": "GO:0000001",
        "description": "weak term",
        "inputGenes": "9606.P_TP53,9606.P_MDM2",
        "preferredNames": "TP53,MDM2",
        "fdr": 0.5,
    },
    {  # one member: below the smallest group
        "category": "Component",
        "term": "GO:0005634",
        "description": "nucleus",
        "inputGenes": "9606.P_TP53",
        "preferredNames": "TP53",
        "fdr": 0.001,
    },
    {  # a collection outside the known list
        "category": "NewThing",
        "term": "N1",
        "description": "new collection term",
        "inputGenes": "9606.P_TP53,9606.P_ATM",
        "preferredNames": "TP53,ATM",
        "fdr": 0.001,
    },
]


def string_answer(url: str, params: dict[str, str]) -> str:
    """STRING's JSON API, by method."""
    method = url.rsplit("/", 1)[-1]
    if method == "version":
        return json.dumps([{"string_version": "12.0", "stable_address": "https://version-12-0"}])
    if method == "get_string_ids":
        names = params["identifiers"].split("\r")
        rows = []
        for i, n in enumerate(names):
            gene = n.removeprefix("9606.P_").upper()  # names, or ids for descriptions
            if gene in STRING_GENES:
                rows.append(
                    {
                        "queryIndex": i,
                        "queryItem": n,
                        "stringId": f"9606.P_{gene}",
                        "preferredName": gene,
                        "taxonName": "Homo sapiens",
                        "annotation": STRING_GENES[gene],
                    }
                )
        return json.dumps(rows)
    if method == "network":
        return json.dumps(STRING_ROWS)
    if method in ("enrichment", "functional_annotation"):
        return json.dumps(STRING_ENRICHMENT)
    raise AssertionError(url)


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

    def fake_post(url, params, *, accept="application/json"):
        calls.append(f"POST {url}?{urllib.parse.urlencode(params)}")
        host = urllib.parse.urlsplit(url).hostname or ""
        string_host = host == "string-db.org" or host.endswith(".string-db.org")
        if url.startswith(config.STRING_API) or string_host:
            return string_answer(url, params)
        raise AssertionError(url)

    monkeypatch.setattr(db, "_get", fake_get)
    monkeypatch.setattr(db, "_post", fake_post)
    return calls


@pytest.fixture(autouse=True)
def no_string_gap(monkeypatch):
    monkeypatch.setattr(config, "STRING_CALL_GAP_SECONDS", 0)


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
    assert set(net["channels"]) == {
        "Experiments",
        "Curated databases",
        "Text mining",
        "Co-expression",
    }


def test_intact_parses_mitab(fake_http) -> None:
    rows, left_out = db.fetch_intact(["TP53", "MDM2"], 9606, min_score=0.4)
    got = {(r.source, r.target): r.weight for r in rows}
    assert got == {("MDM2", "TP53"): 0.98, ("DAXX", "MDM2"): 0.9}
    assert left_out == 0


def test_intact_among_matches_uniprot_ids(fake_http) -> None:
    # the MITAB rows carry uniprotkb:P<gene>; typed accessions match them
    rows, left_out = db.fetch_intact(["PTP53", "pmdm2"], 9606, 0.4, only_among=True)
    assert [(r.source, r.target) for r in rows] == [("MDM2", "TP53")]
    assert left_out == 1  # MDM2-DAXX


def test_intact_quoted_names_do_not_break_the_import(monkeypatch) -> None:
    # IntAct names such as "ccsb isoform id: ndn_2" used to end the TSV in an
    # unterminated quote -> HTTP 500
    cols = [
        "uniprotkb:P04637",
        "intact:EBI-1",
        "-",
        "-",
        "uniprotkb:TP53(gene name)",
        'psi-mi:"ccsb isoform id: ndn_2"(display_short)',
    ]
    line = "\t".join(cols + ["-"] * 8 + ["intact-miscore:0.9"])
    monkeypatch.setattr(db, "_get", lambda *a, **k: line)
    res = client.post(
        "/api/import/databases",
        json={"identifiers": ["TP53"], "databases": ["IntAct"]},
    )
    assert res.status_code == 200, res.text
    assert {n["label"] for n in res.json()["nodes"]} == {"TP53", "ccsb isoform id: ndn_2"}


def test_one_protein_brings_its_partners(fake_http) -> None:
    net = db.import_per_database(["TP53"], 9606, ["OmniPath"], 0.4, only_among=True)
    assert {n.label for n in net.nodes} == {"TP53", "MDM2", "ATM", "CDK1"}
    assert any("partners are included" in w for w in net.warnings)


def test_none_among_explains_the_checkbox(fake_http) -> None:
    res = client.post(
        "/api/import/databases",
        json={"identifiers": ["TP53", "INS"], "databases": ["OmniPath"]},
    )
    assert res.status_code == 400
    assert "Untick" in res.json()["detail"] and "3 interactions" in res.json()["detail"]


def test_omnipath_names_case_and_organisms(fake_http) -> None:
    db.fetch_omnipath(["tp53", "p04637"], 9606)
    assert "partners=TP53%2CP04637" in fake_http[-1]
    db.fetch_omnipath(["TRP53", "MDM2"], 10090)
    assert "partners=Trp53%2CMdm2" in fake_http[-1]
    with pytest.raises(db.DatabaseError, match="human, mouse and rat"):
        db.fetch_omnipath(["p53"], 7227)


def test_omnipath_error_text_is_a_clean_error(monkeypatch) -> None:
    monkeypatch.setattr(db, "_get", lambda *a, **k: "Something is not entirely good")
    res = client.post(
        "/api/import/databases",
        json={"identifiers": ["TP53", "MDM2"], "databases": ["OmniPath"]},
    )
    assert res.status_code == 502


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
    monkeypatch.setattr(db, "_post", lambda *a, **k: "[]")
    res = client.post("/api/import/string", json={"identifiers": ["NOPE"]})
    assert res.status_code == 400
    assert "found none of the names" in res.json()["detail"]


def test_upstream_failure_502(monkeypatch) -> None:
    def boom(*a, **k):
        raise db.UpstreamError("Could not reach string-db.org")

    monkeypatch.setattr(db, "_post", boom)
    res = client.post("/api/import/string", json={"identifiers": ["TP53"]})
    assert res.status_code == 502


def test_string_error_payload_400(monkeypatch) -> None:
    monkeypatch.setattr(db, "_post", lambda *a, **k: json.dumps({"Error": "species unknown"}))
    res = client.post("/api/import/string", json={"identifiers": ["TP53"], "species": 1})
    assert res.status_code == 400


def test_edge_cap_enforced(fake_http, monkeypatch) -> None:
    monkeypatch.setattr(config, "MAX_EDGES", 2)
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


# ---------------------------------------------------------------- STRING options (NORMA card)
def _string(fake_http, **body):
    res = client.post("/api/import/string", json={"identifiers": ["TP53", "MDM2", "ATM"], **body})
    assert res.status_code == 200, res.text
    return res.json()


def _sent(calls: list[str], method: str) -> dict[str, str]:
    """The form fields of the (last) STRING call to `method`."""
    url = [c for c in calls if c.startswith("POST ") and f"/json/{method}?" in c][-1]
    return dict(urllib.parse.parse_qsl(url.split("?", 1)[1]))


def test_combining_one_channel_gives_its_own_score() -> None:
    assert db.combine_string_scores([0.9]) == pytest.approx(0.9)
    assert db.combine_string_scores([]) == pytest.approx(db.STRING_PRIOR)
    # two channels give more confidence than either alone
    assert db.combine_string_scores([0.6, 0.5]) > 0.6


def test_string_looks_names_up_then_asks_with_string_ids(fake_http) -> None:
    net = _string(fake_http, network_type="physical", add_nodes=20, required_score=0.7)
    sent = _sent(fake_http, "network")
    assert sent["identifiers"].split("\r") == ["9606.P_TP53", "9606.P_MDM2", "9606.P_ATM"]
    assert sent["network_type"] == "physical"
    assert sent["add_nodes"] == "20"
    assert sent["required_score"] == "700"
    assert sent["caller_identity"] == "arena3d"
    assert _sent(fake_http, "get_string_ids")["echo_query"] == "1"
    assert net["string_version"] == "12.0"
    assert net["taxon_name"] == "Homo sapiens"


def test_string_unknown_names_are_noted(fake_http) -> None:
    res = client.post("/api/import/string", json={"identifiers": ["TP53", "atm", "NOPE"]})
    assert res.status_code == 200, res.text
    warnings = " ".join(res.json()["warnings"])
    assert "Not found in STRING: NOPE" in warnings
    assert "Matched" not in warnings  # a case-only difference is no rename (NORMA)


def test_string_ticked_channels_recompute_confidence(fake_http) -> None:
    # TP53-ATM has no experimental evidence: with Experiments alone it drops
    net = _string(fake_http, channels=["escore"], required_score=0.4)
    pairs = {frozenset((e["source_node"], e["target_node"])) for e in net["edges"]}
    assert pairs == {frozenset(("TP53", "MDM2"))}
    assert net["channels"] == ["Experiments"]
    assert any("Left out 1 connection" in w for w in net["warnings"])
    assert any("ATM" in w and "not shown" in w for w in net["warnings"])


def test_string_combined_edges_one_per_pair(fake_http) -> None:
    net = _string(fake_http, edge_mode="combined")
    assert net["channels"] == []
    assert len(net["edges"]) == 2  # TP53-MDM2 and TP53-ATM, each once


def test_string_descriptions_and_links(fake_http) -> None:
    net = _string(fake_http, descriptions=True, address="https://version-12-0.string-db.org/")
    info = {n["name"]: n for n in net["node_info"]}
    assert info["TP53"]["description"] == "tumor protein p53"
    assert info["TP53"]["url"] == "https://version-12-0.string-db.org/network/9606.P_TP53"
    assert info["TP53"]["query"] is True
    # descriptions are asked for the proteins of the network, by STRING id
    assert "9606.P_ATM" in _sent(fake_http, "get_string_ids")["identifiers"]
    assert any(c.startswith("POST https://version-12-0.string-db.org/api/") for c in fake_http)


def test_string_without_descriptions_makes_no_extra_call(fake_http) -> None:
    net = _string(fake_http)
    assert all(n["description"] is None for n in net["node_info"])
    assert sum("/json/get_string_ids?" in c for c in fake_http) == 1


def test_string_address_allow_list(fake_http) -> None:
    for bad in ["http://string-db.org", "https://evil.example", "https://string-db.org.evil.io"]:
        res = client.post("/api/import/string", json={"identifiers": ["TP53"], "address": bad})
        assert res.status_code == 400, bad
    assert not any(c.startswith("POST") for c in fake_http)


def test_string_groupings_from_enrichment(fake_http) -> None:
    net = _string(
        fake_http,
        groupings={"categories": ["KEGG", "Process", "Component"], "fdr": 0.05, "min_group": 2},
    )
    groups = {g["category"]: g for g in net["groupings"]}
    assert list(groups) == ["Process", "KEGG"]  # STRING's collection order; nucleus too small
    assert groups["KEGG"]["name"] == "KEGG pathways"
    assert groups["KEGG"]["terms"][0]["members"] == ["TP53", "MDM2", "ATM"]
    # FDR filter keeps only the apoptosis term; its members mapped back by name
    assert [t["description"] for t in groups["Process"]["terms"]] == ["apoptotic process"]
    assert groups["Process"]["terms"][0]["members"] == ["TP53", "MDM2"]
    assert "/json/enrichment?" in " ".join(fake_http)


def test_string_groupings_all_annotations_and_other_collections(fake_http) -> None:
    net = _string(
        fake_http,
        groupings={
            "mode": "annotation",
            "categories": ["Process"],
            "other_categories": True,
            "max_terms": 1,
        },
    )
    groups = {g["category"]: g for g in net["groupings"]}
    assert set(groups) == {"Process", "NewThing"}
    assert len(groups["Process"]["terms"]) == 1  # groups per collection
    assert groups["Process"]["terms"][0]["fdr"] is None  # no FDR without enrichment
    assert "/json/functional_annotation?" in " ".join(fake_http)


def test_string_groupings_failure_keeps_the_network(fake_http, monkeypatch) -> None:
    def post(url, params, **k):
        if url.endswith("/enrichment"):
            raise db.UpstreamError("Could not reach string-db.org")
        return string_answer(url, params)

    monkeypatch.setattr(db, "_post", post)
    net = _string(fake_http, groupings={})
    assert net["groupings"] == []
    assert any("Groupings couldn't be fetched" in w for w in net["warnings"])


def test_string_raw_answers_from_the_browser(monkeypatch) -> None:
    def no_http(*a, **k):
        raise AssertionError("the server must not call STRING")

    monkeypatch.setattr(db, "_post", no_http)
    ids = json.loads(string_answer("x/get_string_ids", {"identifiers": "TP53\rMDM2\rATM"}))
    res = client.post(
        "/api/import/string",
        json={
            "identifiers": ["TP53", "MDM2", "ATM"],
            "descriptions": True,
            "groupings": {"categories": ["KEGG"]},
            "raw": {
                "version": [{"string_version": "12.0"}],
                "ids": ids,
                "network": STRING_ROWS,
                "info": ids,
                "terms": STRING_ENRICHMENT,
            },
        },
    )
    assert res.status_code == 200, res.text
    net = res.json()
    assert net["string_version"] == "12.0"
    assert {n["name"]: n["description"] for n in net["node_info"]}["MDM2"] == "E3 ubiquitin ligase"
    assert [g["category"] for g in net["groupings"]] == ["KEGG"]


def test_string_groupings_for_the_current_view(fake_http) -> None:
    res = client.post(
        "/api/import/string/groupings",
        json={"identifiers": ["TP53", "MDM2", "ATM"], "groupings": {"categories": ["Process"]}},
    )
    assert res.status_code == 200, res.text
    terms = res.json()["groupings"][0]["terms"]
    assert terms[0]["members"] == ["TP53", "MDM2"]  # node names as they were sent
    # the names go to STRING as they are
    assert _sent(fake_http, "enrichment")["identifiers"] == "TP53\rMDM2\rATM"


def test_string_option_limits_422() -> None:
    base = {"identifiers": ["TP53"]}
    for extra in [
        {"add_nodes": 501},
        {"network_type": "genetic"},
        {"edge_mode": "both"},
        {"groupings": {"fdr": 0}},
        {"groupings": {"max_terms": 0}},
    ]:
        assert client.post("/api/import/string", json={**base, **extra}).status_code == 422, extra
