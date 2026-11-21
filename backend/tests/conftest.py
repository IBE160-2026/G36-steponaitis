"""Shared fixtures: every test gets its own SQLite file and fresh caches."""

from collections.abc import Iterator
from pathlib import Path

import pytest

from swp.config import get_settings
from swp.store.db import get_engine


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
