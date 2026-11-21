"""Database engine, sessions, health ping and programmatic Alembic upgrade (AD-9)."""

from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path
from typing import Any

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session

from swp.config import get_settings

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


def _enable_sqlite_foreign_keys(dbapi_connection: Any, _record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


@lru_cache
def get_engine() -> Engine:
    engine = create_engine(get_settings().database_url)
    if engine.dialect.name == "sqlite":
        event.listen(engine, "connect", _enable_sqlite_foreign_keys)
    return engine


@contextmanager
def transaction() -> Iterator[Session]:
    """A session in one transaction: committed on success, rolled back on any exception."""
    with Session(get_engine(), expire_on_commit=False) as session, session.begin():
        yield session


def ping() -> None:
    """Run SELECT 1; raises if the database is unreachable."""
    with get_engine().connect() as conn:
        conn.execute(text("SELECT 1"))


def upgrade_to_head() -> None:
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    # ConfigParser interpolation: escape % (URL-encoded passwords).
    config.set_main_option("sqlalchemy.url", get_settings().database_url.replace("%", "%%"))
    command.upgrade(config, "head")
