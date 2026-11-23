"""Account rules (FR-39, AD-10): username and password checks for Create account.

Also the login throttle rules (FR-40, AD-18): failures per casefolded username lock it.

Pure: no clock, ids or hashing here. `swp.app.auth` hashes, stores and signs the session.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import TypedDict


class FieldError(TypedDict):
    """One failing form field, as a `validation_failed` detail (AD-11)."""

    field: str
    message: str


USERNAME_MAX = 32
PASSWORD_MIN = 4
PASSWORD_MAX = 64
PASSWORD_MAX_BYTES = 72  # bcrypt reads at most 72 bytes.

# Reserved by casefold: `planner` is the M1 default user, `demo` the seeded demo account.
DEMO_USERNAME = "demo"  # the seeded demo account (FR-50, AD-10); already casefolded
RESERVED_USERNAMES = frozenset({"planner", DEMO_USERNAME})

TAKEN = "That username is taken. Try another."
USERNAME_EMPTY = "Enter a username."
USERNAME_TOO_LONG = "Use at most 32 letters and numbers."
USERNAME_NOT_ALNUM = "Use letters and numbers only."
PASSWORD_TOO_SHORT = "Use at least 4 characters."
PASSWORD_TOO_LONG = "Use at most 64 characters."
PASSWORD_TOO_MANY_BYTES = "This password is too long. Use fewer special characters."
PASSWORD_INVALID = "Use letters, numbers and ordinary symbols only."
PASSWORDS_DIFFER = "The passwords don’t match."


def username_key(username: str) -> str:
    """The key a username is unique by: its casefold."""
    return username.casefold()


def is_reserved(username: str) -> bool:
    return username_key(username) in RESERVED_USERNAMES


def username_error(username: str) -> str | None:
    """The format message for `username`, or None when its format is valid."""
    if not username:
        return USERNAME_EMPTY
    if len(username) > USERNAME_MAX:
        return USERNAME_TOO_LONG
    if not username.isalnum():
        return USERNAME_NOT_ALNUM
    return None


def password_error(password: str) -> str | None:
    """The message for `password`, or None when it is allowed."""
    if len(password) < PASSWORD_MIN:
        return PASSWORD_TOO_SHORT
    if len(password) > PASSWORD_MAX:
        return PASSWORD_TOO_LONG
    try:
        encoded = password.encode("utf-8")
    except UnicodeEncodeError:  # a lone surrogate from JSON has no UTF-8 form
        return PASSWORD_INVALID
    if len(encoded) > PASSWORD_MAX_BYTES:
        return PASSWORD_TOO_MANY_BYTES
    return None


def signup_errors(username: str, password: str, password_repeat: str) -> list[FieldError]:
    """The failing fields of a Create account form, in form order.

    A reserved username fails with the taken message; whether another account already
    holds the username is checked by the caller, and only when this returns no username error.
    """
    errors: list[FieldError] = []
    username_message = username_error(username)
    if username_message is None and is_reserved(username):
        username_message = TAKEN
    if username_message is not None:
        errors.append({"field": "username", "message": username_message})
    password_message = password_error(password)
    if password_message is not None:
        errors.append({"field": "password", "message": password_message})
    if password_repeat != password:
        errors.append({"field": "password_repeat", "message": PASSWORDS_DIFFER})
    return errors


LOGIN_MAX_FAILURES = 5
LOGIN_LOCK = timedelta(seconds=60)
LOGIN_LOCKED = "Too many failed logins for this username. Wait a minute and try again."


@dataclass(frozen=True)
class LoginAttempts:
    """Failed logins counted for one casefolded username, and when its lock ends."""

    failures: int
    locked_until: datetime | None


def is_locked(attempts: LoginAttempts | None, now: datetime) -> bool:
    """True while `attempts` holds a lock that has not passed at `now`."""
    return (
        attempts is not None and attempts.locked_until is not None and now < attempts.locked_until
    )


def after_failure(attempts: LoginAttempts | None, now: datetime) -> LoginAttempts:
    """The attempts after one more failed login at `now`.

    No time window: failures add up until a success clears them or a lock passes. A missing
    record or one whose lock has passed starts from 0; the `LOGIN_MAX_FAILURES`th failure locks
    the username for `LOGIN_LOCK`.
    """
    previous = 0
    if attempts is not None and not (
        attempts.locked_until is not None and now >= attempts.locked_until
    ):
        previous = attempts.failures
    failures = previous + 1
    locked_until = now + LOGIN_LOCK if failures >= LOGIN_MAX_FAILURES else None
    return LoginAttempts(failures=failures, locked_until=locked_until)
