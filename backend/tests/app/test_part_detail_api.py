"""FR-13/FR-20/NFR-8: GET /api/plans/{id}/parts/{part} on the sample data; read-only."""

import time
import uuid

from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.app.test_parts_api import _sample_plan
from tests.app.test_plan_summary import _row


def test_fr13_part_detail_endpoint_on_sample(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        before = _row(uuid.UUID(plan_id))
        first = client.get(f"/api/plans/{plan_id}/parts").json()["parts"][0]
        response = client.get(f"/api/plans/{plan_id}/parts/{first['part']}")

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {
        "version",
        "part",
        "description",
        "movement_class",
        "picks",
        "class_threshold",
        "total_stock",
        "current_location",
        "other_locations",
        "pick_groups",
        "kept_in_place",
    }
    assert body["version"] == 1
    assert body["part"] == first["part"]
    assert body["picks"] == first["picks"]
    assert body["current_location"] == first["current_location"]
    assert body["total_stock"] == first["total_stock"]
    assert [o["location"] for o in body["other_locations"]] == first["other_locations"]
    assert len(body["pick_groups"]) == first["pick_group_count"]
    assert set(body["class_threshold"]) == {"min_picks", "max_picks"}
    assert _row(uuid.UUID(plan_id)) == before


def test_fr13_part_detail_404s(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        missing_part = client.get(f"/api/plans/{plan_id}/parts/nope")
        slashed = client.get(f"/api/plans/{plan_id}/parts/a%2Fb")
        missing_plan = client.get(f"/api/plans/{uuid.uuid4()}/parts/nope")

    assert missing_part.status_code == 404
    assert missing_part.json()["error"]["code"] == "not_found"
    assert missing_part.json()["error"]["message"] == "No part nope in this plan."
    assert slashed.status_code == 404
    assert slashed.json()["error"]["message"] == "No part a/b in this plan."
    assert missing_plan.status_code == 404
    assert missing_plan.json()["error"]["code"] == "plan_not_found"


def test_nfr8_part_detail_under_one_second(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        part = client.get(f"/api/plans/{plan_id}/parts").json()["parts"][0]["part"]
        start = time.perf_counter()
        response = client.get(f"/api/plans/{plan_id}/parts/{part}")
        elapsed = time.perf_counter() - start

    assert response.status_code == 200
    assert elapsed < 1.0, f"{elapsed:.2f} s"
