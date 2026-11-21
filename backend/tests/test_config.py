from pathlib import Path

import pytest
from pydantic import ValidationError

from swp import config


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
