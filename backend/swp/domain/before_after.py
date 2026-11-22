"""Before/after counts per aisle and for the whole warehouse (FR-37, AD-3, AD-14).

Pure: compares the import ("before", via `planning.import_copy`) with the planning copy
("after") the caller has already replayed, so the slice never folds the step log itself.
Both sides use the current best-location marks; classes and pick groups come from
`analysis` and are never recomputed.
"""

from collections.abc import Sequence

from pydantic import BaseModel

from swp.domain.analysis import Analysis
from swp.domain.import_data import ImportData
from swp.domain.ordering import aisle_order, part_number_order
from swp.domain.planning import (
    PlanningCopy,
    aisle_of,
    current_aisle,
    current_location,
    import_copy,
    is_best,
    is_occupied,
    listed_parts,
)
from swp.domain.state import BestMark


class Count(BaseModel):
    before: int
    after: int


class AisleBeforeAfter(BaseModel):
    aisle: str
    moved_in: list[str]
    moved_out: list[str]
    fast_in_best: Count
    pick_groups_together: Count
    occupied: Count
    empty: Count


class BeforeAfterTotal(BaseModel):
    fast_in_best: Count
    pick_groups_together: Count
    occupied: Count
    empty: Count


class BeforeAfter(BaseModel):
    aisles: list[AisleBeforeAfter]
    total: BeforeAfterTotal


def _aisles_holding(copy: PlanningCopy, part: str) -> set[str]:
    """The aisles where `part` has stock above zero at some location."""
    return {aisle_of(copy, location) for location, qty in copy.stock_of(part).items() if qty > 0}


def _fast_in_best(
    copy: PlanningCopy, fast_parts: list[str], marks: Sequence[BestMark]
) -> dict[str, int]:
    """Per aisle: fast parts whose current location is best (a part counts once)."""
    counts: dict[str, int] = {}
    for part in fast_parts:
        current = current_location(copy, part)
        if current is not None and is_best(copy, current, marks):
            aisle = aisle_of(copy, current)
            counts[aisle] = counts.get(aisle, 0) + 1
    return counts


def _groups_together(copy: PlanningCopy, analysis: Analysis) -> dict[str, int]:
    """Per aisle: pick groups whose two parts' current aisles are that aisle."""
    counts: dict[str, int] = {}
    for group in analysis.pick_groups:
        aisle = current_aisle(copy, group.part_a)
        if aisle is not None and aisle == current_aisle(copy, group.part_b):
            counts[aisle] = counts.get(aisle, 0) + 1
    return counts


def _occupied(copy: PlanningCopy) -> dict[str, int]:
    counts: dict[str, int] = {}
    for code, location in copy.locations.items():
        if is_occupied(copy, code):
            counts[location.aisle] = counts.get(location.aisle, 0) + 1
    return counts


def build_before_after(
    data: ImportData, copy: PlanningCopy, analysis: Analysis, marks: Sequence[BestMark]
) -> BeforeAfter:
    """Per-aisle and total before/after counts: the import against the planning copy."""
    before = import_copy(data)
    fast = [
        p for p, entry in listed_parts(data, analysis).items() if entry.movement_class == "fast"
    ]
    parts = set(before.by_part) | set(copy.by_part)
    held_before = {part: _aisles_holding(before, part) for part in parts}
    held_after = {part: _aisles_holding(copy, part) for part in parts}
    fast_b, fast_a = _fast_in_best(before, fast, marks), _fast_in_best(copy, fast, marks)
    groups_b, groups_a = _groups_together(before, analysis), _groups_together(copy, analysis)
    occ_b, occ_a = _occupied(before), _occupied(copy)
    sizes: dict[str, int] = {}
    for location in data.locations.values():
        sizes[location.aisle] = sizes.get(location.aisle, 0) + 1

    rows = []
    for aisle in aisle_order(sizes):
        moved_in = (p for p in parts if aisle in held_after[p] and aisle not in held_before[p])
        moved_out = (p for p in parts if aisle in held_before[p] and aisle not in held_after[p])
        rows.append(
            AisleBeforeAfter(
                aisle=aisle,
                moved_in=part_number_order(moved_in),
                moved_out=part_number_order(moved_out),
                fast_in_best=Count(before=fast_b.get(aisle, 0), after=fast_a.get(aisle, 0)),
                pick_groups_together=Count(
                    before=groups_b.get(aisle, 0), after=groups_a.get(aisle, 0)
                ),
                occupied=Count(before=occ_b.get(aisle, 0), after=occ_a.get(aisle, 0)),
                empty=Count(
                    before=sizes[aisle] - occ_b.get(aisle, 0),
                    after=sizes[aisle] - occ_a.get(aisle, 0),
                ),
            )
        )

    def total(field: str) -> Count:
        counts = [getattr(row, field) for row in rows]
        return Count(before=sum(c.before for c in counts), after=sum(c.after for c in counts))

    return BeforeAfter(
        aisles=rows,
        total=BeforeAfterTotal(
            fast_in_best=total("fast_in_best"),
            pick_groups_together=total("pick_groups_together"),
            occupied=total("occupied"),
            empty=total("empty"),
        ),
    )
