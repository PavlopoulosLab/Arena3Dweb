"""ig.Graph construction from a parsed network — ports functions/igraph/general.R.

Handles channel filtering, the three subgraph scopes (perLayer / allLayers /
nodesPerLayers) and the v2 simplify rules (sum parallel-edge weights, keep loops).
"""

import math

import igraph as ig

from app.models.network import EdgeModel

# igraph's weighted betweenness (topology) 500s on non-positive weights, and
# inf/nan weights propagate garbage into responses. The TSV path always scales
# into [0.1, 1.0], but direct /api/layout|topology callers can send arbitrary
# scaled_weight — clamp anything not strictly-positive-finite to this floor.
MIN_EDGE_WEIGHT = 1e-9


def filter_edges(
    edges: list[EdgeModel],
    selected_channels: list[str] | None,
) -> list[EdgeModel]:
    """Drop edges whose channel is not selected (ports filterSelectedChannels).

    Only applies when the network has channels; otherwise all edges pass.
    """
    has_channels = any(e.channel is not None for e in edges)
    if not has_channels or selected_channels is None:
        return list(edges)
    chosen = set(selected_channels)
    return [e for e in edges if e.channel in chosen]


def intra_layer_edges(edges: list[EdgeModel], layer: str) -> list[EdgeModel]:
    """Edges with both endpoints in `layer` (ports filterPerLayer)."""
    return [e for e in edges if e.source_layer == layer and e.target_layer == layer]


def within_layers_edges(edges: list[EdgeModel], layers: set[str]) -> list[EdgeModel]:
    """Edges with both endpoints among `layers` (ports filterAllSelectedLayers)."""
    return [e for e in edges if e.source_layer in layers and e.target_layer in layers]


def build_graph(
    edges: list[EdgeModel],
    *,
    remove_multiple: bool,
    extra_vertices: list[str] | None = None,
    channel_weights: dict[str, float] | None = None,
    directed: bool = False,
) -> ig.Graph:
    """Build a weighted graph from edge rows: undirected (or directed, source →
    target) and, with `remove_multiple`, simplified.

    Ports createGraph(): edge weight = ScaledWeight, simplify with
    combine_edges="sum", loops kept. `extra_vertices` adds isolated nodes
    (used by no-edge layouts so every layer node is placed). `channel_weights`
    scales each edge by its channel's factor before parallel edges are summed.
    """
    names: list[str] = []
    seen: set[str] = set()
    for e in edges:
        for name in (e.src, e.trg):
            if name not in seen:
                seen.add(name)
                names.append(name)
    for name in extra_vertices or []:
        if name not in seen:
            seen.add(name)
            names.append(name)

    index = {name: i for i, name in enumerate(names)}
    edge_list = [(index[e.src], index[e.trg]) for e in edges]
    factors = channel_weights or {}
    weights = [
        w
        if (w := e.scaled_weight * factors.get(e.channel or "", 1.0)) > 0 and math.isfinite(w)
        else MIN_EDGE_WEIGHT
        for e in edges
    ]

    graph = ig.Graph(n=len(names), edges=edge_list, directed=directed)
    graph.vs["name"] = names
    graph.es["weight"] = weights
    # remove_loops=False matches v2 (remove.loops = F); sum aggregates parallel edges
    graph.simplify(multiple=remove_multiple, loops=False, combine_edges={"weight": "sum"})
    return graph


def merge_by_label(edges: list[EdgeModel]) -> list[EdgeModel]:
    """Collapse Node_Layer endpoints onto node labels (multiplex flattening).

    Edges between two copies of the same label (the coupling edges of a multiplex
    network) are dropped; build_graph then sums parallel label-pair edges.
    """
    return [
        e.model_copy(update={"src": e.source_node, "trg": e.target_node})
        for e in edges
        if e.source_node != e.target_node or e.source_layer == e.target_layer
    ]
