"""The API login guard and the request's user (FR-11, FR-40, AD-10).

`current_user` is mounted on every router except `health`, `session` and `auth`, and is
also a parameter of the routes that write who edited, so FastAPI's per-request dependency
cache loads the user once. With auth off every request acts as `planner`.
"""

from datetime import UTC, datetime

from fastapi import Request

from swp.app import auth
from swp.app.plans import DEFAULT_USER
from swp.domain.errors import DomainError

LOG_IN_TO_CONTINUE = "Log in to continue."


def current_user(request: Request) -> str:
    """The logged-in username, or `planner` with auth off; `unauthenticated` without a session."""
    if not auth.auth_enabled():
        return DEFAULT_USER
    # Read the cookie as /api/session does: a bad or missing cookie means no user.
    user = auth.session_user(request.cookies.get(auth.SESSION_COOKIE), now=datetime.now(UTC))
    if user is None:
        raise DomainError("unauthenticated", LOG_IN_TO_CONTINUE)
    return user
