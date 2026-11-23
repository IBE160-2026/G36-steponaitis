"""Login attempt persistence (FR-40, AD-18): failed logins per casefolded `username_key`."""

from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from swp.domain.accounts import LoginAttempts, after_failure
from swp.store.db import transaction, write_transaction
from swp.store.models import LoginAttemptRow


def get(key: str) -> LoginAttempts | None:
    """The attempts recorded for `key`, or None."""
    with transaction() as session:
        row = session.get(LoginAttemptRow, key)
        if row is None:
            return None
        return LoginAttempts(failures=row.failures, locked_until=row.locked_until)


def _record_failure(key: str, now: datetime) -> LoginAttempts:
    with write_transaction() as session:
        row = session.scalars(
            select(LoginAttemptRow).where(LoginAttemptRow.username_key == key).with_for_update()
        ).first()
        current = (
            None
            if row is None
            else LoginAttempts(failures=row.failures, locked_until=row.locked_until)
        )
        attempts = after_failure(current, now)
        if row is None:
            session.add(
                LoginAttemptRow(
                    username_key=key,
                    failures=attempts.failures,
                    locked_until=attempts.locked_until,
                )
            )
        else:
            row.failures = attempts.failures
            row.locked_until = attempts.locked_until
    return attempts


def record_failure(key: str, now: datetime) -> LoginAttempts:
    """Count one more failed login for `key` at `now` in one transaction; the new attempts.

    The row is read under a row lock; a concurrent first insert for the same key loses the
    primary key race with an IntegrityError, and is retried once (it then finds the row).
    """
    try:
        return _record_failure(key, now)
    except IntegrityError:
        return _record_failure(key, now)


def clear(key: str) -> None:
    """Forget the failed logins for `key` (after a successful login)."""
    with transaction() as session:
        session.execute(delete(LoginAttemptRow).where(LoginAttemptRow.username_key == key))
