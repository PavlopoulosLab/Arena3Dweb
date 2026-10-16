"""POST /api/topology — replaces functions/igraph/topology.R.

POST /api/layer-similarity — node/edge overlap between layers (Phase 5).
POST /api/network-stats — whole-graph statistics per layer + overall (Phase 21).
"""

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app.models.topology import (
    LayerSimilarityRequest,
    LayerSimilarityResponse,
    TopologyRequest,
    TopologyResponse,
)
from app.services.multilayer import layer_similarity
from app.services.stats import GraphStats, network_stats
from app.services.topology import TopologyError, compute_topology

router = APIRouter()


@router.post(
    "/api/topology",
    summary="Node metrics for scaling and colouring",
    tags=["Analysis"],
    response_model=TopologyResponse,
)
async def run_topology(req: TopologyRequest) -> TopologyResponse:
    try:
        scales, raw = await run_in_threadpool(compute_topology, req)
    except TopologyError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return TopologyResponse(scales=scales, raw=raw)


@router.post(
    "/api/layer-similarity",
    summary="Node and edge overlap between layers",
    tags=["Analysis"],
    response_model=LayerSimilarityResponse,
)
async def run_layer_similarity(req: LayerSimilarityRequest) -> LayerSimilarityResponse:
    nodes_sim, edges_sim = await run_in_threadpool(
        layer_similarity, req.nodes, req.edges, req.layers
    )
    return LayerSimilarityResponse(
        layers=req.layers, node_jaccard=nodes_sim, edge_jaccard=edges_sim
    )


@router.post(
    "/api/network-stats",
    summary="Network statistics per layer and overall",
    tags=["Analysis"],
    response_model=list[GraphStats],
)
async def run_network_stats(req: LayerSimilarityRequest) -> list[GraphStats]:
    """Same body as /api/layer-similarity: nodes, edges, layers."""
    return await run_in_threadpool(network_stats, req.nodes, req.edges, req.layers)
