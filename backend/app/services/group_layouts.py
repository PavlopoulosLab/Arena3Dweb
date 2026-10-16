"""NORMA-2.0 group layouts — Karatzas et al. 2022, Bioinformatics Advances
2:vbac036, Figure 1 — ported from NORMA's own code (same weights and steps),
generalised to 2D or 3D so they also work inside sphere/cube layers.

Groups are sets of nodes (clusters, annotations, or whole layers). A node may
belong to several groups; it then sits at the average of its positions.

- virtual (Strategy 1): every group gets a hidden hub linked to each member
  with weight 50; real edges get weight 5 and every pair of members a light
  link (0.1). The algorithm runs on that larger graph; hubs are dropped.
- gravity (Strategy 2): every pair of members gets a link at the network's
  highest weight; real edges inside a group are multiplied by `force`,
  edges leaving a group (or touching an ungrouped node) divided by it.
- supernodes (Strategy 3): each group collapses into one node (ungrouped
  nodes stay as they are); the collapsed graph is laid out and pushed
  outward by `force`; each group is then laid out locally in its own disc
  (ball in 3D).

`local` lays every group out again inside a disc around where the strategy
put it ("keep" = leave the strategy's arrangement, virtual/gravity only).
Groups larger than 400 get 60 random partner links per member instead of
all pairs, as in NORMA, to keep layouts fast.
"""

import math
import random
from collections import defaultdict
from collections.abc import Callable

import igraph as ig

from app import config

Vec = tuple[float, ...]
CLIQUE_FULL_LIMIT = 400
CLIQUE_SPARSE_DEGREE = 60
SPACING = 1.0  # target nearest-neighbour distance (frontend rescales)
STRATEGIES = ("virtual", "gravity", "supernodes")
# igraph's C core can abort() the whole interpreter on 3D Kamada-Kawai for
# certain weighted graphs — reachable here because a group's real edges plus
# its synthetic clique-completing padding edges (below) can land on exactly
# that pattern (confirmed: igraph 1.0.0, src/layout/align.c, "Assertion
# failed: correction_saved"). /api/layout now runs in an isolated worker so
# this no longer takes the server down, but the layout still can't complete —
# refuse it up front instead of a 500. Remove once igraph fixes this upstream.
UNSAFE_3D_LOCAL_LAYOUTS = {"Kamada-Kawai"}


class GroupLayoutError(ValueError):
    pass


# --------------------------------------------------------------------- runner
def _runner(algorithm: str, dim: int) -> Callable[[ig.Graph], ig.Layout]:
    """The requested algorithm, weighted where igraph supports it."""
    from app.services.layouts import LAYOUTS, LAYOUTS_3D, WEIGHTED_LAYOUTS

    if dim == 3:
        if algorithm not in LAYOUTS_3D:
            raise GroupLayoutError(
                f"{algorithm} has no 3D version — use one of {', '.join(LAYOUTS_3D)}"
            )
        fn3 = LAYOUTS_3D[algorithm]
        return lambda gr: fn3(gr, gr.es["weight"] if gr.ecount() else None)
    if algorithm not in LAYOUTS:
        raise GroupLayoutError(f"Unknown layout algorithm: {algorithm}")
    return WEIGHTED_LAYOUTS.get(algorithm, LAYOUTS[algorithm])


def _layout(
    ids: list[str], edges: list[tuple[str, str, float]], algorithm: str, dim: int
) -> dict[str, Vec]:
    if not ids:
        return {}
    if len(ids) == 1:
        return {ids[0]: (0.0,) * dim}
    index = {n: i for i, n in enumerate(ids)}
    best: dict[tuple[int, int], float] = {}
    for a, b, w in edges:
        if a in index and b in index and a != b:
            key = (min(index[a], index[b]), max(index[a], index[b]))
            best[key] = max(best.get(key, 0.0), w)
    graph = ig.Graph(n=len(ids), edges=list(best))
    graph.es["weight"] = [max(w, 1e-9) for w in best.values()]
    coords = _runner(algorithm, dim)(graph)
    return {n: tuple(float(c) for c in coords[i][:dim]) for i, n in enumerate(ids)}


def _edge_blind(algorithm: str) -> bool:
    return algorithm in config.NO_EDGE_LAYOUTS


def _group_pairs(members: list[str], rng: random.Random) -> list[tuple[str, str]]:
    if len(members) <= CLIQUE_FULL_LIMIT:
        return [(a, b) for i, a in enumerate(members) for b in members[i + 1 :]]
    return [
        (a, b)
        for a in members
        for b in (rng.choice(members) for _ in range(CLIQUE_SPARSE_DEGREE))
        if a != b
    ]


# --------------------------------------------------------------------- geometry
def _dist(a: Vec, b: Vec) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b, strict=True)))


def _mean(points: list[Vec]) -> Vec:
    return tuple(sum(c) / len(points) for c in zip(*points, strict=True))


def _normalize_spacing(pos: dict[str, Vec], spacing: float) -> dict[str, Vec]:
    """Scale so the median nearest-neighbour distance is `spacing`."""
    ids = list(pos)
    if len(ids) < 2:
        return pos
    step = max(1, math.ceil(len(ids) / 1500))
    sample = [pos[i] for i in ids[::step]]
    nn = []
    for i, p in enumerate(sample):
        best = min((_dist(p, q) for j, q in enumerate(sample) if j != i), default=math.inf)
        if 1e-9 < best < math.inf:
            nn.append(best)
    if not nn:
        return pos
    nn.sort()
    k = spacing / nn[len(nn) // 2]
    return {i: tuple(c * k for c in p) for i, p in pos.items()}


def _radius(k: int, local: str, spacing: float, scale: float, dim: int) -> float:
    """Disc (ball) radius a group's local layout gets (NORMA localGroupRadius)."""
    area = 0.95 * spacing * (math.sqrt(max(1, k)) if dim == 2 else max(1, k) ** (1 / 3) * 1.2)
    ring = (k * spacing) / (2 * math.pi) if local == "Circle" else 0.0
    return max(spacing / 2, area, ring) * scale


def _resolve_overlaps(centers: dict[str, list[float]], radii: dict[str, float], gap: float) -> None:
    """Push overlapping group discs apart, sharing the move by size."""
    keys = list(centers)
    for _ in range(400):
        worst = 0.0
        for i, ka in enumerate(keys):
            a, ra = centers[ka], radii[ka]
            for j in range(i + 1, len(keys)):
                b, rb = centers[keys[j]], radii[keys[j]]
                d_vec = [y - x for x, y in zip(a, b, strict=True)]
                d = math.sqrt(sum(c * c for c in d_vec))
                overlap = ra + rb + gap - d
                if overlap <= 0:
                    continue
                if d < 1e-6:
                    d_vec = [math.cos(i * 2.399 + j), math.sin(i * 2.399 + j)] + [0.0] * (
                        len(a) - 2
                    )
                    d = 1.0
                share_a, share_b = rb / (ra + rb), ra / (ra + rb)
                for c in range(len(a)):
                    a[c] -= d_vec[c] / d * overlap * share_a
                    b[c] += d_vec[c] / d * overlap * share_b
                worst = max(worst, overlap)
        if worst < 0.01 * gap:
            break


def _place_locally(
    groups: dict[str, list[str]],
    edges: list[tuple[str, str, float]],
    centers: dict[str, list[float]],
    radii: dict[str, float],
    local: str,
    force: float,
    dim: int,
    rng: random.Random,
) -> dict[str, list[Vec]]:
    """Each group's own layout, fitted inside its disc/ball at its centre."""
    candidates: dict[str, list[Vec]] = defaultdict(list)
    for g, members in groups.items():
        center, radius = tuple(centers[g]), radii[g]
        if len(members) == 1:
            candidates[members[0]].append(center)
            continue
        member_set = set(members)
        local_edges = [e for e in edges if e[0] in member_set and e[1] in member_set]
        if not _edge_blind(local):
            min_w = min((e[2] for e in local_edges), default=1.0)
            local_edges += [(a, b, min_w / max(1.0, force)) for a, b in _group_pairs(members, rng)]
        lp = _layout(members, local_edges, local, dim)
        mid = tuple((min(c) + max(c)) / 2 for c in zip(*lp.values(), strict=True))
        reach = max(_dist(p, mid) for p in lp.values())
        k = radius / reach if reach > 1e-9 else 0.0
        for n, p in lp.items():
            candidates[n].append(tuple(center[c] + (p[c] - mid[c]) * k for c in range(dim)))
    return candidates


def _average(candidates: dict[str, list[Vec]], fallback: dict[str, Vec]) -> dict[str, Vec]:
    out = dict(fallback)
    for n, pts in candidates.items():
        out[n] = _mean(pts)
    return out


# --------------------------------------------------------------------- strategies
def group_layout(
    ids: list[str],
    edges: list[tuple[str, str, float]],
    groups_of: dict[str, list[str]],
    strategy: str,
    algorithm: str,
    local: str = "keep",
    force: float = 10.0,
    group_scale: float = 1.0,
    dim: int = 2,
    seed: int = 123,
) -> dict[str, Vec]:
    """Positions for `ids` (2D or 3D) under a NORMA-2.0 strategy."""
    if strategy not in STRATEGIES:
        raise GroupLayoutError(f"Unknown group strategy: {strategy}")
    if local == "keep" and strategy == "supernodes":
        raise GroupLayoutError("Super nodes always lay groups out locally — pick a local layout.")
    if dim == 3 and local in UNSAFE_3D_LOCAL_LAYOUTS:
        raise GroupLayoutError(
            f"{local} is disabled as a 3D group-local layout (a known igraph bug can "
            "crash the layout engine on certain graphs) — pick a different local layout."
        )
    rng = random.Random(seed)
    random.seed(seed)  # igraph's layouts draw from Python's random
    id_set = set(ids)
    members: dict[str, list[str]] = defaultdict(list)
    for n in ids:
        for g in dict.fromkeys(groups_of.get(n, [])):
            members[g].append(n)
    edges = [e for e in edges if e[0] in id_set and e[1] in id_set and e[0] != e[1]]
    in_group = {n: set(groups_of.get(n, [])) for n in ids}

    if strategy == "virtual":
        weighted = [(a, b, 5.0) for a, b, _ in edges]
        hubs = []
        for g, ms in members.items():
            hub = f"\u0000virtual:{g}"
            hubs.append(hub)
            if len(ms) >= 2 and not _edge_blind(algorithm):
                weighted += [(a, b, 0.1) for a, b in _group_pairs(ms, rng)]
            weighted += [(hub, m, 50.0) for m in ms]
        pos = _layout(ids + hubs, weighted, algorithm, dim)
        positions = _normalize_spacing({n: pos[n] for n in ids}, SPACING)
    elif strategy == "gravity":
        max_w = max((w for _, _, w in edges), default=1.0)
        best: dict[tuple[str, str], float] = {}

        def put(a: str, b: str, w: float) -> None:
            key = (min(a, b), max(a, b))
            best[key] = max(best.get(key, 0.0), w)

        for a, b, w in edges:
            put(a, b, w * force if in_group[a] & in_group[b] else w / force)
        if not _edge_blind(algorithm):
            for ms in members.values():
                for a, b in _group_pairs(ms, rng):
                    put(a, b, max_w)
        pos = _layout(ids, [(a, b, w) for (a, b), w in best.items()], algorithm, dim)
        positions = _normalize_spacing(pos, SPACING)
    else:
        return _supernodes(
            ids, edges, members, groups_of, algorithm, local, force, group_scale, dim, rng
        )

    if local == "keep":
        return positions
    centers = {g: list(_mean([positions[m] for m in ms])) for g, ms in members.items()}
    radii = {g: _radius(len(ms), local, SPACING, group_scale, dim) for g, ms in members.items()}
    _resolve_overlaps(centers, radii, SPACING * 1.5)
    cands = _place_locally(members, edges, centers, radii, local, force, dim, rng)
    return _average(cands, positions)


def _supernodes(
    ids: list[str],
    edges: list[tuple[str, str, float]],
    members: dict[str, list[str]],
    groups_of: dict[str, list[str]],
    algorithm: str,
    local: str,
    force: float,
    group_scale: float,
    dim: int,
    rng: random.Random,
) -> dict[str, Vec]:
    def supers(n: str) -> list[str]:
        gs = groups_of.get(n) or []
        return [f"g\u0000{g}" for g in dict.fromkeys(gs)] or [f"n\u0000{n}"]

    super_ids = list(dict.fromkeys(s for n in ids for s in supers(n)))
    super_edges = [(a, b, w) for x, y, w in edges for a in supers(x) for b in supers(y) if a != b]
    sp = _layout(super_ids, super_edges, algorithm, dim)

    def radius_of(s: str) -> float:
        if s.startswith("n\u0000"):
            return SPACING / 2
        return _radius(len(members[s[2:]]), local, SPACING, group_scale, dim)

    center = _mean(list(sp.values()))
    normalize = 1.0
    if len(super_ids) > 1:
        radii_all = [radius_of(s) for s in super_ids]
        ring = sum(radii_all) / math.pi
        disk = (2 / 3) * math.sqrt(2 * sum(r * r for r in radii_all))
        target = min(ring, disk)
        mean_spread = sum(_dist(p, center) for p in sp.values()) / len(sp)
        if mean_spread > 1e-9:
            spread_factor = target / mean_spread
            gsup = [s for s in super_ids if s.startswith("g\u0000")]
            pair_factor = 0.0
            for i, a in enumerate(gsup):
                for b in gsup[i + 1 :]:
                    d = _dist(sp[a], sp[b])
                    if d > 1e-9:
                        pair_factor = max(pair_factor, (radius_of(a) + radius_of(b)) / d)
            normalize = min(max(spread_factor, pair_factor), spread_factor * 2.5)
        else:
            for i, s in enumerate(super_ids):
                angle = 2 * math.pi * i / len(super_ids)
                sp[s] = (center[0] + math.cos(angle), center[1] + math.sin(angle)) + (0.0,) * (
                    dim - 2
                )
            normalize = target
    # NORMA: force 10 gives 1.6x the "just touching" arrangement
    repel = normalize * force * 0.16
    placed = {s: tuple((p[c] - center[c]) * repel for c in range(dim)) for s, p in sp.items()}
    centers = {g: list(placed[f"g\u0000{g}"]) for g in members}
    radii = {g: radius_of(f"g\u0000{g}") for g in members}
    cands = _place_locally(members, edges, centers, radii, local, force, dim, rng)
    ungrouped = {n: placed[f"n\u0000{n}"] for n in ids if not groups_of.get(n)}
    return _average(cands, ungrouped)
