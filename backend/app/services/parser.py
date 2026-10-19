"""TSV network parsing + validation — ports functions/input.R (upload path).

Chain mirrors parseUploadedNetwork(): subset legit columns, trim, dedup,
scale weights, append Node_Layer keys. Validation mirrors isNetworkFormatValid().
Blocking failures raise NetworkValidationError → HTTP 400 in the router.
"""

from io import StringIO

import numpy as np
import pandas as pd

from app import config
from app.models.network import EdgeModel, NetworkModel, NodeModel


class NetworkValidationError(ValueError):
    """A blocking validation failure — bad file format."""


def _mapper(values: pd.Series, out_min: float, out_max: float) -> pd.Series:
    """Linear-rescale into [out_min, out_max]; constant input → DEFAULT_MAP_VALUE.

    Ports functions/general.R mapper() (used with 0.1..1 for scaled weights).
    """
    in_min, in_max = values.min(), values.max()
    if in_max - in_min == 0:
        return pd.Series([config.DEFAULT_MAP_VALUE] * len(values), index=values.index)
    scaled = (values - in_min) * (out_max - out_min) / (in_max - in_min) + out_min
    return pd.Series(scaled, index=values.index)


def _line(mask: "pd.Series[bool]") -> int:
    """File line of the first True row (line 1 is the header)."""
    return int(np.argmax(mask.to_numpy())) + 2


def _validate(df: pd.DataFrame) -> None:
    if not set(config.MANDATORY_NETWORK_COLUMNS).issubset(df.columns):
        raise NetworkValidationError(
            "Your network file must contain at least these four columns: "
            "SourceNode, SourceLayer, TargetNode, TargetLayer — or just "
            "SourceNode and TargetNode for a minimal edgelist (single layer)."
        )
    # Reject rows with an empty/whitespace mandatory cell — a blank becomes NaN
    # and would crash EdgeModel construction with a 500 instead of a clean 400.
    mandatory = df[config.MANDATORY_NETWORK_COLUMNS].apply(lambda c: c.str.strip())
    blank = (mandatory.isna() | (mandatory == "")).any(axis=1)
    if blank.any():
        raise NetworkValidationError(
            "Every edge must have a non-empty SourceNode, SourceLayer, TargetNode and TargetLayer"
            f" (first problem on line {_line(blank)})."
        )
    if "Weight" in df.columns:
        # non-numeric coerces to NaN; inf is rejected too (it would map to a NaN
        # scaled_weight, which the finite-only EdgeModel then refuses -> 500)
        bad = ~np.isfinite(pd.to_numeric(df["Weight"], errors="coerce"))
        if bad.any():
            row = _line(bad)
            raise NetworkValidationError(
                "Make sure all input weights are finite numeric values"
                f' (line {row}: "{df["Weight"].iloc[row - 2]}").'
            )
    if "Channel" in df.columns:
        empty = df["Channel"].fillna("").astype(str).str.strip() == ""
        if empty.any():
            raise NetworkValidationError(
                f"At least one edge has no channel name (first on line {_line(empty)}). "
                "Please reupload the network file with all edge channels."
            )


def parse_network_tsv(text: str) -> NetworkModel:
    # rows before pandas reads them (duplicates are dropped later, so allow
    # some): a huge file is refused without being parsed
    if text.count("\n") > 2 * config.MAX_EDGES + 1:
        raise NetworkValidationError(
            f"The network must contain no more than {config.MAX_EDGES} edges."
        )
    """Parse a raw TSV string into a validated NetworkModel."""
    try:
        df = pd.read_csv(StringIO(text), sep="\t", dtype=str)
    except pd.errors.EmptyDataError as e:
        raise NetworkValidationError("The network file is empty or has no columns.") from e

    # minimal 2-column edgelist: no layer columns -> every node in one default layer
    if "SourceLayer" not in df.columns and "TargetLayer" not in df.columns:
        df["SourceLayer"] = config.DEFAULT_LAYER_NAME
        df["TargetLayer"] = config.DEFAULT_LAYER_NAME

    _validate(df)

    # subset legit columns (mandatory + optional Channel/Weight, in fixed order)
    legit = [
        c
        for c in config.MANDATORY_NETWORK_COLUMNS + config.OPTIONAL_NETWORK_COLUMNS
        if c in df.columns
    ]
    df = df[legit].copy()

    # trim whitespace on every column
    for col in df.columns:
        df[col] = df[col].astype(str).str.strip()

    # dedup — include Channel in the key when present
    subset = list(config.MANDATORY_NETWORK_COLUMNS)
    if "Channel" in df.columns:
        subset.append("Channel")
    df = df.drop_duplicates(subset=subset).reset_index(drop=True)

    # weights: numeric or default 1; scaled into 0.1..1
    weight = (
        pd.to_numeric(df["Weight"], errors="coerce")
        if "Weight" in df.columns
        else pd.Series([1.0] * len(df))
    )
    df["Weight"] = weight
    df["ScaledWeight"] = _mapper(weight, 0.1, 1.0)

    df["SourceNode_Layer"] = df["SourceNode"] + "_" + df["SourceLayer"]
    df["TargetNode_Layer"] = df["TargetNode"] + "_" + df["TargetLayer"]

    layers = pd.unique(pd.concat([df["SourceLayer"], df["TargetLayer"]]).dropna()).tolist()
    if len(layers) > config.MAX_LAYERS:
        raise NetworkValidationError(
            f"The network must contain no more than {config.MAX_LAYERS} layers."
        )  # noqa: E501
    if len(df) > config.MAX_EDGES:
        raise NetworkValidationError(
            f"The network must contain no more than {config.MAX_EDGES} edges."
        )  # noqa: E501

    return NetworkModel(
        nodes=_build_nodes(df),
        edges=_build_edges(df),
        layers=layers,
        channels=sorted(df["Channel"].unique().tolist()) if "Channel" in df.columns else [],
    )


def _build_nodes(df: pd.DataFrame) -> list[NodeModel]:
    src = df[["SourceNode_Layer", "SourceNode", "SourceLayer"]].rename(
        columns={"SourceNode_Layer": "id", "SourceNode": "label", "SourceLayer": "layer"}
    )
    trg = df[["TargetNode_Layer", "TargetNode", "TargetLayer"]].rename(
        columns={"TargetNode_Layer": "id", "TargetNode": "label", "TargetLayer": "layer"}
    )
    nodes = pd.concat([src, trg]).drop_duplicates(subset="id")
    return [
        NodeModel(id=str(r["id"]), label=str(r["label"]), layer=str(r["layer"]))
        for r in nodes.to_dict("records")
    ]


def _build_edges(df: pd.DataFrame) -> list[EdgeModel]:
    has_channel = "Channel" in df.columns
    return [
        EdgeModel(
            src=r["SourceNode_Layer"],
            trg=r["TargetNode_Layer"],
            source_node=r["SourceNode"],
            source_layer=r["SourceLayer"],
            target_node=r["TargetNode"],
            target_layer=r["TargetLayer"],
            weight=r["Weight"],
            scaled_weight=r["ScaledWeight"],
            channel=r["Channel"] if has_channel else None,
        )
        for r in df.to_dict("records")
    ]
