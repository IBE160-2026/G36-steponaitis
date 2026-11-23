"""FR-40/AD-18 login throttle rules: `is_locked` and `after_failure` with chosen times."""

from datetime import UTC, datetime, timedelta

from swp.domain.accounts import (
    LOGIN_LOCK,
    LOGIN_LOCKED,
    LOGIN_MAX_FAILURES,
    LoginAttempts,
    after_failure,
    is_locked,
)

T = datetime(2026, 11, 23, 12, 0, tzinfo=UTC)


def test_fr40_throttle_constants() -> None:
    assert LOGIN_MAX_FAILURES == 5
    assert timedelta(seconds=60) == LOGIN_LOCK
    assert LOGIN_LOCKED == "Too many failed logins for this username. Wait a minute and try again."


def test_fr40_no_record_is_not_locked() -> None:
    assert not is_locked(None, T)
    assert not is_locked(LoginAttempts(failures=4, locked_until=None), T)


def test_fr40_first_failure_starts_at_one() -> None:
    assert after_failure(None, T) == LoginAttempts(failures=1, locked_until=None)


def test_fr40_fifth_failure_locks_for_60_seconds() -> None:
    attempts = after_failure(LoginAttempts(failures=4, locked_until=None), T)

    assert attempts == LoginAttempts(failures=5, locked_until=T + timedelta(seconds=60))
    assert is_locked(attempts, T)
    assert is_locked(attempts, T + timedelta(seconds=59))
    assert not is_locked(attempts, T + timedelta(seconds=60))


def test_fr40_failures_add_up_without_a_window() -> None:
    attempts = None
    for hours in range(4):
        attempts = after_failure(attempts, T + timedelta(hours=hours))
    assert attempts == LoginAttempts(failures=4, locked_until=None)


def test_fr40_failure_after_lock_passed_starts_over() -> None:
    locked = LoginAttempts(failures=5, locked_until=T + timedelta(seconds=60))

    assert after_failure(locked, T + timedelta(seconds=61)) == LoginAttempts(
        failures=1, locked_until=None
    )
    assert after_failure(locked, T + timedelta(seconds=60)) == LoginAttempts(
        failures=1, locked_until=None
    )


def test_fr40_failure_while_locked_extends_lock() -> None:
    # The service never records a failure while locked; the rule still stays locked.
    locked = LoginAttempts(failures=5, locked_until=T + timedelta(seconds=60))
    later = T + timedelta(seconds=10)

    assert after_failure(locked, later) == LoginAttempts(
        failures=6, locked_until=later + timedelta(seconds=60)
    )
