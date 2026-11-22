"""Move-list service (FR-38): read-only, it never writes the plan (FR-9)."""

import uuid
from datetime import UTC, datetime

from swp.app.plans import require
from swp.domain.move_list import MoveListView, build_move_list_view


def move_list(plan_id: uuid.UUID, *, now: datetime | None = None) -> MoveListView:
    """The plan's printed move list as it is now, generated at `now` (the request instant by
    default); raise `plan_not_found` for an unknown id."""
    plan = require(plan_id)
    return build_move_list_view(
        plan.imported.data,
        plan.state,
        version=plan.version,
        name=plan.name,
        data_as_of=plan.imported.data_as_of,
        uploaded_at=plan.imported.uploaded_at,
        generated_at=now or datetime.now(UTC),
    )
