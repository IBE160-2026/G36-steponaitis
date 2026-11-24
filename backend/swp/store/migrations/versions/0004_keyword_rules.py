"""keyword_rules

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-24

Expand-only (AD-9, FR-43): the first stage 2 migration adds only the global `keyword_rules`;
no existing table or JSON document changes.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from swp.store.types import UtcDateTime

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "keyword_rules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("keyword", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("updated_at", UtcDateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("keyword_rules")
