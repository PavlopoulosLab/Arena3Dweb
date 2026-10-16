"""GraphML / GML / SIF / CX2 uploads and NDEx import (Phase 8)."""

import json

from fastapi.testclient import TestClient

from app.main import app
from app.services import databases as db

client = TestClient(app)

GRAPHML = """<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns">
  <key id="name" for="node" attr.name="name" attr.type="string"/>
  <key id="layer" for="node" attr.name="layer" attr.type="string"/>
  <key id="w" for="edge" attr.name="weight" attr.type="double"/>
  <key id="ch" for="edge" attr.name="channel" attr.type="string"/>
  <graph edgedefault="undirected">
    <node id="n0"><data key="name">A</data><data key="layer">L1</data></node>
    <node id="n1"><data key="name">B</data><data key="layer">L1</data></node>
    <node id="n2"><data key="name">A</data><data key="layer">L2</data></node>
    <edge source="n0" target="n1"><data key="w">2.5</data><data key="ch">ppi</data></edge>
    <edge source="n0" target="n2"><data key="w">1</data><data key="ch">same</data></edge>
  </graph>
</graphml>"""

GML = """graph [
  node [ id 0 label "X" ]
  node [ id 1 label "Y" ]
  node [ id 2 label "Z" ]
  edge [ source 0 target 1 weight 3 ]
  edge [ source 1 target 2 weight 1 ]
]"""

SIF = "A\tpp\tB\tC\nB\tpd\tD\nlonely\n"

CX2 = [
    {"CXVersion": "2.0"},
    {"nodes": [{"id": 1, "v": {"name": "P1"}}, {"id": 2, "v": {"name": "P2"}}]},
    {"edges": [{"id": 9, "s": 1, "t": 2, "v": {"interaction": "binds"}}]},
]


def _upload(name: str, text: str):
    return client.post("/api/network", files={"file": (name, text, "text/plain")})


def test_graphml_layers_weights_channels() -> None:
    res = _upload("net.graphml", GRAPHML)
    assert res.status_code == 200, res.text
    net = res.json()
    assert net["layers"] == ["L1", "L2"]
    assert set(net["channels"]) == {"ppi", "same"}
    inter = [e for e in net["edges"] if e["source_layer"] != e["target_layer"]]
    assert len(inter) == 1 and inter[0]["src"] == "A_L1"


def test_graphml_with_doctype_rejected() -> None:
    evil = GRAPHML.replace(
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<?xml version="1.0"?><!DOCTYPE g [<!ENTITY x SYSTEM "file:///etc/passwd">]>',
    )
    res = _upload("evil.graphml", evil)
    assert res.status_code == 400
    assert "DOCTYPE" in res.json()["detail"]


def test_gml_single_layer_with_weights() -> None:
    res = _upload("net.gml", GML)
    assert res.status_code == 200, res.text
    net = res.json()
    assert net["layers"] == ["Layer1"]
    assert {n["label"] for n in net["nodes"]} == {"X", "Y", "Z"}
    assert sorted(e["weight"] for e in net["edges"]) == [1, 3]


def test_sif_relations_become_channels() -> None:
    res = _upload("net.sif", SIF)
    assert res.status_code == 200, res.text
    net = res.json()
    assert set(net["channels"]) == {"pp", "pd"}
    assert len(net["edges"]) == 3  # A-B, A-C, B-D; the lone node is skipped


def test_cx2_upload() -> None:
    res = _upload("net.cx2", json.dumps(CX2))
    assert res.status_code == 200, res.text
    net = res.json()
    assert {n["label"] for n in net["nodes"]} == {"P1", "P2"}
    assert net["channels"] == ["binds"]


def test_bad_files_400() -> None:
    assert _upload("x.graphml", "<graphml><broken").status_code == 400
    assert _upload("x.cx2", "not json").status_code == 400
    assert _upload("x.sif", "only-one-column\n").status_code == 400


def test_tsv_still_default() -> None:
    res = _upload("net.tsv", "SourceNode\tTargetNode\nA\tB\n")
    assert res.status_code == 200


def test_ndex_import(monkeypatch) -> None:
    seen = []

    def fake_get(url, params=None, *, accept="application/json"):
        seen.append(url)
        return json.dumps(CX2)

    monkeypatch.setattr(db, "_get", fake_get)
    uuid = "01234567-89ab-cdef-0123-456789abcdef"
    res = client.post("/api/import/ndex", json={"uuid": uuid})
    assert res.status_code == 200, res.text
    assert seen[0].endswith(f"/v3/networks/{uuid}")
    assert client.post("/api/import/ndex", json={"uuid": "../etc"}).status_code == 422
