"""Request limits (AD-12, AD-18): the single place swp.app reads them from."""

from decimal import Decimal

from swp.config import get_settings
from swp.domain.errors import DomainError
from swp.domain.values import dec_text
from swp.store import plans as plan_store
from swp.store import users as user_store

ACCOUNT_LIMIT = "The demo has reached its account limit. Use Demo version instead."


def max_rows_per_file() -> int:
    return get_settings().max_rows_per_file


def max_upload_bytes() -> int:
    return get_settings().max_upload_bytes


def megabytes(size: int) -> str:
    """`size` bytes as megabytes (1 MB = 1,000,000 bytes) without trailing zeros."""
    return dec_text(Decimal(size) / Decimal(1_000_000))


def upload_too_large(max_bytes: int) -> DomainError:
    """The request-level error for a New Plan upload over `max_bytes` (AD-12)."""
    limit = megabytes(max_bytes)
    return DomainError(
        "limit_reached",
        f"The files are larger than {limit} MB together. "
        f"One New Plan can upload at most {limit} MB.",
    )


def ensure_account_room() -> None:
    """Raise `limit_reached` when the demo already holds `MAX_ACCOUNTS` accounts (AD-18).

    A no-op unless `FEATURE_DEMO` is on; the seeded `demo` account is not counted.
    """
    settings = get_settings()
    if not settings.feature_demo:
        return
    if user_store.count_accounts() >= settings.max_accounts:
        raise DomainError("limit_reached", ACCOUNT_LIMIT, [{"limit": "max_accounts"}])


def ensure_plan_room() -> None:
    """Raise `limit_reached` when the demo already holds `MAX_PLANS` plans (AD-18).

    A no-op unless `FEATURE_DEMO` is on.
    """
    settings = get_settings()
    if not settings.feature_demo:
        return
    max_plans = settings.max_plans
    if plan_store.count_plans() >= max_plans:
        raise DomainError(
            "limit_reached",
            f"The demo holds at most {max_plans:,} plans. Delete a plan to make room.",
            [{"limit": "max_plans"}],
        )
