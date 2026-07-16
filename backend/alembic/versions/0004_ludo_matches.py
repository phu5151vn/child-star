"""ludo (cờ cá ngựa) matches — 2..4 người, chen ngang giữa ván

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ludo_matches",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("family_id", sa.UUID(), nullable=False),
        sa.Column("status", sa.String(length=12), server_default="waiting", nullable=False),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("state", sa.JSON(), nullable=False),
        sa.Column("winner_id", sa.UUID(), nullable=True),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('waiting','active','finished')", name="ck_ludo_status"),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["winner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ludo_family_status", "ludo_matches", ["family_id", "status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ludo_family_status", table_name="ludo_matches")
    op.drop_table("ludo_matches")
