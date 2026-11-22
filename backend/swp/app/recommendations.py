"""Recommendations service (FR-28, FR-29): read-only, it never writes the plan (FR-9)."""

import uuid

from swp.app.plans import require
from swp.domain.recommendations import RecommendationsView, build_recommendations_view


def recommendations(plan_id: uuid.UUID) -> RecommendationsView:
    """The latest run's recommendations of the plan as it is now; raise `plan_not_found`
    for an unknown id."""
    plan = require(plan_id)
    return build_recommendations_view(plan.imported.data, plan.analysis, plan.state, plan.version)
