"""FR-50/AD-10 seeded `demo` account and Demo version on SQLite and (CI) Postgres.

`bootstrap(seed=True)` creates `demo` once with `DEMO_PASSWORD`; with `FEATURE_DEMO` on,
`POST /api/auth/demo` logs in as `demo` with no password and no throttle, and Log in as `demo`
is not throttled either (decided 2026-11-28).
"""

import logging
from collections.abc import Iterator
from datetime import UTC, datetime

import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select
from sqlalchemy.exc import OperationalError

from swp.api.app import create_app
from swp.app import auth
from swp.app.bootstrap import bootstrap
from swp.domain.accounts import LOGIN_LOCK, LOGIN_MAX_FAILURES
from swp.store import login_attempts
from swp.store import users as user_store
from swp.store.db import get_engine
from swp.store.models import ImportRow, LoginAttemptRow, PlanRow, UserRow
from tests.app.test_create_plan import _multipart, _small_files
from tests.app.test_fr40_login_throttle import _login_attempts_locked
from tests.app.test_login import SAME_ORIGIN, _error, _login
from tests.conftest import _clear_caches, production_env

NOW = datetime(2026, 11, 23, 12, 0, tzinfo=UTC)
NOT_FOUND = {"code": "not_found", "message": "Not found.", "details": []}


def _demo_rows() -> list[tuple[object, str, str, str]]:
    with get_engine().connect() as conn:
        return [
            (row.id, row.username, row.username_key, row.password_hash)
            for row in conn.execute(select(UserRow).where(UserRow.username_key == "demo"))
        ]


def _count(table: type) -> int:
    with get_engine().connect() as conn:
        return conn.execute(select(func.count()).select_from(table)).scalar_one()


def _attempts() -> dict[str, tuple[int, datetime | None]]:
    with get_engine().connect() as conn:
        return {
            row.username_key: (row.failures, row.locked_until)
            for row in conn.execute(select(LoginAttemptRow))
        }


def _delete_users() -> None:
    with get_engine().begin() as conn:
        conn.execute(delete(UserRow))


def _env(monkeypatch: pytest.MonkeyPatch, **values: str) -> None:
    for name, value in values.items():
        monkeypatch.setenv(name, value)
    _clear_caches()


@pytest.fixture
def demo_on(monkeypatch: pytest.MonkeyPatch, empty_tables: str) -> None:
    _env(monkeypatch, FEATURE_AUTH="true", FEATURE_DEMO="true")


@pytest.fixture
def client(demo_on: None) -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def _demo(client: TestClient, headers: dict[str, str] = SAME_ORIGIN):
    return client.post("/api/auth/demo", headers=headers)


# --- Seed -------------------------------------------------------------------------------


def test_fr50_first_seed_creates_demo_with_demo_password(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _env(monkeypatch, DEMO_PASSWORD="s3cret")

    bootstrap(upgrade=False, seed=True)

    [(_id, username, key, password_hash)] = _demo_rows()
    assert (username, key) == ("demo", "demo")
    assert bcrypt.checkpw(b"s3cret", password_hash.encode("ascii"))
    assert _count(UserRow) == 1


def test_fr50_default_demo_password_is_demo(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("DEMO_PASSWORD", raising=False)
    _clear_caches()

    bootstrap(upgrade=False, seed=True)

    [(_id, _username, _key, password_hash)] = _demo_rows()
    assert bcrypt.checkpw(b"demo", password_hash.encode("ascii"))


def test_fr50_seed_adds_no_plan_import_or_counted_account(empty_tables: str) -> None:
    bootstrap(upgrade=False, seed=True)

    assert (_count(PlanRow), _count(ImportRow), _count(LoginAttemptRow)) == (0, 0, 0)
    assert user_store.count_accounts() == 0


def test_fr50_seed_again_leaves_demo_unchanged(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    bootstrap(upgrade=False, seed=True)
    before = _demo_rows()
    _env(monkeypatch, DEMO_PASSWORD="changed")

    bootstrap(upgrade=False, seed=True)
    bootstrap(upgrade=True, seed=True)

    assert _demo_rows() == before
    assert _count(UserRow) == 1


def test_fr50_concurrent_seed_integrity_error_is_success(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Another process inserted `demo` between the check and the insert.
    monkeypatch.setattr(auth.store, "insert_user", lambda _user: False)

    auth.seed_demo_account(now=NOW)

    assert _count(UserRow) == 0


def test_fr50_demo_seed_skips_busy_database_without_crashing(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    # Story 16.0: a locked SQLite database during the startup seed is logged, not raised.
    def busy(_user: object) -> bool:
        raise OperationalError("INSERT", {}, Exception("database is locked"))

    monkeypatch.setattr(user_store, "insert_user", busy)
    caplog.set_level(logging.WARNING, logger="swp.auth")

    auth.seed_demo_account(now=NOW)
    bootstrap(upgrade=False, seed=True)

    assert _count(UserRow) == 0
    messages = [r.getMessage() for r in caplog.records if r.name == "swp.auth"]
    # Production does not seed on start, so the line names `swp db upgrade` first.
    assert (
        messages
        == [
            "Demo account skipped: the database was busy (database is locked). "
            "Run swp db upgrade again to add it; a local start or Demo version also adds it."
        ]
        * 2
    )


def test_fr50_demo_seed_other_operational_error_still_raises(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    def broken(_user: object) -> bool:
        raise OperationalError("INSERT", {}, Exception("no such table: users"))

    monkeypatch.setattr(user_store, "insert_user", broken)

    with pytest.raises(OperationalError):
        auth.seed_demo_account(now=NOW)


def test_fr50_lifespan_with_local_app_env_seeds_demo(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _env(monkeypatch, APP_ENV="local")
    assert _demo_rows() == []

    with TestClient(create_app()):
        pass

    assert [row[1] for row in _demo_rows()] == ["demo"]


def test_fr50_lifespan_outside_local_does_not_seed(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    production_env(monkeypatch)

    with TestClient(create_app()):
        pass

    assert _demo_rows() == []


def test_fr50_seeded_demo_does_not_count_toward_max_accounts(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _env(monkeypatch, FEATURE_AUTH="true", FEATURE_DEMO="true", MAX_ACCOUNTS="1")
    bootstrap(upgrade=False, seed=True)
    assert [row[1] for row in _demo_rows()] == ["demo"]

    with TestClient(create_app()) as client:
        response = client.post(
            "/api/auth/signup",
            json={"username": "kari7", "password": "secret", "password_repeat": "secret"},
            headers=SAME_ORIGIN,
        )

    assert response.status_code == 201, response.text


def test_fr40_login_as_demo_after_seed(empty_tables: str, monkeypatch: pytest.MonkeyPatch) -> None:
    _env(monkeypatch, FEATURE_AUTH="true")  # a local install: auth on, demo flag off

    with TestClient(create_app()) as client:  # the lifespan seeds `demo`
        response = _login(client, "demo", "demo")
        assert response.status_code == 200, response.text
        assert response.json() == {"user": "demo"}
        assert client.get("/api/session").json()["user"] == "demo"


# --- Demo version -----------------------------------------------------------------------


def test_fr50_demo_logs_in_as_demo(client: TestClient) -> None:
    response = _demo(client)

    assert response.status_code == 200, response.text
    assert response.json() == {"user": "demo"}
    assert "swp_session=" in response.headers["set-cookie"]
    session = client.get("/api/session").json()
    assert (session["user"], session["feature_demo"]) == ("demo", True)


def test_fr50_demo_needs_no_body(client: TestClient) -> None:
    response = client.post("/api/auth/demo", json={}, headers=SAME_ORIGIN)

    assert response.status_code == 200, response.text


def test_fr50_demo_skips_bcrypt_when_row_exists(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[str] = []
    monkeypatch.setattr(auth.bcrypt, "checkpw", lambda *_: calls.append("checkpw"))
    monkeypatch.setattr(auth.bcrypt, "hashpw", lambda *_: calls.append("hashpw"))

    assert _demo(client).status_code == 200
    assert calls == []


def test_fr50_demo_and_log_in_ignore_a_lock_row_left_for_demo(client: TestClient) -> None:
    # A `demo` lock counted while the flag was off (or before 2026-11-28) blocks nothing.
    now = datetime.now(UTC)
    for _ in range(LOGIN_MAX_FAILURES):
        assert login_attempts.reserve("demo", now) is True
    locked = {"demo": (LOGIN_MAX_FAILURES, now + LOGIN_LOCK)}
    assert _attempts() == locked

    response = _demo(client)

    assert response.status_code == 200, response.text
    assert response.json() == {"user": "demo"}
    assert _attempts() == locked
    login = _login(client, "demo", "demo")
    assert login.status_code == 200, login.text
    assert _attempts() == locked  # neither read nor written


# --- Log in as `demo` while Demo version is on (decided 2026-11-28) ---------------------


def test_fr50_log_in_as_demo_is_not_throttled_while_demo_is_on(client: TestClient) -> None:
    for username in ("demo", "DEMO", "Demo", "dEmO", "demo", "DEMO"):
        response = _login(client, username, "wrong")
        assert response.status_code == 401, response.text
        assert _error(response)["code"] == "unauthenticated"

    response = _login(client, "Demo", "demo")

    assert response.status_code == 200, response.text
    assert response.json() == {"user": "demo"}
    assert "swp_session=" in response.headers["set-cookie"]
    assert _attempts() == {}


def test_fr50_log_in_as_demo_never_calls_the_throttle_store(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def touched(*_args: object) -> bool:
        raise AssertionError("login_attempts was read or written for demo")

    monkeypatch.setattr(login_attempts, "reserve", touched)
    monkeypatch.setattr(login_attempts, "clear", touched)

    assert _login(client, "demo", "wrong").status_code == 401
    assert _login(client, "DEMO", "demo").status_code == 200


def test_fr50_log_in_as_demo_works_while_login_attempts_is_write_locked(
    client: TestClient,
) -> None:
    with _login_attempts_locked():
        response = _login(client, "demo", "demo")
        # The lock is real: a throttle write fails as busy.
        with pytest.raises(login_attempts.LoginAttemptsBusy):
            login_attempts.clear("demo")

    assert response.status_code == 200, response.text
    assert response.json() == {"user": "demo"}
    assert _attempts() == {}


def test_fr40_log_in_as_demo_is_throttled_while_demo_is_off(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _env(monkeypatch, FEATURE_AUTH="true", FEATURE_DEMO="false")

    with TestClient(create_app()) as client:  # the lifespan seeds `demo`
        for _ in range(LOGIN_MAX_FAILURES):
            assert _login(client, "demo", "wrong").status_code == 401

        response = _login(client, "demo", "demo")

    assert response.status_code == 429, response.text
    assert _error(response)["code"] == "login_locked"
    assert "set-cookie" not in response.headers
    assert [failures for failures, _locked in _attempts().values()] == [LOGIN_MAX_FAILURES]
    assert list(_attempts()) == ["demo"]


def test_fr40_other_username_is_throttled_while_demo_is_on(client: TestClient) -> None:
    auth.signup("Kari7", "secret", "secret", now=NOW)
    for _ in range(LOGIN_MAX_FAILURES):
        assert _login(client, "kari7", "wrong").status_code == 401

    response = _login(client, "kari7", "secret")

    assert response.status_code == 429, response.text
    assert _error(response)["code"] == "login_locked"
    assert "set-cookie" not in response.headers
    assert list(_attempts()) == ["kari7"]
    # `demo` is still open.
    assert _login(client, "demo", "demo").status_code == 200


def test_fr50_demo_seeds_missing_row(client: TestClient) -> None:
    _delete_users()

    response = _demo(client)

    assert response.status_code == 200, response.text
    assert [row[1] for row in _demo_rows()] == ["demo"]
    assert client.get("/api/session").json()["user"] == "demo"


def test_fr50_demo_with_busy_seed_answers_unavailable_without_cookie(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Epic 16 retro F2: no `demo` row, and the seed insert meets a busy database lock.
    _delete_users()

    def busy(_user: object) -> bool:
        raise OperationalError("INSERT", {}, Exception("database is locked"))

    with monkeypatch.context() as locked:
        locked.setattr(user_store, "insert_user", busy)
        response = _demo(client)

    assert response.status_code == 503, response.text
    assert _error(response) == {
        "code": "unavailable",
        "message": "The demo account is busy. Try again.",
        "details": [],
    }
    assert "set-cookie" not in response.headers
    assert _demo_rows() == []

    # The lock is gone: the next press seeds the account and logs in.
    assert _demo(client).status_code == 200
    assert [row[1] for row in _demo_rows()] == ["demo"]


def test_fr50_demo_off_is_not_found(empty_tables: str, monkeypatch: pytest.MonkeyPatch) -> None:
    _env(monkeypatch, FEATURE_AUTH="true", FEATURE_DEMO="false")

    with TestClient(create_app()) as client:
        response = _demo(client)

    assert response.status_code == 404
    assert _error(response) == NOT_FOUND
    assert "set-cookie" not in response.headers


def test_fr50_demo_with_auth_off_is_not_found(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _env(monkeypatch, FEATURE_AUTH="false", FEATURE_DEMO="true")

    with TestClient(create_app()) as client:
        response = _demo(client)

    assert response.status_code == 404
    assert _error(response)["code"] == "not_found"


def test_fr50_cross_site_demo_rejected(client: TestClient) -> None:
    response = _demo(client, headers={"Sec-Fetch-Site": "cross-site"})

    assert response.status_code == 403
    assert _error(response)["code"] == "forbidden_origin"
    assert "set-cookie" not in response.headers


def test_fr50_plan_created_after_demo_login_is_by_demo(client: TestClient) -> None:
    assert _demo(client).status_code == 200

    response = client.post(
        "/api/plans", data={"name": "Demo"}, files=_multipart(_small_files()), headers=SAME_ORIGIN
    )

    assert response.status_code == 201, response.text
    listed = client.get("/api/plans").json()
    assert [(r["created_by"], r["last_edited_by"]) for r in listed] == [("demo", "demo")]
