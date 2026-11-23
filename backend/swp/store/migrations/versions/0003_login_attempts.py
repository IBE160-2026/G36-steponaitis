"""login_attempts

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-23

Expand-only (AD-18): adds `login_attempts`; no existing table or JSON document changes.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from swp.store.types import UtcDateTime

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "login_attempts",
        sa.Column("username_key", sa.String(), primary_key=True),
        sa.Column("failures", sa.Integer(), nullable=False),
        sa.Column("locked_until", UtcDateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("login_attempts")
