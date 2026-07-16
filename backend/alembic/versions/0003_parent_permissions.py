"""parent permissions (admin + người thân đồng hành)

Bảng phân quyền cho tài khoản kiểu bố mẹ. Parent không có hàng => coi là admin đủ quyền
(tương thích tài khoản cũ). Người thân được tạo kèm 1 hàng với các quyền bị tắt.

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "parent_permissions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("family_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("is_admin", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("can_manage_members", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("can_approve_tasks", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("can_approve_rewards", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_parent_permission_user"),
    )


def downgrade() -> None:
    op.drop_table("parent_permissions")
