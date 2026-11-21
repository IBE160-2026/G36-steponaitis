"""FR-15/NFR-8: GET /api/plans/{id}/search?q= on the sample data; read-only."""

import time
import uuid

from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.app.test_parts_api import _sample_plan
from tests.app.test_plan_summary import _row


def test_fr15_search_endpoint_on_sample_caps_lists(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        before = _row(uuid.UUID(plan_id))
        response = client.get(f"/api/plans/{plan_id}/search", params={"q": "a"})

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"version", "query", "parts", "part_count", "locations", "location_count"}
    assert body["version"] == 1
    assert body["query"] == "a"
    assert len(body["parts"]) == 20 < body["part_count"]
    assert len(body["locations"]) == 20 < body["location_count"]
    assert set(body["parts"][0]) == {"part", "description", "movement_class"}
    assert set(body["locations"][0]) == {"location"}
    assert _row(uuid.UUID(plan_id)) == before


def test_fr15_search_blank_query_and_errors(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        blank = client.get(f"/api/plans/{plan_id}/search", params={"q": "  "})
        missing_q = client.get(f"/api/plans/{plan_id}/search")
        missing_plan = client.get(f"/api/plans/{uuid.uuid4()}/search", params={"q": "a"})

    assert blank.status_code == 200
    assert blank.json()["part_count"] == blank.json()["location_count"] == 0
    assert missing_q.status_code == 422
    assert missing_plan.status_code == 404
    assert missing_plan.json()["error"]["code"] == "plan_not_found"


def test_nfr8_search_under_one_second(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        start = time.perf_counter()
        response = client.get(f"/api/plans/{plan_id}/search", params={"q": "a"})
        elapsed = time.perf_counter() - start

    assert response.status_code == 200
    assert elapsed < 1.0, f"{elapsed:.2f} s"
