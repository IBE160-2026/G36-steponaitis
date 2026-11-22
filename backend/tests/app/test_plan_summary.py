"""FR-7/FR-8/FR-9: the plan summary and saved-plans list only read the database."""

import dataclasses
import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select, update

from swp.api.app import create_app
from swp.app import plans
from swp.app.imports import read_import
from swp.domain.state import AisleMark
from swp.store.db import get_engine
from swp.store.models import PlanRow
from swp.store.plans import insert_plan_with_import
from tests.app.test_create_plan import SAME_ORIGIN, _multipart, _small_files
from tests.app.test_import_readers import _data_files

NOW = datetime(2026, 11, 21, 10, 0, tzinfo=UTC)


def _create(name: str, now: datetime) -> uuid.UUID:
    return plans.create(name, read_import(_small_files()), now=now).id


def _row(plan_id: uuid.UUID) -> tuple[int, str, datetime]:
    with get_engine().connect() as conn:
        row = conn.execute(select(PlanRow).where(PlanRow.id == plan_id)).one()
    return row.version, row.last_edited_by, row.last_edited_at


def test_fr7_summary_from_sample_files(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        created = client.post(
            "/api/plans",
            data={"name": "Demo"},
            files=_multipart(_data_files("sample", "xlsx")),
            headers=SAME_ORIGIN,
        )
        assert created.status_code == 201, created.text
        response = client.get(f"/api/plans/{created.json()['id']}")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "Demo"
    assert body["data_as_of"] == "2026-09-30"
    assert body["period_start"] == "2025-10-01"
    assert body["period_end"] == "2026-09-30"
    assert body["uploaded_at"].endswith("Z")
    assert body["current_round"] == 0
    assert body["version"] == 1
    assert body["class_counts"] == {"fast": 80, "medium": 249, "slow": 580, "dead": 636}
    assert body["best_locations"] == 0
    assert body["empty_best_locations"] == 0
    assert [s["checked"] for s in body["steps"]] == [True] * 4 + [False] * 4
    counts = {s["key"]: s["count"] for s in body["steps"]}
    assert counts["locations"] == 2_000
    assert counts["parts"] > 0
    # find_pick_groups on the sample import (minimum 5 shared jobs) gives 127 groups.
    assert counts["pick-groups"] == 127
    assert body["settings"]["fast_min_picks"] == 24


def test_fr9_get_never_writes(empty_tables: str) -> None:
    plan_id = _create("Read only", NOW)
    before = _row(plan_id)

    with TestClient(create_app()) as client:
        for _ in range(3):
            assert client.get(f"/api/plans/{plan_id}").status_code == 200
            assert client.get("/api/plans").status_code == 200

    assert _row(plan_id) == before
    assert before[0] == 1


def test_fr8_list_most_recently_edited_first(empty_tables: str) -> None:
    a = _create("A", NOW)
    b = _create("B", NOW + timedelta(minutes=5))
    with get_engine().begin() as conn:
        conn.execute(
            update(PlanRow).where(PlanRow.id == b).values(last_edited_at=NOW + timedelta(hours=1))
        )

    with TestClient(create_app()) as client:
        response = client.get("/api/plans")

    assert response.status_code == 200
    rows = response.json()
    assert [row["id"] for row in rows] == [str(b), str(a)]
    assert set(rows[0]) == {
        "id",
        "name",
        "data_as_of",
        "uploaded_at",
        "created_by",
        "created_at",
        "last_edited_by",
        "last_edited_at",
    }
    assert rows[0]["name"] == "B"
    assert rows[0]["data_as_of"] == "2026-09-30"
    assert rows[0]["last_edited_at"].endswith("Z")


def test_fr8_list_ties_broken_by_created_then_id(empty_tables: str) -> None:
    older = _create("Older", NOW)
    newer = _create("Newer", NOW + timedelta(minutes=1))
    with get_engine().begin() as conn:
        conn.execute(update(PlanRow).values(last_edited_at=NOW + timedelta(hours=2)))

    with TestClient(create_app()) as client:
        ids = [row["id"] for row in client.get("/api/plans").json()]

    assert ids == [str(newer), str(older)]


def test_fr8_list_ties_broken_by_id(empty_tables: str) -> None:
    a = _create("A", NOW)
    b = _create("B", NOW + timedelta(minutes=1))
    with get_engine().begin() as conn:
        conn.execute(update(PlanRow).values(created_at=NOW, last_edited_at=NOW))

    with TestClient(create_app()) as client:
        ids = [row["id"] for row in client.get("/api/plans").json()]

    assert ids == [str(plan_id) for plan_id in sorted([a, b])]


def test_fr8_list_empty(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        response = client.get("/api/plans")

    assert response.status_code == 200
    assert response.json() == []


def test_fr9_unknown_plan_not_found(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        response = client.get(f"/api/plans/{uuid.uuid4()}")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "plan_not_found"
    assert response.json()["error"]["message"] == "This plan does not exist."


def test_fr9_bad_id_validation_failed(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        response = client.get("/api/plans/abc")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_failed"


def test_fr22_summary_and_locations_carry_stored_marks(empty_tables: str) -> None:
    created = plans.require(_create("Source", NOW))
    data = created.imported.data
    aisle = min(location.aisle for location in data.locations.values())
    marked = dataclasses.replace(
        created,
        id=uuid.uuid4(),
        import_id=(import_id := uuid.uuid4()),
        imported=dataclasses.replace(created.imported, id=import_id),
        state=created.state.model_copy(update={"best_marks": [AisleMark(aisle=aisle)]}),
    )
    insert_plan_with_import(marked)
    in_aisle = {code for code, location in data.locations.items() if location.aisle == aisle}
    stocked = {line.location for line in data.inventory if line.quantity > 0}

    with TestClient(create_app()) as client:
        summary = client.get(f"/api/plans/{marked.id}")
        locations = client.get(f"/api/plans/{marked.id}/locations")

    assert summary.status_code == 200, summary.text
    assert summary.json()["best_locations"] == len(in_aisle) > 0
    assert summary.json()["empty_best_locations"] == len(in_aisle - stocked)
    assert locations.status_code == 200, locations.text
    for row in locations.json()["locations"]:
        if row["location"]["code"] in in_aisle:
            assert row["location"]["is_best"] is True
            assert row["covering_marks"] == [{"kind": "aisle", "aisle": aisle}]
        else:
            assert row["location"]["is_best"] is False
            assert row["covering_marks"] == []
