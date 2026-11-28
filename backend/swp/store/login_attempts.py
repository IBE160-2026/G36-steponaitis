"""Login attempt persistence (FR-40, AD-18): login attempts per casefolded `username_key`.

An attempt is counted (`reserve`) before the password is checked, so concurrent requests can
never run more than `LOGIN_MAX_FAILURES` password checks; a success clears the row. Rows whose
lock has passed are pruned whenever an attempt is counted: `after_failure` and
`is_locked` already treat such a row as missing, so deleting it changes no throttle decision.
Both writes raise `LoginAttemptsBusy` when another writer holds the lock.
"""

from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from swp.domain.accounts import LoginAttempts, after_failure, is_locked
from swp.store.db import is_busy, write_transaction
from swp.store.models import LoginAttemptRow


class LoginAttemptsBusy(Exception):
    """Another writer holds the database lock (SQLite busy/locked, pg 55P03); the message is
    the driver's cause."""


def _reserve(key: str, now: datetime) -> bool:
    with write_transaction() as session:
        row = session.scalars(
            select(LoginAttemptRow).where(LoginAttemptRow.username_key == key).with_for_update()
        ).first()
        current = (
            None
            if row is None
            else LoginAttempts(failures=row.failures, locked_until=row.locked_until)
        )
        if is_locked(current, now):
            return False
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
    return True


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


def reserve(key: str, now: datetime) -> bool:
    """Count one login attempt for `key` at `now` before its password is checked; False (and
    nothing written) when `key` is locked.

    The read-modify-write runs in one transaction under a row lock, so the
    `LOGIN_MAX_FAILURES`th concurrent reservation sets the lock and later ones see it. A
    concurrent first insert for the same key loses the primary key race with an
    IntegrityError, and is retried once (it then finds the row). Raise `LoginAttemptsBusy`
    when the lock cannot be taken; any other database error raises unchanged.
    """
    try:
        try:
            return _reserve(key, now)
        except IntegrityError:
            return _reserve(key, now)
    except OperationalError as error:
        if is_busy(error):
            raise LoginAttemptsBusy(str(error.orig)) from error
        raise


def _clear(key: str) -> None:
    # A write transaction, so Postgres applies the 3 s `lock_timeout` here as in `_reserve`.
    with write_transaction() as session:
        session.execute(delete(LoginAttemptRow).where(LoginAttemptRow.username_key == key))


def clear(key: str) -> None:
    """Forget the attempts counted for `key` (after a successful login).

    Raise `LoginAttemptsBusy` when the lock cannot be taken; any other database error raises
    unchanged.
    """
    try:
        _clear(key)
    except OperationalError as error:
        if is_busy(error):
            raise LoginAttemptsBusy(str(error.orig)) from error
        raise
