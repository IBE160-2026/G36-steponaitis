"""Shared fixtures: every test gets its own SQLite file and fresh caches."""

import secrets
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import event, text

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


class LockNotAvailable(Exception):
    """Stands in for psycopg's LockNotAvailable: Postgres `lock_timeout` passed (55P03)."""

    sqlstate = "55P03"


# The driver causes `store.db.is_busy` accepts, one per backend.
BUSY_CAUSES = [
    pytest.param(Exception("database is locked"), id="sqlite-locked"),
    pytest.param(LockNotAvailable("canceling statement due to lock timeout"), id="pg-55P03"),
]


@contextmanager
def table_write_locked(table: str) -> Iterator[None]:
    """Another writer really holds the lock: SQLite BEGIN IMMEDIATE (the whole file), Postgres
    LOCK TABLE `table`. Reads still work; a write transaction fails as busy."""
    engine = get_engine()
    if engine.dialect.name == "sqlite":
        database = engine.url.database
        assert database is not None
        engine.dispose()

        def short_busy_timeout(dbapi_connection: Any, _record: Any) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA busy_timeout=50")
            cursor.close()

        event.listen(engine, "connect", short_busy_timeout)
        holder = sqlite3.connect(database, isolation_level=None)
        try:
            holder.execute("BEGIN IMMEDIATE")
            yield
        finally:
            holder.execute("ROLLBACK")
            holder.close()
            event.remove(engine, "connect", short_busy_timeout)
            engine.dispose()  # no pooled connection keeps the short busy timeout
    else:
        # Each write transaction waits `PG_LOCK_TIMEOUT` (3 s), then gets 55P03.
        with engine.connect() as holder:
            holder.begin()
            holder.execute(text(f"LOCK TABLE {table} IN EXCLUSIVE MODE"))
            try:
                yield
            finally:
                holder.rollback()
