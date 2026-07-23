"""Streak (chuỗi ngày hoạt động) — tính THUẦN + trao bonus mốc idempotent.

Ngày hoạt động = có >=1 nhiệm vụ 'approved' trong ngày (giờ VN, Q-C default).
Bonus mốc trao đồng bộ trong luồng approve, theo pattern WeeklyService (AD3).
"""

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import advisory_lock_child
from app.core.integrity import is_unique_violation
from app.core.progression_rules import STREAK_BONUS, STREAK_MILESTONES
from app.core.timeutil import today_vn
from app.models import PointsLedger, StreakMilestoneAward
from app.repositories.base import AuditRepository, ProgressionRepository


def compute_current_streak(active_days: set[date], today: date | None = None) -> int:
    """Chuỗi ngày liên tiếp TÍNH TỚI hôm nay (giờ VN). Pure — architecture §2.2.

    - Giữ chuỗi nếu hôm nay chưa hoạt động nhưng hôm qua có (mỏ neo = hôm qua).
    - Đứt (về 0) nếu lỡ trọn 1 ngày (cả hôm nay và hôm qua đều trống).
    """
    ref = today or today_vn()
    if ref in active_days:
        anchor = ref
    elif (ref - timedelta(days=1)) in active_days:
        anchor = ref - timedelta(days=1)
    else:
        return 0
    n = 0
    d = anchor
    while d in active_days:
        n += 1
        d -= timedelta(days=1)
    return n


def compute_longest_streak(active_days: set[date]) -> int:
    """Chuỗi liên tiếp dài nhất từng đạt trong tập ngày. Pure."""
    if not active_days:
        return 0
    days = sorted(active_days)
    longest = 1
    run = 1
    for i in range(1, len(days)):
        if (days[i] - days[i - 1]).days == 1:
            run += 1
        else:
            run = 1
        if run > longest:
            longest = run
    return longest


class StreakService:
    @staticmethod
    def maybe_award_streak_bonus(
        db: Session, family_id: UUID, actor_id: UUID, child_id: UUID
    ) -> int | None:
        """Sau khi duyệt 1 nhiệm vụ, trao bonus cho mọi mốc streak vừa CHẠM chưa từng thưởng.

        Idempotency (BR-PG-9):
          - Dedup tuần tự: bỏ qua mốc đã có trong `streak_milestone_awards`.
          - An toàn race: chèn award trước (UNIQUE(child_id, milestone)); thành công mới
            ghi ledger `streak_bonus`, cùng transaction; trùng -> rollback nhánh, bỏ qua.
        Trong phạm vi advisory_lock_child (đã mở ở approve; khóa xact reentrant).
        Trả về mốc CAO NHẤT vừa được thưởng (cho FE ăn mừng), hoặc None.
        """
        advisory_lock_child(db, child_id)
        days = ProgressionRepository.active_days(db, family_id, child_id)
        streak = compute_current_streak(days)
        if streak <= 0:
            return None
        already = ProgressionRepository.awarded_milestones(db, child_id)
        highest: int | None = None
        for milestone in STREAK_MILESTONES:
            if streak < milestone:
                break
            if milestone in already:
                continue
            bonus = STREAK_BONUS[milestone]
            award = StreakMilestoneAward(
                family_id=family_id,
                child_id=child_id,
                milestone=milestone,
                points_awarded=bonus,
            )
            try:
                db.add(award)
                db.flush()  # phát hiện UNIQUE(child_id, milestone) TRƯỚC khi ghi ledger
                ledger = PointsLedger(
                    family_id=family_id,
                    child_id=child_id,
                    delta=bonus,
                    kind="streak_bonus",
                    reason=f"streak {milestone} ngày 🔥",
                    created_by=actor_id,
                )
                db.add(ledger)
                db.flush()
                award.ledger_id = ledger.id
                AuditRepository.log(
                    db,
                    family_id=family_id,
                    actor_id=actor_id,
                    action="streak_bonus.award",
                    entity_type="child",
                    entity_id=child_id,
                    changes={"milestone": milestone, "bonus": bonus},
                )
                db.commit()
                highest = milestone
            except IntegrityError as exc:
                db.rollback()
                if is_unique_violation(exc, "uq_streak_milestone"):
                    continue
                raise
        return highest
