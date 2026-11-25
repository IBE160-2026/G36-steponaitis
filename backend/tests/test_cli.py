import json
import logging
import secrets
import sqlite3
from pathlib import Path

import pytest

from swp.app.startup import DEMO_PASSWORD_UNSET
from swp.cli import main
from swp.config import get_settings
from swp.store.db import get_engine


def _tables(path: Path) -> set[str]:
    with sqlite3.connect(path) as conn:
        return {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}


def test_nfr2_cli_db_upgrade_runs_migrations(database_path: Path) -> None:
    assert main(["db", "upgrade"]) == 0
    assert {
        "alembic_version",
        "imports",
        "plans",
        "users",
        "login_attempts",
        "keyword_rules",
        "aisle_categories",
    } <= _tables(database_path)


def test_fr50_cli_db_upgrade_seeds_one_demo_user(database_path: Path) -> None:
    assert main(["db", "upgrade"]) == 0
    assert main(["db", "upgrade"]) == 0

    with sqlite3.connect(database_path) as conn:
        users = conn.execute("SELECT username, username_key FROM users").fetchall()
        plans = conn.execute("SELECT count(*) FROM plans").fetchone()
    assert users == [("demo", "demo")]
    assert plans == (0,)


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
    # FR-50: Demo version.
    assert set(schema["paths"]["/api/auth/demo"]["post"]["responses"]) >= {"200", "403", "404"}
    assert "get" in schema["paths"]["/api/session"]
    assert "ErrorEnvelope" in schema["components"]["schemas"]


def test_fr50_cli_db_upgrade_refuses_production_without_demo_password(
    database_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    caplog: pytest.LogCaptureFixture,
) -> None:
    # NFR-6 (Story 9.7): production must choose the demo password; nothing is migrated or seeded.
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", secrets.token_urlsafe(48))
    monkeypatch.delenv("DEMO_PASSWORD", raising=False)
    monkeypatch.delenv("VERCEL", raising=False)
    get_settings.cache_clear()
    caplog.set_level(logging.ERROR, logger="swp.startup")

    assert main(["db", "upgrade"]) == 2

    assert _refusal_lines(caplog) == [f"Refusing to start: {DEMO_PASSWORD_UNSET}"]
    _assert_no_second_line(capsys)
    assert not database_path.exists() or "users" not in _tables(database_path)


def _assert_no_second_line(capsys: pytest.CaptureFixture[str]) -> str:
    """No `swp: refusing` print and no logging lastResort copy on stderr; the `swp` handler
    (stdout) may carry the one logged line."""
    out, err = capsys.readouterr()
    assert "refusing to start" not in err.lower()
    assert "swp: refusing" not in out
    assert out.count("Refusing to start") <= 1
    return out + err


def _refusal_lines(caplog: pytest.LogCaptureFixture) -> list[str]:
    return [
        record.getMessage()
        for record in caplog.records
        if record.name == "swp.startup" and record.levelno == logging.ERROR
    ]


def test_nfr6_cli_db_upgrade_invalid_setting_prints_one_line_without_value(
    database_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    caplog: pytest.LogCaptureFixture,
) -> None:
    # One `Refusing to start:` line through the `swp` handler, no print, no traceback.
    caplog.set_level(logging.ERROR, logger="swp.startup")
    # Start without a `swp` handler, so the one stdout line proves `swp db upgrade` sets it up.
    monkeypatch.setattr(logging.getLogger("swp"), "handlers", [])
    # Scoped: the fixture's teardown reads the settings again and must see valid ones.
    with monkeypatch.context() as bad:
        bad.setenv("DEMO_PASSWORD", "x")
        get_settings.cache_clear()
        assert main(["db", "upgrade"]) == 2
    get_settings.cache_clear()

    lines = _refusal_lines(caplog)
    assert len(lines) == 1
    assert lines[0].startswith("Refusing to start: DEMO_PASSWORD: ")
    assert "DEMO_PASSWORD: DEMO_PASSWORD" not in lines[0]
    out, err = capsys.readouterr()
    assert out.count("Refusing to start: DEMO_PASSWORD: ") == 1
    assert "refusing to start" not in err.lower()
    assert "swp: refusing" not in out
    printed = out + err
    assert "Traceback" not in printed
    assert "x" not in lines[0].removeprefix("Refusing to start: DEMO_PASSWORD: ").split()
    assert logging.getLogger("swp").handlers, "configure_logging() gives swp a handler"
    assert not database_path.exists() or "users" not in _tables(database_path)


def test_nfr6_cli_db_upgrade_uses_migration_database_url(
    database_path: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The app database is already migrated (the seed runs through DATABASE_URL); the migration
    # URL names a second, empty database, which `swp db upgrade` migrates instead.
    assert main(["db", "upgrade"]) == 0
    migration_path = tmp_path / "migration.db"
    monkeypatch.setenv("MIGRATION_DATABASE_URL", f"sqlite:///{migration_path}")
    get_settings.cache_clear()
    get_engine.cache_clear()

    assert main(["db", "upgrade"]) == 0

    assert {"alembic_version", "plans", "users"} <= _tables(migration_path)
    assert get_settings().database_url == f"sqlite:///{database_path}"
