"""Request schemas for the PPI database importers (POST /api/import/*)."""

from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app import config

Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class StringImportRequest(BaseModel):
    identifiers: list[Identifier] = Field(min_length=1, max_length=config.MAX_DB_IDENTIFIERS)
    species: int = 9606  # NCBI taxon; 9606 = human
    required_score: float = Field(default=0.4, ge=0, le=1)
    # STRING score fields (escore, dscore, ...); None = all seven evidence channels
    channels: list[str] | None = Field(default=None, max_length=config.MAX_CHANNELS)
    add_nodes: int = Field(default=0, ge=0, le=100)  # extra interactors STRING adds


class DatabaseImportRequest(BaseModel):
    identifiers: list[Identifier] = Field(min_length=1, max_length=config.MAX_DB_IDENTIFIERS)
    species: int = 9606
    databases: list[str] = Field(min_length=1, max_length=3)  # STRING | IntAct | OmniPath
    # STRING combined score / IntAct MI-score floor
    required_score: float = Field(default=0.4, ge=0, le=1)
    # keep only interactions among the query proteins (comparable layers)
    only_among: bool = True


SetId = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=40)]


class ReactomeImportRequest(BaseModel):
    """Reactome pathways as layers: each pathway's proteins with STRING edges among them."""

    pathways: list[SetId] = Field(min_length=1, max_length=config.MAX_LAYERS)
    species: int = 9606
    required_score: float = Field(default=0.4, ge=0, le=1)
    max_genes: int = Field(default=config.MAX_GENES_PER_SET, ge=2, le=config.MAX_DB_IDENTIFIERS)


class GoImportRequest(BaseModel):
    """Gene Ontology terms as layers: each term's genes with STRING edges among them."""

    terms: list[SetId] = Field(min_length=1, max_length=config.MAX_LAYERS)
    taxon: int = 9606
    include_children: bool = False  # annotations to descendant terms too
    required_score: float = Field(default=0.4, ge=0, le=1)
    max_genes: int = Field(default=config.MAX_GENES_PER_SET, ge=2, le=config.MAX_DB_IDENTIFIERS)


class SetSearchHit(BaseModel):
    id: str
    name: str
    detail: str = ""  # species, aspect
