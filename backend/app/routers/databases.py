"""POST /api/import/string and /api/import/databases — PPI database importers."""

from collections.abc import Callable
from functools import partial
from typing import Annotated, Any, TypeVar

from fastapi import APIRouter, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, StringConstraints

from app.models.databases import (
    DatabaseImportRequest,
    GoImportRequest,
    ReactomeImportRequest,
    SetSearchHit,
    StringGroupingsRequest,
    StringGroupingsResponse,
    StringImportRequest,
    StringImportResponse,
)
from app.models.network import NetworkModel
from app.services import databases as db
from app.services.parser import NetworkValidationError

router = APIRouter()


@router.post(
    "/api/import/string",
    summary="Import from STRING with evidence channels",
    tags=["Import"],
    response_model=StringImportResponse,
)
async def import_string(req: StringImportRequest) -> StringImportResponse:
    """STRING network in a single layer — one channel per evidence type or one
    combined edge per pair — with optional protein descriptions and groupings
    from functional terms. `raw` carries STRING's answers fetched by the browser."""
    return await _run(
        partial(
            db.import_string,
            network_type=req.network_type,
            edge_mode=req.edge_mode,
            descriptions=req.descriptions,
            groupings=req.groupings,
            address=req.address,
            raw=req.raw,
        ),
        req.identifiers,
        req.species,
        req.required_score,
        req.channels,
        req.add_nodes,
    )


@router.post(
    "/api/import/string/groupings",
    summary="STRING groupings for the network on screen",
    tags=["Import"],
    response_model=StringGroupingsResponse,
)
async def string_groupings(req: StringGroupingsRequest) -> StringGroupingsResponse:
    """Term collections (enriched or all annotations) of the given node names."""
    return await _run(
        db.string_groupings_for,
        req.identifiers,
        req.species,
        req.groupings,
        req.address,
        req.raw_terms,
    )


@router.post(
    "/api/import/databases",
    summary="Import STRING, IntAct and OmniPath as layers",
    tags=["Import"],
    response_model=NetworkModel,
)
async def import_databases(req: DatabaseImportRequest) -> NetworkModel:
    """One layer per database, with inter-layer edges between shared proteins."""
    return await _run(
        db.import_per_database,
        req.identifiers,
        req.species,
        req.databases,
        req.required_score,
        req.only_among,
    )


T = TypeVar("T")


async def _run(fn: Callable[..., T], *args: Any) -> T:
    try:
        # urllib is blocking — keep it off the event loop
        result: T = await run_in_threadpool(fn, *args)
    except (db.DatabaseError, NetworkValidationError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except db.UpstreamError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return result


class NdexImportRequest(BaseModel):
    uuid: Annotated[str, StringConstraints(pattern=r"^[0-9a-fA-F-]{36}$")]


@router.post(
    "/api/import/ndex",
    summary="Import a public NDEx network",
    tags=["Import"],
    response_model=NetworkModel,
)
async def import_ndex(req: NdexImportRequest) -> NetworkModel:
    """A public NDEx network by UUID (fetched as CX2)."""
    return await _run(db.import_ndex, req.uuid)


@router.post(
    "/api/import/reactome",
    summary="Import Reactome pathways as layers",
    tags=["Import"],
    response_model=NetworkModel,
)
async def import_reactome(req: ReactomeImportRequest) -> NetworkModel:
    """Each pathway becomes a layer holding its proteins with STRING's interactions
    among them; copies of a protein are linked across the pathway layers."""
    return await _run(
        db.import_reactome, req.pathways, req.species, req.required_score, req.max_genes
    )


@router.get(
    "/api/import/reactome/search",
    summary="Find Reactome pathways by name",
    tags=["Import"],
    response_model=list[SetSearchHit],
)
async def search_reactome(
    q: str = Query(min_length=2, max_length=100), species: int = 9606
) -> list[SetSearchHit]:
    hits = await _run_list(db.search_reactome, q, species)
    return [SetSearchHit(**h) for h in hits]


@router.post(
    "/api/import/go",
    summary="Import Gene Ontology terms as layers",
    tags=["Import"],
    response_model=NetworkModel,
)
async def import_go(req: GoImportRequest) -> NetworkModel:
    """Each GO term becomes a layer holding the genes annotated to it (QuickGO) with
    STRING's interactions among them; copies of a gene are linked across layers."""
    return await _run(
        db.import_go,
        req.terms,
        req.taxon,
        req.include_children,
        req.required_score,
        req.max_genes,
    )


@router.get(
    "/api/import/go/search",
    summary="Find GO terms by name",
    tags=["Import"],
    response_model=list[SetSearchHit],
)
async def search_go(q: str = Query(min_length=2, max_length=100)) -> list[SetSearchHit]:
    hits = await _run_list(db.search_go, q)
    return [SetSearchHit(**h) for h in hits]


async def _run_list(fn: Callable[..., list[dict[str, str]]], *args: Any) -> list[dict[str, str]]:
    try:
        result: list[dict[str, str]] = await run_in_threadpool(fn, *args)
    except db.DatabaseError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except db.UpstreamError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return result
