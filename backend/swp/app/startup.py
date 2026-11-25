"""Startup check (AD-10, NFR-6): production refuses to start on unsafe or missing settings.

`create_app()` and `swp db upgrade` run `check_startup()` before anything else. "Set" means the
field came from the environment (`Settings.model_fields_set`), so local runs need no env vars
while production must choose each value deliberately.
"""

import logging
import os
from collections.abc import Mapping

from pydantic import ValidationError

from swp.config import DEFAULT_JWT_SECRET, JWT_SECRET_PLACEHOLDER, Settings, get_settings

logger = logging.getLogger("swp.startup")

APP_ENVS = frozenset({"local", "production"})
MIN_JWT_SECRET_BYTES = 32

VERCEL_WITHOUT_APP_ENV = "VERCEL is set but APP_ENV is not production. Set APP_ENV=production."
UNKNOWN_APP_ENV = "APP_ENV must be local or production."
WEAK_JWT_SECRET = (
    "JWT_SECRET is empty, a committed default or shorter than 32 bytes. Generate one with: "
    'python -c "import secrets; print(secrets.token_urlsafe(48))"'
)
DEMO_PASSWORD_UNSET = "DEMO_PASSWORD is not set. Choose the demo account's password explicitly."
DATABASE_URL_UNSET = "DATABASE_URL is not set. Production needs its own database."


class StartupRefused(RuntimeError):
    """The settings are not safe to start with; the message lists every problem."""

    def __init__(self, problems: list[str]) -> None:
        super().__init__("; ".join(problems))
        self.problems = problems


def _weak_jwt_secret(secret: str) -> bool:
    return (
        not secret
        or secret in (DEFAULT_JWT_SECRET, JWT_SECRET_PLACEHOLDER)
        or len(secret.encode("utf-8")) < MIN_JWT_SECRET_BYTES
    )


def startup_problems(settings: Settings, environ: Mapping[str, str]) -> list[str]:
    """Every reason not to start, in a fixed order; empty when the settings are fine."""
    problems: list[str] = []
    is_set = settings.model_fields_set
    if environ.get("VERCEL") and settings.app_env != "production":
        problems.append(VERCEL_WITHOUT_APP_ENV)
    if settings.app_env not in APP_ENVS:
        problems.append(UNKNOWN_APP_ENV)
    if settings.app_env == "production":
        if _weak_jwt_secret(settings.jwt_secret):
            problems.append(WEAK_JWT_SECRET)
        if "demo_password" not in is_set:
            problems.append(DEMO_PASSWORD_UNSET)
        if "database_url" not in is_set:
            problems.append(DATABASE_URL_UNSET)
    return problems


def invalid_setting_problems(error: ValidationError) -> list[str]:
    """One `<SETTING>: <why>` line per invalid setting; never the value (NFR-6)."""
    problems: list[str] = []
    for detail in error.errors(include_input=False, include_url=False, include_context=False):
        reason = detail["msg"].removeprefix("Value error, ")
        field = ".".join(str(part) for part in detail["loc"]).upper()
        problems.append(f"{field}: {reason}" if field else reason)
    return problems


def check_startup(environ: Mapping[str, str] = os.environ) -> None:
    """Log one ERROR line per problem and raise `StartupRefused` when there is any.

    An invalid setting (pydantic `ValidationError`) is a problem too: it is reported by name
    and reason only, and raised `from None` so no traceback shows the value.
    """
    try:
        settings = get_settings()
    except ValidationError as error:
        problems = invalid_setting_problems(error)
    else:
        problems = startup_problems(settings, environ)
    for problem in problems:
        logger.error("Refusing to start: %s", problem)
    if problems:
        raise StartupRefused(problems) from None
