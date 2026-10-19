"""UMAP layouts (McInnes, Healy & Melville 2018) in three modes.

- topology: each node is its row of the lazy random walk P = D⁻¹(A + I) plus a
  second step (P + P², rows scaled to unit length), so nodes whose two-step
  neighbourhoods overlap land together. Edge weights count with use_weights.
- attributes: each node is its feature vector: the columns the client sends
  (File → Values, one-hot annotation terms) plus node metrics computed here on
  the scope's graph. Missing values take the column mean; numeric columns become
  z-scores, 0/1 columns stay as they are, constant columns carry nothing.
- hybrid: both blocks side by side, each scaled to a mean squared row length of
  1 and weighted by √(1 − balance) and √balance (0 = topology, 1 = attributes),
  so the squared distance is the balance's mix of the two.

umap-learn compiles its numba kernels the first time a worker runs it (~15 s,
cached on disk afterwards); it is imported here, on first use, so the other
layouts never pay for it.
"""

import math
import warnings
from typing import Any

import igraph as ig
import numpy as np
import scipy.sparse as sp
from numpy.typing import NDArray

from app import config
from app.models.layout import UmapOptions
from app.services.topology import METRICS

Coords = tuple[float, ...]
Matrix = NDArray[np.float64]


class UmapError(ValueError):
    """Options that cannot make an embedding (no features, too many nodes)."""


def topology_features(graph: ig.Graph, use_weights: bool) -> Any:
    """Sparse n×n rows of P + P² (P = the lazy random walk on the graph)."""
    n = graph.vcount()
    pairs = graph.get_edgelist()
    weights = graph.es["weight"] if use_weights and pairs else [1.0] * len(pairs)
    rows = [s for s, _ in pairs] + [t for _, t in pairs]
    cols = [t for _, t in pairs] + [s for s, _ in pairs]
    adjacency = sp.csr_matrix((weights * 2, (rows, cols)), shape=(n, n)) + sp.identity(
        n, format="csr"
    )
    degree = np.asarray(adjacency.sum(axis=1)).ravel()
    walk = sp.diags(1.0 / degree) @ adjacency
    two_steps = (walk + walk @ walk).tocsr()
    norms = np.sqrt(np.asarray(two_steps.multiply(two_steps).sum(axis=1)).ravel())
    return sp.diags(1.0 / norms) @ two_steps


def standardize(table: Matrix) -> Matrix:
    """Mean-impute missing values, z-score numeric columns, keep 0/1 columns."""
    out = np.array(table, dtype=float)
    out[~np.isfinite(out)] = np.nan
    for j in range(out.shape[1]):
        col = out[:, j]
        known = col[~np.isnan(col)]
        mean = float(known.mean()) if known.size else 0.0
        col[np.isnan(col)] = mean
        if np.isin(col, (0.0, 1.0)).all() and known.size:
            if col.min() == col.max():
                col[:] = 0.0  # every node alike: nothing to tell them apart
            continue
        std = float(col.std())
        out[:, j] = (col - mean) / std if std > 0 else 0.0
    return out


def _unit_rows(block: Matrix) -> Matrix:
    """Scale a block to a mean squared row length of 1 (if it has any spread)."""
    scale = math.sqrt(float((block**2).sum(axis=1).mean())) if block.size else 0.0
    return block / scale if scale > 0 else block


def attribute_features(
    graph: ig.Graph,
    features: dict[str, list[float | None]],
    width: int,
    metrics: list[str],
) -> Matrix:
    """n × (client columns + metrics), standardised."""
    names = graph.vs["name"]
    empty: list[float | None] = [None] * width
    columns: list[list[float]] = [
        [math.nan if v is None else float(v) for v in features.get(name, empty)] for name in names
    ]
    table = np.array(columns, dtype=float).reshape(len(names), width)
    for metric in metrics:
        if metric not in METRICS:
            raise UmapError(f"Unknown node metric: {metric}")
        values = np.array(METRICS[metric](graph, False), dtype=float).reshape(-1, 1)
        table = np.hstack([table, values])
    return standardize(table)


def embed(
    graph: ig.Graph,
    features: dict[str, list[float | None]],
    opts: UmapOptions,
    *,
    use_weights: bool,
    dim: int,
    seed: int,
) -> dict[str, Coords]:
    """UMAP coordinates (dim 2 or 3) for every vertex of `graph`, by name."""
    n = graph.vcount()
    names: list[str] = graph.vs["name"]
    if n > config.MAX_UMAP_NODES:
        raise UmapError(
            f"UMAP is limited to {config.MAX_UMAP_NODES} nodes per layout "
            f"(this one has {n}); lay out fewer layers or select nodes first."
        )
    if n < 3:  # nothing to learn: a point, or two points apart
        return {name: (float(i), *([0.0] * (dim - 1))) for i, name in enumerate(names)}

    data: Any
    if opts.mode == "topology":
        data = topology_features(graph, use_weights)
    else:
        attributes = attribute_features(graph, features, len(opts.feature_names), opts.metrics)
        if attributes.shape[1] == 0:
            raise UmapError(
                "Attribute and hybrid UMAP need features: tick value columns, "
                "annotation sets or node metrics."
            )
        if opts.mode == "attributes":
            data = attributes
        else:
            data = sp.hstack(
                [
                    math.sqrt(1 - opts.balance) * topology_features(graph, use_weights),
                    sp.csr_matrix(math.sqrt(opts.balance) * _unit_rows(attributes)),
                ],
                format="csr",
            )
            data.eliminate_zeros()

    import umap  # deferred: numba start-up, see the module docstring

    reducer = umap.UMAP(
        n_components=dim,
        n_neighbors=max(2, min(opts.n_neighbors, n - 1)),
        min_dist=opts.min_dist,
        metric=opts.metric,
        random_state=seed,  # one thread, same layout every time
        # spectral initialisation needs more nodes than dimensions + 1
        init="spectral" if n > dim + 2 else "random",
        # the time budget: fewer optimisation rounds on larger graphs
        n_epochs=500 if n <= 2000 else 200,
    )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # n_jobs vs random_state, disconnected graphs
        coords = reducer.fit_transform(data)
    return {name: tuple(float(v) for v in coords[i]) for i, name in enumerate(names)}
