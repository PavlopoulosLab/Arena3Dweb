from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.parser import NetworkValidationError, parse_network_tsv

client = TestClient(app)
DATA = Path(__file__).resolve().parent / "fixtures"
HDR = "SourceNode\tSourceLayer\tTargetNode\tTargetLayer"


def _post(text: str):
    return client.post(
        "/api/network", files={"file": ("net.tsv", text, "text/tab-separated-values")}
    )


def test_parses_real_multichannel_fixture() -> None:
    fixture = DATA / "aspirin_3channels.tsv"
    if not fixture.exists():
        pytest.skip("fixture missing")
    body = _post(fixture.read_text()).json()
    assert len(body["nodes"]) > 0
    assert len(body["edges"]) > 0
    assert "Drug" in body["layers"]
    assert body["channels"]  # multichannel file → non-empty


def test_scaled_weight_in_range() -> None:
    tsv = f"{HDR}\tWeight\nA\tL1\tB\tL2\t5\nC\tL1\tD\tL2\t10\n"
    edges = _post(tsv).json()["edges"]
    scaled = [e["scaled_weight"] for e in edges]
    assert min(scaled) == pytest.approx(0.1)
    assert max(scaled) == pytest.approx(1.0)


def test_constant_weight_uses_default_map_value() -> None:
    tsv = f"{HDR}\tWeight\nA\tL1\tB\tL2\t3\nC\tL1\tD\tL2\t3\n"
    edges = _post(tsv).json()["edges"]
    assert all(e["scaled_weight"] == pytest.approx(0.3) for e in edges)


def test_missing_weight_column_defaults_to_one() -> None:
    tsv = f"{HDR}\nA\tL1\tB\tL2\n"
    edges = _post(tsv).json()["edges"]
    assert edges[0]["weight"] == 1.0


def test_missing_mandatory_column_400() -> None:
    tsv = "SourceNode\tSourceLayer\tTargetNode\nA\tL1\tB\n"
    resp = _post(tsv)
    assert resp.status_code == 400
    assert "four columns" in resp.json()["detail"]


def test_two_column_edgelist_single_default_layer() -> None:
    body = _post("SourceNode\tTargetNode\nA\tB\nB\tC\n").json()
    assert body["layers"] == ["Layer1"]
    assert {n["layer"] for n in body["nodes"]} == {"Layer1"}
    assert len(body["edges"]) == 2


def test_two_column_edgelist_with_optional_columns() -> None:
    body = _post("SourceNode\tTargetNode\tWeight\tChannel\nA\tB\t2\tch1\nB\tC\t4\tch2\n").json()
    assert body["layers"] == ["Layer1"]
    assert body["channels"] == ["ch1", "ch2"]


def test_single_layer_column_still_400() -> None:
    resp = _post("SourceNode\tTargetNode\tTargetLayer\nA\tB\tL1\n")
    assert resp.status_code == 400


def test_non_numeric_weight_400() -> None:
    tsv = f"{HDR}\tWeight\nA\tL1\tB\tL2\theavy\n"
    assert _post(tsv).status_code == 400


def test_infinite_weight_400() -> None:
    # #4: inf weight would map to a NaN scaled_weight — reject at parse time
    tsv = f"{HDR}\tWeight\nA\tL1\tB\tL2\tinf\n"
    assert _post(tsv).status_code == 400


def test_empty_channel_400() -> None:
    tsv = f"{HDR}\tChannel\nA\tL1\tB\tL2\t\n"
    assert _post(tsv).status_code == 400


def test_twenty_layers_and_ten_channels_load_and_a_21st_layer_is_refused() -> None:
    # a chain L1 - L2 - ... - L20, each link in its own channel (ten channels)
    rows = [f"A{i}\tL{i}\tA{i + 1}\tL{i + 1}\tc{i % 10}" for i in range(1, 20)]
    body = _post(f"{HDR}\tChannel\n" + "\n".join(rows) + "\n").json()
    assert len(body["layers"]) == 20
    assert len(body["channels"]) == 10
    rows.append("A20\tL20\tA21\tL21\tc0")
    resp = _post(f"{HDR}\tChannel\n" + "\n".join(rows) + "\n")
    assert resp.status_code == 400
    assert "no more than 20 layers" in resp.json()["detail"]


def test_duplicate_rows_collapsed() -> None:
    tsv = f"{HDR}\nA\tL1\tB\tL2\nA\tL1\tB\tL2\n"
    assert len(_post(tsv).json()["edges"]) == 1


def test_whitespace_trimmed() -> None:
    tsv = f"{HDR}\n A \tL1\tB\tL2\n"
    node_ids = [n["id"] for n in _post(tsv).json()["nodes"]]
    assert "A_L1" in node_ids


def test_empty_file_400() -> None:
    # #1a: empty upload must be a clean 400, not a pandas EmptyDataError 500
    assert _post("").status_code == 400


def test_empty_mandatory_cell_400() -> None:
    # #1b: a blank SourceLayer became NaN and 500'd EdgeModel construction
    tsv = f"{HDR}\nA\t\tB\tL2\n"
    resp = _post(tsv)
    assert resp.status_code == 400
    assert "non-empty" in resp.json()["detail"]


def test_too_many_layers_rejected() -> None:
    rows = "\n".join(f"A\tL{i}\tB\tL{i + 1}" for i in range(0, 40, 2))
    tsv = f"{HDR}\n" + rows + "\n"
    with pytest.raises(NetworkValidationError):
        parse_network_tsv(tsv)
