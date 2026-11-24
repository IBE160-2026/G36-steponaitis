"""The only path that migrates or seeds the database (AD-9): the `demo` account (FR-50) and
the starter categories (FR-47), each written only once."""

from datetime import UTC, datetime

from swp.app import auth, categories
from swp.store import db


def bootstrap(upgrade: bool, seed: bool) -> None:
    if upgrade:
        db.upgrade_to_head()
    if seed:
        now = datetime.now(UTC)
        auth.seed_demo_account(now=now)
        categories.seed_starter_categories(now=now)
