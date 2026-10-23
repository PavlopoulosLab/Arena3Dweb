import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.session import SessionValidationError, normalize_session

client = TestClient(app)
DATA = Path(__file__).resolve().parent / "fixtures"


def _minimal():
    return {
        "layers": [{"name": "L1"}],
        "nodes": [{"name": "A", "layer": "L1"}, {"name": "B", "layer": "L1"}],
        "edges": [{"src": "A_L1", "trg": "B_L1"}],
    }


def test_import_real_api_fixture() -> None:
    fixture = DATA / "Arena3DApp_aspirin.json"
    if not fixture.exists():
        pytest.skip("fixture missing")
    resp = client.post(
        "/api/session/import",
        files={"file": ("net.json", fixture.read_text(), "application/json")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["nodes"] and body["edges"] and body["layers"]


def test_defaults_filled_for_minimal_json() -> None:
    s = normalize_session(_minimal())
    assert s["scene"]["scale"] == "0.9"
    assert s["scene"]["color"] == "#000000"
    assert s["universalLabelColor"] == "#FFFFFF"
    assert s["scramble_nodes"] is True  # no node positions given
    assert s["nodes"][0]["color"]  # palette-assigned
    assert s["layers"][0]["generate_coordinates"] is True
    # Pre-thickness sessions render exactly as before: weight drives opacity,
    # not width.
    assert s["edgeOpacityByWeight"] is True
    assert s["edgeWidthByWeight"] is False


def test_edge_weight_encoding_flags_round_trip() -> None:
    for by_opacity, by_width in [(False, False), (True, False), (False, True), (True, True)]:
        s = normalize_session(
            {**_minimal(), "edgeOpacityByWeight": by_opacity, "edgeWidthByWeight": by_width}
        )
        assert s["edgeOpacityByWeight"] is by_opacity
        assert s["edgeWidthByWeight"] is by_width


def test_edge_bundling_strengths_clamped_and_defaulted() -> None:
    s = normalize_session(_minimal())
    assert s["intraEdgeBundling"] == 0.0
    assert s["interEdgeBundling"] == 0.0
    s = normalize_session({**_minimal(), "intraEdgeBundling": "0.6", "interEdgeBundling": 7})
    assert s["intraEdgeBundling"] == 0.6
    assert s["interEdgeBundling"] == 1.0
    s = normalize_session({**_minimal(), "intraEdgeBundling": "x", "interEdgeBundling": None})
    assert s["intraEdgeBundling"] == 0.0
    assert s["interEdgeBundling"] == 0.0


def test_arrow_layers_kept_among_the_layers_and_defaulted() -> None:
    s = normalize_session(_minimal())
    assert s["arrowLayers"] is None and s["interLayerArrows"] is True
    s = normalize_session(
        {**_minimal(), "arrowLayers": ["L1", "Nope", "L1"], "interLayerArrows": False}
    )
    assert s["arrowLayers"] == ["L1"] and s["interLayerArrows"] is False
    assert normalize_session({**_minimal(), "arrowLayers": "L1"})["arrowLayers"] is None


def test_edge_shape_defaults_and_validation() -> None:
    # parallel lines by default; Bézier curves or straight lines on request
    assert normalize_session(_minimal())["edgeShape"] == "parallel"
    assert normalize_session({**_minimal(), "edgeShape": "curved"})["edgeShape"] == "curved"
    for bad in ("x", None, {"single": "curved"}):
        assert normalize_session({**_minimal(), "edgeShape": bad})["edgeShape"] == "parallel"


def test_hive_state_kept_or_dropped() -> None:
    assert normalize_session(_minimal())["hive"] is None
    hive = {"curved": False, "right": [1, 0, 0], "up": ["0", 1, 0]}
    assert normalize_session({**_minimal(), "hive": hive})["hive"] == {
        "curved": False,
        "right": [1.0, 0.0, 0.0],
        "up": [0.0, 1.0, 0.0],
        "axes": "flat",  # sessions from before 3D axes
    }
    spread = normalize_session({**_minimal(), "hive": {**hive, "axes": "3d"}})["hive"]
    assert spread["axes"] == "3d"
    odd = normalize_session({**_minimal(), "hive": {**hive, "axes": "sphere"}})["hive"]
    assert odd["axes"] == "flat"
    for bad in ("on", {"right": [1, 0]}, {"right": [1, 0, 0], "up": [0, "x", 0]}):
        assert normalize_session({**_minimal(), "hive": bad})["hive"] is None


def test_node_and_edge_style_kept_clamped_or_dropped() -> None:
    data = _minimal()
    data["nodes"][0].update(
        opacity="0.4",
        border_color="#ff0000",
        border_width=30,
        stretch=[2, "0.5", 1],
        label="TP53 (tumour suppressor)",
        label_color="#00ff00",
        label_size=2,
    )
    data["nodes"][1].update(
        opacity="x", border_color="red", stretch=[1, 2], label="  ", label_color="#12345"
    )
    data["edges"][0].update(opacity_factor=1.5, line_type="dashed", arrow_color="#0000ff")
    s = normalize_session(data)
    a, b = s["nodes"]
    assert a["opacity"] == 0.4
    assert a["border_color"] == "#ff0000"
    assert a["border_width"] == 10  # clamped
    assert a["stretch"] == [2.0, 0.5, 1.0]
    assert a["label"] == "TP53 (tumour suppressor)"
    assert a["label_color"] == "#00ff00"
    assert a["label_size"] == 4  # clamped
    for key in ("opacity", "border_color", "stretch", "label", "label_color"):
        assert key not in b
    e = s["edges"][0]
    assert e["opacity_factor"] == 1.0
    assert e["line_type"] == "dashed"
    assert e["arrow_color"] == "#0000ff"
    odd = normalize_session(
        {**_minimal(), "edges": [{"src": "A_L1", "trg": "B_L1", "line_type": "wavy"}]}
    )
    assert "line_type" not in odd["edges"][0]


def test_label_look_and_position_kept_or_dropped() -> None:
    data = _minimal()
    data["nodes"][0].update(
        label_style={"style": "halo", "color": "#ffffff", "width": 30, "bold": True},
        label_position="centre",
    )
    data["nodes"][1].update(label_style={"style": "neon"}, label_position="left")
    a, b = normalize_session(data)["nodes"]
    assert a["label_style"] == {
        "style": "halo",
        "color": "#ffffff",
        "width": 8.0,  # clamped
        "opacity": 0.75,  # the default
        "bold": True,
    }
    assert a["label_position"] == "centre"
    assert "label_style" not in b and "label_position" not in b
    auto = {**_minimal()}
    auto["nodes"][0]["label_style"] = {"style": "box", "color": "red", "opacity": "0.5"}
    look = normalize_session(auto)["nodes"][0]["label_style"]
    assert (look["color"], look["opacity"], look["bold"]) == ("", 0.5, False)


def test_chosen_labels_and_label_mode_kept_or_dropped() -> None:
    data = _minimal()
    data["nodes"][0]["label_shown"] = True
    data["nodes"][1]["label_shown"] = "yes"  # only true counts
    s = normalize_session({**data, "nodeLabels": {"mode": "chosen", "withSelection": False}})
    assert s["nodes"][0]["label_shown"] is True
    assert "label_shown" not in s["nodes"][1]
    assert s["nodeLabels"] == {"mode": "chosen", "withSelection": False}
    # a session from before, or an unknown mode: the default on load
    assert normalize_session(_minimal())["nodeLabels"] is None
    assert normalize_session({**_minimal(), "nodeLabels": {"mode": "some"}})["nodeLabels"] is None
    loose = normalize_session({**_minimal(), "nodeLabels": {"mode": "all"}})
    assert loose["nodeLabels"] == {"mode": "all", "withSelection": True}


def test_layer_label_style_kept_or_dropped() -> None:
    data = _minimal()
    data["layers"] = [
        {
            "name": "L1",
            "label_style": {"style": "box", "color": "#000000", "opacity": 0.5},
            "label_font": "condensed",
            "label_bold": True,
            "label_italic": "yes",  # only true counts
            "label_color": "#ff0000",
            "label_position": "above",
        }
    ]
    (layer,) = normalize_session(data)["layers"]
    assert layer["label_style"]["style"] == "box"
    assert (layer["label_font"], layer["label_bold"]) == ("condensed", True)
    assert (layer["label_color"], layer["label_position"]) == ("#ff0000", "above")
    assert "label_italic" not in layer
    odd = _minimal()
    odd["layers"] = [{"name": "L1", "label_font": "comic", "label_position": "corner"}]
    (layer,) = normalize_session(odd)["layers"]
    assert "label_font" not in layer and "label_position" not in layer


def test_missing_mandatory_object_raises() -> None:
    with pytest.raises(SessionValidationError):
        normalize_session({"layers": [{"name": "L1"}], "nodes": []})


@pytest.mark.parametrize(
    "bad",
    [
        {"layers": ["x"], "nodes": [], "edges": []},
        {"layers": "abc", "nodes": [], "edges": []},
        {"layers": [{"name": "L"}], "nodes": ["n"], "edges": []},
        {"layers": [{"name": "L"}], "nodes": [], "edges": ["e"]},
    ],
)
def test_non_object_list_members_raise(bad) -> None:
    # #2: non-dict members used to 500 with AttributeError instead of a 400
    with pytest.raises(SessionValidationError):
        normalize_session(bad)


def test_empty_layer_name_raises() -> None:
    bad = _minimal()
    bad["layers"] = [{"name": ""}]
    with pytest.raises(SessionValidationError):
        normalize_session(bad)


def test_duplicate_layer_names_raise() -> None:
    bad = _minimal()
    bad["layers"] = [{"name": "L1"}, {"name": "L1"}]
    with pytest.raises(SessionValidationError):
        normalize_session(bad)


def test_node_referencing_unknown_layer_raises() -> None:
    bad = _minimal()
    bad["nodes"] = [{"name": "A", "layer": "L1"}, {"name": "B", "layer": "MISSING"}]
    with pytest.raises(SessionValidationError):
        normalize_session(bad)


def test_edge_referencing_unknown_node_raises() -> None:
    bad = _minimal()
    bad["edges"] = [{"src": "A_L1", "trg": "GHOST_L1"}]
    with pytest.raises(SessionValidationError):
        normalize_session(bad)


def test_channels_dropped_when_partial() -> None:
    s = _minimal()
    s["edges"] = [
        {"src": "A_L1", "trg": "B_L1", "channel": "x"},
        {"src": "B_L1", "trg": "A_L1", "channel": ""},
    ]
    out = normalize_session(s)
    assert all("channel" not in e for e in out["edges"])
    assert any("channel" in w.lower() for w in out["warnings"])


def test_all_empty_channels_dropped_without_warning() -> None:
    data = _minimal()
    for e in data["edges"]:
        e["channel"] = ""
    s = normalize_session(data)
    assert s["warnings"] == []
    assert all("channel" not in e for e in s["edges"])


def test_duplicate_edges_collapsed() -> None:
    s = _minimal()
    s["edges"] = [{"src": "A_L1", "trg": "B_L1"}, {"src": "A_L1", "trg": "B_L1"}]
    assert len(normalize_session(s)["edges"]) == 1


def test_export_is_download() -> None:
    resp = client.post("/api/session/export", json=_minimal())
    assert resp.status_code == 200
    assert "attachment" in resp.headers["content-disposition"]
    assert resp.json()["layers"][0]["name"] == "L1"


def test_external_create_and_resolve(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("app.config.TMP_PATH", str(tmp_path) + "/")
    monkeypatch.setattr("app.routers.external.config.TMP_PATH", str(tmp_path) + "/")
    created = client.post("/api/external", json=_minimal())
    assert created.status_code == 200
    token = created.json()["token"]
    assert token in created.json()["url"]

    resolved = client.get(f"/api/external/{token}")
    assert resolved.status_code == 200
    assert resolved.json()["layers"][0]["name"] == "L1"


def test_external_storage_capped(tmp_path, monkeypatch) -> None:
    # DoS guard (H2): stored sessions never exceed MAX_TOKENS — oldest are
    # evicted so an attacker can't fill disk with unbounded token files.
    monkeypatch.setattr("app.config.TMP_PATH", str(tmp_path) + "/")
    monkeypatch.setattr("app.routers.external.config.TMP_PATH", str(tmp_path) + "/")
    monkeypatch.setattr("app.routers.external.MAX_TOKENS", 5)

    for _ in range(20):
        assert client.post("/api/external", json=_minimal()).status_code == 200

    files = list(tmp_path.glob("*.json"))
    assert len(files) <= 5


def test_external_missing_token_404(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("app.routers.external.config.TMP_PATH", str(tmp_path) + "/")
    assert client.get("/api/external/doesnotexist").status_code == 404


def test_external_rejects_path_traversal(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("app.routers.external.config.TMP_PATH", str(tmp_path) + "/")
    resp = client.get("/api/external/..%2f..%2fetc%2fpasswd")
    assert resp.status_code in (400, 404)


def test_export_fixture_round_trips_through_import(tmp_path) -> None:
    fixture = DATA / "figure1_export.json"
    if not fixture.exists():
        pytest.skip("fixture missing")
    data = json.loads(fixture.read_text())
    # export format uses scene_pan; import treats scene as optional and fills defaults
    resp = client.post(
        "/api/session/import",
        files={"file": ("net.json", json.dumps(data), "application/json")},
    )
    assert resp.status_code == 200


def test_names_kept_when_given() -> None:
    s = normalize_session(
        {**_minimal(), "name": "  My PPI\n network ", "annotationSet": "KEGG pathways"}
    )
    assert s["name"] == "My PPI network"
    assert s["annotationSet"] == "KEGG pathways"


def test_names_absent_or_unreadable_are_none() -> None:
    assert normalize_session(_minimal())["name"] is None
    s = normalize_session({**_minimal(), "name": 42, "annotationSet": "   "})
    assert s["name"] is None
    assert s["annotationSet"] is None
    assert len(normalize_session({**_minimal(), "name": "x" * 500})["name"]) == 200


def test_names_survive_the_import_endpoint() -> None:
    resp = client.post(
        "/api/session/import",
        files={
            "file": (
                "net.json",
                json.dumps({**_minimal(), "name": "Renamed", "annotationSet": "Set A"}),
                "application/json",
            )
        },
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"
    assert resp.json()["annotationSet"] == "Set A"


def test_annotation_view_kept_clamped_or_absent() -> None:
    # older sessions have no block: nothing changes on load
    assert normalize_session(_minimal())["annotationView"] is None
    assert normalize_session({**_minimal(), "annotationView": "fog"})["annotationView"] is None
    view = {
        "source": "annotation",
        "style": "fog",
        "opacity": 0.6,
        "padding": "2",
        "pies": True,
        "hidden": ["TermA", "Cluster 2", "TermA", "", 7],
    }
    assert normalize_session({**_minimal(), "annotationView": view})["annotationView"] == {
        "source": "annotation",
        "style": "fog",
        "opacity": 0.6,
        "padding": 2.0,
        "pies": True,
        "hidden": ["TermA", "Cluster 2"],
    }
    odd = {"source": "layers", "style": "cylinder", "opacity": 9, "padding": "x", "pies": "yes"}
    assert normalize_session({**_minimal(), "annotationView": odd})["annotationView"] == {
        "source": "none",
        "style": "hull",
        "opacity": 1.0,
        "padding": 1.0,
        "pies": False,
        "hidden": [],
    }


def test_annotation_view_keeps_every_draw_as_shape() -> None:
    for style in ("hull", "outline", "fog", "cloud", "sphere", "ellipsoid", "box"):
        view = {"source": "cluster", "style": style}
        kept = normalize_session({**_minimal(), "annotationView": view})["annotationView"]
        assert kept["style"] == style


def test_annotation_view_survives_the_import_endpoint() -> None:
    view = {"source": "cluster", "style": "fog", "opacity": 0.6, "padding": 1, "pies": False}
    resp = client.post(
        "/api/session/import",
        files={
            "file": (
                "net.json",
                json.dumps({**_minimal(), "annotationView": {**view, "hidden": ["Cluster 1"]}}),
                "application/json",
            )
        },
    )
    assert resp.status_code == 200
    assert resp.json()["annotationView"] == {**view, "hidden": ["Cluster 1"]}


def test_theme_kept_or_absent() -> None:
    # older sessions have no theme: the frontend matches their background
    assert normalize_session(_minimal())["theme"] is None
    kept = {"name": "tolMuted", "applied": False}
    assert normalize_session({**_minimal(), "theme": kept})["theme"] == kept
    assert normalize_session({**_minimal(), "theme": {"name": "okabe"}})["theme"] == {
        "name": "okabe",
        "applied": True,
    }
    for odd in ("light", {"name": "<script>"}, {"name": ""}, {"applied": True}):
        assert normalize_session({**_minimal(), "theme": odd})["theme"] is None


def test_theme_survives_the_import_endpoint() -> None:
    theme = {"name": "universe", "applied": True}
    resp = client.post(
        "/api/session/import",
        files={
            "file": (
                "net.json",
                json.dumps({**_minimal(), "theme": theme}),
                "application/json",
            )
        },
    )
    assert resp.status_code == 200
    assert resp.json()["theme"] == theme
