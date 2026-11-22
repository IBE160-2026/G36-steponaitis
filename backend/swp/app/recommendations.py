"""Recommendations service (FR-28, FR-29, FR-31): read-only, it never writes the plan (FR-9)."""

import uuid

from swp.app.plans import require
from swp.domain.recommendations import (
    OtherLocationsView,
    RecommendationsView,
    build_other_locations_view,
    build_recommendations_view,
)


def recommendations(plan_id: uuid.UUID) -> RecommendationsView:
    """The latest run's recommendations of the plan as it is now; raise `plan_not_found`
    for an unknown id."""
    plan = require(plan_id)
    return build_recommendations_view(plan.imported.data, plan.analysis, plan.state, plan.version)


def other_locations(plan_id: uuid.UUID, recommendation_id: str) -> OtherLocationsView:
    """FR-31's allowed set for one recommendation (empty when it is unknown or cannot be
    applied); raise `plan_not_found` for an unknown plan."""
    plan = require(plan_id)
    return build_other_locations_view(
        plan.imported.data, plan.analysis, plan.state, plan.version, recommendation_id
    )
