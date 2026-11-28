"""NFR-8 on `data/sample/` in one place: import < 10 s, a run < 5 s, one command plus the plan
views < 1 s in total.

Measured over HTTP with the TestClient (SQLite here, Postgres in CI). The scattered NFR-8
checks next to each endpoint stay; this file is the milestone 1 gate's single timing check.
"""

import time
import uuid
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from swp.api.app import create_app
from swp.app import plans
from tests.app.max_size import NOW, full_max_size_import
from tests.app.test_create_plan import SAME_ORIGIN, _multipart
from tests.app.test_import_readers import _data_files

IMPORT_BUDGET_S = 10.0
RUN_BUDGET_S = 5.0
ACTION_BUDGET_S = 1.0
VIEWS = ["", "/parts", "/locations", "/pick-groups", "/recommendations", "/before-after"]
VIEW_LIMIT_BYTES = 4_000_000


@pytest.fixture
def client(empty_tables: str) -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def _timed(call: Callable[[], Any]) -> tuple[Any, float]:
    start = time.perf_counter()
    response = call()
    return response, time.perf_counter() - start


def _create(client: TestClient) -> Any:
    return client.post(
        "/api/plans",
        data={"name": "NFR-8"},
        files=_multipart(_data_files("sample", "xlsx")),
        headers=SAME_ORIGIN,
    )


def _command(client: TestClient, plan_id: str, body: dict[str, Any]) -> Any:
    response = client.post(
        f"/api/plans/{plan_id}/commands",
        json={"command_id": str(uuid.uuid4()), **body},
        headers=SAME_ORIGIN,
    )
    assert response.status_code == 200, response.text
    return response


def _sample_plan_with_marks(client: TestClient) -> str:
    """The sample plan with aisle A and level 1 marked best (the README demo)."""
    created = _create(client)
    assert created.status_code == 201, created.text
    plan_id: str = created.json()["id"]
    marks = [{"kind": "aisle", "aisle": "A"}, {"kind": "level", "level": "1"}]
    for version, mark in enumerate(marks, start=1):
        _command(client, plan_id, {"type": "set_best_mark", "base_version": version, "mark": mark})
    return plan_id


def test_nfr8_import_under_10_s(client: TestClient) -> None:
    response, elapsed = _timed(lambda: _create(client))

    assert response.status_code == 201, response.text
    assert elapsed < IMPORT_BUDGET_S, f"import plus analysis took {elapsed:.2f} s"


def test_nfr8_run_under_5_s(client: TestClient) -> None:
    plan_id = _sample_plan_with_marks(client)

    response, elapsed = _timed(
        lambda: _command(client, plan_id, {"type": "run", "base_version": 3})
    )

    assert response.json()["events"][0]["type"] == "run_done"
    assert elapsed < RUN_BUDGET_S, f"run took {elapsed:.2f} s"


def test_nfr8_command_plus_views_under_1_s(client: TestClient) -> None:
    plan_id = _sample_plan_with_marks(client)
    _command(client, plan_id, {"type": "run", "base_version": 3})
    recs = client.get(f"/api/plans/{plan_id}/recommendations").json()["recommendations"]
    rec = next((r for r in recs if r["status"] == "open"), None)
    assert rec is not None, "the sample run gave no open recommendation to apply"
    body = {"type": "apply", "base_version": 4, "recommendation_id": rec["id"]}

    timings: dict[str, float] = {}
    response, timings["apply"] = _timed(lambda: _command(client, plan_id, body))
    assert response.json()["version"] == 5
    for view in VIEWS:
        url = f"/api/plans/{plan_id}{view}"
        response, timings[url] = _timed(lambda url=url: client.get(url))
        assert response.status_code == 200, f"{url}: {response.text}"

    slow = {name: f"{seconds:.2f} s" for name, seconds in timings.items()}
    assert sum(timings.values()) < ACTION_BUDGET_S, slow


def test_ad18_nfr8_max_size_plan_views_under_4_mb(client: TestClient) -> None:
    """Every file at MAX_ROWS_PER_FILE rows, best marks, a run and one apply: each plan view
    response body stays under 4 MB as sent (AD-18). The API gzips its responses; plain JSON,
    the parts and locations views of this import are 6-8 MB."""
    imported = full_max_size_import()
    created = plans.create("Max", imported, now=NOW)
    plan_id = str(created.id)
    marks = [{"kind": "aisle", "aisle": "A"}, {"kind": "level", "level": "1"}]
    for version, mark in enumerate(marks, start=1):
        _command(client, plan_id, {"type": "set_best_mark", "base_version": version, "mark": mark})
    run = _command(client, plan_id, {"type": "run", "base_version": len(marks) + 1})
    assert run.json()["events"][0]["type"] == "run_done"
    # One applied recommendation, so the move list and before/after are not empty.
    recs = client.get(f"/api/plans/{plan_id}/recommendations").json()["recommendations"]
    rec = next((r for r in recs if r["status"] == "open"), None)
    assert rec is not None, "the max-size run gave no open recommendation to apply"
    apply = {"type": "apply", "base_version": len(marks) + 2, "recommendation_id": rec["id"]}
    _command(client, plan_id, apply)

    aisles = sorted({location.aisle for location in imported.data.locations.values()})
    urls = [
        f"/api/plans/{plan_id}{view}" for view in [*VIEWS, "/move-list", "/warehouse", "/labels"]
    ]
    urls += [f"/api/plans/{plan_id}/wall?aisle={aisle}" for aisle in aisles]
    urls.append(f"/api/imports/{created.import_id}/layout")
    sizes: dict[str, int] = {}
    for url in urls:
        response = client.get(url, headers={"Accept-Encoding": "gzip"})
        assert response.status_code == 200, f"{url}: {response.text}"
        sizes[url] = response.num_bytes_downloaded

    too_big = {url: size for url, size in sizes.items() if size >= VIEW_LIMIT_BYTES}
    assert not too_big, f"views at or over 4 MB (bytes): {too_big}"
