"""Keyword rule persistence (FR-43, AD-9): one global, ordered list with positions 0..n-1.

Every write runs in one `write_transaction` and, on Postgres, first takes
`LOCK TABLE keyword_rules IN EXCLUSIVE MODE` (SQLite's BEGIN IMMEDIATE already serializes
writers), so a duplicate check and the positions cannot race.
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select, text
from sqlalchemy.exc import OperationalError

from swp.store.db import is_busy, transaction, write_transaction
from swp.store.models import KeywordRuleRow


@dataclass(frozen=True)
class StoredKeywordRule:
    id: uuid.UUID
    position: int
    keyword: str
    category: str
    updated_at: datetime


@dataclass(frozen=True)
class RuleDraft:
    """A rule in the list a write leaves behind; its position is its index in that list."""

    id: uuid.UUID
    keyword: str
    category: str


class RulesBusy(Exception):
    """Another writer holds the keyword_rules lock (SQLite busy/locked, pg 55P03)."""


ORDERED = (KeywordRuleRow.position, KeywordRuleRow.id)


def _stored(row: KeywordRuleRow) -> StoredKeywordRule:
    return StoredKeywordRule(
        id=row.id,
        position=row.position,
        keyword=row.keyword,
        category=row.category,
        updated_at=row.updated_at,
    )


def list_rules() -> list[StoredKeywordRule]:
    """Every keyword rule in position order."""
    with transaction() as session:
        return [_stored(row) for row in session.scalars(select(KeywordRuleRow).order_by(*ORDERED))]


def write_rules(
    change: Callable[[list[StoredKeywordRule]], list[RuleDraft]], *, now: datetime
) -> list[StoredKeywordRule]:
    """Replace the list with `change(current)` under the write lock; the new list.

    `change` gets the current rules in position order and returns the whole new list; rules it
    leaves out are deleted, new ids inserted, and only rows whose position, keyword or category
    differ are updated. Each changed row gets `updated_at = now`. An exception from `change`
    rolls the transaction back with nothing written. Raise RulesBusy when the lock cannot be
    taken.
    """
    try:
        return _write_rules(change, now=now)
    except OperationalError as error:
        if is_busy(error):
            raise RulesBusy from error
        raise


def _write_rules(
    change: Callable[[list[StoredKeywordRule]], list[RuleDraft]], *, now: datetime
) -> list[StoredKeywordRule]:
    with write_transaction() as session:
        if session.get_bind().dialect.name == "postgresql":
            session.execute(text("LOCK TABLE keyword_rules IN EXCLUSIVE MODE"))
        rows = list(session.scalars(select(KeywordRuleRow).order_by(*ORDERED)))
        drafts = change([_stored(row) for row in rows])
        by_id = {row.id: row for row in rows}
        kept = {draft.id for draft in drafts}
        for row in rows:
            if row.id not in kept:
                session.delete(row)
        result: list[KeywordRuleRow] = []
        for position, draft in enumerate(drafts):
            row = by_id.get(draft.id)
            if row is None:
                row = KeywordRuleRow(
                    id=draft.id,
                    position=position,
                    keyword=draft.keyword,
                    category=draft.category,
                    updated_at=now,
                )
                session.add(row)
            elif (row.position, row.keyword, row.category) != (
                position,
                draft.keyword,
                draft.category,
            ):
                row.position = position
                row.keyword = draft.keyword
                row.category = draft.category
                row.updated_at = now
            result.append(row)
        session.flush()
        return [_stored(row) for row in result]
