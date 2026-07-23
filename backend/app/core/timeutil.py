"""Tiện ích thời gian dùng múi giờ Việt Nam (UTC+7) cho ranh giới ngày/tuần.

App phục vụ gia đình Việt Nam nên "hôm nay" và "tuần này" được tính theo giờ VN,
tránh lệch ngày do so sánh trực tiếp theo UTC.
"""

from datetime import date, datetime, time, timedelta, timezone

VN_TZ = timezone(timedelta(hours=7))


def now_vn() -> datetime:
    return datetime.now(VN_TZ)


def today_vn() -> date:
    return now_vn().date()


def current_week_start() -> date:
    """Thứ Hai của tuần hiện tại theo giờ VN."""
    d = today_vn()
    return d - timedelta(days=d.weekday())


def week_start_utc(week_start: date | None = None) -> datetime:
    """00:00 giờ VN của đầu tuần, quy đổi sang UTC để so sánh với cột lưu UTC."""
    ws = week_start or current_week_start()
    return datetime.combine(ws, time.min, tzinfo=VN_TZ).astimezone(timezone.utc)


def to_vn_date(dt: datetime) -> date:
    """Ngày theo giờ VN của một mốc thời gian. Naive datetime coi như UTC (SQLite).

    Dùng cho ranh giới "ngày hoạt động" của streak (AD7), nhất quán với recurrence.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(VN_TZ).date()


def is_completed_current_period(recurrence: str, decided_at: datetime | None) -> bool:
    """Nhiệm vụ đã hoàn thành trong chu kỳ hiện tại (đang bị khóa) hay chưa.

    - once: hoàn thành 1 lần là khóa vĩnh viễn.
    - daily: khóa nếu đã hoàn thành trong hôm nay (giờ VN).
    - weekly: khóa nếu đã hoàn thành trong tuần này (giờ VN).
    """
    if decided_at is None:
        return True
    if recurrence == "once":
        return True
    d = decided_at.astimezone(VN_TZ).date()
    now = today_vn()
    if recurrence == "daily":
        return d == now
    if recurrence == "weekly":
        return d >= current_week_start()
    return True
