import uuid
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import AuthContext
from app.core.exceptions import ConflictError, ForbiddenRoleError, NotFoundError
from app.core.integrity import is_unique_violation
from app.core.security import create_access_token, hash_password, hash_pin, verify_password, verify_pin
from app.models import Family, PointsLedger, User
from app.repositories.base import AuditRepository, PointsRepository, generate_family_code, get_family_by_code
from app.services.weekly_service import _count_completed_this_week
from app.schemas import (
    ChildCreate,
    ChildProfile,
    ChildResponse,
    ChildUpdate,
    FamilyResponse,
    MeResponse,
    RegisterRequest,
)


class AuthService:
    @staticmethod
    def register(db: Session, data: RegisterRequest) -> tuple[str, str]:
        code = generate_family_code()
        while get_family_by_code(db, code):
            code = generate_family_code()
        family = Family(name=data.family_name, family_code=code)
        db.add(family)
        db.flush()
        parent = User(
            family_id=family.id,
            role="parent",
            display_name=data.display_name,
            email=data.email.lower(),
            password_hash=hash_password(data.password),
        )
        db.add(parent)
        db.commit()
        token = create_access_token(user_id=parent.id, role="parent", family_id=family.id)
        return token, code

    @staticmethod
    def parent_login(db: Session, email: str, password: str) -> str:
        user = db.scalar(select(User).where(User.email == email.lower(), User.role == "parent"))
        if not user or not user.password_hash or not verify_password(password, user.password_hash):
            raise NotFoundError("Email hoặc mật khẩu không đúng")
        return create_access_token(user_id=user.id, role="parent", family_id=user.family_id)

    @staticmethod
    def child_profiles(db: Session, family_code: str) -> list[ChildProfile]:
        family = get_family_by_code(db, family_code.upper())
        if not family:
            raise NotFoundError("Mã gia đình không đúng")
        children = db.scalars(
            select(User).where(
                User.family_id == family.id, User.role == "child", User.is_active.is_(True)
            )
        ).all()
        return [ChildProfile.model_validate(c) for c in children]

    @staticmethod
    def child_login(db: Session, family_code: str, child_id: UUID, pin: str) -> str:
        family = get_family_by_code(db, family_code.upper())
        if not family:
            raise NotFoundError("Mã gia đình không đúng")
        child = db.scalar(
            select(User).where(
                User.id == child_id,
                User.family_id == family.id,
                User.role == "child",
                User.is_active.is_(True),
            )
        )
        if not child or not child.pin_hash or not verify_pin(pin, child.pin_hash):
            raise NotFoundError("PIN không đúng")
        return create_access_token(
            user_id=child.id, role="child", family_id=family.id, child_id=child.id
        )

    @staticmethod
    def me(db: Session, ctx: AuthContext) -> MeResponse:
        user = db.get(User, ctx.user_id)
        if not user:
            raise NotFoundError()
        family = db.get(Family, ctx.family_id)
        balance = None
        if ctx.role == "child" and ctx.child_id:
            # Con nhìn thấy số sao KHẢ DỤNG (đã trừ phần đang chờ duyệt đổi thưởng).
            balance = PointsRepository.get_available_balance(db, ctx.child_id)
        return MeResponse(
            id=user.id,
            role=ctx.role,
            display_name=user.display_name,
            gender=user.gender,
            family_id=ctx.family_id,
            family_code=family.family_code if family else None,
            child_id=ctx.child_id,
            balance=balance,
        )


class ChildrenService:
    @staticmethod
    def list_children(db: Session, ctx: AuthContext) -> list[ChildResponse]:
        children = db.scalars(
            select(User).where(User.family_id == ctx.family_id, User.role == "child")
        ).all()
        result = []
        for child in children:
            balance = PointsRepository.get_balance(db, child.id)
            result.append(
                ChildResponse(
                    id=child.id,
                    display_name=child.display_name,
                    avatar_media_id=child.avatar_media_id,
                    gender=child.gender,
                    is_active=child.is_active,
                    balance=balance,
                    weekly_completed=_count_completed_this_week(db, ctx.family_id, child.id),
                )
            )
        return result

    @staticmethod
    def create_child(db: Session, ctx: AuthContext, data: ChildCreate) -> ChildResponse:
        child = User(
            family_id=ctx.family_id,
            role="child",
            display_name=data.display_name,
            pin_hash=hash_pin(data.pin),
            avatar_media_id=data.avatar_media_id,
            gender=data.gender,
        )
        db.add(child)
        try:
            db.flush()
            AuditRepository.log(
                db,
                family_id=ctx.family_id,
                actor_id=ctx.user_id,
                action="child.create",
                entity_type="child",
                entity_id=child.id,
                changes={"display_name": data.display_name},
            )
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            if is_unique_violation(exc, "uq_child_display_name"):
                raise ConflictError("Tên con đã tồn tại trong gia đình") from exc
            raise
        return ChildResponse(
            id=child.id,
            display_name=child.display_name,
            avatar_media_id=child.avatar_media_id,
            gender=child.gender,
            is_active=child.is_active,
            balance=0,
            weekly_completed=0,
        )

    @staticmethod
    def update_child(db: Session, ctx: AuthContext, child_id: UUID, data: ChildUpdate) -> ChildResponse:
        child = db.scalar(
            select(User).where(User.id == child_id, User.family_id == ctx.family_id, User.role == "child")
        )
        if not child:
            raise NotFoundError()
        before = {"display_name": child.display_name, "is_active": child.is_active}
        if data.display_name is not None:
            child.display_name = data.display_name
        if data.pin is not None:
            child.pin_hash = hash_pin(data.pin)
        if data.avatar_media_id is not None:
            child.avatar_media_id = data.avatar_media_id
        if data.gender is not None:
            child.gender = data.gender
        if data.is_active is not None:
            child.is_active = data.is_active
        AuditRepository.log(
            db,
            family_id=ctx.family_id,
            actor_id=ctx.user_id,
            action="child.update",
            entity_type="child",
            entity_id=child.id,
            changes={"before": before, "after": {"display_name": child.display_name, "is_active": child.is_active}},
        )
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            if is_unique_violation(exc, "uq_child_display_name"):
                raise ConflictError("Tên con đã tồn tại trong gia đình") from exc
            raise
        balance = PointsRepository.get_balance(db, child.id)
        return ChildResponse(
            id=child.id,
            display_name=child.display_name,
            avatar_media_id=child.avatar_media_id,
            gender=child.gender,
            is_active=child.is_active,
            balance=balance,
            weekly_completed=_count_completed_this_week(db, ctx.family_id, child.id),
        )

    @staticmethod
    def get_family(db: Session, ctx: AuthContext) -> FamilyResponse:
        family = db.get(Family, ctx.family_id)
        if not family:
            raise NotFoundError()
        return FamilyResponse.model_validate(family)
