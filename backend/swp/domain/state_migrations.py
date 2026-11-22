"""Upcasters for stored JSON documents (AD-4, NFR-12).

Each stored kind (`state`, `analysis`, `data`) carries a `schema_version`. An upcaster
turns version N into N + 1; the chains are append-only. A document without
`schema_version` is version 1; a version newer than this code knows raises ValueError.
"""

from collections.abc import Callable, Mapping
from typing import Any, Literal

type Doc = dict[str, Any]
type Upcaster = Callable[[Doc], Doc]
Kind = Literal["state", "analysis", "data"]

CURRENT_VERSIONS: Mapping[Kind, int] = {"state": 2, "analysis": 1, "data": 2}


def _data_v1_to_v2(doc: Doc) -> Doc:
    """Data v2 stores the import's virtual locations; an older import knows none (FR-33)."""
    return {**doc, "virtual_locations": []}


def _state_v1_to_v2(doc: Doc) -> Doc:
    """State v2 stores outdated recommendations with their cause and the rule 3 partner
    (and the "no space" partner aisle); every new field defaults, so a v1 state needs no
    change: its rule 3 entries simply have no partner (FR-28, FR-29)."""
    return dict(doc)


# UPCASTERS[kind][i] upcasts version i + 1 to i + 2. Append only; never edit an entry.
UPCASTERS: Mapping[Kind, tuple[Upcaster, ...]] = {
    "state": (_state_v1_to_v2,),
    "analysis": (),
    "data": (_data_v1_to_v2,),
}


def upcast(kind: Kind, doc: Mapping[str, Any]) -> Doc:
    """Return `doc` upcast to the current version of `kind` (a new dict)."""
    current = CURRENT_VERSIONS[kind]
    result: Doc = dict(doc)
    version = result.get("schema_version", 1)
    if not isinstance(version, int) or version < 1:
        raise ValueError(f"Invalid {kind} schema_version: {version!r}")
    if version > current:
        raise ValueError(f"{kind} schema_version {version} is newer than {current}")
    chain = UPCASTERS[kind]
    while version < current:
        result = chain[version - 1](result)
        version += 1
        result["schema_version"] = version
    result["schema_version"] = current
    return result
