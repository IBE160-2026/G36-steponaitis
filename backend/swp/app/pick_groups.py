"""Pick groups table service (FR-20): read-only, it never writes the plan (FR-9)."""

import uuid

from swp.app.plans import require
from swp.domain.views.pick_groups import PickGroupsView, build_pick_groups_view


def pick_groups(plan_id: uuid.UUID) -> PickGroupsView:
    """The pick groups table of the plan as it is now; raise `plan_not_found` for an unknown id."""
    plan = require(plan_id)
    return build_pick_groups_view(plan.imported.data, plan.analysis, plan.state, plan.version)
