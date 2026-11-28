"""NFR-6 / AD-10 (Story 9.7): production refuses to start on unsafe or missing settings."""

import errno
import logging
import secrets
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from swp import config
from swp.api.app import create_app
from swp.app.startup import (
    DATABASE_URL_UNSET,
    DEMO_PASSWORD_UNSET,
    SQLITE_ON_VERCEL,
    UNKNOWN_APP_ENV,
    VERCEL_WITHOUT_APP_ENV,
    WEAK_JWT_SECRET,
    StartupRefused,
    check_startup,
    startup_problems,
)
from swp.config import DEFAULT_JWT_SECRET, JWT_SECRET_PLACEHOLDER, Settings, get_settings

# Settings a developer's shell might carry; every test starts without them.
_ENV_NAMES = (
    "APP_ENV",
    "VERCEL",
    "JWT_SECRET",
    "DEMO_PASSWORD",
    "MIGRATION_DATABASE_URL",
    "FEATURE_AUTH",
    "FEATURE_DEMO",
)


@pytest.fixture(autouse=True)
def clean_env(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """DATABASE_URL points at a temporary SQLite file; every other setting is unset."""
    for name in _ENV_NAMES:
        monkeypatch.delenv(name, raising=False)
    get_settings.cache_clear()
    return database_path


def _env(monkeypatch: pytest.MonkeyPatch, **values: str | None) -> None:
    for name, value in values.items():
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)
    get_settings.cache_clear()


def _production(monkeypatch: pytest.MonkeyPatch, **overrides: str | None) -> None:
    """Production with throwaway values that pass the check, then `overrides` (None unsets)."""
    _env(
        monkeypatch,
        APP_ENV="production",
        JWT_SECRET=secrets.token_urlsafe(48),
        DEMO_PASSWORD=secrets.token_hex(8),
    )
    _env(monkeypatch, **overrides)


def _refused(caplog: pytest.LogCaptureFixture) -> tuple[StartupRefused, list[str]]:
    caplog.set_level(logging.ERROR, logger="swp.startup")
    with pytest.raises(StartupRefused) as refused:
        create_app()
    lines = [
        record.getMessage()
        for record in caplog.records
        if record.name == "swp.startup" and record.levelno == logging.ERROR
    ]
    return refused.value, lines


def _starts() -> None:
    with TestClient(create_app()) as client:
        assert client.get("/api/health").status_code == 200


def test_nfr6_production_refuses_default_jwt_secret(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    _production(monkeypatch, JWT_SECRET=None)

    refused, lines = _refused(caplog)

    assert lines == [f"Refusing to start: {WEAK_JWT_SECRET}"]
    assert str(refused) == WEAK_JWT_SECRET
    assert DEFAULT_JWT_SECRET not in caplog.text


def test_nfr6_production_refuses_empty_jwt_secret(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    _production(monkeypatch, JWT_SECRET="")

    _refused_error, lines = _refused(caplog)

    assert lines == [f"Refusing to start: {WEAK_JWT_SECRET}"]


def test_nfr6_production_refuses_placeholder_jwt_secret(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    _production(monkeypatch, JWT_SECRET=JWT_SECRET_PLACEHOLDER)

    refused, lines = _refused(caplog)

    assert lines == [f"Refusing to start: {WEAK_JWT_SECRET}"]
    assert JWT_SECRET_PLACEHOLDER not in caplog.text
    assert JWT_SECRET_PLACEHOLDER not in str(refused)


def test_nfr6_production_refuses_short_jwt_secret(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    short = secrets.token_hex(16)[:31]
    _production(monkeypatch, JWT_SECRET=short)

    refused, lines = _refused(caplog)

    assert lines == [f"Refusing to start: {WEAK_JWT_SECRET}"]
    assert short not in caplog.text
    assert short not in str(refused)


def test_nfr6_jwt_secret_counts_utf8_bytes() -> None:
    # 16 two-byte characters are 32 bytes: long enough, though only 16 characters.
    settings = Settings(
        app_env="production",
        jwt_secret="ø" * 16,
        demo_password="s3cret",
        database_url="sqlite:///x.db",
    )
    assert startup_problems(settings, {}) == []
    assert startup_problems(settings.model_copy(update={"jwt_secret": "ø" * 15 + "x"}), {}) == [
        WEAK_JWT_SECRET
    ]


def test_nfr6_vercel_without_app_env_refuses(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    _env(monkeypatch, VERCEL="1")

    _refused_error, lines = _refused(caplog)

    assert lines == [f"Refusing to start: {VERCEL_WITHOUT_APP_ENV}"]


@pytest.mark.parametrize("app_env", [None, "local"], ids=["unset", "local"])
def test_nfr6_vercel_with_local_app_env_refuses(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture, app_env: str | None
) -> None:
    _env(monkeypatch, VERCEL="1", APP_ENV=app_env)

    refused, lines = _refused(caplog)

    assert lines == [f"Refusing to start: {VERCEL_WITHOUT_APP_ENV}"]
    assert refused.problems == [VERCEL_WITHOUT_APP_ENV]
    assert VERCEL_WITHOUT_APP_ENV == (
        "VERCEL is set but APP_ENV is not production. Set APP_ENV=production."
    )


@pytest.mark.parametrize(
    ("name", "value", "reason"),
    [
        ("DEMO_PASSWORD", "x", "DEMO_PASSWORD: "),
        ("MAX_PLANS", "zz-not-a-number", "MAX_PLANS: "),
    ],
    ids=["short-demo-password", "max-plans-not-a-number"],
)
def test_nfr6_invalid_setting_refuses_without_value(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    capsys: pytest.CaptureFixture[str],
    name: str,
    value: str,
    reason: str,
) -> None:
    # Scoped: the fixtures' teardown reads the settings again and must see valid ones.
    with monkeypatch.context() as bad:
        _env(bad, **{name: value})
        refused, lines = _refused(caplog)
    get_settings.cache_clear()

    assert len(lines) == 1
    assert lines[0].startswith(f"Refusing to start: {reason}")
    assert lines[0].count(f"{name}:") == 1  # no double prefix
    assert "Value error" not in lines[0]
    assert refused.__cause__ is None
    assert refused.__suppress_context__
    shown = caplog.text + str(refused) + "".join(capsys.readouterr())
    assert f"={value}" not in shown and f"'{value}'" not in shown
    assert "input_value" not in shown
    assert "ValidationError" not in shown
    assert "validation error" not in shown.lower()


def test_nfr6_vercel_with_production_app_env_and_postgres_passes_the_check(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # `check_startup()` reads the real environment and opens no database, so no Postgres
    # server is needed and the app is not started.
    with monkeypatch.context() as vercel:
        _production(vercel, VERCEL="1", DATABASE_URL="postgresql://app@db.invalid:6543/postgres")

        check_startup()  # does not raise StartupRefused
    get_settings.cache_clear()


def test_nfr6_unknown_app_env_refuses(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    _env(monkeypatch, APP_ENV="prod")

    _refused_error, lines = _refused(caplog)

    assert lines == [f"Refusing to start: {UNKNOWN_APP_ENV}"]


def test_nfr6_production_refuses_unset_demo_password(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    _production(monkeypatch, DEMO_PASSWORD=None)

    _refused_error, lines = _refused(caplog)

    assert lines == [f"Refusing to start: {DEMO_PASSWORD_UNSET}"]


def test_nfr6_production_refuses_unset_database_url(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    _production(monkeypatch, DATABASE_URL=None)

    _refused_error, lines = _refused(caplog)

    assert lines == [f"Refusing to start: {DATABASE_URL_UNSET}"]


@pytest.mark.parametrize("blank", ["", "   "], ids=["empty", "blanks"])
def test_nfr6_production_refuses_blank_database_url(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture, blank: str
) -> None:
    # Scoped: the fixtures' teardown opens the engine again and needs a real URL.
    with monkeypatch.context() as bad:
        _production(bad, DATABASE_URL=blank)
        refused, lines = _refused(caplog)
    get_settings.cache_clear()

    assert lines == [f"Refusing to start: {DATABASE_URL_UNSET}"]
    assert refused.problems == [DATABASE_URL_UNSET]
    assert refused.__cause__ is None and refused.__suppress_context__  # no traceback


def test_nfr6_blank_database_url_on_vercel_gets_only_the_unset_line() -> None:
    settings = Settings(
        app_env="production", jwt_secret="x" * 32, demo_password="s3cret", database_url="  "
    )

    assert startup_problems(settings, {"VERCEL": "1"}) == [DATABASE_URL_UNSET]


def test_nfr6_vercel_refuses_sqlite_database_url(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
    capsys: pytest.CaptureFixture[str],
    clean_env: Path,
) -> None:
    _production(monkeypatch, VERCEL="1")  # DATABASE_URL is the fixture's SQLite file

    refused, lines = _refused(caplog)

    assert lines == [f"Refusing to start: {SQLITE_ON_VERCEL}"]
    assert refused.problems == [SQLITE_ON_VERCEL]
    assert "SQLite" in SQLITE_ON_VERCEL and "VERCEL" in SQLITE_ON_VERCEL
    # The line never shows the setting's value (NFR-6).
    shown = caplog.text + str(refused) + "".join(capsys.readouterr())
    assert str(clean_env) not in shown and "sqlite://" not in shown


def test_nfr6_sqlite_database_url_is_refused_only_on_vercel() -> None:
    settings = Settings(
        app_env="production",
        jwt_secret="x" * 32,
        demo_password="s3cret",
        database_url="sqlite:///x.db",
    )

    assert startup_problems(settings, {}) == []  # `e2e:production`: production on SQLite
    assert startup_problems(settings, {"VERCEL": ""}) == []
    assert startup_problems(settings, {"VERCEL": "1"}) == [SQLITE_ON_VERCEL]
    upper = settings.model_copy(update={"database_url": " SQLite+pysqlite:///x.db"})
    assert startup_problems(upper, {"VERCEL": "1"}) == [SQLITE_ON_VERCEL]


def test_nfr6_vercel_sqlite_in_an_unwritable_directory_refuses_without_traceback(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture, tmp_path: Path
) -> None:
    # The custom SQLite file's directory cannot be created (on Vercel: a read-only disk; here:
    # its parent is a file). The refusal is the one SQLite line, not an OSError.
    blocker = tmp_path / "read-only"
    blocker.write_text("", encoding="utf-8")
    database = blocker / "data" / "swp.db"
    with pytest.raises(OSError):
        database.parent.mkdir(parents=True, exist_ok=True)

    with monkeypatch.context() as bad:
        _production(bad, VERCEL="1", DATABASE_URL=f"sqlite:///{database}")
        refused, lines = _refused(caplog)
    get_settings.cache_clear()

    assert lines == [f"Refusing to start: {SQLITE_ON_VERCEL}"]
    assert refused.problems == [SQLITE_ON_VERCEL]
    assert refused.__cause__ is None and refused.__suppress_context__


class _ReadOnlyDir:
    """Stands in for VAR_DIR on Vercel, where /var/task is a read-only filesystem."""

    def mkdir(self, *args: object, **kwargs: object) -> None:
        raise OSError(errno.EROFS, "Read-only file system")


def test_nfr6_read_only_filesystem_still_refuses_unset_database_url(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.setattr(config, "VAR_DIR", _ReadOnlyDir())
    _production(monkeypatch, VERCEL="1", DATABASE_URL=None)

    _refused_error, lines = _refused(caplog)

    assert lines == [f"Refusing to start: {DATABASE_URL_UNSET}"]


def test_nfr6_every_problem_logged(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    _env(monkeypatch, APP_ENV="production", DATABASE_URL=None)

    refused, lines = _refused(caplog)

    expected = [WEAK_JWT_SECRET, DEMO_PASSWORD_UNSET, DATABASE_URL_UNSET]
    assert lines == [f"Refusing to start: {problem}" for problem in expected]
    assert refused.problems == expected
    assert str(refused) == "; ".join(expected)


def test_nfr6_production_with_everything_set_starts(monkeypatch: pytest.MonkeyPatch) -> None:
    _production(monkeypatch)

    _starts()


def test_nfr6_local_needs_no_env(monkeypatch: pytest.MonkeyPatch, clean_env: Path) -> None:
    # No env var at all: nothing to refuse (NFR-2).
    with monkeypatch.context() as bare:
        bare.delenv("DATABASE_URL")
        assert startup_problems(Settings(), {}) == []

    # And a local start migrates and seeds as before.
    _starts()
    assert clean_env.exists()
