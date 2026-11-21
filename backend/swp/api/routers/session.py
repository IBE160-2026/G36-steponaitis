"""GET /api/session: who is signed in and the feature flags (AD-10, AD-12)."""

from fastapi import APIRouter

from swp.api.schemas.session import Session
from swp.app.limits import max_upload_bytes
from swp.config import get_settings

router = APIRouter()


@router.get("/session")
def get_session() -> Session:
    settings = get_settings()
    return Session(
        user=None,
        feature_auth=settings.feature_auth,
        feature_demo=settings.feature_demo,
        max_upload_bytes=max_upload_bytes(),
    )
