"""Session JSON import normalization — ports the JSON path of functions/input.R
(loadNetworkFromJSONFilepath → parseUploadedJSON + isJSONValid).

Fills defaults for scene/layers/nodes/edges, handles channels, dedups edges,
and decides the scramble/generate-coordinate flags — so a partial JSON (e.g. an
external-API payload with only src/trg) renders like v2.
"""

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
        row["floor_current_color"] = _default(
            row.get("floor_current_color"), config.FLOOR_DEFAULT_COLOR
        )
        row["geometry_parameters_width"] = _default(
            row.get("geometry_parameters_width"), config.FLOOR_DEFAULT_WIDTH
        )

    nodes = [dict(n) for n in data["nodes"]]
    scramble = all(_empty(n.get("position_x")) for n in nodes) if nodes else True
    layer_names = [row["name"] for row in layers]
    for n in nodes:
        for a in "xyz":
            n[f"position_{a}"] = _default(n.get(f"position_{a}"))
        n["scale"] = _default(n.get("scale"), 1)
        if _empty(n.get("color")):
            i = layer_names.index(n["layer"]) if n["layer"] in layer_names else 0
            n["color"] = config.NODE_COLORS[i % len(config.NODE_COLORS)]
        n["url"] = _default(n.get("url"), "")
        n["descr"] = _default(n.get("descr"), "")
        # optional (Phase 6): list of annotation terms; anything else is dropped
        terms = n.get("annotations")
        n["annotations"] = (
            [str(t) for t in terms if not _empty(t)][:12] if isinstance(terms, list) else []
        )

    edges = [dict(e) for e in data["edges"]]
    edges, warnings = _handle_channels(edges)
    edges = _dedup_edges(edges)
    for e in edges:
        e["opacity"] = _default(e.get("opacity"), 1)
        e["color"] = _default(e.get("color"), config.EDGE_DEFAULT_COLOR)

    return {
        "scene": scene,
        "layers": layers,
        "nodes": nodes,
        "edges": edges,
        "universalLabelColor": _default(data.get("universalLabelColor"), "#FFFFFF"),
        "direction": _default(data.get("direction"), False),
        "edgeOpacityByWeight": _default(data.get("edgeOpacityByWeight"), True),
        # Sessions written before edge thickness existed default to off, so
        # they keep rendering exactly as they did.
        "edgeWidthByWeight": _default(data.get("edgeWidthByWeight"), False),
        "scramble_nodes": scramble,
        "intraEdgeBundling": _strength(data.get("intraEdgeBundling")),
        "interEdgeBundling": _strength(data.get("interEdgeBundling")),
        "edgeShape": _edge_shape(data.get("edgeShape")),
        "warnings": warnings,
    }
