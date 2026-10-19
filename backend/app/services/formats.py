"""Network file formats beyond the Arena3D TSV — PLAN-ROADMAP Phase 8.

GraphML, GML, SIF and Cytoscape CX2 (also what NDEx serves) are converted
into Arena3D TSV rows and run through `parser.parse_network_tsv`, so every
format gets the same validation, weight scaling and size limits.

Layers come from a node attribute named `layer` (or `Layer`); networks
without one land in a single default layer. Channels come from an edge
attribute `channel` / `interaction` (SIF relation types), weights from
`weight` / `Weight`.
"""

import json
import os
import re
import xml.etree.ElementTree as ET  # noqa: S405 — DTDs are rejected before parsing
from typing import Any

from app import config
from app.models.network import NetworkModel
from app.services.parser import NetworkValidationError, parse_network_tsv

LAYER_KEYS = ("layer", "Layer", "LAYER")
CHANNEL_KEYS = ("channel", "Channel", "interaction", "Interaction")
WEIGHT_KEYS = ("weight", "Weight", "WEIGHT")
NAME_KEYS = ("name", "label", "Name", "Label", "id")

# file extension -> format
EXTENSIONS = {
    ".graphml": "graphml",
    ".xml": "graphml",
    ".gml": "gml",
    ".sif": "sif",
    ".cx2": "cx2",
    ".cx": "cx2",
}


def _cell(value: Any) -> str:
    return " ".join(str(value).split())


def _first(attrs: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for k in keys:
        v = attrs.get(k)
        if v not in (None, ""):
            return v
    return None


def _rows_to_tsv(rows: list[tuple[str, str, str, str, float | None, str | None]]) -> str:
    """rows: (source, source_layer, target, target_layer, weight, channel)"""
    if not rows:
        raise NetworkValidationError("The file has no edges.")
    weighted = any(r[4] is not None for r in rows)
    channels = any(r[5] for r in rows)
    header = ["SourceNode", "SourceLayer", "TargetNode", "TargetLayer"]
    header += ["Weight"] if weighted else []
    header += ["Channel"] if channels else []
    lines = ["\t".join(header)]
    for s, sl, t, tl, w, ch in rows:
        cells = [_cell(s), _cell(sl), _cell(t), _cell(tl)]
        if weighted:
            cells.append(f"{w if w is not None else 1:g}")
        if channels:
            cells.append(_cell(ch or "interaction"))
        lines.append("\t".join(cells))
    return "\n".join(lines) + "\n"


def _float(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f and abs(f) != float("inf") else None


# ---------------------------------------------------------------- GraphML / GML
# Parsed in Python rather than with igraph's readers: an igraph error raised
# off the main thread (thread pools, the test client) aborts the process, so a
# malformed upload could take the worker down.
Element = tuple[str, dict[str, Any]]  # (id, attributes)


def _graph_rows(
    nodes: dict[str, dict[str, Any]], edges: list[tuple[str, str, dict[str, Any]]]
) -> list[tuple[str, str, str, str, float | None, str | None]]:
    def vertex(vid: str) -> tuple[str, str]:
        attrs = nodes.get(vid, {})
        name = _first(attrs, NAME_KEYS)
        layer = _first(attrs, LAYER_KEYS)
        return (
            str(name if name is not None else vid),
            str(layer) if layer is not None else config.DEFAULT_LAYER_NAME,
        )

    rows = []
    for s, t, attrs in edges:
        if s not in nodes or t not in nodes:
            raise NetworkValidationError(f"An edge refers to an unknown node ({s} -> {t}).")
        (sn, sl), (tn, tl) = vertex(s), vertex(t)
        rows.append(
            (sn, sl, tn, tl, _float(_first(attrs, WEIGHT_KEYS)), _first(attrs, CHANNEL_KEYS))
        )
    return rows


def _local(el: ET.Element) -> str:
    return str(el.tag).rsplit("}", 1)[-1]  # drop the XML namespace


def _from_graphml(text: str) -> str:
    if "<!DOCTYPE" in text or "<!ENTITY" in text:
        # no DTDs: blocks XML external-entity / entity-expansion tricks outright
        raise NetworkValidationError("GraphML files with a DOCTYPE or entities are not accepted.")
    try:
        root = ET.fromstring(text)
    except ET.ParseError as e:
        raise NetworkValidationError(f"Could not read this GraphML file: {e}") from e
    keys = {
        k.get("id", ""): k.get("attr.name") or k.get("id") or ""
        for k in root.iter()
        if _local(k) == "key"
    }

    def data(el: ET.Element) -> dict[str, Any]:
        return {
            keys.get(d.get("key", ""), d.get("key", "")): (d.text or "").strip()
            for d in el
            if _local(d) == "data"
        }

    nodes = {n.get("id", ""): data(n) for n in root.iter() if _local(n) == "node"}
    edges = [
        (e.get("source", ""), e.get("target", ""), data(e))
        for e in root.iter()
        if _local(e) == "edge"
    ]
    if _local(root) != "graphml" or not nodes:
        raise NetworkValidationError("This is not a GraphML file with nodes.")
    return _rows_to_tsv(_graph_rows(nodes, edges))


_GML_TOKEN = re.compile(r'"([^"]*)"|(\[|\])|([^\s\[\]"]+)')


def _gml_parse(tokens: list[str], i: int) -> tuple[dict[str, list[Any]], int]:
    """key value pairs until "]" / end; values are scalars or nested lists."""
    out: dict[str, list[Any]] = {}
    while i < len(tokens):
        key = tokens[i]
        if key == "]":
            return out, i + 1
        if i + 1 >= len(tokens):
            raise NetworkValidationError("Could not read this GML file: dangling key.")
        value: Any
        if tokens[i + 1] == "[":
            value, i = _gml_parse(tokens, i + 2)
        else:
            value, i = tokens[i + 1], i + 2
        out.setdefault(key, []).append(value)
    return out, i


def _flat(block: dict[str, list[Any]]) -> dict[str, Any]:
    """A GML block's scalar attributes (first value per key)."""
    return {k: v[0] for k, v in block.items() if not isinstance(v[0], dict)}


def _from_gml(text: str) -> str:
    lines = [ln for ln in text.splitlines() if not ln.lstrip().startswith("#")]
    tokens = [
        m.group(1) if m.group(1) is not None else m.group(2) or m.group(3)
        for m in _GML_TOKEN.finditer("\n".join(lines))
    ]
    doc, _ = _gml_parse(tokens, 0)
    graph = (doc.get("graph") or [None])[0]
    if not isinstance(graph, dict):
        raise NetworkValidationError("Could not read this GML file: no graph [ ... ] block.")
    nodes = {
        str(_flat(n).get("id")): _flat(n) for n in graph.get("node", []) if isinstance(n, dict)
    }
    edges = [
        (str(_flat(e).get("source")), str(_flat(e).get("target")), _flat(e))
        for e in graph.get("edge", [])
        if isinstance(e, dict)
    ]
    return _rows_to_tsv(_graph_rows(nodes, edges))


# ---------------------------------------------------------------- SIF
def _from_sif(text: str) -> str:
    """`source <tab or space> relation <targets...>`; relation -> channel."""
    rows: list[tuple[str, str, str, str, float | None, str | None]] = []
    for line in text.splitlines():
        parts = line.split("\t") if "\t" in line else line.split()
        parts = [p.strip() for p in parts if p.strip()]
        if len(parts) < 3:
            continue  # a lone node (no edges) cannot be shown in Arena3D
        source, relation, *targets = parts
        layer = config.DEFAULT_LAYER_NAME
        rows += [(source, layer, t, layer, None, relation) for t in targets]
        if len(rows) > 2 * config.MAX_EDGES:  # refused before it is built
            raise NetworkValidationError(
                f"The network must contain no more than {config.MAX_EDGES} edges."
            )
    return _rows_to_tsv(rows)


# ---------------------------------------------------------------- CX2
def _from_cx2(data: Any) -> str:
    """Cytoscape CX2: a JSON list of aspects; nodes/edges carry attributes in `v`."""
    if not isinstance(data, list):
        raise NetworkValidationError("A CX2 file is a JSON list of aspects.")
    nodes: dict[Any, dict[str, Any]] = {}
    edges: list[dict[str, Any]] = []
    for aspect in data:
        if not isinstance(aspect, dict):
            continue
        for n in aspect.get("nodes", []) or []:
            if isinstance(n, dict) and "id" in n:
                nodes[n["id"]] = n.get("v") or {}
        for e in aspect.get("edges", []) or []:
            if isinstance(e, dict):
                edges.append(e)
    rows = []
    for e in edges:
        if e.get("s") not in nodes or e.get("t") not in nodes:
            continue
        sv, tv, ev = nodes[e["s"]], nodes[e["t"]], e.get("v") or {}
        sl = _first(sv, LAYER_KEYS) or config.DEFAULT_LAYER_NAME
        tl = _first(tv, LAYER_KEYS) or config.DEFAULT_LAYER_NAME
        rows.append(
            (
                str(_first(sv, NAME_KEYS) or e["s"]),
                str(sl),
                str(_first(tv, NAME_KEYS) or e["t"]),
                str(tl),
                _float(_first(ev, WEIGHT_KEYS)),
                _first(ev, CHANNEL_KEYS),
            )
        )
    return _rows_to_tsv(rows)


def parse_network_file(text: str, filename: str) -> NetworkModel:
    """Dispatch on the file extension; anything else is the Arena3D TSV."""
    try:
        return _parse_network_file(text, filename)
    except (RecursionError, TypeError, KeyError, AttributeError) as e:
        # a deeply nested GML or CX2, or a CX2 with odd ids: refused, not a 500
        raise NetworkValidationError("Could not read this file: it is malformed.") from e


def _parse_network_file(text: str, filename: str) -> NetworkModel:
    fmt = EXTENSIONS.get(os.path.splitext(filename.lower())[1])
    if fmt == "graphml":
        return parse_network_tsv(_from_graphml(text))
    if fmt == "gml":
        return parse_network_tsv(_from_gml(text))
    if fmt == "sif":
        return parse_network_tsv(_from_sif(text))
    if fmt == "cx2":
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise NetworkValidationError("This CX2 file is not valid JSON.") from e
        return parse_network_tsv(_from_cx2(data))
    return parse_network_tsv(text)


def parse_cx2(data: Any) -> NetworkModel:
    return parse_network_tsv(_from_cx2(data))
