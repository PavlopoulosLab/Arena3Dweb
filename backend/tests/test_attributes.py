from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

# the Edit → Attributes columns, absent
NO_NODE_STYLE = {
    "shape": None,
    "opacity": None,
    "label": None,
    "label_color": None,
    "label_size": None,
    "label_style": None,
    "label_position": None,
    "label_shown": None,
}
NO_EDGE_STYLE = {"width": None, "opacity": None, "line_type": None, "arrow_color": None}


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
            **NO_NODE_STYLE,
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
        **NO_NODE_STYLE,
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
    assert r.json() == [
        {"edge_pair": "A_L1---B_L2", "color": "#00ff00", "channel": "ppi", **NO_EDGE_STYLE}
    ]


def test_edge_attributes_without_channel() -> None:
    tsv = "SourceNode\tSourceLayer\tTargetNode\tTargetLayer\tColor\nA\tL1\tB\tL2\t#000\n"
    r = _post("edges", tsv)
    assert r.status_code == 200
    assert r.json()[0]["channel"] is None


def test_node_attributes_edit_attributes_columns() -> None:
    # what Edit → Attributes → Export node attributes writes
    tsv = (
        "Node\tLayer\tColor\tSize\tShape\tOpacity\tLabel\tLabelColor\tLabelSize\t"
        "LabelStyle\tLabelPosition\tLabelShown\tUrl\tDescription\tAnnotation\n"
        "A\tL1\t#ff0000\t1.5\tCube\t0.4\tHub\t#00ff00\t20\thalo #ffffff 3 bold\tCentre\tyes\t"
        "\tkinase\tGO:1;GO:2\n"
        "B\tL1\t#00ff00\t1\t\t\t\t\t\t\t\t\t\t\t\n"
    )
    r = _post("nodes", tsv)
    assert r.status_code == 200
    a, b = r.json()
    assert a["shape"] == "cube"
    assert a["opacity"] == 0.4
    assert (a["label"], a["label_color"], a["label_size"]) == ("Hub", "#00ff00", 20)
    # the frontend reads the label look; the position is lower-cased
    assert (a["label_style"], a["label_position"]) == ("halo #ffffff 3 bold", "centre")
    assert a["label_shown"] is True
    assert a["annotations"] == ["GO:1", "GO:2"]
    assert {k: b[k] for k in NO_NODE_STYLE} == NO_NODE_STYLE


def test_node_attributes_opacity_out_of_range() -> None:
    r = _post("nodes", "Node\tLayer\tOpacity\nA\tL1\t1.5\n")
    assert r.status_code == 400
    assert "Opacity values must be between 0 and 1" in r.json()["detail"]
    r = _post("nodes", "Node\tLayer\tLabelSize\nA\tL1\thuge\n")
    assert r.status_code == 400


def test_edge_attributes_edit_attributes_columns() -> None:
    tsv = (
        "SourceNode\tSourceLayer\tTargetNode\tTargetLayer\tChannel\tColor\tWidth\tOpacity\tLineType\tArrowColor\n"
        "A\tL1\tB\tL1\t\t#ff0000\t2.5\t0.5\tDashed\t#0000ff\n"
    )
    r = _post("edges", tsv)
    assert r.status_code == 200
    assert r.json() == [
        {
            "edge_pair": "A_L1---B_L1",
            "color": "#ff0000",
            "channel": None,
            "width": 2.5,
            "opacity": 0.5,
            "line_type": "dashed",
            "arrow_color": "#0000ff",
        }
    ]


def test_edge_attributes_bad_line_type_and_width() -> None:
    head = "SourceNode\tSourceLayer\tTargetNode\tTargetLayer\tColor\t"
    r = _post("edges", f"{head}LineType\nA\tL1\tB\tL1\t#000\twavy\n")
    assert r.status_code == 400
    assert "solid, dashed or dotted" in r.json()["detail"]
    r = _post("edges", f"{head}Width\nA\tL1\tB\tL1\t#000\t0\n")
    assert r.status_code == 400


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
