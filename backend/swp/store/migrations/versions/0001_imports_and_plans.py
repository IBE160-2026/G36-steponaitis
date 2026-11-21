"""imports and plans

Revision ID: 0001
Revises:
Create Date: 2026-11-21

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from swp.store.types import UtcDateTime

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "imports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("uploaded_at", UtcDateTime(), nullable=False),
        sa.Column("data_as_of", sa.Date(), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
    )
    op.create_table(
        "plans",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "import_id",
            sa.Uuid(),
            sa.ForeignKey("imports.id", ondelete="RESTRICT", name="fk_plans_import_id_imports"),
            nullable=False,
        ),
        sa.Column("created_by", sa.String(), nullable=False),
        sa.Column("created_at", UtcDateTime(), nullable=False),
        sa.Column("last_edited_by", sa.String(), nullable=False),
        sa.Column("last_edited_at", UtcDateTime(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("analysis", sa.JSON(), nullable=False),
        sa.Column("state", sa.JSON(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("plans")
    op.drop_table("imports")
