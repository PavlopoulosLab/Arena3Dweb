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
    # written by Edit → Attributes, so its export reloads in full
    shape: str | None = None  # sphere, box (or Cube), diamond, … — the frontend checks it
    opacity: float | None = None  # 0–1
    label: str | None = None  # text in place of the node name
    label_color: str | None = None
    label_size: float | None = None  # px


class EdgeAttributeRow(BaseModel):
    edge_pair: str  # "Source_Layer---Target_Layer", as v2 edgeAttributes$EdgePair
    color: str
    channel: str | None = None
    # written by Edit → Attributes, so its export reloads in full
    width: float | None = None  # × the edge width
    opacity: float | None = None  # × the edge opacity, 0–1
    line_type: str | None = None  # solid | dashed | dotted
    arrow_color: str | None = None


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
