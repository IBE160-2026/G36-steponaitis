"""The only path that migrates or seeds the database (AD-9)."""

from swp.store import db


def bootstrap(upgrade: bool, seed: bool) -> None:
    if upgrade:
        db.upgrade_to_head()
    if seed:
        pass  # No seed data yet; the demo account arrives with auth (AD-10).
