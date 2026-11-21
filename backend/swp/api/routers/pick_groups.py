"""Pick groups table: GET /api/plans/{id}/pick-groups (FR-20). Read-only (FR-9)."""

import uuid

from fastapi import APIRouter

from swp.api.errors import error_responses
from swp.app import pick_groups as service
from swp.domain.views.pick_groups import PickGroupsView

router = APIRouter()


@router.get("/plans/{plan_id}/pick-groups", responses=error_responses(404, 422))
def get_plan_pick_groups(plan_id: uuid.UUID) -> PickGroupsView:
    return service.pick_groups(plan_id)
