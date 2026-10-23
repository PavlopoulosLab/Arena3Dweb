"""Session schemas. JSON is loose/stringly-typed (ports v2 export format), so the
import model is permissive — validation + defaulting lives in services/session.py."""

from typing import Any

from pydantic import BaseModel, Field

from app.models import examples as ex


class SessionImportResponse(BaseModel):
    """Normalized session returned to the frontend (ports parseUploadedJSON output)."""

    scene: dict[str, Any]
    layers: list[dict[str, Any]]
    # optional per-node style (Edit → Style): opacity, border_color, border_width,
    # stretch [x, y, z], label, label_color, label_size, label_style {style, color,
    # width, opacity, bold}, label_position
    nodes: list[dict[str, Any]]
    # optional per-edge style: opacity_factor, line_type, arrow_color
    edges: list[dict[str, Any]]
    universalLabelColor: str
    direction: bool
    # where the arrowheads go when direction is on: these layers (None = every
    # layer) and the links between layers
    arrowLayers: list[str] | None = None
    interLayerArrows: bool = True
    edgeOpacityByWeight: bool
    edgeWidthByWeight: bool
    scramble_nodes: bool
    # edge bundling strength, 0-1 (0 = straight edges)
    intraEdgeBundling: float = 0.0
    interEdgeBundling: float = 0.0
    edgeShape: str = "parallel"
    hive: dict[str, Any] | None = None  # the hive plot arrangement, when on
    # the network's name and its annotation set's name (Networks menu), when given
    name: str | None = None
    annotationSet: str | None = None
    # how the annotation groups are drawn (Annotations menu): source, style,
    # opacity, padding, pies, hidden (group names), when the session has it
    annotationView: dict[str, Any] | None = None
    # the scene theme ({name, applied}: whether its colours were applied to the
    # network), when the session has one
    theme: dict[str, Any] | None = None
    # Edit → Nodes → Show Labels {mode, withSelection}, when saved
    nodeLabels: dict[str, Any] | None = None
    warnings: list[str] = []


class ExternalCreateResponse(BaseModel):
    token: str
    url: str


class ShareRequest(BaseModel):
    """A file to host for another web tool (Gephi Lite, Morpheus, …) for one hour."""

    model_config = ex.config(ex.SHARE)

    content: str = Field(min_length=1)
    media_type: str = Field(pattern=r"^[a-z]+/[a-z0-9.+-]+$")
    name: str = Field(default="arena3d", min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_.-]+$")


class ShareResponse(BaseModel):
    token: str
    url: str
