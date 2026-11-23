"""Wall view service (FR-42): read-only, it never writes the plan (FR-9)."""

import uuid

from swp.app.plans import require
from swp.domain.views.wall import WallView, WarehouseView, build_wall_view, build_warehouse_view


def wall(plan_id: uuid.UUID, aisle: str) -> WallView:
    """The wall of one aisle of the plan as it is now; raise `plan_not_found` for an unknown
    plan and `not_found` for an aisle the import does not have."""
    plan = require(plan_id)
    return build_wall_view(plan.imported.data, plan.analysis, plan.state, plan.version, aisle)


def warehouse(plan_id: uuid.UUID) -> WarehouseView:
    """The whole warehouse of the plan as it is now; raise `plan_not_found` for an unknown
    plan."""
    plan = require(plan_id)
    return build_warehouse_view(plan.imported.data, plan.analysis, plan.state, plan.version)
