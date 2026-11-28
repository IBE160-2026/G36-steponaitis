"""FR-40/AD-18 login throttle on SQLite and (CI) Postgres, with an injected clock (no sleep)."""

import sqlite3
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, inspect, select, text
from sqlalchemy.exc import IntegrityError, OperationalError

from swp.api.app import create_app
from swp.app import auth
from swp.config import get_settings
from swp.domain.accounts import LOGIN_LOCKED
from swp.domain.errors import DomainError
from swp.store import login_attempts
from swp.store.db import get_engine
from swp.store.models import LoginAttemptRow

SAME_ORIGIN = {"Origin": "http://testserver"}
T = datetime(2026, 11, 23, 12, 0, tzinfo=UTC)
WRONG_LOGIN = "Wrong username or password. Check both and try again."


@pytest.fixture
def auth_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FEATURE_AUTH", "true")
    get_settings.cache_clear()


@pytest.fixture
def account(empty_tables: str, auth_on: None) -> None:
    auth.signup("Kari7", "secret", "secret", now=T)


def _rows() -> dict[str, tuple[int, datetime | None]]:
    with get_engine().connect() as conn:
        return {
            row.username_key: (row.failures, row.locked_until)
            for row in conn.execute(select(LoginAttemptRow))
        }


def _code(username: str, password: str, now: datetime) -> str:
    try:
        auth.login(username, password, now=now)
    except DomainError as error:
        if error.code == "login_locked":
            assert error.message == LOGIN_LOCKED
        else:
            assert error.message == WRONG_LOGIN
        return error.code
    return "ok"


def _fail(username: str, times: int, now: datetime = T) -> None:
    for _ in range(times):
        assert _code(username, "wrong", now) == "unauthenticated"


def test_fr40_migration_adds_login_attempts_table(empty_tables: str) -> None:
    inspector = inspect(get_engine())

    columns = inspector.get_columns("login_attempts")
    assert [c["name"] for c in columns] == ["username_key", "failures", "locked_until"]
    assert {c["name"]: c["nullable"] for c in columns} == {
        "username_key": False,
        "failures": False,
        "locked_until": True,
    }
    pk = inspector.get_pk_constraint("login_attempts")["constrained_columns"]
    assert pk == ["username_key"]


def test_fr40_fifth_failure_locks_username(account: None) -> None:
    _fail("kari7", 4)
    assert _rows() == {"kari7": (4, None)}

    assert _code("kari7", "wrong", T) == "unauthenticated"

    assert _rows() == {"kari7": (5, T + timedelta(seconds=60))}


def test_fr40_locked_username_refuses_right_password(account: None) -> None:
    _fail("kari7", 5)

    assert _code("kari7", "secret", T + timedelta(seconds=59)) == "login_locked"
    assert _code("kari7", "wrong", T + timedelta(seconds=59)) == "login_locked"
    assert _rows() == {"kari7": (5, T + timedelta(seconds=60))}


def test_fr40_locked_login_skips_bcrypt(account: None, monkeypatch: pytest.MonkeyPatch) -> None:
    _fail("kari7", 5)
    calls: list[object] = []

    def spy(*args: object) -> bool:
        calls.append(args)
        return True

    monkeypatch.setattr(auth.bcrypt, "checkpw", spy)

    assert _code("kari7", "secret", T + timedelta(seconds=1)) == "login_locked"
    assert calls == []
    assert _rows() == {"kari7": (5, T + timedelta(seconds=60))}


def test_fr40_reserve_retries_once_after_integrity_error(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A concurrent first insert: the other request's row lands, then this insert conflicts.
    real = login_attempts._reserve
    raised: list[bool] = []

    def racing(key: str, now: datetime) -> bool:
        if not raised:
            raised.append(True)
            real(key, now)  # the concurrent request's attempt
            raise IntegrityError("INSERT", {}, Exception("duplicate key"))
        return real(key, now)

    monkeypatch.setattr(login_attempts, "_reserve", racing)

    assert login_attempts.reserve("kari7", T) is True

    assert raised == [True]
    assert _rows() == {"kari7": (2, None)}


def test_fr40_reserve_on_locked_key_writes_nothing(empty_tables: str) -> None:
    for _ in range(5):
        assert login_attempts.reserve("kari7", T) is True

    assert login_attempts.reserve("kari7", T + timedelta(seconds=59)) is False
    assert _rows() == {"kari7": (5, T + timedelta(seconds=60))}


def test_fr40_right_password_on_fifth_try_logs_in_and_clears_row(account: None) -> None:
    _fail("kari7", 4)

    assert _code("kari7", "secret", T) == "ok"

    assert _rows() == {}


def test_fr40_concurrent_failed_logins_check_at_most_five_passwords(
    account: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The attempt is counted before bcrypt runs, so 10 requests racing on one username run
    # at most 5 password checks; the rest are refused as locked (AD-18).
    real_checkpw = auth.bcrypt.checkpw
    calls: list[None] = []
    calls_lock = threading.Lock()

    def spy(password: bytes, hashed: bytes) -> bool:
        with calls_lock:
            calls.append(None)
        return real_checkpw(password, hashed)

    monkeypatch.setattr(auth.bcrypt, "checkpw", spy)
    barrier = threading.Barrier(10)
    codes: list[str] = []
    errors: list[BaseException] = []

    def attempt() -> None:
        try:
            barrier.wait()
            codes.append(_code("kari7", "wrong", T))
        except BaseException as error:  # noqa: BLE001 - reported below
            errors.append(error)

    threads = [threading.Thread(target=attempt) for _ in range(10)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert errors == []
    assert len(calls) <= 5
    assert sorted(codes) == ["login_locked"] * 5 + ["unauthenticated"] * 5
    assert _rows() == {"kari7": (5, T + timedelta(seconds=60))}


def test_fr40_lock_passed_allows_login_and_clears_row(account: None) -> None:
    _fail("kari7", 5)

    logged_in = auth.login("kari7", "secret", now=T + timedelta(seconds=60))

    assert logged_in.username == "Kari7"
    assert _rows() == {}


def test_fr40_failure_after_lock_starts_over(account: None) -> None:
    _fail("kari7", 5)

    assert _code("kari7", "wrong", T + timedelta(seconds=61)) == "unauthenticated"

    assert _rows() == {"kari7": (1, None)}
    assert _code("kari7", "secret", T + timedelta(seconds=62)) == "ok"


def test_fr40_unknown_username_is_throttled_too(empty_tables: str, auth_on: None) -> None:
    _fail("ghost", 5)

    assert _code("ghost", "wrong", T + timedelta(seconds=1)) == "login_locked"
    assert _rows() == {"ghost": (5, T + timedelta(seconds=60))}


def test_fr40_counter_is_per_casefolded_username(account: None) -> None:
    _fail("KARI7", 3)
    _fail("Kari7", 2)

    assert _rows() == {"kari7": (5, T + timedelta(seconds=60))}
    assert _code("kari7", "secret", T + timedelta(seconds=1)) == "login_locked"
    # Another username is not affected.
    assert _code("ola", "wrong", T + timedelta(seconds=1)) == "unauthenticated"


@pytest.mark.parametrize(("username", "password"), [("ola n", "secret"), ("kari7", "")])
def test_fr40_malformed_login_records_nothing(account: None, username: str, password: str) -> None:
    assert _code(username, password, T) == "unauthenticated"
    assert _rows() == {}


def test_fr40_success_resets_counter(account: None) -> None:
    _fail("kari7", 3)

    assert _code("kari7", "secret", T) == "ok"
    assert _rows() == {}

    _fail("kari7", 1)
    assert _rows() == {"kari7": (1, None)}


@pytest.fixture
def client(auth_on: None, empty_tables: str) -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def test_fr40_sixth_http_login_is_429_without_cookie(client: TestClient, account: None) -> None:
    def post(password: str):
        return client.post(
            "/api/auth/login",
            json={"username": "kari7", "password": password},
            headers=SAME_ORIGIN,
        )

    for _ in range(5):
        assert post("wrong").status_code == 401

    response = post("secret")

    assert response.status_code == 429, response.text
    assert response.json() == {
        "error": {"code": "login_locked", "message": LOGIN_LOCKED, "details": []}
    }
    assert "set-cookie" not in response.headers
    assert client.get("/api/session").json()["user"] is None


def test_fr40_recording_a_failure_prunes_rows_whose_lock_passed(
    empty_tables: str, auth_on: None
) -> None:
    _fail("ghost", 5)  # locked until T + 60 s
    _fail("probe", 3)  # never locked: the count has no time window, so it is kept
    _fail("recent", 5, T + timedelta(seconds=30))  # locked until T + 90 s

    _fail("other", 1, T + timedelta(seconds=60))

    assert _rows() == {
        "probe": (3, None),
        "recent": (5, T + timedelta(seconds=90)),
        "other": (1, None),
    }
    assert _code("ghost", "wrong", T + timedelta(seconds=61)) == "unauthenticated"
    assert _rows()["ghost"] == (1, None)


# --- A busy database lock on the throttle writes (Epic 16 retro, F1) ---------------------


class _LockNotAvailable(Exception):
    """Stands in for psycopg's LockNotAvailable: Postgres `lock_timeout` passed (55P03)."""

    sqlstate = "55P03"


_BUSY_CAUSES = [
    pytest.param(Exception("database is locked"), id="sqlite-locked"),
    pytest.param(_LockNotAvailable("canceling statement due to lock timeout"), id="pg-55P03"),
]
LOGIN_BUSY = {"code": "unavailable", "message": "Log in is busy. Try again.", "details": []}


def _post_login(client: TestClient, password: str):
    return client.post(
        "/api/auth/login",
        json={"username": "kari7", "password": password},
        headers=SAME_ORIGIN,
    )


@pytest.mark.parametrize("cause", _BUSY_CAUSES)
def test_fr40_busy_attempt_count_answers_unavailable_without_cookie(
    client: TestClient, account: None, monkeypatch: pytest.MonkeyPatch, cause: Exception
) -> None:
    checks: list[object] = []

    def busy(_key: str, _now: datetime) -> bool:
        raise OperationalError("SELECT ... FOR UPDATE", {}, cause)

    monkeypatch.setattr(login_attempts, "_reserve", busy)
    monkeypatch.setattr(auth.bcrypt, "checkpw", lambda *args: checks.append(args))

    response = _post_login(client, "secret")

    assert response.status_code == 503, response.text
    assert response.json() == {"error": LOGIN_BUSY}
    assert "set-cookie" not in response.headers
    assert client.get("/api/session").json()["user"] is None
    assert checks == []  # no password check without a counted attempt
    assert _rows() == {}


@pytest.mark.parametrize("cause", _BUSY_CAUSES)
def test_fr40_busy_clear_after_right_password_answers_unavailable_without_cookie(
    client: TestClient, account: None, monkeypatch: pytest.MonkeyPatch, cause: Exception
) -> None:
    def busy(_key: str) -> None:
        raise OperationalError("DELETE", {}, cause)

    with monkeypatch.context() as locked:
        locked.setattr(login_attempts, "_clear", busy)
        response = _post_login(client, "secret")

    assert response.status_code == 503, response.text
    assert response.json() == {"error": LOGIN_BUSY}
    assert "set-cookie" not in response.headers
    assert client.get("/api/session").json()["user"] is None
    assert [failures for failures, _locked in _rows().values()] == [1]  # counted, not cleared

    # The lock is gone: the next try logs in and clears the count.
    assert _post_login(client, "secret").status_code == 200
    assert _rows() == {}


def test_fr40_busy_retry_after_integrity_error_answers_unavailable(
    client: TestClient, account: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The first insert loses the primary key race; the one retry then meets a busy lock.
    calls: list[None] = []

    def race_then_busy(_key: str, _now: datetime) -> bool:
        calls.append(None)
        if len(calls) == 1:
            raise IntegrityError("INSERT", {}, Exception("duplicate key"))
        raise OperationalError("SELECT ... FOR UPDATE", {}, Exception("database is locked"))

    monkeypatch.setattr(login_attempts, "_reserve", race_then_busy)

    response = _post_login(client, "secret")

    assert len(calls) == 2
    assert response.status_code == 503, response.text
    assert response.json() == {"error": LOGIN_BUSY}
    assert "set-cookie" not in response.headers
    assert client.get("/api/session").json()["user"] is None


@contextmanager
def _login_attempts_locked() -> Iterator[None]:
    """Another writer really holds the lock: SQLite BEGIN IMMEDIATE, Postgres LOCK TABLE."""
    engine = get_engine()
    if engine.dialect.name == "sqlite":
        database = engine.url.database
        assert database is not None
        engine.dispose()

        def short_busy_timeout(dbapi_connection: Any, _record: Any) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA busy_timeout=50")
            cursor.close()

        event.listen(engine, "connect", short_busy_timeout)
        holder = sqlite3.connect(database, isolation_level=None)
        try:
            holder.execute("BEGIN IMMEDIATE")
            yield
        finally:
            holder.execute("ROLLBACK")
            holder.close()
            event.remove(engine, "connect", short_busy_timeout)
    else:
        # Each write transaction waits `PG_LOCK_TIMEOUT` (3 s), then gets 55P03.
        with engine.connect() as holder:
            holder.begin()
            holder.execute(text("LOCK TABLE login_attempts IN EXCLUSIVE MODE"))
            try:
                yield
            finally:
                holder.rollback()


def test_fr40_real_write_lock_is_unavailable(client: TestClient, account: None) -> None:
    with _login_attempts_locked():
        response = _post_login(client, "secret")
        # The clearing write runs in a write transaction too, so it fails as busy, not waits.
        with pytest.raises(login_attempts.LoginAttemptsBusy):
            login_attempts.clear("kari7")

    assert response.status_code == 503, response.text
    assert response.json() == {"error": LOGIN_BUSY}
    assert "set-cookie" not in response.headers
    assert client.get("/api/session").json()["user"] is None
    assert _rows() == {}  # nothing was counted

    # The lock is released: Log in works again.
    assert _post_login(client, "secret").status_code == 200
    assert _rows() == {}


def test_fr40_other_database_error_on_the_throttle_writes_still_raises(
    account: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    def broken(*_args: object) -> bool:
        raise OperationalError("SELECT", {}, Exception("no such table: login_attempts"))

    with monkeypatch.context() as patched:
        patched.setattr(login_attempts, "_reserve", broken)
        with pytest.raises(OperationalError):
            auth.login("kari7", "secret", now=T)

    with monkeypatch.context() as patched:
        patched.setattr(login_attempts, "_clear", broken)
        with pytest.raises(OperationalError):
            auth.login("kari7", "secret", now=T)


def test_fr40_clear_runs_in_a_write_transaction(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    # `write_transaction` is what sets Postgres' 3 s lock_timeout (and BEGIN IMMEDIATE on
    # SQLite), so a held row lock fails as busy instead of waiting.
    opened: list[None] = []
    real = login_attempts.write_transaction

    def spy():
        opened.append(None)
        return real()

    assert login_attempts.reserve("kari7", T) is True
    monkeypatch.setattr(login_attempts, "write_transaction", spy)

    login_attempts.clear("kari7")

    assert opened == [None]
    assert _rows() == {}
