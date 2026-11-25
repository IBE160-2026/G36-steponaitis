"""Database engine, sessions, health ping and programmatic Alembic upgrade (AD-9)."""

from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
from typing import Any

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, event, make_url, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from swp.config import get_settings

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"
# How long a Postgres writer waits for a row lock before failing with 55P03 (PlanBusy, 503).
PG_LOCK_TIMEOUT = "3s"


def _configure_sqlite_connection(dbapi_connection: Any, _record: Any) -> None:
    """Enforce foreign keys and use WAL on every SQLite connection.

    WAL lets readers and one writer in different processes (several uvicorn workers share
    the file) work at the same time: with the default rollback journal a commit waits while
    any other connection holds a read lock.
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()


@lru_cache
def get_engine() -> Engine:
    url = get_settings().database_url
    if make_url(url).get_backend_name() == "postgresql":
        # Supabase's transaction pooler (port 6543) hands each transaction any server
        # connection: keep no connections between serverless invocations (NullPool) and send no
        # server-side prepared statements, which a later transaction may not find (AD-9). It
        # applies to every Postgres URL on purpose (also CI's direct connection), where it is
        # harmless.
        return create_engine(url, poolclass=NullPool, connect_args={"prepare_threshold": None})
    engine = create_engine(url)
    if engine.dialect.name == "sqlite":
        event.listen(engine, "connect", _configure_sqlite_connection)
    return engine


@contextmanager
def transaction() -> Iterator[Session]:
    """A session in one transaction: committed on success, rolled back on any exception."""
    with Session(get_engine(), expire_on_commit=False) as session, session.begin():
        yield session


@contextmanager
def write_transaction() -> Iterator[Session]:
    """A transaction for a read-modify-write: on SQLite it starts with BEGIN IMMEDIATE (AD-6).

    pysqlite opens no transaction before a SELECT, so taking the write lock first serializes
    writers across connections and processes; on Postgres the reader locks rows with
    `FOR UPDATE` instead, and `SET LOCAL lock_timeout` makes a held row lock fail with 55P03
    (PlanBusy) after `PG_LOCK_TIMEOUT` rather than wait forever (epic-4 retro item 29).
    """
    with transaction() as session:
        dialect = session.get_bind().dialect.name
        if dialect == "sqlite":
            session.execute(text("BEGIN IMMEDIATE"))
        elif dialect == "postgresql":
            session.execute(text(f"SET LOCAL lock_timeout = '{PG_LOCK_TIMEOUT}'"))
        yield session


_SQLITE_BUSY_CODES = (5, 6)  # SQLITE_BUSY, SQLITE_LOCKED (primary result codes)
_SQLITE_BUSY_TEXT = ("database is locked", "database is busy")
_PG_LOCK_NOT_AVAILABLE = "55P03"


def is_busy(error: OperationalError) -> bool:
    """True when `error` means another writer holds the lock."""
    orig = error.orig
    code = getattr(orig, "sqlite_errorcode", None)
    if isinstance(code, int) and code & 0xFF in _SQLITE_BUSY_CODES:
        return True
    if getattr(orig, "sqlstate", None) == _PG_LOCK_NOT_AVAILABLE:
        return True
    text = str(orig).lower()
    return any(fragment in text for fragment in _SQLITE_BUSY_TEXT)


def ping() -> None:
    """Run SELECT 1; raises if the database is unreachable."""
    with get_engine().connect() as conn:
        conn.execute(text("SELECT 1"))


def upgrade_to_head() -> None:
    # Connect once through the app engine first: on SQLite this switches the file to WAL (the
    # mode is stored in the file); the switch needs an exclusive lock. A multi-worker start must
    # run `swp db upgrade` first (as `e2e:backend` does) so the switch happens before any worker
    # opens the file; the workers' lifespan upgrades are then no-ops.
    ping()
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    # MIGRATION_DATABASE_URL (e.g. a direct connection beside a pooled DATABASE_URL) wins.
    # ConfigParser interpolation: escape % (URL-encoded passwords).
    config.set_main_option("sqlalchemy.url", get_settings().migration_url.replace("%", "%%"))
    command.upgrade(config, "head")
