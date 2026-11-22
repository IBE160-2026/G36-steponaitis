"""Manual move preview service (FR-33, AD-3): read-only, it never writes the plan (FR-9)."""

import uuid

from swp.app.plans import require
from swp.domain.views.move_preview import MovePreview, build_move_preview


def preview(plan_id: uuid.UUID, part: str, from_location: str, to_location: str) -> MovePreview:
    """What a manual move would do; raise `plan_not_found` for an unknown plan."""
    plan = require(plan_id)
    return build_move_preview(
        plan.imported.data,
        plan.analysis,
        plan.state,
        plan.version,
        part,
        from_location,
        to_location,
    )
