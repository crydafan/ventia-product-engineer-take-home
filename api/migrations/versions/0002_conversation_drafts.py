"""conversation drafts

Revision ID: 0002_conversation_drafts
Revises: 0001_business
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_conversation_drafts"
down_revision: str | Sequence[str] | None = "0001_business"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "conversation_drafts",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("conversation_id", sa.String(), nullable=False),
        sa.Column("source_hash", sa.String(length=64), nullable=False),
        sa.Column("content", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "conversation_id", name="uq_conversation_drafts_user_conversation"
        ),
        schema="business",
    )
    op.create_index(
        "ix_business_conversation_drafts_user_id",
        "conversation_drafts",
        ["user_id"],
        unique=False,
        schema="business",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_business_conversation_drafts_user_id",
        table_name="conversation_drafts",
        schema="business",
    )
    op.drop_table("conversation_drafts", schema="business")
