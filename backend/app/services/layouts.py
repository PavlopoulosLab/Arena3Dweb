"""Layout registry + orchestration — ports functions/igraph/layout.R.

Maps the 11 v2 UI layout names to python-igraph Graph.layout_* calls, runs
the chosen scope, and returns 2D [y, z] coordinates keyed by Node_Layer id.
By default no weights are passed to layout functions — matches v2
(calculateLayout calls the layout with defaults even though the graph carries
weights). LayoutRequest.use_weights opts in via WEIGHTED_LAYOUTS.
"""

import random
from collections import Counter
from collections.abc import Callable

import igraph as ig

from app import config
from app.models.layout import ClusteringRequest, LayoutRequest
from app.models.network import EdgeModel
from app.services import graph as g
from app.services.alignment import AlignmentError, aligned_layout
from app.services.clustering import (
    CLUSTERING,
    ClusteringError,
    clustered_layout,
    membership,
)
from app.services.group_layouts import GroupLayoutError, group_layout
from app.services.multilayer import multiplex_membership

# [y, z] in the layer plane, or [y, z, x] when dimensions=3 (x = depth)
Position = tuple[float, float] | tuple[float, float, float]
LayoutFn = Callable[[ig.Graph], ig.Layout]

LAYOUTS: dict[str, LayoutFn] = {
    "Fruchterman-Reingold": lambda gr: gr.layout_fruchterman_reingold(),
    "Reingold-Tilford": lambda gr: gr.layout_reingold_tilford(),
    "Circle": lambda gr: gr.layout_circle(),
    "Grid": lambda gr: gr.layout_grid(),
    "Random": lambda gr: gr.layout_random(),
    "DrL": lambda gr: gr.layout_drl(),
    "Graphopt": lambda gr: gr.layout_graphopt(),
    "Kamada-Kawai": lambda gr: gr.layout_kamada_kawai(),
    "Large Graph Layout": lambda gr: gr.layout_lgl(),
    "Multidimensional Scaling": lambda gr: gr.layout_mds(),
    "Sugiyama": lambda gr: gr.layout_sugiyama(),
}


# Opt-in weighted variants (LayoutRequest.use_weights) for the algorithms
# igraph can weight. FR and DrL read weights as attraction (heavier = closer);
# Kamada-Kawai reads them as edge lengths, so it gets the inverse.
WEIGHTED_LAYOUTS: dict[str, LayoutFn] = {
    "Fruchterman-Reingold": lambda gr: gr.layout_fruchterman_reingold(weights="weight"),
    "DrL": lambda gr: gr.layout_drl(weights="weight"),
    "Kamada-Kawai": lambda gr: gr.layout_kamada_kawai(
        weights=[1.0 / w for w in gr.es["weight"]] if gr.ecount() else None
    ),
}


# dimensions=3 (one layer only): the algorithms igraph can run in 3D. Each takes
# the graph and the edge weights to use (None = unweighted).
Layout3DFn = Callable[[ig.Graph, list[float] | None], ig.Layout]
LAYOUTS_3D: dict[str, Layout3DFn] = {
    "Fruchterman-Reingold": lambda gr, w: gr.layout_fruchterman_reingold(weights=w, dim=3),
    "Kamada-Kawai": lambda gr, w: gr.layout_kamada_kawai(
        weights=[1.0 / x for x in w] if w else None, dim=3
    ),
    "DrL": lambda gr, w: gr.layout_drl(weights=w, dim=3),
    "Random": lambda gr, w: gr.layout_random(dim=3),
    "Grid": lambda gr, w: gr.layout_grid(dim=3),
    # a circle's 3D counterpart: nodes evenly on a sphere
    "Circle": lambda gr, w: gr.layout_sphere(),
}


class LayoutError(ValueError):
    """Unknown algorithm or a scope with no computable subgraph."""


# Algorithms whose memory or time grows with the square of the node count.
QUADRATIC_LAYOUTS = {"Kamada-Kawai", "Multidimensional Scaling", "Graphopt", "Sugiyama"}


def check_layout_size(algorithm: str, vcount: int) -> None:
    """A quadratic algorithm on a large graph would stall or exhaust the service."""
    if algorithm in QUADRATIC_LAYOUTS and vcount > config.MAX_QUADRATIC_NODES:
        raise LayoutError(
            f"{algorithm} is limited to {config.MAX_QUADRATIC_NODES} nodes per layout "
            f"(this one has {vcount}); use Fruchterman-Reingold or DrL for larger networks."
        )


def compute_layout(
    req: LayoutRequest,
) -> tuple[dict[str, Position], dict[str, int] | None]:
    if req.algorithm not in LAYOUTS:
        raise LayoutError(f"Unknown layout algorithm: {req.algorithm}")
    if req.clustering and req.clustering.local_layout not in LAYOUTS:
        raise LayoutError(f"Unknown local layout: {req.clustering.local_layout}")

    if req.dimensions == 3:
        if req.algorithm not in LAYOUTS_3D:
            raise LayoutError(
                f"{req.algorithm} has no 3D version — use one of {', '.join(LAYOUTS_3D)}"
            )
        if req.clustering:
            raise LayoutError("3D layouts cannot be combined with clustering")
    random.seed(req.seed)  # v2 set.seed(123)
    edges = g.filter_edges(req.edges, req.selected_channels)
    selected = set(req.selected_layers)
    no_edge = req.algorithm in config.NO_EDGE_LAYOUTS

    # nodesPerLayers narrows to selected nodes first (ports runLocalLayout)
    if req.scope == "nodesPerLayers":
        chosen_nodes = set(req.selected_nodes or [])
        edges = [e for e in edges if e.src in chosen_nodes and e.trg in chosen_nodes]

    if req.group_strategy != "none":
        return _group_layouts(req, edges), None

    if req.scope == "coupled":
        return _coupled_layout(req, edges, selected, no_edge)

    if req.alignment != "none":
        if req.scope != "perLayer" or req.dimensions != 2 or req.clustering:
            raise LayoutError(
                "Alignment options work with the Per Layer scope, 2D layouts and no clustering."
            )

        def layout_layer(layer: str) -> dict[str, tuple[float, float]]:
            ids = [n.id for n in req.nodes if n.layer == layer]
            pos, _ = _layout_subgraph(g.intra_layer_edges(edges, layer), req, no_edge, ids)
            return {n: (p[0], p[1]) for n, p in pos.items()}

        def coupled() -> dict[str, tuple[float, float]]:
            pos, _ = _coupled_layout(req, edges, selected, no_edge)
            return {n: (p[0], p[1]) for n, p in pos.items()}

        try:
            aligned = aligned_layout(req, edges, layout_layer, coupled)
        except AlignmentError as e:
            raise LayoutError(str(e)) from e
        return dict(aligned), None

    positions: dict[str, Position] = {}
    clusters: dict[str, int] = {}
    scopes = [selected] if req.scope == "allLayers" else [{layer} for layer in req.selected_layers]
    for layers in scopes:
        if req.scope == "allLayers":
            layer_edges = g.within_layers_edges(edges, layers)
        else:
            layer_edges = g.intra_layer_edges(edges, next(iter(layers)))
        extra = _layer_nodes(req, layers) if no_edge else None
        pos, clu = _layout_subgraph(layer_edges, req, no_edge, extra)
        positions.update(pos)
        clusters.update(clu)

    return positions, (clusters if req.clustering else None)


def _group_layouts(req: LayoutRequest, edges: list[EdgeModel]) -> dict[str, Position]:
    """NORMA-2.0 strategies, per layer (perLayer) or over all selected layers."""
    if req.scope not in ("perLayer", "allLayers") or req.clustering or req.alignment != "none":
        raise LayoutError(
            "Group layouts work with the Per Layer or All Selected Layers scope, "
            "without clustering or alignment."
        )
    if req.group_local != "keep" and req.group_local not in LAYOUTS:
        raise LayoutError(f"Unknown local layout: {req.group_local}")
    groups_of = req.groups or {}
    scopes = (
        [list(req.selected_layers)]
        if req.scope == "allLayers"
        else [[layer] for layer in req.selected_layers]
    )
    positions: dict[str, Position] = {}
    for layers in scopes:
        chosen = set(layers)
        ids = [n.id for n in req.nodes if n.layer in chosen]
        scoped = (
            g.within_layers_edges(edges, chosen)
            if req.scope == "allLayers"
            else g.intra_layer_edges(edges, layers[0])
        )
        weighted = [(e.src, e.trg, e.scaled_weight if req.use_weights else 1.0) for e in scoped]
        check_layout_size(req.algorithm, len(ids))
        if req.group_local != "keep":
            group_sizes = Counter(gid for n in ids for gid in groups_of.get(n, []))
            check_layout_size(req.group_local, max(group_sizes.values(), default=0))
        try:
            pos = group_layout(
                ids,
                weighted,
                groups_of,
                req.group_strategy,
                req.algorithm,
                local=req.group_local,
                force=req.group_force,
                group_scale=req.group_scale,
                dim=req.dimensions,
                seed=req.seed,
            )
        except GroupLayoutError as e:
            raise LayoutError(str(e)) from e
        for n, p in pos.items():
            positions[n] = (p[0], p[1]) if len(p) == 2 else (p[0], p[1], p[2])
    return positions


def _coupled_layout(
    req: LayoutRequest,
    edges: list[EdgeModel],
    selected: set[str],
    no_edge: bool,
) -> tuple[dict[str, Position], dict[str, int] | None]:
    """Lay out the label-merged graph once; every copy of a label gets its spot."""
    members = [n for n in req.nodes if n.layer in selected]
    label_edges = g.merge_by_label(g.within_layers_edges(edges, selected))
    labels = list(dict.fromkeys(n.label for n in members)) if no_edge else None
    fixed = None
    if req.clustering and req.clustering.algorithm == "Leiden":
        # multiplex Leiden: communities shared across the per-layer graphs
        all_labels = list(dict.fromkeys(n.label for n in members))
        fixed = multiplex_membership(edges, all_labels, req.selected_layers, req.seed)
    pos, clu = _layout_subgraph(label_edges, req, no_edge, labels, fixed)
    positions = {n.id: pos[n.label] for n in members if n.label in pos}
    clusters = {n.id: clu[n.label] for n in members if n.label in clu}
    return positions, (clusters if req.clustering else None)


def _layer_nodes(req: LayoutRequest, layers: set[str]) -> list[str]:
    """All node ids belonging to `layers` (so no-edge layouts place isolated nodes)."""
    ids = [n.id for n in req.nodes if n.layer in layers]
    if req.scope == "nodesPerLayers" and req.selected_nodes is not None:
        chosen = set(req.selected_nodes)
        ids = [i for i in ids if i in chosen]
    return ids


def _layout_subgraph(
    edges: list[EdgeModel],
    req: LayoutRequest,
    no_edge: bool,
    extra_vertices: list[str] | None,
    membership_by_name: dict[str, int] | None = None,
) -> tuple[dict[str, Position], dict[str, int]]:
    if not edges and not extra_vertices:
        return {}, {}  # nothing to place (v2: "cannot form a graph")
    # no channels here → remove parallel edges (edge-based scopes rebuild per layer)
    graph = g.build_graph(
        edges,
        remove_multiple=True,
        extra_vertices=extra_vertices,
        channel_weights=req.channel_weights if req.use_weights else None,
    )
    if graph.vcount() == 0:
        return {}, {}
    check_layout_size(req.algorithm, graph.vcount())

    if req.clustering:
        flat, clu = clustered_layout(
            graph,
            req.clustering.algorithm,
            LAYOUTS[req.algorithm],
            LAYOUTS[req.clustering.local_layout],
            is_kamada_kawai=req.algorithm == "Kamada-Kawai",
            membership_by_name=membership_by_name,
        )
        return dict(flat), clu

    # clustered layouts above stay unweighted: their padding edges are tuned for v2
    if req.dimensions == 3:
        weights = graph.es["weight"] if req.use_weights and graph.ecount() else None
        coords = LAYOUTS_3D[req.algorithm](graph, weights)
    else:
        layout = LAYOUTS[req.algorithm]
        if req.use_weights:
            layout = WEIGHTED_LAYOUTS.get(req.algorithm, layout)
        coords = layout(graph)
    names = graph.vs["name"]
    # Sugiyama appends dummy vertices for edge bends — keep only real vertices
    positions: dict[str, Position] = {
        names[i]: (float(coords[i][0]), float(coords[i][1]))
        if req.dimensions == 2
        # igraph returns (x, y, z); the 3rd axis becomes depth off the plane
        else (float(coords[i][0]), float(coords[i][1]), float(coords[i][2]))
        for i in range(graph.vcount())
    }
    return positions, {}


def compute_clusters(req: ClusteringRequest) -> dict[str, int]:
    """Communities without a layout (the Clustering card): per layer, over the
    selected layers as one graph, or shared across layers by node name."""
    if req.algorithm not in CLUSTERING:
        raise ClusteringError(f"Unknown clustering algorithm: {req.algorithm}")
    edges = g.filter_edges(req.edges, req.selected_channels)
    selected = set(req.selected_layers)
    result: dict[str, int] = {}
    if req.scope == "coupled":
        members = [n for n in req.nodes if n.layer in selected]
        labels = list(dict.fromkeys(n.label for n in members))
        if req.algorithm == "Leiden":
            by_label = multiplex_membership(edges, labels, req.selected_layers, req.seed)
        else:
            merged = g.merge_by_label(g.within_layers_edges(edges, selected))
            graph = g.build_graph(merged, remove_multiple=True, extra_vertices=labels)
            by_label = membership(graph, req.algorithm, req.seed) if graph.vcount() else {}
        return {n.id: by_label[n.label] for n in members if n.label in by_label}
    scopes = [selected] if req.scope == "allLayers" else [{layer} for layer in req.selected_layers]
    offset = 0
    for layers in scopes:
        ids = [n.id for n in req.nodes if n.layer in layers]
        scoped = g.within_layers_edges(edges, layers)
        if not ids:
            continue
        graph = g.build_graph(scoped, remove_multiple=True, extra_vertices=ids)
        if graph.vcount() == 0:
            continue
        part = membership(graph, req.algorithm, req.seed)
        # community ids stay distinct from layer to layer
        for name, cid in part.items():
            result[name] = cid + offset
        offset += max(part.values(), default=-1) + 1
    return result
