from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def advisory_lock_child(db: Session, child_id) -> None:
    if db.bind and db.bind.dialect.name == "sqlite":
        return
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext(:child_id))"), {"child_id": str(child_id)})
