"""Capped list types shared by the request models.

A request names the layers, channels, nodes or groups it works on; each list
is capped (and de-duplicated) so one request cannot multiply the work — a
layer named a thousand times used to run its layout or metric a thousand
times over.
"""

from typing import Annotated

from pydantic import AfterValidator, Field

from app import config

MAX_GROUPS = 2000  # distinct groups in a group layout, as for group files
MAX_GROUPS_PER_NODE = 12  # as for annotation files


def _unique(v: list[str]) -> list[str]:
    return list(dict.fromkeys(v))


def _few_groups(v: dict[str, list[str]]) -> dict[str, list[str]]:
    if len({g for gs in v.values() for g in gs}) > MAX_GROUPS:
        raise ValueError(f"No more than {MAX_GROUPS} groups are supported.")
    return v


LayerNames = Annotated[list[str], Field(max_length=config.MAX_LAYERS), AfterValidator(_unique)]
ChannelNames = Annotated[list[str], Field(max_length=config.MAX_CHANNELS), AfterValidator(_unique)]
NodeIds = Annotated[list[str], Field(max_length=config.MAX_NODES), AfterValidator(_unique)]
GroupMap = Annotated[
    dict[str, Annotated[list[str], Field(max_length=MAX_GROUPS_PER_NODE)]],
    Field(max_length=config.MAX_NODES),
    AfterValidator(_few_groups),
]
