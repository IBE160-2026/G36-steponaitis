"""tests/app runs on the database chosen by --database-url (CI: Postgres 17), else SQLite."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import delete

from swp.app import categories
from swp.app.bootstrap import bootstrap
from swp.store.db import get_engine
from swp.store.models import (
    AisleCategoryRow,
    ImportRow,
    KeywordRuleRow,
    LoginAttemptRow,
    PlanRow,
    UserRow,
)
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


@pytest.fixture
def empty_tables(app_database: str) -> Iterator[str]:
    """Migrated database with no plans, imports, users, login attempts, keyword rules or aisle
    categories.

    Postgres tests share one database, so every table is emptied first.
    """
    bootstrap(upgrade=True, seed=False)
    with get_engine().begin() as conn:
        conn.execute(delete(PlanRow))
        conn.execute(delete(ImportRow))
        conn.execute(delete(UserRow))
        conn.execute(delete(LoginAttemptRow))
        conn.execute(delete(KeywordRuleRow))
        conn.execute(delete(AisleCategoryRow))
    yield app_database


@pytest.fixture
def without_starter_categories(empty_tables: str, monkeypatch: pytest.MonkeyPatch) -> str:
    """`empty_tables` where `bootstrap(seed=True)` (the TestClient lifespan) seeds no starter
    categories (FR-47), for tests that start from empty keyword rules and aisle categories."""
    monkeypatch.setattr(categories, "seed_starter_categories", lambda **_: False)
    return empty_tables
