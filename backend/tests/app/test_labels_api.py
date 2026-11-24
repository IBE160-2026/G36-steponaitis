"""FR-48: GET /api/imports/{import_id}/labels on stored imports; it never writes."""

import uuid

from fastapi.testclient import TestClient

from swp.api.app import create_app
from swp.app.imports import check_files
from tests.app.test_import_readers import _data_files
from tests.app.test_layout_api import IMMUTABLE, _sample_import


def test_fr48_labels_endpoint_on_demo_data(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        import_id = _sample_import(client)
        response = client.get(f"/api/imports/{import_id}/labels")
        layout = client.get(f"/api/imports/{import_id}/layout").json()

    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == IMMUTABLE
    aisles = response.json()["aisles"]
    assert [aisle["aisle"] for aisle in aisles] == list("ABCDEFGHI")
    codes = [ref["code"] for aisle in aisles for ref in aisle["locations"]]
    # One label per row of the sample's Locations file.
    rows = len(check_files(_data_files("sample", "xlsx"))[0].rows)
    assert len(codes) == len(set(codes)) == rows == 2_000
    # The sample transactions use the virtual location FLSKRS; it is never a label.
    assert "FLSKRS" not in codes
    on_wall = {
        cell["location"]["code"] for a in layout["aisles"] for cell in a["cells"] if not cell["gap"]
    }
    assert set(codes) == on_wall
    assert all(ref["aisle"] == aisle["aisle"] for aisle in aisles for ref in aisle["locations"])
    first = aisles[0]["locations"][0]
    assert first == {
        "code": "A-01-01-01",
        "aisle": "A",
        "level": "1",
        "section": "1",
        "position": "1",
        "is_best": False,
    }


def test_fr48_labels_unknown_import_is_not_found(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        missing = client.get(f"/api/imports/{uuid.uuid4()}/labels")
        malformed = client.get("/api/imports/abc/labels")

    for response in (missing, malformed):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"
        assert "immutable" not in response.headers.get("cache-control", "")
