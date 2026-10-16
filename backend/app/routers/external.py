"""External API — ports resolveAPI(). A caller POSTs a session; we store it under a
random token in tmp/ (TTL-swept) and hand back a self-contained URL. GET resolves the
token back to a normalized session, same as a file import.

Token-in-file (not base64-in-URL) because MAX_EDGES=10k sessions blow past URL limits
(SPEC §5). These tmp files are the one deliberate exception to the stateless server.
"""

import json
import os
import re
import secrets
import time
from typing import Any

from fastapi import APIRouter, HTTPException, Response

from app import config
from app.models.session import (
    ExternalCreateResponse,
    SessionImportResponse,
    ShareRequest,
    ShareResponse,
)
from app.services.session import SessionValidationError, normalize_session

router = APIRouter()

# Handoff tokens are consumed within minutes of creation, so a short TTL keeps
# steady-state storage tiny. MAX_TOKENS is the hard disk-fill DoS guard (H2):
# combined with the per-request MAX_UPLOAD_BYTES cap it bounds tmp/ to at most
# MAX_TOKENS * MAX_UPLOAD_BYTES regardless of request volume.
TTL_SECONDS = 60 * 60
MAX_TOKENS = 1000


def _session_files() -> list[str]:
    if not os.path.isdir(config.TMP_PATH):
        return []
    return [
        os.path.join(config.TMP_PATH, n) for n in os.listdir(config.TMP_PATH) if n.endswith(".json")
    ]


def _sweep() -> None:
    """Delete stored sessions older than the TTL (ports the tmp cleanup intent)."""
    cutoff = time.time() - TTL_SECONDS
    for path in _session_files():
        # A concurrent sweep/resolve may remove or stat the file between the
        # listdir and here; skip rather than 500 the request.
        try:
            if os.path.getmtime(path) < cutoff:
                os.remove(path)
        except OSError:
            continue


def _enforce_cap() -> None:
    """DoS guard (H2): before a new write, evict oldest sessions so at most
    MAX_TOKENS-1 remain. Evict (not reject) so an attacker can't deny the
    feature to legitimate callers by keeping the store full.

    ponytail: TOCTOU under concurrent creates can briefly exceed the cap by the
    concurrency count; the bound is MAX_TOKENS + in-flight, which is fine.
    """
    paths = _session_files()
    if len(paths) < MAX_TOKENS:
        return
    dated: list[tuple[float, str]] = []
    for path in paths:
        try:
            dated.append((os.path.getmtime(path), path))
        except OSError:
            continue
    dated.sort()  # oldest first
    for _, path in dated[: len(dated) - MAX_TOKENS + 1]:
        try:
            os.remove(path)
        except OSError:
            continue


def store_session(session: dict[str, Any]) -> ExternalCreateResponse:
    """Validate a session, keep it under a fresh token and return the link that opens it.

    Shared by /api/external (full sessions) and /api/open (plain networks)."""
    # DoS fix: validate (incl. MAX_NODES/MAX_EDGES) before anything touches
    # disk — this endpoint used to write any payload straight to disk
    # unvalidated, letting a caller fill server storage with oversized sessions.
    try:
        normalize_session(session)
    except SessionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    os.makedirs(config.TMP_PATH, exist_ok=True)
    _sweep()
    _enforce_cap()
    token = secrets.token_urlsafe(16)
    with open(os.path.join(config.TMP_PATH, f"{token}.json"), "w") as fh:
        json.dump(session, fh)
    # read per request so redeploys / tests can change it without a restart
    base_url = os.environ.get("ARENA_PUBLIC_URL", "")
    return ExternalCreateResponse(token=token, url=f"{base_url}/?session={token}")


@router.post(
    "/api/external",
    response_model=ExternalCreateResponse,
    summary="Hand off a complete session and get a link",
    tags=["Sharing"],
)
async def create_external(session: dict[str, Any]) -> ExternalCreateResponse:
    """Store a full Arena3D session (the File → Save Session format: scene, layers,
    nodes with positions and colours, edges) and return a link that opens it, valid
    for one hour. For a plain network without positions use POST /api/open."""
    return store_session(session)


@router.get(
    "/api/external/{token}",
    response_model=SessionImportResponse,
    summary="Resolve a shared link's token",
    tags=["Sharing"],
)
async def resolve_external(token: str) -> SessionImportResponse:
    """The normalised session behind a link, as the application loads it."""
    # guard against path traversal — tokens are urlsafe base64, never contain / or .
    if not token.isalnum() and not all(c.isalnum() or c in "-_" for c in token):
        raise HTTPException(status_code=400, detail="Invalid token.")
    path = os.path.join(config.TMP_PATH, f"{token}.json")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Session not found or expired.")
    with open(path) as fh:
        data = json.load(fh)
    try:
        return SessionImportResponse(**normalize_session(data))
    except SessionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


# ---------------------------------------------------------------- hosted files
# Export → "Open in Gephi Lite" and friends: web tools that load a file by URL
# get the export hosted here for the session TTL, under the same sweep and cap.
SHARE_TYPES = {
    "application/graphml+xml",
    "application/json",
    "image/svg+xml",
    "text/csv",
    "text/plain",
    "text/tab-separated-values",
}
MAX_SHARE_BYTES = 5 * 1024 * 1024
_TOKEN = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


@router.post(
    "/api/share",
    response_model=ShareResponse,
    summary="Host an exported file for another web tool (one hour)",
    tags=["Sharing"],
)
async def create_share(req: ShareRequest) -> ShareResponse:
    """Store a GraphML, SVG, CSV, TSV, JSON or text export and return a URL that
    serves it (with CORS) so a web tool such as Gephi Lite can open it by link."""
    if req.media_type not in SHARE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported media type {req.media_type}.")
    if len(req.content.encode("utf-8")) > MAX_SHARE_BYTES:
        raise HTTPException(status_code=413, detail="The file is larger than 5 MB.")
    os.makedirs(config.TMP_PATH, exist_ok=True)
    _sweep()
    _enforce_cap()
    token = secrets.token_urlsafe(16)
    with open(os.path.join(config.TMP_PATH, f"{token}.share.json"), "w") as fh:
        json.dump({"media_type": req.media_type, "name": req.name, "content": req.content}, fh)
    base_url = os.environ.get("ARENA_PUBLIC_URL", "")
    return ShareResponse(token=token, url=f"{base_url}/api/share/{token}")


@router.get(
    "/api/share/{token}",
    summary="A hosted export behind its share token",
    tags=["Sharing"],
    response_class=Response,
)
async def resolve_share(token: str) -> Response:
    if not _TOKEN.match(token):
        raise HTTPException(status_code=404, detail="Unknown share link.")
    path = os.path.join(config.TMP_PATH, f"{token}.share.json")
    try:
        with open(path) as fh:
            data = json.load(fh)
    except OSError as e:
        raise HTTPException(status_code=404, detail="This share link has expired.") from e
    return Response(
        content=data["content"],
        media_type=data["media_type"],
        headers={
            # a download, never a page of this origin: an SVG or XML export
            # could otherwise carry a script that runs as arena3d.org
            "Content-Disposition": f'attachment; filename="{data["name"]}"',
            "Content-Security-Policy": "sandbox; default-src 'none'",
            "X-Content-Type-Options": "nosniff",
        },
    )
