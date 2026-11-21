"""Search: GET /api/plans/{id}/search?q= (FR-15). Read-only (FR-9)."""

import uuid

from fastapi import APIRouter

from swp.api.errors import error_responses
from swp.app import search as service
from swp.domain.views.search import SearchView

router = APIRouter()


@router.get("/plans/{plan_id}/search", responses=error_responses(404, 422))
def get_plan_search(plan_id: uuid.UUID, q: str) -> SearchView:
    return service.search(plan_id, q)
