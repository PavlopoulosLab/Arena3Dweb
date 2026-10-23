"""Session JSON import normalization — ports the JSON path of functions/input.R
(loadNetworkFromJSONFilepath → parseUploadedJSON + isJSONValid).

Fills defaults for scene/layers/nodes/edges, handles channels, dedups edges,
and decides the scramble/generate-coordinate flags — so a partial JSON (e.g. an
external-API payload with only src/trg) renders like v2.
"""

import math
import re
from typing import Any

from app import config


class SessionValidationError(ValueError):
    """A blocking JSON-format failure."""


def _empty(v: Any) -> bool:
    return v is None or v == "" or (isinstance(v, str) and v.strip() == "")


def _default(value: Any, default: Any = "0") -> Any:
    """Ports keepValuesOrDefault: fill None/empty with default, coerce TRUE/FALSE."""
    if value is None:
        return default
    if value == "TRUE":
        return True
    if value == "FALSE":
        return False
    if isinstance(value, list):
        return [default if _empty(x) else x for x in value]
    return default if _empty(value) else value


# colours go into the page's style attributes and SVG: CSS colour forms only
# (as frontend/src/utils.ts safeColor)
_CSS_COLOUR = re.compile(
    r"^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|hsl)a?\([\d\s.,%/+-]{1,60}\)|[a-z]{3,20})$",
    re.I,
)
_SAFE_URL = re.compile(r"^(https?://|mailto:)", re.I)


def _colour(value: Any, default: str) -> str:
    v = _default(value, default)
    return v.strip() if isinstance(v, str) and _CSS_COLOUR.match(v.strip()) else default


def _validate(data: dict[str, Any]) -> None:
    if not set(config.MANDATORY_JSON_OBJECTS).issubset(data):
        raise SessionValidationError(
            "Your JSON file must contain at least these objects: layers, nodes, edges"
        )
    # Each must be a list of objects — otherwise the .get()/subscript calls below
    # raise AttributeError/TypeError and 500 instead of a clean 400. Reachable
    # from /api/session/import and /api/external (arbitrary caller JSON).
    for key in config.MANDATORY_JSON_OBJECTS:
        value = data[key]
        if not isinstance(value, list) or not all(isinstance(x, dict) for x in value):
            raise SessionValidationError(f"JSON '{key}' must be a list of objects.")
    # names are text or numbers: a list or object as a name is unhashable and
    # broke the checks below with a 500
    named = (("layers", ("name",)), ("nodes", ("name", "layer")), ("edges", ("src", "trg")))
    for key, fields in named:
        for row in data[key]:
            for f in fields:
                v = row.get(f)
                if v is not None and (isinstance(v, bool) or not isinstance(v, str | int | float)):
                    raise SessionValidationError(f"JSON {key} '{f}' must be text.")
    layers = data["layers"]
    if not layers or any(_empty(row.get("name")) for row in layers):
        raise SessionValidationError("JSON layers must each have a non-empty name.")
    if len({row["name"] for row in layers}) != len(layers):
        # Duplicate names collapse layerGroups on the frontend, orphaning the
        # earlier layer's nodes onto the wrong plane.
        raise SessionValidationError("JSON layer names must be unique.")
    if len({row["name"] for row in layers}) > config.MAX_LAYERS:
        raise SessionValidationError(
            f"The network must contain no more than {config.MAX_LAYERS} layers."
        )
    nodes = data["nodes"]
    # DoS fix: unlike the TSV upload path (parser.py), JSON session import and
    # the /api/external hand-off had no node/edge count limit at all.
    if len(nodes) > config.MAX_NODES:
        raise SessionValidationError(
            f"The network must contain no more than {config.MAX_NODES} nodes."
        )
    if any(_empty(n.get("name")) or _empty(n.get("layer")) for n in nodes):
        raise SessionValidationError("JSON nodes must each have a non-empty name and layer.")
    # Referential integrity: the frontend parents every node to layerGroups[layer]
    # and resolves edge endpoints against the node registry, so a dangling
    # reference crashes the scene build. Reject it here with a 400 instead.
    layer_names = {row["name"] for row in layers}
    bad_layer = next((n["layer"] for n in nodes if n["layer"] not in layer_names), None)
    if bad_layer is not None:
        raise SessionValidationError(f"JSON node references unknown layer '{bad_layer}'.")
    node_ids = {f"{n['name']}_{n['layer']}" for n in nodes}
    edges = data["edges"]
    # Same DoS fix as the node-count check above, for edges.
    if len(edges) > config.MAX_EDGES:
        raise SessionValidationError(
            f"The network must contain no more than {config.MAX_EDGES} edges."
        )
    if any(_empty(e.get("src")) or _empty(e.get("trg")) for e in edges):
        raise SessionValidationError("JSON edges must each have a non-empty src and trg.")
    bad_edge = next(
        (e for e in edges if e["src"] not in node_ids or e["trg"] not in node_ids),
        None,
    )
    if bad_edge is not None:
        raise SessionValidationError(
            f"JSON edge references unknown node ({bad_edge['src']} -> {bad_edge['trg']})."
        )


def _handle_channels(edges: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    """Drop channels entirely if any edge lacks one (ports handleJSONChannels)."""
    warnings: list[str] = []
    named = [not _empty(e.get("channel")) for e in edges]
    if any(named) and not all(named):
        warnings.append("At least one edge has no channel name. Removing channels completely.")
    if not all(named):
        # every edge empty (sessions saved without channels) is no warning
        for e in edges:
            e.pop("channel", None)
    return edges, warnings


def _dedup_edges(edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, ...]] = set()
    out: list[dict[str, Any]] = []
    has_channel = any("channel" in e for e in edges)
    for e in edges:
        key = (e["src"], e["trg"], e.get("channel", "")) if has_channel else (e["src"], e["trg"])
        if key not in seen:
            seen.add(key)
            out.append(e)
    return out


def _arrow_layers(value: Any, layers: list[dict[str, Any]]) -> list[str] | None:
    """The layers that draw arrowheads, among the session's own (each once);
    anything but a list means every layer (None)."""
    if not isinstance(value, list):
        return None
    names = {str(row.get("name")) for row in layers}
    return list(dict.fromkeys(str(v) for v in value if str(v) in names))


def _strength(value: Any) -> float:
    """A 0-1 strength; anything missing or unreadable is 0 (off)."""
    try:
        v = float(value)
    except (TypeError, ValueError):
        return 0.0
    return min(1.0, max(0.0, v)) if v == v else 0.0


# Multi-channel edges: parallel lines side by side (as STRING draws them),
# Bézier curves or one shared straight line
EDGE_SHAPES = ("parallel", "curved", "straight")


def _edge_shape(value: Any) -> str:
    """The edge shape; anything missing or unknown is the default, parallel."""
    return value if value in EDGE_SHAPES else EDGE_SHAPES[0]


def _hive(value: Any) -> dict[str, Any] | None:
    """The hive plot arrangement (curved links; the plane its axes radiate in,
    as two directions; axes in that plane or spread in 3D — sessions from before
    3D axes are flat), or None when it is off or unreadable."""
    if not isinstance(value, dict):
        return None
    try:
        right = [float(v) for v in value["right"]]
        up = [float(v) for v in value["up"]]
    except (KeyError, TypeError, ValueError):
        return None
    if len(right) != 3 or len(up) != 3 or not all(math.isfinite(v) for v in right + up):
        return None
    return {
        "curved": bool(value.get("curved", True)),
        "right": right,
        "up": up,
        "axes": "3d" if value.get("axes") == "3d" else "flat",
    }


def _number(value: Any, lo: float, hi: float) -> float | None:
    """A finite number clamped to [lo, hi], or None when unreadable."""
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    return min(hi, max(lo, v)) if math.isfinite(v) else None


def _label(value: Any, limit: int = 200) -> str | None:
    """A name to show (network, annotation set): one line of text (control
    characters and runs of spaces become one space), trimmed and at most
    `limit` long, or None."""
    if not isinstance(value, str):
        return None
    text = re.sub(r"[\s\x00-\x1f\x7f]+", " ", value).strip()[:limit].strip()
    return text or None


# Annotations menu: what the groups are drawn around, and how
HULL_SOURCES = ("none", "cluster", "annotation")
HULL_STYLES = ("hull", "outline", "fog", "cloud", "sphere", "ellipsoid", "box")
MAX_HIDDEN_GROUPS = 1000


def _theme(value: Any) -> dict[str, Any] | None:
    """The scene theme a session was saved with: a short id (the frontend
    knows the names) and whether its colours were applied; None when the
    session has none or it is unreadable, so older sessions load as before."""
    if not isinstance(value, dict):
        return None
    name = value.get("name")
    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", name):
        return None
    return {"name": name, "applied": value.get("applied") is not False}


def _annotation_view(value: Any) -> dict[str, Any] | None:
    """How the annotation groups are drawn (Draw around, Draw as, Opacity,
    Padding, pie charts, the groups whose hull is switched off), each part
    falling back to its default when unreadable; None when the session has no
    such block, so older sessions load as before."""
    if not isinstance(value, dict):
        return None
    opacity = _number(value.get("opacity"), 0.05, 1)
    padding = _number(value.get("padding"), 0.25, 3)
    hidden = value.get("hidden")
    # names kept as written: they must match the nodes' terms and clusters
    groups = (
        [h for h in hidden if isinstance(h, str) and h.strip() and len(h) <= 500]
        if isinstance(hidden, list)
        else []
    )
    return {
        "source": value.get("source") if value.get("source") in HULL_SOURCES else "none",
        "style": value.get("style") if value.get("style") in HULL_STYLES else "hull",
        "opacity": 0.35 if opacity is None else opacity,
        "padding": 1.0 if padding is None else padding,
        "pies": value.get("pies") is True,
        "hidden": list(dict.fromkeys(groups))[:MAX_HIDDEN_GROUPS],
    }


def _hex(value: Any) -> str | None:
    """A #rrggbb colour, or None."""
    return value if isinstance(value, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", value) else None


# Edge line types (Edit → Style)
LINE_TYPES = ("solid", "dashed", "dotted")
# Node label looks and positions (Edit → Style); "right" is the default and
# is not written
LABEL_LOOKS = ("plain", "halo", "box", "shadow")
LABEL_POSITIONS = ("centre", "above", "below")


# Edit → Nodes → Show Labels
LABEL_MODES = ("all", "selected", "chosen", "none")


def _node_labels(value: Any) -> dict[str, Any] | None:
    """Which node labels show (every one, the selection's, the chosen ones —
    with the selection's when withSelection — or none), or None for a session
    from before, which loads with the default."""
    if not isinstance(value, dict) or value.get("mode") not in LABEL_MODES:
        return None
    return {"mode": value["mode"], "withSelection": value.get("withSelection") is not False}


LAYER_LABEL_FONTS = ("sans", "serif", "mono", "condensed")
LAYER_LABEL_POSITIONS = ("above", "below")  # "corner", the default, is not written


def _layer_label(row: dict[str, Any]) -> None:
    """Keep a layer label's look (Edit → Layers → Labels & axes) when
    readable, drop it otherwise; layers without it look as before."""
    checks: dict[str, Any] = {
        "label_style": _label_look(row.get("label_style")),
        "label_font": row.get("label_font") if row.get("label_font") in LAYER_LABEL_FONTS else None,
        "label_bold": True if row.get("label_bold") is True else None,
        "label_italic": True if row.get("label_italic") is True else None,
        "label_color": _hex(row.get("label_color")),
        "label_position": row.get("label_position")
        if row.get("label_position") in LAYER_LABEL_POSITIONS
        else None,
    }
    for key, value in checks.items():
        if value is None:
            row.pop(key, None)
        else:
            row[key] = value


def _label_look(value: Any) -> dict[str, Any] | None:
    """A node's label look (style, halo/box/shadow colour or '' for auto,
    halo px, box opacity, bold), or None when absent or unreadable."""
    if not isinstance(value, dict) or value.get("style") not in LABEL_LOOKS:
        return None
    width = _number(value.get("width", 2), 0.5, 8)
    opacity = _number(value.get("opacity", 0.75), 0.05, 1)
    return {
        "style": value["style"],
        "color": _hex(value.get("color")) or "",
        "width": 2.0 if width is None else width,
        "opacity": 0.75 if opacity is None else opacity,
        "bold": value.get("bold") is True,
    }


def _node_style(n: dict[str, Any]) -> None:
    """Keep the optional per-node style (Edit → Style) when readable, drop it
    otherwise; nodes without it render as before."""
    checks: dict[str, Any] = {
        "opacity": _number(n.get("opacity"), 0.05, 1),
        "border_color": _hex(n.get("border_color")),
        "border_width": _number(n.get("border_width"), 0, 10),
        "label_color": _hex(n.get("label_color")),
        "label_size": _number(n.get("label_size"), 4, 72),
    }
    stretch = n.get("stretch")
    if isinstance(stretch, list) and len(stretch) == 3:
        axes = [_number(v, 0.1, 10) for v in stretch]
        checks["stretch"] = None if None in axes else axes
    else:
        checks["stretch"] = None
    label = n.get("label")
    checks["label"] = label[:200] if isinstance(label, str) and label.strip() else None
    checks["label_style"] = _label_look(n.get("label_style"))
    checks["label_shown"] = True if n.get("label_shown") is True else None
    position = n.get("label_position")
    checks["label_position"] = position if position in LABEL_POSITIONS else None
    for key, value in checks.items():
        if value is None:
            n.pop(key, None)
        else:
            n[key] = value


def _edge_style(e: dict[str, Any]) -> None:
    """The same for the optional per-edge style."""
    checks: dict[str, Any] = {
        "opacity_factor": _number(e.get("opacity_factor"), 0, 1),
        "line_type": e.get("line_type") if e.get("line_type") in LINE_TYPES else None,
        "arrow_color": _hex(e.get("arrow_color")),
    }
    for key, value in checks.items():
        if value is None:
            e.pop(key, None)
        else:
            e[key] = value


def normalize_session(data: dict[str, Any]) -> dict[str, Any]:
    """Validate + fill defaults, returning the canonical session dict."""
    _validate(data)

    scene = dict(data.get("scene") or {})
    scene["position_x"] = _default(scene.get("position_x"))
    scene["position_y"] = _default(scene.get("position_y"))
    scene["scale"] = _default(scene.get("scale"), "0.9")
    scene["color"] = _default(scene.get("color"), "#000000")
    for axis in ("rotation_x", "rotation_y", "rotation_z"):
        scene[axis] = _default(scene.get(axis), "0.261799388")

    layers = [dict(row) for row in data["layers"]]
    for row in layers:
        has_pos = all(not _empty(row.get(f"position_{a}")) for a in "xyz")
        row["generate_coordinates"] = not has_pos
        for a in "xyz":
            row[f"position_{a}"] = _default(row.get(f"position_{a}"))
            row[f"rotation_{a}"] = _default(row.get(f"rotation_{a}"))
        row["last_layer_scale"] = _default(row.get("last_layer_scale"), "1")
        row["floor_current_color"] = _colour(
            row.get("floor_current_color"), config.FLOOR_DEFAULT_COLOR
        )
        row["geometry_parameters_width"] = _default(
            row.get("geometry_parameters_width"), config.FLOOR_DEFAULT_WIDTH
        )
        _layer_label(row)

    nodes = [dict(n) for n in data["nodes"]]
    scramble = all(_empty(n.get("position_x")) for n in nodes) if nodes else True
    layer_names = [row["name"] for row in layers]
    for n in nodes:
        for a in "xyz":
            n[f"position_{a}"] = _default(n.get(f"position_{a}"))
        n["scale"] = _default(n.get("scale"), 1)
        if _empty(n.get("color")) or not _CSS_COLOUR.match(str(n.get("color")).strip()):
            i = layer_names.index(n["layer"]) if n["layer"] in layer_names else 0
            n["color"] = config.NODE_COLORS[i % len(config.NODE_COLORS)]
        # a node's link opens on a click: web and mail links only
        url = _default(n.get("url"), "")
        n["url"] = url if isinstance(url, str) and _SAFE_URL.match(url.strip()) else ""
        n["descr"] = _default(n.get("descr"), "")
        # optional (Phase 6): list of annotation terms; anything else is dropped
        terms = n.get("annotations")
        n["annotations"] = (
            [str(t) for t in terms if not _empty(t)][:12] if isinstance(terms, list) else []
        )
        _node_style(n)

    edges = [dict(e) for e in data["edges"]]
    edges, warnings = _handle_channels(edges)
    edges = _dedup_edges(edges)
    for e in edges:
        e["opacity"] = _default(e.get("opacity"), 1)
        e["color"] = _colour(e.get("color"), config.EDGE_DEFAULT_COLOR)
        _edge_style(e)

    return {
        "scene": scene,
        "layers": layers,
        "nodes": nodes,
        "edges": edges,
        "universalLabelColor": _default(data.get("universalLabelColor"), "#FFFFFF"),
        "direction": _default(data.get("direction"), False),
        "arrowLayers": _arrow_layers(data.get("arrowLayers"), layers),
        "interLayerArrows": data.get("interLayerArrows") is not False,
        "edgeOpacityByWeight": _default(data.get("edgeOpacityByWeight"), True),
        # Sessions written before edge thickness existed default to off, so
        # they keep rendering exactly as they did.
        "edgeWidthByWeight": _default(data.get("edgeWidthByWeight"), False),
        "scramble_nodes": scramble,
        "intraEdgeBundling": _strength(data.get("intraEdgeBundling")),
        "interEdgeBundling": _strength(data.get("interEdgeBundling")),
        "edgeShape": _edge_shape(data.get("edgeShape")),
        "hive": _hive(data.get("hive")),
        "name": _label(data.get("name")),
        "annotationSet": _label(data.get("annotationSet")),
        "annotationView": _annotation_view(data.get("annotationView")),
        "theme": _theme(data.get("theme")),
        "nodeLabels": _node_labels(data.get("nodeLabels")),
        "warnings": warnings,
    }
