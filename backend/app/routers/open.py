"""POST /api/open — the simplest way into Arena3D for other tools.

A list of edges (or the text of an Arena3D TSV file) is parsed exactly like an
upload, laid out per layer here on the server, turned into a session and stored
under a token as /api/external does; the returned URL opens it. Callers never
need to know the session format.
"""

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app import config
from app.models.layout import LayoutRequest
from app.models.network import NetworkModel
from app.models.open import OpenNode, OpenRequest, OpenResponse
from app.routers.external import store_session
from app.services.layouts import LAYOUTS, LayoutError, compute_layout
from app.services.parser import NetworkValidationError, parse_network_tsv

router = APIRouter()

FIT = 0.9  # laid-out nodes fill this share of the floor width


def _tsv(req: OpenRequest) -> str:
    """The request's network as Arena3D TSV text (the upload parser does the rest)."""
    if (req.edges is None) == (req.tsv is None):
        raise HTTPException(status_code=400, detail="Send either `edges` or `tsv`, not both.")
    if req.tsv is not None:
        return req.tsv
    edges = req.edges or []
    if not edges:
        raise HTTPException(status_code=400, detail="`edges` is empty.")
    weighted = any(e.weight is not None for e in edges)
    channelled = any(e.channel for e in edges)
    if channelled and not all(e.channel for e in edges):
        raise HTTPException(
            status_code=400, detail="Either every edge has a channel or none of them."
        )
    header = ["SourceNode", "SourceLayer", "TargetNode", "TargetLayer"]
    if weighted:
        header.append("Weight")
    if channelled:
        header.append("Channel")
    rows = ["\t".join(header)]
    for e in edges:
        cells = [e.source, e.source_layer, e.target, e.target_layer or e.source_layer]
        if weighted:
            cells.append("1" if e.weight is None else repr(float(e.weight)))
        if channelled:
            cells.append(e.channel or "")
        if any("\t" in c or "\n" in c or "\r" in c for c in cells):
            raise HTTPException(
                status_code=400, detail="Names must not contain tabs or line breaks."
            )
        rows.append("\t".join(cells))
    return "\n".join(rows) + "\n"


def _positions(net: NetworkModel, layout: str | None) -> dict[str, tuple[float, float]]:
    """Per-layer layout, fitted into the floor (layer-local y/z); empty = random."""
    if layout is None:
        return {}
    if layout not in LAYOUTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown layout '{layout}'. Available: {', '.join(LAYOUTS)}.",
        )
    req = LayoutRequest(
        nodes=net.nodes,
        edges=net.edges,
        algorithm=layout,
        scope="perLayer",
        selected_layers=net.layers,
    )
    try:
        raw, _ = compute_layout(req)
    except LayoutError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    half = config.FLOOR_DEFAULT_WIDTH / 2 * FIT
    by_layer: dict[str, list[str]] = {}
    for n in net.nodes:
        by_layer.setdefault(n.layer, []).append(n.id)
    out: dict[str, tuple[float, float]] = {}
    for ids in by_layer.values():
        pts = [(i, raw[i]) for i in ids if i in raw]
        if not pts:
            continue
        ys = [p[0] for _, p in pts]
        zs = [p[1] for _, p in pts]
        cy, cz = (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2
        extent = max(max(ys) - min(ys), max(zs) - min(zs)) / 2 or 1.0
        k = half / extent
        for i, p in pts:
            out[i] = ((p[0] - cy) * k, (p[1] - cz) * k)
    return out


def _session(
    req: OpenRequest, net: NetworkModel, pos: dict[str, tuple[float, float]]
) -> dict[str, Any]:
    """A session dict in the file format; normalize_session fills the defaults."""
    known = {n.label for n in net.nodes}
    extras: dict[tuple[str, str | None], OpenNode] = {}
    for extra in req.nodes or []:
        if extra.name not in known:
            raise HTTPException(
                status_code=400,
                detail=f"`nodes` names a node that is not in the network: {extra.name}",
            )
        extras[(extra.name, extra.layer)] = extra
    nodes = []
    for n in net.nodes:
        row: dict[str, Any] = {"name": n.label, "layer": n.layer}
        if n.id in pos:
            row["position_x"] = 0
            row["position_y"], row["position_z"] = pos[n.id]
        x = extras.get((n.label, n.layer)) or extras.get((n.label, None))
        if x:
            if x.color:
                row["color"] = x.color
            if x.size is not None:
                row["scale"] = x.size
            if x.url:
                row["url"] = x.url
            if x.description:
                row["descr"] = x.description
            if x.annotations:
                row["annotations"] = x.annotations
        nodes.append(row)
    return {
        "scene": {},
        "layers": [{"name": layer} for layer in net.layers],
        "nodes": nodes,
        "edges": [
            {"src": e.src, "trg": e.trg, "opacity": e.scaled_weight, "channel": e.channel or ""}
            for e in net.edges
        ],
        "direction": req.directed,
        "edgeOpacityByWeight": True,
        "edgeWidthByWeight": False,
    }


@router.post(
    "/api/open",
    response_model=OpenResponse,
    summary="Open a network in Arena3D",
    tags=["Sharing"],
)
async def open_network(req: OpenRequest) -> OpenResponse:
    """Turn a list of edges (or Arena3D TSV text) into a laid-out session and
    return a link that opens it. The link is valid for one hour. Limits are
    those of file uploads (see GET /api/config)."""
    try:
        net = parse_network_tsv(_tsv(req))
    except NetworkValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    positions = await run_in_threadpool(_positions, net, req.layout)
    stored = store_session(_session(req, net, positions))
    return OpenResponse(
        token=stored.token,
        url=stored.url,
        layers=len(net.layers),
        nodes=len(net.nodes),
        edges=len(net.edges),
        channels=net.channels,
        warnings=net.warnings,
    )
