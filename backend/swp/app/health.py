"""Health check service."""

from swp.store import db


def check() -> None:
    """Raise if the database does not answer SELECT 1."""
    db.ping()
