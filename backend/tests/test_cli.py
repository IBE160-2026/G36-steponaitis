import sqlite3
from pathlib import Path

from swp.cli import main


def _tables(path: Path) -> set[str]:
    with sqlite3.connect(path) as conn:
        return {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}


def test_nfr2_cli_db_upgrade_runs_migrations(database_path: Path) -> None:
    assert main(["db", "upgrade"]) == 0
    assert "alembic_version" in _tables(database_path)
