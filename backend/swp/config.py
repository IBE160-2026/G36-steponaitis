"""Settings from the environment (pydantic-settings). Zero env vars needed locally."""

from functools import lru_cache
from pathlib import Path

from pydantic import PositiveInt, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from swp.domain.accounts import password_error

BACKEND_DIR = Path(__file__).resolve().parent.parent
VAR_DIR = BACKEND_DIR / "var"
DEFAULT_DATABASE_URL = f"sqlite:///{VAR_DIR / 'swp.db'}"
DEFAULT_JWT_SECRET = "swp-local-development-jwt-secret-not-for-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    app_env: str = "local"
    database_url: str = DEFAULT_DATABASE_URL
    # AD-12 limits (env MAX_UPLOAD_BYTES, MAX_ROWS_PER_FILE); read through swp.app.limits.
    max_upload_bytes: PositiveInt = 4_000_000
    max_rows_per_file: PositiveInt = 25_000
    # AD-18 demo limits (env MAX_PLANS, MAX_ACCOUNTS); applied only with FEATURE_DEMO on.
    max_plans: PositiveInt = 50
    max_accounts: PositiveInt = 200
    # Feature flags (env FEATURE_AUTH, FEATURE_DEMO); both off in M1, shown by GET /api/session.
    feature_auth: bool = False
    feature_demo: bool = False
    # HS256 key for the `swp_session` JWT (env JWT_SECRET, AD-10). The default is for local
    # runs only; production must set its own (checked at startup from Story 9.7).
    jwt_secret: str = DEFAULT_JWT_SECRET
    # Password of the seeded `demo` account (env DEMO_PASSWORD, AD-10); used only when the
    # account is first created.
    demo_password: str = "demo"

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, url: str) -> str:
        # AD-9: a plain postgresql:// URL would select psycopg2; we ship psycopg 3.
        if url.startswith("postgresql://"):
            return "postgresql+psycopg://" + url.removeprefix("postgresql://")
        return url

    @field_validator("demo_password")
    @classmethod
    def _demo_password_can_log_in(cls, password: str) -> str:
        # A password the Log in form would refuse fails at startup instead.
        error = password_error(password)
        if error is not None:
            raise ValueError(f"DEMO_PASSWORD: {error}")
        return password


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
