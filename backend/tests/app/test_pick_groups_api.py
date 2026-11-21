"""FR-20/NFR-8: GET /api/plans/{id}/pick-groups on the sample data; it never writes the plan."""

import time
import uuid

from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.app.test_parts_api import _sample_plan
from tests.app.test_plan_summary import _row


def test_fr20_pick_groups_endpoint_on_sample(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        before = _row(uuid.UUID(plan_id))
        response = client.get(f"/api/plans/{plan_id}/pick-groups")

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"version", "pick_groups"}
    assert body["version"] == 1
    rows = body["pick_groups"]
    assert rows, "the sample data has pick groups"
    assert set(rows[0]) == {"part_a", "part_b", "shared_jobs", "same_aisle"}
    assert set(rows[0]["part_a"]) == {"part", "description", "aisle"}
    pairs = [(row["part_a"]["part"], row["part_b"]["part"]) for row in rows]
    assert len(pairs) == len(set(pairs))
    for row in rows:
        assert row["part_a"]["part"] < row["part_b"]["part"]
        a, b = row["part_a"]["aisle"], row["part_b"]["aisle"]
        assert row["same_aisle"] == (a is not None and b is not None and a == b)
    aisles = [row[side]["aisle"] for row in rows for side in ("part_a", "part_b")]
    assert any(aisle is not None for aisle in aisles)
    keys = [(-row["shared_jobs"], row["part_a"]["part"], row["part_b"]["part"]) for row in rows]
    assert keys == sorted(keys)
    assert _row(uuid.UUID(plan_id)) == before


def test_fr20_pick_groups_unknown_plan_404(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        missing = client.get(f"/api/plans/{uuid.uuid4()}/pick-groups")
        malformed = client.get("/api/plans/abc/pick-groups")

    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "plan_not_found"
    assert malformed.status_code == 422
    assert malformed.json()["error"]["code"] == "validation_failed"


def test_nfr8_pick_groups_view_under_one_second(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        start = time.perf_counter()
        response = client.get(f"/api/plans/{plan_id}/pick-groups")
        elapsed = time.perf_counter() - start

    assert response.status_code == 200
    assert elapsed < 1.0, f"{elapsed:.2f} s"
