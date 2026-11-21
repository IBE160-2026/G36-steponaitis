"""Search service (FR-15): read-only, it never writes the plan (FR-9)."""

import uuid

from swp.app.plans import require
from swp.domain.views.search import SearchView, build_search_view


def search(plan_id: uuid.UUID, query: str) -> SearchView:
    """Parts and locations matching `query`; raise `plan_not_found` for an unknown id."""
    plan = require(plan_id)
    return build_search_view(plan.imported.data, plan.analysis, plan.state, plan.version, query)
