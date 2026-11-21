"""Database engine, health ping and programmatic Alembic upgrade (AD-9)."""

from functools import lru_cache
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, text

from swp.config import get_settings

MIGRATIONS_DIR = Path(__file__).resolve().parent / "migrations"


@lru_cache
def get_engine() -> Engine:
    return create_engine(get_settings().database_url)


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
