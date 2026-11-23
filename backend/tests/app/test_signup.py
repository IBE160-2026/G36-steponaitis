"""FR-39 Create account on SQLite and (CI) Postgres: users table, hashing, session cookie."""

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, inspect, select

from swp.api.app import create_app
from swp.app import auth
from swp.config import get_settings
from swp.store import users as user_store
from swp.store.db import get_engine
from swp.store.models import UserRow

SAME_ORIGIN = {"Origin": "http://testserver"}
TAKEN = "That username is taken. Try another."
NOW = datetime(2026, 11, 23, 12, 0, tzinfo=UTC)


@pytest.fixture
def auth_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FEATURE_AUTH", "true")
    get_settings.cache_clear()


@pytest.fixture
def client(auth_on: None, empty_tables: str) -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def _signup(
    client: TestClient,
    username: str = "Kari7",
    password: str = "secret",
    password_repeat: str | None = None,
):
    return client.post(
        "/api/auth/signup",
        json={
            "username": username,
            "password": password,
            "password_repeat": password if password_repeat is None else password_repeat,
        },
        headers=SAME_ORIGIN,
    )


# The TestClient lifespan (APP_ENV=local) seeds `demo` (FR-50); these tests count the others.
NOT_DEMO = UserRow.username_key != "demo"


def _rows() -> list[UserRow]:
    with get_engine().connect() as conn:
        return list(conn.execute(select(UserRow).where(NOT_DEMO)).all())  # type: ignore[arg-type]


def _user_count() -> int:
    with get_engine().connect() as conn:
        return conn.execute(select(func.count()).select_from(UserRow).where(NOT_DEMO)).scalar_one()


def _error(response) -> dict[str, object]:
    body = response.json()
    assert set(body) == {"error"}
    return body["error"]


def test_fr39_migration_adds_users_table(empty_tables: str) -> None:
    inspector = inspect(get_engine())

    assert [c["name"] for c in inspector.get_columns("users")] == [
        "id",
        "username",
        "username_key",
        "password_hash",
        "created_at",
    ]
    assert all(not c["nullable"] for c in inspector.get_columns("users"))
    assert inspector.get_pk_constraint("users")["constrained_columns"] == ["id"]
    uniques = [u["column_names"] for u in inspector.get_unique_constraints("users")]
    unique_indexes = [i["column_names"] for i in inspector.get_indexes("users") if i["unique"]]
    assert ["username_key"] in uniques + unique_indexes


def test_fr39_signup_happy_path_sets_session(client: TestClient) -> None:
    response = _signup(client)

    assert response.status_code == 201, response.text
    assert response.json() == {"user": "Kari7"}
    (row,) = _rows()
    assert (row.username, row.username_key) == ("Kari7", "kari7")
    assert row.password_hash != "secret"
    assert bcrypt.checkpw(b"secret", row.password_hash.encode("ascii"))
    assert row.created_at.tzinfo is not None

    session = client.get("/api/session")
    assert session.json()["user"] == "Kari7"


def test_fr39_session_cookie_attributes(client: TestClient) -> None:
    response = _signup(client)

    cookie = response.headers["set-cookie"]
    parts = [p.strip() for p in cookie.split(";")]
    name, token = parts[0].split("=", 1)
    attributes = {p.split("=", 1)[0].lower(): p.partition("=")[2] for p in parts[1:]}
    assert name == "swp_session"
    assert "httponly" in attributes
    assert attributes["samesite"].lower() == "lax"
    assert attributes["path"] == "/"
    assert attributes["max-age"] == str(30 * 24 * 60 * 60)
    assert "secure" not in attributes  # APP_ENV=local

    claims = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
    (row,) = _rows()
    assert claims["sub"] == str(row.id)
    assert claims["exp"] - claims["iat"] == 30 * 24 * 60 * 60


def test_fr39_session_cookie_secure_in_production(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    get_settings.cache_clear()

    response = _signup(client)

    assert response.status_code == 201, response.text
    assert "secure" in [p.strip().lower() for p in response.headers["set-cookie"].split(";")]


@pytest.mark.parametrize("second", ["kari7", "KARI7", "Kari7"])
def test_fr39_username_taken_by_casefold(client: TestClient, second: str) -> None:
    assert _signup(client).status_code == 201

    response = _signup(client, second)

    assert response.status_code == 422
    assert "set-cookie" not in response.headers
    assert _error(response) == {
        "code": "validation_failed",
        "message": TAKEN,
        "details": [{"field": "username", "message": TAKEN}],
    }
    assert _user_count() == 1


@pytest.mark.parametrize("username", ["Planner", "DEMO", "planner", "demo"])
def test_fr39_reserved_usernames_rejected(client: TestClient, username: str) -> None:
    response = _signup(client, username)

    assert response.status_code == 422
    assert "set-cookie" not in response.headers
    assert _error(response)["details"] == [{"field": "username", "message": TAKEN}]
    assert _user_count() == 0


@pytest.mark.parametrize(
    ("username", "message"),
    [
        ("", "Enter a username."),
        ("a" * 33, "Use at most 32 letters and numbers."),
        ("ola nordmann", "Use letters and numbers only."),
        ("ola_n", "Use letters and numbers only."),
    ],
    ids=["empty", "33-chars", "space", "underscore"],
)
def test_fr39_bad_username_rejected(client: TestClient, username: str, message: str) -> None:
    response = _signup(client, username)

    assert response.status_code == 422
    assert "set-cookie" not in response.headers
    assert _error(response) == {
        "code": "validation_failed",
        "message": message,
        "details": [{"field": "username", "message": message}],
    }
    assert _user_count() == 0


@pytest.mark.parametrize(
    ("password", "message"),
    [
        ("abc", "Use at least 4 characters."),
        ("a" * 65, "Use at most 64 characters."),
        ("€" * 25, "This password is too long. Use fewer special characters."),
    ],
    ids=["3-chars", "65-chars", "75-bytes"],
)
def test_fr39_password_limits_rejected(client: TestClient, password: str, message: str) -> None:
    response = _signup(client, password=password)

    assert response.status_code == 422
    assert "set-cookie" not in response.headers
    assert _error(response)["details"] == [{"field": "password", "message": message}]
    assert _user_count() == 0


@pytest.mark.parametrize("password", ["a" * 64, "€" * 24], ids=["64-ascii", "72-bytes"])
def test_fr39_password_at_limits_accepted(client: TestClient, password: str) -> None:
    response = _signup(client, password=password)

    assert response.status_code == 201, response.text
    (row,) = _rows()
    assert row.password_hash != password
    assert bcrypt.checkpw(password.encode("utf-8"), row.password_hash.encode("ascii"))


def test_fr39_password_with_lone_surrogate_rejected(client: TestClient) -> None:
    # JSON may carry a lone surrogate (\ud800); it has no UTF-8 form and must not be a 500.
    body = '{"username": "Kari7", "password": "ab\\ud800cd", "password_repeat": "ab\\ud800cd"}'
    response = client.post(
        "/api/auth/signup",
        content=body,
        headers={**SAME_ORIGIN, "Content-Type": "application/json"},
    )

    assert response.status_code == 422, response.text
    assert "set-cookie" not in response.headers
    message = "Use letters, numbers and ordinary symbols only."
    assert _error(response) == {
        "code": "validation_failed",
        "message": message,
        "details": [{"field": "password", "message": message}],
    }
    assert _user_count() == 0


def test_fr39_password_mismatch_rejected(client: TestClient) -> None:
    response = _signup(client, password_repeat="secreT")

    assert response.status_code == 422
    assert "set-cookie" not in response.headers
    message = "The passwords don’t match."
    assert _error(response) == {
        "code": "validation_failed",
        "message": message,
        "details": [{"field": "password_repeat", "message": message}],
    }
    assert _user_count() == 0


def test_fr39_several_errors_listed_username_first(client: TestClient) -> None:
    response = _signup(client, "ola n", password_repeat="other")

    error = _error(response)
    assert error["details"] == [
        {"field": "username", "message": "Use letters and numbers only."},
        {"field": "password_repeat", "message": "The passwords don’t match."},
    ]
    assert error["message"] == "Use letters and numbers only."


def test_fr39_taken_listed_before_password_errors(client: TestClient) -> None:
    assert _signup(client).status_code == 201

    response = _signup(client, "KARI7", password="abc")

    assert [d["field"] for d in _error(response)["details"]] == ["username", "password"]  # type: ignore[union-attr]
    assert _error(response)["message"] == TAKEN


def test_fr39_unique_constraint_race_gives_taken(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert _signup(client).status_code == 201
    # The pre-check misses the other account, as when two sign-ups race.
    monkeypatch.setattr(user_store, "username_key_taken", lambda _key: False)

    response = _signup(client, "kari7")

    assert response.status_code == 422
    assert _error(response)["details"] == [{"field": "username", "message": TAKEN}]
    assert _user_count() == 1


def test_fr39_tampered_cookie_gives_no_user(client: TestClient) -> None:
    token = _signup(client).cookies["swp_session"]
    header, payload, signature = token.split(".")
    # Another payload under the original signature: a different user id would be claimed.
    other = jwt.encode({"sub": str(uuid.uuid4())}, "k" * 40, algorithm="HS256").split(".")[1]
    assert other != payload
    client.cookies.clear()
    client.cookies.set("swp_session", f"{header}.{other}.{signature}")

    response = client.get("/api/session")

    assert response.status_code == 200
    assert response.json()["user"] is None


@pytest.mark.parametrize("token", ["", "not-a-jwt", "a.b.c"])
def test_fr39_garbage_cookie_gives_no_user(client: TestClient, token: str) -> None:
    client.cookies.clear()
    client.cookies.set("swp_session", token)
    assert client.get("/api/session").json()["user"] is None


def test_fr39_token_with_bad_subject_gives_no_user(empty_tables: str, auth_on: None) -> None:
    claims = {"sub": "not-a-uuid", "iat": int(NOW.timestamp()), "exp": int(NOW.timestamp()) + 60}
    token = jwt.encode(claims, get_settings().jwt_secret, algorithm="HS256")
    assert auth.session_user(token, now=NOW) is None


def test_fr39_token_signed_with_other_secret_gives_no_user(
    empty_tables: str, auth_on: None
) -> None:
    signed = auth.signup("Kari7", "secret", "secret", now=NOW)
    (row,) = _rows()
    claims = {"sub": str(row.id), "iat": int(NOW.timestamp()), "exp": int(NOW.timestamp()) + 60}
    other = jwt.encode(claims, "x" * 40, algorithm="HS256")
    assert auth.session_user(signed.token, now=NOW) == "Kari7"
    assert auth.session_user(other, now=NOW) is None


def test_fr39_session_expires_after_30_days(empty_tables: str, auth_on: None) -> None:
    signed = auth.signup("Kari7", "secret", "secret", now=NOW)

    assert auth.session_user(signed.token, now=NOW + timedelta(days=30, seconds=-1)) == "Kari7"
    assert auth.session_user(signed.token, now=NOW + timedelta(days=30)) is None


def test_fr39_expired_cookie_gives_no_user(client: TestClient) -> None:
    _signup(client)
    (row,) = _rows()
    client.cookies.clear()
    client.cookies.set("swp_session", auth.session_token(row.id, now=NOW - timedelta(days=31)))

    assert client.get("/api/session").json()["user"] is None


def test_fr39_deleted_user_gives_no_user(client: TestClient) -> None:
    _signup(client)
    with get_engine().begin() as conn:
        conn.execute(delete(UserRow))

    response = client.get("/api/session")

    assert response.status_code == 200
    assert response.json()["user"] is None


def test_fr39_unknown_user_id_gives_no_user(empty_tables: str, auth_on: None) -> None:
    token = auth.session_token(uuid.uuid4(), now=NOW)
    assert auth.session_user(token, now=NOW) is None


def test_fr39_session_ignores_cookie_when_auth_off(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _signup(client)
    monkeypatch.setenv("FEATURE_AUTH", "false")
    get_settings.cache_clear()

    assert client.get("/api/session").json()["user"] is None


def test_fr39_username_stored_as_typed(empty_tables: str, auth_on: None) -> None:
    auth.signup("ÅsaB2", "secret", "secret", now=NOW)

    (row,) = _rows()
    assert (row.username, row.username_key) == ("ÅsaB2", "åsab2")
    assert row.created_at == NOW
    assert user_store.username_key_taken("åsab2")
    assert not user_store.username_key_taken("asab2")
