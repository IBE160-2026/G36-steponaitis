"""FR-46 the category check over the API on SQLite and (CI) Postgres: read-only, one replay."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from swp.api.app import create_app
from swp.app import categories
from swp.config import get_settings
from swp.store.plans import get_plan
from tests.app.test_apply_command import (
    _answer_key_after_run,
    _apply_body,
    _command,
    _manual_body,
)
from tests.app.test_create_plan import NOW, SAME_ORIGIN
from tests.app.test_fr45_aisle_categories_api import _plan
from tests.app.test_plan_summary import _row
from tests.app.test_undo_api import _undo_body


@pytest.fixture
def client(without_starter_categories: str) -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def _rule(keyword: str, category: str) -> None:
    categories.create_rule(keyword, category, now=NOW)


def _aisle(aisle: str, values: list[str]) -> None:
    categories.set_aisle_categories(aisle, values)


def _check(client: TestClient, plan_id: str) -> dict[str, Any]:
    response = client.get(f"/api/plans/{plan_id}/category-check")
    assert response.status_code == 200, response.text
    return response.json()


def _rows_of(view: dict[str, Any], part: str) -> list[dict[str, Any]]:
    return [row for row in view["rows"] if row["part"] == part]


def _error(response: Any) -> dict[str, Any]:
    body = response.json()
    assert set(body) == {"error"}
    return body["error"]


def test_fr46_check_lists_part_outside_its_aisle(client: TestClient) -> None:
    # LOC_CSV aisles A, A10, A2, B; INV_CSV holds P1 "Bolt" at A-01.
    plan_id = _plan()
    _rule("bolt", "Fasteners")
    _aisle("A", ["Oils", " filters"])
    _aisle("B", ["Fasteners"])
    before = _row(uuid.UUID(plan_id))

    first = _check(client, plan_id)
    second = _check(client, plan_id)

    assert first == {
        "version": 1,
        "rows": [
            {
                "part": "P1",
                "description": "Bolt",
                "category": "Fasteners",
                "current_location": {
                    "code": "A-01",
                    "aisle": "A",
                    "level": "1",
                    "section": None,
                    "position": None,
                    "is_best": False,
                },
                "aisle_categories": ["filters", "Oils"],
            }
        ],
        "outside_count": 1,
        "aisles_without_categories": 2,
    }
    assert second == first
    # Read-only: the plan's version and last edit are unchanged.
    assert _row(uuid.UUID(plan_id)) == before


def test_fr46_part_in_its_aisle_is_not_listed(client: TestClient) -> None:
    plan_id = _plan()
    _rule("bolt", "Fasteners")
    _aisle("A", [" FASTENERS"])

    view = _check(client, plan_id)

    assert view["rows"] == []
    assert view["outside_count"] == 0
    assert view["aisles_without_categories"] == 3


def _empty_location_outside(client: TestClient, plan_id: str, aisle: str) -> str:
    rows = client.get(f"/api/plans/{plan_id}/locations").json()["locations"]
    return next(
        r["location"]["code"] for r in rows if not r["occupied"] and r["location"]["aisle"] != aisle
    )


def test_fr46_check_follows_move_and_undo(client: TestClient) -> None:
    plan_id, _rec_id = _answer_key_after_run(client)  # version 3
    _rule("Door mirror glass - Mazda 3", "Mirrors")
    _aisle("B", ["Lights"])  # 9300 is at B-01-03-02; every other aisle has no categories
    target = _empty_location_outside(client, plan_id, "B")

    listed = _check(client, plan_id)
    [row] = _rows_of(listed, "9300")
    assert listed["version"] == 3
    assert row["category"] == "Mirrors"
    assert row["current_location"]["code"] == "B-01-03-02"
    assert row["aisle_categories"] == ["Lights"]

    moved = _command(client, plan_id, _manual_body("9300", "B-01-03-02", target, 3))
    assert moved.status_code == 200, moved.text
    after_move = _check(client, plan_id)
    assert after_move["version"] == 4
    assert _rows_of(after_move, "9300") == []

    undone = _command(client, plan_id, _undo_body(1, 4))
    assert undone.status_code == 200, undone.text
    after_undo = _check(client, plan_id)
    assert after_undo["version"] == 5
    assert _rows_of(after_undo, "9300") == [row]


def test_fr46_applied_recommendation_into_other_category_aisle_is_listed(
    client: TestClient,
) -> None:
    plan_id, rec_id = _answer_key_after_run(client)  # aisle A best, run 1 done (version 3)
    stored = get_plan(uuid.UUID(plan_id))
    assert stored is not None
    recommendation = stored.state.runs[-1].recommendations[0]
    part = recommendation.part
    description = stored.imported.data.parts[part]
    to_aisle = stored.imported.data.locations[recommendation.to_location].aisle
    from_aisle = stored.imported.data.locations[recommendation.from_location].aisle
    assert from_aisle != to_aisle
    _rule(description, "Checked")
    _aisle(to_aisle, ["Filters"])

    assert _rows_of(_check(client, plan_id), part) == []

    applied = _command(client, plan_id, _apply_body(rec_id, 3))
    assert applied.status_code == 200, applied.text
    view = _check(client, plan_id)
    [row] = _rows_of(view, part)
    assert view["version"] == 4
    assert row["category"] == "Checked"
    assert row["current_location"]["code"] == recommendation.to_location
    assert row["current_location"]["aisle"] == to_aisle
    assert row["current_location"]["is_best"] is True
    assert row["aisle_categories"] == ["Filters"]


@pytest.mark.parametrize("plan_id", [str(uuid.uuid4()), "abc"], ids=["unknown", "malformed"])
def test_fr46_unknown_plan(client: TestClient, plan_id: str) -> None:
    response = client.get(f"/api/plans/{plan_id}/category-check")

    assert response.status_code == 404
    assert _error(response)["code"] == "plan_not_found"


def test_fr46_login_required_when_auth_on(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    plan_id = _plan()
    monkeypatch.setenv("FEATURE_AUTH", "true")
    get_settings.cache_clear()

    with TestClient(create_app()) as client:
        response = client.get(f"/api/plans/{plan_id}/category-check", headers=SAME_ORIGIN)

    assert response.status_code == 401
    assert _error(response)["code"] == "unauthenticated"
