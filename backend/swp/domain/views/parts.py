"""The parts roster behind GET /api/plans/{id}/parts (FR-13, AD-3, AD-14).

Pure: one planning copy per request, every row built from it; it never writes. Lists every
Inventory part that has an analysis entry, most picks first.
"""

from collections import Counter

from pydantic import BaseModel

from swp.domain.analysis import Analysis, MovementClass
from swp.domain.import_data import ImportData
from swp.domain.ordering import part_order
from swp.domain.planning import (
    LocationRef,
    current_location,
    location_ref,
    other_locations,
    planning_copy,
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
    listed = {part: analysis.parts[part] for part in data.parts if part in analysis.parts}
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
                current_location=location_ref(copy, current) if current is not None else None,
                other_locations=[location_ref(copy, code) for code in other_locations(copy, part)],
                movement_class=listed[part].movement_class,
                picks=listed[part].picks,
                pick_group_count=group_counts[part],
                kept_in_place=False,
            )
        )
    return PartsView(version=version, parts=rows)
