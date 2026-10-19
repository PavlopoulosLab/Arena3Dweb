"""Worked examples for the API documentation (/api/docs, the API panel).

One small two-layer gene network — a protein interaction layer and a
regulation layer sharing TP53 — that every network endpoint can run as is
("Try it out" in the Swagger UI). tests/test_api_examples.py posts each one
to its endpoint, so the documentation cannot drift from the code.
"""

from typing import Any

from pydantic import ConfigDict


def _edge(
    a: str, la: str, b: str, lb: str, w: float = 1.0, ch: str | None = None
) -> dict[str, Any]:
    return {
        "src": f"{a}_{la}",
        "trg": f"{b}_{lb}",
        "source_node": a,
        "source_layer": la,
        "target_node": b,
        "target_layer": lb,
        "weight": w,
        "scaled_weight": w,
        "channel": ch,
    }


_PPI = ["TP53", "MDM2", "CDKN1A", "ATM", "CHEK2"]
_REG = ["TP53", "BAX", "PUMA", "MDM2"]

NODES: list[dict[str, str]] = [{"id": f"{g}_PPI", "label": g, "layer": "PPI"} for g in _PPI] + [
    {"id": f"{g}_Regulation", "label": g, "layer": "Regulation"} for g in _REG
]

EDGES: list[dict[str, Any]] = [
    _edge("TP53", "PPI", "MDM2", "PPI", 0.99, "Experiments"),
    _edge("TP53", "PPI", "CDKN1A", "PPI", 0.95, "Experiments"),
    _edge("ATM", "PPI", "TP53", "PPI", 0.9, "Text mining"),
    _edge("ATM", "PPI", "CHEK2", "PPI", 0.85, "Experiments"),
    _edge("CHEK2", "PPI", "TP53", "PPI", 0.8, "Text mining"),
    _edge("TP53", "Regulation", "BAX", "Regulation", 0.9),
    _edge("TP53", "Regulation", "PUMA", "Regulation", 0.85),
    _edge("TP53", "Regulation", "MDM2", "Regulation", 0.8),
    _edge("TP53", "PPI", "TP53", "Regulation", 1.0),
    _edge("MDM2", "PPI", "MDM2", "Regulation", 1.0),
]

NETWORK: dict[str, Any] = {"nodes": NODES, "edges": EDGES}
LAYERS = ["PPI", "Regulation"]

LAYOUT = {
    **NETWORK,
    "algorithm": "Fruchterman-Reingold",
    "scope": "perLayer",
    "selected_layers": LAYERS,
    "use_weights": True,
}
CLUSTERING = {**NETWORK, "algorithm": "Louvain", "scope": "perLayer", "selected_layers": LAYERS}
TOPOLOGY = {
    **NETWORK,
    "metric": "Betweenness Centrality",
    "scope": "perLayer",
    "selected_layers": LAYERS,
}
ANALYSED = {**NETWORK, "layers": LAYERS}
KNOCKOUT = {**ANALYSED, "top_k": {"metric": "degree", "k": 1}, "every_copy": True}
ATTACK = {**ANALYSED, "strategy": "degree", "steps": 5}
PLOTS = {**ANALYSED, "metrics": ["Degree", "PageRank"], "extras": ["components"]}

SESSION: dict[str, Any] = {
    "layers": [{"name": "PPI"}, {"name": "Regulation"}],
    "nodes": [
        {"name": g, "layer": layer, "color": "#e41a1c" if g == "TP53" else None}
        for layer, genes in (("PPI", _PPI), ("Regulation", _REG))
        for g in genes
    ],
    "edges": [{"src": e["src"], "trg": e["trg"], "weight": e["weight"]} for e in EDGES],
}

SHARE = {
    "content": "source,target\nTP53,MDM2\nTP53,CDKN1A\n",
    "media_type": "text/csv",
    "name": "p53.csv",
}

# database imports reach STRING, EBI, OmniPath, NDEx, Reactome and QuickGO
STRING_IMPORT = {
    "identifiers": ["TP53", "MDM2", "CDKN1A", "ATM"],
    "species": 9606,
    "required_score": 0.7,
    "add_nodes": 5,
}
STRING_GROUPINGS = {"identifiers": ["TP53", "MDM2", "CDKN1A", "ATM"], "species": 9606}
DATABASES_IMPORT = {
    "identifiers": ["TP53", "MDM2", "CDKN1A"],
    "species": 9606,
    "databases": ["STRING", "IntAct", "OmniPath"],
}
NDEX_IMPORT = {"uuid": "35e031eb-45d1-11ed-b7d0-0ac135e8bacf"}  # NCI-PID p53 pathway
REACTOME_IMPORT = {"pathways": ["R-HSA-109581"], "species": 9606, "max_genes": 50}
GO_IMPORT = {"terms": ["GO:0006915"], "taxon": 9606, "max_genes": 50}
ENRICHMENT = {"genes": ["TP53", "MDM2", "CDKN1A", "ATM", "CHEK2", "BAX"], "species": 9606}


def config(example: dict[str, Any]) -> ConfigDict:
    """`model_config` for a request model: its documented example."""
    return ConfigDict(json_schema_extra={"examples": [example]})
