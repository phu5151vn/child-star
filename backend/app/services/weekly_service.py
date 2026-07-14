"""Mục tiêu nhiệm vụ theo tuần + thưởng bonus khi con đạt mục tiêu."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import advisory_lock_child
from app.core.deps import AuthContext, require_owner_child
from app.core.exceptions import NotFoundError
from app.core.integrity import is_unique_violation
from app.core.timeutil import current_week_start, week_start_utc
from app.models import PointsLedger, TaskAssignment, User, WeeklyBonusAward, WeeklyGoal
from app.repositories.base import AuditRepository
from app.schemas import WeeklyGoalResponse, WeeklyGoalUpsert, WeeklyProgressResponse


def _get_active_goal(db: Session, family_id: UUID) -> WeeklyGoal | None:
    return db.scalar(
        select(WeeklyGoal).where(WeeklyGoal.family_id == family_id, WeeklyGoal.is_active.is_(True))
    )


def _count_completed_this_week(db: Session, family_id: UUID, child_id: UUID) -> int:
    since = week_start_utc()
    result = db.scalar(
        select(func.count(TaskAssignment.id)).where(
            TaskAssignment.family_id == family_id,
            TaskAssignment.child_id == child_id,
            TaskAssignment.status == "approved",
            TaskAssignment.decided_at >= since,
        )
    )
    return int(result or 0)


def _bonus_awarded_this_week(db: Session, child_id: UUID) -> bool:
    return (
        db.scalar(
            select(WeeklyBonusAward.id).where(
                WeeklyBonusAward.child_id == child_id,
                WeeklyBonusAward.week_start == current_week_start(),
            )
        )
        is not None
    )


class WeeklyService:
    @staticmethod
    def get_goal(db: Session, family_id: UUID) -> WeeklyGoalResponse:
        goal = db.scalar(select(WeeklyGoal).where(WeeklyGoal.family_id == family_id))
        if not goal:
            return WeeklyGoalResponse(is_active=False)
        return WeeklyGoalResponse(
            id=goal.id,
            target_count=goal.target_count,
            bonus_points=goal.bonus_points,
            is_active=goal.is_active,
        )

    @staticmethod
    def upsert_goal(db: Session, ctx: AuthContext, data: WeeklyGoalUpsert) -> WeeklyGoalResponse:
        goal = db.scalar(select(WeeklyGoal).where(WeeklyGoal.family_id == ctx.family_id))
        if goal:
            goal.target_count = data.target_count
            goal.bonus_points = data.bonus_points
            goal.is_active = data.is_active
        else:
            goal = WeeklyGoal(
                family_id=ctx.family_id,
                target_count=data.target_count,
                bonus_points=data.bonus_points,
                is_active=data.is_active,
                created_by=ctx.user_id,
            )
            db.add(goal)
        AuditRepository.log(
            db,
            family_id=ctx.family_id,
            actor_id=ctx.user_id,
            action="weekly_goal.upsert",
            entity_type="weekly_goal",
            entity_id=None,
            changes={"target_count": data.target_count, "bonus_points": data.bonus_points, "is_active": data.is_active},
        )
        db.commit()
        db.refresh(goal)
        return WeeklyGoalResponse(
            id=goal.id,
            target_count=goal.target_count,
            bonus_points=goal.bonus_points,
            is_active=goal.is_active,
        )

    @staticmethod
    def get_progress(db: Session, ctx: AuthContext, child_id: UUID) -> WeeklyProgressResponse:
        require_owner_child(child_id, ctx)
        child = db.scalar(
            select(User).where(User.id == child_id, User.family_id == ctx.family_id, User.role == "child")
        )
        if not child:
            raise NotFoundError()
        goal = _get_active_goal(db, ctx.family_id)
        completed = _count_completed_this_week(db, ctx.family_id, child_id)
        if not goal:
            return WeeklyProgressResponse(
                child_id=child_id,
                enabled=False,
                completed=completed,
                week_start=week_start_utc(),
            )
        remaining = max(0, goal.target_count - completed)
        return WeeklyProgressResponse(
            child_id=child_id,
            enabled=True,
            target_count=goal.target_count,
            bonus_points=goal.bonus_points,
            completed=completed,
            remaining=remaining,
            achieved=completed >= goal.target_count,
            bonus_earned=_bonus_awarded_this_week(db, child_id),
            week_start=week_start_utc(),
        )

    @staticmethod
    def maybe_award_bonus(db: Session, family_id: UUID, actor_id: UUID, child_id: UUID) -> None:
        """Sau khi duyệt 1 nhiệm vụ, kiểm tra và trao bonus tuần nếu con vừa đạt mục tiêu.

        Idempotent: ràng buộc uq_weekly_bonus_child_week đảm bảo mỗi con chỉ nhận 1 lần/tuần.
        """
        goal = _get_active_goal(db, family_id)
        if not goal:
            return
        advisory_lock_child(db, child_id)
        if _bonus_awarded_this_week(db, child_id):
            return
        completed = _count_completed_this_week(db, family_id, child_id)
        if completed < goal.target_count:
            return
        week_start = current_week_start()
        try:
            db.add(
                WeeklyBonusAward(
                    family_id=family_id,
                    child_id=child_id,
                    week_start=week_start,
                    goal_id=goal.id,
                )
            )
            db.flush()
            db.add(
                PointsLedger(
                    family_id=family_id,
                    child_id=child_id,
                    delta=goal.bonus_points,
                    kind="weekly_bonus",
                    reason=f"Thưởng tuần: hoàn thành {goal.target_count} nhiệm vụ 🎯",
                    created_by=actor_id,
                )
            )
            AuditRepository.log(
                db,
                family_id=family_id,
                actor_id=actor_id,
                action="weekly_bonus.award",
                entity_type="child",
                entity_id=child_id,
                changes={"bonus_points": goal.bonus_points, "target_count": goal.target_count},
            )
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            if is_unique_violation(exc, "uq_weekly_bonus_child_week"):
                return
            raise
