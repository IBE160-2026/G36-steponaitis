"""FR-42/AD-15: GET /api/imports/{import_id}/layout on stored imports; it never writes."""

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from swp.api.app import create_app
from swp.app import plans
from swp.store.db import get_engine
from swp.store.models import ImportRow
from tests.app.max_size import max_size_import
from tests.app.test_create_plan import SAME_ORIGIN, _multipart
from tests.app.test_import_readers import _data_files

IMMUTABLE = "private, max-age=31536000, immutable"
NOW = datetime(2026, 11, 23, 12, 0, tzinfo=UTC)


def _import_row(import_id: str) -> tuple[Any, ...]:
    with get_engine().connect() as conn:
        row = conn.execute(select(ImportRow).where(ImportRow.id == uuid.UUID(import_id))).one()
    return row.id, row.uploaded_at, row.data_as_of, row.data


def _sample_import(client: TestClient) -> str:
    created = client.post(
        "/api/plans",
        data={"name": "Layout"},
        files=_multipart(_data_files("sample", "xlsx")),
        headers=SAME_ORIGIN,
    )
    assert created.status_code == 201, created.text
    return created.json()["import_id"]


def test_fr42_layout_endpoint_on_demo_data(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        import_id = _sample_import(client)
        before = _import_row(import_id)
        response = client.get(f"/api/imports/{import_id}/layout")
        after = _import_row(import_id)

    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == IMMUTABLE
    assert after == before
    aisles = response.json()["aisles"]
    assert [aisle["aisle"] for aisle in aisles] == list("ABCDEFGHI")
    aisle = aisles[0]
    assert aisle["source"] == "columns"
    assert (aisle["walk_path_first"], aisle["walk_path_last"]) == ("0", "2220")
    top, bottom = aisle["runs"]
    assert [span["section"] for span in top["sections"]] == [str(n) for n in range(1, 11)]
    assert [span["section"] for span in bottom["sections"]] == [str(n) for n in range(11, 20)]
    assert top["levels"] == bottom["levels"] == ["4", "3", "2", "1"]
    assert (top["columns"], bottom["columns"]) == (30, 27)
    assert bottom["sections"][-1] == {"section": "19", "first_column": 24, "columns": 3}
    section_19 = {
        (cell["row"], cell["column"]): cell
        for cell in aisle["cells"]
        if cell["run"] == 1 and cell["column"] >= 24
    }
    gaps = sorted(key for key, cell in section_19.items() if cell["gap"])
    assert gaps == [(0, 24), (0, 25), (0, 26), (1, 25), (1, 26)]
    assert section_19[(0, 24)] == {"run": 1, "row": 0, "column": 24, "gap": True, "location": None}
    assert section_19[(1, 24)]["location"] == {
        "code": "A-19-03-01",
        "aisle": "A",
        "level": "3",
        "section": "19",
        "position": "1",
        "is_best": False,
    }
    on_wall = [cell for a in aisles for cell in a["cells"] if not cell["gap"]]
    assert len(on_wall) == len({cell["location"]["code"] for cell in on_wall}) == 2_000


def test_fr42_layout_unknown_or_malformed_import_404(empty_tables: str) -> None:
    with TestClient(create_app()) as client:
        missing = client.get(f"/api/imports/{uuid.uuid4()}/layout")
        malformed = client.get("/api/imports/abc/layout")

    for response in (missing, malformed):
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"
        assert response.json()["error"]["message"] == (
            "This import no longer exists. Choose another saved plan."
        )
        assert "immutable" not in response.headers.get("cache-control", "")


def test_fr42_layout_max_size_under_4_mb(empty_tables: str) -> None:
    created = plans.create("Max", max_size_import(), now=NOW)

    with TestClient(create_app()) as client:
        response = client.get(f"/api/imports/{created.import_id}/layout")

    assert response.status_code == 200, response.text
    assert sum(len(aisle["cells"]) for aisle in response.json()["aisles"]) == 25_000
    assert len(response.content) < 4_000_000, len(response.content)
