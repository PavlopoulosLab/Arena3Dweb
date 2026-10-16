"""POST /api/layout — replaces functions/igraph/layout.R."""

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.models.layout import (
    ClusteringRequest,
    ClusteringResponse,
    LayoutRequest,
    LayoutResponse,
)
from app.services import graph as g
from app.services.alignment import misalignment
from app.services.clustering import ClusteringError
from app.services.layouts import LayoutError, compute_clusters, compute_layout

router = APIRouter()


@router.post(
    "/api/layout",
    summary="Compute layouts, clustering, alignment and group layouts",
    tags=["Layouts"],
    response_model=LayoutResponse,
)
async def run_layout(req: LayoutRequest) -> LayoutResponse:
    """Positions per node (y, z in the layer plane, plus x for 3D layouts), optional
    clusters and the inter-layer misalignment."""
    try:
        # off the event loop, so the service keeps answering while igraph works
        positions, clusters = await run_in_threadpool(compute_layout, req)
    except (LayoutError, ClusteringError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    score = None
    if req.dimensions == 2 and len(req.selected_layers) > 1:
        edges = g.filter_edges(req.edges, req.selected_channels)
        score = misalignment(positions, req.nodes, edges, req.selected_layers)
    return LayoutResponse(positions=positions, clusters=clusters, misalignment=score)


@router.post(
    "/api/clustering",
    summary="Find communities without moving the nodes",
    tags=["Layouts"],
    response_model=ClusteringResponse,
)
async def run_clustering(req: ClusteringRequest) -> ClusteringResponse:
    """Community ids per node: within each layer, over the selected layers as one
    graph, or shared across layers by node name (multiplex Leiden). The ids can
    then colour the nodes or serve as annotations."""
    try:
        clusters = await run_in_threadpool(compute_clusters, req)
    except (LayoutError, ClusteringError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ClusteringResponse(clusters=clusters, count=len(set(clusters.values())))
