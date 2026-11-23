"""User persistence (FR-39, AD-10): accounts are unique by casefolded `username_key`."""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from swp.store.db import transaction
from swp.store.models import UserRow


@dataclass(frozen=True)
class StoredUser:
    id: uuid.UUID
    username: str
    username_key: str
    password_hash: str
    created_at: datetime


def insert_user(user: StoredUser) -> bool:
    """Insert `user`; False when another account already holds its `username_key`."""
    try:
        with transaction() as session:
            session.add(
                UserRow(
                    id=user.id,
                    username=user.username,
                    username_key=user.username_key,
                    password_hash=user.password_hash,
                    created_at=user.created_at,
                )
            )
    except IntegrityError:
        return False
    return True


def get_user(user_id: uuid.UUID) -> StoredUser | None:
    with transaction() as session:
        row = session.get(UserRow, user_id)
        if row is None:
            return None
        return StoredUser(
            id=row.id,
            username=row.username,
            username_key=row.username_key,
            password_hash=row.password_hash,
            created_at=row.created_at,
        )


def username_key_taken(key: str) -> bool:
    with transaction() as session:
        found = session.execute(
            select(UserRow.id).where(UserRow.username_key == key).limit(1)
        ).first()
        return found is not None
