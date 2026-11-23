"""The wall view of one aisle behind GET /api/plans/{id}/wall?aisle= and the whole-warehouse
view behind GET /api/plans/{id}/warehouse (FR-42, FR-14, FR-22, AD-3, AD-14, AD-15).

Pure and plan-scoped: one planning copy per request, every cell and every count built from
it; it never writes. The frontend joins `locations` to the import's wall layout by code and
never computes occupancy, best or counts itself.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel

from swp.domain.analysis import Analysis, MovementClass, PartAnalysis
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.ordering import aisle_order, level_key, location_order, part_order
from swp.domain.planning import (
    EffectiveMove,
    LocationRef,
    PlanningCopy,
    covering_marks,
    current_round,
    is_best,
    is_occupied,
    latest_run,
    location_ref,
    recommendation_status,
    replay,
)
from swp.domain.state import AisleMark, BestMark, LevelMark, PlanState, Recommendation, Rule
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
    """The number of wall move entries touching the aisle: latest-run recommendations plus
    current-round manual moves (the same entries its wall's `moves` lists)."""
    aisle_marked: bool


WallMoveKind = Literal["recommendation", "manual"]

WallMoveStatus = Literal["open", "kept", "applied", "outdated", "manual"]
"""A recommendation's derived status (`recommendation_status`), or `manual` for a manual
effective move."""


class WallMove(BaseModel):
    """One move touching the open aisle (AD-3, AD-7, AD-14): a latest-run recommendation
    (any status) or a current-round manual effective move (FR-34). `number` is the
    recommendation's server number, `move_number` the effective move's number when applied
    or manual. An applied recommendation keeps its own rule; its `to_location` is where the
    effective move ends (the applied step's when moved back)."""

    kind: WallMoveKind
    recommendation_id: str | None
    number: int | None
    move_number: int | None
    rule: Rule
    part: str
    description: str
    movement_class: MovementClass
    picks: int
    from_location: LocationRef
    to_location: LocationRef
    status: WallMoveStatus


class WallView(BaseModel):
    version: int
    aisle: str
    round: int
    locations: list[WallLocation]
    rail_levels: list[str]
    moves: list[WallMove]
    aisles: list[AisleCounts]
    warehouse: WarehouseCounts


class WarehouseLocation(BaseModel):
    """One location of the whole-warehouse mini-walls: occupancy and the top part's class
    (None when empty). Kept compact so a 25,000-location import stays under 4 MB."""

    code: str
    occupied: bool
    movement_class: MovementClass | None


class WarehouseRun(BaseModel):
    """The latest run: its round and its number of recommendations."""

    round: int
    recommendations: int


class WarehouseView(BaseModel):
    """The whole warehouse as the plan is now (FR-42, AD-3, AD-15): every location in
    `location_order` with its occupancy and top class, every wall move entry of all aisles in
    wall order, the latest run (None before any run), and the same per-aisle and warehouse
    counts as the wall view, all from one replay at `version`."""

    version: int
    round: int
    run: WarehouseRun | None
    locations: list[WarehouseLocation]
    moves: list[WallMove]
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


@dataclass(frozen=True)
class _MoveEntry:
    """A move entry before it is put on the wire: its source and the codes it touches."""

    rec: Recommendation | None
    move_number: int | None
    rule: Rule
    part: str
    status: WallMoveStatus
    from_location: str
    to_location: str
    aisles: frozenset[str]


def _move_entries(
    copy: PlanningCopy, state: PlanState, moves: Sequence[EffectiveMove]
) -> list[_MoveEntry]:
    """Every move entry of the plan, in wall order: the latest run's recommendations in
    stored order, then the current round's manual effective moves (no recommendation id)
    by move number. Each knows the aisles its from- and to-location are in."""

    def aisles(*codes: str) -> frozenset[str]:
        return frozenset(copy.locations[code].aisle for code in codes if code in copy.locations)

    entries: list[_MoveEntry] = []
    latest = latest_run(state)
    for rec in latest.recommendations if latest is not None else []:
        derived = recommendation_status(state, moves, rec)
        if derived.move is not None:
            to_location = derived.move.to_location
        elif derived.step is not None:
            to_location = derived.step.to_location
        else:
            to_location = rec.to_location
        entries.append(
            _MoveEntry(
                rec=rec,
                move_number=derived.move.move_number if derived.move is not None else None,
                rule=rec.rule,
                part=rec.part,
                status=derived.status,
                from_location=rec.from_location,
                to_location=to_location,
                aisles=aisles(rec.from_location, to_location),
            )
        )
    round_ = current_round(state)
    manual = [m for m in moves if m.recommendation_id is None and m.round == round_]
    for move in sorted(manual, key=lambda m: m.move_number):
        entries.append(
            _MoveEntry(
                rec=None,
                move_number=move.move_number,
                rule=move.rule,
                part=move.part,
                status="manual",
                from_location=move.from_location,
                to_location=move.to_location,
                aisles=aisles(move.from_location, move.to_location),
            )
        )
    return entries


def _moves_per_aisle(entries: Sequence[_MoveEntry]) -> dict[str, int]:
    """Per aisle, the number of move entries touching it (the tab's "N moves")."""
    counts: dict[str, int] = {}
    for entry in entries:
        for aisle in entry.aisles:
            counts[aisle] = counts.get(aisle, 0) + 1
    return counts


def _wall_move(
    data: ImportData, analysis: Analysis, state: PlanState, copy: PlanningCopy, entry: _MoveEntry
) -> WallMove:
    rec = entry.rec
    facts = analysis.parts.get(entry.part, _UNCLASSIFIED)
    marks = state.best_marks
    return WallMove(
        kind="recommendation" if rec is not None else "manual",
        recommendation_id=rec.id if rec is not None else None,
        number=rec.number if rec is not None else None,
        move_number=entry.move_number,
        rule=entry.rule,
        part=entry.part,
        description=data.parts.get(entry.part, ""),
        movement_class=facts.movement_class,
        picks=facts.picks,
        from_location=location_ref(copy, entry.from_location, marks),
        to_location=location_ref(copy, entry.to_location, marks),
        status=entry.status,
    )


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


def _aisle_counts(
    facts: dict[str, _Fact], entries: Sequence[_MoveEntry], marks: Sequence[BestMark]
) -> tuple[list[AisleCounts], WarehouseCounts]:
    """Per-aisle counts in aisle order, and the warehouse counts, from one replay's facts."""
    moves = _moves_per_aisle(entries)
    aisles = [
        AisleCounts(
            aisle=name,
            moves=moves.get(name, 0),
            aisle_marked=any(isinstance(m, AisleMark) and m.aisle == name for m in marks),
            **_counts([fact for fact in facts.values() if fact.aisle == name]).model_dump(),
        )
        for name in aisle_order(fact.aisle for fact in facts.values())
    ]
    return aisles, _counts(list(facts.values()))


def _facts(copy: PlanningCopy, codes: Sequence[str], marks: Sequence[BestMark]) -> dict[str, _Fact]:
    return {
        code: _Fact(
            aisle=copy.locations[code].aisle,
            occupied=is_occupied(copy, code),
            best=is_best(copy, code, marks),
        )
        for code in codes
    }


def _top_class(analysis: Analysis, copy: PlanningCopy, code: str) -> MovementClass | None:
    """The class of the top part (`part_order` first) of the stock at `code`, or None."""
    stocked = [part for part, stock in copy.contents_of(code).items() if stock > 0]
    if not stocked:
        return None
    entries = {part: analysis.parts.get(part, _UNCLASSIFIED) for part in stocked}
    return entries[part_order(entries)[0]].movement_class


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
    replayed = replay(data, state.steps)
    copy = replayed.copy
    if not any(location.aisle == aisle for location in copy.locations.values()):
        raise DomainError("not_found", AISLE_NOT_FOUND)
    marks = state.best_marks
    codes = location_order(copy.locations)
    facts = _facts(copy, codes, marks)
    entries = _move_entries(copy, state, replayed.moves)
    aisles, warehouse = _aisle_counts(facts, entries, marks)
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
        round=current_round(state),
        locations=rows,
        rail_levels=_rail_levels(aisle_levels, aisle, marks),
        moves=[
            _wall_move(data, analysis, state, copy, entry)
            for entry in entries
            if aisle in entry.aisles
        ],
        aisles=aisles,
        warehouse=warehouse,
    )


def build_warehouse_view(
    data: ImportData, analysis: Analysis, state: PlanState, version: int
) -> WarehouseView:
    """Every location's occupancy and top class, every wall move entry (all aisles, in wall
    order) and the same per-aisle and warehouse counts as the wall view, from one replay."""
    replayed = replay(data, state.steps)
    copy = replayed.copy
    marks = state.best_marks
    codes = location_order(copy.locations)
    facts = _facts(copy, codes, marks)
    entries = _move_entries(copy, state, replayed.moves)
    aisles, warehouse = _aisle_counts(facts, entries, marks)
    latest = latest_run(state)
    return WarehouseView(
        version=version,
        round=current_round(state),
        run=(
            WarehouseRun(round=latest.round, recommendations=len(latest.recommendations))
            if latest is not None
            else None
        ),
        locations=[
            WarehouseLocation(
                code=code,
                occupied=facts[code].occupied,
                movement_class=_top_class(analysis, copy, code) if facts[code].occupied else None,
            )
            for code in codes
        ],
        moves=[_wall_move(data, analysis, state, copy, entry) for entry in entries],
        aisles=aisles,
        warehouse=warehouse,
    )
