"""FR-48: GET /api/plans/{plan_id}/labels on the sample plan; it never writes the plan."""

import uuid
from typing import Any

from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.app.test_create_plan import SAME_ORIGIN
from tests.app.test_manual_move_api import _empty_location, _move, _single_location_part
from tests.app.test_parts_api import _sample_plan
from tests.app.test_plan_summary import _row


def _pairs(body: dict[str, Any]) -> list[tuple[str, str]]:
    return [
        (label["location"]["code"], label["part"])
        for aisle in body["aisles"]
        for label in aisle["labels"]
    ]


def test_fr48_labels_endpoint_on_sample_plan(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        before = _row(uuid.UUID(plan_id))
        response = client.get(f"/api/plans/{plan_id}/labels")
        locations = client.get(f"/api/plans/{plan_id}/locations").json()["locations"]

    assert response.status_code == 200, response.text
    # A plan changes, so its labels are never cached immutably.
    assert "immutable" not in response.headers.get("cache-control", "")
    body = response.json()
    assert set(body) == {"version", "aisles"}
    assert body["version"] == 1
    aisles = body["aisles"]
    assert [aisle["aisle"] for aisle in aisles] == list("ABCDEFGHI")
    assert all(set(aisle) == {"aisle", "labels"} for aisle in aisles)
    first = aisles[0]["labels"][0]
    assert set(first) == {"location", "part"}
    assert set(first["location"]) == {"code", "aisle", "level", "section", "position", "is_best"}
    assert all(
        label["location"]["aisle"] == aisle["aisle"]
        for aisle in aisles
        for label in aisle["labels"]
    )
    # One label per stocked (location, part) of the plan: the locations view's contents.
    pairs = _pairs(body)
    stocked = {
        (row["location"]["code"], content["part"])
        for row in locations
        for content in row["contents"]
    }
    assert len(pairs) == len(set(pairs))
    assert set(pairs) == stocked
    assert {code for code, _ in pairs} == {
        row["location"]["code"] for row in locations if row["occupied"]
    }
    # The sample transactions use the virtual location FLSKRS; it is never a label.
    assert "FLSKRS" not in {code for code, _ in pairs}
    # Locations in Walk Path order within every aisle (numeric, ties by code).
    walk = {row["location"]["code"]: float(row["walk_path"]) for row in locations}
    for aisle in aisles:
        keys = [
            (walk[label["location"]["code"]], label["location"]["code"], label["part"])
            for label in aisle["labels"]
        ]
        assert keys == sorted(keys)
    assert _row(uuid.UUID(plan_id)) == before


def test_fr48_labels_follow_a_manual_move_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        part, source = _single_location_part(client, plan_id)
        target = _empty_location(client, plan_id)
        before = _pairs(client.get(f"/api/plans/{plan_id}/labels").json())
        command = client.post(
            f"/api/plans/{plan_id}/commands",
            json=_move(part, source, target),
            headers=SAME_ORIGIN,
        )
        response = client.get(f"/api/plans/{plan_id}/labels")

    assert command.status_code == 200, command.text
    assert (source, part) in before
    assert not any(code == target for code, _ in before)
    body = response.json()
    assert body["version"] == 2
    after = _pairs(body)
    # The label follows the part: (target, part) is new and (source, part) is gone.
    assert (target, part) in after
    assert (source, part) not in after
    assert [pair for pair in after if pair[0] == target] == [(target, part)]
    assert set(after) - {(target, part)} == set(before) - {(source, part)}


def test_fr48_labels_two_parts_in_one_location_over_http(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        plan_id = _sample_plan(client)
        part, source = _single_location_part(client, plan_id)
        locations = client.get(f"/api/plans/{plan_id}/locations").json()["locations"]
        # A location that holds exactly one other part: the move puts a second part in it.
        row = next(
            r
            for r in locations
            if len(r["contents"]) == 1
            and r["location"]["code"] != source
            and r["contents"][0]["part"] != part
        )
        target, resident = row["location"]["code"], row["contents"][0]["part"]
        command = client.post(
            f"/api/plans/{plan_id}/commands",
            json=_move(part, source, target),
            headers=SAME_ORIGIN,
        )
        after = _pairs(client.get(f"/api/plans/{plan_id}/labels").json())

    assert command.status_code == 200, command.text
    # One label per part of the shared location, in part-number (text) order.
    assert [pair for pair in after if pair[0] == target] == [
        (target, first) for first in sorted([part, resident])
    ]
    assert not any(code == source for code, _ in after)


def test_fr48_labels_unknown_plan_is_plan_not_found(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        missing = client.get(f"/api/plans/{uuid.uuid4()}/labels")
        malformed = client.get("/api/plans/abc/labels")
        import_route = client.get(f"/api/imports/{uuid.uuid4()}/labels")

    for response in (missing, malformed):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "plan_not_found"
    # The import-scoped labels route is gone, not kept beside the plan one.
    assert import_route.status_code == 404
    paths = create_app().openapi()["paths"]
    assert "/api/plans/{plan_id}/labels" in paths
    assert not any(path.startswith("/api/imports/") and path.endswith("/labels") for path in paths)
