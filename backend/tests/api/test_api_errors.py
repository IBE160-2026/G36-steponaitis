"""AD-11 envelope, AD-19 same-origin guard (NFR-6), AD-12 limits, session and request log."""

import logging
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from swp.api.app import create_app
from swp.store.db import get_engine
from swp.store.models import ImportRow, PlanRow
from tests.app.test_import_readers import INV_CSV, LOC_CSV, TX_CSV
from tests.conftest import _clear_caches

SAME_ORIGIN = {"Origin": "http://testserver"}
FILES = {
    "locations": ("Locations.csv", LOC_CSV),
    "inventory": ("Inventory.csv", INV_CSV),
    "transactions": ("transactions.csv", TX_CSV),
}


@pytest.fixture
def client(database_path: Path) -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def _counts() -> tuple[int, int]:
    with get_engine().connect() as conn:
        return (
            conn.execute(select(func.count()).select_from(ImportRow)).scalar_one(),
            conn.execute(select(func.count()).select_from(PlanRow)).scalar_one(),
        )


def _post(
    client: TestClient,
    *,
    name: str = "Plan",
    files: dict[str, tuple[str, bytes]] | None = None,
    headers: dict[str, str] | None = None,
):
    return client.post(
        "/api/plans",
        data={"name": name},
        files=FILES if files is None else files,
        headers=SAME_ORIGIN if headers is None else headers,
    )


def _error(response) -> dict[str, object]:
    body = response.json()
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message", "details"}
    return body["error"]


def test_fr1_small_files_create_plan(client: TestClient) -> None:
    response = _post(client)

    assert response.status_code == 201, response.text
    assert _counts() == (1, 1)


def test_fr1_sec_fetch_site_same_origin_accepted(client: TestClient) -> None:
    assert _post(client, headers={"Sec-Fetch-Site": "same-origin"}).status_code == 201


def test_nfr6_forwarded_host_matching_origin_accepted(client: TestClient) -> None:
    headers = {"Origin": "http://localhost:3000", "X-Forwarded-Host": "localhost:3000, proxy"}
    assert _post(client, headers=headers).status_code == 201


def test_nfr6_cross_site_post_rejected(client: TestClient) -> None:
    response = _post(client, headers={"Sec-Fetch-Site": "cross-site", **SAME_ORIGIN})

    assert response.status_code == 403
    assert _error(response) == {
        "code": "forbidden_origin",
        "message": "This request came from another site.",
        "details": [],
    }
    assert _counts() == (0, 0)


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Origin": "http://evil.example"},
        {"Origin": "null"},
        {"Origin": "http://testserver:8080"},
        {"Sec-Fetch-Site": "same-site"},
    ],
    ids=["no-headers", "other-origin", "null-origin", "other-port", "same-site"],
)
def test_nfr6_origin_guard_rejects(client: TestClient, headers: dict[str, str]) -> None:
    response = _post(client, headers=headers)

    assert response.status_code == 403
    assert _error(response)["code"] == "forbidden_origin"
    assert _counts() == (0, 0)


def test_nfr6_origin_guard_skips_get(client: TestClient) -> None:
    response = client.get("/api/session", headers={"Sec-Fetch-Site": "cross-site"})
    assert response.status_code == 200


def test_fr1_blank_name_rejected(client: TestClient) -> None:
    response = _post(client, name="  ")

    assert response.status_code == 422
    assert _error(response) == {
        "code": "validation_failed",
        "message": "Give the plan a name.",
        "details": [{"field": "name", "message": "Give the plan a name."}],
    }
    assert _counts() == (0, 0)


def test_fr1_empty_name_rejected(client: TestClient) -> None:
    response = _post(client, name="")

    assert response.status_code == 422
    assert _error(response) == {
        "code": "validation_failed",
        "message": "Give the plan a name.",
        "details": [{"field": "name", "message": "Give the plan a name."}],
    }
    assert _counts() == (0, 0)


def test_fr1_missing_file_field_rejected(client: TestClient) -> None:
    files = {key: value for key, value in FILES.items() if key != "transactions"}
    response = _post(client, files=files)

    assert response.status_code == 422
    error = _error(response)
    assert error["code"] == "validation_failed"
    assert [d["field"] for d in error["details"]] == ["transactions"]  # type: ignore[union-attr]
    assert _counts() == (0, 0)


def test_nfr_upload_too_large_rejected(database_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("MAX_UPLOAD_BYTES", "100")
    _clear_caches()
    with TestClient(create_app()) as client:
        response = _post(client)
        assert response.status_code == 413
        assert _error(response) == {
            "code": "limit_reached",
            "message": (
                "The files are larger than 0.0001 MB together. "
                "One New Plan can upload at most 0.0001 MB."
            ),
            "details": [],
        }
        assert _counts() == (0, 0)


def test_nfr_upload_streamed_past_limit_rejected(database_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("MAX_UPLOAD_BYTES", "1000")
    _clear_caches()

    def chunks() -> Iterator[bytes]:
        for _ in range(5):
            yield b"x" * 400

    with TestClient(create_app()) as client:
        response = client.post(
            "/api/plans",
            content=chunks(),
            headers={**SAME_ORIGIN, "Content-Type": "multipart/form-data; boundary=b"},
        )
        assert response.status_code == 413
        assert _error(response)["code"] == "limit_reached"


def test_nfr_upload_limit_message_uses_default_4_mb() -> None:
    from swp.app.limits import upload_too_large

    assert upload_too_large(4_000_000).message == (
        "The files are larger than 4 MB together. One New Plan can upload at most 4 MB."
    )
    assert upload_too_large(4_500_000).message.startswith("The files are larger than 4.5 MB")


def test_nfr_row_limit_rejected(database_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("MAX_ROWS_PER_FILE", "3")
    _clear_caches()
    rows = b"".join(b"Issue Part,P1,FLSKRS,7,2026-09-30\n" for _ in range(4))
    files = {
        **FILES,
        "transactions": (
            "transactions.csv",
            b"Transaction Type,Part,Location,Transaction Code,Date\n" + rows,
        ),
    }
    with TestClient(create_app()) as client:
        response = _post(client, files=files)
        assert response.status_code == 413
        assert _error(response) == {
            "code": "limit_reached",
            "message": "transactions.csv has more than 3 rows. One file can hold at most 3.",
            "details": [],
        }
        assert _counts() == (0, 0)


def test_nfr_unknown_route_returns_not_found_envelope(client: TestClient) -> None:
    response = client.get("/api/nope")

    assert response.status_code == 404
    assert _error(response) == {"code": "not_found", "message": "Not found.", "details": []}


def test_nfr_wrong_method_returns_not_found_envelope(client: TestClient) -> None:
    response = client.put("/api/health", headers=SAME_ORIGIN)

    assert response.status_code == 404
    assert _error(response) == {"code": "not_found", "message": "Not found.", "details": []}


def test_nfr_unexpected_error_returns_internal_envelope(
    database_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    app: FastAPI = create_app()

    @app.get("/api/boom")
    def boom() -> None:
        raise RuntimeError("boom")

    with (
        caplog.at_level(logging.ERROR, logger="swp.error"),
        TestClient(app, raise_server_exceptions=False) as client,
    ):
        response = client.get("/api/boom")

    assert response.status_code == 500
    assert _error(response) == {
        "code": "internal",
        "message": "Something went wrong. Try again.",
        "details": [],
    }
    records = [r for r in caplog.records if r.name == "swp.error"]
    assert records and records[0].exc_info is not None


def test_nfr_request_log_line(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="swp.request"):
        client.get("/api/health")

    lines = [r.getMessage() for r in caplog.records if r.name == "swp.request"]
    assert len(lines) == 1
    method, path, status, ms = lines[0].split(" ")
    assert (method, path, status) == ("GET", "/api/health", "200")
    assert ms.endswith("ms") and ms.removesuffix("ms").isdigit()


def test_nfr_swp_logger_gets_stdout_handler(database_path: Path) -> None:
    create_app()
    assert logging.getLogger("swp").handlers


def test_fr11_session_reports_flags_and_limit(client: TestClient) -> None:
    response = client.get("/api/session")

    assert response.status_code == 200
    assert response.json() == {
        "user": None,
        "feature_auth": False,
        "feature_demo": False,
        "max_upload_bytes": 4_000_000,
    }


def test_nfr6_origin_guard_runs_before_upload_limit(database_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("MAX_UPLOAD_BYTES", "100")
    _clear_caches()
    with TestClient(create_app()) as client:
        response = _post(client, headers={"Sec-Fetch-Site": "cross-site"})

    assert response.status_code == 403
    assert _error(response)["code"] == "forbidden_origin"


def test_nfr6_rejected_post_is_logged(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.INFO, logger="swp.request"):
        _post(client, headers={"Sec-Fetch-Site": "cross-site"})

    lines = [r.getMessage() for r in caplog.records if r.name == "swp.request"]
    assert len(lines) == 1
    method, path, status, ms = lines[0].split(" ")
    assert (method, path, status) == ("POST", "/api/plans", "403")
    assert ms.endswith("ms") and ms.removesuffix("ms").isdigit()


def test_fr11_session_reports_configured_flags_and_limit(database_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("FEATURE_AUTH", "1")
    monkeypatch.setenv("FEATURE_DEMO", "1")
    monkeypatch.setenv("MAX_UPLOAD_BYTES", "1234")
    _clear_caches()
    with TestClient(create_app()) as client:
        response = client.get("/api/session")

    assert response.json() == {
        "user": None,
        "feature_auth": True,
        "feature_demo": True,
        "max_upload_bytes": 1234,
    }


def test_nfr_malformed_multipart_returns_validation_envelope(client: TestClient) -> None:
    response = client.post(
        "/api/plans",
        content=b"garbage",
        headers={**SAME_ORIGIN, "Content-Type": "multipart/form-data; boundary=b"},
    )

    # FastAPI raises HTTPException(400) for an unparsable body: the other-4xx branch.
    assert response.status_code == 422, response.text
    assert _error(response) == {
        "code": "validation_failed",
        "message": "The request is not valid.",
        "details": [],
    }
    assert _counts() == (0, 0)
