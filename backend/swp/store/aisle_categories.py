"""Aisle category persistence (FR-45, AD-9): global rows (`aisle`, `category`).

A write replaces one aisle's whole list in one `write_transaction` and, on Postgres, first takes
`LOCK TABLE aisle_categories IN EXCLUSIVE MODE` (SQLite's BEGIN IMMEDIATE already serializes
writers).
"""

from collections.abc import Sequence

from sqlalchemy import delete, select, text
from sqlalchemy.exc import OperationalError

from swp.store.db import is_busy, transaction, write_transaction
from swp.store.models import AisleCategoryRow


class AisleCategoriesBusy(Exception):
    """Another writer holds the aisle_categories lock (SQLite busy/locked, pg 55P03)."""


def list_for(aisle: str) -> list[str]:
    """The stored categories of `aisle` (exact text), in no particular order."""
    with transaction() as session:
        query = select(AisleCategoryRow.category).where(AisleCategoryRow.aisle == aisle)
        return list(session.scalars(query))


def list_all() -> dict[str, list[str]]:
    """Every aisle that has categories, with its stored categories."""
    found: dict[str, list[str]] = {}
    with transaction() as session:
        for row in session.execute(select(AisleCategoryRow.aisle, AisleCategoryRow.category)):
            found.setdefault(row.aisle, []).append(row.category)
    return found


def replace(aisle: str, categories: Sequence[str]) -> None:
    """Make `categories` the whole list of `aisle`; raise AisleCategoriesBusy when the lock
    cannot be taken. The caller has checked the list (no duplicates)."""
    try:
        _replace(aisle, categories)
    except OperationalError as error:
        if is_busy(error):
            raise AisleCategoriesBusy from error
        raise


def _replace(aisle: str, categories: Sequence[str]) -> None:
    with write_transaction() as session:
        if session.get_bind().dialect.name == "postgresql":
            session.execute(text("LOCK TABLE aisle_categories IN EXCLUSIVE MODE"))
        session.execute(delete(AisleCategoryRow).where(AisleCategoryRow.aisle == aisle))
        session.add_all(AisleCategoryRow(aisle=aisle, category=c) for c in categories)
        session.flush()
