"""FR-13/NFR-8: GET /api/plans/{id}/parts on the sample data; it never writes the plan."""

import time
import uuid

from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.app.test_create_plan import SAME_ORIGIN, _multipart
from tests.app.test_import_readers import _data_files
from tests.app.test_plan_summary import _row


def _sample_plan(client: TestClient) -> str:
    created = client.post(
        "/api/plans",
        data={"name": "Parts"},
        files=_multipart(_data_files("sample", "xlsx")),
        headers=SAME_ORIGIN,
    )
    assert created.status_code == 201, created.text
    return created.json()["id"]


def test_fr13_parts_endpoint_on_sample(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        before = _row(uuid.UUID(plan_id))
        summary = client.get(f"/api/plans/{plan_id}").json()
        response = client.get(f"/api/plans/{plan_id}/parts")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["version"] == 1
    rows = body["parts"]
    assert len(rows) == sum(summary["class_counts"].values()) == 1_545
    assert rows[0]["rank"] == 1
    assert [row["rank"] for row in rows] == list(range(1, len(rows) + 1))
    assert set(rows[0]) == {
        "rank",
        "part",
        "description",
        "total_stock",
        "total_stock_sort_rank",
        "current_location",
        "other_locations",
        "movement_class",
        "picks",
        "pick_group_count",
        "kept_in_place",
    }
    assert isinstance(rows[0]["total_stock"], str)
    picks = [row["picks"] for row in rows]
    assert picks == sorted(picks, reverse=True)
    assert sum(1 for row in rows if row["current_location"] is None) == 37
    assert _row(uuid.UUID(plan_id)) == before


def test_fr13_parts_unknown_plan_404(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        missing = client.get(f"/api/plans/{uuid.uuid4()}/parts")
        malformed = client.get("/api/plans/abc/parts")

    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "plan_not_found"
    assert malformed.status_code == 422
    assert malformed.json()["error"]["code"] == "validation_failed"


def test_nfr8_parts_view_under_one_second(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        start = time.perf_counter()
        response = client.get(f"/api/plans/{plan_id}/parts")
        elapsed = time.perf_counter() - start

    assert response.status_code == 200
    assert elapsed < 1.0, f"{elapsed:.2f} s"
