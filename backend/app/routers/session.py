"""Session import/export — ports loadNetworkFromJSONFilepath() and
convertSessionToJSON() from functions/input.R.

Export is a thin packaging endpoint: in the stateless design the frontend already
holds the full scene state, so the server just returns it as a JSON download.
"""

import json
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app import config
from app.models.session import SessionImportResponse
from app.services.session import SessionValidationError, normalize_session

router = APIRouter()


@router.post(
    "/api/session/import",
    summary="Normalise an uploaded session file",
    tags=["Sessions"],
    response_model=SessionImportResponse,
)
async def import_session(file: UploadFile) -> SessionImportResponse:
    raw_bytes = await file.read()
    # DoS fix: same upload-size cap as /api/network — see routers/attributes.py.
    if len(raw_bytes) > config.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large.")
    try:
        data = json.loads(raw_bytes.decode("utf-8", errors="replace"))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail="Bad imported network file format.") from e
    try:
        return SessionImportResponse(**normalize_session(data))
    except SessionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/api/session/export", summary="Download a session as a file", tags=["Sessions"])
async def export_session(session: dict[str, Any]) -> JSONResponse:
    return JSONResponse(
        content=session,
        headers={"Content-Disposition": 'attachment; filename="network.json"'},
    )
