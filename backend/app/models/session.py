"""Session schemas. JSON is loose/stringly-typed (ports v2 export format), so the
import model is permissive — validation + defaulting lives in services/session.py."""

from typing import Any

from pydantic import BaseModel, Field


class SessionImportResponse(BaseModel):
    """Normalized session returned to the frontend (ports parseUploadedJSON output)."""

    scene: dict[str, Any]
    layers: list[dict[str, Any]]
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    universalLabelColor: str
    direction: bool
    edgeOpacityByWeight: bool
    edgeWidthByWeight: bool
    scramble_nodes: bool
    # edge bundling strength, 0-1 (0 = straight edges)
    intraEdgeBundling: float = 0.0
    interEdgeBundling: float = 0.0
    warnings: list[str] = []


class ExternalCreateResponse(BaseModel):
    token: str
    url: str


class ShareRequest(BaseModel):
    """A file to host for another web tool (Gephi Lite, Morpheus, …) for one hour."""

    content: str = Field(min_length=1)
    media_type: str = Field(pattern=r"^[a-z]+/[a-z0-9.+-]+$")
    name: str = Field(default="arena3d", min_length=1, max_length=80, pattern=r"^[\w.-]+$")


class ShareResponse(BaseModel):
    token: str
    url: str
