"""Login attempt persistence (FR-40, AD-18): failed logins per casefolded `username_key`.

Rows whose lock has passed are pruned whenever a failure is recorded: `after_failure` and
`is_locked` already treat such a row as missing, so deleting it changes no throttle decision.
"""

from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

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
        _prune_lock_passed(session, keep=key, now=now)
    return attempts


def _prune_lock_passed(session: Session, *, keep: str, now: datetime) -> None:
    """Delete the other rows whose lock has passed at `now` (they count as no record).

    On Postgres rows another transaction holds are skipped (`SKIP LOCKED`), so the prune never
    waits on, or deadlocks with, a concurrent login; SQLite's BEGIN IMMEDIATE already
    serializes writers.
    """
    expired = (LoginAttemptRow.locked_until.is_not(None), LoginAttemptRow.locked_until <= now)
    candidates = (
        select(LoginAttemptRow.username_key)
        .where(*expired, LoginAttemptRow.username_key != keep)
        .with_for_update(skip_locked=True)
    )
    session.execute(
        delete(LoginAttemptRow)
        .where(*expired, LoginAttemptRow.username_key.in_(candidates))
        .execution_options(synchronize_session=False)
    )


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
