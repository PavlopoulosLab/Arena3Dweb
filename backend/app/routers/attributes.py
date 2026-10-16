"""POST /api/attributes/{nodes,edges} — attribute-file TSV uploads.

Replaces handleInput{Node,Edge}AttributeFileUpload() (functions/input.R).
"""

from fastapi import APIRouter, HTTPException, UploadFile

from app import config
from app.models.attributes import EdgeAttributeRow, GroupRow, NodeAttributeRow, ValueTable
from app.services.attributes import (
    parse_edge_attributes_tsv,
    parse_groups_tsv,
    parse_node_attributes_tsv,
    parse_values_tsv,
)
from app.services.parser import NetworkValidationError

router = APIRouter()


async def _read_capped(file: UploadFile) -> str:
    """DoS fix: bound upload size in-app, since bare uvicorn (no nginx in
    front, e.g. local/dev) enforces no request-body limit of its own."""
    raw_bytes = await file.read()
    if len(raw_bytes) > config.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large.")
    return raw_bytes.decode("utf-8", errors="replace")


@router.post(
    "/api/attributes/nodes",
    summary="Parse a node attribute file",
    tags=["Networks"],
    response_model=list[NodeAttributeRow],
)
async def upload_node_attributes(file: UploadFile) -> list[NodeAttributeRow]:
    raw = await _read_capped(file)
    try:
        return parse_node_attributes_tsv(raw)
    except NetworkValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post(
    "/api/attributes/edges",
    summary="Parse an edge attribute file",
    tags=["Networks"],
    response_model=list[EdgeAttributeRow],
)
async def upload_edge_attributes(file: UploadFile) -> list[EdgeAttributeRow]:
    raw = await _read_capped(file)
    try:
        return parse_edge_attributes_tsv(raw)
    except NetworkValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post(
    "/api/attributes/groups",
    summary="Parse an annotation group file (NORMA format)",
    tags=["Networks"],
    response_model=list[GroupRow],
)
async def upload_groups(file: UploadFile) -> list[GroupRow]:
    """One group per line (``Group<TAB>node1,node2,…``) or one node per line with
    ``Node`` and ``Group`` columns; returns the groups of every node named."""
    raw = await _read_capped(file)
    try:
        return parse_groups_tsv(raw)
    except NetworkValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post(
    "/api/attributes/values",
    summary="Parse a numeric node value table (expression, scores)",
    tags=["Networks"],
    response_model=ValueTable,
)
async def upload_values(file: UploadFile) -> ValueTable:
    """``Node`` followed by one numeric column per condition; blank cells allowed."""
    raw = await _read_capped(file)
    try:
        return parse_values_tsv(raw)
    except NetworkValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
