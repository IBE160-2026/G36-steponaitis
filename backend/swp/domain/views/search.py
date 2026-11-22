"""The search behind GET /api/plans/{id}/search?q= (FR-15, AD-3, AD-14).

Pure: one planning copy per request; it never writes. Matches part numbers, part
descriptions and location codes as partial text with `str.casefold`. Parts and locations
come back as separate lists in rule order, each capped at `SEARCH_LIMIT`; the counts are the
uncapped totals.
"""

from pydantic import BaseModel

from swp.domain.analysis import Analysis, MovementClass
from swp.domain.import_data import ImportData
from swp.domain.ordering import location_order, part_order
from swp.domain.planning import LocationRef, location_ref, planning_copy
from swp.domain.state import PlanState

SEARCH_LIMIT = 20


class PartMatch(BaseModel):
    part: str
    description: str
    movement_class: MovementClass


class LocationMatch(BaseModel):
    location: LocationRef


class SearchView(BaseModel):
    version: int
    query: str
    parts: list[PartMatch]
    part_count: int
    locations: list[LocationMatch]
    location_count: int


def build_search_view(
    data: ImportData, analysis: Analysis, state: PlanState, version: int, query: str
) -> SearchView:
    """The parts and locations whose text contains the stripped `query`, case-insensitive.
    A blank query matches nothing."""
    needle = query.strip().casefold()
    if not needle:
        return SearchView(
            version=version, query=query, parts=[], part_count=0, locations=[], location_count=0
        )
    copy = planning_copy(data, state)
    marks = state.best_marks
    classified = {part: analysis.parts[part] for part in data.parts if part in analysis.parts}
    parts = [
        part
        for part in part_order(classified)
        if needle in part.casefold() or needle in data.parts[part].casefold()
    ]
    locations = [code for code in location_order(copy.locations) if needle in code.casefold()]
    return SearchView(
        version=version,
        query=query,
        parts=[
            PartMatch(
                part=part,
                description=data.parts[part],
                movement_class=classified[part].movement_class,
            )
            for part in parts[:SEARCH_LIMIT]
        ],
        part_count=len(parts),
        locations=[
            LocationMatch(location=location_ref(copy, code, marks))
            for code in locations[:SEARCH_LIMIT]
        ],
        location_count=len(locations),
    )
