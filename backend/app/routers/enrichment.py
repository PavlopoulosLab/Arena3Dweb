"""POST /api/enrichment — functional enrichment of selected nodes (STRING)."""

from typing import Annotated

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, StringConstraints

from app import config
from app.models import examples as ex
from app.services import databases as db
from app.services.enrichment import EnrichedTerm, enrich

router = APIRouter()

Gene = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class EnrichmentRequest(BaseModel):
    model_config = ex.config(ex.ENRICHMENT)

    genes: list[Gene] = Field(min_length=1, max_length=config.MAX_DB_IDENTIFIERS)
    species: int = 9606
    max_terms: int = Field(default=50, ge=1, le=500)
    # STRING categories (Process, KEGG, RCTM, PMID, ...); None = GO + pathways
    categories: list[str] | None = Field(default=None, max_length=30)


@router.post(
    "/api/enrichment",
    summary="STRING functional enrichment of a gene list",
    tags=["Analysis"],
    response_model=list[EnrichedTerm],
)
async def run_enrichment(req: EnrichmentRequest) -> list[EnrichedTerm]:
    """Enriched GO, KEGG, Reactome and WikiPathways terms for a gene list, FDR-sorted,
    from STRING."""
    try:
        return await run_in_threadpool(
            enrich, req.genes, req.species, req.max_terms, req.categories
        )
    except db.DatabaseError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except db.UpstreamError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
