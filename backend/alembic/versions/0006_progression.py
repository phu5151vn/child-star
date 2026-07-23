"""progression: badges + child_badges + streak_milestone_awards + streak_bonus kind

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-23

Increment "Nhiệm vụ lặp lại & Tiến trình" (schema §1, §2, §6, §7):
- Mở rộng CHECK ck_ledger_kind thêm 'streak_bonus' (không đụng dữ liệu cũ).
- Tạo 3 bảng: badges (seed hệ thống), child_badges (idempotent), streak_milestone_awards.
- Seed 11 huy hiệu hệ thống.
- Bật RLS (không policy) cho 3 bảng mới, đồng bộ 0005 (chặn Data API ẩn danh Supabase).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_LEDGER_KINDS_OLD = "('task_approved','reward_redeemed','manual_adjust','weekly_bonus')"
_LEDGER_KINDS_NEW = "('task_approved','reward_redeemed','manual_adjust','weekly_bonus','streak_bonus')"

_BADGE_SEED = [
    ("first_task", "Khởi đầu", "Hoàn thành nhiệm vụ đầu tiên", "🎉", "first_task", 1, 1),
    ("tasks_10", "Chăm chỉ", "Hoàn thành 10 nhiệm vụ", "💪", "tasks_approved_total", 10, 2),
    ("tasks_50", "Siêng năng", "Hoàn thành 50 nhiệm vụ", "🔥", "tasks_approved_total", 50, 3),
    ("tasks_100", "Bậc thầy việc nhà", "Hoàn thành 100 nhiệm vụ", "👑", "tasks_approved_total", 100, 4),
    ("points_100", "Trăm sao", "Kiếm được 100 sao", "⭐", "points_earned_total", 100, 5),
    ("points_500", "Năm trăm sao", "Kiếm được 500 sao", "🌟", "points_earned_total", 500, 6),
    ("points_1000", "Nghìn sao", "Kiếm được 1000 sao", "💫", "points_earned_total", 1000, 7),
    ("streak_7", "Tuần hoàn hảo", "Chuỗi 7 ngày liên tiếp", "📅", "streak_days", 7, 8),
    ("streak_30", "Bền bỉ", "Chuỗi 30 ngày liên tiếp", "🏅", "streak_days", 30, 9),
    ("reward_first", "Phần thưởng đầu tiên", "Đổi phần thưởng đầu tiên", "🎁", "rewards_redeemed_total", 1, 10),
    ("weekly_goal_first", "Đạt mục tiêu tuần", "Đạt mục tiêu tuần lần đầu", "🏆", "weekly_goal_hits", 1, 11),
]


def upgrade() -> None:
    # 1) Mở rộng CHECK kind của points_ledger (không đụng dữ liệu cũ).
    op.drop_constraint("ck_ledger_kind", "points_ledger", type_="check")
    op.create_check_constraint("ck_ledger_kind", "points_ledger", f"kind IN {_LEDGER_KINDS_NEW}")

    # 2) Bảng badges (seed hệ thống, không family_id).
    op.create_table(
        "badges",
        sa.Column("code", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("icon_emoji", sa.Text(), nullable=False),
        sa.Column("criteria_type", sa.String(length=30), nullable=False),
        sa.Column("threshold", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.CheckConstraint(
            "criteria_type IN ('first_task','tasks_approved_total','points_earned_total',"
            "'streak_days','rewards_redeemed_total','weekly_goal_hits')",
            name="ck_badge_criteria_type",
        ),
        sa.CheckConstraint("threshold > 0", name="ck_badge_threshold"),
        sa.PrimaryKeyConstraint("code"),
    )

    # 3) Bảng child_badges (append-only, idempotent).
    op.create_table(
        "child_badges",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("family_id", sa.UUID(), nullable=False),
        sa.Column("child_id", sa.UUID(), nullable=False),
        sa.Column("badge_code", sa.Text(), nullable=False),
        sa.Column("earned_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"]),
        sa.ForeignKeyConstraint(["child_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["badge_code"], ["badges.code"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("child_id", "badge_code", name="uq_child_badge"),
    )
    op.create_index("ix_child_badges_child", "child_badges", ["child_id"])

    # 4) Bảng streak_milestone_awards (idempotent trọn đời).
    op.create_table(
        "streak_milestone_awards",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("family_id", sa.UUID(), nullable=False),
        sa.Column("child_id", sa.UUID(), nullable=False),
        sa.Column("milestone", sa.Integer(), nullable=False),
        sa.Column("points_awarded", sa.Integer(), nullable=False),
        sa.Column("ledger_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("milestone > 0", name="ck_streak_milestone"),
        sa.ForeignKeyConstraint(["family_id"], ["families.id"]),
        sa.ForeignKeyConstraint(["child_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["ledger_id"], ["points_ledger.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("child_id", "milestone", name="uq_streak_milestone"),
    )

    # 5) Seed 11 huy hiệu hệ thống.
    badges = sa.table(
        "badges",
        sa.column("code", sa.Text),
        sa.column("title", sa.Text),
        sa.column("description", sa.Text),
        sa.column("icon_emoji", sa.Text),
        sa.column("criteria_type", sa.String),
        sa.column("threshold", sa.Integer),
        sa.column("sort_order", sa.Integer),
    )
    op.bulk_insert(
        badges,
        [
            {
                "code": c, "title": t, "description": d, "icon_emoji": e,
                "criteria_type": ct, "threshold": th, "sort_order": so,
            }
            for (c, t, d, e, ct, th, so) in _BADGE_SEED
        ],
    )

    # 6) Bật RLS (không policy) cho 3 bảng mới — đồng bộ 0005.
    for tbl in ("badges", "child_badges", "streak_milestone_awards"):
        op.execute(f'ALTER TABLE public."{tbl}" ENABLE ROW LEVEL SECURITY')


def downgrade() -> None:
    op.drop_table("streak_milestone_awards")
    op.drop_index("ix_child_badges_child", table_name="child_badges")
    op.drop_table("child_badges")
    op.drop_table("badges")
    op.drop_constraint("ck_ledger_kind", "points_ledger", type_="check")
    op.create_check_constraint("ck_ledger_kind", "points_ledger", f"kind IN {_LEDGER_KINDS_OLD}")
