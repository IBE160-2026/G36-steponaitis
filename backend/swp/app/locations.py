"""Locations table service (FR-14): read-only, it never writes the plan (FR-9)."""

import uuid

from swp.app.plans import require
from swp.domain.views.locations import LocationsView, build_locations_view


def locations(plan_id: uuid.UUID) -> LocationsView:
    """The locations table of the plan as it is now; raise `plan_not_found` for an unknown id."""
    plan = require(plan_id)
    return build_locations_view(plan.imported.data, plan.state, plan.version)
