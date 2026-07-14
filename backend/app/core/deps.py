from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.exceptions import ForbiddenRoleError
from app.core.security import decode_token
from app.models import User

security = HTTPBearer(auto_error=False)


@dataclass
class AuthContext:
    user_id: UUID
    role: str
    family_id: UUID
    child_id: UUID | None = None


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
    return AuthContext(
        user_id=user.id,
        role=payload["role"],
        family_id=UUID(payload["family_id"]),
        child_id=child_id,
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


def require_owner_child(child_id: UUID, ctx: AuthContext) -> None:
    if ctx.role == "child" and ctx.child_id != child_id:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=403,
            detail={"error_code": "FORBIDDEN_ROLE", "message": "Chỉ được truy cập dữ liệu của chính mình"},
        )
