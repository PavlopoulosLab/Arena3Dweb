"""Node/edge attribute-file rows — ports functions/input.R attribute uploads."""

from pydantic import BaseModel


class NodeAttributeRow(BaseModel):
    node_layer: str  # "Node_Layer" key, as v2 nodeAttributes$NodeLayer
    color: str | None = None
    size: float | None = None
    url: str | None = None
    description: str | None = None
    # "Annotation" column, ";"-separated (e.g. GO terms, pathways) -> pie nodes / hulls
    annotations: list[str] | None = None


class EdgeAttributeRow(BaseModel):
    edge_pair: str  # "Source_Layer---Target_Layer", as v2 edgeAttributes$EdgePair
    color: str
    channel: str | None = None


class GroupRow(BaseModel):
    """A node and the groups (annotation terms) a group file puts it in."""

    node: str
    groups: list[str]


class ValueRow(BaseModel):
    node: str
    values: list[float | None]  # one per column; blank cells are None


class ValueTable(BaseModel):
    """Numeric node values (expression, scores, …): columns + one row per node."""

    columns: list[str]
    rows: list[ValueRow]
