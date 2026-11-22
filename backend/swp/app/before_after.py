"""Before/after service (FR-37): read-only, it never writes the plan (FR-9)."""

import uuid

from swp.app.plans import require
from swp.domain.before_after import BeforeAfterView, build_before_after_view


def before_after(plan_id: uuid.UUID) -> BeforeAfterView:
    """The plan's before/after counts as it is now; raise `plan_not_found` for an unknown id."""
    plan = require(plan_id)
    return build_before_after_view(plan.imported.data, plan.analysis, plan.state, plan.version)
