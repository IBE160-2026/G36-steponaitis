"""The only path that migrates or seeds the database (AD-9)."""

from datetime import UTC, datetime

from swp.app import auth
from swp.store import db


def bootstrap(upgrade: bool, seed: bool) -> None:
    if upgrade:
        db.upgrade_to_head()
    if seed:
        auth.seed_demo_account(now=datetime.now(UTC))
