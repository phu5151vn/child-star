"""Race streak-bonus trên PostgreSQL: 2 approve song song vừa chạm mốc -> 1 dòng streak_bonus.

Kiểm chứng advisory_lock_child + UNIQUE(child_id, milestone) (BR-PG-9, BR-PG-10).
"""

import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, time, timedelta, timezone
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 — register DDL + seed event trước khi import app

from app.core.db import Base, get_db
from app.core.security import create_access_token, hash_password, hash_pin
from app.core.timeutil import today_vn
from app.main import app
from app.models import Family, PointsLedger, StreakMilestoneAward, Task, TaskAssignment, User

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.postgres

if not TEST_DATABASE_URL:
    pytest.skip(
        "TEST_DATABASE_URL not set and no local Postgres binaries — install postgresql to run race gate",
        allow_module_level=True,
    )

engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _setup_schema():
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
        conn.commit()
    Base.metadata.create_all(bind=engine)


@pytest.fixture(autouse=True)
def fresh_db():
    _setup_schema()
    yield


@pytest.fixture
def client():
    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _active_dt(days_ago: int) -> datetime:
    d = today_vn() - timedelta(days=days_ago)
    return datetime.combine(d, time(5, 0), tzinfo=timezone.utc)  # 12:00 VN cùng ngày


def _seed():
    """Con đã có 2 ngày hoạt động (hôm qua, hôm kia) + 2 task submitted hôm nay."""
    db = SessionLocal()
    try:
        fam = Family(name="Streak Fam", family_code="STRKR1")
        db.add(fam)
        db.flush()
        parent = User(family_id=fam.id, role="parent", display_name="P", email="sr@ex.com", password_hash=hash_password("secret12"))
        child = User(family_id=fam.id, role="child", display_name="C", pin_hash=hash_pin("1234"))
        db.add_all([parent, child])
        db.flush()
        # 2 ngày hoạt động trong quá khứ (approved).
        for days_ago in (1, 2):
            db.add(TaskAssignment(family_id=fam.id, task_id=None, child_id=child.id, status="approved", custom_title="past", decided_at=_active_dt(days_ago)))
        # 2 task + 2 assignment 'submitted' hôm nay (chờ duyệt).
        ids = []
        for i in range(2):
            task = Task(family_id=fam.id, title=f"T{i}", points=5, created_by=parent.id)
            db.add(task)
            db.flush()
            a = TaskAssignment(family_id=fam.id, task_id=task.id, child_id=child.id, status="submitted", submitted_at=datetime.now(timezone.utc))
            db.add(a)
            db.flush()
            ids.append(a.id)
        db.commit()
        return {
            "child_id": child.id,
            "assignment_ids": [str(x) for x in ids],
            "parent_token": create_access_token(user_id=parent.id, role="parent", family_id=fam.id),
        }
    finally:
        db.close()


@pytest.mark.postgres
def test_race_streak_bonus_single_ledger(client):
    seed = _seed()
    p_headers = {"Authorization": f"Bearer {seed['parent_token']}"}

    def worker(assignment_id: str):
        local = TestClient(app)

        def override():
            db = SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override
        try:
            return local.post(f"/api/v1/assignments/{assignment_id}/approve", headers=p_headers)
        finally:
            app.dependency_overrides.clear()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = [f.result() for f in as_completed([pool.submit(worker, aid) for aid in seed["assignment_ids"]])]
    assert all(r.status_code == 200 for r in results)

    db = SessionLocal()
    try:
        # Cả 2 approve đẩy streak lên 3 -> đúng 1 dòng streak_bonus + 1 award mốc 3.
        streak_ledgers = db.scalars(
            select(PointsLedger).where(PointsLedger.child_id == seed["child_id"], PointsLedger.kind == "streak_bonus")
        ).all()
        assert len(streak_ledgers) == 1 and streak_ledgers[0].delta == 5
        award_count = db.scalar(
            select(func.count()).select_from(StreakMilestoneAward).where(
                StreakMilestoneAward.child_id == seed["child_id"], StreakMilestoneAward.milestone == 3
            )
        )
        assert award_count == 1
        # 2 task_approved + 1 streak_bonus = tổng lũy kế 5+5+5 = 15.
        lifetime = db.scalar(
            select(func.coalesce(func.sum(PointsLedger.delta), 0)).where(
                PointsLedger.child_id == seed["child_id"], PointsLedger.delta > 0
            )
        )
        assert lifetime == 15
    finally:
        db.close()
