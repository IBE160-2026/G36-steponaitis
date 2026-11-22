"""The pick groups table behind GET /api/plans/{id}/pick-groups (FR-20, AD-3, AD-14).

Pure: one planning copy per request, every aisle taken from it; it never writes. Lists the
pick groups stored in the analysis at plan creation (AD-4), in `ordering.pick_group_order`;
it never recomputes them and never reads transactions.
"""

from pydantic import BaseModel

from swp.domain.analysis import Analysis
from swp.domain.import_data import ImportData
from swp.domain.ordering import pick_group_order
from swp.domain.planning import PlanningCopy, current_aisle, planning_copy
from swp.domain.state import PlanState


class PickGroupPart(BaseModel):
    part: str
    description: str
    aisle: str | None


class PickGroupRow(BaseModel):
    part_a: PickGroupPart
    part_b: PickGroupPart
    shared_jobs: int
    same_aisle: bool


class PickGroupsView(BaseModel):
    version: int
    min_shared_jobs: int
    pick_groups: list[PickGroupRow]


def _part(data: ImportData, copy: PlanningCopy, part: str) -> PickGroupPart:
    return PickGroupPart(
        part=part, description=data.parts.get(part, ""), aisle=current_aisle(copy, part)
    )


def build_pick_groups_view(
    data: ImportData, analysis: Analysis, state: PlanState, version: int
) -> PickGroupsView:
    """Every stored pick group of the plan as it is now, most shared jobs first."""
    copy = planning_copy(data, state)
    rows = []
    for group in pick_group_order(analysis.pick_groups):
        part_a = _part(data, copy, group.part_a)
        part_b = _part(data, copy, group.part_b)
        rows.append(
            PickGroupRow(
                part_a=part_a,
                part_b=part_b,
                shared_jobs=group.shared_jobs,
                same_aisle=part_a.aisle is not None and part_a.aisle == part_b.aisle,
            )
        )
    return PickGroupsView(
        version=version,
        min_shared_jobs=analysis.settings.pick_group_min_shared_jobs,
        pick_groups=rows,
    )
