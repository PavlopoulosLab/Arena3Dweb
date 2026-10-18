#!/usr/bin/env python3
"""Build the two neural-network examples in frontend/public/data.

  cnn_lenet.tsv          a small LeNet-like convolutional network: 7 layers,
  cnn_lenet.json         3 channels (Convolution, Pooling, Dense)
  transformer_tiny.tsv   a tiny decoder-only (GPT-like) transformer with two
  transformer_tiny.json  blocks: 10 layers, 4 channels (Projection, Residual,
                         Feed-forward, Attention)

plus a node attributes file for each (colour, size, description), for loading
the .tsv by hand. Every network layer is an Arena3D layer; the .json sessions
place the layers side by side, left to right, with the units laid out inside.

The networks are illustrative, not trained models. The CNN's first filters are
hand-made edge detectors run over a drawn digit "7", so node sizes show real
activations up to the second pooling layer; its other weights are random. The
transformer's attention patterns are written by hand to show common head types
(previous token, attention sink, induction, ...); its other weights are random.

Standard library only, and seeded: every run writes the same files.

  python3 frontend/scripts/neural_network_examples.py
"""

import json
import math
import random
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "public" / "data"

# the app's channel palette (backend config CHANNEL_COLORS_LIGHT): a session
# colours its channels in this order of first appearance
CHANNEL_PALETTE = ["#8DD3C7", "#FFFFB3", "#BEBADA", "#FB8072", "#80B1D3"]


def hexmix(a: str, b: str, t: float) -> str:
    """The colour t of the way from a to b."""
    ca = [int(a[i : i + 2], 16) for i in (1, 3, 5)]
    cb = [int(b[i : i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(ca, cb, strict=True))


class Network:
    """Nodes (per layer, with an in-plane position) and channel-tagged edges."""

    def __init__(self, channels: list[str]) -> None:
        self.channels = channels
        self.layers: list[dict] = []
        self.nodes: dict[str, dict] = {}  # "name_layer" -> node
        self.edges: list[tuple[str, str, float, str]] = []

    def layer(self, name: str, width: float) -> str:
        self.layers.append({"name": name, "width": width})
        return name

    def node(
        self,
        name: str,
        layer: str,
        u: float,
        v: float,
        color: str,
        size: float = 1.0,
        descr: str = "",
    ) -> str:
        key = f"{name}_{layer}"
        assert key not in self.nodes, key
        self.nodes[key] = {
            "name": name,
            "layer": layer,
            "u": u,
            "v": v,
            "color": color,
            "size": size,
            "descr": descr,
        }
        return key

    def edge(self, src: str, trg: str, weight: float, channel: str) -> None:
        assert channel in self.channels, channel
        self.edges.append((src, trg, round(weight, 4), channel))

    def check(self) -> None:
        pairs = [(s, t) for s, t, _, _ in self.edges]
        assert len(pairs) == len(set(pairs)), "one edge per pair"
        assert len(self.layers) <= 20 and len(self.channels) <= 10
        assert len(self.edges) <= 10_000

    def write(self, stem: str, session_extras: dict) -> None:
        self.check()
        rank = {c: i for i, c in enumerate(self.channels)}
        # edges grouped by channel, so the channels appear in palette order
        edges = sorted(self.edges, key=lambda e: rank[e[3]])
        weights = [w for _, _, w, _ in edges]
        lo, hi = min(weights), max(weights)

        with open(DATA / f"{stem}.tsv", "w", encoding="utf-8") as f:
            f.write("SourceNode\tSourceLayer\tTargetNode\tTargetLayer\tWeight\tChannel\n")
            for s, t, w, c in edges:
                a, b = self.nodes[s], self.nodes[t]
                f.write(f"{a['name']}\t{a['layer']}\t{b['name']}\t{b['layer']}\t{w:g}\t{c}\n")

        with open(DATA / f"{stem}_node_attributes.tsv", "w", encoding="utf-8") as f:
            f.write("Node\tLayer\tColor\tSize\tDescription\n")
            for n in self.nodes.values():
                f.write(f"{n['name']}\t{n['layer']}\t{n['color']}\t{n['size']:g}\t{n['descr']}\n")

        spacing = session_extras.pop("layer_spacing")
        fade = session_extras.pop("fade", {})
        count = len(self.layers)
        layers = [
            {
                "name": layer["name"],
                "position_x": round((i - (count - 1) / 2) * spacing, 2),
                "position_y": 0,
                "position_z": 0,
                "last_layer_scale": 1,
                "rotation_x": 0,
                "rotation_y": 0,
                "rotation_z": 0,
                "floor_current_color": session_extras.get("floor_color", "#777777"),
                "geometry_parameters_width": layer["width"],
                "floor_shape": "square",
                "floor_style": "solid",
                "container": "floor",
                "floor_visible": True,
                "generate_coordinates": False,
            }
            for i, layer in enumerate(self.layers)
        ]
        nodes = [
            {
                "name": n["name"],
                "layer": n["layer"],
                # a floor's own plane: y up, z across
                "position_x": 0,
                "position_y": round(n["v"], 2),
                "position_z": round(n["u"], 2),
                "scale": n["size"],
                "color": n["color"],
                "url": "",
                "descr": n["descr"],
                "annotations": [],
                "shape": "sphere",
            }
            for n in self.nodes.values()
        ]
        session = {
            "name": session_extras["name"],
            "scene": session_extras["scene"],
            "layers": layers,
            "nodes": nodes,
            "edges": [
                {
                    "src": s,
                    "trg": t,
                    # the scaled weight, 0.1-1, as a TSV upload computes it
                    "opacity": round(0.1 + 0.9 * (w - lo) / (hi - lo), 4),
                    "color": CHANNEL_PALETTE[rank[c]],
                    "channel": c,
                    # Edit → Style: dense channels drawn fainter, so the nodes show
                    **({"opacity_factor": fade[c]} if c in fade else {}),
                }
                for s, t, w, c in edges
            ],
            "universalLabelColor": "#ffffff",
            "direction": False,
            "edgeOpacityByWeight": True,
            "edgeWidthByWeight": False,
            "scramble_nodes": False,
            "intraEdgeBundling": 0,
            "interEdgeBundling": 0,
            "edgeShape": "parallel",
        }
        # one node or edge per line: small, and still readable
        with open(DATA / f"{stem}.json", "w", encoding="utf-8") as f:
            f.write("{\n")
            for k, (key, value) in enumerate(session.items()):
                comma = "," if k < len(session) - 1 else ""
                if isinstance(value, list):
                    rows = ",\n".join(
                        "  " + json.dumps(v, ensure_ascii=False, separators=(",", ":"))
                        for v in value
                    )
                    f.write(f" {json.dumps(key)}: [\n{rows}\n ]{comma}\n")
                else:
                    f.write(f" {json.dumps(key)}: {json.dumps(value, ensure_ascii=False)}{comma}\n")
            f.write("}\n")
        print(
            f"{stem}: {len(self.layers)} layers, {len(self.nodes)} nodes, "
            f"{len(self.edges)} edges, {len(self.channels)} channels"
        )


# --- the convolutional network ---------------------------------------------

DIGIT = [
    "..........",
    ".########.",
    ".......##.",
    "......##..",
    ".....##...",
    "....##....",
    "....#.....",
    "...##.....",
    "...#......",
    "..........",
]

# conv 1: four hand-made 3x3 edge detectors (Sobel-like; the links carry
# their absolute values, halved to 0-1). Each fires where the ink lies on one
# side of an edge: above a horizontal one, left of a vertical one, ...
KERNELS = {
    "horizontal edges": [[1, 2, 1], [0, 0, 0], [-1, -2, -1]],
    "vertical edges": [[1, 0, -1], [2, 0, -2], [1, 0, -1]],
    "diagonal edges ↘": [[0, 1, 2], [-1, 0, 1], [-2, -1, 0]],
    "diagonal edges ↗": [[2, 1, 0], [1, 0, -1], [0, -1, -2]],
}
# conv 2: which pool-1 maps each conv-2 map reads (sparse, as in LeNet-5)
CONV2_TABLE = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]]
MAP_COLORS = ["#e41a1c", "#377eb8", "#4daf4a", "#ff7f00", "#984ea3", "#f781bf"]


def tile_origin(index: int, cols: int, rows: int, size: float, gap: float) -> tuple[float, float]:
    """Top-left corner (u, v) of tile `index` in a cols x rows grid centred on 0."""
    col, row = index % cols, index // cols
    width = cols * size + (cols - 1) * gap
    height = rows * size + (rows - 1) * gap
    return -width / 2 + col * (size + gap), height / 2 - row * (size + gap)


def grid_pos(origin: tuple[float, float], r: int, c: int, step: float) -> tuple[float, float]:
    return origin[0] + c * step + step / 2, origin[1] - r * step - step / 2


def activation_size(a: float, top: float) -> float:
    """Node size from an activation: small but visible when silent."""
    return round(0.35 + 0.95 * (a / top if top else 0), 3)


def build_cnn() -> None:
    rng = random.Random(7)
    net = Network(["Convolution", "Pooling", "Dense"])
    W = 10  # input image W x W
    image = [[1.0 if ch == "#" else 0.0 for ch in row] for row in DIGIT]

    # input image
    inp = net.layer("Input", 360)
    step = 30
    origin = (-W * step / 2, W * step / 2)
    pixel = {}
    for r in range(W):
        for c in range(W):
            u, v = grid_pos(origin, r, c, step)
            pixel[r, c] = net.node(
                f"pixel {r + 1},{c + 1}",
                inp,
                u,
                v,
                hexmix("#3b4a5c", "#ffffff", image[r][c]),
                0.6 + 0.6 * image[r][c],
                f"Input pixel (row {r + 1}, column {c + 1}) of a 10×10 drawing of the digit 7; "
                f"intensity {image[r][c]:g}.",
            )

    # conv 1: 3x3, no padding -> 4 maps of 8 x 8
    conv1 = net.layer("Conv 1", 400)
    M1 = W - 2
    c1_act = {}
    for k, kernel in enumerate(KERNELS.values()):
        for r in range(M1):
            for c in range(M1):
                s = sum(kernel[a][b] * image[r + a][c + b] for a in range(3) for b in range(3))
                c1_act[k, r, c] = max(0.0, s)
    top = max(c1_act.values())
    step = 20
    c1 = {}
    for k, (label, kernel) in enumerate(KERNELS.items()):
        origin = tile_origin(k, 2, 2, M1 * step, 26)
        for r in range(M1):
            for c in range(M1):
                u, v = grid_pos(origin, r, c, step)
                c1[k, r, c] = net.node(
                    f"C1 map {k + 1} · {r + 1},{c + 1}",
                    conv1,
                    u,
                    v,
                    MAP_COLORS[k],
                    activation_size(c1_act[k, r, c], top),
                    f"Conv 1, feature map {k + 1} ({label}), unit ({r + 1}, {c + 1}): a 3×3 "
                    f"filter over input pixels {r + 1}–{r + 3} × {c + 1}–{c + 3}; "
                    f"ReLU activation {c1_act[k, r, c]:g}.",
                )
                for a in range(3):
                    for b in range(3):
                        net.edge(
                            pixel[r + a, c + b], c1[k, r, c], abs(kernel[a][b]) / 2, "Convolution"
                        )

    # pool 1: 2x2 max -> 4 maps of 4 x 4
    pool1 = net.layer("Max-pool 1", 260)
    M2 = M1 // 2
    p1_act = {}
    step = 24
    p1 = {}
    for k in range(4):
        origin = tile_origin(k, 2, 2, M2 * step, 26)
        for r in range(M2):
            for c in range(M2):
                window = [(2 * r + a, 2 * c + b) for a in range(2) for b in range(2)]
                best = max(window, key=lambda rc: c1_act[k, rc[0], rc[1]])
                p1_act[k, r, c] = c1_act[k, best[0], best[1]]
                u, v = grid_pos(origin, r, c, step)
                p1[k, r, c] = net.node(
                    f"P1 map {k + 1} · {r + 1},{c + 1}",
                    pool1,
                    u,
                    v,
                    MAP_COLORS[k],
                    activation_size(p1_act[k, r, c], top),
                    f"Max-pool 1, map {k + 1}, unit ({r + 1}, {c + 1}): the largest of a 2×2 "
                    f"window of conv 1 map {k + 1} (the strongest link is the one that wins).",
                )
                for rc in window:
                    net.edge(c1[k, rc[0], rc[1]], p1[k, r, c], 1 if rc == best else 0.25, "Pooling")

    # conv 2: 3x3 with padding 1 -> 6 maps of 4 x 4, each reading two pool-1 maps
    conv2 = net.layer("Conv 2", 300)
    weights2 = [
        [[[rng.uniform(-1, 1) for _ in range(3)] for _ in range(3)] for _ in maps]
        for maps in CONV2_TABLE
    ]
    c2_act = {}
    for m, maps in enumerate(CONV2_TABLE):
        for r in range(M2):
            for c in range(M2):
                s = 0.0
                for i, k in enumerate(maps):
                    for a in range(3):
                        for b in range(3):
                            rr, cc = r + a - 1, c + b - 1
                            if 0 <= rr < M2 and 0 <= cc < M2:
                                s += weights2[m][i][a][b] * p1_act[k, rr, cc]
                c2_act[m, r, c] = max(0.0, s)
    top2 = max(c2_act.values())
    step = 20
    c2 = {}
    for m, maps in enumerate(CONV2_TABLE):
        origin = tile_origin(m, 2, 3, M2 * step, 24)
        color = hexmix(MAP_COLORS[maps[0]], MAP_COLORS[maps[1]], 0.5)
        for r in range(M2):
            for c in range(M2):
                u, v = grid_pos(origin, r, c, step)
                c2[m, r, c] = net.node(
                    f"C2 map {m + 1} · {r + 1},{c + 1}",
                    conv2,
                    u,
                    v,
                    color,
                    activation_size(c2_act[m, r, c], top2),
                    f"Conv 2, feature map {m + 1}, unit ({r + 1}, {c + 1}): 3×3 filters "
                    f"(padding 1) over pool-1 maps {maps[0] + 1} and {maps[1] + 1}; ReLU "
                    f"activation {c2_act[m, r, c]:.2f}.",
                )
                for i, k in enumerate(maps):
                    for a in range(3):
                        for b in range(3):
                            rr, cc = r + a - 1, c + b - 1
                            if 0 <= rr < M2 and 0 <= cc < M2:
                                net.edge(
                                    p1[k, rr, cc],
                                    c2[m, r, c],
                                    abs(weights2[m][i][a][b]),
                                    "Convolution",
                                )

    # pool 2: 2x2 max -> 6 maps of 2 x 2
    pool2 = net.layer("Max-pool 2", 220)
    M3 = M2 // 2
    step = 26
    p2 = []
    for m, maps in enumerate(CONV2_TABLE):
        origin = tile_origin(m, 2, 3, M3 * step, 26)
        color = hexmix(MAP_COLORS[maps[0]], MAP_COLORS[maps[1]], 0.5)
        for r in range(M3):
            for c in range(M3):
                window = [(2 * r + a, 2 * c + b) for a in range(2) for b in range(2)]
                best = max(window, key=lambda rc: c2_act[m, rc[0], rc[1]])
                u, v = grid_pos(origin, r, c, step)
                key = net.node(
                    f"P2 map {m + 1} · {r + 1},{c + 1}",
                    pool2,
                    u,
                    v,
                    color,
                    activation_size(c2_act[m, best[0], best[1]], top2),
                    f"Max-pool 2, map {m + 1}, unit ({r + 1}, {c + 1}): the largest of a 2×2 "
                    f"window of conv 2 map {m + 1}. Flattened, the 24 units feed the dense layer.",
                )
                p2.append(key)
                for rc in window:
                    net.edge(c2[m, rc[0], rc[1]], key, 1 if rc == best else 0.25, "Pooling")

    # dense: 12 units, all-to-all
    dense = net.layer("Dense", 200)
    hidden = []
    for j in range(12):
        key = net.node(
            f"FC {j + 1}",
            dense,
            0,
            (5.5 - j) * 26,
            "#9ecae1",
            0.9,
            f"Dense (fully connected) unit {j + 1}: reads all 24 units of max-pool 2.",
        )
        hidden.append(key)
        for src in p2:
            net.edge(src, key, abs(rng.uniform(-1, 1)), "Dense")

    # output: 10 classes, all-to-all
    output = net.layer("Output", 200)
    for d in range(10):
        key = net.node(
            f"digit {d}",
            output,
            0,
            (4.5 - d) * 28,
            "#fdd49e",
            1.0,
            f"Output class '{d}': a softmax over the ten digits (the weights are random, "
            f"so this untrained network has no real answer).",
        )
        for src in hidden:
            net.edge(src, key, abs(rng.uniform(-1, 1)), "Dense")

    net.write(
        "cnn_lenet",
        {
            "name": "Convolutional neural network (LeNet-like)",
            "layer_spacing": 470,
            "floor_color": "#5b6573",
            "fade": {"Convolution": 0.3, "Pooling": 0.6, "Dense": 0.5},
            # the input image in front, the layers going back to the right
            "scene": {
                "position_x": 140,
                "position_y": 20,
                "scale": 0.46,
                "color": "#000000",
                "rotation_x": 0.2,
                "rotation_y": 1.0,
                "rotation_z": 0,
            },
        },
    )


# --- the transformer ---------------------------------------------------------

TOKENS = ["BOS", "Arena", "draws", "networks", "in", "3D", ".", "Arena", "draws"]
HEAD_COLORS = ["#e41a1c", "#ff7f00", "#4daf4a", "#377eb8"]
D_FF = 4  # MLP units per token shown


def tok(i: int) -> str:
    """Name of token position i (0-based) — the same word twice stays distinct."""
    return f"{TOKENS[i]} ({i + 1})"


def softmax_row(scores: list[float]) -> list[float]:
    top = max(scores)
    e = [math.exp(s - top) for s in scores]
    total = sum(e)
    return [x / total for x in e]


def head_scores(block: int, head: int, i: int, j: int) -> float:
    """Attention score of query i for key j <= i, written by hand per head."""
    t = TOKENS
    if block == 1:
        if head == 0:  # previous token
            return 4.0 if j == i - 1 else 0.0
        if head == 1:  # attention sink on BOS
            return 3.0 if j == 0 else 0.0
        if head == 2:  # local: decays with distance
            return -0.9 * (i - j)
        return 0.0  # broad: uniform over the context
    if head == 0:  # induction: the token after an earlier copy of this one
        return 5.0 if 0 < j < i and t[j - 1] == t[i] else (1.5 if j == 0 else 0.0)
    if head == 1:  # duplicate token: an earlier copy of this one
        return 5.0 if j < i and t[j] == t[i] else (1.5 if j == 0 else 0.0)
    if head == 2:  # punctuation: the full stop
        return 3.0 if t[j] == "." else (1.0 if j == 0 else 0.0)
    return -0.6 * (i - j)  # recency


HEAD_NAMES = {
    1: ["previous token", "attention sink (BOS)", "local window", "broad (uniform)"],
    2: ["induction", "duplicate token", "punctuation", "recency"],
}

# next-token predictions per position (top choices with probabilities)
NEXT = [
    [("Arena", 0.30), ("graphs", 0.22)],
    [("draws", 0.45), ("and", 0.15)],
    [("graphs", 0.35), ("networks", 0.30), ("layers", 0.20)],
    [("in", 0.55), ("and", 0.25)],
    [("3D", 0.60), ("2D", 0.30)],
    [(".", 0.70), ("and", 0.20)],
    [("Arena", 0.40), ("graphs", 0.15)],
    [("draws", 0.85)],
    [("networks", 0.80), ("graphs", 0.08)],
]
VOCAB = ["Arena", "draws", "networks", "graphs", "layers", "and", "in", "3D", "2D", "."]


def build_transformer() -> None:
    rng = random.Random(11)
    net = Network(["Projection", "Residual", "Feed-forward", "Attention"])
    n = len(TOKENS)
    dv = 46  # down: one row per token position, the first on top
    WIDTH = 580  # every floor, so the layer names line up

    def row(i: int) -> float:
        return ((n - 1) / 2 - i) * dv

    def stream(name: str, what: str) -> list[str]:
        """A residual-stream layer: one node per token position."""
        layer = net.layer(name, WIDTH)
        return [
            net.node(tok(i), layer, 0, row(i), "#d9d9d9", 1.0, f"{tok(i)}: {what}")
            for i in range(n)
        ]

    emb_layer = net.layer("Embedding", WIDTH)
    resid = [
        net.node(
            tok(i),
            emb_layer,
            0,
            row(i),
            "#ffd92f",
            1.1,
            f"Token '{TOKENS[i]}' at position {i + 1}: token embedding plus position embedding.",
        )
        for i in range(n)
    ]

    for block in (1, 2):
        # attention: per head a column of keys (and values) and a column of
        # queries, linked as attention weights — as BertViz draws a head
        att = net.layer(f"Block {block} · Attention", WIDTH)
        keys, queries = [], []
        for h in range(4):
            left = -250 + h * 150
            what = f"Block {block}, head {h + 1} ({HEAD_NAMES[block][h]})"
            keys.append(
                [
                    net.node(
                        f"H{h + 1} key · {tok(i)}",
                        att,
                        left,
                        row(i),
                        hexmix(HEAD_COLORS[h], "#ffffff", 0.45),
                        0.7,
                        f"{what}: key and value of {tok(i)}.",
                    )
                    for i in range(n)
                ]
            )
            queries.append(
                [
                    net.node(
                        f"H{h + 1} query · {tok(i)}",
                        att,
                        left + 80,
                        row(i),
                        HEAD_COLORS[h],
                        0.85,
                        f"{what}: query of {tok(i)}, which may attend only to itself and "
                        "earlier tokens (causal mask); the links are the attention weights.",
                    )
                    for i in range(n)
                ]
            )
        for h in range(4):
            for i in range(n):
                # queries, keys and values all come from the residual stream
                net.edge(resid[i], keys[h][i], abs(rng.uniform(0.3, 1)), "Projection")
                net.edge(resid[i], queries[h][i], abs(rng.uniform(0.3, 1)), "Projection")
        for h in range(4):
            for i in range(n):
                probs = softmax_row([head_scores(block, h, i, j) for j in range(i + 1)])
                for j in range(i + 1):
                    if probs[j] >= 0.03:
                        net.edge(keys[h][j], queries[h][i], probs[j], "Attention")

        mid = stream(
            f"Block {block} · Add & Norm 1",
            f"residual stream after block {block}'s attention — the input plus the four "
            "heads' output projection, layer-normalised.",
        )
        for i in range(n):
            net.edge(resid[i], mid[i], 1.0, "Residual")
            for h in range(4):
                net.edge(queries[h][i], mid[i], abs(rng.uniform(0.3, 1)), "Projection")

        # MLP: the same small network applied to each position on its own
        mlp = net.layer(f"Block {block} · MLP", WIDTH)
        units = []
        for i in range(n):
            column = []
            for k in range(D_FF):
                key = net.node(
                    f"n{k + 1} · {tok(i)}",
                    mlp,
                    (k - (D_FF - 1) / 2) * 44,
                    row(i),
                    "#a6d854",
                    0.75,
                    f"Block {block} MLP unit {k + 1} at {tok(i)}: the MLP acts on each position "
                    "alone — tokens only exchange information in attention.",
                )
                column.append(key)
                net.edge(mid[i], key, abs(rng.uniform(0.2, 1)), "Feed-forward")
            units.append(column)

        out = stream(
            f"Block {block} · Add & Norm 2",
            f"residual stream after block {block}'s MLP, layer-normalised.",
        )
        for i in range(n):
            net.edge(mid[i], out[i], 1.0, "Residual")
            for key in units[i]:
                net.edge(key, out[i], abs(rng.uniform(0.2, 1)), "Feed-forward")
        resid = out

    # output: next-token logits over a small vocabulary (unembedding)
    output = net.layer("Output", WIDTH)
    last = dict(NEXT[-1])
    words = {}
    for v, word in enumerate(VOCAB):
        p = last.get(word, 0.0)
        words[word] = net.node(
            word,
            output,
            0,
            ((len(VOCAB) - 1) / 2 - v) * 44,
            "#fc8d62",
            round(0.6 + 1.2 * p, 3),
            f"Next-token logit for '{word}'"
            + (f" — {p:.0%} after the last token" if p else "")
            + ". Every position predicts the token after it; the size shows the "
            "prediction after the last 'draws'.",
        )
    for i, choices in enumerate(NEXT):
        for word, p in choices:
            net.edge(resid[i], words[word], p, "Projection")

    net.write(
        "transformer_tiny",
        {
            "name": "Transformer, decoder-only (LLM-like)",
            "layer_spacing": 320,
            "floor_color": "#5b6573",
            "fade": {"Projection": 0.35, "Feed-forward": 0.6},
            # from the side, a little above: each token's residual stream is a
            # line from the embedding on the left to the output on the right
            "scene": {
                "position_x": 100,
                "position_y": 70,
                "scale": 0.33,
                "color": "#000000",
                "rotation_x": 0.35,
                "rotation_y": 0.72,
                "rotation_z": 0.1,
            },
        },
    )


if __name__ == "__main__":
    build_cnn()
    build_transformer()
