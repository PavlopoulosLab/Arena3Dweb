from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_config_matches_v2_constants() -> None:
    body = client.get("/api/config").json()
    assert body["max_edges"] == 10_000
    assert body["max_layers"] == 20
    assert body["max_channels"] == 10
    assert body["edge_default_color"] == "#CFCFCF"
    assert len(body["node_colors"]) == 20
    assert len(body["channel_colors_light"]) == 10
    assert len(body["channel_colors_dark"]) == 10
    assert len(set(body["channel_colors_dark"])) == 10  # every channel its own colour
    assert len(set(body["channel_colors_light"])) == 10
    assert body["channel_colors_dark"][0] == "#E41A1C"  # brewer Set1[1]
    assert body["node_colors"][0] == "#8DD3C7"  # brewer Set3[1]
    assert body["no_edge_layouts"] == ["Circle", "Grid", "Random"]
    # v2's three, Phase 21 node metrics, then the Phase 5 multilayer metrics
    expected_metrics = [
        "Degree",
        "Clustering Coefficient",
        "Betweenness Centrality",
        "Closeness Centrality",
        "Eigenvector Centrality",
        "PageRank",
        "Coreness (k-core)",
        "Eccentricity",
        "Multiplex Degree",
        "Participation Coefficient",
        "Multilayer PageRank",
    ]
    assert body["topology_metrics"] == expected_metrics


def test_health() -> None:
    assert client.get("/api/health").json() == {"status": "ok"}
