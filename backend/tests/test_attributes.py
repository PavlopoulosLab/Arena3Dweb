from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _post(kind: str, text: str):
    return client.post(
        f"/api/attributes/{kind}",
        files={"file": ("attrs.tsv", text, "text/tab-separated-values")},
    )


def test_node_attributes_full_row() -> None:
    tsv = (
        "Node\tLayer\tColor\tSize\tUrl\tDescription\n"
        " aspirin \t drugs \t#ff0000\t2.5\thttp://x\thello\n"
    )
    r = _post("nodes", tsv)
    assert r.status_code == 200
    assert r.json() == [
        {
            "node_layer": "aspirin_drugs",
            "color": "#ff0000",
            "size": 2.5,
            "url": "http://x",
            "description": "hello",
            "annotations": None,
        }
    ]


def test_node_attributes_optional_columns_missing() -> None:
    r = _post("nodes", "Node\tLayer\nA\tL1\n")
    assert r.status_code == 200
    assert r.json()[0] == {
        "node_layer": "A_L1",
        "color": None,
        "size": None,
        "url": None,
        "description": None,
        "annotations": None,
    }


def test_node_attributes_missing_mandatory_column() -> None:
    r = _post("nodes", "Node\tColor\nA\t#fff\n")
    assert r.status_code == 400
    assert "Node and Layer" in r.json()["detail"]


def test_node_attributes_non_numeric_size() -> None:
    r = _post("nodes", "Node\tLayer\tSize\nA\tL1\tbig\n")
    assert r.status_code == 400


def test_edge_attributes_with_channel() -> None:
    tsv = (
        "SourceNode\tSourceLayer\tTargetNode\tTargetLayer\tColor\tChannel\n"
        "A\tL1\tB\tL2\t #00ff00 \t ppi \n"
    )
    r = _post("edges", tsv)
    assert r.status_code == 200
    assert r.json() == [{"edge_pair": "A_L1---B_L2", "color": "#00ff00", "channel": "ppi"}]


def test_edge_attributes_without_channel() -> None:
    tsv = "SourceNode\tSourceLayer\tTargetNode\tTargetLayer\tColor\nA\tL1\tB\tL2\t#000\n"
    r = _post("edges", tsv)
    assert r.status_code == 200
    assert r.json()[0]["channel"] is None


def test_edge_attributes_missing_color_column() -> None:
    r = _post("edges", "SourceNode\tSourceLayer\tTargetNode\tTargetLayer\nA\tL1\tB\tL2\n")
    assert r.status_code == 400


def test_groups_file_group_per_line_norma_format() -> None:
    tsv = (
        "Apoptosis\tTP53, BAX,BBC3\nDNA repair\tTP53;ATM;BRCA1\n"
        "# comment\n\nCell cycle\tCDKN1A\tTP53\n"
    )
    r = _post("groups", tsv)
    assert r.status_code == 200, r.text
    rows = {row["node"]: row["groups"] for row in r.json()}
    assert rows["TP53"] == ["Apoptosis", "DNA repair", "Cell cycle"]
    assert rows["BAX"] == ["Apoptosis"]
    assert rows["CDKN1A"] == ["Cell cycle"]
    assert len(rows) == 6  # TP53, BAX, BBC3, ATM, BRCA1, CDKN1A


def test_groups_file_node_per_line_with_header() -> None:
    tsv = "Node\tGroup\nTP53\tApoptosis;DNA repair\nBAX\tApoptosis\n"
    r = _post("groups", tsv)
    assert r.status_code == 200, r.text
    rows = {row["node"]: row["groups"] for row in r.json()}
    assert rows == {"TP53": ["Apoptosis", "DNA repair"], "BAX": ["Apoptosis"]}


def test_groups_file_errors_name_the_line() -> None:
    r = _post("groups", "Apoptosis\tTP53\n\tBAX\n")
    assert r.status_code == 400
    assert "Line 2" in r.json()["detail"]
    assert _post("groups", "\n\n").status_code == 400


def test_values_file_parses_blanks_and_numbers() -> None:
    tsv = "Node\tcontrol\ttreated\nTP53\t1.5\t-2\nBAX\t\t3e2\n"
    r = _post("values", tsv)
    assert r.status_code == 200, r.text
    assert r.json() == {
        "columns": ["control", "treated"],
        "rows": [
            {"node": "TP53", "values": [1.5, -2.0]},
            {"node": "BAX", "values": [None, 300.0]},
        ],
    }


def test_values_file_errors() -> None:
    r = _post("values", "Node\tcontrol\nTP53\thigh\n")
    assert r.status_code == 400
    assert "Line 2" in r.json()["detail"] and "control" in r.json()["detail"]
    assert _post("values", "Gene\n").status_code == 400
    assert "Node" in _post("values", "Score\tx\nA\t1\n").json()["detail"]
