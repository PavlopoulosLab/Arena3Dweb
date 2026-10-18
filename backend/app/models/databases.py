"""Request schemas for the PPI database importers (POST /api/import/*)."""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StringConstraints

from app import config
from app.models.network import NetworkModel

Identifier = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
CategoryKey = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
# Checked against the string-db.org allow-list in services/databases.py
StringAddress = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
RawRows = list[dict[str, Any]]

# STRING term collections switched on by default (NORMA STRING_CATEGORIES)
DEFAULT_STRING_CATEGORIES = [
    "Process",
    "Function",
    "Component",
    "KEGG",
    "RCTM",
    "Keyword",
    "InterPro",
    "DISEASES",
]


class StringGroupingOptions(BaseModel):
    """Groupings from functional terms: one annotation set per term collection."""

    mode: Literal["enrichment", "annotation"] = "enrichment"
    fdr: float = Field(default=0.05, gt=0, le=1)  # enrichment only
    categories: list[CategoryKey] = Field(
        default_factory=lambda: list(DEFAULT_STRING_CATEGORIES), max_length=40
    )
    other_categories: bool = False  # collections STRING offers beyond the known list
    max_terms: int = Field(default=30, ge=1, le=500)  # groups per collection
    min_group: int = Field(default=2, ge=1, le=100)  # smallest group


class StringRaw(BaseModel):
    """STRING's own answers, fetched by the browser (Connect: Directly), so the
    server only builds the network and never calls STRING itself."""

    version: RawRows | None = Field(default=None, max_length=5)
    ids: RawRows = Field(max_length=config.MAX_DB_IDENTIFIERS * 5)  # get_string_ids
    network: RawRows = Field(max_length=100_000)
    info: RawRows | None = Field(default=None, max_length=5_000)  # descriptions
    terms: RawRows | None = Field(default=None, max_length=100_000)  # groupings


class StringImportRequest(BaseModel):
    identifiers: list[Identifier] = Field(min_length=1, max_length=config.MAX_DB_IDENTIFIERS)
    species: int = Field(default=9606, ge=1)  # NCBI taxon; 9606 = human
    network_type: Literal["functional", "physical"] = "functional"
    required_score: float = Field(default=0.4, ge=0, le=1)
    # STRING score fields (escore, dscore, ...); None = all seven evidence channels
    channels: list[str] | None = Field(default=None, max_length=config.MAX_CHANNELS)
    # one edge per evidence channel, or one per pair with the combined score
    edge_mode: Literal["channels", "combined"] = "channels"
    add_nodes: int = Field(default=0, ge=0, le=500)  # extra interactors STRING adds
    descriptions: bool = False  # fetch protein descriptions
    groupings: StringGroupingOptions | None = None
    address: StringAddress | None = None  # e.g. https://version-12-0.string-db.org
    raw: StringRaw | None = None


class StringGroupingsRequest(BaseModel):
    """Groupings for the network on screen (its node names)."""

    identifiers: list[Identifier] = Field(min_length=1, max_length=config.MAX_GROUPING_IDENTIFIERS)
    species: int = Field(default=9606, ge=1)
    groupings: StringGroupingOptions = Field(default_factory=StringGroupingOptions)
    address: StringAddress | None = None
    raw_terms: RawRows | None = Field(default=None, max_length=100_000)


class StringTerm(BaseModel):
    term: str
    description: str
    members: list[str]  # node names
    fdr: float | None = None
    p_value: float | None = None


class StringGrouping(BaseModel):
    category: str  # STRING key: Process, KEGG, ...
    name: str  # readable: GO Biological Process, KEGG pathways, ...
    terms: list[StringTerm]


class StringNodeInfo(BaseModel):
    name: str
    string_id: str
    description: str | None = None
    url: str
    query: bool  # typed by the user, not an added interactor


class StringImportResponse(NetworkModel):
    string_version: str | None = None
    taxon_name: str | None = None
    node_info: list[StringNodeInfo] = []
    groupings: list[StringGrouping] = []


class StringGroupingsResponse(BaseModel):
    groupings: list[StringGrouping]
    warnings: list[str] = []


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
