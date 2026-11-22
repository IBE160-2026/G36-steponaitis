"""Recommendations: GET /api/plans/{id}/recommendations (FR-28, FR-29) and its other
locations (FR-31). Read-only (FR-9)."""

import uuid

from fastapi import APIRouter

from swp.api.errors import error_responses
from swp.app import recommendations as service
from swp.domain.recommendations import OtherLocationsView, RecommendationsView

router = APIRouter()


@router.get("/plans/{plan_id}/recommendations", responses=error_responses(404, 422))
def get_plan_recommendations(plan_id: uuid.UUID) -> RecommendationsView:
    return service.recommendations(plan_id)


@router.get(
    "/plans/{plan_id}/recommendations/{recommendation_id}/other-locations",
    responses=error_responses(404, 422),
)
def get_recommendation_other_locations(
    plan_id: uuid.UUID, recommendation_id: str
) -> OtherLocationsView:
    return service.other_locations(plan_id, recommendation_id)
