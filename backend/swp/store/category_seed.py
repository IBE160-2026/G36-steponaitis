"""Starter category seed (FR-47, AD-9): fills both global category tables once, only when empty.

The seed runs in one `write_transaction` and, on Postgres, first takes
`LOCK TABLE keyword_rules IN EXCLUSIVE MODE` then `LOCK TABLE aisle_categories IN EXCLUSIVE MODE`
(SQLite's BEGIN IMMEDIATE already serializes writers), so workers starting at once write it
exactly once.
"""

from collections.abc import Mapping, Sequence
from datetime import datetime

from sqlalchemy import exists, select, text
from sqlalchemy.exc import OperationalError

from swp.store.db import is_busy, write_transaction
from swp.store.keyword_rules import RuleDraft
from swp.store.models import AisleCategoryRow, KeywordRuleRow


class CategorySeedBusy(Exception):
    """Another writer holds a category table lock (SQLite busy/locked, pg 55P03)."""


def seed_if_empty(
    rules: Sequence[RuleDraft], aisles: Mapping[str, Sequence[str]], *, now: datetime
) -> bool:
    """Store `rules` (positions 0..n-1, `updated_at = now`) and `aisles` when both tables have
    no rows; True when it wrote. The caller has checked the lists. Raise CategorySeedBusy when
    a lock cannot be taken."""
    try:
        return _seed_if_empty(rules, aisles, now=now)
    except OperationalError as error:
        if is_busy(error):
            raise CategorySeedBusy from error
        raise


def _seed_if_empty(
    rules: Sequence[RuleDraft], aisles: Mapping[str, Sequence[str]], *, now: datetime
) -> bool:
    with write_transaction() as session:
        if session.get_bind().dialect.name == "postgresql":
            session.execute(text("LOCK TABLE keyword_rules IN EXCLUSIVE MODE"))
            session.execute(text("LOCK TABLE aisle_categories IN EXCLUSIVE MODE"))
        has_rules = session.scalar(select(exists().select_from(KeywordRuleRow)))
        has_aisles = session.scalar(select(exists().select_from(AisleCategoryRow)))
        if has_rules or has_aisles:
            return False
        session.add_all(
            KeywordRuleRow(
                id=rule.id,
                position=position,
                keyword=rule.keyword,
                category=rule.category,
                updated_at=now,
            )
            for position, rule in enumerate(rules)
        )
        session.add_all(
            AisleCategoryRow(aisle=aisle, category=category)
            for aisle, categories in aisles.items()
            for category in categories
        )
        session.flush()
        return True
