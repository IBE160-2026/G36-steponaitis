import re
from pathlib import Path

import pytest
from pydantic import ValidationError

from swp import config
from swp.app.startup import DEMO_PASSWORD_UNSET, WEAK_JWT_SECRET, startup_problems


@pytest.fixture
def fresh_settings(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("APP_ENV", raising=False)
    config.get_settings.cache_clear()
    yield
    config.get_settings.cache_clear()


def test_nfr2_default_database_is_sqlite_under_backend_var() -> None:
    backend_dir = Path(__file__).resolve().parent.parent
    assert config.VAR_DIR == backend_dir / "var"
    assert config.DEFAULT_DATABASE_URL == f"sqlite:///{backend_dir / 'var' / 'swp.db'}"


def test_nfr2_default_var_dir_is_created_when_missing(
    fresh_settings: None, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    var_dir = tmp_path / "var"
    default_url = f"sqlite:///{var_dir / 'swp.db'}"
    monkeypatch.setattr(config, "VAR_DIR", var_dir)
    monkeypatch.setattr(config, "DEFAULT_DATABASE_URL", default_url)
    # The default branch is chosen by value, so pointing the URL at the patched default
    # exercises it without touching the real backend/var.
    monkeypatch.setenv("DATABASE_URL", default_url)
    assert not var_dir.exists()

    settings = config.get_settings()

    assert settings.app_env == "local"
    assert var_dir.is_dir()


def test_nfr2_custom_sqlite_parent_dir_is_created(
    fresh_settings: None, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    missing = tmp_path / "missing"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{missing / 'x.db'}")

    config.get_settings()

    assert missing.is_dir()


def test_nfr12_postgresql_url_uses_psycopg_driver(
    fresh_settings: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@h/db")

    assert config.get_settings().database_url == "postgresql+psycopg://u:p@h/db"


@pytest.mark.parametrize(
    "url",
    ["postgresql+psycopg://u:p@h/db", "sqlite:///relative.db"],
)
def test_nfr12_explicit_driver_and_sqlite_urls_are_unchanged(url: str) -> None:
    assert config.Settings(database_url=url).database_url == url


def test_nfr_max_rows_per_file_must_be_positive(
    fresh_settings: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MAX_ROWS_PER_FILE", "0")

    with pytest.raises(ValidationError):
        config.Settings()


def test_fr39_demo_limit_defaults(fresh_settings: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MAX_PLANS", raising=False)
    monkeypatch.delenv("MAX_ACCOUNTS", raising=False)

    settings = config.Settings()

    assert settings.max_plans == 50
    assert settings.max_accounts == 200


def test_fr39_max_plans_must_be_positive(
    fresh_settings: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MAX_PLANS", "0")

    with pytest.raises(ValidationError):
        config.Settings()


def test_fr50_demo_password_defaults_to_demo(
    fresh_settings: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("DEMO_PASSWORD", raising=False)

    assert config.Settings().demo_password == "demo"


def test_fr50_demo_password_from_env(fresh_settings: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DEMO_PASSWORD", "s3cret")

    assert config.Settings().demo_password == "s3cret"


@pytest.mark.parametrize("password", ["abc", "a" * 65, "€" * 25], ids=["3", "65", "75-bytes"])
def test_fr50_demo_password_that_could_not_log_in_fails(
    fresh_settings: None, monkeypatch: pytest.MonkeyPatch, password: str
) -> None:
    monkeypatch.setenv("DEMO_PASSWORD", password)

    with pytest.raises(ValidationError) as invalid:
        config.Settings()

    # swp.app.startup turns the field name into the `DEMO_PASSWORD: …` refusal line.
    assert [error["loc"] for error in invalid.value.errors()] == [("demo_password",)]


ENV_EXAMPLE = Path(__file__).resolve().parent.parent / ".env.example"
_EXAMPLE_LINE = re.compile(r"^(?:#\s*)?([A-Z][A-Z0-9_]*)=(.*)$")


def _example_values(*, active_only: bool = False) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in ENV_EXAMPLE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        match = _EXAMPLE_LINE.match(line)
        if match and not (active_only and line.startswith("#")):
            assert match[1] not in values, f"{match[1]} listed twice"
            values[match[1]] = match[2]
    return values


def test_nfr6_env_example_lists_every_setting() -> None:
    names = {name.upper() for name in config.Settings.model_fields}

    assert set(_example_values()) == names


def test_nfr6_env_example_holds_no_secret(
    fresh_settings: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert _example_values()["JWT_SECRET"] == config.JWT_SECRET_PLACEHOLDER

    # Exporting the example (only its uncommented lines) in production is refused: it sets
    # no secret and no demo password, so neither counts as chosen.
    for name in ("JWT_SECRET", "DEMO_PASSWORD"):
        monkeypatch.delenv(name, raising=False)
    for name, value in _example_values(active_only=True).items():
        monkeypatch.setenv(name, value)
    monkeypatch.setenv("APP_ENV", "production")
    problems = startup_problems(config.Settings(), {})

    assert WEAK_JWT_SECRET in problems
    assert DEMO_PASSWORD_UNSET in problems


def test_nfr6_migration_database_url_uses_psycopg(
    fresh_settings: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MIGRATION_DATABASE_URL", "postgresql://u:p@h:5432/db")

    assert config.Settings().migration_database_url == "postgresql+psycopg://u:p@h:5432/db"


def test_nfr6_migration_database_url_defaults_to_none(
    fresh_settings: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("MIGRATION_DATABASE_URL", raising=False)

    assert config.Settings().migration_database_url is None
