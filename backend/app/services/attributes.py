"""Attribute-file TSV parsing — ports functions/input.R
handleInputNodeAttributeFileUpload() / handleInputEdgeAttributeFileUpload().
"""

import math
import re
from io import StringIO

import pandas as pd

from app.models.attributes import EdgeAttributeRow, GroupRow, NodeAttributeRow, ValueRow, ValueTable
from app.services.parser import NetworkValidationError

MAX_ANNOTATIONS_PER_NODE = 12  # pie slices beyond this are unreadable
MAX_VALUE_COLUMNS = 50
MAX_GROUPS = 2000


def _read(text: str) -> pd.DataFrame:
    try:
        df = pd.read_csv(StringIO(text), sep="\t", dtype=str)
    except Exception as e:
        raise NetworkValidationError("Bad attributes file format.") from e
    return df


def _cell(row: pd.Series, column: str) -> str | None:
    value = str(row[column]).strip() if column in row.index and pd.notna(row[column]) else ""
    return value or None


LINE_TYPES = ("solid", "dashed", "dotted")


def _number(row: pd.Series, column: str, low: float, high: float) -> float | None:
    cell = _cell(row, column)
    if cell is None:
        return None
    try:
        value = float(cell)
    except ValueError as e:
        raise NetworkValidationError(f"Make sure all {column} values are numeric.") from e
    if not low <= value <= high:
        raise NetworkValidationError(f"{column} values must be between {low:g} and {high:g}.")
    return value


def _yes_no(cell: str | None) -> bool | None:
    """yes / true / 1 (or x) -> True, no / false / 0 -> False, else None."""
    value = (cell or "").strip().lower()
    if value in ("yes", "y", "true", "1", "x", "shown"):
        return True
    if value in ("no", "n", "false", "0"):
        return False
    return None


def _annotations(cell: str | None) -> list[str] | None:
    if cell is None:
        return None
    terms = list(dict.fromkeys(t.strip() for t in cell.split(";") if t.strip()))
    return terms[:MAX_ANNOTATIONS_PER_NODE] or None


def parse_node_attributes_tsv(text: str) -> list[NodeAttributeRow]:
    df = _read(text)
    if not {"Node", "Layer"}.issubset(df.columns):
        raise NetworkValidationError(
            "Your node attribute file must contain at least two columns: Node and Layer"
        )
    rows = []
    for _, row in df.iterrows():
        size = _cell(row, "Size")
        try:
            size_value = float(size) if size is not None else None
        except ValueError as e:
            raise NetworkValidationError("Make sure all Size values are numeric.") from e
        rows.append(
            NodeAttributeRow(
                node_layer=f"{str(row['Node']).strip()}_{str(row['Layer']).strip()}",
                color=_cell(row, "Color"),
                size=size_value,
                url=_cell(row, "Url"),
                description=_cell(row, "Description"),
                annotations=_annotations(_cell(row, "Annotation")),
                shape=(_cell(row, "Shape") or "").lower() or None,
                opacity=_number(row, "Opacity", 0, 1),
                label=_cell(row, "Label"),
                label_color=_cell(row, "LabelColor"),
                label_size=_number(row, "LabelSize", 1, 200),
                label_style=(_cell(row, "LabelStyle") or "")[:80] or None,
                label_position=(_cell(row, "LabelPosition") or "").lower() or None,
                label_shown=_yes_no(_cell(row, "LabelShown")),
            )
        )
    return rows


def parse_edge_attributes_tsv(text: str) -> list[EdgeAttributeRow]:
    df = _read(text)
    mandatory = {"SourceNode", "SourceLayer", "TargetNode", "TargetLayer", "Color"}
    if not mandatory.issubset(df.columns):
        raise NetworkValidationError(
            "Your edge attribute file must contain at least these five columns: "
            "SourceNode, SourceLayer, TargetNode, TargetLayer and Color, "
            "and optionally a Channel name."
        )
    rows = []
    for _, row in df.iterrows():
        source = f"{str(row['SourceNode']).strip()}_{str(row['SourceLayer']).strip()}"
        target = f"{str(row['TargetNode']).strip()}_{str(row['TargetLayer']).strip()}"
        color = _cell(row, "Color")
        if color is None:
            raise NetworkValidationError("Make sure all edge attribute rows have a Color.")
        line_type = (_cell(row, "LineType") or "").lower() or None
        if line_type is not None and line_type not in LINE_TYPES:
            raise NetworkValidationError("LineType must be solid, dashed or dotted.")
        rows.append(
            EdgeAttributeRow(
                edge_pair=f"{source}---{target}",
                color=color,
                channel=_cell(row, "Channel"),
                width=_number(row, "Width", 0.05, 20),
                opacity=_number(row, "Opacity", 0, 1),
                line_type=line_type,
                arrow_color=_cell(row, "ArrowColor"),
            )
        )
    return rows


_NODE_HEADERS = {"node", "nodes", "name", "gene", "protein"}
_GROUP_HEADERS = {"group", "groups", "annotation", "annotations", "term", "terms", "category"}
_LIST_SEP = re.compile(r"[,;\t]")


def parse_groups_tsv(text: str) -> list[GroupRow]:
    """Annotation groups as NORMA writes them: one group per line, the group name
    then its members (``Group<TAB>node1,node2,…`` — commas, semicolons or tabs
    between members); or one node per line with ``Node`` and ``Group`` columns
    (several groups separated by ``;``). A header line is optional."""
    lines = [ln.rstrip("\r") for ln in text.splitlines()]
    rows = [ln for ln in lines if ln.strip() and not ln.lstrip().startswith("#")]
    if not rows:
        raise NetworkValidationError("The group file is empty.")
    first = [c.strip().lower() for c in rows[0].split("\t")]
    node_per_line = len(first) >= 2 and first[0] in _NODE_HEADERS and first[1] in _GROUP_HEADERS
    if (
        first
        and first[0] in _GROUP_HEADERS
        and len(first) >= 2
        and first[1] in _NODE_HEADERS | {"members"}
    ):
        rows = rows[1:]  # a header over the group-per-line format
    groups: dict[str, list[str]] = {}
    if node_per_line:
        for number, ln in enumerate(rows[1:], start=2):
            cells = [c.strip() for c in ln.split("\t")]
            if len(cells) < 2 or not cells[0] or not cells[1]:
                raise NetworkValidationError(f"Line {number}: expected a node and its group(s).")
            for term in dict.fromkeys(t.strip() for t in cells[1].split(";") if t.strip()):
                groups.setdefault(cells[0], []).append(term)
    else:
        for number, ln in enumerate(rows, start=1):
            cells = ln.split("\t", 1)
            name = cells[0].strip()
            members = [m.strip() for m in _LIST_SEP.split(cells[1])] if len(cells) > 1 else []
            members = [m for m in members if m]
            if not name or not members:
                raise NetworkValidationError(
                    f"Line {number}: expected a group name, a TAB, then its members "
                    "(comma- or semicolon-separated)."
                )
            for member in dict.fromkeys(members):
                groups.setdefault(member, []).append(name)
    if len({g for gs in groups.values() for g in gs}) > MAX_GROUPS:
        raise NetworkValidationError(f"No more than {MAX_GROUPS} groups are supported.")
    return [
        GroupRow(node=node, groups=list(dict.fromkeys(gs))[:MAX_ANNOTATIONS_PER_NODE])
        for node, gs in groups.items()
    ]


def parse_values_tsv(text: str) -> ValueTable:
    """Numeric node values: a ``Node`` column (any of the usual names) followed by one
    column per condition or score; blank cells are allowed, anything else must be a
    number."""
    df = _read(text)
    if df.shape[1] < 2:
        raise NetworkValidationError(
            "The values file needs a Node column followed by at least one numeric column."
        )
    columns = [str(c).strip() for c in df.columns]
    if columns[0].lower() not in _NODE_HEADERS:
        raise NetworkValidationError(
            f"The first column must be the node name (Node), not '{columns[0]}'."
        )
    if len(columns) - 1 > MAX_VALUE_COLUMNS:
        raise NetworkValidationError(
            f"No more than {MAX_VALUE_COLUMNS} value columns are supported."
        )
    rows: list[ValueRow] = []
    for i, (_, row) in enumerate(df.iterrows(), start=2):
        node = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ""
        if not node:
            raise NetworkValidationError(f"Line {i}: the node name is empty.")
        values: list[float | None] = []
        for col, cell in zip(columns[1:], row.iloc[1:], strict=True):
            raw = str(cell).strip() if pd.notna(cell) else ""
            if raw == "":
                values.append(None)
                continue
            try:
                v = float(raw)
            except ValueError as e:
                raise NetworkValidationError(
                    f"Line {i}: '{raw}' in column {col} is not a number."
                ) from e
            if not math.isfinite(v):
                raise NetworkValidationError(f"Line {i}: column {col} must be a finite number.")
            values.append(v)
        rows.append(ValueRow(node=node, values=values))
    if not rows:
        raise NetworkValidationError("The values file has no rows.")
    return ValueTable(columns=columns[1:], rows=rows)
