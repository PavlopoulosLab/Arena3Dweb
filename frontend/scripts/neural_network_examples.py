#!/usr/bin/env python3
"""Build the neural-network examples in frontend/public/data.

  cnn_lenet           a small LeNet-like convolutional network: 7 layers,
                      3 channels (Convolution, Pooling, Dense)
  transformer_tiny    a tiny decoder-only (GPT-like) transformer with two blocks:
                      10 layers, 4 channels (Projection, Residual, Feed-forward,
                      Attention)
  lstm_unrolled       an LSTM unrolled over six time steps, one layer per step,
                      the gates as channels (7)
  unet                a U-Net encoder-decoder, its layers placed as a U, skip
                      connections as a channel (4)
  gnn_karate          a graph neural network on Zachary's karate club: the same
                      34 members in every layer (a multiplex), floors stacked
                      upwards, one per round of message passing (3 channels)
  vae                 a variational autoencoder with its bottleneck in the
                      middle (6 channels)

Each comes as a network file (.tsv), a node attributes file (colour, size,
description; annotation terms for the GNN) and a session (.json) with the
layers arranged. Every network layer is an Arena3D layer.

The networks are illustrative, not trained models. The CNN's first filters are
hand-made edge detectors run over a drawn digit "7", so node sizes show real
activations up to the second pooling layer. The transformer's attention patterns
are written by hand to show common head types (previous token, attention sink,
induction, ...). The LSTM runs a real forward pass with random weights; the GNN
runs a GCN's propagation without learned weights from two labelled members.
Other weights are random, and the U-Net and VAE outputs are drawn, not computed.

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
CHANNEL_PALETTE = [
    "#8DD3C7",
    "#FFFFB3",
    "#BEBADA",
    "#FB8072",
    "#80B1D3",
    "#FDB462",
    "#B3DE69",
    "#FCCDE5",
    "#D9D9D9",
    "#BC80BD",
]


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

    def layer(
        self,
        name: str,
        width: float,
        at: tuple[float, float, float] | None = None,
        rotation_z: float = 0,
    ) -> str:
        """A floor `width` wide. Floors stand side by side along x unless `at`
        places one; rotation_z = pi/2 lays it flat."""
        self.layers.append({"name": name, "width": width, "at": at, "rotation_z": rotation_z})
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
        annotations: list[str] | None = None,
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
            "annotations": annotations or [],
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

        terms = any(n["annotations"] for n in self.nodes.values())
        with open(DATA / f"{stem}_node_attributes.tsv", "w", encoding="utf-8") as f:
            f.write(
                "Node\tLayer\tColor\tSize\tDescription" + ("\tAnnotation" if terms else "") + "\n"
            )
            for n in self.nodes.values():
                row = f"{n['name']}\t{n['layer']}\t{n['color']}\t{n['size']:g}\t{n['descr']}"
                f.write(row + ("\t" + ";".join(n["annotations"]) if terms else "") + "\n")

        spacing = session_extras.pop("layer_spacing", 0)
        fade = session_extras.pop("fade", {})
        count = len(self.layers)
        layers = [
            {
                "name": layer["name"],
                **dict(
                    zip(
                        ("position_x", "position_y", "position_z"),
                        layer["at"] or (round((i - (count - 1) / 2) * spacing, 2), 0, 0),
                        strict=True,
                    )
                ),
                "last_layer_scale": 1,
                "rotation_x": 0,
                "rotation_y": 0,
                "rotation_z": layer["rotation_z"],
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
                "annotations": n["annotations"],
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


# --- shared helpers for the networks below ------------------------------------


def sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-x))


def dense(net: Network, srcs: list[str], dsts: list[str], channel: str, rng: random.Random) -> None:
    """All-to-all links with random weights (their absolute values)."""
    for d in dsts:
        for s in srcs:
            net.edge(s, d, abs(rng.uniform(-1, 1)), channel)


def grid_layer(
    net: Network,
    layer: str,
    count: int,
    cols: int,
    step: float,
    name: str,
    color: str,
    descr: str,
    size: float = 0.8,
) -> list[str]:
    """`count` units in a grid `cols` wide, centred on the floor."""
    rows = math.ceil(count / cols)
    return [
        net.node(
            f"{name} {k + 1}",
            layer,
            (k % cols - (cols - 1) / 2) * step,
            ((rows - 1) / 2 - k // cols) * step,
            color,
            size,
            descr.format(k=k + 1),
        )
        for k in range(count)
    ]


# --- the LSTM, unrolled over time ----------------------------------------------

SEQUENCE = ["Arena", "draws", "networks", "in", "3D", "space"]
LSTM_HIDDEN = 4  # memory cells
LSTM_INPUT = 3  # embedding size
# gate: row height, shift across (so its links to the cells do not overlap),
# colour, the channel of its link to the cell (or, for the output gate, to h)
GATES = {
    "forget": (45, -30, "#e41a1c", "Forget gate"),
    "input": (0, -10, "#4daf4a", "Input gate"),
    "candidate": (-45, 10, "#377eb8", "Candidate"),
    "output": (-90, 30, "#ff7f00", "Output gate"),
}
GATE_ROLE = {
    "forget": "how much of the old cell value to keep",
    "input": "how much of the candidate to write into the cell",
    "candidate": "the new value proposed for the cell (tanh)",
    "output": "how much of the cell to show as the hidden state",
}


def build_lstm() -> None:
    rng = random.Random(5)
    net = Network(
        [
            "Input",
            "Recurrent",
            "Cell state",
            "Forget gate",
            "Candidate",
            "Output gate",
            "Input gate",
        ]
    )
    H, X = LSTM_HIDDEN, LSTM_INPUT
    embed = {w: [rng.uniform(-1, 1) for _ in range(X)] for w in SEQUENCE}
    wx = {g: [[rng.uniform(-0.9, 0.9) for _ in range(X)] for _ in range(H)] for g in GATES}
    wh = {g: [[rng.uniform(-0.9, 0.9) for _ in range(H)] for _ in range(H)] for g in GATES}

    # the forward pass, step by step (the forget gate's bias is 1, as is usual)
    steps = []
    h, c = [0.0] * H, [0.0] * H
    for word in SEQUENCE:
        x = embed[word]
        act = {}
        for g in GATES:
            z = [
                sum(wx[g][k][j] * x[j] for j in range(X))
                + sum(wh[g][k][j] * h[j] for j in range(H))
                + (1.0 if g == "forget" else 0.0)
                for k in range(H)
            ]
            act[g] = [math.tanh(v) if g == "candidate" else sigmoid(v) for v in z]
        c = [act["forget"][k] * c[k] + act["input"][k] * act["candidate"][k] for k in range(H)]
        h = [act["output"][k] * math.tanh(c[k]) for k in range(H)]
        steps.append((word, x, act, c, h))
    top_c = max(abs(v) for *_, c, _ in steps for v in c)
    top_h = max(abs(v) for *_, h in steps for v in h)

    def col(k: int) -> float:
        return (k - (H - 1) / 2) * 100

    prev = None
    for t, (word, x, act, c, h) in enumerate(steps):
        layer = net.layer(f"Step {t + 1} · {word}", 460)
        where = f"Step {t + 1} ('{word}')"
        xs = [
            net.node(
                f"x {j + 1}",
                layer,
                (j - (X - 1) / 2) * 90,
                -175,
                "#ffd92f",
                0.9,
                f"{where}: input embedding value {j + 1} of '{word}' ({x[j]:+.2f}).",
            )
            for j in range(X)
        ]
        gates = {
            g: [
                net.node(
                    f"{g} {k + 1}",
                    layer,
                    col(k) + shift,
                    v,
                    color,
                    activation_size(abs(act[g][k]), 1),
                    f"{where}, {g} gate of memory cell {k + 1}: {act[g][k]:.2f} — {GATE_ROLE[g]}.",
                )
                for k in range(H)
            ]
            for g, (v, shift, color, _) in GATES.items()
        }
        cells = [
            net.node(
                f"cell {k + 1}",
                layer,
                col(k),
                120,
                "#bc80bd",
                activation_size(abs(c[k]), top_c),
                f"{where}, memory cell {k + 1}: c = {c[k]:+.2f} — the forget gate times the "
                "previous cell, plus the input gate times the candidate.",
            )
            for k in range(H)
        ]
        hidden = [
            net.node(
                f"hidden {k + 1}",
                layer,
                col(k),
                185,
                "#f0f0f0",
                activation_size(abs(h[k]), top_h),
                f"{where}, hidden state {k + 1}: h = {h[k]:+.2f} — the output gate times tanh(c); "
                "the next step's gates read it.",
            )
            for k in range(H)
        ]
        for g in GATES:
            for k in range(H):
                for j in range(X):
                    net.edge(xs[j], gates[g][k], abs(wx[g][k][j]), "Input")
                if prev:
                    for j in range(H):
                        net.edge(prev["hidden"][j], gates[g][k], abs(wh[g][k][j]), "Recurrent")
        for k in range(H):
            for g in ("forget", "input", "candidate"):
                net.edge(gates[g][k], cells[k], abs(act[g][k]), GATES[g][3])
            if prev:  # the cell state runs on, scaled by the forget gate
                net.edge(prev["cells"][k], cells[k], act["forget"][k], "Cell state")
            net.edge(cells[k], hidden[k], abs(math.tanh(c[k])), "Cell state")
            net.edge(gates["output"][k], hidden[k], act["output"][k], "Output gate")
        prev = {"hidden": hidden, "cells": cells}

    net.write(
        "lstm_unrolled",
        {
            "name": "LSTM unrolled over time",
            "layer_spacing": 400,
            "floor_color": "#5b6573",
            "fade": {"Input": 0.5, "Recurrent": 0.45},
            "scene": {
                "position_x": 110,
                "position_y": 30,
                "scale": 0.5,
                "color": "#000000",
                "rotation_x": 0.2,
                "rotation_y": 1.0,
                "rotation_z": 0,
            },
        },
    )


# --- the U-Net -------------------------------------------------------------------

LEVEL_COLORS = [
    ["#66c2a5", "#fc8d62"],
    ["#8da0cb", "#e78ac3", "#a6d854", "#ffd92f"],
    ["#8dd3c7", "#ffffb3", "#bebada", "#fb8072", "#80b1d3", "#fdb462", "#b3de69", "#fccde5"],
]


def build_unet() -> None:
    rng = random.Random(3)
    net = Network(["Convolution", "Down-sampling", "Up-sampling", "Skip connection"])
    N = 8
    # a noisy blob to segment, and the mask a trained U-Net should return
    mask = [
        [1 if ((r - 3.6) / 2.6) ** 2 + ((c - 4.2) / 2.2) ** 2 <= 1 else 0 for c in range(N)]
        for r in range(N)
    ]
    image = [
        [round(min(1.0, max(0.0, 0.7 * mask[r][c] + rng.uniform(-0.1, 0.35))), 2) for c in range(N)]
        for r in range(N)
    ]
    top, mid, low = 330, 0, -330  # the U: full size on top, the bottleneck below

    def feature_maps(
        layer: str,
        prefix: str,
        level: int,
        side: int,
        cols: int,
        step: float,
        gap: float,
        what: str,
    ) -> dict:
        maps = len(LEVEL_COLORS[level])
        rows = math.ceil(maps / cols)
        units = {}
        for m in range(maps):
            origin = tile_origin(m, cols, rows, side * step, gap)
            for r in range(side):
                for c in range(side):
                    u, v = grid_pos(origin, r, c, step)
                    units[m, r, c] = net.node(
                        f"{prefix} map {m + 1} · {r + 1},{c + 1}",
                        layer,
                        u,
                        v,
                        LEVEL_COLORS[level][m],
                        0.75,
                        f"{layer}, feature map {m + 1} of {maps} ({side}×{side}), unit "
                        f"({r + 1}, {c + 1}): {what}.",
                    )
        return units

    inp = net.layer("Input", 280, at=(-990, top, 0))
    pixel = {}
    for r in range(N):
        for c in range(N):
            u, v = grid_pos((-N * 13, N * 13), r, c, 26)
            pixel[r, c] = net.node(
                f"pixel {r + 1},{c + 1}",
                inp,
                u,
                v,
                hexmix("#3b4a5c", "#ffffff", image[r][c]),
                0.5 + 0.7 * image[r][c],
                f"Input pixel ({r + 1}, {c + 1}) of a noisy 8×8 image of a blob; intensity "
                f"{image[r][c]:g}.",
            )

    enc1 = net.layer("Encoder 1", 480, at=(-660, top, 0))
    e1 = feature_maps(enc1, "E1", 0, N, 2, 24, 30, "a 3×3 convolution of the input")
    for m in range(2):
        kernel = [[rng.uniform(-1, 1) for _ in range(3)] for _ in range(3)]
        for r in range(N):
            for c in range(N):
                for a in range(3):
                    for b in range(3):
                        rr, cc = r + a - 1, c + b - 1
                        if 0 <= rr < N and 0 <= cc < N:
                            net.edge(pixel[rr, cc], e1[m, r, c], abs(kernel[a][b]), "Convolution")

    def down(src: dict, src_maps: int, dst: dict, dst_maps: int, side: int) -> None:
        """A 2×2 convolution with stride 2: half the size, twice the maps."""
        for m in range(dst_maps):
            for r in range(side):
                for c in range(side):
                    for k in range(src_maps):
                        for a in range(2):
                            for b in range(2):
                                net.edge(
                                    src[k, 2 * r + a, 2 * c + b],
                                    dst[m, r, c],
                                    abs(rng.uniform(-1, 1)),
                                    "Down-sampling",
                                )

    def up(src: dict, src_maps: int, dst: dict, dst_maps: int, side: int, skip: dict) -> None:
        """A 2×2 transposed convolution (twice the size), plus the copied
        encoder maps of the same size: the skip connections."""
        for m in range(dst_maps):
            for r in range(side):
                for c in range(side):
                    for k in range(src_maps):
                        net.edge(
                            src[k, r // 2, c // 2],
                            dst[m, r, c],
                            abs(rng.uniform(-1, 1)),
                            "Up-sampling",
                        )
                    net.edge(skip[m, r, c], dst[m, r, c], 1.0, "Skip connection")

    enc2 = net.layer("Encoder 2", 300, at=(-330, mid, 0))
    e2 = feature_maps(
        enc2, "E2", 1, 4, 2, 26, 24, "a stride-2 convolution of encoder 1 (down-sampling)"
    )
    down(e1, 2, e2, 4, 4)
    bottom = net.layer("Bottleneck", 320, at=(0, low, 0))
    bn = feature_maps(
        bottom, "B", 2, 2, 4, 28, 20, "a stride-2 convolution of encoder 2: the coarsest view"
    )
    down(e2, 4, bn, 8, 2)
    dec2 = net.layer("Decoder 2", 300, at=(330, mid, 0))
    d2 = feature_maps(
        dec2, "D2", 1, 4, 2, 26, 24, "up-sampled from the bottleneck, plus the copied encoder 2 map"
    )
    up(bn, 8, d2, 4, 4, e2)
    dec1 = net.layer("Decoder 1", 480, at=(660, top, 0))
    d1 = feature_maps(
        dec1, "D1", 0, N, 2, 24, 30, "up-sampled from decoder 2, plus the copied encoder 1 map"
    )
    up(d2, 4, d1, 2, N, e1)

    out = net.layer("Output mask", 280, at=(990, top, 0))
    for r in range(N):
        for c in range(N):
            u, v = grid_pos((-N * 13, N * 13), r, c, 26)
            key = net.node(
                f"mask {r + 1},{c + 1}",
                out,
                u,
                v,
                "#ffffff" if mask[r][c] else "#3b4a5c",
                1.2 if mask[r][c] else 0.5,
                f"Output pixel ({r + 1}, {c + 1}): "
                + ("blob" if mask[r][c] else "background")
                + " in the mask a trained U-Net should return (drawn, not computed).",
            )
            for k in range(2):
                net.edge(d1[k, r, c], key, abs(rng.uniform(-1, 1)), "Convolution")

    net.write(
        "unet",
        {
            "name": "U-Net encoder–decoder",
            "floor_color": "#5b6573",
            "fade": {
                "Convolution": 0.35,
                "Down-sampling": 0.45,
                "Up-sampling": 0.45,
                "Skip connection": 0.5,
            },
            "scene": {
                "position_x": 130,
                "position_y": 0,
                "scale": 0.4,
                "color": "#000000",
                "rotation_x": 0.12,
                "rotation_y": 0.32,
                "rotation_z": 0,
            },
        },
    )


# --- the graph neural network on Zachary's karate club --------------------------

# Zachary WW (1977), J Anthropol Res 33:452-473: 34 members, 78 friendships
# (0-based, as igraph's Graph.Famous("Zachary") and networkx number them)
KARATE = [
    (0, 1), (0, 2), (0, 3), (0, 4), (0, 5), (0, 6), (0, 7), (0, 8), (0, 10), (0, 11),
    (0, 12), (0, 13), (0, 17), (0, 19), (0, 21), (0, 31), (1, 2), (1, 3), (1, 7), (1, 13),
    (1, 17), (1, 19), (1, 21), (1, 30), (2, 3), (2, 7), (2, 8), (2, 9), (2, 13), (2, 27),
    (2, 28), (2, 32), (3, 7), (3, 12), (3, 13), (4, 6), (4, 10), (5, 6), (5, 10), (5, 16),
    (6, 16), (8, 30), (8, 32), (8, 33), (9, 33), (13, 33), (14, 32), (14, 33), (15, 32),
    (15, 33), (18, 32), (18, 33), (19, 33), (20, 32), (20, 33), (22, 32), (22, 33), (23, 25),
    (23, 27), (23, 29), (23, 32), (23, 33), (24, 25), (24, 27), (24, 31), (25, 31), (26, 29),
    (26, 33), (27, 33), (28, 31), (28, 33), (29, 32), (29, 33), (30, 32), (30, 33), (31, 32),
    (31, 33), (32, 33),
]  # fmt: skip
# the members who joined the instructor's (Mr. Hi's) club after the split; the
# others followed the administrator (the "Officer")
MR_HI = {0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 16, 17, 19, 21}
FACTION_COLORS = {"Mr. Hi": "#e41a1c", "Officer": "#377eb8"}


def spring_layout(n: int, edges: list[tuple[int, int]], rng: random.Random) -> list[list[float]]:
    """Fruchterman-Reingold in the unit square, scaled to -1..1."""
    pos = [[rng.uniform(-1, 1), rng.uniform(-1, 1)] for _ in range(n)]
    k = math.sqrt(4 / n)
    temp = 0.2
    for _ in range(400):
        disp = [[0.0, 0.0] for _ in range(n)]
        for i in range(n):
            for j in range(i + 1, n):
                dx, dy = pos[i][0] - pos[j][0], pos[i][1] - pos[j][1]
                d = max(1e-4, math.hypot(dx, dy))
                f = k * k / d / d
                disp[i][0] += dx * f
                disp[i][1] += dy * f
                disp[j][0] -= dx * f
                disp[j][1] -= dy * f
        for a, b in edges:
            dx, dy = pos[a][0] - pos[b][0], pos[a][1] - pos[b][1]
            d = max(1e-4, math.hypot(dx, dy))
            f = d / k
            disp[a][0] -= dx * f
            disp[a][1] -= dy * f
            disp[b][0] += dx * f
            disp[b][1] += dy * f
        for i in range(n):
            d = max(1e-4, math.hypot(*disp[i]))
            step = min(d, temp)
            pos[i][0] += disp[i][0] / d * step
            pos[i][1] += disp[i][1] / d * step
        temp *= 0.99
    for axis in (0, 1):
        lo, hi = min(p[axis] for p in pos), max(p[axis] for p in pos)
        for p in pos:
            p[axis] = (p[axis] - lo) / (hi - lo) * 2 - 1
    return pos


def build_gnn() -> None:
    rng = random.Random(34)
    net = Network(["Graph edge", "Message", "Self"])
    n = 34
    nbrs: list[set[int]] = [set() for _ in range(n)]
    for a, b in KARATE:
        nbrs[a].add(b)
        nbrs[b].add(a)
    deg = [len(nbrs[v]) + 1 for v in range(n)]  # with the self loop
    pos = spring_layout(n, KARATE, rng)
    truth = ["Mr. Hi" if v in MR_HI else "Officer" for v in range(n)]

    # the propagation of a GCN layer, D^-1/2 (A + I) D^-1/2 H, with the learned
    # weights left out: from the two labelled members, instructor and administrator
    h = [[1.0, 0.0] if v == 0 else [0.0, 1.0] if v == n - 1 else [0.0, 0.0] for v in range(n)]
    rounds = [h]
    for _ in range(3):
        h = [
            [sum(h[u][f] / math.sqrt(deg[u] * deg[v]) for u in nbrs[v] | {v}) for f in (0, 1)]
            for v in range(n)
        ]
        rounds.append(h)
    predicted = [
        "Mr. Hi" if s[0] > s[1] else "Officer" if s[1] > s[0] else "undecided" for s in rounds[-1]
    ]
    right = sum(p == t for p, t in zip(predicted, truth, strict=True))

    def member(v: int) -> str:
        return f"member {v + 1}"

    def role(v: int) -> str:
        return {0: " (the instructor, Mr. Hi)", n - 1: " (the administrator, the Officer)"}.get(
            v, ""
        )

    names = ["Input", "GCN layer 1", "GCN layer 2", "GCN layer 3", "Output"]
    keys = []
    for k, name in enumerate(names):
        # flat floors stacked upwards, the input at the bottom
        layer = net.layer(name, 560, at=(0, (k - 2) * 260, 0), rotation_z=math.pi / 2)
        scores = rounds[min(k, 3)]
        top = max(sum(s) for s in scores)
        row = []
        for v in range(n):
            s = scores[v]
            terms = [f"{truth[v]}'s club"]
            if k == len(names) - 1:
                color = FACTION_COLORS.get(predicted[v], "#8a8a8a")
                size = 1.1
                terms.append(f"predicted {predicted[v]}")
                if predicted[v] != truth[v]:
                    terms.append("misclassified")
                text = (
                    f"{member(v).capitalize()}{role(v)}: predicted {predicted[v]}, "
                    f"joined {truth[v]}'s club after the split"
                    + ("." if predicted[v] == truth[v] else " — misclassified.")
                )
            else:
                total = s[0] + s[1]
                color = (
                    hexmix(FACTION_COLORS["Officer"], FACTION_COLORS["Mr. Hi"], s[0] / total)
                    if total
                    else "#8a8a8a"
                )
                size = round(0.45 + 0.9 * math.sqrt(total / top), 3)
                if k == 0:
                    text = f"{member(v).capitalize()}{role(v)}: " + (
                        f"labelled {truth[v]}." if total else "no label."
                    )
                    if total:
                        terms.append("labelled")
                else:
                    text = (
                        f"{member(v).capitalize()}{role(v)} after {k} round(s) of message "
                        f"passing: Mr. Hi {s[0]:.3f}, Officer {s[1]:.3f}"
                        + (f" ({s[0] / total:.0%} Mr. Hi)." if total else ".")
                    )
            row.append(
                net.node(
                    member(v),
                    layer,
                    pos[v][0] * 230,
                    pos[v][1] * 230,
                    color,
                    size,
                    text,
                    terms,
                )
            )
        for a, b in KARATE:
            net.edge(row[a], row[b], 1.0, "Graph edge")
        if keys:
            last = keys[-1]
            for v in range(n):
                if k < len(names) - 1:
                    for u in nbrs[v]:
                        net.edge(last[u], row[v], 1 / math.sqrt(deg[u] * deg[v]), "Message")
                    net.edge(last[v], row[v], 1 / deg[v], "Self")
                else:
                    net.edge(last[v], row[v], 1.0, "Self")
        keys.append(row)

    print(f"gnn_karate: {right} of {n} members predicted right")
    net.write(
        "gnn_karate",
        {
            "name": "Graph neural network on the karate club",
            "floor_color": "#5b6573",
            "fade": {"Message": 0.5, "Self": 0.6},
            "scene": {
                "position_x": 120,
                "position_y": 0,
                "scale": 0.44,
                "color": "#000000",
                "rotation_x": 0.5,
                "rotation_y": 0.6,
                "rotation_z": 0,
            },
        },
    )


# --- the variational autoencoder -------------------------------------------------

THREE = [
    ".####.",
    "....##",
    "..###.",
    "....##",
    ".####.",
    "......",
]


def build_vae() -> None:
    rng = random.Random(9)
    net = Network(["Encoder", "Mean", "Log-variance", "Sampling", "Noise", "Decoder"])
    N = 6
    image = [[1.0 if ch == "#" else 0.0 for ch in row] for row in THREE]
    # the output is drawn as a blurred copy of the input — the typical look of
    # a VAE's reconstruction; the network itself is not trained
    blur = [
        [
            sum(
                image[rr][cc]
                for rr in range(max(0, r - 1), min(N, r + 2))
                for cc in range(max(0, c - 1), min(N, c + 2))
            )
            / 9
            for c in range(N)
        ]
        for r in range(N)
    ]
    top_blur = max(max(row) for row in blur)

    def picture(layer: str, values: list[list[float]], what: str) -> list[str]:
        keys = []
        for r in range(N):
            for c in range(N):
                u, v = grid_pos((-N * 17, N * 17), r, c, 34)
                keys.append(
                    net.node(
                        f"pixel {r + 1},{c + 1}",
                        layer,
                        u,
                        v,
                        hexmix("#3b4a5c", "#ffffff", values[r][c]),
                        round(0.5 + 0.7 * values[r][c], 3),
                        f"{what} pixel ({r + 1}, {c + 1}); intensity {values[r][c]:.2f}.",
                    )
                )
        return keys

    inp = picture(net.layer("Input", 260), image, "Input: a 6×6 drawing of the digit 3,")
    enc1 = grid_layer(
        net, net.layer("Encoder 1", 220), 16, 4, 40, "unit", "#66c2a5", "Encoder unit {k} of 16."
    )
    dense(net, inp, enc1, "Encoder", rng)
    enc2 = grid_layer(
        net, net.layer("Encoder 2", 200), 8, 2, 40, "unit", "#66c2a5", "Encoder unit {k} of 8."
    )
    dense(net, enc1, enc2, "Encoder", rng)

    latent = net.layer("Latent μ, log σ²", 180)
    mu = [rng.uniform(-1.5, 1.5) for _ in range(3)]
    logvar = [rng.uniform(-2, 0) for _ in range(3)]
    mus = [
        net.node(
            f"μ {k + 1}",
            latent,
            -40,
            (1 - k) * 50,
            "#fc8d62",
            activation_size(abs(mu[k]), 1.5),
            f"Mean of latent dimension {k + 1}: {mu[k]:+.2f}.",
        )
        for k in range(3)
    ]
    logvars = [
        net.node(
            f"log σ² {k + 1}",
            latent,
            40,
            (1 - k) * 50,
            "#e78ac3",
            0.8,
            f"Log-variance of latent dimension {k + 1}: {logvar[k]:+.2f} "
            f"(σ = {math.exp(logvar[k] / 2):.2f}).",
        )
        for k in range(3)
    ]
    for k in range(3):
        for s in enc2:
            net.edge(s, mus[k], abs(rng.uniform(-1, 1)), "Mean")
            net.edge(s, logvars[k], abs(rng.uniform(-1, 1)), "Log-variance")

    sample = net.layer("Sample z", 180)
    eps = [max(-2.5, min(2.5, rng.gauss(0, 1))) for _ in range(3)]
    zs = []
    for k in range(3):
        sigma = math.exp(logvar[k] / 2)
        z = mu[k] + sigma * eps[k]
        noise = net.node(
            f"ε {k + 1}",
            sample,
            -45,
            (1 - k) * 50,
            "#b3b3b3",
            0.6,
            f"Random noise ε for latent dimension {k + 1}: {eps[k]:+.2f}, drawn from N(0, 1).",
        )
        zk = net.node(
            f"z {k + 1}",
            sample,
            35,
            (1 - k) * 50,
            "#ffd92f",
            1.0,
            f"Latent code z{k + 1} = μ + σ·ε = {z:+.2f} (the reparameterisation trick).",
        )
        net.edge(mus[k], zk, 1.0, "Sampling")
        net.edge(logvars[k], zk, sigma, "Sampling")
        net.edge(noise, zk, abs(eps[k]) / 2.5, "Noise")
        zs.append(zk)

    dec1 = grid_layer(
        net, net.layer("Decoder 1", 200), 8, 2, 40, "unit", "#8da0cb", "Decoder unit {k} of 8."
    )
    dense(net, zs, dec1, "Decoder", rng)
    dec2 = grid_layer(
        net, net.layer("Decoder 2", 220), 16, 4, 40, "unit", "#8da0cb", "Decoder unit {k} of 16."
    )
    dense(net, dec1, dec2, "Decoder", rng)
    out = picture(
        net.layer("Output", 260),
        [[v / top_blur for v in row] for row in blur],
        "Reconstruction (drawn as a blurred copy of the input, not computed):",
    )
    dense(net, dec2, out, "Decoder", rng)

    net.write(
        "vae",
        {
            "name": "Variational autoencoder (VAE)",
            "layer_spacing": 330,
            "floor_color": "#5b6573",
            "fade": {"Encoder": 0.3, "Decoder": 0.3},
            "scene": {
                "position_x": 110,
                "position_y": 20,
                "scale": 0.52,
                "color": "#000000",
                "rotation_x": 0.2,
                "rotation_y": 1.0,
                "rotation_z": 0,
            },
        },
    )


if __name__ == "__main__":
    build_cnn()
    build_transformer()
    build_lstm()
    build_unet()
    build_gnn()
    build_vae()
