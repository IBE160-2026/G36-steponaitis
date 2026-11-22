"""FR-37/NFR-8: GET /api/plans/{id}/before-after on the sample data; it never writes the plan
and replays the step log once per request."""

import time
import uuid

import pytest
from fastapi.testclient import TestClient

from swp.api.app import create_app
from swp.domain import before_after as before_after_slice
from swp.domain import planning
from tests.app.test_create_plan import SAME_ORIGIN
from tests.app.test_parts_api import _sample_plan
from tests.app.test_plan_summary import _row

COUNTS = ("fast_in_best", "pick_groups_together", "occupied", "empty")


def test_fr37_before_after_endpoint_on_sample(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        before = _row(uuid.UUID(plan_id))
        response = client.get(f"/api/plans/{plan_id}/before-after")

    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"version", "has_moves", "aisles", "total"}
    assert body["version"] == 1
    assert body["has_moves"] is False
    rows = body["aisles"]
    assert rows, "the sample data has aisles"
    assert set(rows[0]) == {"aisle", "moved_in", "moved_out", *COUNTS}
    assert set(body["total"]) == set(COUNTS)
    for row in rows:
        assert row["moved_in"] == [] and row["moved_out"] == []
        for field in COUNTS:
            assert row[field]["before"] == row[field]["after"], (row["aisle"], field)
    for field in COUNTS:
        total = body["total"][field]
        assert total["before"] == total["after"] == sum(r[field]["before"] for r in rows)
    assert _row(uuid.UUID(plan_id)) == before


def test_fr37_before_after_follows_a_manual_move(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        base = f"/api/plans/{plan_id}"
        locations = client.get(f"{base}/locations").json()["locations"]
        # A location holding one part stored nowhere else: moving it empties the location.
        roster = {r["part"]: r for r in client.get(f"{base}/parts").json()["parts"]}
        source_row = next(
            r
            for r in locations
            if len(r["contents"]) == 1
            and not roster[r["contents"][0]["part"]]["other_locations"]
            and (roster[r["contents"][0]["part"]]["current_location"] or {}).get("code")
            == r["location"]["code"]
        )
        part = source_row["contents"][0]["part"]
        source, source_aisle = source_row["location"]["code"], source_row["location"]["aisle"]
        target_row = next(
            r for r in locations if not r["occupied"] and r["location"]["aisle"] != source_aisle
        )
        target, target_aisle = target_row["location"]["code"], target_row["location"]["aisle"]

        command = client.post(
            f"{base}/commands",
            json={
                "type": "manual_move",
                "command_id": str(uuid.uuid4()),
                "base_version": 1,
                "part": part,
                "from": source,
                "to": target,
            },
            headers=SAME_ORIGIN,
        )
        response = client.get(f"{base}/before-after")

    assert command.status_code == 200, command.text
    body = response.json()
    assert body["version"] == 2
    assert body["has_moves"] is True
    by_aisle = {r["aisle"]: r for r in body["aisles"]}
    assert part in by_aisle[target_aisle]["moved_in"]
    assert part in by_aisle[source_aisle]["moved_out"]
    assert part not in by_aisle[source_aisle]["moved_in"]
    src, dst = by_aisle[source_aisle]["occupied"], by_aisle[target_aisle]["occupied"]
    assert src["after"] == src["before"] - 1
    assert dst["after"] == dst["before"] + 1
    assert by_aisle[source_aisle]["empty"]["after"] == by_aisle[source_aisle]["empty"]["before"] + 1
    assert by_aisle[target_aisle]["empty"]["after"] == by_aisle[target_aisle]["empty"]["before"] - 1
    total = body["total"]["occupied"]
    assert total["before"] == total["after"]


def test_fr37_before_after_uses_one_replay(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[int] = []
    real = planning.replay

    def counting(*args: object, **kwargs: object) -> object:
        calls.append(1)
        return real(*args, **kwargs)  # type: ignore[arg-type]

    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        # Both names: the slice's import and the kernel's own (`planning_copy` calls it).
        monkeypatch.setattr(before_after_slice, "replay", counting)
        monkeypatch.setattr(planning, "replay", counting)
        response = client.get(f"/api/plans/{plan_id}/before-after")

    assert response.status_code == 200, response.text
    assert len(calls) == 1


def test_fr37_before_after_unknown_plan_404(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        missing = client.get(f"/api/plans/{uuid.uuid4()}/before-after")
        malformed = client.get("/api/plans/abc/before-after")

    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "plan_not_found"
    assert malformed.status_code == 422
    assert malformed.json()["error"]["code"] == "validation_failed"


def test_nfr8_before_after_view_under_one_second(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        start = time.perf_counter()
        response = client.get(f"/api/plans/{plan_id}/before-after")
        elapsed = time.perf_counter() - start

    assert response.status_code == 200
    assert elapsed < 1.0, f"{elapsed:.2f} s"
