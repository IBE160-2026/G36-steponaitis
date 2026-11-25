"""The wall layout of an import behind GET /api/imports/{import_id}/layout (FR-42, AD-15).

Pure and import-scoped: no plan state, marks, occupancy or version. Every location of the
Locations file is exactly one non-gap cell; virtual locations are never on the wall. The
frontend never parses codes or derives cells: it draws these logical cells.

The source of an aisle's layout is decided per aisle, in this order:

1. `columns`: every location has Section and Position, and no two share
   (section, level, position);
2. `code`: every code is `<aisle>-<section>-<x>-<position>` (4 non-empty parts, part 0 the
   Aisle value) and (section, Level, position) is unique; the level is always the Level column;
3. `walk_path`: one run, one row per level holding its locations in Walk Path order.

A `columns` or `code` source is also unusable when its grid (levels x columns over the runs)
would hold more than twice the aisle's locations: a sparse grid falls to the next source, so
gap cells stay bounded by the location count.

With sections, the first ceil(n/2) sections (`identifier_key` order) are run 0 (top) and the
rest run 1. A section is as wide as its distinct positions across the aisle's levels; a
(section, level, position) with no location is a gap cell. Every run has one row per level of
the aisle, highest level first (`level_key` over the whole import).
"""

from collections import defaultdict
from collections.abc import Iterable, Mapping
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel

from swp.domain.import_data import ImportData, LocationData
from swp.domain.ordering import SortKey, aisle_order, identifier_key, level_key
from swp.domain.planning import LocationRef, location_ref_of
from swp.domain.values import Dec

LayoutSource = Literal["columns", "code", "walk_path"]


class LayoutCell(BaseModel):
    """One logical cell: a location, or a gap (`location` null) where a section has none."""

    run: int
    row: int
    column: int
    gap: bool
    location: LocationRef | None


class SectionSpan(BaseModel):
    """A section label over `columns` columns of a run, from `first_column`."""

    section: str
    first_column: int
    columns: int


class LayoutRun(BaseModel):
    """One run of an aisle: its levels top to bottom (row 0 first), width and sections."""

    levels: list[str]
    columns: int
    sections: list[SectionSpan]


class AisleLayout(BaseModel):
    aisle: str
    source: LayoutSource
    walk_path_first: Dec
    walk_path_last: Dec
    runs: list[LayoutRun]
    cells: list[LayoutCell]


class LayoutView(BaseModel):
    aisles: list[AisleLayout]


Places = dict[str, tuple[str, str]]
"""Code -> (section, position) of every location of an aisle."""


MAX_GRID_PER_LOCATION = 2
"""A sectioned grid may hold at most this many cells per location of the aisle."""


def _usable(places: Places, locations: Mapping[str, LocationData]) -> bool:
    """No two locations share (section, level, position), and the grid is not sparse: levels x
    (each section's distinct positions, summed) is at most `MAX_GRID_PER_LOCATION` per
    location. Every run has every level, so that product is the grid over the runs."""
    cells = {
        (section, locations[code].level, position) for code, (section, position) in places.items()
    }
    if len(cells) != len(places):
        return False
    levels = {locations[code].level for code in places}
    columns = len(set(places.values()))
    return len(levels) * columns <= MAX_GRID_PER_LOCATION * len(places)


def _from_columns(codes: Iterable[str], locations: Mapping[str, LocationData]) -> Places | None:
    places: Places = {}
    for code in codes:
        location = locations[code]
        if location.section is None or location.position is None:
            return None
        places[code] = (location.section, location.position)
    return places if _usable(places, locations) else None


def _from_code(
    aisle: str, codes: Iterable[str], locations: Mapping[str, LocationData]
) -> Places | None:
    places: Places = {}
    for code in codes:
        parts = code.split("-")
        if len(parts) != 4 or not all(parts) or parts[0] != aisle:
            return None
        places[code] = (parts[1], parts[3])
    return places if _usable(places, locations) else None


def _sectioned(
    codes: list[str],
    places: Places,
    levels: list[str],
    locations: Mapping[str, LocationData],
    section_key: SortKey,
    position_key: SortKey,
) -> tuple[list[LayoutRun], list[LayoutCell]]:
    positions: dict[str, set[str]] = defaultdict(set)
    at: dict[tuple[str, str, str], str] = {}
    for code in codes:
        section, position = places[code]
        positions[section].add(position)
        at[(section, locations[code].level, position)] = code
    sections = sorted(positions, key=section_key)
    top = (len(sections) + 1) // 2
    runs: list[LayoutRun] = []
    cells: list[LayoutCell] = []
    for run, run_sections in enumerate(part for part in (sections[:top], sections[top:]) if part):
        column = 0
        spans: list[SectionSpan] = []
        for section in run_sections:
            ordered = sorted(positions[section], key=position_key)
            spans.append(SectionSpan(section=section, first_column=column, columns=len(ordered)))
            for row, level in enumerate(levels):
                for offset, position in enumerate(ordered):
                    code = at.get((section, level, position))
                    cells.append(
                        LayoutCell(
                            run=run,
                            row=row,
                            column=column + offset,
                            gap=code is None,
                            location=None
                            if code is None
                            else location_ref_of(code, locations[code]),
                        )
                    )
            column += len(ordered)
        runs.append(LayoutRun(levels=levels, columns=column, sections=spans))
    return runs, cells


def _by_walk_path(
    codes: list[str], levels: list[str], locations: Mapping[str, LocationData]
) -> tuple[list[LayoutRun], list[LayoutCell]]:
    cells: list[LayoutCell] = []
    width = 0
    for row, level in enumerate(levels):
        in_level = sorted(
            (code for code in codes if locations[code].level == level),
            key=lambda code: (locations[code].walk_path, code),
        )
        width = max(width, len(in_level))
        cells.extend(
            LayoutCell(
                run=0,
                row=row,
                column=column,
                gap=False,
                location=location_ref_of(code, locations[code]),
            )
            for column, code in enumerate(in_level)
        )
    return [LayoutRun(levels=levels, columns=width, sections=[])], cells


def build_layout(data: ImportData) -> LayoutView:
    """Every aisle of the import's Locations file as logical wall cells (FR-42)."""
    locations = data.locations
    by_level = level_key(location.level for location in locations.values())
    codes_by_aisle: dict[str, list[str]] = defaultdict(list)
    for code, location in locations.items():
        codes_by_aisle[location.aisle].append(code)

    aisles = aisle_order(codes_by_aisle)
    sources: dict[str, tuple[LayoutSource, Places | None]] = {}
    for aisle in aisles:
        codes = codes_by_aisle[aisle]
        columns = _from_columns(codes, locations)
        if columns is not None:
            sources[aisle] = ("columns", columns)
            continue
        from_code = _from_code(aisle, codes, locations)
        sources[aisle] = ("code", from_code) if from_code is not None else ("walk_path", None)

    # Section and Position values sort numerically when every value of that kind on the
    # wall is all-digit (`identifier_key` over the import), else in `str` order.
    placed = [place for _, places in sources.values() if places for place in places.values()]
    section_key = identifier_key(section for section, _ in placed)
    position_key = identifier_key(position for _, position in placed)

    result: list[AisleLayout] = []
    for aisle in aisles:
        codes = codes_by_aisle[aisle]
        levels = sorted({locations[code].level for code in codes}, key=by_level, reverse=True)
        source, places = sources[aisle]
        if places is None:
            runs, cells = _by_walk_path(codes, levels, locations)
        else:
            runs, cells = _sectioned(codes, places, levels, locations, section_key, position_key)
        cells.sort(key=lambda cell: (cell.run, cell.row, cell.column))
        walk_paths: list[Decimal] = [locations[code].walk_path for code in codes]
        result.append(
            AisleLayout(
                aisle=aisle,
                source=source,
                walk_path_first=min(walk_paths),
                walk_path_last=max(walk_paths),
                runs=runs,
                cells=cells,
            )
        )
    return LayoutView(aisles=result)
