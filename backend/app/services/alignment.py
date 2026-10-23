"""Pseudo-alignment of nodes across layers — fewer inter-layer crossovers.

The "coupled" scope (layouts.py) aligns copies of a node exactly, which
forces every layer into one shape. These modes trade alignment against each
layer keeping its own structure:

- soft:   blend each layer's own layout with the coupled (fully aligned)
          layout; strength 0 = independent, 1 = coupled. The own layout is
          first turned (and mirrored, if that fits better) to lie as close as
          possible to the coupled one: a layout and its turned or mirrored
          copy have the same structure, but blending the two point by point
          shrinks the layer or folds it flat onto a line.
- anchor: lay out a reference layer, then start every other layer's
          Fruchterman-Reingold from its counterparts' positions (same node in
          the reference, or partners via inter-layer edges). Strength 1 pins
          anchored nodes; lower strengths pull them toward their counterparts
          by that fraction.
- chain:  like anchor, but each layer is anchored to the previous one in the
          selected order (time series, long stacks).

All positions share one frame: each layer is centred and scaled to
[-S, S] with S = sqrt(largest layer size), about Fruchterman-Reingold's
natural extent, so seeds and free nodes live at the same scale.

`misalignment` scores any multi-layer result: the mean in-plane distance
between linked nodes of different layers (copies of a node + inter-layer
edges), as a % of the layout's diagonal, after the same global
normalisation the frontend applies. 0 = every link runs straight.
"""

import math
import random
from collections import defaultdict
from collections.abc import Callable, Mapping

import igraph as ig

from app.models.layout import LayoutRequest
from app.models.network import EdgeModel, NodeModel
from app.services import graph as g

XY = tuple[float, float]
FREE = 1e9  # bound for unpinned vertices


class AlignmentError(ValueError):
    pass


def _fit(pos: dict[str, XY], extent: float) -> dict[str, XY]:
    """Centre and scale into [-extent, extent] (aspect kept)."""
    if not pos:
        return {}
    ys = [p[0] for p in pos.values()]
    zs = [p[1] for p in pos.values()]
    cy, cz = (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2
    half = max(max(ys) - min(ys), max(zs) - min(zs)) / 2 or 1.0
    k = extent / half
    return {n: ((y - cy) * k, (z - cz) * k) for n, (y, z) in pos.items()}


def _rotate_onto(own: dict[str, XY], target: Mapping[str, XY]) -> dict[str, XY]:
    """Turn `own` about its centre, mirrored when that fits better, and move it
    onto `target`'s centre, so its nodes lie as close as possible to theirs in
    `target` (orthogonal Procrustes in 2D: no scaling, the shape is kept)."""
    common = [n for n in own if n in target]
    if len(common) < 2:
        return own
    cy = sum(own[n][0] for n in common) / len(common)
    cz = sum(own[n][1] for n in common) / len(common)
    ty = sum(target[n][0] for n in common) / len(common)
    tz = sum(target[n][1] for n in common) / len(common)
    best: tuple[float, int, float] | None = None
    for mirror in (1, -1):
        # the turn by theta maximises a cos(theta) + b sin(theta)
        a = b = 0.0
        for n in common:
            y, z = own[n][0] - cy, (own[n][1] - cz) * mirror
            u, v = target[n][0] - ty, target[n][1] - tz
            a += y * u + z * v
            b += y * v - z * u
        fit = math.hypot(a, b)
        if best is None or fit > best[0]:
            best = (fit, mirror, math.atan2(b, a))
    _, mirror, theta = best  # type: ignore[misc]
    c, s = math.cos(theta), math.sin(theta)
    out: dict[str, XY] = {}
    for n, (y, z) in own.items():
        y, z = y - cy, (z - cz) * mirror
        out[n] = (c * y - s * z + ty, s * y + c * z + tz)
    return out


def _partners(
    nodes: list[NodeModel], edges: list[EdgeModel], selected: set[str]
) -> dict[str, list[str]]:
    """Node_Layer id -> linked ids in other layers (copies + inter-layer edges)."""
    out: dict[str, list[str]] = defaultdict(list)
    copies: dict[str, list[str]] = defaultdict(list)
    # one copy per layer and label: a label repeated within a layer (only a
    # malformed request) must not make pairs of every one with every other
    seen: set[tuple[str, str]] = set()
    for n in nodes:
        if n.layer in selected and (n.label, n.layer) not in seen:
            seen.add((n.label, n.layer))
            copies[n.label].append(n.id)
    for ids in copies.values():
        for a in ids:
            out[a] += [b for b in ids if b != a]
    for e in edges:
        if (
            e.source_layer != e.target_layer
            and e.source_layer in selected
            and e.target_layer in selected
            and e.source_node != e.target_node  # copies already counted
        ):
            out[e.src].append(e.trg)
            out[e.trg].append(e.src)
    return out


def _layer_graph(edges: list[EdgeModel], layer: str, ids: list[str]) -> ig.Graph:
    return g.build_graph(
        g.intra_layer_edges(edges, layer), remove_multiple=True, extra_vertices=ids
    )


def _anchored_fr(
    graph: ig.Graph,
    targets: dict[str, XY],
    strength: float,
    extent: float,
    rng: random.Random,
) -> dict[str, XY]:
    """FR seeded at the targets; full strength pins them."""
    names: list[str] = graph.vs["name"]
    if not names:
        return {}
    cy = sum(t[0] for t in targets.values()) / len(targets) if targets else 0.0
    cz = sum(t[1] for t in targets.values()) / len(targets) if targets else 0.0
    seed = [
        list(targets[n])
        if n in targets
        else [cy + rng.uniform(-extent, extent) / 2, cz + rng.uniform(-extent, extent) / 2]
        for n in names
    ]
    pin = strength >= 0.999
    bounds = {
        k: [(targets[n][i] if pin and n in targets else (-FREE if lo else FREE)) for n in names]
        for k, i, lo in (
            ("minx", 0, True),
            ("maxx", 0, False),
            ("miny", 1, True),
            ("maxy", 1, False),
        )
    }
    # cooler start = anchored nodes stay closer to their seeds
    temp = max(0.05, (1 - strength) * math.sqrt(len(names)) / 5)
    layout = graph.layout_fruchterman_reingold(
        seed=seed,
        niter=500,
        start_temp=temp,
        weights="weight" if graph.ecount() else None,
        **(bounds if pin and targets else {}),
    )
    own = {n: (float(layout[i][0]), float(layout[i][1])) for i, n in enumerate(names)}
    if pin:
        return own
    # Below full strength, FR is free to rearrange the layer; bring it into the
    # shared frame and pull each anchored node toward its target by `strength`
    # (monotone, like the soft mode: 0 = the layer's own layout).
    own = _fit(own, extent)
    return {
        n: (
            strength * targets[n][0] + (1 - strength) * y,
            strength * targets[n][1] + (1 - strength) * z,
        )
        if n in targets
        else (y, z)
        for n, (y, z) in own.items()
    }


def _targets(ids: list[str], partners: dict[str, list[str]], ref: dict[str, XY]) -> dict[str, XY]:
    out = {}
    for n in ids:
        pts = [ref[p] for p in partners.get(n, []) if p in ref]
        if pts:
            out[n] = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    return out


def aligned_layout(
    req: LayoutRequest,
    edges: list[EdgeModel],
    layout_layer: Callable[[str], dict[str, XY]],
    coupled: Callable[[], dict[str, XY]],
) -> dict[str, XY]:
    """Positions for every node of the selected layers, in one frame.

    `layout_layer(layer)` runs the requested algorithm on one layer;
    `coupled()` returns the fully aligned (label-merged) layout per node id.
    """
    layers = req.selected_layers
    selected = set(layers)
    members: dict[str, list[str]] = {
        layer: [n.id for n in req.nodes if n.layer == layer] for layer in layers
    }
    extent = math.sqrt(max((len(v) for v in members.values()), default=1)) or 1.0
    strength = req.alignment_strength
    rng = random.Random(req.seed)
    positions: dict[str, XY] = {}

    if req.alignment == "soft":
        aligned = _fit(coupled(), extent)
        for layer in layers:
            own = _rotate_onto(_fit(layout_layer(layer), extent), aligned)
            for n, (y, z) in own.items():
                ay, az = aligned.get(n, (y, z))
                positions[n] = (
                    strength * ay + (1 - strength) * y,
                    strength * az + (1 - strength) * z,
                )
        return positions

    partners = _partners(req.nodes, edges, selected)
    if req.alignment == "anchor":
        ref_layer = req.reference_layer or layers[0]
        if ref_layer not in selected:
            raise AlignmentError(f"Reference layer {ref_layer} is not among the selected layers.")
        order = [ref_layer] + [la for la in layers if la != ref_layer]
    else:  # chain
        order = list(layers)

    for k, layer in enumerate(order):
        if k == 0:
            positions.update(_fit(layout_layer(layer), extent))
            continue
        ref_ids = members[order[0]] if req.alignment == "anchor" else members[order[k - 1]]
        ref = {n: positions[n] for n in ref_ids if n in positions}
        targets = _targets(members[layer], partners, ref)
        graph = _layer_graph(edges, layer, members[layer])
        if not targets:  # nothing links this layer to its reference
            positions.update(_fit(layout_layer(layer), extent))
        else:
            positions.update(_anchored_fr(graph, targets, strength, extent, rng))
    return positions


def misalignment(
    positions: Mapping[str, tuple[float, ...]],
    nodes: list[NodeModel],
    edges: list[EdgeModel],
    layers: list[str],
) -> float | None:
    """Mean in-plane stretch of cross-layer links, % of the layout diagonal."""
    selected = set(layers)
    if len(selected) < 2 or not positions:
        return None
    ys = [p[0] for p in positions.values()]
    zs = [p[1] for p in positions.values()]
    span = math.hypot(max(ys) - min(ys), max(zs) - min(zs)) or 1.0
    partners = _partners(nodes, edges, selected)
    dists = [
        math.hypot(positions[a][0] - positions[b][0], positions[a][1] - positions[b][1])
        for a, bs in partners.items()
        for b in bs
        if a < b and a in positions and b in positions
    ]
    if not dists:
        return None
    return round(100 * sum(dists) / len(dists) / span, 2)
