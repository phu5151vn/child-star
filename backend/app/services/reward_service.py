from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.db import advisory_lock_child
from app.core.deps import AuthContext, require_owner_child
from app.core.exceptions import (
    InsufficientPointsError,
    NotFoundError,
    OutOfStockError,
    RewardLockedError,
)
from app.core.integrity import is_unique_violation
from app.models import PointsLedger, Reward, RewardRedemption
from app.repositories.base import (
    AuditRepository,
    PointsRepository,
    get_redemption_in_family,
    get_reward_in_family,
)
from app.schemas import RedemptionResponse, RewardResponse


class RewardService:
    @staticmethod
    def _compute_unlock(balance: int, reward: Reward) -> tuple[bool, int, bool]:
        is_out_of_stock = reward.stock is not None and reward.stock <= 0
        is_unlocked = balance >= reward.required_points and not is_out_of_stock
        missing = max(0, reward.required_points - balance)
        return is_unlocked, missing, is_out_of_stock

    @staticmethod
    def list_rewards(db: Session, ctx: AuthContext) -> list[RewardResponse]:
        rewards = db.scalars(
            select(Reward).where(Reward.family_id == ctx.family_id).order_by(Reward.required_points)
        ).all()
        balance = 0
        if ctx.role == "child" and ctx.child_id:
            # Unlock/thiếu điểm tính trên số dư KHẢ DỤNG để con không đổi vượt điểm.
            balance = PointsRepository.get_available_balance(db, ctx.child_id)
        result = []
        for r in rewards:
            if ctx.role == "child" and not r.is_active:
                continue
            is_unlocked, missing, is_out_of_stock = RewardService._compute_unlock(balance, r)
            result.append(
                RewardResponse(
                    id=r.id,
                    title=r.title,
                    description=r.description,
                    required_points=r.required_points,
                    image_media_id=r.image_media_id,
                    icon_emoji=r.icon_emoji,
                    stock=r.stock,
                    is_active=r.is_active,
                    is_unlocked=is_unlocked if ctx.role == "child" else None,
                    missing_points=missing if ctx.role == "child" and not is_unlocked else None,
                    is_out_of_stock=is_out_of_stock,
                )
            )
        return result

    @staticmethod
    def get_reward(db: Session, ctx: AuthContext, reward_id: UUID) -> RewardResponse:
        reward = get_reward_in_family(db, reward_id, ctx.family_id)
        if not reward:
            raise NotFoundError()
        balance = 0
        if ctx.role == "child" and ctx.child_id:
            balance = PointsRepository.get_available_balance(db, ctx.child_id)
        is_unlocked, missing, is_out_of_stock = RewardService._compute_unlock(balance, reward)
        return RewardResponse(
            id=reward.id,
            title=reward.title,
            description=reward.description,
            required_points=reward.required_points,
            image_media_id=reward.image_media_id,
            icon_emoji=reward.icon_emoji,
            stock=reward.stock,
            is_active=reward.is_active,
            is_unlocked=is_unlocked if ctx.role == "child" else None,
            missing_points=missing if ctx.role == "child" and not is_unlocked else None,
            is_out_of_stock=is_out_of_stock,
        )

    @staticmethod
    def create_reward(db: Session, ctx: AuthContext, data) -> RewardResponse:
        reward = Reward(
            family_id=ctx.family_id,
            title=data.title,
            description=data.description,
            required_points=data.required_points,
            image_media_id=data.image_media_id,
            icon_emoji=data.icon_emoji,
            stock=data.stock,
            is_active=data.is_active,
            created_by=ctx.user_id,
        )
        db.add(reward)
        db.flush()
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action="reward.create", entity_type="reward", entity_id=reward.id,
            changes={"title": reward.title, "required_points": reward.required_points},
        )
        db.commit()
        return RewardResponse.model_validate(reward)

    @staticmethod
    def update_reward(db: Session, ctx: AuthContext, reward_id: UUID, data) -> RewardResponse:
        reward = get_reward_in_family(db, reward_id, ctx.family_id)
        if not reward:
            raise NotFoundError()
        for field in ("title", "description", "required_points", "image_media_id", "icon_emoji", "stock", "is_active"):
            val = getattr(data, field, None)
            if val is not None:
                setattr(reward, field, val)
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action="reward.update", entity_type="reward", entity_id=reward.id, changes={},
        )
        db.commit()
        return RewardResponse.model_validate(reward)

    @staticmethod
    def delete_reward(db: Session, ctx: AuthContext, reward_id: UUID) -> None:
        reward = get_reward_in_family(db, reward_id, ctx.family_id)
        if not reward:
            raise NotFoundError()
        reward.is_active = False
        AuditRepository.log(
            db, family_id=ctx.family_id, actor_id=ctx.user_id,
            action="reward.delete", entity_type="reward", entity_id=reward.id, changes={},
        )
        db.commit()


class RedemptionService:
    @staticmethod
    def list_redemptions(
        db: Session, ctx: AuthContext, child_id: UUID | None = None, status: str | None = None
    ) -> list[RedemptionResponse]:
        q = select(RewardRedemption).where(RewardRedemption.family_id == ctx.family_id)
        if ctx.role == "child":
            q = q.where(RewardRedemption.child_id == ctx.child_id)
        elif child_id:
            q = q.where(RewardRedemption.child_id == child_id)
        if status:
            q = q.where(RewardRedemption.status == status)
        redemptions = db.scalars(q.order_by(RewardRedemption.requested_at.desc())).all()
        result = []
        for r in redemptions:
            reward = db.get(Reward, r.reward_id)
            child = db.get(__import__("app.models", fromlist=["User"]).User, r.child_id)
            result.append(
                RedemptionResponse(
                    id=r.id,
                    reward_id=r.reward_id,
                    child_id=r.child_id,
                    status=r.status,
                    points_spent=r.points_spent,
                    reward_title=reward.title if reward else None,
                    reward_emoji=reward.icon_emoji if reward else None,
                    child_name=child.display_name if child else None,
                    child_gender=child.gender if child else None,
                    reject_reason=r.reject_reason,
                    requested_at=r.requested_at,
                    decided_at=r.decided_at,
                )
            )
        return result

    @staticmethod
    def redeem(db: Session, ctx: AuthContext, reward_id: UUID) -> RedemptionResponse:
        reward = get_reward_in_family(db, reward_id, ctx.family_id)
        if not reward or not reward.is_active:
            raise NotFoundError()
        if not ctx.child_id:
            raise RewardLockedError()
        # Kiểm tra trên số dư KHẢ DỤNG (đã trừ các yêu cầu đang chờ duyệt) để con
        # không thể gửi nhiều yêu cầu vượt quá số sao đang có.
        balance = PointsRepository.get_available_balance(db, ctx.child_id)
        is_unlocked, missing, is_out_of_stock = RewardService._compute_unlock(balance, reward)
        if is_out_of_stock:
            raise OutOfStockError()
        if not is_unlocked:
            raise RewardLockedError(f"Con cần thêm {missing} điểm nữa")
        existing = db.scalar(
            select(RewardRedemption).where(
                RewardRedemption.reward_id == reward_id,
                RewardRedemption.child_id == ctx.child_id,
                RewardRedemption.status == "requested",
            )
        )
        if existing:
            return RedemptionService._to_response(db, existing)
        redemption = RewardRedemption(
            family_id=ctx.family_id,
            reward_id=reward_id,
            child_id=ctx.child_id,
            status="requested",
        )
        try:
            db.add(redemption)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            if is_unique_violation(exc, "uq_redemption_requested"):
                existing = db.scalar(
                    select(RewardRedemption).where(
                        RewardRedemption.reward_id == reward_id,
                        RewardRedemption.child_id == ctx.child_id,
                        RewardRedemption.status == "requested",
                    )
                )
                if existing:
                    return RedemptionService._to_response(db, existing)
            raise
        return RedemptionService._to_response(db, redemption)

    @staticmethod
    def approve(db: Session, ctx: AuthContext, redemption_id: UUID) -> RedemptionResponse:
        redemption = get_redemption_in_family(db, redemption_id, ctx.family_id)
        if not redemption:
            raise NotFoundError()

        advisory_lock_child(db, redemption.child_id)

        if redemption.status == "approved" or PointsRepository.has_ledger_for_redemption(db, redemption.id):
            if redemption.status != "approved":
                redemption.status = "approved"
                redemption.decided_at = datetime.now(timezone.utc)
                redemption.decided_by = ctx.user_id
                db.commit()
            return RedemptionService._to_response(db, redemption)

        if redemption.status != "requested":
            raise NotFoundError("Yêu cầu không còn chờ duyệt")

        reward = db.get(Reward, redemption.reward_id)
        if not reward:
            raise NotFoundError()
        if reward.stock is not None and reward.stock <= 0:
            raise OutOfStockError()

        balance = PointsRepository.get_balance(db, redemption.child_id)
        if balance < reward.required_points:
            raise InsufficientPointsError("Số dư con không còn đủ điểm")

        if reward.stock is not None:
            reward.stock -= 1
        redemption.status = "approved"
        redemption.points_spent = reward.required_points
        redemption.decided_at = datetime.now(timezone.utc)
        redemption.decided_by = ctx.user_id
        points_delta = -reward.required_points

        try:
            db.add(
                PointsLedger(
                    family_id=ctx.family_id,
                    child_id=redemption.child_id,
                    delta=points_delta,
                    kind="reward_redeemed",
                    reward_redemption_id=redemption.id,
                    created_by=ctx.user_id,
                )
            )
            AuditRepository.log(
                db,
                family_id=ctx.family_id,
                actor_id=ctx.user_id,
                action="redemption.approve",
                entity_type="redemption",
                entity_id=redemption.id,
                changes={"points_delta": points_delta},
            )
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            if is_unique_violation(exc, "uq_ledger_reward_redeemed"):
                db.refresh(redemption)
                return RedemptionService._to_response(db, redemption)
            raise

        return RedemptionService._to_response(db, redemption)

    @staticmethod
    def reject(db: Session, ctx: AuthContext, redemption_id: UUID, reason: str | None) -> RedemptionResponse:
        redemption = get_redemption_in_family(db, redemption_id, ctx.family_id)
        if not redemption:
            raise NotFoundError()
        if redemption.status != "requested":
            raise NotFoundError()
        redemption.status = "rejected"
        redemption.reject_reason = reason
        redemption.decided_at = datetime.now(timezone.utc)
        redemption.decided_by = ctx.user_id
        AuditRepository.log(
            db,
            family_id=ctx.family_id,
            actor_id=ctx.user_id,
            action="redemption.reject",
            entity_type="redemption",
            entity_id=redemption.id,
            changes={"reason": reason},
        )
        db.commit()
        return RedemptionService._to_response(db, redemption)

    @staticmethod
    def cancel(db: Session, ctx: AuthContext, redemption_id: UUID) -> RedemptionResponse:
        redemption = get_redemption_in_family(db, redemption_id, ctx.family_id)
        if not redemption or redemption.child_id != ctx.child_id:
            raise NotFoundError()
        if redemption.status != "requested":
            raise NotFoundError()
        redemption.status = "cancelled"
        AuditRepository.log(
            db,
            family_id=ctx.family_id,
            actor_id=ctx.user_id,
            action="redemption.cancel",
            entity_type="redemption",
            entity_id=redemption.id,
            changes={},
        )
        db.commit()
        return RedemptionService._to_response(db, redemption)

    @staticmethod
    def _to_response(db: Session, redemption: RewardRedemption) -> RedemptionResponse:
        from app.models import User

        reward = db.get(Reward, redemption.reward_id)
        child = db.get(User, redemption.child_id)
        return RedemptionResponse(
            id=redemption.id,
            reward_id=redemption.reward_id,
            child_id=redemption.child_id,
            status=redemption.status,
            points_spent=redemption.points_spent,
            reward_title=reward.title if reward else None,
            reward_emoji=reward.icon_emoji if reward else None,
            child_name=child.display_name if child else None,
            child_gender=child.gender if child else None,
            reject_reason=redemption.reject_reason,
            requested_at=redemption.requested_at,
            decided_at=redemption.decided_at,
        )
