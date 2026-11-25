"""The only path that migrates or seeds the database (AD-9).

The seed writes the `demo` account (FR-50) only when it is missing, and the starter categories
(FR-47) only when both `keyword_rules` and `aisle_categories` are empty: the planner's lists
are never overwritten, and after the planner empties both tables the starter list comes back on
the next start or `swp db upgrade`. A busy database skips a seed step with a logged cause
instead of failing the start.
"""

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
