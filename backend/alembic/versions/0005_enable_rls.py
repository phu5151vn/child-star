"""bật RLS cho tất cả bảng public (chặn Data API ẩn danh của Supabase)

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-16

App chỉ truy cập DB qua backend FastAPI bằng role bypass-RLS/owner, nên bật RLS
(KHÔNG dùng FORCE) không ảnh hưởng backend, nhưng chặn mọi truy cập ẩn danh
qua Data API của Supabase (xoá cảnh báo "Unrestricted"). Không cần policy vì
toàn bộ kiểm soát quyền nằm ở tầng server (đúng quy tắc bảo mật dự án).
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Mọi bảng trong schema public (gồm cả bảng nội bộ alembic_version để xoá hết cảnh báo).
TABLES = [
    "alembic_version",
    "audit_log",
    "families",
    "game_matches",
    "game_moves",
    "ludo_matches",
    "media",
    "parent_permissions",
    "points_ledger",
    "reward_redemptions",
    "rewards",
    "task_assignments",
    "tasks",
    "users",
    "weekly_bonus_awards",
    "weekly_goals",
]


def upgrade() -> None:
    for t in TABLES:
        op.execute(f'ALTER TABLE public."{t}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    for t in TABLES:
        op.execute(f'ALTER TABLE public."{t}" DISABLE ROW LEVEL SECURITY')
