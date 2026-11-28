"""Settings from the environment (pydantic-settings). Zero env vars needed locally."""

from contextlib import suppress
from functools import lru_cache
from pathlib import Path

from pydantic import PositiveInt, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from swp.domain.accounts import password_error

BACKEND_DIR = Path(__file__).resolve().parent.parent
VAR_DIR = BACKEND_DIR / "var"
DEFAULT_DATABASE_URL = f"sqlite:///{VAR_DIR / 'swp.db'}"
DEFAULT_JWT_SECRET = "swp-local-development-jwt-secret-not-for-production"
# The JWT_SECRET value in backend/.env.example; production refuses it (swp.app.startup).
JWT_SECRET_PLACEHOLDER = "replace-with-a-random-secret-of-at-least-32-bytes"


def _psycopg_url(url: str) -> str:
    # AD-9: a plain postgresql:// URL would select psycopg2; we ship psycopg 3.
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    app_env: str = "local"
    database_url: str = DEFAULT_DATABASE_URL
    # Database `swp db upgrade` migrates (env MIGRATION_DATABASE_URL, AD-9), e.g. a direct
    # Postgres connection when DATABASE_URL goes through a pooler. Unset: DATABASE_URL.
    migration_database_url: str | None = None
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
    # runs only; with APP_ENV=production, swp.app.startup refuses it, the .env.example
    # placeholder and any secret shorter than 32 bytes.
    jwt_secret: str = DEFAULT_JWT_SECRET
    # Password of the seeded `demo` account (env DEMO_PASSWORD, AD-10); used only when the
    # account is first created.
    demo_password: str = "demo"

    @property
    def migration_url(self) -> str:
        """The database `swp db upgrade` migrates: MIGRATION_DATABASE_URL, else DATABASE_URL."""
        return self.migration_database_url or self.database_url

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, url: str) -> str:
        return _psycopg_url(url)

    @field_validator("migration_database_url")
    @classmethod
    def _migration_uses_psycopg_driver(cls, url: str | None) -> str | None:
        return None if url is None else _psycopg_url(url)

    @field_validator("demo_password")
    @classmethod
    def _demo_password_can_log_in(cls, password: str) -> str:
        # A password the Log in form would refuse fails at startup instead; swp.app.startup
        # names the setting (DEMO_PASSWORD) in its refusal line.
        error = password_error(password)
        if error is not None:
            raise ValueError(error)
        return password


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.database_url == DEFAULT_DATABASE_URL:
        # Read-only filesystem (Vercel) without DATABASE_URL: skip, so swp.app.startup can
        # refuse with "DATABASE_URL is not set" instead of an OSError traceback.
        with suppress(OSError):
            VAR_DIR.mkdir(parents=True, exist_ok=True)
    elif settings.database_url.startswith("sqlite:///"):
        # A custom SQLite file (tests, e2e) also gets its directory created. A directory that
        # cannot be created (read-only disk) is skipped, so swp.app.startup can refuse SQLite on
        # Vercel with one line instead of an OSError traceback.
        with suppress(OSError):
            Path(settings.database_url.removeprefix("sqlite:///")).parent.mkdir(
                parents=True, exist_ok=True
            )
    return settings
