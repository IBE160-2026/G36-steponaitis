"""The wall view of one aisle behind GET /api/plans/{id}/wall?aisle= (FR-42, FR-14, FR-22,
AD-3, AD-14, AD-15).

Pure and plan-scoped: one planning copy per request, every cell and every count built from
it; it never writes. The frontend joins `locations` to the import's wall layout by code and
never computes occupancy, best or counts itself.
"""

from collections.abc import Sequence
from dataclasses import dataclass

from pydantic import BaseModel

from swp.domain.analysis import Analysis, MovementClass, PartAnalysis
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.ordering import aisle_order, level_key, location_order, part_order
from swp.domain.planning import (
    LocationRef,
    PlanningCopy,
    applied_step,
    covering_marks,
    is_best,
    is_occupied,
    latest_run,
    location_ref,
    planning_copy,
)
from swp.domain.state import AisleMark, BestMark, LevelMark, PlanState
from swp.domain.values import Dec
from swp.domain.views.common import occupied_percent

AISLE_NOT_FOUND = "This aisle is not in the plan."

_UNCLASSIFIED = PartAnalysis(picks=0, movement_class="dead")
"""Fallback for a stocked part without an analysis entry (never in a valid import)."""


class WallPart(BaseModel):
    part: str
    description: str
    movement_class: MovementClass
    picks: int
    stock: Dec
    kept_in_place: bool


class WallLocation(BaseModel):
    location: LocationRef
    walk_path: Dec
    occupied: bool
    parts: list[WallPart]
    top_part: WallPart | None
    covering_marks: list[BestMark]


class WarehouseCounts(BaseModel):
    locations: int
    occupied: int
    empty: int
    occupied_percent: str
    best: int
    empty_best: int


class AisleCounts(WarehouseCounts):
    aisle: str
    moves: int
    aisle_marked: bool


class WallView(BaseModel):
    version: int
    aisle: str
    locations: list[WallLocation]
    rail_levels: list[str]
    aisles: list[AisleCounts]
    warehouse: WarehouseCounts


def _parts_at(
    data: ImportData, analysis: Analysis, state: PlanState, copy: PlanningCopy, code: str
) -> list[WallPart]:
    """The parts with stock above zero at `code`, in `part_order` (most picks first)."""
    stocked = {part: stock for part, stock in copy.contents_of(code).items() if stock > 0}
    entries = {part: analysis.parts.get(part, _UNCLASSIFIED) for part in stocked}
    return [
        WallPart(
            part=part,
            description=data.parts.get(part, ""),
            movement_class=entries[part].movement_class,
            picks=entries[part].picks,
            stock=stocked[part],
            kept_in_place=part in state.keep_marks,
        )
        for part in part_order(entries)
    ]


def _moves_per_aisle(copy: PlanningCopy, state: PlanState) -> dict[str, int]:
    """Per aisle, the latest run's recommendations whose from-location or to-location (the
    applied step's when applied) is in it; empty before the first run."""
    counts: dict[str, int] = {}
    latest = latest_run(state)
    if latest is None:
        return counts
    for rec in latest.recommendations:
        step = applied_step(state, rec.id)
        to_location = step.to_location if step is not None else rec.to_location
        touched = {
            copy.locations[code].aisle
            for code in (rec.from_location, to_location)
            if code in copy.locations
        }
        for aisle in touched:
            counts[aisle] = counts.get(aisle, 0) + 1
    return counts


def _rail_levels(levels: Sequence[str], aisle: str, marks: Sequence[BestMark]) -> list[str]:
    """The levels of `aisle` (already in order) covered by an aisle or level mark."""
    if any(isinstance(mark, AisleMark) and mark.aisle == aisle for mark in marks):
        return list(levels)
    marked = {
        mark.level for mark in marks if isinstance(mark, LevelMark) and mark.aisle in (None, aisle)
    }
    return [level for level in levels if level in marked]


@dataclass(frozen=True)
class _Fact:
    """What every aisle's counts need of one location."""

    aisle: str
    occupied: bool
    best: bool


def _counts(facts: Sequence[_Fact]) -> WarehouseCounts:
    total = len(facts)
    occupied = sum(1 for fact in facts if fact.occupied)
    best = [fact for fact in facts if fact.best]
    return WarehouseCounts(
        locations=total,
        occupied=occupied,
        empty=total - occupied,
        occupied_percent=occupied_percent(occupied, total),
        best=len(best),
        empty_best=sum(1 for fact in best if not fact.occupied),
    )


def _wall_location(
    data: ImportData, analysis: Analysis, state: PlanState, copy: PlanningCopy, code: str
) -> WallLocation:
    parts = _parts_at(data, analysis, state, copy, code)
    return WallLocation(
        location=location_ref(copy, code, state.best_marks),
        walk_path=copy.locations[code].walk_path,
        occupied=is_occupied(copy, code),
        parts=parts,
        top_part=parts[0] if parts else None,
        covering_marks=covering_marks(copy, code, state.best_marks),
    )


def build_wall_view(
    data: ImportData, analysis: Analysis, state: PlanState, version: int, aisle: str
) -> WallView:
    """The wall of `aisle` as the plan is now, with per-aisle and warehouse counts; raise
    `not_found` when the import has no location in `aisle`."""
    copy = planning_copy(data, state)
    if not any(location.aisle == aisle for location in copy.locations.values()):
        raise DomainError("not_found", AISLE_NOT_FOUND)
    marks = state.best_marks
    codes = location_order(copy.locations)
    facts = {
        code: _Fact(
            aisle=copy.locations[code].aisle,
            occupied=is_occupied(copy, code),
            best=is_best(copy, code, marks),
        )
        for code in codes
    }
    moves = _moves_per_aisle(copy, state)
    aisles = [
        AisleCounts(
            aisle=name,
            moves=moves.get(name, 0),
            aisle_marked=any(isinstance(m, AisleMark) and m.aisle == name for m in marks),
            **_counts([fact for fact in facts.values() if fact.aisle == name]).model_dump(),
        )
        for name in aisle_order(fact.aisle for fact in facts.values())
    ]
    rows = [
        _wall_location(data, analysis, state, copy, code)
        for code in codes
        if facts[code].aisle == aisle
    ]
    all_levels = {location.level for location in copy.locations.values()}
    aisle_levels = sorted({row.location.level for row in rows}, key=level_key(all_levels))
    return WallView(
        version=version,
        aisle=aisle,
        locations=rows,
        rail_levels=_rail_levels(aisle_levels, aisle, marks),
        aisles=aisles,
        warehouse=_counts(list(facts.values())),
    )
