"""Request limits (AD-12): the single place swp.app reads them from."""

from swp.config import get_settings


def max_rows_per_file() -> int:
    return get_settings().max_rows_per_file


def max_upload_bytes() -> int:
    return get_settings().max_upload_bytes
