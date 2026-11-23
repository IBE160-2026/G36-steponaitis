"""users

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-23

Expand-only (AD-10): adds `users`; no existing table or JSON document changes.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from swp.store.types import UtcDateTime

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("username_key", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("created_at", UtcDateTime(), nullable=False),
        sa.UniqueConstraint("username_key", name="uq_users_username_key"),
    )


def downgrade() -> None:
    op.drop_table("users")
