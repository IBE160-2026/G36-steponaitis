"""Shared fixtures: every test gets its own SQLite file and fresh caches."""

import secrets
from collections.abc import Iterator
from pathlib import Path

import pytest

from swp.config import get_settings
from swp.store.db import get_engine


def pytest_addoption(parser: pytest.Parser) -> None:
    # An option, not an env var: a misspelt option fails pytest instead of silently
    # falling back to SQLite (CI runs tests/app against Postgres 17, AD-9).
    parser.addoption(
        "--database-url",
        default="",
        help="Database URL for tests/app (default: a fresh temporary SQLite file).",
    )


def production_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """APP_ENV=production with throwaway values that pass the startup check (AD-10, NFR-6).

    DATABASE_URL is left as the fixtures set it (already in the environment, so it counts as
    set); JWT_SECRET is random per call, so no secret is ever committed. Only the settings
    cache is cleared: the database is unchanged, so a running test client keeps its engine.
    """
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", secrets.token_urlsafe(48))
    monkeypatch.setenv("DEMO_PASSWORD", secrets.token_hex(8))
    get_settings.cache_clear()


def _clear_caches() -> None:
    get_settings.cache_clear()
    get_engine.cache_clear()


@pytest.fixture
def database_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    path = tmp_path / "var" / "test.db"
    path.parent.mkdir()
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{path}")
    monkeypatch.setenv("APP_ENV", "local")
    _clear_caches()
    yield path
    get_engine().dispose()
    _clear_caches()
