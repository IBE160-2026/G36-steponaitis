"""aisle_categories

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-24

Expand-only (AD-9, FR-45): adds only the global `aisle_categories` (`aisle`, `category`,
unique together as the composite primary key); no existing table or JSON document changes.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "aisle_categories",
        sa.Column("aisle", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("aisle", "category"),
    )


def downgrade() -> None:
    op.drop_table("aisle_categories")
