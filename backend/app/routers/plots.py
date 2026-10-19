"""POST /api/plots — the data behind Analyze → Plots.

Node metrics per graph (each analysed layer, or the analysed layers as one
graph) and, on request, component sizes, distances between nodes, C(k),
knn(k) and the rich-club coefficient. Runs in the worker pool, as the
metrics and the path-length pass are long igraph calls.
"""

from fastapi import APIRouter, HTTPException

from app.models.plots import PlotRequest, PlotResponse
from app.services.compute_pool import ComputeCrashed, run_isolated
from app.services.perturbation import PerturbationError
from app.services.plots import PlotError, plot_data

router = APIRouter()


@router.post(
    "/api/plots",
    summary="Node metrics and topological curves for plotting",
    tags=["Analysis"],
    response_model=PlotResponse,
)
async def run_plots(req: PlotRequest) -> PlotResponse:
    """Per graph: the requested node metrics (in node order) and the requested
    extras — `components`, `paths`, `clustering_by_degree`, `neighbour_degree`,
    `rich_club` (normalised by `rich_club_random` rewired graphs)."""
    try:
        return await run_isolated(plot_data, req)
    except (PlotError, PerturbationError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ComputeCrashed as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
