"""Request limits (AD-12, AD-18): the single place swp.app reads them from."""

from decimal import Decimal

from swp.config import get_settings
from swp.domain.errors import DomainError
from swp.domain.values import dec_text


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
