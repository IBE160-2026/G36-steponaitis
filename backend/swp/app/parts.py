"""Parts roster and part detail services (FR-13): read-only, it never writes the plan (FR-9)."""

import uuid

from swp.app.plans import require
from swp.domain.views.parts import PartDetail, PartsView, build_part_detail, build_parts_view


def parts(plan_id: uuid.UUID) -> PartsView:
    """The parts roster of the plan as it is now; raise `plan_not_found` for an unknown id."""
    plan = require(plan_id)
    return build_parts_view(plan.imported.data, plan.analysis, plan.state, plan.version)


def part(plan_id: uuid.UUID, part: str) -> PartDetail:
    """One part of the plan as it is now; raise `plan_not_found` for an unknown plan and
    `not_found` for a part without an analysis entry."""
    plan = require(plan_id)
    return build_part_detail(plan.imported.data, plan.analysis, plan.state, plan.version, part)
