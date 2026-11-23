"""FR-11/FR-9/FR-40: plans, commands and runs record the logged-in user (Story 9.3).

With auth on, `created_by`, `last_edited_by` and a run's `created_by` hold the logged-in
username; with auth off they stay `planner`. SQLite here, Postgres 17 in CI.
"""

import uuid
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from swp.api.app import create_app
from swp.app import auth, plans
from swp.app.imports import read_import
from swp.config import get_settings
from tests.app.test_apply_command import _answer_key_after_run, _command
from tests.app.test_create_plan import NOW, SAME_ORIGIN, _counts, _multipart, _small_files
from tests.app.test_login import LOG_IN, _error, _login
from tests.app.test_reuse_import import _reuse, _row, _send

MARK_A = {"type": "set_best_mark", "mark": {"kind": "aisle", "aisle": "A"}}


@pytest.fixture
def logged_in(empty_tables: str, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("FEATURE_AUTH", "true")
    get_settings.cache_clear()
    auth.signup("Kari7", "secret", "secret", now=NOW)
    with TestClient(create_app()) as client:
        assert _login(client).status_code == 200
        yield client


def _upload(client: TestClient, name: str = "Small") -> str:
    response = client.post(
        "/api/plans", data={"name": name}, files=_multipart(_small_files()), headers=SAME_ORIGIN
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_fr11_upload_and_reuse_record_logged_in_user(logged_in: TestClient) -> None:
    uploaded = _upload(logged_in)
    import_id = logged_in.get(f"/api/plans/{uploaded}").json()["import_id"]
    reused = _reuse(logged_in, "Reused", import_id)
    assert reused.status_code == 201, reused.text

    for plan_id in (uploaded, reused.json()["id"]):
        row = _row(plan_id)
        assert (row.created_by, row.last_edited_by) == ("Kari7", "Kari7")
    listed = logged_in.get("/api/plans").json()
    assert {(r["created_by"], r["last_edited_by"]) for r in listed} == {("Kari7", "Kari7")}


def test_fr11_command_on_old_plan_records_editor(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The plan is made with auth off (by `planner`), then changed by Kari7.
    plan_id = plans.create("Old", read_import(_small_files()), now=NOW).id
    monkeypatch.setenv("FEATURE_AUTH", "true")
    get_settings.cache_clear()
    auth.signup("Kari7", "secret", "secret", now=NOW)
    with TestClient(create_app()) as client:
        assert _login(client).status_code == 200
        _send(client, str(plan_id), MARK_A)
        row = _row(str(plan_id))
        summary = client.get(f"/api/plans/{plan_id}").json()

    assert (row.created_by, row.last_edited_by) == ("planner", "Kari7")
    assert (summary["created_by"], summary["last_edited_by"]) == ("planner", "Kari7")


def test_fr11_command_and_run_record_logged_in_user(logged_in: TestClient) -> None:
    plan_id, _ = _answer_key_after_run(logged_in)

    run = logged_in.get(f"/api/plans/{plan_id}/recommendations").json()["run"]

    assert run["created_by"] == "Kari7"
    assert _row(plan_id).last_edited_by == "Kari7"


def test_fr9_milestone1_plans_still_show_planner(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    plan_id = str(plans.create("Old", read_import(_small_files()), now=NOW).id)
    before = _row(plan_id)
    monkeypatch.setenv("FEATURE_AUTH", "true")
    get_settings.cache_clear()
    auth.signup("Kari7", "secret", "secret", now=NOW)
    with TestClient(create_app()) as client:
        assert _login(client).status_code == 200
        listed = client.get("/api/plans").json()
        summary = client.get(f"/api/plans/{plan_id}").json()
    after = _row(plan_id)

    assert [(r["created_by"], r["last_edited_by"]) for r in listed] == [("planner", "planner")]
    assert (summary["created_by"], summary["last_edited_by"]) == ("planner", "planner")
    assert summary["version"] == before.version == after.version
    assert (after.last_edited_by, after.last_edited_at) == (
        before.last_edited_by,
        before.last_edited_at,
    )


def test_fr11_auth_off_records_planner(empty_tables: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("FEATURE_AUTH", "false")
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        plan_id, _ = _answer_key_after_run(client)
        run = client.get(f"/api/plans/{plan_id}/recommendations").json()["run"]
        import_id = client.get(f"/api/plans/{plan_id}").json()["import_id"]
        reused = _reuse(client, "Reused", import_id).json()["id"]

    row = _row(plan_id)
    assert (row.created_by, row.last_edited_by, run["created_by"]) == ("planner",) * 3
    assert _row(reused).created_by == "planner"


def test_fr40_create_without_session_writes_nothing(
    empty_tables: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    plan_id = str(plans.create("Old", read_import(_small_files()), now=NOW).id)
    import_id = str(_row(plan_id).import_id)
    version = _row(plan_id).version
    counts = _counts()
    monkeypatch.setenv("FEATURE_AUTH", "true")
    get_settings.cache_clear()
    with TestClient(create_app()) as client:
        upload = client.post(
            "/api/plans",
            data={"name": "New"},
            files=_multipart(_small_files()),
            headers=SAME_ORIGIN,
        )
        reuse = _reuse(client, "Reused", import_id)
        command = _command(
            client, plan_id, {"command_id": str(uuid.uuid4()), "base_version": version, **MARK_A}
        )

    for response in (upload, reuse, command):
        assert response.status_code == 401
        assert _error(response) == LOG_IN
    assert _counts() == counts
    assert _row(plan_id).version == version
