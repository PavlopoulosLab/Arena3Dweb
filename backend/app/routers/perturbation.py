"""POST /api/perturbation/knockout — knock nodes and edges out, compare before/after.

POST /api/perturbation/attack — robustness curves under random failure or a
targeted attack.

Both run in the worker pool (services/compute_pool.py): betweenness and the
path-length passes are long igraph calls that would otherwise hold the event
loop, and an igraph abort() only takes a worker down.
"""

from fastapi import APIRouter, HTTPException

from app.models.perturbation import (
    AttackRequest,
    AttackResponse,
    KnockoutRequest,
    KnockoutResponse,
)
from app.services.compute_pool import ComputeCrashed, run_isolated
from app.services.perturbation import PerturbationError, attack, knockout

router = APIRouter()


@router.post(
    "/api/perturbation/knockout",
    summary="Knock out nodes or edges and compare the network before and after",
    tags=["Analysis"],
    response_model=KnockoutResponse,
)
async def run_knockout(req: KnockoutRequest) -> KnockoutResponse:
    """Removes nodes (ids, names, the top k by degree, betweenness or PageRank,
    optionally every copy across layers) and edges (node pairs, channels, the
    inter-layer edges, a random share) from the analysed layers. Returns the
    global measures of each layer and the whole network before and after, and
    every node's degree, betweenness, harmonic closeness and (with seeds) its
    random-walk-with-restart score before and after."""
    try:
        return await run_isolated(knockout, req)
    except PerturbationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ComputeCrashed as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/api/perturbation/attack",
    summary="Robustness curves: remove nodes step by step",
    tags=["Analysis"],
    response_model=AttackResponse,
)
async def run_attack(req: AttackRequest) -> AttackResponse:
    """The relative size of the largest component, the number of components and
    optionally the global efficiency as nodes are removed: at random (averaged
    over `runs`) or targeted by degree or betweenness, ranked once or again
    after every step. One curve per layer and one for the whole network."""
    try:
        return await run_isolated(attack, req)
    except PerturbationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ComputeCrashed as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
