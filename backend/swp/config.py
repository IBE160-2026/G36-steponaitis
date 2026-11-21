"""Settings from the environment (pydantic-settings). Zero env vars needed locally."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
VAR_DIR = BACKEND_DIR / "var"
DEFAULT_DATABASE_URL = f"sqlite:///{VAR_DIR / 'swp.db'}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    app_env: str = "local"
    database_url: str = DEFAULT_DATABASE_URL


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.database_url == DEFAULT_DATABASE_URL:
        VAR_DIR.mkdir(parents=True, exist_ok=True)
    elif settings.database_url.startswith("sqlite:///"):
        # A custom SQLite file (tests, e2e) also gets its directory created.
        Path(settings.database_url.removeprefix("sqlite:///")).parent.mkdir(
            parents=True, exist_ok=True
        )
    return settings
