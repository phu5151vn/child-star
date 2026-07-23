"""Tiến trình: dẫn xuất level/streak/metrics + đánh giá & cấp huy hiệu (idempotent).

Derive-first (AD1): mọi metric tính từ dữ liệu gốc; chỉ lưu 'sự kiện đã trao'
(child_badges) để idempotency. Level & badge KHÔNG cộng sao (AD6). Không chứa HTTP.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import AuthContext, require_owner_child
from app.core.exceptions import NotFoundError
from app.core.integrity import is_unique_violation
from app.core.progression_rules import level_for, next_streak_milestone
from app.core.timeutil import today_vn
from app.models import Badge, ChildBadge, User
from app.repositories.base import PointsRepository, ProgressionRepository
from app.schemas import BadgeCatalogItem, BadgeInfo, LevelInfo, ProgressionResponse, StreakInfo
from app.services.streak_service import compute_current_streak, compute_longest_streak


def _metric_value(criteria_type: str, metrics: dict) -> int:
    """Giá trị metric hiện tại theo `criteria_type` của huy hiệu (first_task dùng số nhiệm vụ)."""
    if criteria_type == "first_task":
        return metrics["tasks_approved_total"]
    return metrics.get(criteria_type, 0)


class ProgressionService:
    @staticmethod
    def _compute_metrics(db: Session, family_id: UUID, child_id: UUID) -> dict:
        """Tập metric dùng cho huy hiệu (streak dùng LONGEST — đạt là giữ, không mất)."""
        tasks_approved = ProgressionRepository.count_tasks_approved(db, family_id, child_id)
        days = ProgressionRepository.active_days(db, family_id, child_id)
        return {
            "tasks_approved_total": tasks_approved,
            "points_earned_total": ProgressionRepository.lifetime_points(db, family_id, child_id),
            "streak_days": compute_longest_streak(days),
            "rewards_redeemed_total": ProgressionRepository.count_rewards_redeemed(db, family_id, child_id),
            "weekly_goal_hits": ProgressionRepository.count_weekly_hits(db, family_id, child_id),
        }

    @staticmethod
    def evaluate_badges(db: Session, family_id: UUID, child_id: UUID) -> list[Badge]:
        """Cấp mọi huy hiệu con vừa đủ điều kiện & chưa có. Idempotent (BR-PG-13).

        - Dedup tuần tự: bỏ qua huy hiệu đã đạt.
        - An toàn race: bắt unique_violation trên UNIQUE(child_id, badge_code) -> no-op.
        KHÔNG cộng sao (cosmetic). Trả về danh sách huy hiệu MỚI cấp.
        """
        metrics = ProgressionService._compute_metrics(db, family_id, child_id)
        earned = set(ProgressionRepository.earned_badges(db, child_id).keys())
        badges = db.scalars(
            select(Badge).where(Badge.is_active.is_(True)).order_by(Badge.sort_order)
        ).all()
        newly: list[Badge] = []
        for b in badges:
            if b.code in earned:
                continue
            if _metric_value(b.criteria_type, metrics) < b.threshold:
                continue
            try:
                db.add(ChildBadge(family_id=family_id, child_id=child_id, badge_code=b.code))
                db.commit()
                newly.append(b)
            except IntegrityError as exc:
                db.rollback()
                if is_unique_violation(exc, "uq_child_badge"):
                    continue
                raise
        return newly

    @staticmethod
    def _level_and_streak(db: Session, family_id: UUID, child_id: UUID):
        lifetime = ProgressionRepository.lifetime_points(db, family_id, child_id)
        days = ProgressionRepository.active_days(db, family_id, child_id)
        current = compute_current_streak(days)
        longest = compute_longest_streak(days)
        next_m, days_to = next_streak_milestone(current)
        level = LevelInfo(**level_for(lifetime))
        streak = StreakInfo(
            current=current,
            longest=longest,
            active_today=today_vn() in days,
            next_milestone=next_m,
            days_to_next=days_to,
        )
        return lifetime, level, streak

    @staticmethod
    def get_progression(db: Session, ctx: AuthContext, child_id: UUID) -> ProgressionResponse:
        """Tổng hợp tiến trình: level + streak + huy hiệu (đạt & chưa đạt kèm tiến độ)."""
        require_owner_child(child_id, ctx)
        child = db.scalar(
            select(User).where(
                User.id == child_id, User.family_id == ctx.family_id, User.role == "child"
            )
        )
        if not child:
            raise NotFoundError()
        family_id = ctx.family_id
        lifetime, level, streak = ProgressionService._level_and_streak(db, family_id, child_id)
        balance = PointsRepository.get_balance(db, child_id)
        metrics = ProgressionService._compute_metrics(db, family_id, child_id)
        earned_map = ProgressionRepository.earned_badges(db, child_id)
        badges = db.scalars(
            select(Badge).where(Badge.is_active.is_(True)).order_by(Badge.sort_order)
        ).all()
        badge_infos: list[BadgeInfo] = []
        for b in badges:
            earned = b.code in earned_map
            cur_val = _metric_value(b.criteria_type, metrics)
            if earned:
                progress_pct = 100
            elif b.threshold > 0:
                progress_pct = min(100, int(cur_val * 100 / b.threshold))
            else:
                progress_pct = 0
            badge_infos.append(
                BadgeInfo(
                    code=b.code,
                    title=b.title,
                    icon=b.icon_emoji,
                    description=b.description,
                    earned=earned,
                    earned_at=earned_map.get(b.code),
                    progress_pct=progress_pct,
                    current=cur_val,
                    threshold=b.threshold,
                )
            )
        return ProgressionResponse(
            child_id=child_id,
            lifetime_points=lifetime,
            balance=balance,
            level=level,
            streak=streak,
            badges=badge_infos,
        )

    @staticmethod
    def list_badges(db: Session) -> list[BadgeCatalogItem]:
        """Catalog định nghĩa huy hiệu hệ thống (đọc chung, không PII) — BR-PG-12."""
        badges = db.scalars(
            select(Badge).where(Badge.is_active.is_(True)).order_by(Badge.sort_order)
        ).all()
        return [BadgeCatalogItem.model_validate(b) for b in badges]

    @staticmethod
    def me_summary(db: Session, family_id: UUID, child_id: UUID) -> tuple[LevelInfo, int]:
        """(level, current_streak) tóm tắt cho GET /me của con (BR-PG-2)."""
        _, level, streak = ProgressionService._level_and_streak(db, family_id, child_id)
        return level, streak.current
