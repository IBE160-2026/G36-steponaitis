"""FR-39/AD-18 demo limits on SQLite and (CI) Postgres: MAX_ACCOUNTS and MAX_PLANS.

Both apply only with FEATURE_DEMO on and answer `limit_reached` 409; the upload-size
`limit_reached` stays 413.
"""

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from swp.api.app import create_app
from swp.app import limits, plans
from swp.app.imports import read_import
from swp.domain.errors import DomainError
from swp.store import users as user_store
from swp.store.db import get_engine
from swp.store.models import UserRow
from tests.app.test_create_plan import NOW, SAME_ORIGIN, _counts, _multipart, _small_files
from tests.conftest import _clear_caches

ACCOUNT_LIMIT = {
    "code": "limit_reached",
    "message": "The demo has reached its account limit. Use Demo version instead.",
    "details": [{"limit": "max_accounts"}],
}
PLAN_LIMIT = {
    "code": "limit_reached",
    "message": "The demo holds at most 1 plans. Delete a plan to make room.",
    "details": [{"limit": "max_plans"}],
}


@pytest.fixture
def demo_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FEATURE_DEMO", "true")
    monkeypatch.setenv("MAX_ACCOUNTS", "2")
    monkeypatch.setenv("MAX_PLANS", "1")
    _clear_caches()


@pytest.fixture
def demo_off(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FEATURE_DEMO", "false")
    monkeypatch.setenv("MAX_ACCOUNTS", "2")
    monkeypatch.setenv("MAX_PLANS", "1")
    _clear_caches()


@pytest.fixture
def auth_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FEATURE_AUTH", "true")
    _clear_caches()


def _client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def client(empty_tables: str) -> Iterator[TestClient]:
    yield from _client()


def _signup(client: TestClient, username: str, password: str = "secret"):
    return client.post(
        "/api/auth/signup",
        json={"username": username, "password": password, "password_repeat": password},
        headers=SAME_ORIGIN,
    )


def _user_count() -> int:
    """Accounts, not counting the `demo` account the lifespan seeds (FR-50)."""
    with get_engine().connect() as conn:
        return conn.execute(
            select(func.count()).select_from(UserRow).where(UserRow.username_key != "demo")
        ).scalar_one()


def _one_plan() -> plans.StoredPlan:
    return plans.create("First", read_import(_small_files()), now=NOW)


def _upload(client: TestClient):
    return client.post(
        "/api/plans", data={"name": "Second"}, files=_multipart(_small_files()), headers=SAME_ORIGIN
    )


def _reuse(client: TestClient, import_id: uuid.UUID, name: str = "Second"):
    return client.post(
        "/api/plans", data={"name": name, "import_id": str(import_id)}, headers=SAME_ORIGIN
    )


def test_fr39_account_limit_refuses_signup(
    demo_on: None, auth_on: None, client: TestClient
) -> None:
    # The lifespan seeded `demo` (FR-50); it is not counted (AD-18).
    assert user_store.username_key_taken("demo")
    assert _signup(client, "a").status_code == 201
    assert _signup(client, "b").status_code == 201

    response = _signup(client, "c")

    assert response.status_code == 409, response.text
    assert response.json() == {"error": ACCOUNT_LIMIT}
    assert "set-cookie" not in response.headers
    assert _user_count() == 2


def test_fr39_account_limit_checked_before_fields(
    demo_on: None, auth_on: None, client: TestClient
) -> None:
    assert _signup(client, "a").status_code == 201
    assert _signup(client, "b").status_code == 201

    response = _signup(client, "a", password="x")  # taken name and short password

    assert response.status_code == 409
    assert response.json() == {"error": ACCOUNT_LIMIT}


def test_fr39_demo_off_has_no_account_limit(
    demo_off: None, auth_on: None, client: TestClient
) -> None:
    for username in ("a", "b", "c"):
        assert _signup(client, username).status_code == 201
    assert _user_count() == 3


def test_fr39_plan_limit_refuses_upload(demo_on: None, client: TestClient) -> None:
    _one_plan()

    response = _upload(client)

    assert response.status_code == 409, response.text
    assert response.json() == {"error": PLAN_LIMIT}
    assert _counts() == (1, 1)


def test_fr39_plan_limit_refuses_reuse(demo_on: None, client: TestClient) -> None:
    first = _one_plan()

    response = _reuse(client, first.import_id)

    assert response.status_code == 409, response.text
    assert response.json() == {"error": PLAN_LIMIT}
    assert _counts() == (1, 1)


def test_fr39_plan_limit_checked_before_name(demo_on: None, client: TestClient) -> None:
    first = _one_plan()

    response = _reuse(client, first.import_id, name=" ")

    assert response.status_code == 409
    assert response.json() == {"error": PLAN_LIMIT}


def test_fr39_plan_limit_with_room_creates_plan(demo_on: None, client: TestClient) -> None:
    assert _upload(client).status_code == 201
    assert _counts() == (1, 1)


def test_fr39_demo_off_has_no_plan_limit(demo_off: None, client: TestClient) -> None:
    first = _one_plan()

    assert _upload(client).status_code == 201
    assert _reuse(client, first.import_id).status_code == 201
    assert _counts() == (2, 3)


def test_fr39_plan_limit_message_groups_thousands(
    monkeypatch: pytest.MonkeyPatch, empty_tables: str
) -> None:
    monkeypatch.setenv("FEATURE_DEMO", "true")
    monkeypatch.setenv("MAX_PLANS", "1000")
    _clear_caches()
    monkeypatch.setattr(limits.plan_store, "count_plans", lambda: 999)
    limits.ensure_plan_room()  # one plan of room left
    monkeypatch.setattr(limits.plan_store, "count_plans", lambda: 1000)

    with pytest.raises(DomainError) as raised:
        limits.ensure_plan_room()

    assert raised.value.message == (
        "The demo holds at most 1,000 plans. Delete a plan to make room."
    )


def test_fr39_upload_too_large_stays_413(
    demo_on: None, monkeypatch: pytest.MonkeyPatch, empty_tables: str
) -> None:
    monkeypatch.setenv("MAX_UPLOAD_BYTES", "100")
    _clear_caches()
    with TestClient(create_app()) as client:
        response = _upload(client)

    assert response.status_code == 413
    error = response.json()["error"]
    assert error["code"] == "limit_reached"
    assert error["details"] == []
    assert _counts() == (0, 0)
