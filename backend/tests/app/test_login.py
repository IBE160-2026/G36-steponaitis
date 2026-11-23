"""FR-40 Log in, Log out and the API login guard on SQLite and (CI) Postgres."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime

import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete

from swp.api.app import create_app
from swp.app import auth
from swp.config import get_settings
from swp.domain.errors import DomainError
from swp.store import users as user_store
from swp.store.db import get_engine
from swp.store.models import UserRow

SAME_ORIGIN = {"Origin": "http://testserver"}
NOW = datetime(2026, 11, 23, 12, 0, tzinfo=UTC)
WRONG_LOGIN = {
    "code": "unauthenticated",
    "message": "Wrong username or password. Check both and try again.",
    "details": [],
}
LOG_IN = {"code": "unauthenticated", "message": "Log in to continue.", "details": []}


@pytest.fixture
def auth_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FEATURE_AUTH", "true")
    get_settings.cache_clear()


@pytest.fixture
def client(auth_on: None, empty_tables: str) -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def account(empty_tables: str, auth_on: None) -> None:
    auth.signup("Kari7", "secret", "secret", now=NOW)


def _login(client: TestClient, username: str = "kari7", password: str = "secret"):
    return client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
        headers=SAME_ORIGIN,
    )


def _error(response) -> dict[str, object]:
    body = response.json()
    assert set(body) == {"error"}
    return body["error"]


def _cookie_attributes(response) -> tuple[str, str, dict[str, str]]:
    parts = [p.strip() for p in response.headers["set-cookie"].split(";")]
    name, value = parts[0].split("=", 1)
    attributes = {p.split("=", 1)[0].lower(): p.partition("=")[2] for p in parts[1:]}
    return name, value, attributes


def test_fr40_login_happy_path_sets_session(client: TestClient, account: None) -> None:
    response = _login(client)

    assert response.status_code == 200, response.text
    assert response.json() == {"user": "Kari7"}
    assert client.get("/api/session").json()["user"] == "Kari7"


def test_fr40_login_cookie_attributes(client: TestClient, account: None) -> None:
    name, token, attributes = _cookie_attributes(_login(client))

    assert name == "swp_session"
    assert token
    assert "httponly" in attributes
    assert attributes["samesite"].lower() == "lax"
    assert attributes["path"] == "/"
    assert attributes["max-age"] == str(30 * 24 * 60 * 60)
    assert "secure" not in attributes  # APP_ENV=local


def test_fr40_login_cookie_secure_in_production(
    client: TestClient, account: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()

    _name, _token, attributes = _cookie_attributes(_login(client))

    assert "secure" in attributes


def test_fr40_wrong_password_rejected(client: TestClient, account: None) -> None:
    response = _login(client, password="secreT")

    assert response.status_code == 401
    assert "set-cookie" not in response.headers
    assert _error(response) == WRONG_LOGIN


def test_fr40_unknown_user_same_as_wrong_password(client: TestClient, account: None) -> None:
    unknown = _login(client, username="nobody")
    wrong = _login(client, password="nope")

    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json()
    assert "set-cookie" not in unknown.headers


@pytest.mark.parametrize(
    ("username", "password"),
    [("", ""), ("kari7", ""), ("", "secret"), ("kari7", "a" * 73), ("kari7", "€" * 25)],
    ids=["both-empty", "empty-password", "empty-username", "73-bytes", "75-bytes"],
)
def test_fr40_odd_input_gives_wrong_login(
    client: TestClient, account: None, username: str, password: str
) -> None:
    response = _login(client, username=username, password=password)

    assert response.status_code == 401, response.text
    assert "set-cookie" not in response.headers
    assert _error(response) == WRONG_LOGIN


def test_fr40_lone_surrogate_password_gives_wrong_login(client: TestClient, account: None) -> None:
    response = client.post(
        "/api/auth/login",
        content='{"username": "kari7", "password": "ab\\ud800cd"}',
        headers={**SAME_ORIGIN, "Content-Type": "application/json"},
    )

    assert response.status_code == 401, response.text
    assert _error(response) == WRONG_LOGIN


def test_fr40_lone_surrogate_username_gives_wrong_login(client: TestClient, account: None) -> None:
    response = client.post(
        "/api/auth/login",
        content='{"username": "ab\\ud800", "password": "secret"}',
        headers={**SAME_ORIGIN, "Content-Type": "application/json"},
    )

    assert response.status_code == 401, response.text
    assert "set-cookie" not in response.headers
    assert _error(response) == WRONG_LOGIN


@pytest.mark.parametrize(
    "path",
    [
        "/api/plans",  # plans
        "/api/plans/{id}/parts",  # parts
        "/api/plans/{id}/locations",  # locations
        "/api/plans/{id}/pick-groups",  # pick_groups
        "/api/plans/{id}/search?q=a",  # search
        "/api/plans/{id}/moves/preview",  # moves
        "/api/plans/{id}/before-after",  # before_after
        "/api/plans/{id}/move-list",  # move_list
        "/api/plans/{id}/recommendations",  # recommendations
    ],
)
def test_fr40_guard_covers_every_data_router(client: TestClient, path: str) -> None:
    # One GET per guarded router (commands is the POST in the tests above): 401 comes before
    # any 404 for the unknown plan or 422 for missing query parameters.
    response = client.get(path.replace("{id}", str(uuid.uuid4())))

    assert response.status_code == 401, response.text
    assert _error(response) == LOG_IN


def test_fr40_login_missing_field_rejected(client: TestClient) -> None:
    response = client.post("/api/auth/login", json={"username": "x"}, headers=SAME_ORIGIN)

    assert response.status_code == 422
    error = _error(response)
    assert error["code"] == "validation_failed"
    assert [d["field"] for d in error["details"]] == ["password"]  # type: ignore[union-attr]


def test_fr40_unknown_user_still_checks_a_hash(
    account: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[bytes] = []
    real = bcrypt.checkpw

    def counting(password: bytes, hashed: bytes) -> bool:
        calls.append(hashed)
        return real(password, hashed)

    monkeypatch.setattr(bcrypt, "checkpw", counting)

    with pytest.raises(DomainError) as raised:
        auth.login("nobody", "secret", now=NOW)

    assert raised.value.code == "unauthenticated"
    assert len(calls) == 1


def test_fr40_login_by_casefolded_key(account: None) -> None:
    assert auth.login("KARI7", "secret", now=NOW).username == "Kari7"
    assert user_store.get_user_by_key("kari7") is not None
    assert user_store.get_user_by_key("KARI7") is None


@pytest.mark.parametrize("with_cookie", [True, False], ids=["with-cookie", "without-cookie"])
def test_fr40_logout_clears_cookie(client: TestClient, account: None, with_cookie: bool) -> None:
    if with_cookie:
        assert _login(client).status_code == 200
    else:
        client.cookies.clear()

    response = client.post("/api/auth/logout", headers=SAME_ORIGIN)

    assert response.status_code == 204
    name, _value, attributes = _cookie_attributes(response)
    assert name == "swp_session"
    assert attributes["max-age"] == "0"
    assert attributes["path"] == "/"
    assert "httponly" in attributes
    assert attributes["samesite"].lower() == "lax"
    assert "secure" not in attributes
    assert client.get("/api/session").json()["user"] is None
    assert client.get("/api/plans").status_code == 401


def test_fr40_logout_cookie_secure_in_production(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()

    response = client.post("/api/auth/logout", headers=SAME_ORIGIN)

    assert response.status_code == 204
    assert "secure" in _cookie_attributes(response)[2]


def _command_post(client: TestClient):
    return client.post(
        f"/api/plans/{uuid.uuid4()}/commands",
        json={
            "type": "set_best_mark",
            "command_id": str(uuid.uuid4()),
            "base_version": 1,
            "mark": {"kind": "aisle", "aisle": "A"},
        },
        headers=SAME_ORIGIN,
    )


@pytest.mark.parametrize("cookie", [None, "not-a-jwt", "tampered"])
def test_fr40_guard_rejects_without_session(
    client: TestClient, account: None, cookie: str | None
) -> None:
    client.cookies.clear()
    if cookie == "tampered":
        token = auth.login("kari7", "secret", now=datetime.now(UTC)).token
        header, payload, signature = token.split(".")
        client.cookies.set("swp_session", f"{header}.{payload}x.{signature}")
    elif cookie is not None:
        client.cookies.set("swp_session", cookie)

    listing = client.get("/api/plans")
    command = _command_post(client)

    assert listing.status_code == 401
    assert _error(listing) == LOG_IN
    assert command.status_code == 401
    assert _error(command) == LOG_IN


def test_fr40_guard_rejects_deleted_user_cookie(client: TestClient, account: None) -> None:
    assert _login(client).status_code == 200
    assert client.get("/api/plans").status_code == 200
    with get_engine().begin() as conn:
        conn.execute(delete(UserRow))

    response = client.get("/api/plans")

    assert response.status_code == 401
    assert _error(response) == LOG_IN


def test_fr40_guard_leaves_open_routes(client: TestClient) -> None:
    assert client.get("/api/health").status_code != 401
    assert client.get("/api/session").status_code == 200
    login = client.post("/api/auth/login", json={}, headers=SAME_ORIGIN)
    assert login.status_code == 422
    signup = client.post(
        "/api/auth/signup",
        json={"username": "Ola1", "password": "secret", "password_repeat": "secret"},
        headers=SAME_ORIGIN,
    )
    assert signup.status_code == 201


def test_fr40_guard_lets_logged_in_user_through(client: TestClient, account: None) -> None:
    assert _login(client).status_code == 200

    response = client.get("/api/plans")

    assert response.status_code == 200, response.text
    assert _command_post(client).status_code == 404


def test_fr40_auth_off_unchanged(empty_tables: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FEATURE_AUTH", "false")
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        plans = client.get("/api/plans")
        login = _login(client)

    assert plans.status_code == 200
    assert login.status_code == 404
    assert _error(login)["code"] == "not_found"
