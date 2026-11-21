"""tests/app runs on the database chosen by --database-url (CI: Postgres 17), else SQLite."""

from collections.abc import Iterator
from pathlib import Path

import pytest

from swp.store.db import get_engine
from tests.conftest import _clear_caches


@pytest.fixture
def app_database(
    request: pytest.FixtureRequest, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[str]:
    url = request.config.getoption("--database-url") or f"sqlite:///{tmp_path / 'var' / 'app.db'}"
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setenv("APP_ENV", "local")
    _clear_caches()
    yield url
    get_engine().dispose()
    _clear_caches()
