"""Recommendations: GET /api/plans/{id}/recommendations (FR-28, FR-29). Read-only (FR-9)."""

import uuid

from fastapi import APIRouter

from swp.api.errors import error_responses
from swp.app import recommendations as service
from swp.domain.recommendations import RecommendationsView

router = APIRouter()


@router.get("/plans/{plan_id}/recommendations", responses=error_responses(404, 422))
def get_plan_recommendations(plan_id: uuid.UUID) -> RecommendationsView:
    return service.recommendations(plan_id)
