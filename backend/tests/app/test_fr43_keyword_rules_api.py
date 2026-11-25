"""FR-43 keyword rules over the API on SQLite and (CI) Postgres: one global, ordered list."""

import json
import sqlite3
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, inspect, select, text
from sqlalchemy.exc import OperationalError

from swp.api.app import create_app
from swp.app import categories, plans
from swp.app.imports import read_import
from swp.config import get_settings
from swp.store import keyword_rules as keyword_rules_store
from swp.store.db import get_engine
from swp.store.models import KeywordRuleRow, PlanRow
from tests.app.test_create_plan import NOW, _small_files

SAME_ORIGIN = {"Origin": "http://testserver"}
TAKEN = "That keyword already has a rule."
GONE = {"code": "not_found", "message": "That keyword rule no longer exists.", "details": []}
T0 = datetime(2026, 1, 5, 9, 0, tzinfo=UTC)  # well before any real request clock
T1 = T0 + timedelta(hours=1)
BUSY = {
    "code": "unavailable",
    "message": "The keyword rules are busy. Try again.",
    "details": [],
}
ORDER_INVALID = {
    "code": "validation_failed",
    "message": "List every keyword rule exactly once.",
    "details": [{"field": "ids", "message": "List every keyword rule exactly once."}],
}
RULES_CHANGED = {
    "code": "command_rejected",
    "message": "The keyword rules were changed elsewhere. The list is reloaded. Try again.",
    "details": [],
}


@pytest.fixture
def client(without_starter_categories: str) -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def _error(response) -> dict[str, object]:
    body = response.json()
    assert set(body) == {"error"}
    return body["error"]


def _create(client: TestClient, keyword: str, category: str):
    return client.post(
        "/api/keyword-rules", json={"keyword": keyword, "category": category}, headers=SAME_ORIGIN
    )


def _rules(client: TestClient) -> list[dict[str, object]]:
    response = client.get("/api/keyword-rules")
    assert response.status_code == 200
    return response.json()["rules"]


def _pairs(client: TestClient) -> list[tuple[object, object, object]]:
    return [(r["position"], r["keyword"], r["category"]) for r in _rules(client)]


def _seed(client: TestClient, *keywords: str) -> list[str]:
    ids = []
    for keyword in keywords:
        response = _create(client, keyword, keyword.title() + "s")
        assert response.status_code == 201
        ids.append(response.json()["id"])
    return ids


def _row_count() -> int:
    with get_engine().connect() as conn:
        return len(conn.execute(select(KeywordRuleRow.id)).all())


def test_fr43_migration_adds_keyword_rules_table(empty_tables: str) -> None:
    columns = inspect(get_engine()).get_columns("keyword_rules")

    assert [c["name"] for c in columns] == ["id", "position", "keyword", "category", "updated_at"]
    assert all(not c["nullable"] for c in columns)


def test_fr43_create_strips_and_appends(client: TestClient) -> None:
    _seed(client, "oil")

    response = _create(client, " filter ", " Filters ")

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"id", "position", "keyword", "category", "updated_at"}
    assert (body["position"], body["keyword"], body["category"]) == (1, "filter", "Filters")
    assert body["updated_at"].endswith("Z")
    assert datetime.fromisoformat(body["updated_at"]).utcoffset() is not None
    uuid.UUID(body["id"])
    assert _pairs(client) == [(0, "oil", "Oils"), (1, "filter", "Filters")]


def _plan_rows() -> list[tuple[object, object, object]]:
    with get_engine().connect() as conn:
        rows = conn.execute(select(PlanRow.id, PlanRow.version, PlanRow.state).order_by(PlanRow.id))
        return [tuple(row) for row in rows]


def test_fr43_rules_are_global_across_plans(client: TestClient) -> None:
    plans.create("A", read_import(_small_files()), now=NOW)
    plans.create("B", read_import(_small_files()), now=NOW)
    before = _plan_rows()

    (filter_id,) = _seed(client, "filter")
    client.patch(f"/api/keyword-rules/{filter_id}", json={"category": "F"}, headers=SAME_ORIGIN)

    assert [r["keyword"] for r in _rules(client)] == ["filter"]
    assert len(before) == 2
    # No plan's version or stored state changes by a rule write: rules are not in `state`.
    assert _plan_rows() == before


def test_fr43_empty_fields_fail_in_order(client: TestClient) -> None:
    response = _create(client, "", " ")

    assert response.status_code == 422
    assert _error(response) == {
        "code": "validation_failed",
        "message": "Enter a keyword.",
        "details": [
            {"field": "keyword", "message": "Enter a keyword."},
            {"field": "category", "message": "Enter a category."},
        ],
    }
    assert _row_count() == 0


def test_fr43_keyword_without_letters_and_too_long_category(client: TestClient) -> None:
    response = _create(client, "--", "c" * 65)

    assert response.status_code == 422
    assert _error(response)["details"] == [
        {"field": "keyword", "message": "Use letters or numbers in the keyword."},
        {"field": "category", "message": "Use at most 64 characters."},
    ]


@pytest.mark.parametrize("bad", ["oil\u0000", "oil\ud800"], ids=["nul", "lone-surrogate"])
def test_fr43_unstorable_text_is_validation_failed(client: TestClient, bad: str) -> None:
    (oil_id,) = _seed(client, "oil")
    invalid = "Use letters, numbers and ordinary symbols only."
    # json.dumps escapes to ASCII, so a lone surrogate travels as JSON "\ud800".
    headers = {**SAME_ORIGIN, "Content-Type": "application/json"}

    created = client.post(
        "/api/keyword-rules",
        content=json.dumps({"keyword": bad, "category": bad}),
        headers=headers,
    )
    edited = client.patch(
        f"/api/keyword-rules/{oil_id}", content=json.dumps({"category": bad}), headers=headers
    )

    assert created.status_code == 422, created.text
    assert _error(created)["details"] == [
        {"field": "keyword", "message": invalid},
        {"field": "category", "message": invalid},
    ]
    assert edited.status_code == 422, edited.text
    assert _error(edited)["details"] == [{"field": "category", "message": invalid}]
    assert _pairs(client) == [(0, "oil", "Oils")]


def test_fr43_duplicate_keyword_on_create_and_edit(client: TestClient) -> None:
    _, oil_id = _seed(client, "filter", "oil")

    created = _create(client, "FILTER", "Other")
    edited = client.patch(
        f"/api/keyword-rules/{oil_id}", json={"keyword": " Filter "}, headers=SAME_ORIGIN
    )

    for response in (created, edited):
        assert response.status_code == 422
        assert _error(response) == {
            "code": "validation_failed",
            "message": TAKEN,
            "details": [{"field": "keyword", "message": TAKEN}],
        }
    assert _pairs(client) == [(0, "filter", "Filters"), (1, "oil", "Oils")]


def test_fr43_edit_keeps_omitted_field_and_never_conflicts_with_itself(
    client: TestClient,
) -> None:
    filter_id = str(categories.create_rule("filter", "Filters", now=T0).id)

    response = client.patch(
        f"/api/keyword-rules/{filter_id}", json={"keyword": "Filter"}, headers=SAME_ORIGIN
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["id"], body["position"], body["keyword"], body["category"]) == (
        filter_id,
        0,
        "Filter",
        "Filters",
    )
    assert datetime.fromisoformat(body["updated_at"]) > T0

    response = client.patch(
        f"/api/keyword-rules/{filter_id}", json={"category": " Air filters "}, headers=SAME_ORIGIN
    )
    assert response.status_code == 200
    assert _pairs(client) == [(0, "Filter", "Air filters")]


def test_fr43_edit_validates_the_merged_pair(client: TestClient) -> None:
    (filter_id,) = _seed(client, "filter")

    response = client.patch(
        f"/api/keyword-rules/{filter_id}", json={"category": "  "}, headers=SAME_ORIGIN
    )

    assert response.status_code == 422
    assert _error(response)["details"] == [{"field": "category", "message": "Enter a category."}]
    assert _pairs(client) == [(0, "filter", "Filters")]


def test_fr43_delete_closes_the_gap(client: TestClient) -> None:
    _, middle, _ = _seed(client, "oil", "filter", "belt")

    response = client.delete(f"/api/keyword-rules/{middle}", headers=SAME_ORIGIN)

    assert response.status_code == 204
    assert response.content == b""
    assert _pairs(client) == [(0, "oil", "Oils"), (1, "belt", "Belts")]


@pytest.mark.parametrize("rule_id", [str(uuid.uuid4()), "abc", "order"])
def test_fr43_unknown_rule_is_not_found(client: TestClient, rule_id: str) -> None:
    _seed(client, "oil")

    patched = client.patch(
        f"/api/keyword-rules/{rule_id}", json={"keyword": "x"}, headers=SAME_ORIGIN
    )
    deleted = client.delete(f"/api/keyword-rules/{rule_id}", headers=SAME_ORIGIN)

    for response in (patched, deleted):
        assert response.status_code == 404
        assert _error(response) == GONE
    assert _pairs(client) == [(0, "oil", "Oils")]


def _reorder(client: TestClient, ids: list[str], base_ids: list[str]):
    return client.put(
        "/api/keyword-rules/order",
        json={"ids": ids, "base_ids": base_ids},
        headers=SAME_ORIGIN,
    )


def test_fr43_reorder(client: TestClient) -> None:
    ids = _seed(client, "oil", "filter", "belt")

    response = _reorder(client, ids[::-1], ids)

    assert response.status_code == 200
    rules = response.json()["rules"]
    assert [(r["position"], r["id"]) for r in rules] == list(enumerate(ids[::-1]))
    assert _pairs(client) == [(0, "belt", "Belts"), (1, "filter", "Filters"), (2, "oil", "Oils")]


@pytest.mark.parametrize(
    "order",
    [
        lambda ids: ids[:2],
        lambda ids: [*ids, ids[0]],
        lambda ids: [ids[0], ids[0], ids[1]],
        lambda ids: [*ids[:2], str(uuid.uuid4())],
        lambda ids: [*ids[:2], "abc"],
    ],
    ids=["missing", "extra-duplicate", "duplicate", "unknown", "malformed"],
)
def test_fr43_reorder_must_list_every_rule_once(client: TestClient, order) -> None:
    ids = _seed(client, "oil", "filter", "belt")

    response = _reorder(client, order(ids), ids)

    assert response.status_code == 422
    assert _error(response) == ORDER_INVALID
    assert [r["id"] for r in _rules(client)] == ids


def test_fr43_reorder_without_base_is_invalid(client: TestClient) -> None:
    ids = _seed(client, "oil", "filter")

    response = client.put("/api/keyword-rules/order", json={"ids": ids[::-1]}, headers=SAME_ORIGIN)

    assert response.status_code == 422
    assert _error(response)["code"] == "validation_failed"
    assert [r["id"] for r in _rules(client)] == ids


@pytest.mark.parametrize("elsewhere", ["moved", "added", "deleted"])
def test_fr43_reorder_from_stale_list_is_rejected(client: TestClient, elsewhere: str) -> None:
    """Another tab changed the list after this one read it: the same Move up is refused (409)
    with nothing written, also when the submitted ids are still every rule exactly once."""
    seen = _seed(client, "oil", "filter", "belt")
    if elsewhere == "moved":
        assert _reorder(client, [seen[1], seen[0], seen[2]], seen).status_code == 200
    elif elsewhere == "added":
        _seed(client, "chain")
    else:
        assert client.delete(f"/api/keyword-rules/{seen[2]}", headers=SAME_ORIGIN).is_success
    current = [r["id"] for r in _rules(client)]

    # Move "filter" up in the list this tab still shows.
    response = _reorder(client, [seen[1], seen[0], seen[2]], seen)

    assert response.status_code == 409
    assert _error(response) == RULES_CHANGED
    assert [r["id"] for r in _rules(client)] == current


WRITES = ["POST", "PATCH", "DELETE", "PUT"]


def _request(client: TestClient, method: str, rule_id: str, headers: dict[str, str]):
    """One call to each keyword rule route; `rule_id` names an existing rule."""
    if method == "GET":
        return client.get("/api/keyword-rules", headers=headers)
    if method == "POST":
        return client.post(
            "/api/keyword-rules", json={"keyword": "belt", "category": "Belts"}, headers=headers
        )
    if method == "PATCH":
        return client.patch(f"/api/keyword-rules/{rule_id}", json={"keyword": "x"}, headers=headers)
    if method == "DELETE":
        return client.delete(f"/api/keyword-rules/{rule_id}", headers=headers)
    return client.put(
        "/api/keyword-rules/order", json={"ids": [rule_id], "base_ids": [rule_id]}, headers=headers
    )


@pytest.mark.parametrize("method", WRITES)
def test_fr43_cross_site_write_forbidden(client: TestClient, method: str) -> None:
    (oil_id,) = _seed(client, "oil")
    before = _rules(client)

    response = _request(client, method, oil_id, {"Sec-Fetch-Site": "cross-site"})

    assert response.status_code == 403
    assert _error(response)["code"] == "forbidden_origin"
    assert _rules(client) == before


@pytest.mark.parametrize("method", ["GET", *WRITES])
def test_fr43_login_required_when_auth_on(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch, method: str
) -> None:
    (oil_id,) = _seed_with_service("oil")
    monkeypatch.setenv("FEATURE_AUTH", "true")
    get_settings.cache_clear()

    with TestClient(create_app()) as client:
        response = _request(client, method, oil_id, SAME_ORIGIN)

    assert response.status_code == 401
    assert _error(response)["code"] == "unauthenticated"
    assert [(r.keyword, r.position) for r in categories.list_rules()] == [("oil", 0)]


def _seed_with_service(*keywords: str, now: datetime = T0) -> list[str]:
    return [
        str(categories.create_rule(keyword, keyword.title() + "s", now=now).id)
        for keyword in keywords
    ]


def _updated(rule_id: str) -> datetime:
    return next(r.updated_at for r in categories.list_rules() if str(r.id) == rule_id)


def test_fr43_edit_sets_updated_at_to_now(empty_tables: str) -> None:
    (oil_id,) = _seed_with_service("oil")

    edited = categories.edit_rule(oil_id, "Oil", None, now=T1)

    assert edited.updated_at == T1
    assert _updated(oil_id) == T1


def test_fr43_delete_touches_only_moved_rules(empty_tables: str) -> None:
    oil, filter_, belt = _seed_with_service("oil", "filter", "belt")

    categories.delete_rule(filter_, now=T1)

    assert [(str(r.id), r.position, r.updated_at) for r in categories.list_rules()] == [
        (oil, 0, T0),
        (belt, 1, T1),
    ]


def test_fr43_reorder_touches_only_moved_rules(empty_tables: str) -> None:
    oil, filter_, belt = _seed_with_service("oil", "filter", "belt")

    rules = categories.reorder_rules([oil, belt, filter_], [oil, filter_, belt], now=T1)

    expected = [(oil, 0, T0), (belt, 1, T1), (filter_, 2, T1)]
    assert [(str(r.id), r.position, r.updated_at) for r in rules] == expected
    assert [(str(r.id), r.position, r.updated_at) for r in categories.list_rules()] == expected


def test_fr43_real_write_lock_is_unavailable(client: TestClient) -> None:
    """Another writer really holds the lock: SQLite BEGIN IMMEDIATE, Postgres LOCK TABLE."""
    _seed(client, "oil")
    before = _rules(client)
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
            response = _create(client, "filter", "Filters")
        finally:
            holder.execute("ROLLBACK")
            holder.close()
            event.remove(engine, "connect", short_busy_timeout)
    else:
        # The app's write transaction waits `PG_LOCK_TIMEOUT` (3 s), then gets 55P03.
        with engine.connect() as holder:
            holder.begin()
            holder.execute(text("LOCK TABLE keyword_rules IN EXCLUSIVE MODE"))
            try:
                response = _create(client, "filter", "Filters")
            finally:
                holder.rollback()

    assert response.status_code == 503, response.text
    assert _error(response) == BUSY
    assert _rules(client) == before


def test_fr43_busy_rules_lock_is_unavailable(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Another writer holds the lock (SQLite "database is locked", pg 55P03): 503, retryable.
    def locked(*_args: object, **_kwargs: object) -> None:
        raise OperationalError("LOCK", {}, Exception("database is locked"))

    monkeypatch.setattr(keyword_rules_store, "_write_rules", locked)

    response = _create(client, "oil", "Oils")

    assert response.status_code == 503
    assert _error(response) == BUSY
