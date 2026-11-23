"""Auth service (FR-39, FR-40, AD-10): Create account, Log in and the `swp_session` cookie.

The only module that uses bcrypt and PyJWT. The caller passes `now`; ids come from uuid4 here.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import cache

import bcrypt
import jwt

from swp.config import get_settings
from swp.domain.accounts import (
    PASSWORD_MAX_BYTES,
    TAKEN,
    FieldError,
    signup_errors,
    username_error,
    username_key,
)
from swp.domain.errors import DomainError
from swp.store import users as store

SESSION_COOKIE = "swp_session"
SESSION_DAYS = 30
SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60  # seconds, the cookie's Max-Age
JWT_ALGORITHM = "HS256"

WRONG_LOGIN = "Wrong username or password. Check both and try again."


@dataclass(frozen=True)
class SignedUp:
    username: str
    token: str


def auth_enabled() -> bool:
    return get_settings().feature_auth


def cookie_secure() -> bool:
    """The session cookie is `Secure` only in production (local runs use plain http)."""
    return get_settings().app_env == "production"


def _validation_failed(errors: list[FieldError]) -> DomainError:
    details: list[dict[str, object]] = [dict(error) for error in errors]
    return DomainError("validation_failed", errors[0]["message"], details)


def _taken() -> DomainError:
    return _validation_failed([{"field": "username", "message": TAKEN}])


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def session_token(user_id: uuid.UUID, *, now: datetime) -> str:
    """An HS256 JWT naming `user_id`, valid for `SESSION_DAYS` from `now`."""
    claims = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=SESSION_DAYS)).timestamp()),
    }
    return jwt.encode(claims, get_settings().jwt_secret, algorithm=JWT_ALGORITHM)


def signup(username: str, password: str, password_repeat: str, *, now: datetime) -> SignedUp:
    """Create an account and its session token; raise `validation_failed` per failing field.

    Whether the username is taken is checked only when its format is valid; a concurrent
    sign-up that wins the unique constraint gives the same taken message.
    """
    errors = signup_errors(username, password, password_repeat)
    if not any(error["field"] == "username" for error in errors) and store.username_key_taken(
        username_key(username)
    ):
        errors.insert(0, {"field": "username", "message": TAKEN})
    if errors:
        raise _validation_failed(errors)
    user = store.StoredUser(
        id=uuid.uuid4(),
        username=username,
        username_key=username_key(username),
        password_hash=hash_password(password),
        created_at=now,
    )
    if not store.insert_user(user):
        raise _taken()
    return SignedUp(username=user.username, token=session_token(user.id, now=now))


@cache
def _dummy_hash() -> bytes:
    """A fixed hash checked for unknown usernames, so timing does not reveal accounts."""
    return bcrypt.hashpw(b"swp-dummy-password", bcrypt.gensalt())


def _password_bytes(password: str) -> bytes | None:
    """`password` as UTF-8, or None when it has no UTF-8 form or is too long for bcrypt."""
    try:
        encoded = password.encode("utf-8")
    except UnicodeEncodeError:
        return None
    return encoded if len(encoded) <= PASSWORD_MAX_BYTES else None


def login(username: str, password: str, *, now: datetime) -> SignedUp:
    """The stored username and a session token; `unauthenticated` for any failed login.

    The message never says which part was wrong. An unknown username still runs one bcrypt
    check against a dummy hash.
    """
    encoded = _password_bytes(password)
    # A malformed username (lone surrogate, NUL, ...) never reaches the database.
    if username_error(username) is not None or encoded is None or not encoded:
        raise DomainError("unauthenticated", WRONG_LOGIN)
    user = store.get_user_by_key(username_key(username))
    if user is None:
        bcrypt.checkpw(encoded, _dummy_hash())
        raise DomainError("unauthenticated", WRONG_LOGIN)
    if not bcrypt.checkpw(encoded, user.password_hash.encode("ascii")):
        raise DomainError("unauthenticated", WRONG_LOGIN)
    return SignedUp(username=user.username, token=session_token(user.id, now=now))


def session_user(token: str | None, *, now: datetime) -> str | None:
    """The username the session `token` names, or None.

    None when auth is off, the token is missing, tampered, expired or malformed, or its
    user no longer exists. The user is loaded from the database on every call.
    """
    if not token or not auth_enabled():
        return None
    try:
        claims = jwt.decode(
            token,
            get_settings().jwt_secret,
            algorithms=[JWT_ALGORITHM],
            # Expiry is checked against the caller's `now` below, not the wall clock.
            options={"require": ["sub", "iat", "exp"], "verify_exp": False, "verify_iat": False},
        )
        exp = claims["exp"]
        if not isinstance(exp, int | float) or exp <= now.timestamp():
            return None
        user_id = uuid.UUID(str(claims["sub"]))
    except (jwt.InvalidTokenError, ValueError):
        return None
    user = store.get_user(user_id)
    return user.username if user is not None else None
