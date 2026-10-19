"""Network perturbation — knock nodes and edges out, attack the network.

The graphs are those of Network Statistics: one per analysed layer
(intra-layer edges) and the whole network (the analysed layers with the
inter-layer edges among them, every Node_Layer a vertex); with one layer
analysed, only that layer. Every graph is undirected, parallel edges
(channels) merged, self-loops dropped, and distances are in hops.

* knockout(): remove nodes (ids, names, the top k by a metric, optionally
  every copy across layers) and edges (scene edges, channels, the
  inter-layer edges, a random share), then compare the global measures of
  every graph and each node's degree, betweenness and closeness in the whole
  network before and after; optionally a random walk with restart from seed
  nodes (network propagation), before and after.
* attack(): robustness curves — remove nodes step by step (random failure
  averaged over several runs, or targeted by degree or betweenness, ranked
  once or again after every step) and follow the largest component, the
  number of components and optionally the global efficiency.

Everything is guarded so empty or edgeless graphs never reach an igraph call
that raises; attack() stops at config.PERTURBATION_TIME_BUDGET seconds.
"""

import math
import random
import statistics
import time
from collections.abc import Iterable
from dataclasses import dataclass, field

import igraph as ig

from app import config
from app.models.network import EdgeModel
from app.models.perturbation import (
    AnalysedRequest,
    AttackRequest,
    AttackResponse,
    Curve,
    GlobalMeasures,
    KnockoutRequest,
    KnockoutResponse,
    NodeChange,
    RankMetric,
)

WHOLE = "Whole network"


class PerturbationError(ValueError):
    """Nothing to perturb, or nothing to analyse."""


@dataclass
class Scope:
    name: str
    ids: list[str]  # vertices, in network order
    rows: list[int]  # indices into the request's edges


@dataclass
class Network:
    """The analysed part of a request: nodes, edge rows and the graphs' scopes."""

    edges: list[EdgeModel]
    info: dict[str, tuple[str, str]]  # Node_Layer -> (label, layer)
    rows: list[int]  # analysed edge rows (layers, channels)
    scopes: list[Scope] = field(default_factory=list)

    @property
    def whole(self) -> Scope:
        return self.scopes[-1]


def analysed(req: AnalysedRequest) -> Network:
    layers = list(dict.fromkeys(req.layers))
    chosen = set(layers)
    has_channels = any(e.channel is not None for e in req.edges)
    channels = (
        set(req.selected_channels) if has_channels and req.selected_channels is not None else None
    )
    rows = [
        i
        for i, e in enumerate(req.edges)
        if e.source_layer in chosen
        and e.target_layer in chosen
        and (channels is None or e.channel in channels)
    ]
    info: dict[str, tuple[str, str]] = {
        n.id: (n.label, n.layer) for n in req.nodes if n.layer in chosen
    }
    for i in rows:  # endpoints missing from the node list still count
        e = req.edges[i]
        info.setdefault(e.src, (e.source_node, e.source_layer))
        info.setdefault(e.trg, (e.target_node, e.target_layer))
    if not info:
        raise PerturbationError("The analysed layers have no nodes.")
    net = Network(edges=req.edges, info=info, rows=rows)
    for layer in layers:
        ids = [v for v, (_, lay) in info.items() if lay == layer]
        own = [i for i in rows if req.edges[i].source_layer == layer == req.edges[i].target_layer]
        net.scopes.append(Scope(layer, ids, own))
    if len(layers) > 1:
        net.scopes.append(Scope(WHOLE, list(info), rows))
    return net


def simple_graph(ids: list[str], pairs: Iterable[tuple[str, str]]) -> ig.Graph:
    index = {v: i for i, v in enumerate(ids)}
    edges = [(index[s], index[t]) for s, t in pairs if s != t and s in index and t in index]
    graph = ig.Graph(n=len(ids), edges=edges)
    graph.vs["name"] = ids
    graph.simplify(multiple=True, loops=True)
    return graph


def _scope_graph(
    net: Network, scope: Scope, gone: set[str] | None = None, cut: set[int] | None = None
) -> ig.Graph:
    """The scope's graph, without the `gone` nodes and the `cut` edge rows."""
    gone, cut = gone or set(), cut or set()
    ids = [v for v in scope.ids if v not in gone]
    pairs = ((net.edges[i].src, net.edges[i].trg) for i in scope.rows if i not in cut)
    return simple_graph(ids, pairs)


# ---------------------------------------------------------------- measures
def _finite(x: float) -> float:
    return float(x) if x == x and math.isfinite(x) else 0.0


def path_hist(graph: ig.Graph) -> dict[int, int]:
    """Unordered pairs per distance (hops), in one pass over the graph."""
    if graph.vcount() < 2 or graph.ecount() == 0:
        return {}
    bins = graph.path_length_hist(directed=False).bins()
    return {int(start): int(count) for start, _, count in bins if count}


def _efficiency_of(hist: dict[int, int], n: int) -> float:
    """Global efficiency: mean of 1/d over all pairs of `n` nodes (0 if unreachable)."""
    if n < 2:
        return 0.0
    return 2 * sum(count / d for d, count in hist.items()) / (n * (n - 1))


def _efficiency(graph: ig.Graph, n: int | None = None) -> float:
    """Of the graph, over `n` nodes (default: the graph's own)."""
    return _efficiency_of(path_hist(graph), graph.vcount() if n is None else n)


def _giant_names(graph: ig.Graph) -> set[str]:
    if graph.vcount() == 0:
        return set()
    return set(graph.connected_components().giant().vs["name"])


def _measures(name: str, graph: ig.Graph) -> GlobalMeasures:
    """Path length and diameter of the largest component (as Network Statistics
    reports them) and the efficiency over all pairs, from the histograms of the
    largest component and of the rest."""
    n, m = graph.vcount(), graph.ecount()
    comps = graph.connected_components() if n else None
    if comps is None:
        return GlobalMeasures(
            name=name,
            nodes=0,
            edges=0,
            components=0,
            largest_component=0,
            density=0.0,
            average_path_length=0.0,
            diameter=0,
            efficiency=0.0,
        )
    sizes = comps.sizes()
    big = max(range(len(sizes)), key=lambda c: (sizes[c], -c))
    giant = graph.induced_subgraph(comps[big])
    rest = graph.induced_subgraph([v for c, vs in enumerate(comps) if c != big for v in vs])
    in_giant = path_hist(giant)
    pairs = sum(in_giant.values())
    every = dict(in_giant)
    for d, count in path_hist(rest).items():
        every[d] = every.get(d, 0) + count
    return GlobalMeasures(
        name=name,
        nodes=n,
        edges=m,
        components=len(sizes),
        largest_component=sizes[big],
        density=_finite(graph.density()) if n > 1 else 0.0,
        average_path_length=sum(d * c for d, c in in_giant.items()) / pairs if pairs else 0.0,
        diameter=max(in_giant, default=0),
        efficiency=_efficiency_of(every, n),
    )


def _rank_values(graph: ig.Graph, metric: RankMetric, rng: random.Random) -> list[float]:
    """Scores to rank nodes by; betweenness from sampled sources on big graphs."""
    n = graph.vcount()
    if n == 0:
        return []
    if metric == "degree":
        return [float(d) for d in graph.degree()]
    if graph.ecount() == 0:
        return [0.0] * n
    if metric == "pagerank":
        return [float(v) for v in graph.pagerank(directed=False)]
    if n > config.MAX_QUADRATIC_NODES:
        sources = rng.sample(range(n), min(n, config.BETWEENNESS_SAMPLE))
        return [float(b) for b in graph.betweenness(directed=False, sources=sources)]
    return [float(b) for b in graph.betweenness(directed=False)]


def _top(values: list[float], k: int) -> list[int]:
    """The k highest values' indices; ties keep the network order."""
    return sorted(range(len(values)), key=lambda v: (-values[v], v))[:k]


# ---------------------------------------------------------------- knockout
def _resolve_names(net: Network, names: Iterable[str]) -> tuple[set[str], list[str]]:
    """Every analysed copy of each name (any case) or id; the names not found."""
    by_label: dict[str, list[str]] = {}
    for v, (label, _) in net.info.items():
        by_label.setdefault(label.casefold(), []).append(v)
    found: set[str] = set()
    missing: list[str] = []
    for raw in names:
        name = raw.strip()
        if not name:
            continue
        if name in net.info:
            found.add(name)
        elif hits := by_label.get(name.casefold()):
            found.update(hits)
        else:
            missing.append(name)
    return found, missing


def _knocked_nodes(net: Network, req: KnockoutRequest, warnings: list[str]) -> set[str]:
    gone = {v for v in req.remove_nodes if v in net.info}
    outside = len(set(req.remove_nodes)) - len(gone)
    if outside:
        warnings.append(f"{outside} node(s) outside the analysed layers stay in.")
    named, missing = _resolve_names(net, req.remove_names)
    gone |= named
    if missing:
        shown = ", ".join(missing[:10]) + (" …" if len(missing) > 10 else "")
        warnings.append(f"Not found in the analysed layers: {shown}")
    if req.top_k is not None:
        rng = random.Random(req.seed)
        scopes = net.scopes[:-1] if req.top_k.per_layer and len(net.scopes) > 1 else [net.whole]
        for scope in scopes:
            graph = _scope_graph(net, scope)
            values = _rank_values(graph, req.top_k.metric, rng)
            gone.update(graph.vs[i]["name"] for i in _top(values, req.top_k.k))
    if req.every_copy and gone:
        labels = {net.info[v][0] for v in gone}
        gone |= {v for v, (label, _) in net.info.items() if label in labels}
    return gone


def _knocked_edges(net: Network, req: KnockoutRequest, gone: set[str]) -> set[int]:
    edges = net.edges
    # rows of removed nodes go with them; the rest can be removed as edges
    live = [i for i in net.rows if edges[i].src not in gone and edges[i].trg not in gone]
    pairs = {(p.src, p.trg) for p in req.remove_edges}
    channels = set(req.remove_channels)
    cut = {
        i
        for i in live
        if (edges[i].src, edges[i].trg) in pairs
        or (edges[i].channel is not None and edges[i].channel in channels)
        or (req.remove_inter_layer and edges[i].source_layer != edges[i].target_layer)
    }
    if req.random_edge_fraction > 0:
        # a share of the graph's edges: every channel of a node pair goes together
        by_pair: dict[frozenset[str], list[int]] = {}
        for i in live:
            if i not in cut and edges[i].src != edges[i].trg:
                by_pair.setdefault(frozenset((edges[i].src, edges[i].trg)), []).append(i)
        keys = list(by_pair)
        k = round(req.random_edge_fraction * len(keys))
        for key in random.Random(req.seed).sample(keys, k):
            cut.update(by_pair[key])
    return cut


def _centralities(
    graph: ig.Graph, n0: int, sample: set[str] | None
) -> tuple[dict[str, float], dict[str, float]]:
    """Betweenness and harmonic closeness (sum of 1/distance over the other
    nodes, divided by n0 - 1) per node name. With a `sample`, both are
    estimated from shortest paths out of the sampled nodes and scaled up."""
    names = graph.vs["name"] if graph.vcount() else []
    if not names or n0 < 2:
        return dict.fromkeys(names, 0.0), dict.fromkeys(names, 0.0)
    if sample is None:
        btw = graph.betweenness(directed=False)
        harm = graph.harmonic_centrality(normalized=False)
    else:
        sources = [i for i, v in enumerate(names) if v in sample]
        scale = len(names) / len(sources) if sources else 0.0
        btw = [b * scale for b in graph.betweenness(directed=False, sources=sources)]
        harm = [0.0] * len(names)
        for row in graph.distances(source=sources) if sources else []:
            for v, d in enumerate(row):
                if 0 < d < math.inf:
                    harm[v] += scale / d
    return (
        {v: _finite(b) for v, b in zip(names, btw, strict=True)},
        {v: _finite(h) / (n0 - 1) for v, h in zip(names, harm, strict=True)},
    )


def _propagation(graph: ig.Graph, seeds: set[str], restart: float) -> dict[str, float]:
    """Random walk with restart (personalised PageRank) from the seeds."""
    names = graph.vs["name"] if graph.vcount() else []
    start = [i for i, v in enumerate(names) if v in seeds]
    if not start:
        return dict.fromkeys(names, 0.0)
    if graph.ecount() == 0:  # the walk never leaves the seeds
        return {v: (1 / len(start) if v in seeds else 0.0) for v in names}
    values = graph.personalized_pagerank(directed=False, damping=1 - restart, reset_vertices=start)
    return {v: float(x) for v, x in zip(names, values, strict=True)}


def knockout(req: KnockoutRequest) -> KnockoutResponse:
    net = analysed(req)
    warnings: list[str] = []
    gone = _knocked_nodes(net, req, warnings)
    cut = _knocked_edges(net, req, gone)
    if not gone and not cut:
        raise PerturbationError(
            "Nothing to knock out: no node or edge of the analysed layers matches."
        )

    # per scope, in net.scopes order (a layer may be called "Whole network" too)
    before: list[GlobalMeasures] = []
    after: list[GlobalMeasures] = []
    cut_off: list[set[str]] = []  # the nodes cut off
    graphs: list[tuple[ig.Graph, ig.Graph]] = []
    for scope in net.scopes:
        g0 = _scope_graph(net, scope)
        g1 = _scope_graph(net, scope, gone, cut)
        graphs.append((g0, g1))
        lost = _giant_names(g0) - gone - _giant_names(g1)
        cut_off.append(lost)
        before.append(_measures(scope.name, g0))
        after.append(_measures(scope.name, g1).model_copy(update={"cut_off": len(lost)}))
    # the layers come first; with one layer it is the whole network too
    layer_scope = {s.name: k for k, s in enumerate(net.scopes[: max(1, len(net.scopes) - 1)])}

    g0, g1 = graphs[-1]  # the whole network
    n0 = g0.vcount()
    names0 = g0.vs["name"] if n0 else []
    names1 = g1.vs["name"] if g1.vcount() else []
    deg0 = dict(zip(names0, g0.degree(), strict=True))
    deg1 = dict(zip(names1, g1.degree(), strict=True))
    # big graphs: the same sampled sources before and after (less the removed)
    sample = None
    if n0 > config.MAX_QUADRATIC_NODES:
        sample = set(random.Random(req.seed).sample(names0, config.BETWEENNESS_SAMPLE))
        warnings.append(
            f"Betweenness and closeness are estimated from {config.BETWEENNESS_SAMPLE} "
            f"sampled nodes: the network has more than {config.MAX_QUADRATIC_NODES:,}."
        )
    btw0, clo0 = _centralities(g0, n0, sample)
    btw1, clo1 = _centralities(g1, n0, sample)
    prop0: dict[str, float] = {}
    prop1: dict[str, float] = {}
    if req.propagation_seeds:
        seeds, missing = _resolve_names(net, req.propagation_seeds)
        if missing:
            warnings.append(f"Propagation seeds not found: {', '.join(missing[:10])}")
        if seeds:
            prop0 = _propagation(g0, seeds, req.restart)
            prop1 = _propagation(g1, seeds - gone, req.restart)
            if not seeds - gone:
                warnings.append("Every propagation seed was knocked out.")

    rows = []
    for v in names0:
        label, layer = net.info[v]
        removed = v in gone
        rows.append(
            NodeChange(
                id=v,
                label=label,
                layer=layer,
                removed=removed,
                cut_off_layer=v in cut_off[layer_scope[layer]],
                cut_off_whole=v in cut_off[-1],
                degree=float(deg0[v]),
                degree_after=None if removed else float(deg1[v]),
                betweenness=btw0[v],
                betweenness_after=None if removed else btw1[v],
                closeness=clo0[v],
                closeness_after=None if removed else clo1[v],
                propagation=prop0.get(v) if prop0 else None,
                propagation_after=None if removed or not prop1 else prop1.get(v),
            )
        )
    return KnockoutResponse(
        removed_nodes=[v for v in net.info if v in gone],
        removed_edges=sorted(cut),
        before=before,
        after=after,
        nodes=rows,
        warnings=warnings,
    )


# ---------------------------------------------------------------- attack
@dataclass
class _Point:
    largest: float
    components: int
    efficiency: float | None


def _point(graph: ig.Graph, n: int, eff0: float | None) -> _Point:
    sizes = graph.connected_components().sizes() if graph.vcount() else []
    eff = None
    if eff0 is not None:
        eff = _efficiency(graph, n) / eff0 if eff0 > 0 else 0.0
    return _Point(max(sizes, default=0) / n, len(sizes), eff)


def _counts(n: int, steps: int, max_fraction: float) -> list[int]:
    """Nodes removed at each point: 0, then `steps` even steps (one node a step
    when the graph has fewer nodes than steps)."""
    last = round(max_fraction * n)
    return sorted({round(i * last / steps) for i in range(steps + 1)})


def _run(
    graph: ig.Graph,
    counts: list[int],
    order: list[int] | None,
    metric: RankMetric | None,
    eff0: float | None,
    rng: random.Random,
    deadline: float,
) -> list[_Point]:
    """One pass: remove nodes in a fixed `order`, or rank by `metric` again
    before every step. Stops at the deadline."""
    n = graph.vcount()
    alive = list(range(n))
    sub = graph
    points = [_point(graph, n, eff0)]
    for prev, count in zip(counts, counts[1:], strict=False):
        if time.monotonic() > deadline:
            break
        if order is not None:
            alive = sorted(order[count:])
        else:
            assert metric is not None
            drop = {alive[v] for v in _top(_rank_values(sub, metric, rng), count - prev)}
            alive = [v for v in alive if v not in drop]
        sub = graph.induced_subgraph(alive)
        points.append(_point(sub, n, eff0))
    return points


def _area(xs: list[float], ys: list[float]) -> float:
    steps = zip(xs, xs[1:], ys, ys[1:], strict=False)
    return sum((x1 - x0) * (y0 + y1) / 2 for x0, x1, y0, y1 in steps)


def _curve(
    name: str, graph: ig.Graph, req: AttackRequest, deadline: float, warnings: list[str]
) -> Curve:
    n = graph.vcount()
    if n == 0:
        return Curve(
            name=name, nodes=0, fraction=[0.0], largest=[0.0], components=[0], robustness=0
        )
    counts = _counts(n, req.steps, req.max_fraction)
    eff0: float | None = None
    if req.efficiency:
        if n <= config.MAX_QUADRATIC_NODES:
            eff0 = _efficiency(graph)
        else:
            warnings.append(
                f"{name}: global efficiency is computed for graphs up to "
                f"{config.MAX_QUADRATIC_NODES:,} nodes; this one has {n:,}."
            )
    rng = random.Random(req.seed)
    runs: list[list[_Point]] = []
    if req.strategy == "random":
        for _ in range(req.runs):
            run = _run(graph, counts, rng.sample(range(n), n), None, eff0, rng, deadline)
            if len(run) < len(counts):  # out of time: average the complete runs
                if not runs:
                    runs.append(run)
                break
            runs.append(run)
        if len(runs) < req.runs and len(runs[0]) == len(counts):
            warnings.append(f"{name}: out of time, averaged over {len(runs)} of {req.runs} runs.")
    else:
        if req.recalculate:
            runs.append(_run(graph, counts, None, req.strategy, eff0, rng, deadline))
        else:
            order = _top(_rank_values(graph, req.strategy, rng), n)
            runs.append(_run(graph, counts, order, None, eff0, rng, deadline))
    size = min(len(r) for r in runs)
    xs = [c / n for c in counts[:size]]

    def mean(get: str) -> list[float]:
        return [statistics.fmean(float(getattr(r[i], get)) for r in runs) for i in range(size)]

    largest = mean("largest")
    curve = Curve(
        name=name,
        nodes=n,
        fraction=xs,
        largest=largest,
        largest_sd=[statistics.pstdev(r[i].largest for r in runs) for i in range(size)]
        if req.strategy == "random"
        else None,
        components=mean("components"),
        efficiency=mean("efficiency") if eff0 is not None else None,
        robustness=_area(xs, largest),
        complete=size == len(counts),
    )
    if not curve.complete:
        warnings.append(
            f"{name}: the time budget ({config.PERTURBATION_TIME_BUDGET:g} s) ran out at "
            f"{xs[-1]:.0%} removed."
        )
    return curve


def attack(req: AttackRequest) -> AttackResponse:
    net = analysed(req)
    deadline = time.monotonic() + config.PERTURBATION_TIME_BUDGET
    warnings: list[str] = []
    # the whole network first: it matters most when time runs short
    last = len(net.scopes) - 1
    curves: dict[int, Curve] = {}
    skipped: list[str] = []
    for k in [last] if req.whole_only else [last, *range(last)]:
        scope = net.scopes[k]
        if curves and time.monotonic() > deadline:  # the first always starts
            skipped.append(scope.name)
            continue
        curves[k] = _curve(scope.name, _scope_graph(net, scope), req, deadline, warnings)
    if skipped:
        warnings.append(f"Out of time before: {', '.join(skipped)}.")
    return AttackResponse(
        strategy=req.strategy,
        recalculate=req.recalculate,
        curves=[curves[k] for k in range(len(net.scopes)) if k in curves],
        warnings=warnings,
    )
