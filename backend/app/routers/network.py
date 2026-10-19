"""POST /api/network — TSV upload. Replaces handleUploadNetwork() (functions/input.R)."""

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from app import config
from app.models.network import NetworkModel
from app.services.formats import parse_network_file
from app.services.parser import NetworkValidationError

router = APIRouter()


@router.post(
    "/api/network",
    summary="Parse an uploaded network file",
    tags=["Networks"],
    response_model=NetworkModel,
)
async def upload_network(file: UploadFile) -> NetworkModel:
    """Parse an uploaded network TSV — the 4-column Arena3D format, or a minimal
    2-column edgelist (SourceNode, TargetNode) whose nodes all land in one default layer.
    GraphML (.graphml/.xml), GML, SIF and Cytoscape CX2 (.cx2/.cx) are recognised by
    their file extension (services/formats.py)."""
    raw_bytes = await file.read(config.MAX_UPLOAD_BYTES + 1)
    # DoS fix: reject oversized uploads before pandas parses the whole file
    # into memory — MAX_EDGES was only checked *after* the parse completed.
    if len(raw_bytes) > config.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large.")
    raw = raw_bytes.decode("utf-8", errors="replace")
    try:
        # in a thread: a large file must not freeze the other requests
        return await run_in_threadpool(parse_network_file, raw, file.filename or "")
    except NetworkValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
