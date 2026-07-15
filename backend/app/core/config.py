from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET = "dev-secret-change-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENV: str = "dev"
    DATABASE_URL: str = "postgresql+psycopg2://benngoan:benngoan@localhost:5433/benngoan"
    JWT_SECRET: str = DEFAULT_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7
    MEDIA_ROOT: str = "./media"
    # Lưu ảnh lên Supabase Storage (private bucket) để không mất khi API restart/deploy.
    # Nếu để trống -> fallback về đĩa cục bộ MEDIA_ROOT (chỉ dùng cho dev).
    SUPABASE_URL: str = ""          # vd https://xxxx.supabase.co
    SUPABASE_SERVICE_KEY: str = ""  # service_role key (BÍ MẬT, chỉ dùng ở backend)
    SUPABASE_STORAGE_BUCKET: str = "media"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    LOGIN_RATE_LIMIT: int = 10
    LOGIN_RATE_WINDOW_SECONDS: int = 60


settings = Settings()


def validate_production_settings() -> None:
    if settings.ENV == "prod" and settings.JWT_SECRET == DEFAULT_JWT_SECRET:
        raise RuntimeError(
            "JWT_SECRET must be overridden when ENV=prod. "
            "Set a strong secret via environment variable."
        )
