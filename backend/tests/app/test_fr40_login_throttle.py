"""FR-40/AD-18 login throttle on SQLite and (CI) Postgres, with an injected clock (no sleep)."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select
from sqlalchemy.exc import IntegrityError

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


def test_fr40_record_failure_retries_once_after_integrity_error(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A concurrent first insert: the other request's row lands, then this insert conflicts.
    real = login_attempts._record_failure
    raised: list[bool] = []

    def racing(key: str, now: datetime):
        if not raised:
            raised.append(True)
            real(key, now)  # the concurrent request's failure
            raise IntegrityError("INSERT", {}, Exception("duplicate key"))
        return real(key, now)

    monkeypatch.setattr(login_attempts, "_record_failure", racing)

    attempts = login_attempts.record_failure("kari7", T)

    assert raised == [True]
    assert (attempts.failures, attempts.locked_until) == (2, None)
    assert _rows() == {"kari7": (2, None)}


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
