"""Functional enrichment of a node selection — PLAN-ROADMAP Phase 6.

Uses the STRING enrichment API (GO, KEGG, Reactome, ...), which reports the
input genes behind every term, so the frontend can highlight them directly.
"""

import json

from pydantic import BaseModel

from app import config
from app.services.databases import DatabaseError, _get

# STRING category codes; publications (PMID) and the rest are opt-in
DEFAULT_CATEGORIES = ("Process", "Function", "Component", "KEGG", "RCTM", "WikiPathways")


class EnrichedTerm(BaseModel):
    category: str  # Process, Component, Function, KEGG, RCTM, ...
    term: str
    description: str
    fdr: float
    p_value: float
    genes: list[str]  # input genes annotated with the term (STRING preferred names)


def enrich(
    genes: list[str],
    species: int,
    max_terms: int,
    categories: list[str] | None = None,
) -> list[EnrichedTerm]:
    wanted = set(categories or DEFAULT_CATEGORIES)
    body = _get(
        f"{config.STRING_API}/json/enrichment",
        {"identifiers": "\r".join(genes), "species": str(species), "caller_identity": "arena3d"},
    )
    rows = json.loads(body or "[]")
    if isinstance(rows, dict):  # STRING error payload
        raise DatabaseError(str(rows.get("ErrorMessage") or rows.get("Error") or rows))
    terms = [
        EnrichedTerm(
            category=str(r.get("category", "")),
            term=str(r.get("term", "")),
            description=str(r.get("description", "")),
            fdr=float(r.get("fdr", 1.0)),
            p_value=float(r.get("p_value", 1.0)),
            genes=[str(x) for x in r.get("preferredNames") or r.get("inputGenes") or []],
        )
        for r in rows
        if str(r.get("category", "")) in wanted
    ]
    terms.sort(key=lambda t: t.fdr)
    return terms[:max_terms]
