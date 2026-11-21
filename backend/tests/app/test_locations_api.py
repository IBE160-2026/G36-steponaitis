"""FR-14/NFR-8: GET /api/plans/{id}/locations on the sample data; it never writes the plan."""

import time
import uuid

from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.app.test_parts_api import _sample_plan
from tests.app.test_plan_summary import _row


def test_fr14_locations_endpoint_on_sample(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        before = _row(uuid.UUID(plan_id))
        response = client.get(f"/api/plans/{plan_id}/locations")

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"version", "locations", "aisles", "warehouse"}
    assert body["version"] == 1
    rows = body["locations"]
    assert len(rows) == 2_000
    assert len({row["location"]["code"] for row in rows}) == 2_000
    assert set(rows[0]) == {"location", "walk_path", "occupied", "contents"}
    assert set(rows[0]["location"]) == {"code", "aisle", "level", "section", "position", "is_best"}
    assert isinstance(rows[0]["walk_path"], str)
    with_contents = next(row for row in rows if row["contents"])
    assert set(with_contents["contents"][0]) == {"part", "description", "stock"}
    assert isinstance(with_contents["contents"][0]["stock"], str)
    assert body["warehouse"] == {
        "locations": 2_000,
        "occupied": 1_584,
        "empty": 416,
        "occupied_percent": "79.2",
    }
    aisles = body["aisles"]
    assert [aisle["aisle"] for aisle in aisles] == sorted(aisle["aisle"] for aisle in aisles)
    for field in ("locations", "occupied", "empty"):
        assert sum(aisle[field] for aisle in aisles) == body["warehouse"][field]
    assert sum(1 for row in rows if row["occupied"]) == 1_584
    assert _row(uuid.UUID(plan_id)) == before


def test_fr14_locations_unknown_plan_404(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        missing = client.get(f"/api/plans/{uuid.uuid4()}/locations")
        malformed = client.get("/api/plans/abc/locations")

    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "plan_not_found"
    assert malformed.status_code == 422
    assert malformed.json()["error"]["code"] == "validation_failed"


def test_nfr8_locations_view_under_one_second(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        start = time.perf_counter()
        response = client.get(f"/api/plans/{plan_id}/locations")
        elapsed = time.perf_counter() - start

    assert response.status_code == 200
    assert elapsed < 1.0, f"{elapsed:.2f} s"
