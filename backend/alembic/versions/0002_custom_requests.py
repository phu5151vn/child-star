"""custom (child-proposed) reward & task requests

Cho phép con yêu cầu phần thưởng / đề xuất nhiệm vụ NGOÀI danh sách bố mẹ tạo.
- reward_redemptions.reward_id, task_assignments.task_id: cho phép NULL (yêu cầu tự do).
- thêm custom_title: mô tả do con nhập.
Số sao (trừ/cộng) do bố mẹ nhập khi duyệt (points_spent / ledger.delta).

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("reward_redemptions", "reward_id", existing_type=sa.UUID(), nullable=True)
    op.add_column("reward_redemptions", sa.Column("custom_title", sa.Text(), nullable=True))

    op.alter_column("task_assignments", "task_id", existing_type=sa.UUID(), nullable=True)
    op.add_column("task_assignments", sa.Column("custom_title", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("task_assignments", "custom_title")
    op.alter_column("task_assignments", "task_id", existing_type=sa.UUID(), nullable=False)

    op.drop_column("reward_redemptions", "custom_title")
    op.alter_column("reward_redemptions", "reward_id", existing_type=sa.UUID(), nullable=False)
