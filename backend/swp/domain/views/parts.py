"""The parts roster behind GET /api/plans/{id}/parts and the part detail behind
GET /api/plans/{id}/parts/{part} (FR-13, FR-20, AD-3, AD-14).

Pure: one planning copy per request, every row built from it; it never writes. Lists every
Inventory part that has an analysis entry, most picks first.
"""

from collections import Counter

from pydantic import BaseModel

from swp.domain.analysis import Analysis, ClassThreshold, MovementClass, class_threshold
from swp.domain.errors import DomainError
from swp.domain.import_data import ImportData
from swp.domain.ordering import part_order, pick_group_order
from swp.domain.planning import (
    LocationRef,
    PlanningCopy,
    current_aisle,
    current_location,
    listed_parts,
    location_ref,
    other_locations,
    planning_copy,
    stock_at,
    total_stock,
)
from swp.domain.state import PlanState
from swp.domain.values import Dec


class PartRow(BaseModel):
    rank: int
    part: str
    description: str
    total_stock: Dec
    total_stock_sort_rank: int
    current_location: LocationRef | None
    other_locations: list[LocationRef]
    movement_class: MovementClass
    picks: int
    pick_group_count: int
    kept_in_place: bool


class PartsView(BaseModel):
    version: int
    parts: list[PartRow]


def build_parts_view(
    data: ImportData, analysis: Analysis, state: PlanState, version: int
) -> PartsView:
    """The roster of the plan as it is now, in `ordering.part_order`."""
    copy = planning_copy(data, state)
    marks = state.best_marks
    listed = listed_parts(data, analysis)
    group_counts = Counter(
        part for group in analysis.pick_groups for part in (group.part_a, group.part_b)
    )
    totals = {part: total_stock(copy, part) for part in listed}
    # Dense rank ascending: equal stock -> equal rank.
    stock_rank = {stock: rank for rank, stock in enumerate(sorted(set(totals.values())))}
    rows = []
    for rank, part in enumerate(part_order(listed), start=1):
        current = current_location(copy, part)
        rows.append(
            PartRow(
                rank=rank,
                part=part,
                description=data.parts[part],
                total_stock=totals[part],
                total_stock_sort_rank=stock_rank[totals[part]],
                current_location=location_ref(copy, current, marks)
                if current is not None
                else None,
                other_locations=[
                    location_ref(copy, code, marks) for code in other_locations(copy, part)
                ],
                movement_class=listed[part].movement_class,
                picks=listed[part].picks,
                pick_group_count=group_counts[part],
                kept_in_place=False,
            )
        )
    return PartsView(version=version, parts=rows)


class StockedLocation(BaseModel):
    location: LocationRef
    stock: Dec


class PartnerPart(BaseModel):
    part: str
    description: str
    aisle: str | None


class PartPickGroup(BaseModel):
    partner: PartnerPart
    shared_jobs: int


class PartDetail(BaseModel):
    version: int
    part: str
    description: str
    movement_class: MovementClass
    picks: int
    class_threshold: ClassThreshold
    total_stock: Dec
    current_location: LocationRef | None
    other_locations: list[StockedLocation]
    pick_groups: list[PartPickGroup]


def _partner(data: ImportData, copy: PlanningCopy, part: str) -> PartnerPart:
    return PartnerPart(
        part=part, description=data.parts.get(part, ""), aisle=current_aisle(copy, part)
    )


def build_part_detail(
    data: ImportData, analysis: Analysis, state: PlanState, version: int, part: str
) -> PartDetail:
    """Every fact about one classified part of the plan as it is now; `not_found` when the
    part has no analysis entry (unknown, or only in Transactions)."""
    facts = listed_parts(data, analysis).get(part)
    if facts is None:
        raise DomainError("not_found", f"No part {part} in this plan.")
    copy = planning_copy(data, state)
    marks = state.best_marks
    current = current_location(copy, part)
    groups = []
    for group in pick_group_order(analysis.pick_groups):
        if part not in (group.part_a, group.part_b):
            continue
        partner = group.part_b if group.part_a == part else group.part_a
        groups.append(
            PartPickGroup(partner=_partner(data, copy, partner), shared_jobs=group.shared_jobs)
        )
    return PartDetail(
        version=version,
        part=part,
        description=data.parts[part],
        movement_class=facts.movement_class,
        picks=facts.picks,
        class_threshold=class_threshold(analysis.settings, facts.movement_class),
        total_stock=total_stock(copy, part),
        current_location=location_ref(copy, current, marks) if current is not None else None,
        other_locations=[
            StockedLocation(
                location=location_ref(copy, code, marks), stock=stock_at(copy, part, code)
            )
            for code in other_locations(copy, part)
        ],
        pick_groups=groups,
    )
