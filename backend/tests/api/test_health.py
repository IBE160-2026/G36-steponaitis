import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from swp.api.app import create_app
from tests.conftest import production_env


def test_nfr2_health_returns_ok_and_creates_sqlite_file(database_path: Path) -> None:
    assert not database_path.exists()

    with TestClient(create_app()) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert database_path.exists()


def test_nfr2_health_is_mounted_under_api_only(database_path: Path) -> None:
    with TestClient(create_app()) as client:
        assert client.get("/health").status_code == 404


def _tables(path: Path) -> set[str]:
    with sqlite3.connect(path) as conn:
        return {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}


def test_nfr2_local_startup_runs_migrations(database_path: Path) -> None:
    with TestClient(create_app()):
        pass
    assert "alembic_version" in _tables(database_path)


def test_nfr2_production_startup_does_not_migrate(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    production_env(monkeypatch)
    with TestClient(create_app()) as client:
        assert client.get("/api/health").status_code == 200
    assert "alembic_version" not in _tables(database_path)
