"""POST /api/clustering: communities without a layout."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def node(label: str, layer: str) -> dict:
    return {"id": f"{label}_{layer}", "label": label, "layer": layer}


def edge(s: str, sl: str, t: str, tl: str) -> dict:
    return {
        "src": f"{s}_{sl}",
        "trg": f"{t}_{tl}",
        "source_node": s,
        "source_layer": sl,
        "target_node": t,
        "target_layer": tl,
        "weight": 1,
        "scaled_weight": 1,
        "channel": None,
    }


# two triangles per layer, the same names in both layers
LAYERS = ["A", "B"]
NODES = [node(n, layer) for layer in LAYERS for n in ["p", "q", "r", "x", "y", "z"]]
EDGES = [
    e
    for layer in LAYERS
    for e in [
        edge("p", layer, "q", layer),
        edge("q", layer, "r", layer),
        edge("r", layer, "p", layer),
        edge("x", layer, "y", layer),
        edge("y", layer, "z", layer),
        edge("z", layer, "x", layer),
    ]
] + [edge("p", "A", "p", "B")]


def test_per_layer_communities_are_distinct_across_layers() -> None:
    r = client.post(
        "/api/clustering",
        json={"nodes": NODES, "edges": EDGES, "algorithm": "Louvain", "selected_layers": LAYERS},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["count"] == 4
    c = body["clusters"]
    assert len(c) == 12
    assert c["p_A"] == c["q_A"] == c["r_A"] != c["x_A"]
    assert c["p_B"] == c["q_B"] != c["p_A"]  # ids do not collide between layers


def test_coupled_scope_shares_communities_by_name() -> None:
    r = client.post(
        "/api/clustering",
        json={
            "nodes": NODES,
            "edges": EDGES,
            "algorithm": "Leiden",
            "scope": "coupled",
            "selected_layers": LAYERS,
        },
    )
    assert r.status_code == 200, r.text
    c = r.json()["clusters"]
    assert c["p_A"] == c["p_B"] and c["x_A"] == c["x_B"]
    assert c["p_A"] != c["x_A"]
    assert r.json()["count"] == 2


def test_all_layers_as_one_graph_and_unknown_algorithm() -> None:
    r = client.post(
        "/api/clustering",
        json={
            "nodes": NODES,
            "edges": EDGES,
            "algorithm": "Walktrap",
            "scope": "allLayers",
            "selected_layers": LAYERS,
        },
    )
    assert r.status_code == 200, r.text
    assert len(r.json()["clusters"]) == 12
    bad = client.post(
        "/api/clustering",
        json={"nodes": NODES, "edges": EDGES, "algorithm": "Nope", "selected_layers": LAYERS},
    )
    assert bad.status_code == 400
