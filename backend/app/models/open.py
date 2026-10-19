"""Schemas for POST /api/open — open a plain network in Arena3D from any tool."""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app import config

Name = Annotated[str, Field(min_length=1, max_length=200)]


class OpenEdge(BaseModel):
    source: Name = Field(description="Source node name")
    target: Name = Field(description="Target node name")
    source_layer: Name = Field(
        default=config.DEFAULT_LAYER_NAME, description="Layer of the source node"
    )
    target_layer: Name | None = Field(
        default=None, description="Layer of the target node; the source layer when omitted"
    )
    weight: float | None = Field(
        default=None, description="Edge weight (missing = 1); scaled to 0.1–1 across the network"
    )
    channel: Name | None = Field(
        default=None, description="Information channel, e.g. an evidence type; all edges or none"
    )


class OpenNode(BaseModel):
    """Optional look and links for a node; applies to one copy or to every copy of the name."""

    name: Name
    layer: Name | None = Field(
        default=None, description="Only this copy; every copy of the name when omitted"
    )
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$", description="Hex colour")
    size: float | None = Field(default=None, ge=0.2, le=5, description="Node size, 1 = default")
    url: str | None = Field(
        default=None, max_length=2000, pattern=r"^(https?://|mailto:)", description="Web link"
    )
    description: str | None = Field(default=None, max_length=2000)
    annotations: list[Name] | None = Field(
        default=None, max_length=12, description="Terms shown as pie-chart slices and hulls"
    )


class OpenRequest(BaseModel):
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "edges": [
                        {"source": "TP53", "target": "MDM2", "source_layer": "PPI"},
                        {
                            "source": "TP53",
                            "target": "CDKN1A",
                            "source_layer": "PPI",
                            "weight": 0.9,
                        },
                        {
                            "source": "TP53",
                            "target": "TP53",
                            "source_layer": "PPI",
                            "target_layer": "Regulation",
                        },
                        {"source": "TP53", "target": "BAX", "source_layer": "Regulation"},
                    ],
                    "nodes": [{"name": "TP53", "color": "#ff3333", "size": 2}],
                    "layout": "Fruchterman-Reingold",
                    "directed": False,
                }
            ]
        }
    )

    edges: list[OpenEdge] | None = Field(
        default=None, max_length=config.MAX_EDGES, description="The network as a list of edges"
    )
    tsv: str | None = Field(
        default=None,
        max_length=config.MAX_UPLOAD_BYTES,
        description="Instead of `edges`: the text of an Arena3D TSV file (SourceNode, SourceLayer, "
        "TargetNode, TargetLayer, optional Weight and Channel)",
    )
    nodes: list[OpenNode] | None = Field(default=None, max_length=config.MAX_NODES)
    layout: str | None = Field(
        default="Fruchterman-Reingold",
        description="Layout run on every layer before opening (any name from the Layout panel); "
        "null places nodes at random",
    )
    directed: bool = Field(default=False, description="Draw edges with arrows")


class OpenResponse(BaseModel):
    token: str
    url: str = Field(description="Opens the network in Arena3D; valid for one hour")
    layers: int
    nodes: int
    edges: int
    channels: list[str]
    warnings: list[str] = []
