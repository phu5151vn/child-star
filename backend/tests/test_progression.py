"""Tiến trình (progression): unit rules thuần + service idempotency + API/quyền + F1 recurrence.

Chạy trên SQLite (create_all seed badges qua event). Race streak trên Postgres nằm ở
tests/test_progression_race.py.
"""

from datetime import date, datetime, time, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import Base, get_db
from app.core.progression_rules import level_for, next_streak_milestone, next_threshold
from app.core.timeutil import today_vn
from app.main import app
from app.models import Badge, Family, PointsLedger, StreakMilestoneAward, TaskAssignment, User
from app.services.progression_service import ProgressionService
from app.services.streak_service import (
    StreakService,
    compute_current_streak,
    compute_longest_streak,
)

engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# --------------------------------------------------------------------------
# 1) Unit — hàm thuần (không DB)
# --------------------------------------------------------------------------
def test_level_for_boundaries():
    assert level_for(99)["level"] == 1
    assert level_for(99)["progress_pct"] == 99
    lv2 = level_for(100)
    assert lv2["level"] == 2 and lv2["min_points"] == 100 and lv2["next_min"] == 250
    # Ví dụ architecture §3.1
    lv3 = level_for(320)
    assert lv3["level"] == 3 and lv3["points_to_next"] == 180 and lv3["progress_pct"] == 28
    # Cấp cao nhất
    top = level_for(2000)
    assert top["level"] == 6 and top["next_min"] is None and top["points_to_next"] is None
    assert top["progress_pct"] == 100
    assert level_for(999999)["level"] == 6


def test_next_threshold():
    assert next_threshold(0) == 100
    assert next_threshold(99) == 100
    assert next_threshold(100) == 250
    assert next_threshold(2000) is None


def test_next_streak_milestone():
    assert next_streak_milestone(0) == (3, 3)
    assert next_streak_milestone(5) == (7, 2)
    assert next_streak_milestone(7) == (14, 7)
    assert next_streak_milestone(30) == (None, None)
    assert next_streak_milestone(45) == (None, None)


def test_compute_current_streak():
    t = date(2026, 7, 23)
    # liên tiếp tới hôm nay
    assert compute_current_streak({t, t - timedelta(days=1), t - timedelta(days=2)}, today=t) == 3
    # hôm nay chưa có nhưng hôm qua có -> giữ chuỗi (mỏ neo = hôm qua)
    assert compute_current_streak({t - timedelta(days=1), t - timedelta(days=2)}, today=t) == 2
    # lỡ trọn 1 ngày (cả hôm nay & hôm qua trống) -> đứt
    assert compute_current_streak({t - timedelta(days=2)}, today=t) == 0
    # chỉ hôm nay
    assert compute_current_streak({t}, today=t) == 1
    assert compute_current_streak(set(), today=t) == 0


def test_compute_longest_streak():
    d = date(2026, 7, 1)
    days = {d, d + timedelta(days=1), d + timedelta(days=2), d + timedelta(days=5), d + timedelta(days=6)}
    assert compute_longest_streak(days) == 3
    assert compute_longest_streak(set()) == 0
    assert compute_longest_streak({d}) == 1


# --------------------------------------------------------------------------
# 2) Unit — service streak bonus idempotent (BR-PG-9)
# --------------------------------------------------------------------------
def _mk_family_child(db):
    fam = Family(name="F", family_code="STRK01")
    db.add(fam)
    db.flush()
    parent = User(family_id=fam.id, role="parent", display_name="P", email="p@strk.com", password_hash="x")
    child = User(family_id=fam.id, role="child", display_name="C", pin_hash="x")
    db.add_all([parent, child])
    db.commit()
    return fam, parent, child


def _add_active_day(db, fam, child, d: date):
    # decided_at 05:00 UTC = 12:00 VN cùng ngày -> VN date = d (an toàn không lệch ngày).
    dt = datetime.combine(d, time(5, 0), tzinfo=timezone.utc)
    db.add(
        TaskAssignment(
            family_id=fam.id, task_id=None, child_id=child.id,
            status="approved", custom_title="x", decided_at=dt,
        )
    )
    db.commit()


def _streak_ledger_rows(db, child_id):
    return db.scalars(
        select(PointsLedger).where(
            PointsLedger.child_id == child_id, PointsLedger.kind == "streak_bonus"
        )
    ).all()


def test_streak_bonus_awarded_once_and_idempotent():
    db = TestingSessionLocal()
    try:
        fam, parent, child = _mk_family_child(db)
        today = today_vn()
        for offset in (2, 1, 0):  # 3 ngày liên tiếp tới hôm nay -> streak 3
            _add_active_day(db, fam, child, today - timedelta(days=offset))

        m1 = StreakService.maybe_award_streak_bonus(db, fam.id, parent.id, child.id)
        assert m1 == 3
        rows = _streak_ledger_rows(db, child.id)
        assert len(rows) == 1 and rows[0].delta == 5  # STREAK_BONUS[3]
        awards = db.scalars(select(StreakMilestoneAward).where(StreakMilestoneAward.child_id == child.id)).all()
        assert len(awards) == 1 and awards[0].milestone == 3 and awards[0].ledger_id == rows[0].id

        # Gọi lại nhiều lần cùng ngày -> KHÔNG thưởng lại (unique trọn đời, dedup tuần tự).
        assert StreakService.maybe_award_streak_bonus(db, fam.id, parent.id, child.id) is None
        assert StreakService.maybe_award_streak_bonus(db, fam.id, parent.id, child.id) is None
        assert len(_streak_ledger_rows(db, child.id)) == 1
    finally:
        db.close()


def test_evaluate_badges_grants_and_no_duplicate():
    db = TestingSessionLocal()
    try:
        fam, parent, child = _mk_family_child(db)
        # 1 ngày hoạt động -> tasks_approved 0 (dùng ledger), nên seed 1 ledger task_approved.
        db.add(PointsLedger(family_id=fam.id, child_id=child.id, delta=120, kind="task_approved", created_by=parent.id))
        db.commit()
        newly = ProgressionService.evaluate_badges(db, fam.id, child.id)
        codes = {b.code for b in newly}
        assert "first_task" in codes and "tasks_10" not in codes and "points_100" in codes
        # Lần 2: không cấp trùng.
        assert ProgressionService.evaluate_badges(db, fam.id, child.id) == []
    finally:
        db.close()


# --------------------------------------------------------------------------
# 3) Integration — API + quyền (SQLite)
# --------------------------------------------------------------------------
def _register_parent(client, email="par@ex.com"):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "secret12", "family_name": "Fam", "display_name": "Parent"},
    )
    assert res.status_code == 200
    return res.json()["access_token"]


def _child_token(client, p_headers, name="Kid"):
    child_id = client.post("/api/v1/children", headers=p_headers, json={"display_name": name, "pin": "1234"}).json()["id"]
    family = client.get("/api/v1/family", headers=p_headers).json()
    login = client.post(
        "/api/v1/auth/child/login",
        json={"family_code": family["family_code"], "child_id": child_id, "pin": "1234"},
    )
    return child_id, login.json()["access_token"]


def _earn(client, p_headers, c_headers, points):
    task_id = client.post("/api/v1/tasks", headers=p_headers, json={"title": "T", "points": points}).json()["id"]
    a_id = client.post(f"/api/v1/tasks/{task_id}/claim", headers=c_headers).json()["id"]
    client.post(f"/api/v1/assignments/{a_id}/submit", headers=c_headers, json={})
    return client.post(f"/api/v1/assignments/{a_id}/approve", headers=p_headers)


def test_badges_catalog(client):
    token = _register_parent(client)
    res = client.get("/api/v1/badges", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert len(res.json()) == 11
    assert {b["code"] for b in res.json()} >= {"first_task", "points_100", "streak_7"}


def test_progression_shape_and_first_task_badge(client):
    token = _register_parent(client)
    p_headers = {"Authorization": f"Bearer {token}"}
    child_id, ctoken = _child_token(client, p_headers)
    c_headers = {"Authorization": f"Bearer {ctoken}"}
    _earn(client, p_headers, c_headers, 25)

    prog = client.get(f"/api/v1/children/{child_id}/progression", headers=p_headers).json()
    assert prog["lifetime_points"] == 25 and prog["balance"] == 25
    assert prog["level"]["level"] == 1
    first = next(b for b in prog["badges"] if b["code"] == "first_task")
    assert first["earned"] is True and first["progress_pct"] == 100
    tasks10 = next(b for b in prog["badges"] if b["code"] == "tasks_10")
    assert tasks10["earned"] is False and tasks10["current"] == 1 and tasks10["threshold"] == 10


def test_child_reads_own_progression_but_not_other(client):
    token = _register_parent(client)
    p_headers = {"Authorization": f"Bearer {token}"}
    id_a, ta = _child_token(client, p_headers, "A")
    id_b, tb = _child_token(client, p_headers, "B")
    ha = {"Authorization": f"Bearer {ta}"}
    # Con A đọc tiến trình của mình -> 200
    assert client.get(f"/api/v1/children/{id_a}/progression", headers=ha).status_code == 200
    # Con A đọc tiến trình con B -> 403
    assert client.get(f"/api/v1/children/{id_b}/progression", headers=ha).status_code == 403


def test_approve_returns_level_up_and_badge_events_no_stars(client):
    token = _register_parent(client)
    p_headers = {"Authorization": f"Bearer {token}"}
    child_id, ctoken = _child_token(client, p_headers)
    c_headers = {"Authorization": f"Bearer {ctoken}"}
    res = _earn(client, p_headers, c_headers, 100).json()

    ev = res["progression_events"]
    assert ev["level_up"] is not None and ev["level_up"]["level"] == 2
    codes = {b["code"] for b in ev["newly_earned_badges"]}
    assert {"first_task", "points_100"} <= codes
    assert ev["streak_milestone_reached"] is None

    # Lên cấp / mở huy hiệu KHÔNG cộng sao: balance == đúng điểm nhiệm vụ (AD6).
    bal = client.get(f"/api/v1/children/{child_id}/balance", headers=p_headers).json()["balance"]
    assert bal == 100


def test_me_child_has_level_and_streak(client):
    token = _register_parent(client)
    p_headers = {"Authorization": f"Bearer {token}"}
    child_id, ctoken = _child_token(client, p_headers)
    c_headers = {"Authorization": f"Bearer {ctoken}"}
    _earn(client, p_headers, c_headers, 30)
    me = client.get("/api/v1/me", headers=c_headers).json()
    assert me["level"] is not None and me["level"]["level"] == 1
    assert me["current_streak"] == 1


def test_redeem_does_not_drop_level(client):
    token = _register_parent(client)
    p_headers = {"Authorization": f"Bearer {token}"}
    child_id, ctoken = _child_token(client, p_headers)
    c_headers = {"Authorization": f"Bearer {ctoken}"}
    _earn(client, p_headers, c_headers, 100)  # Lv2, lifetime 100

    reward_id = client.post("/api/v1/rewards", headers=p_headers, json={"title": "Toy", "required_points": 60}).json()["id"]
    red = client.post(f"/api/v1/rewards/{reward_id}/redeem", headers=c_headers).json()
    assert client.post(f"/api/v1/redemptions/{red['id']}/approve", headers=p_headers).status_code == 200

    prog = client.get(f"/api/v1/children/{child_id}/progression", headers=p_headers).json()
    assert prog["level"]["level"] == 2  # KHÔNG tụt cấp
    assert prog["lifetime_points"] == 100 and prog["balance"] == 40
    reward_badge = next(b for b in prog["badges"] if b["code"] == "reward_first")
    assert reward_badge["earned"] is True


# --------------------------------------------------------------------------
# 4) F1 recurrence — reopen theo chu kỳ + chặn claim 2 lần/chu kỳ (BR-RC-5)
# --------------------------------------------------------------------------
def _approve_daily(client, p_headers, c_headers):
    task_id = client.post(
        "/api/v1/tasks", headers=p_headers, json={"title": "Brush", "points": 5, "recurrence": "daily"}
    ).json()["id"]
    a_id = client.post(f"/api/v1/tasks/{task_id}/claim", headers=c_headers).json()["id"]
    client.post(f"/api/v1/assignments/{a_id}/submit", headers=c_headers, json={})
    client.post(f"/api/v1/assignments/{a_id}/approve", headers=p_headers)
    return task_id, a_id


def test_daily_blocks_second_claim_same_day(client):
    token = _register_parent(client)
    p_headers = {"Authorization": f"Bearer {token}"}
    _, ctoken = _child_token(client, p_headers)
    c_headers = {"Authorization": f"Bearer {ctoken}"}
    task_id, _ = _approve_daily(client, p_headers, c_headers)
    # Cùng ngày -> đã hoàn thành trong chu kỳ, chặn claim lại (409).
    again = client.post(f"/api/v1/tasks/{task_id}/claim", headers=c_headers)
    assert again.status_code == 409


def test_daily_reopens_next_day(client):
    token = _register_parent(client)
    p_headers = {"Authorization": f"Bearer {token}"}
    _, ctoken = _child_token(client, p_headers)
    c_headers = {"Authorization": f"Bearer {ctoken}"}
    task_id, a_id = _approve_daily(client, p_headers, c_headers)

    # Lùi decided_at về hôm qua -> sang chu kỳ mới -> claim lại được.
    db = TestingSessionLocal()
    try:
        from uuid import UUID
        a = db.get(TaskAssignment, UUID(a_id))
        a.decided_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.commit()
    finally:
        db.close()
    reopened = client.post(f"/api/v1/tasks/{task_id}/claim", headers=c_headers)
    assert reopened.status_code == 200
