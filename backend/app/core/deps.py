from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.exceptions import ForbiddenRoleError
from app.core.security import decode_token
from app.models import ParentPermission, User
from sqlalchemy import select

security = HTTPBearer(auto_error=False)

# Các quyền có thể tắt cho tài khoản người thân đồng hành.
PERMISSION_KEYS = ("can_manage_members", "can_approve_tasks", "can_approve_rewards")


@dataclass
class AuthContext:
    user_id: UUID
    role: str
    family_id: UUID
    child_id: UUID | None = None
    is_admin: bool = False
    can_manage_members: bool = False
    can_approve_tasks: bool = False
    can_approve_rewards: bool = False


def get_auth_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> AuthContext:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Chưa đăng nhập")
    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ")
    user = db.get(User, UUID(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tài khoản không hợp lệ")
    child_id = UUID(payload["child_id"]) if payload.get("child_id") else None

    is_admin = False
    can_manage_members = can_approve_tasks = can_approve_rewards = False
    if payload["role"] == "parent":
        perm = db.scalar(select(ParentPermission).where(ParentPermission.user_id == user.id))
        if perm is None:
            # Không có hàng phân quyền -> admin đầy đủ (tài khoản bố mẹ gốc/cũ).
            is_admin = True
            can_manage_members = can_approve_tasks = can_approve_rewards = True
        else:
            is_admin = perm.is_admin
            # Admin luôn đủ quyền dù cờ chi tiết thế nào.
            can_manage_members = perm.is_admin or perm.can_manage_members
            can_approve_tasks = perm.is_admin or perm.can_approve_tasks
            can_approve_rewards = perm.is_admin or perm.can_approve_rewards

    return AuthContext(
        user_id=user.id,
        role=payload["role"],
        family_id=UUID(payload["family_id"]),
        child_id=child_id,
        is_admin=is_admin,
        can_manage_members=can_manage_members,
        can_approve_tasks=can_approve_tasks,
        can_approve_rewards=can_approve_rewards,
    )


def require_role(*roles: str):
    def _dep(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if ctx.role not in roles:
            from fastapi import HTTPException

            raise HTTPException(
                status_code=403,
                detail={"error_code": "FORBIDDEN_ROLE", "message": "Không có quyền thực hiện"},
            )
        return ctx

    return _dep


def require_permission(permission: str):
    """Yêu cầu tài khoản parent và có quyền chi tiết (vd 'can_approve_tasks').

    Người thân bị tắt quyền -> 403 với thông báo rõ ràng.
    """

    def _dep(ctx: AuthContext = Depends(get_auth_context)) -> AuthContext:
        if ctx.role != "parent":
            raise HTTPException(
                status_code=403,
                detail={"error_code": "FORBIDDEN_ROLE", "message": "Không có quyền thực hiện"},
            )
        if not getattr(ctx, permission, False):
            raise HTTPException(
                status_code=403,
                detail={
                    "error_code": "FORBIDDEN_PERMISSION",
                    "message": "Tài khoản người thân không có quyền cho thao tác này",
                },
            )
        return ctx

    return _dep


def require_owner_child(child_id: UUID, ctx: AuthContext) -> None:
    if ctx.role == "child" and ctx.child_id != child_id:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=403,
            detail={"error_code": "FORBIDDEN_ROLE", "message": "Chỉ được truy cập dữ liệu của chính mình"},
        )
