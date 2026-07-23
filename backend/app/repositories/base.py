import secrets
import string
from datetime import date
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.timeutil import to_vn_date
from app.models import (
    AuditLog,
    ChildBadge,
    Family,
    PointsLedger,
    Reward,
    RewardRedemption,
    StreakMilestoneAward,
    Task,
    TaskAssignment,
    User,
    WeeklyBonusAward,
)


def generate_family_code(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


class PointsRepository:
    @staticmethod
    def get_balance(db: Session, child_id: UUID) -> int:
        """Số dư thật theo sổ điểm (nguồn đúng — dùng khi trừ điểm thật lúc duyệt)."""
        result = db.scalar(
            select(func.coalesce(func.sum(PointsLedger.delta), 0)).where(PointsLedger.child_id == child_id)
        )
        return int(result or 0)

    @staticmethod
    def get_pending_hold(db: Session, child_id: UUID) -> int:
        """Tổng điểm đang bị "giữ chỗ" bởi các yêu cầu đổi thưởng còn ở trạng thái 'requested'.

        Đây là điểm con đã cam kết chi nhưng chưa được bố mẹ duyệt (chưa ghi sổ).
        """
        result = db.scalar(
            select(func.coalesce(func.sum(Reward.required_points), 0))
            .select_from(RewardRedemption)
            .join(Reward, Reward.id == RewardRedemption.reward_id)
            .where(
                RewardRedemption.child_id == child_id,
                RewardRedemption.status == "requested",
            )
        )
        return int(result or 0)

    @staticmethod
    def get_available_balance(db: Session, child_id: UUID) -> int:
        """Số sao con có thể tiêu = số dư thật − phần đang giữ chỗ (pending).

        Dùng cho mọi bề mặt hiển thị/kiểm tra phía CON để con không đổi vượt điểm.
        """
        return PointsRepository.get_balance(db, child_id) - PointsRepository.get_pending_hold(db, child_id)

    @staticmethod
    def has_ledger_for_assignment(db: Session, assignment_id: UUID) -> bool:
        return (
            db.scalar(
                select(PointsLedger.id).where(
                    PointsLedger.task_assignment_id == assignment_id,
                    PointsLedger.kind == "task_approved",
                )
            )
            is not None
        )

    @staticmethod
    def has_ledger_for_redemption(db: Session, redemption_id: UUID) -> bool:
        return (
            db.scalar(
                select(PointsLedger.id).where(
                    PointsLedger.reward_redemption_id == redemption_id,
                    PointsLedger.kind == "reward_redeemed",
                )
            )
            is not None
        )


class ProgressionRepository:
    """Truy vấn dẫn xuất cho tiến trình (AD1: derive-first). Luôn scope `family_id`.

    Không lưu counter làm nguồn đúng — mọi metric tính từ dữ liệu gốc.
    """

    @staticmethod
    def lifetime_points(db: Session, family_id: UUID, child_id: UUID) -> int:
        """Tổng sao LŨY KẾ đã kiếm (chỉ delta > 0) — nền của level & badge points (BR-PG-1)."""
        result = db.scalar(
            select(func.coalesce(func.sum(PointsLedger.delta), 0)).where(
                PointsLedger.child_id == child_id,
                PointsLedger.family_id == family_id,
                PointsLedger.delta > 0,
            )
        )
        return int(result or 0)

    @staticmethod
    def count_tasks_approved(db: Session, family_id: UUID, child_id: UUID) -> int:
        """Số nhiệm vụ được duyệt = số dòng ledger kind='task_approved'."""
        result = db.scalar(
            select(func.count(PointsLedger.id)).where(
                PointsLedger.child_id == child_id,
                PointsLedger.family_id == family_id,
                PointsLedger.kind == "task_approved",
            )
        )
        return int(result or 0)

    @staticmethod
    def active_days(db: Session, family_id: UUID, child_id: UUID) -> set[date]:
        """Tập NGÀY hoạt động (giờ VN) từ các assignment 'approved' — nền của streak (BR-PG-6)."""
        rows = db.scalars(
            select(TaskAssignment.decided_at).where(
                TaskAssignment.child_id == child_id,
                TaskAssignment.family_id == family_id,
                TaskAssignment.status == "approved",
                TaskAssignment.decided_at.is_not(None),
            )
        ).all()
        return {to_vn_date(dt) for dt in rows if dt is not None}

    @staticmethod
    def count_rewards_redeemed(db: Session, family_id: UUID, child_id: UUID) -> int:
        """Số phần thưởng đã đổi thành công (badge rewards_redeemed_total)."""
        result = db.scalar(
            select(func.count(RewardRedemption.id)).where(
                RewardRedemption.child_id == child_id,
                RewardRedemption.family_id == family_id,
                RewardRedemption.status == "approved",
            )
        )
        return int(result or 0)

    @staticmethod
    def count_weekly_hits(db: Session, family_id: UUID, child_id: UUID) -> int:
        """Số lần đạt mục tiêu tuần (badge weekly_goal_hits)."""
        result = db.scalar(
            select(func.count(WeeklyBonusAward.id)).where(
                WeeklyBonusAward.child_id == child_id,
                WeeklyBonusAward.family_id == family_id,
            )
        )
        return int(result or 0)

    @staticmethod
    def earned_badges(db: Session, child_id: UUID) -> dict:
        """{badge_code: earned_at} các huy hiệu con đã đạt."""
        rows = db.execute(
            select(ChildBadge.badge_code, ChildBadge.earned_at).where(ChildBadge.child_id == child_id)
        ).all()
        return {code: earned_at for code, earned_at in rows}

    @staticmethod
    def awarded_milestones(db: Session, child_id: UUID) -> set[int]:
        """Tập mốc streak đã thưởng cho con (để bỏ qua khi xét lại — dedup tuần tự)."""
        rows = db.scalars(
            select(StreakMilestoneAward.milestone).where(StreakMilestoneAward.child_id == child_id)
        ).all()
        return {int(m) for m in rows}


class AuditRepository:
    @staticmethod
    def log(
        db: Session,
        *,
        family_id: UUID,
        actor_id: UUID,
        action: str,
        entity_type: str,
        entity_id: UUID | None,
        changes: dict | None = None,
    ) -> None:
        db.add(
            AuditLog(
                family_id=family_id,
                actor_id=actor_id,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                changes=changes,
            )
        )


def get_family_by_code(db: Session, family_code: str) -> Family | None:
    return db.scalar(select(Family).where(Family.family_code == family_code.upper()))


def get_user_in_family(db: Session, user_id: UUID, family_id: UUID) -> User | None:
    return db.scalar(select(User).where(User.id == user_id, User.family_id == family_id))


def get_task_in_family(db: Session, task_id: UUID, family_id: UUID) -> Task | None:
    return db.scalar(select(Task).where(Task.id == task_id, Task.family_id == family_id))


def get_reward_in_family(db: Session, reward_id: UUID, family_id: UUID) -> Reward | None:
    return db.scalar(select(Reward).where(Reward.id == reward_id, Reward.family_id == family_id))


def get_assignment_in_family(db: Session, assignment_id: UUID, family_id: UUID) -> TaskAssignment | None:
    return db.scalar(
        select(TaskAssignment).where(TaskAssignment.id == assignment_id, TaskAssignment.family_id == family_id)
    )


def get_redemption_in_family(db: Session, redemption_id: UUID, family_id: UUID) -> RewardRedemption | None:
    return db.scalar(
        select(RewardRedemption).where(
            RewardRedemption.id == redemption_id, RewardRedemption.family_id == family_id
        )
    )
