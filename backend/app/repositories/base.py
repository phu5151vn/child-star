import secrets
import string
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    AuditLog,
    Family,
    PointsLedger,
    Reward,
    RewardRedemption,
    Task,
    TaskAssignment,
    User,
)


def generate_family_code(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


class PointsRepository:
    @staticmethod
    def get_balance(db: Session, child_id: UUID) -> int:
        result = db.scalar(
            select(func.coalesce(func.sum(PointsLedger.delta), 0)).where(PointsLedger.child_id == child_id)
        )
        return int(result or 0)

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
