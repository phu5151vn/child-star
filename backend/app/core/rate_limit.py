import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request

from app.core.config import settings

_lock = Lock()
_attempts: dict[str, list[float]] = defaultdict(list)


def _client_key(request: Request, suffix: str) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    host = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    return f"{host}:{suffix}"


def check_login_rate_limit(request: Request, key_suffix: str) -> None:
    limit = settings.LOGIN_RATE_LIMIT
    window = settings.LOGIN_RATE_WINDOW_SECONDS
    now = time.monotonic()
    bucket_key = _client_key(request, key_suffix)

    with _lock:
        timestamps = _attempts[bucket_key]
        cutoff = now - window
        _attempts[bucket_key] = [t for t in timestamps if t > cutoff]
        if len(_attempts[bucket_key]) >= limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "error_code": "RATE_LIMITED",
                    "message": "Quá nhiều lần đăng nhập. Vui lòng thử lại sau.",
                },
            )
        _attempts[bucket_key].append(now)
