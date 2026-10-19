"""Multilayer analytics — PLAN-ROADMAP Phase 5.

Metrics are about a node *label* across the selected layers (its copies), and
every copy gets the label's value:

- Multiplex Degree: intra-layer degree summed over the label's layers.
- Participation Coefficient: how evenly that degree spreads over the L
  selected layers, P = L/(L-1) * (1 - sum_l (k_l / K)^2) — 0 when all links are
  in one layer, 1 when they are spread perfectly evenly.
- Multilayer PageRank: PageRank on the supra-graph (every Node_Layer a vertex,
  intra + inter-layer edges, plus coupling edges between copies of a label),
  summed over the label's copies (a versatility-style score).

Layer similarity compares every pair of layers by node-label and edge overlap.
Multiplex community detection uses leidenalg across the per-layer graphs.
"""

from collections import defaultdict

import igraph as ig
import leidenalg

from app.models.network import EdgeModel, NodeModel
from app.services import graph as g

MULTILAYER_METRICS = ("Multiplex Degree", "Participation Coefficient", "Multilayer PageRank")
COUPLING_WEIGHT = 1.0


def _layer_degrees(edges: list[EdgeModel], selected: set[str]) -> dict[str, dict[str, int]]:
    """label -> layer -> intra-layer degree (parallel channel edges counted once)."""
    pairs = {
        (e.source_layer, *sorted((e.source_node, e.target_node)))
        for e in edges
        if e.source_layer == e.target_layer and e.source_layer in selected
    }
    deg: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for layer, a, b in pairs:
        deg[a][layer] += 1
        if b != a:
            deg[b][layer] += 1
    return deg


def _pagerank(
    nodes: list[NodeModel], edges: list[EdgeModel], selected: set[str]
) -> dict[str, float]:
    members = [n for n in nodes if n.layer in selected]
    supra = [e for e in edges if e.source_layer in selected and e.target_layer in selected]
    copies: dict[str, list[str]] = defaultdict(list)
    for n in members:
        copies[n.label].append(n.id)
    coupling = [
        EdgeModel(
            src=a,
            trg=b,
            source_node=label,
            source_layer="",
            target_node=label,
            target_layer="",
            weight=COUPLING_WEIGHT,
            scaled_weight=COUPLING_WEIGHT,
        )
        for label, ids in copies.items()
        for a, b in zip(ids, ids[1:], strict=False)
    ]
    graph = g.build_graph(
        supra + coupling, remove_multiple=True, extra_vertices=[n.id for n in members]
    )
    ranks = graph.pagerank(weights="weight" if graph.ecount() else None)
    by_id = dict(zip(graph.vs["name"], ranks, strict=True))
    label_of = {n.id: n.label for n in members}
    total: dict[str, float] = defaultdict(float)
    for node_id, r in by_id.items():
        total[label_of[node_id]] += r
    return {n.id: total[n.label] for n in members}


def multilayer_values(
    metric: str, nodes: list[NodeModel], edges: list[EdgeModel], selected_layers: list[str]
) -> dict[str, float]:
    """Node_Layer id -> metric value for every node in the selected layers."""
    selected = set(selected_layers)
    if metric == "Multilayer PageRank":
        return _pagerank(nodes, edges, selected)
    deg = _layer_degrees(edges, selected)
    n_layers = len(selected)
    out: dict[str, float] = {}
    for n in nodes:
        if n.layer not in selected:
            continue
        k = deg.get(n.label, {})
        total = sum(k.values())
        if metric == "Multiplex Degree":
            out[n.id] = float(total)
        elif total == 0 or n_layers < 2:
            out[n.id] = 0.0
        else:
            spread = 1 - sum((v / total) ** 2 for v in k.values())
            out[n.id] = n_layers / (n_layers - 1) * spread
    return out


def layer_similarity(
    nodes: list[NodeModel], edges: list[EdgeModel], layers: list[str]
) -> tuple[list[list[float]], list[list[float]]]:
    """Jaccard overlap of node labels and of (undirected) label-pair edges, per layer pair."""
    labels: dict[str, set[str]] = {layer: set() for layer in layers}
    for n in nodes:
        if n.layer in labels:
            labels[n.layer].add(n.label)
    pairs: dict[str, set[tuple[str, str]]] = {layer: set() for layer in layers}
    for e in edges:
        if e.source_layer == e.target_layer and e.source_layer in pairs:
            a, b = sorted((e.source_node, e.target_node))
            pairs[e.source_layer].add((a, b))

    def jaccard(x: set, y: set) -> float:  # type: ignore[type-arg]
        union = x | y
        return len(x & y) / len(union) if union else 0.0

    node_sim = [[jaccard(labels[a], labels[b]) for b in layers] for a in layers]
    edge_sim = [[jaccard(pairs[a], pairs[b]) for b in layers] for a in layers]
    return node_sim, edge_sim


def multiplex_membership(
    edges: list[EdgeModel], labels: list[str], selected_layers: list[str], seed: int
) -> dict[str, int]:
    """Leiden multiplex partition: one community per label, shared by every layer."""
    index = {label: i for i, label in enumerate(labels)}
    graphs = []
    for layer in selected_layers:
        pairs = {
            (index[e.source_node], index[e.target_node])
            for e in g.intra_layer_edges(edges, layer)
            if e.source_node in index and e.target_node in index and e.source_node != e.target_node
        }
        graphs.append(ig.Graph(n=len(labels), edges=sorted(pairs)))
    membership, _ = leidenalg.find_partition_multiplex(
        graphs, leidenalg.ModularityVertexPartition, seed=seed
    )
    return dict(zip(labels, membership, strict=True))
