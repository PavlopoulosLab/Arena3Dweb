"""PPI database importers — STRING, IntAct, OmniPath (ports NORMA's importers).

Each fetcher returns plain interaction rows; `rows_to_network` turns them into
an Arena3D TSV and runs it through `parser.parse_network_tsv`, so imported
networks get exactly the validation, weight scaling and MAX_EDGES / MAX_LAYERS
limits of an uploaded file.

Two shapes:
- STRING with evidence channels: one layer, one channel per evidence type
  (experiments, databases, text mining, ...), weight = that evidence score.
- One database per layer: each database becomes a layer and copies of the same
  protein are joined by inter-layer edges, so databases can be compared.
"""

import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

from app import config
from app.models.network import NetworkModel
from app.services.parser import parse_network_tsv

# STRING per-evidence score fields -> channel names (NORMA STRING_CHANNELS)
STRING_CHANNELS: dict[str, str] = {
    "escore": "Experiments",
    "dscore": "Databases",
    "tscore": "Text mining",
    "ascore": "Co-expression",
    "nscore": "Neighborhood",
    "fscore": "Gene fusion",
    "pscore": "Co-occurrence",
}
DATABASES = ("STRING", "IntAct", "OmniPath")
COUPLING_WEIGHT = 1.0


class DatabaseError(ValueError):
    """Bad request (nothing found, too large) — HTTP 400."""


class UpstreamError(RuntimeError):
    """The external service failed or timed out — HTTP 502."""


@dataclass(frozen=True)
class Interaction:
    source: str
    target: str
    weight: float
    channel: str | None = None


class _Budget:
    """A deadline for the whole of an import, checked before every upstream call,
    so one request cannot hold a worker for minutes."""

    def __init__(self, seconds: float) -> None:
        self.deadline = time.monotonic() + seconds

    def check(self) -> None:
        if time.monotonic() > self.deadline:
            raise UpstreamError(
                f"The import took longer than {config.DB_TOTAL_SECONDS:.0f} s; "
                "ask for fewer pathways or terms."
            )


def _get(
    url: str, params: dict[str, str] | None = None, *, accept: str = "application/json"
) -> str:
    """GET with a timeout and a size cap. Tests monkeypatch this."""
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url, headers={"Accept": accept, "User-Agent": "Arena3D (https://arena3d.org)"}
    )
    try:
        with urllib.request.urlopen(req, timeout=config.DB_TIMEOUT_SECONDS) as res:  # noqa: S310
            body: bytes = res.read(config.MAX_UPLOAD_BYTES + 1)
    except urllib.error.HTTPError as e:
        host = urllib.parse.urlparse(url).netloc
        if e.code in (400, 404):  # a wrong identifier, not an outage
            raise DatabaseError(f"{host} has nothing for this request (HTTP {e.code}).") from e
        raise UpstreamError(f"{host} answered HTTP {e.code}.") from e
    except (urllib.error.URLError, TimeoutError) as e:
        raise UpstreamError(f"Could not reach {urllib.parse.urlparse(url).netloc}: {e}") from e
    if len(body) > config.MAX_UPLOAD_BYTES:
        raise UpstreamError("The database response is too large.")
    return body.decode("utf-8", errors="replace")


def _clean(name: str) -> str:
    # node names end up in a TSV cell
    return " ".join(str(name).split())


# ---------------------------------------------------------------- STRING
def fetch_string(
    identifiers: list[str],
    species: int,
    required_score: float,
    channels: list[str] | None = None,
    add_nodes: int = 0,
) -> list[Interaction]:
    """One row per (pair, evidence channel) with a non-zero score in that channel."""
    fields = channels or list(STRING_CHANNELS)
    unknown = [c for c in fields if c not in STRING_CHANNELS]
    if unknown:
        raise DatabaseError(f"Unknown STRING evidence channel: {', '.join(unknown)}")
    params = {
        "identifiers": "\r".join(identifiers),
        "species": str(species),
        "required_score": str(round(required_score * 1000)),
        "caller_identity": "arena3d",
    }
    if add_nodes:
        params["add_nodes"] = str(add_nodes)
    rows = json.loads(_get(f"{config.STRING_API}/json/network", params) or "[]")
    if isinstance(rows, dict):  # STRING reports errors as {"Error": ...}
        raise DatabaseError(str(rows.get("ErrorMessage") or rows.get("Error") or rows))
    out: list[Interaction] = []
    seen: set[tuple[str, str]] = set()
    for r in rows:
        a, b = _clean(r.get("preferredName_A", "")), _clean(r.get("preferredName_B", ""))
        if not a or not b or a == b:
            continue
        key = (min(a, b), max(a, b))
        if key in seen:  # STRING may list a pair in both directions
            continue
        seen.add(key)
        for field in fields:
            score = float(r.get(field) or 0)
            if score > 0:
                out.append(Interaction(key[0], key[1], score, STRING_CHANNELS[field]))
    return out


def string_combined(
    identifiers: list[str], species: int, required_score: float
) -> list[Interaction]:
    """STRING as a single channel-less layer (combined score), for per-database mode."""
    params = {
        "identifiers": "\r".join(identifiers),
        "species": str(species),
        "required_score": str(round(required_score * 1000)),
        "caller_identity": "arena3d",
    }
    rows = json.loads(_get(f"{config.STRING_API}/json/network", params) or "[]")
    if isinstance(rows, dict):
        raise DatabaseError(str(rows.get("ErrorMessage") or rows.get("Error") or rows))
    pairs: dict[tuple[str, str], float] = {}
    for r in rows:
        a, b = _clean(r.get("preferredName_A", "")), _clean(r.get("preferredName_B", ""))
        if a and b and a != b:
            pairs[(min(a, b), max(a, b))] = float(r.get("score") or 0)
    return [Interaction(a, b, s) for (a, b), s in pairs.items()]


# ---------------------------------------------------------------- IntAct
def _mitab_name(id_field: str, alt_field: str, alias_field: str) -> str:
    """Gene name from PSI-MITAB 2.5 columns (NORMA mitabName)."""
    items = f"{alias_field}|{alt_field}".split("|")
    for item in items:
        if "(gene name)" in item and ":" in item:
            return item.split(":", 1)[1].split("(", 1)[0]
    for item in items:
        if "(display_short)" in item and ":" in item:
            return item.split(":", 1)[1].split("(", 1)[0]
    return id_field.split("|")[0].split(":", 1)[-1]


def fetch_intact(
    identifiers: list[str], species: int, min_score: float = 0.0, max_rows: int = 2000
) -> list[Interaction]:
    """IntAct via PSICQUIC (tab25); weight = best IntAct MI-score per pair."""
    ids = " OR ".join(f'"{i}"' if any(c in i for c in " ():") else i for i in identifiers)
    miql = f"identifier:({ids}) AND taxidA:{species} AND taxidB:{species}"
    text = _get(
        f"{config.INTACT_PSICQUIC}/query/{urllib.parse.quote(miql)}",
        {"format": "tab25", "firstResult": "0", "maxResults": str(max_rows)},
        accept="text/plain",
    )
    best: dict[tuple[str, str], float] = {}
    for line in text.splitlines():
        c = line.split("\t")
        if len(c) < 15:
            continue
        a, b = _clean(_mitab_name(c[0], c[2], c[4])), _clean(_mitab_name(c[1], c[3], c[5]))
        if not a or not b or a == b:
            continue
        score = 0.0
        for part in c[14].split("|"):
            if part.startswith("intact-miscore:"):
                score = float(part.split(":", 1)[1])
        if score < min_score:
            continue
        key = (min(a, b), max(a, b))
        best[key] = max(best.get(key, 0.0), score)
    return [Interaction(a, b, s) for (a, b), s in best.items()]


# ---------------------------------------------------------------- OmniPath
def fetch_omnipath(identifiers: list[str], species: int) -> list[Interaction]:
    """OmniPath interactions among/around the proteins; weight = curation effort."""
    rows = json.loads(
        _get(
            f"{config.OMNIPATH_API}/interactions",
            {
                "partners": ",".join(identifiers),
                "genesymbols": "yes",
                "organisms": str(species),
                "fields": "curation_effort",
                "format": "json",
            },
        )
        or "[]"
    )
    best: dict[tuple[str, str], float] = {}
    for r in rows:
        a = _clean(r.get("source_genesymbol") or r.get("source", ""))
        b = _clean(r.get("target_genesymbol") or r.get("target", ""))
        if not a or not b or a == b:
            continue
        key = (min(a, b), max(a, b))
        best[key] = max(best.get(key, 0.0), float(r.get("curation_effort") or 1))
    return [Interaction(a, b, w) for (a, b), w in best.items()]


# ---------------------------------------------------------------- building
def rows_to_network(layers: dict[str, list[Interaction]], *, couple: bool) -> NetworkModel:
    """Write interactions as an Arena3D TSV (one layer per key) and parse it.

    `couple` joins every protein that appears in several layers with
    inter-layer edges between consecutive layers.
    """
    layers = {name: rows for name, rows in layers.items() if rows}
    if not layers:
        raise DatabaseError("No interactions found for these identifiers and settings.")
    with_channels = any(r.channel for rows in layers.values() for r in rows)
    header = ["SourceNode", "SourceLayer", "TargetNode", "TargetLayer", "Weight"]
    if with_channels:
        header.append("Channel")
    lines = ["\t".join(header)]
    for layer, rows in layers.items():
        for r in rows:
            cells = [r.source, layer, r.target, layer, f"{r.weight:g}"]
            if with_channels:
                cells.append(r.channel or "interaction")
            lines.append("\t".join(cells))
    if couple:
        present: dict[str, list[str]] = {}
        for layer, rows in layers.items():
            for name in {n for r in rows for n in (r.source, r.target)}:
                present.setdefault(name, []).append(layer)
        for name, in_layers in present.items():
            for a, b in zip(in_layers, in_layers[1:], strict=False):
                cells = [name, a, name, b, f"{COUPLING_WEIGHT:g}"]
                if with_channels:
                    cells.append("same protein")
                lines.append("\t".join(cells))
    return parse_network_tsv("\n".join(lines) + "\n")


def import_string(
    identifiers: list[str],
    species: int,
    required_score: float,
    channels: list[str] | None,
    add_nodes: int,
) -> NetworkModel:
    rows = fetch_string(identifiers, species, required_score, channels, add_nodes)
    return rows_to_network({"STRING": rows}, couple=False)


def import_per_database(
    identifiers: list[str],
    species: int,
    databases: list[str],
    required_score: float,
    only_among: bool = True,
) -> NetworkModel:
    unknown = [d for d in databases if d not in DATABASES]
    if unknown:
        raise DatabaseError(f"Unknown database: {', '.join(unknown)}")
    fetch = {
        "STRING": lambda: string_combined(identifiers, species, required_score),
        "IntAct": lambda: fetch_intact(identifiers, species, min_score=required_score),
        "OmniPath": lambda: fetch_omnipath(identifiers, species),
    }
    layers = {db: fetch[db]() for db in databases}
    if only_among:
        # STRING already answers among the query; IntAct/OmniPath return all
        # partners — keep layers comparable by restricting every one of them
        wanted = {i.upper() for i in identifiers}
        layers = {
            db: [r for r in rows if r.source.upper() in wanted and r.target.upper() in wanted]
            for db, rows in layers.items()
        }
    net = rows_to_network(layers, couple=True)
    empty = [db for db in databases if not layers[db]]
    if empty:
        net.warnings.append(f"No interactions from: {', '.join(empty)}")
    return net


def import_ndex(uuid: str) -> NetworkModel:
    """Public NDEx network (CX2) -> Arena3D network, via services/formats.py."""
    from app.services.formats import parse_cx2

    body = _get(f"{config.NDEX_API}/v3/networks/{uuid}", accept="application/json")
    try:
        data = json.loads(body)
    except json.JSONDecodeError as e:
        raise UpstreamError("NDEx returned something that is not CX2 JSON.") from e
    if isinstance(data, dict) and data.get("errorCode"):
        raise DatabaseError(str(data.get("message") or data["errorCode"]))
    return parse_cx2(data)


# ---------------------------------------------------------------- Reactome / Gene Ontology
# A pathway or GO term is a gene set; each set becomes a layer whose edges are
# STRING's interactions among the set's genes, and copies of a gene are linked
# across layers — a pathway- or term-centred multilayer view.

REACTOME_SPECIES = {
    9606: "Homo sapiens",
    10090: "Mus musculus",
    10116: "Rattus norvegicus",
    7227: "Drosophila melanogaster",
    6239: "Caenorhabditis elegans",
    7955: "Danio rerio",
    559292: "Saccharomyces cerevisiae",
    4932: "Saccharomyces cerevisiae",
    3702: "Arabidopsis thaliana",
}
_TAG = re.compile(r"<[^>]+>")
MAX_SEARCH_HITS = 25


def search_reactome(query: str, species: int) -> list[dict[str, str]]:
    """Pathways matching a name (Reactome ContentService search), for the picker."""
    params = {"query": query, "types": "Pathway", "cluster": "true"}
    name = REACTOME_SPECIES.get(species)
    if name:
        params["species"] = name
    data = json.loads(_get(f"{config.REACTOME_API}/search/query", params) or "{}")
    hits: list[dict[str, str]] = []
    for group in data.get("results") or []:
        for e in group.get("entries") or []:
            hits.append(
                {
                    "id": str(e.get("stId") or ""),
                    "name": _clean(_TAG.sub("", str(e.get("name") or ""))),
                    "detail": ", ".join(e.get("species") or []),
                }
            )
    return [h for h in hits if h["id"]][:MAX_SEARCH_HITS]


def fetch_reactome_genes(
    pathway: str, max_genes: int, budget: _Budget | None = None
) -> tuple[str, list[str], int]:
    """(pathway name, its gene symbols up to max_genes, total genes)."""
    pid = pathway.strip()
    if not re.fullmatch(r"R-[A-Z]{3}-\d+(\.\d+)?", pid):
        raise DatabaseError(
            f"'{pathway}' is not a Reactome pathway identifier (e.g. R-HSA-109581)."
        )
    if budget:
        budget.check()
    name = _clean(_get(f"{config.REACTOME_API}/data/query/{pid}/displayName", accept="text/plain"))
    rows = json.loads(
        _get(f"{config.REACTOME_API}/data/participants/{pid}/referenceEntities") or "[]"
    )
    if isinstance(rows, dict):
        raise DatabaseError(str(rows.get("messages") or rows.get("reason") or rows))
    genes: list[str] = []
    seen: set[str] = set()
    for r in rows:
        if r.get("databaseName") != "UniProt":
            continue
        names = r.get("name") or []
        gene = _clean(names[0]) if names else ""
        if gene and gene not in seen:
            seen.add(gene)
            genes.append(gene)
    return name or pid, genes[:max_genes], len(genes)


def search_go(query: str) -> list[dict[str, str]]:
    """GO terms matching a name (QuickGO), for the picker."""
    data = json.loads(
        _get(f"{config.QUICKGO_API}/ontology/go/search", {"query": query, "limit": "15"}) or "{}"
    )
    return [
        {
            "id": str(r.get("id") or ""),
            "name": _clean(str(r.get("name") or "")),
            "detail": str(r.get("aspect") or "").replace("_", " "),
        }
        for r in data.get("results") or []
        if r.get("id")
    ][:MAX_SEARCH_HITS]


def fetch_go_genes(
    term: str, taxon: int, include_children: bool, max_genes: int, budget: _Budget | None = None
) -> tuple[str, list[str], int]:
    """(term name, gene symbols annotated to it up to max_genes, total genes seen)."""
    tid = term.strip().upper()
    if not re.fullmatch(r"GO:\d{7}", tid):
        raise DatabaseError(f"'{term}' is not a GO term identifier (e.g. GO:0006915).")
    if budget:
        budget.check()
    info = json.loads(_get(f"{config.QUICKGO_API}/ontology/go/terms/{tid}") or "{}")
    results = info.get("results") or []
    name = _clean(str(results[0].get("name") or tid)) if results else tid
    genes: list[str] = []
    seen: set[str] = set()
    page, pages = 1, 1
    while page <= pages and page <= 10:  # at most 1000 annotations
        if budget:
            budget.check()
        data = json.loads(
            _get(
                f"{config.QUICKGO_API}/annotation/search",
                {
                    "goId": tid,
                    "taxonId": str(taxon),
                    "limit": "100",
                    "page": str(page),
                    "goUsage": "descendants" if include_children else "exact",
                },
            )
            or "{}"
        )
        pages = int((data.get("pageInfo") or {}).get("total") or 1)
        for r in data.get("results") or []:
            symbol = _clean(str(r.get("symbol") or ""))
            if symbol and symbol not in seen:
                seen.add(symbol)
                genes.append(symbol)
        if len(genes) >= max_genes:
            break
        page += 1
    return name, genes[:max_genes], len(genes)


def import_gene_sets(
    sets: list[tuple[str, list[str]]],
    species: int,
    required_score: float,
    budget: _Budget | None = None,
) -> NetworkModel:
    """One layer per (name, genes) with STRING edges among the genes; copies coupled."""
    layers: dict[str, list[Interaction]] = {}
    notes: list[str] = []
    for name, genes in sets:
        if budget:
            budget.check()
        if len(genes) < 2:
            notes.append(f"{name}: fewer than two genes, left out.")
            continue
        wanted = {g.upper() for g in genes}
        rows = string_combined(genes, species, required_score)
        layers[name] = [
            r for r in rows if r.source.upper() in wanted and r.target.upper() in wanted
        ]
    net = rows_to_network(layers, couple=True)
    empty = [name for name, rows in layers.items() if not rows]
    if empty:
        notes.append(f"No STRING interactions among the genes of: {', '.join(empty)}")
    net.warnings.extend(notes)
    return net


def import_reactome(
    pathways: list[str], species: int, required_score: float, max_genes: int
) -> NetworkModel:
    budget = _Budget(config.DB_TOTAL_SECONDS)
    sets: list[tuple[str, list[str]]] = []
    notes: list[str] = []
    for pathway in dict.fromkeys(pathways):
        name, genes, total = fetch_reactome_genes(pathway, max_genes, budget)
        if total > len(genes):
            notes.append(f"{name}: the first {len(genes)} of {total} genes.")
        sets.append((name, genes))
    net = import_gene_sets(sets, species, required_score, budget)
    net.warnings.extend(notes)
    return net


def import_go(
    terms: list[str], taxon: int, include_children: bool, required_score: float, max_genes: int
) -> NetworkModel:
    budget = _Budget(config.DB_TOTAL_SECONDS)
    sets: list[tuple[str, list[str]]] = []
    notes: list[str] = []
    for term in dict.fromkeys(terms):
        name, genes, total = fetch_go_genes(term, taxon, include_children, max_genes, budget)
        if total > len(genes):
            notes.append(f"{name}: the first {len(genes)} of {total} genes.")
        sets.append((name, genes))
    net = import_gene_sets(sets, taxon, required_score, budget)
    net.warnings.extend(notes)
    return net
