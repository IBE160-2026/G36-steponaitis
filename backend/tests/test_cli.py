import json
import sqlite3
from pathlib import Path

from swp.cli import main


def _tables(path: Path) -> set[str]:
    with sqlite3.connect(path) as conn:
        return {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}


def test_nfr2_cli_db_upgrade_runs_migrations(database_path: Path) -> None:
    assert main(["db", "upgrade"]) == 0
    assert {"alembic_version", "imports", "plans", "users", "login_attempts"} <= _tables(
        database_path
    )


def test_nfr1_openapi_lists_plans_and_session(capsys) -> None:
    assert main(["openapi"]) == 0

    schema = json.loads(capsys.readouterr().out)
    assert "post" in schema["paths"]["/api/plans"]
    assert set(schema["paths"]["/api/plans"]["post"]["responses"]) >= {
        "201",
        "403",
        "409",
        "413",
        "422",
    }
    # FR-39/FR-40 (AD-18): the demo account limit and the login throttle.
    assert "409" in schema["paths"]["/api/auth/signup"]["post"]["responses"]
    assert "429" in schema["paths"]["/api/auth/login"]["post"]["responses"]
    assert "get" in schema["paths"]["/api/session"]
    assert "ErrorEnvelope" in schema["components"]["schemas"]
