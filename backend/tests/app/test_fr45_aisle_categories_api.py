"""FR-45 aisle categories over the API on SQLite and (CI) Postgres: global, keyed by Aisle text."""

import json
import sqlite3
import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, inspect, select, text
from sqlalchemy.exc import OperationalError

from swp.api.app import create_app
from swp.app import categories, plans
from swp.app.imports import UploadedFile, read_import
from swp.config import get_settings
from swp.store import aisle_categories as aisle_store
from swp.store.db import get_engine
from swp.store.models import AisleCategoryRow, PlanRow
from tests.app.test_create_plan import NOW
from tests.app.test_import_readers import INV_CSV, TX_CSV

SAME_ORIGIN = {"Origin": "http://testserver"}
BUSY = {
    "code": "unavailable",
    "message": "The aisle categories are busy. Try again.",
    "details": [],
}
# Aisles in file order B, A10, A, A2: `aisle_order` is plain `str` order.
LOC_CSV = (
    b"Location,Walk Path,Aisle,Level\n"
    b"A-01,0,A,1\nB-01,1,B,1\nA10-01,2,A10,1\nA-02,3,A,2\nA2-01,4,A2,1\n"
)


@pytest.fixture
def client(without_starter_categories: str) -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def _files() -> dict[str, UploadedFile]:
    return {
        "locations": UploadedFile("Locations.csv", LOC_CSV),
        "inventory": UploadedFile("Inventory.csv", INV_CSV),
        "transactions": UploadedFile("transactions.csv", TX_CSV),
    }


def _plan(name: str = "Plan") -> str:
    return str(plans.create(name, read_import(_files()), now=NOW).id)


def _error(response) -> dict[str, object]:
    body = response.json()
    assert set(body) == {"error"}
    return body["error"]


def _put(client: TestClient, aisle: str, values: list[str], headers=SAME_ORIGIN):
    return client.put(
        f"/api/aisle-categories/{aisle}", json={"categories": values}, headers=headers
    )


def _rule(keyword: str, category: str) -> str:
    return str(categories.create_rule(keyword, category, now=NOW).id)


def _rows() -> list[tuple[str, str]]:
    with get_engine().connect() as conn:
        query = select(AisleCategoryRow.aisle, AisleCategoryRow.category).order_by(
            AisleCategoryRow.aisle, AisleCategoryRow.category
        )
        return [(row.aisle, row.category) for row in conn.execute(query)]


def test_fr45_migration_adds_aisle_categories_table(empty_tables: str) -> None:
    inspector = inspect(get_engine())
    columns = inspector.get_columns("aisle_categories")

    assert [c["name"] for c in columns] == ["aisle", "category"]
    assert all(not c["nullable"] for c in columns)
    assert inspector.get_pk_constraint("aisle_categories")["constrained_columns"] == [
        "aisle",
        "category",
    ]
    assert inspector.get_foreign_keys("aisle_categories") == []


def test_fr45_set_list_strips_sorts_and_marks_has_rule(client: TestClient) -> None:
    _rule("oil", "Oils")

    response = _put(client, "A", [" Oils", "Filters"])

    assert response.status_code == 200, response.text
    expected = {
        "aisle": "A",
        "categories": [
            {"category": "Filters", "has_rule": False},
            {"category": "Oils", "has_rule": True},
        ],
    }
    assert response.json() == expected
    assert client.get("/api/aisle-categories/A").json() == expected
    assert _rows() == [("A", "Filters"), ("A", "Oils")]


def test_fr45_replace_and_clear(client: TestClient) -> None:
    _put(client, "A", ["Oils", "Filters"])
    _put(client, "B", ["Belts"])

    replaced = _put(client, "A", ["Filters"])
    assert replaced.json()["categories"] == [{"category": "Filters", "has_rule": False}]

    cleared = _put(client, "A", [])
    assert cleared.status_code == 200
    assert cleared.json() == {"aisle": "A", "categories": []}
    assert _rows() == [("B", "Belts")]


def test_fr45_has_rule_matches_by_casefold(client: TestClient) -> None:
    _rule("oil", "OILS ")

    response = _put(client, "A", ["oils"])

    assert response.json()["categories"] == [{"category": "oils", "has_rule": True}]


def test_fr45_duplicate_category_writes_nothing(client: TestClient) -> None:
    _put(client, "A", ["Belts"])

    response = _put(client, "A", ["Oils", "oils "])

    assert response.status_code == 422
    message = "That category is already on this aisle."
    assert _error(response) == {
        "code": "validation_failed",
        "message": message,
        "details": [{"field": "categories[1]", "message": message}],
    }
    assert _rows() == [("A", "Belts")]


@pytest.mark.parametrize(
    ("values", "message"),
    [([""], "Enter a category."), (["x" * 65], "Use at most 64 characters.")],
    ids=["empty", "long"],
)
def test_fr45_empty_or_long_category(client: TestClient, values: list[str], message: str) -> None:
    response = _put(client, "A", values)

    assert response.status_code == 422
    assert _error(response) == {
        "code": "validation_failed",
        "message": message,
        "details": [{"field": "categories[0]", "message": message}],
    }
    assert _rows() == []


@pytest.mark.parametrize("bad", ["Oils\u0000", "Oils\ud800"], ids=["nul", "lone-surrogate"])
def test_fr45_unstorable_category(client: TestClient, bad: str) -> None:
    headers = {**SAME_ORIGIN, "Content-Type": "application/json"}

    response = client.put(
        "/api/aisle-categories/A", content=json.dumps({"categories": [bad]}), headers=headers
    )

    assert response.status_code == 422, response.text
    invalid = "Use letters, numbers and ordinary symbols only."
    assert _error(response)["details"] == [{"field": "categories[0]", "message": invalid}]
    assert _rows() == []


@pytest.mark.parametrize(
    ("aisle", "message"),
    [("%20", "Enter an aisle."), ("A" * 65, "Use at most 64 characters.")],
    ids=["blank", "long"],
)
def test_fr45_invalid_aisle(client: TestClient, aisle: str, message: str) -> None:
    got = client.get(f"/api/aisle-categories/{aisle}")
    put = _put(client, aisle, ["Oils"])

    for response in (got, put):
        assert response.status_code == 422
        assert _error(response) == {
            "code": "validation_failed",
            "message": message,
            "details": [{"field": "aisle", "message": message}],
        }
    assert _rows() == []


def test_fr45_unknown_aisle_is_an_empty_list(client: TestClient) -> None:
    response = client.get("/api/aisle-categories/Z9")

    assert response.status_code == 200
    assert response.json() == {"aisle": "Z9", "categories": []}


def test_fr45_aisle_text_is_matched_exactly(client: TestClient) -> None:
    _put(client, "A", ["Oils"])

    assert client.get("/api/aisle-categories/a").json()["categories"] == []
    assert _put(client, "1/2", ["Belts"]).status_code == 200
    assert client.get("/api/aisle-categories/1/2").json()["categories"][0]["category"] == "Belts"
    # The frontend sends encodeURIComponent(aisle): "%2F" reaches the service as "/".
    encoded = _put(client, "1%2F2", ["Oils"])
    assert encoded.status_code == 200
    assert encoded.json()["aisle"] == "1/2"
    assert client.get("/api/aisle-categories/1%2F2").json() == {
        "aisle": "1/2",
        "categories": [{"category": "Oils", "has_rule": False}],
    }
    assert ("1/2", "Oils") in _rows()


def test_fr45_stale_category_is_kept_without_rule(client: TestClient) -> None:
    oil_id = _rule("oil", "Oils")
    _put(client, "A", ["Oils"])

    categories.delete_rule(oil_id, now=NOW)

    assert client.get("/api/aisle-categories/A").json()["categories"] == [
        {"category": "Oils", "has_rule": False}
    ]


def _plan_rows() -> list[tuple[object, object, object]]:
    with get_engine().connect() as conn:
        rows = conn.execute(select(PlanRow.id, PlanRow.version, PlanRow.state).order_by(PlanRow.id))
        return [tuple(row) for row in rows]


def test_fr45_plan_view_lists_import_aisles_and_rule_categories(client: TestClient) -> None:
    plan_id = _plan()
    _rule("filter", "Filters")
    _rule("oil", "Oils")
    _rule("air filter", "filters")
    _put(client, "A2", ["Oils", "Belts"])
    _put(client, "Z", ["Oils"])  # not an aisle of this import
    before = _plan_rows()

    response = client.get(f"/api/plans/{plan_id}/aisle-categories")

    assert response.status_code == 200, response.text
    assert response.json() == {
        "aisles": [
            {"aisle": "A", "categories": []},
            {"aisle": "A10", "categories": []},
            {
                "aisle": "A2",
                "categories": [
                    {"category": "Belts", "has_rule": False},
                    {"category": "Oils", "has_rule": True},
                ],
            },
            {"aisle": "B", "categories": []},
        ],
        "rule_categories": ["Filters", "Oils"],
    }
    assert _plan_rows() == before


def test_fr45_categories_are_global_across_plans(client: TestClient) -> None:
    first, second = _plan("One"), _plan("Two")
    before = _plan_rows()

    _put(client, "A", ["Oils"])

    for plan_id in (first, second):
        view = client.get(f"/api/plans/{plan_id}/aisle-categories").json()
        aisle_a = next(a for a in view["aisles"] if a["aisle"] == "A")
        assert aisle_a["categories"] == [{"category": "Oils", "has_rule": False}]
    # No plan's version or stored state changes: aisle categories are not in `state`.
    assert _plan_rows() == before


@pytest.mark.parametrize("plan_id", [str(uuid.uuid4()), "abc"], ids=["unknown", "malformed"])
def test_fr45_plan_view_unknown_plan(client: TestClient, plan_id: str) -> None:
    response = client.get(f"/api/plans/{plan_id}/aisle-categories")

    assert response.status_code == 404
    assert _error(response)["code"] == "plan_not_found"


def test_fr45_cross_site_put_forbidden(client: TestClient) -> None:
    _put(client, "A", ["Oils"])

    response = _put(client, "A", [], headers={"Sec-Fetch-Site": "cross-site"})

    assert response.status_code == 403
    assert _error(response)["code"] == "forbidden_origin"
    assert _rows() == [("A", "Oils")]


@pytest.mark.parametrize("method", ["GET", "PUT", "PLAN"])
def test_fr45_login_required_when_auth_on(
    without_starter_categories: str, monkeypatch: pytest.MonkeyPatch, method: str
) -> None:
    plan_id = _plan()
    monkeypatch.setenv("FEATURE_AUTH", "true")
    get_settings.cache_clear()

    with TestClient(create_app()) as client:
        if method == "GET":
            response = client.get("/api/aisle-categories/A")
        elif method == "PUT":
            response = _put(client, "A", ["Oils"])
        else:
            response = client.get(f"/api/plans/{plan_id}/aisle-categories")

    assert response.status_code == 401
    assert _error(response)["code"] == "unauthenticated"
    assert _rows() == []


def test_fr45_real_write_lock_is_unavailable(client: TestClient) -> None:
    """Another writer really holds the lock: SQLite BEGIN IMMEDIATE, Postgres LOCK TABLE."""
    _put(client, "A", ["Oils"])
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
            response = _put(client, "A", ["Filters"])
        finally:
            holder.execute("ROLLBACK")
            holder.close()
            event.remove(engine, "connect", short_busy_timeout)
    else:
        # The app's write transaction waits `PG_LOCK_TIMEOUT` (3 s), then gets 55P03.
        with engine.connect() as holder:
            holder.begin()
            holder.execute(text("LOCK TABLE aisle_categories IN EXCLUSIVE MODE"))
            try:
                response = _put(client, "A", ["Filters"])
            finally:
                holder.rollback()

    assert response.status_code == 503, response.text
    assert _error(response) == BUSY
    assert _rows() == [("A", "Oils")]


def test_fr45_busy_lock_is_unavailable(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def locked(*_args: object, **_kwargs: object) -> None:
        raise OperationalError("LOCK", {}, Exception("database is locked"))

    monkeypatch.setattr(aisle_store, "_replace", locked)

    response = _put(client, "A", ["Oils"])

    assert response.status_code == 503
    assert _error(response) == BUSY
