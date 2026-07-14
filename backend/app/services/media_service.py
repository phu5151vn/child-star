import imghdr
import os
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import AuthContext
from app.core.exceptions import ForbiddenRoleError, NotFoundError
from app.models import Media
from app.repositories.base import get_user_in_family

ALLOWED_MIME = {"image/png", "image/jpeg", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024


class MediaService:
    @staticmethod
    def _validate_file(content: bytes, content_type: str | None) -> str:
        if len(content) > MAX_SIZE:
            raise ValueError("File quá lớn (tối đa 5MB)")
        kind = imghdr.what(None, h=content)
        mime_map = {"png": "image/png", "jpeg": "image/jpeg", "webp": "image/webp"}
        detected = mime_map.get(kind or "")
        if content_type and content_type in ALLOWED_MIME:
            detected = content_type
        if detected not in ALLOWED_MIME:
            raise ValueError("Định dạng ảnh không hợp lệ")
        return detected

    @staticmethod
    async def upload(db: Session, ctx: AuthContext, file: UploadFile, kind: str) -> UUID:
        if kind not in ("task_icon", "reward_image", "proof", "avatar"):
            raise ValueError("Loại media không hợp lệ")
        content = await file.read()
        mime = MediaService._validate_file(content, file.content_type)
        media_id = uuid.uuid4()
        ext = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}[mime]
        root = Path(settings.MEDIA_ROOT)
        root.mkdir(parents=True, exist_ok=True)
        rel_path = f"{ctx.family_id}/{media_id}{ext}"
        full_path = root / rel_path
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(content)
        media = Media(
            id=media_id,
            family_id=ctx.family_id,
            kind=kind,
            storage_path=rel_path,
            mime_type=mime,
            size_bytes=len(content),
            uploaded_by=ctx.user_id,
        )
        db.add(media)
        db.commit()
        return media_id

    @staticmethod
    def get_media_path(db: Session, ctx: AuthContext, media_id: UUID) -> tuple[str, str]:
        media = db.get(Media, media_id)
        if not media or media.family_id != ctx.family_id:
            raise NotFoundError()
        full_path = Path(settings.MEDIA_ROOT) / media.storage_path
        if media.kind == "proof":
            if ctx.role == "child" and media.uploaded_by != ctx.user_id:
                raise NotFoundError()
        if not full_path.exists():
            raise NotFoundError()
        return str(full_path), media.mime_type
