"""Hằng số & hàm THUẦN (pure) cho tiến trình: cấp độ, mốc streak, bộ huy hiệu.

Không chạm DB → dễ unit test và là nguồn sự thật của ngưỡng level, mốc streak,
số sao bonus và định nghĩa huy hiệu hệ thống (AD4: hằng số/seed cấp hệ thống,
chưa theo family). Truy vết: architecture §0 (AD3..AD6), schema §5, §6.
"""

from __future__ import annotations

# --- Cấp độ (BR-PG-3) ------------------------------------------------------
# Ngưỡng LŨY KẾ (⭐, Q-A) — index 0 = Lv1 ... index 5 = Lv6.
LEVEL_THRESHOLDS: list[int] = [0, 100, 250, 500, 1000, 2000]
LEVEL_TITLES: list[str] = [
    "Mầm Non",
    "Chồi Xanh",
    "Ngôi Sao Nhỏ",
    "Ngôi Sao Sáng",
    "Siêu Sao",
    "Nhà Vô Địch",
]
LEVEL_ICONS: list[str] = ["🌱", "🌿", "⭐", "🌟", "💫", "🏆"]

# --- Mốc streak & bonus (BR-PG-9) -----------------------------------------
STREAK_MILESTONES: list[int] = [3, 7, 14, 30]
STREAK_BONUS: dict[int, int] = {3: 5, 7: 15, 14: 30, 30: 80}


def level_index_for(lifetime: int) -> int:
    """Index cấp (0-based) cho tổng sao lũy kế (>= 0)."""
    lp = max(0, int(lifetime))
    idx = 0
    for i, threshold in enumerate(LEVEL_THRESHOLDS):
        if lp >= threshold:
            idx = i
        else:
            break
    return idx


def level_for(lifetime: int) -> dict:
    """Thông tin cấp độ dẫn xuất từ tổng sao lũy kế. Pure — hình dạng khớp architecture §3.1.

    progress_pct = phần trăm tiến trong dải cấp hiện tại. Ở cấp cao nhất: 100%,
    ``next_min``/``points_to_next`` = None.
    """
    lp = max(0, int(lifetime))
    idx = level_index_for(lp)
    min_points = LEVEL_THRESHOLDS[idx]
    is_max = idx >= len(LEVEL_THRESHOLDS) - 1
    if is_max:
        next_min: int | None = None
        points_to_next: int | None = None
        progress_pct = 100
    else:
        next_min = LEVEL_THRESHOLDS[idx + 1]
        span = next_min - min_points
        gained = lp - min_points
        points_to_next = max(0, next_min - lp)
        progress_pct = int(gained * 100 / span) if span > 0 else 0
    return {
        "level": idx + 1,
        "title": LEVEL_TITLES[idx],
        "icon": LEVEL_ICONS[idx],
        "min_points": min_points,
        "next_min": next_min,
        "points_to_next": points_to_next,
        "progress_pct": progress_pct,
    }


def next_threshold(lifetime: int) -> int | None:
    """Ngưỡng lũy kế của cấp KẾ TIẾP; None nếu đã ở cấp cao nhất."""
    lp = max(0, int(lifetime))
    for threshold in LEVEL_THRESHOLDS:
        if threshold > lp:
            return threshold
    return None


def next_streak_milestone(current: int) -> tuple[int | None, int | None]:
    """(mốc kế tiếp, số ngày còn tới mốc) cho streak hiện tại; (None, None) nếu đã qua mốc cao nhất."""
    for milestone in STREAK_MILESTONES:
        if milestone > current:
            return milestone, milestone - current
    return None, None


# --- Bộ huy hiệu hệ thống (seed, schema §6) --------------------------------
# Khóa dict trùng tên cột bảng ``badges`` để dùng trực tiếp cho seed (INSERT).
BADGE_SEED: list[dict] = [
    {"code": "first_task", "title": "Khởi đầu", "description": "Hoàn thành nhiệm vụ đầu tiên", "icon_emoji": "🎉", "criteria_type": "first_task", "threshold": 1, "sort_order": 1},
    {"code": "tasks_10", "title": "Chăm chỉ", "description": "Hoàn thành 10 nhiệm vụ", "icon_emoji": "💪", "criteria_type": "tasks_approved_total", "threshold": 10, "sort_order": 2},
    {"code": "tasks_50", "title": "Siêng năng", "description": "Hoàn thành 50 nhiệm vụ", "icon_emoji": "🔥", "criteria_type": "tasks_approved_total", "threshold": 50, "sort_order": 3},
    {"code": "tasks_100", "title": "Bậc thầy việc nhà", "description": "Hoàn thành 100 nhiệm vụ", "icon_emoji": "👑", "criteria_type": "tasks_approved_total", "threshold": 100, "sort_order": 4},
    {"code": "points_100", "title": "Trăm sao", "description": "Kiếm được 100 sao", "icon_emoji": "⭐", "criteria_type": "points_earned_total", "threshold": 100, "sort_order": 5},
    {"code": "points_500", "title": "Năm trăm sao", "description": "Kiếm được 500 sao", "icon_emoji": "🌟", "criteria_type": "points_earned_total", "threshold": 500, "sort_order": 6},
    {"code": "points_1000", "title": "Nghìn sao", "description": "Kiếm được 1000 sao", "icon_emoji": "💫", "criteria_type": "points_earned_total", "threshold": 1000, "sort_order": 7},
    {"code": "streak_7", "title": "Tuần hoàn hảo", "description": "Chuỗi 7 ngày liên tiếp", "icon_emoji": "📅", "criteria_type": "streak_days", "threshold": 7, "sort_order": 8},
    {"code": "streak_30", "title": "Bền bỉ", "description": "Chuỗi 30 ngày liên tiếp", "icon_emoji": "🏅", "criteria_type": "streak_days", "threshold": 30, "sort_order": 9},
    {"code": "reward_first", "title": "Phần thưởng đầu tiên", "description": "Đổi phần thưởng đầu tiên", "icon_emoji": "🎁", "criteria_type": "rewards_redeemed_total", "threshold": 1, "sort_order": 10},
    {"code": "weekly_goal_first", "title": "Đạt mục tiêu tuần", "description": "Đạt mục tiêu tuần lần đầu", "icon_emoji": "🏆", "criteria_type": "weekly_goal_hits", "threshold": 1, "sort_order": 11},
]

# Giá trị hợp lệ của ``badges.criteria_type`` (đồng bộ CHECK & LOV schema §5).
CRITERIA_TYPES: tuple[str, ...] = (
    "first_task",
    "tasks_approved_total",
    "points_earned_total",
    "streak_days",
    "rewards_redeemed_total",
    "weekly_goal_hits",
)
