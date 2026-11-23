"""The API login guard (FR-40, AD-10): with `FEATURE_AUTH` on, routers need a session.

Mounted on every router except `health`, `session` and `auth`. With auth off it does
nothing, so every request still acts as `planner`.
"""

from datetime import UTC, datetime

from fastapi import Request

from swp.app import auth
from swp.domain.errors import DomainError

LOG_IN_TO_CONTINUE = "Log in to continue."


def require_session(request: Request) -> None:
    if not auth.auth_enabled():
        return
    # Read the cookie as /api/session does: a bad or missing cookie means no user.
    user = auth.session_user(request.cookies.get(auth.SESSION_COOKIE), now=datetime.now(UTC))
    if user is None:
        raise DomainError("unauthenticated", LOG_IN_TO_CONTINUE)
