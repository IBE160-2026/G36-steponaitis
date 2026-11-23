"""GET /api/session: who is signed in and the feature flags (AD-10, AD-12)."""

from datetime import UTC, datetime

from fastapi import APIRouter, Request

from swp.api.schemas.session import Session
from swp.app.auth import SESSION_COOKIE, session_user
from swp.app.limits import max_upload_bytes
from swp.config import get_settings

router = APIRouter()


@router.get("/session")
def get_session(request: Request) -> Session:
    # The cookie is read from the request, not declared as a parameter: a bad or missing
    # cookie means no user, never a validation error.
    settings = get_settings()
    return Session(
        user=session_user(request.cookies.get(SESSION_COOKIE), now=datetime.now(UTC)),
        feature_auth=settings.feature_auth,
        feature_demo=settings.feature_demo,
        max_upload_bytes=max_upload_bytes(),
    )
