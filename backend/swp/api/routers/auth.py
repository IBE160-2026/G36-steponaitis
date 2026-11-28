"""POST /api/auth/signup, /login, /logout and /demo: accounts and the session (FR-39, FR-40,
FR-50, AD-10).

With `FEATURE_AUTH` off, every /api/auth/* path is `not_found`.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response, status

from swp.api.errors import NOT_FOUND, error_responses
from swp.api.schemas.auth import (
    LoginRequest,
    LoginResponse,
    SignupRequest,
    SignupResponse,
)
from swp.app import auth
from swp.domain.errors import DomainError

ALL_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]


def require_auth_feature() -> None:
    if not auth.auth_enabled():
        raise DomainError("not_found", NOT_FOUND)


router = APIRouter(prefix="/auth", dependencies=[Depends(require_auth_feature)])


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        auth.SESSION_COOKIE,
        token,
        max_age=auth.SESSION_MAX_AGE,
        path="/",
        secure=auth.cookie_secure(),
        httponly=True,
        samesite="lax",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        auth.SESSION_COOKIE,
        path="/",
        secure=auth.cookie_secure(),
        httponly=True,
        samesite="lax",
    )


@router.post(
    "/signup",
    status_code=status.HTTP_201_CREATED,
    responses=error_responses(403, 404, 409, 422),
)
def signup(body: SignupRequest, response: Response) -> SignupResponse:
    signed_up = auth.signup(
        body.username, body.password, body.password_repeat, now=datetime.now(UTC)
    )
    set_session_cookie(response, signed_up.token)
    return SignupResponse(user=signed_up.username)


@router.post("/login", responses=error_responses(401, 403, 404, 422, 429, 503))
def login(body: LoginRequest, response: Response) -> LoginResponse:
    logged_in = auth.login(body.username, body.password, now=datetime.now(UTC))
    set_session_cookie(response, logged_in.token)
    return LoginResponse(user=logged_in.username)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=error_responses(403, 404),
)
def logout(response: Response) -> None:
    clear_session_cookie(response)


def require_demo_feature() -> None:
    if not auth.demo_enabled():
        raise DomainError("not_found", NOT_FOUND)


@router.post(
    "/demo",
    dependencies=[Depends(require_demo_feature)],
    responses=error_responses(403, 404, 503),
)
def demo(response: Response) -> LoginResponse:
    """Demo version: log in as `demo` with no password and no throttle (FR-50)."""
    logged_in = auth.demo_login(now=datetime.now(UTC))
    set_session_cookie(response, logged_in.token)
    return LoginResponse(user=logged_in.username)


@router.api_route("/{path:path}", methods=ALL_METHODS, include_in_schema=False)
def unknown(path: str) -> None:
    """Any other /api/auth/* path or method is `not_found`, whether or not auth is on."""
    raise DomainError("not_found", NOT_FOUND)
