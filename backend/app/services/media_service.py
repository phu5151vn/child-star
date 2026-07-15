import imghdr
import uuid
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import NotFoundError
from app.core.deps import AuthContext
from app.models import Media

ALLOWED_MIME = {"image/png", "image/jpeg", "image/webp"}
MAX_SIZE = 5 * 1024 * 1024
_EXT = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
_TIMEOUT = httpx.Timeout(20.0)


class StorageNotConfiguredError(RuntimeError):
    """Thiếu cấu hình Supabase Storage — coi như lỗi vận hành, không im lặng lưu tạm."""


def _cfg() -> tuple[str, str, str]:
    url = settings.SUPABASE_URL.rstrip("/")
    key = settings.SUPABASE_SERVICE_KEY
    bucket = settings.SUPABASE_STORAGE_BUCKET
    if not url or not key:
        raise StorageNotConfiguredError(
            "Chưa cấu hình lưu trữ ảnh: cần SUPABASE_URL và SUPABASE_SERVICE_KEY."
        )
    return url, key, bucket


def _object_url(base: str, bucket: str, path: str) -> str:
    return f"{base}/storage/v1/object/{bucket}/{path}"


def _storage_upload(path: str, content: bytes, mime: str) -> None:
    base, key, bucket = _cfg()
    headers = {
        "Authorization": f"Bearer {key}",
        "apikey": key,
        "Content-Type": mime,
        "x-upsert": "true",
    }
    resp = httpx.post(_object_url(base, bucket, path), content=content, headers=headers, timeout=_TIMEOUT)
    if resp.status_code >= 300:
        detail = resp.text[:300]
        if "Bucket not found" in detail:
            raise ValueError(
                f"Bucket '{bucket}' chưa tồn tại trên Supabase Storage. "
                "Hãy tạo bucket private tên này trong Supabase."
            )
        raise ValueError(f"Tải ảnh lên Supabase thất bại ({resp.status_code}): {detail}")


def _storage_download(path: str) -> bytes:
    base, key, bucket = _cfg()
    headers = {"Authorization": f"Bearer {key}", "apikey": key}
    resp = httpx.get(_object_url(base, bucket, path), headers=headers, timeout=_TIMEOUT)
    if resp.status_code >= 300:
        raise NotFoundError("Không tìm thấy ảnh")
    return resp.content


def _storage_delete(path: str) -> None:
    """Xóa object khỏi bucket (best-effort — không chặn nghiệp vụ nếu lỗi)."""
    try:
        base, key, bucket = _cfg()
    except StorageNotConfiguredError:
        return
    headers = {"Authorization": f"Bearer {key}", "apikey": key}
    try:
        httpx.request(
            "DELETE", _object_url(base, bucket, path), headers=headers, timeout=_TIMEOUT
        )
    except httpx.HTTPError:
        pass


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
    def upload(db: Session, ctx: AuthContext, content: bytes, content_type: str | None, kind: str) -> UUID:
        if kind not in ("task_icon", "reward_image", "proof", "avatar"):
            raise ValueError("Loại media không hợp lệ")
        mime = MediaService._validate_file(content, content_type)
        media_id = uuid.uuid4()
        object_path = f"{ctx.family_id}/{media_id}{_EXT[mime]}"
        # Upload lên Supabase TRƯỚC; chỉ ghi DB khi lưu trữ thành công.
        _storage_upload(object_path, content, mime)
        media = Media(
            id=media_id,
            family_id=ctx.family_id,
            kind=kind,
            storage_path=object_path,
            mime_type=mime,
            size_bytes=len(content),
            uploaded_by=ctx.user_id,
        )
        db.add(media)
        db.commit()
        return media_id

    @staticmethod
    def read_media(db: Session, ctx: AuthContext, media_id: UUID) -> tuple[bytes, str]:
        media = db.get(Media, media_id)
        if not media or media.family_id != ctx.family_id:
            raise NotFoundError()
        # Ảnh minh chứng: con chỉ xem được ảnh của chính mình; bố mẹ xem được để duyệt.
        if media.kind == "proof" and ctx.role == "child" and media.uploaded_by != ctx.user_id:
            raise NotFoundError()
        content = _storage_download(media.storage_path)
        return content, media.mime_type

    @staticmethod
    def delete_media(db: Session, media_id: UUID | None) -> None:
        """Xóa hẳn 1 media (object trên Supabase + dòng DB). Dùng khi ảnh hết giá trị.

        An toàn khi gọi lặp lại / media không tồn tại. KHÔNG raise để không chặn nghiệp vụ.
        Lưu ý: caller phải gỡ mọi tham chiếu FK (vd assignment.proof_media_id) trước khi gọi.
        """
        if media_id is None:
            return
        media = db.get(Media, media_id)
        if not media:
            return
        path = media.storage_path
        db.delete(media)
        db.commit()
        _storage_delete(path)
