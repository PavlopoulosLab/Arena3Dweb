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
import math
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

from app import config
from app.models.databases import (
    StringGrouping,
    StringGroupingOptions,
    StringGroupingsResponse,
    StringImportResponse,
    StringNodeInfo,
    StringRaw,
    StringTerm,
)
from app.models.network import NetworkModel
from app.services.parser import parse_network_tsv

# STRING per-evidence score fields -> channel names, in STRING's order (NORMA STRING_CHANNELS)
STRING_CHANNELS: dict[str, str] = {
    "nscore": "Gene neighborhood",
    "fscore": "Gene fusion",
    "pscore": "Co-occurrence",
    "ascore": "Co-expression",
    "escore": "Experiments",
    "dscore": "Curated databases",
    "tscore": "Text mining",
}
# STRING's prior: the chance two random proteins are linked, removed from each
# channel before the channels are combined as independent evidence
STRING_PRIOR = 0.041
# STRING term collection key -> readable name, in the order they are offered
STRING_CATEGORIES: dict[str, str] = {
    "Process": "GO Biological Process",
    "Function": "GO Molecular Function",
    "Component": "GO Cellular Component",
    "KEGG": "KEGG pathways",
    "RCTM": "Reactome pathways",
    "WikiPathways": "WikiPathways",
    "Keyword": "UniProt keywords",
    "Pfam": "Pfam domains",
    "InterPro": "InterPro domains and features",
    "SMART": "SMART domains",
    "DISEASES": "Diseases (DISEASES)",
    "TISSUES": "Tissues (TISSUES)",
    "COMPARTMENTS": "Subcellular localization (COMPARTMENTS)",
    "HPO": "Human phenotypes (Monarch)",
    "MPO": "Mammalian phenotypes (Monarch)",
    "DPO": "Drosophila phenotypes (Monarch)",
    "WPO": "C. elegans phenotypes (Monarch)",
    "ZPO": "Zebrafish phenotypes (Monarch)",
    "FYPO": "Fission yeast phenotypes (Monarch)",
    "NetworkNeighborAL": "Local network clusters (STRING)",
    "PMID": "Reference publications (PubMed)",
}
_CATEGORY_ALIASES = {
    "go process": "Process",
    "biological process": "Process",
    "go function": "Function",
    "molecular function": "Function",
    "go component": "Component",
    "cellular component": "Component",
    "kegg pathways": "KEGG",
    "reactome": "RCTM",
    "reactome pathways": "RCTM",
    "uniprot keywords": "Keyword",
    "keywords": "Keyword",
}
# Only STRING itself and its frozen version sites (SSRF guard for the address box)
_STRING_ADDRESS = re.compile(r"^https://(version-\d+-\d+\.)?string-db\.org/?$")
STRING_SITE = "https://string-db.org"
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
        url, headers={"Accept": accept, "User-Agent": "Arena3D (https://www.arena3d.org)"}
    )
    return _read(req, url)


def _post(url: str, params: dict[str, str], *, accept: str = "application/json") -> str:
    """Form-encoded POST (STRING: long identifier lists overflow a GET URL). Tests
    monkeypatch this."""
    req = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(params).encode(),
        headers={
            "Accept": accept,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Arena3D (https://www.arena3d.org)",
        },
    )
    return _read(req, url)


def _read(req: urllib.request.Request, url: str) -> str:
    """Send with a timeout and a size cap; HTTP errors become Database/UpstreamError."""
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
    # node names end up in a TSV cell: no tabs or new lines, and no double
    # quotes (IntAct has names like "ccsb isoform id: ndn_2"), which the TSV
    # parser would read as an unterminated quoted field
    return " ".join(str(name).replace('"', "").split())


# ---------------------------------------------------------------- STRING
def string_api(address: str | None) -> str:
    """The STRING API base for a site address; None = the configured default."""
    if not address:
        return config.STRING_API
    if not _STRING_ADDRESS.match(address):
        raise DatabaseError(
            "The STRING address must be https://string-db.org or a version address "
            "such as https://version-12-0.string-db.org."
        )
    return f"{address.rstrip('/')}/api"


class _StringClient:
    """STRING's JSON API for one import: form POSTs, caller_identity, one second
    between calls (as STRING asks) and the import's overall time budget."""

    def __init__(self, address: str | None, budget: _Budget | None = None) -> None:
        self.api = string_api(address)
        self.budget = budget or _Budget(config.DB_TOTAL_SECONDS)
        self.last = 0.0

    def __call__(self, method: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        self.budget.check()
        wait = self.last + config.STRING_CALL_GAP_SECONDS - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        self.last = time.monotonic()
        form = {k: str(v) for k, v in params.items()} | {"caller_identity": "arena3d"}
        body = _post(f"{self.api}/json/{method}", form)
        try:
            data = json.loads(body or "[]")
        except json.JSONDecodeError as e:
            raise UpstreamError("STRING sent an answer that is not JSON; check the address.") from e
        # STRING reports errors as {"Error": ...} or [{"Error": ...}]
        err = data[0] if isinstance(data, list) and len(data) == 1 else data
        if isinstance(err, dict) and ("Error" in err or "ErrorMessage" in err):
            raise DatabaseError(f"STRING: {err.get('ErrorMessage') or err.get('Error')}")
        if not isinstance(data, list):
            raise UpstreamError("STRING sent an answer of an unexpected shape.")
        return [r for r in data if isinstance(r, dict)]


def _score(value: Any) -> float:
    """A STRING score on 0-1 (some answers use 0-1000)."""
    try:
        x = float(value or 0)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(x) or x < 0:
        return 0.0
    return x / 1000 if x > 1 else x


def _number(value: Any) -> float | None:
    try:
        x = float(value)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


def combine_string_scores(scores: list[float]) -> float:
    """STRING's rule: remove the prior from each channel, combine the channels as
    independent evidence, then add the prior back."""
    miss = 1.0
    for s in scores:
        if s > 0:
            miss *= 1 - max(0.0, (s - STRING_PRIOR) / (1 - STRING_PRIOR))
    combined = 1 - miss
    return combined + STRING_PRIOR * (1 - combined)


def _string_fields(channels: list[str] | None) -> list[str]:
    fields = channels or list(STRING_CHANNELS)
    unknown = [c for c in fields if c not in STRING_CHANNELS]
    if unknown:
        raise DatabaseError(f"Unknown STRING evidence channel: {', '.join(unknown)}")
    return [f for f in STRING_CHANNELS if f in fields]  # STRING's order, no repeats


def _sample(names: list[str], n: int = 8) -> str:
    return ", ".join(names[:n]) + (f" and {len(names) - n} more" if len(names) > n else "")


def resolve_string_ids(
    rows: list[dict[str, Any]], identifiers: list[str]
) -> tuple[dict[str, str], str | None, list[str]]:
    """get_string_ids (echo_query) -> ({stringId: preferred name}, taxon name, notes)."""
    by_query: dict[str, dict[str, Any]] = {}
    for r in rows:
        q = r.get("queryItem")
        idx = r.get("queryIndex")
        if q is None and isinstance(idx, int) and 0 <= idx < len(identifiers):
            q = identifiers[idx]
        if q is not None and r.get("stringId"):
            by_query.setdefault(str(q), r)
    found = [i for i in identifiers if i in by_query]
    missing = [i for i in identifiers if i not in by_query]
    query: dict[str, str] = {}
    for name in found:
        r = by_query[name]
        query.setdefault(str(r["stringId"]), _clean(str(r.get("preferredName") or name)))
    notes = []
    if found and missing:
        notes.append(f"Not found in STRING: {_sample(missing)}.")
    renamed = [
        f"{n} as {by_query[n]['preferredName']}"
        for n in found
        if by_query[n].get("preferredName")
        and str(by_query[n]["preferredName"]).lower() != n.lower()
    ]
    if renamed:
        notes.append(f"Matched {_sample(renamed)}.")
    taxon = str(by_query[found[0]].get("taxonName") or "") or None if found else None
    return query, taxon, notes


def build_string(
    rows: list[dict[str, Any]],
    query: dict[str, str],
    fields: list[str],
    threshold: float,
    edge_mode: str = "channels",
) -> tuple[list[Interaction], dict[str, str], list[str]]:
    """STRING network rows -> (interactions, {stringId: node name} of the connected
    proteins, notes). With fewer than all channels ticked each pair's confidence
    is recomputed from those channels alone, and pairs below `threshold` drop."""
    name_of: dict[str, str] = {}
    used: set[str] = set()

    def node(sid: str, preferred: Any) -> str:
        if sid not in name_of:
            name = _clean(str(preferred or "")) or sid
            if name in used:  # two STRING ids with one preferred name
                name = f"{name} ({sid})"
            used.add(name)
            name_of[sid] = name
        return name_of[sid]

    for sid, preferred in query.items():
        node(sid, preferred)
    all_channels = len(fields) == len(STRING_CHANNELS)
    out: list[Interaction] = []
    seen: set[tuple[str, str]] = set()
    dropped = 0
    for r in rows:
        # older answers / tests carry names only — the name then stands in for the id
        a = str(r.get("stringId_A") or r.get("preferredName_A") or "")
        b = str(r.get("stringId_B") or r.get("preferredName_B") or "")
        if not a or not b or a == b or (min(a, b), max(a, b)) in seen:
            continue  # STRING may list a pair in both directions
        seen.add((min(a, b), max(a, b)))
        scores = [_score(r.get(f)) for f in fields]
        combined = _score(r.get("score")) if all_channels else combine_string_scores(scores)
        if combined < threshold - 1e-9:
            dropped += 1
            continue
        if edge_mode != "combined" and not any(scores):
            continue
        na, nb = node(a, r.get("preferredName_A")), node(b, r.get("preferredName_B"))
        src, trg = min(na, nb), max(na, nb)
        if edge_mode == "combined":
            out.append(Interaction(src, trg, round(combined, 3)))
        else:
            out.extend(
                Interaction(src, trg, s, STRING_CHANNELS[f])
                for f, s in zip(fields, scores, strict=True)
                if s > 0
            )
    notes = []
    if dropped:
        notes.append(
            f"Left out {dropped} connection{'' if dropped == 1 else 's'} whose score from "
            f"the ticked channels alone is below {threshold:.2f}."
        )
    connected = {n for i in out for n in (i.source, i.target)}
    lonely = [n for sid, n in name_of.items() if sid in query and n not in connected]
    if lonely and out:
        notes.append(f"No connection passes the filters for {_sample(lonely)}; not shown.")
    return out, {sid: n for sid, n in name_of.items() if n in connected}, notes


def _category_key(raw: Any) -> str:
    if not raw:
        return "Other"
    key = str(raw)
    if key in STRING_CATEGORIES:
        return key
    return _CATEGORY_ALIASES.get(key.lower(), key)


def _as_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(v) for v in value]
    return [v for v in str(value or "").split(",") if v]


def string_groupings(
    rows: list[dict[str, Any]],
    by_id: dict[str, str],
    by_name: dict[str, str],
    opts: StringGroupingOptions,
) -> list[StringGrouping]:
    """enrichment / functional_annotation rows -> one grouping per term
    collection: the top `max_terms` terms with at least `min_group` nodes.
    Members map back to node names by STRING id, then by name (any case)."""
    enrichment = opts.mode == "enrichment"
    wanted = set(opts.categories)
    by_cat: dict[str, list[StringTerm]] = {}
    for r in rows:
        cat = _category_key(r.get("category"))
        if not (cat in wanted or (cat not in STRING_CATEGORIES and opts.other_categories)):
            continue
        fdr = _number(r.get("fdr"))
        if enrichment and not (fdr is not None and fdr <= opts.fdr):
            continue
        inputs, preferred = _as_list(r.get("inputGenes")), _as_list(r.get("preferredNames"))
        members: list[str] = []
        for i, gene in enumerate(inputs):
            pref = preferred[i] if i < len(preferred) else gene
            name = by_id.get(gene) or by_name.get(pref.lower()) or by_name.get(gene.lower())
            if name and name not in members:
                members.append(name)
        if len(members) < opts.min_group:
            continue
        term = _clean(str(r.get("term") or ""))
        by_cat.setdefault(cat, []).append(
            StringTerm(
                term=term,
                description=_clean(str(r.get("description") or "")) or term,
                members=members,
                fdr=fdr if enrichment else None,
                p_value=_number(r.get("p_value")) if enrichment else None,
            )
        )
    order = [k for k in STRING_CATEGORIES if k in by_cat]
    order += [k for k in by_cat if k not in STRING_CATEGORIES]
    out = []
    for cat in order:
        terms = by_cat[cat]
        if enrichment:
            terms.sort(key=lambda t: (t.fdr if t.fdr is not None else 1.0, -len(t.members)))
        else:
            terms.sort(key=lambda t: -len(t.members))
        top = terms[: opts.max_terms]
        used: set[str] = set()
        for t in top:  # group names must be unique within a collection
            if t.description in used:
                t.description = f"{t.description} ({t.term})"
            used.add(t.description)
        out.append(StringGrouping(category=cat, name=STRING_CATEGORIES.get(cat, cat), terms=top))
    return out


def fetch_string(
    identifiers: list[str],
    species: int,
    required_score: float,
    channels: list[str] | None = None,
    add_nodes: int = 0,
    network_type: str = "functional",
) -> list[Interaction]:
    """One row per (pair, evidence channel) with a non-zero score in that channel,
    straight from the typed names (no id lookup)."""
    fields = _string_fields(channels)
    params: dict[str, Any] = {
        "identifiers": "\r".join(identifiers),
        "species": species,
        "required_score": round(required_score * 1000),
        "network_type": network_type,
    }
    if add_nodes:
        params["add_nodes"] = add_nodes
    rows = _StringClient(None)("network", params)
    return build_string(rows, {}, fields, 0.0)[0]


def string_combined(
    identifiers: list[str],
    species: int,
    required_score: float,
    call: _StringClient | None = None,
) -> list[Interaction]:
    """STRING as a single channel-less layer (combined score), for per-database mode."""
    rows = (call or _StringClient(None))(
        "network",
        {
            "identifiers": "\r".join(identifiers),
            "species": species,
            "required_score": round(required_score * 1000),
        },
    )
    pairs: dict[tuple[str, str], float] = {}
    for r in rows:
        a, b = _clean(r.get("preferredName_A", "")), _clean(r.get("preferredName_B", ""))
        if a and b and a != b:
            pairs[(min(a, b), max(a, b))] = _score(r.get("score"))
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


def _mitab_ids(*fields: str) -> set[str]:
    """Every identifier in PSI-MITAB id/alt-id columns, without its database
    prefix, in capitals (P04637, EBI-366083, ...)."""
    return {
        item.split(":", 1)[-1].replace('"', "").upper()
        for field in fields
        for item in field.split("|")
        if item and item != "-"
    }


def fetch_intact(
    identifiers: list[str],
    species: int,
    min_score: float = 0.0,
    max_rows: int = 2000,
    only_among: bool = False,
) -> tuple[list[Interaction], int]:
    """IntAct via PSICQUIC (tab25); weight = best IntAct MI-score per pair.
    With `only_among`, only interactions between two of the proteins (matched by
    gene name or any identifier, e.g. UniProt). Also returns how many
    interactions with other partners were left out."""
    ids = " OR ".join(f'"{i}"' if any(c in i for c in " ():") else i for i in identifiers)
    miql = f"identifier:({ids}) AND taxidA:{species} AND taxidB:{species}"
    text = _get(
        f"{config.INTACT_PSICQUIC}/query/{urllib.parse.quote(miql, safe='')}",
        {"format": "tab25", "firstResult": "0", "maxResults": str(max_rows)},
        accept="text/plain",
    )
    wanted = {i.upper() for i in identifiers}
    best: dict[tuple[str, str], float] = {}
    left_out = 0
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
        if only_among and not (
            ({a.upper()} | _mitab_ids(c[0], c[2])) & wanted
            and ({b.upper()} | _mitab_ids(c[1], c[3])) & wanted
        ):
            left_out += 1
            continue
        key = (min(a, b), max(a, b))
        best[key] = max(best.get(key, 0.0), score)
    return [Interaction(a, b, s) for (a, b), s in best.items()], left_out


# ---------------------------------------------------------------- OmniPath
# OmniPath answers for these organisms only (other taxa get an error text)
OMNIPATH_SPECIES = {9606: "human", 10090: "mouse", 10116: "rat"}
_UNIPROT = re.compile(
    r"^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})(-\d+)?$"
)


def _omnipath_name(name: str, species: int) -> str:
    """OmniPath matches gene symbols case-sensitively: TP53 (human), Trp53
    (mouse, rat); UniProt accessions in capitals."""
    if _UNIPROT.match(name.upper()):
        return name.upper()
    return name.upper() if species == 9606 else name[:1].upper() + name[1:].lower()


def fetch_omnipath(
    identifiers: list[str], species: int, only_among: bool = False
) -> tuple[list[Interaction], int]:
    """OmniPath interactions of the proteins (gene symbols or UniProt IDs);
    weight = curation effort. With `only_among`, only those between two of the
    proteins. Also returns how many interactions with other partners were left
    out, so an empty answer can say why."""
    if species not in OMNIPATH_SPECIES:
        raise DatabaseError("OmniPath covers human, mouse and rat only.")
    query = [_omnipath_name(i, species) for i in identifiers]
    body = _get(
        f"{config.OMNIPATH_API}/interactions",
        {
            "partners": ",".join(query),
            "genesymbols": "yes",
            "organisms": str(species),
            "fields": "curation_effort",
            "format": "json",
        },
    )
    try:
        rows = json.loads(body or "[]")
    except json.JSONDecodeError as e:
        raise UpstreamError(f"OmniPath sent an unreadable answer: {body[:120]}") from e
    if not isinstance(rows, list):
        raise UpstreamError("OmniPath sent an answer of an unexpected shape.")
    wanted = {q.upper() for q in query}
    best: dict[tuple[str, str], float] = {}
    left_out = 0
    for r in rows:
        if not isinstance(r, dict):  # OmniPath reports problems as [["text"]]
            continue
        a = _clean(r.get("source_genesymbol") or r.get("source", ""))
        b = _clean(r.get("target_genesymbol") or r.get("target", ""))
        if not a or not b or a == b:
            continue
        if only_among and not (
            {a.upper(), str(r.get("source", "")).upper()} & wanted
            and {b.upper(), str(r.get("target", "")).upper()} & wanted
        ):
            left_out += 1
            continue
        key = (min(a, b), max(a, b))
        best[key] = max(best.get(key, 0.0), float(r.get("curation_effort") or 1))
    return [Interaction(a, b, w) for (a, b), w in best.items()], left_out


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
    channels: list[str] | None = None,
    add_nodes: int = 0,
    *,
    network_type: str = "functional",
    edge_mode: str = "channels",
    descriptions: bool = False,
    groupings: StringGroupingOptions | None = None,
    address: str | None = None,
    raw: StringRaw | None = None,
) -> StringImportResponse:
    """NORMA's STRING import: look the names up, fetch the network (plus up to
    `add_nodes` interactors), keep the ticked evidence channels, then optionally
    fetch protein descriptions and term collections (groupings).

    With `raw` the browser has already fetched STRING's answers (Connect:
    Directly) and nothing is fetched here.
    """
    fields = _string_fields(channels)
    # checked even when the browser fetched (raw): the address is echoed
    # into every node's STRING link
    string_api(address)
    site = (address or STRING_SITE).rstrip("/")
    client = None if raw else _StringClient(address)
    notes: list[str] = []

    def ask(
        method: str, params: dict[str, Any], given: list[dict[str, Any]] | None
    ) -> list[dict[str, Any]]:
        """STRING's answer: the browser's copy when it sent one, else a fresh call."""
        if client is None:
            return given or []
        return client(method, params)

    try:
        version_rows = ask("version", {}, raw.version if raw else None)
    except (DatabaseError, UpstreamError):
        version_rows = []  # the version is only a note
    version = str(version_rows[0].get("string_version") or "") or None if version_rows else None

    ids_rows = ask(
        "get_string_ids",
        {"identifiers": "\r".join(identifiers), "species": species, "echo_query": 1, "limit": 1},
        raw.ids if raw else None,
    )
    query, taxon, lookup_notes = resolve_string_ids(ids_rows, identifiers)
    if not query:
        raise DatabaseError(
            f"STRING found none of the names for taxon {species}. "
            "Check the spelling and the organism."
        )
    notes += lookup_notes

    params: dict[str, Any] = {
        "identifiers": "\r".join(query),
        "species": species,
        "required_score": round(required_score * 1000),
        "network_type": network_type,
    }
    if add_nodes:
        params["add_nodes"] = add_nodes
    rows = ask("network", params, raw.network if raw else None)
    interactions, name_of, build_notes = build_string(
        rows, query, fields, required_score, edge_mode
    )
    if not interactions:
        raise DatabaseError(
            f"No {network_type} connections pass a confidence of {required_score:.2f} "
            "with the ticked channels. Lower the confidence, tick more channels or "
            "add interactors."
        )
    notes += build_notes
    of_network = {"identifiers": "\r".join(name_of), "species": species}

    described: dict[str, str] = {}
    if descriptions:
        try:
            info = ask("get_string_ids", of_network, raw.info if raw else None)
            described = {
                str(r.get("stringId")): _clean(str(r["annotation"]))
                for r in info
                if r.get("annotation") and str(r["annotation"]).strip() not in ("", "-")
            }
        except (DatabaseError, UpstreamError) as e:
            notes.append(f"Protein descriptions couldn't be fetched: {e}")

    groups: list[StringGrouping] = []
    if groupings:
        method = "enrichment" if groupings.mode == "enrichment" else "functional_annotation"
        try:
            terms = ask(method, of_network, raw.terms if raw else None)
            groups = string_groupings(
                terms, name_of, {n.lower(): n for n in name_of.values()}, groupings
            )
            if not groups:
                notes.append("No term collection has groups that pass the filters.")
        except (DatabaseError, UpstreamError) as e:
            notes.append(f"Groupings couldn't be fetched: {e}")

    net = rows_to_network({"STRING": interactions}, couple=False)
    return StringImportResponse(
        **net.model_dump(exclude={"warnings"}),
        warnings=[*net.warnings, *notes],
        string_version=version,
        taxon_name=taxon,
        node_info=[
            StringNodeInfo(
                name=name,
                string_id=sid,
                description=described.get(sid),
                url=f"{site}/network/{urllib.parse.quote(sid)}",
                query=sid in query,
            )
            for sid, name in name_of.items()
        ],
        groupings=groups,
    )


def string_groupings_for(
    identifiers: list[str],
    species: int,
    opts: StringGroupingOptions,
    address: str | None = None,
    raw_terms: list[dict[str, Any]] | None = None,
) -> StringGroupingsResponse:
    """Groupings for the network on screen: its node names go to STRING as they are."""
    if raw_terms is None:
        method = "enrichment" if opts.mode == "enrichment" else "functional_annotation"
        raw_terms = _StringClient(address)(
            method, {"identifiers": "\r".join(identifiers), "species": species}
        )
    groups = string_groupings(raw_terms, {}, {i.lower(): i for i in identifiers}, opts)
    warnings = [] if groups else ["No term collection has groups that pass the filters."]
    return StringGroupingsResponse(groupings=groups, warnings=warnings)


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
    notes: list[str] = []
    if only_among and len(identifiers) < 2:
        # one protein has nothing "among" itself: its partners are the network
        only_among = False
        notes.append("With one protein its interaction partners are included.")
    # STRING answers among the query; IntAct and OmniPath return partners too
    # and keep only those among the proteins when asked (comparable layers)
    left_out: dict[str, int] = {}

    def partners(name: str, found: tuple[list[Interaction], int]) -> list[Interaction]:
        rows, left_out[name] = found
        return rows

    fetch = {
        "STRING": lambda: string_combined(identifiers, species, required_score),
        "IntAct": lambda: partners(
            "IntAct",
            fetch_intact(identifiers, species, min_score=required_score, only_among=only_among),
        ),
        "OmniPath": lambda: partners("OmniPath", fetch_omnipath(identifiers, species, only_among)),
    }
    layers = {db: fetch[db]() for db in databases}
    only = databases[0] if len(databases) == 1 else ""
    if only and not layers[only] and left_out.get(only):
        raise DatabaseError(
            f"{only} has {left_out[only]} interactions of these proteins with other "
            "partners, but none among them. Untick “Only interactions among these "
            "proteins” to include the partners."
        )
    net = rows_to_network(layers, couple=True)
    empty = [db for db in databases if not layers[db]]
    if empty:
        notes.append(f"No interactions from: {', '.join(empty)}")
    net.warnings.extend(notes)
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
    call = _StringClient(None, budget)
    for name, genes in sets:
        if budget:
            budget.check()
        if len(genes) < 2:
            notes.append(f"{name}: fewer than two genes, left out.")
            continue
        wanted = {g.upper() for g in genes}
        rows = string_combined(genes, species, required_score, call)
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
