"""Locations table: GET /api/plans/{id}/locations (FR-14). Read-only (FR-9)."""

import uuid

from fastapi import APIRouter

from swp.api.errors import error_responses
from swp.app import locations as service
from swp.domain.views.locations import LocationsView

router = APIRouter()


@router.get("/plans/{plan_id}/locations", responses=error_responses(404, 422))
def get_plan_locations(plan_id: uuid.UUID) -> LocationsView:
    return service.locations(plan_id)
