"""Race-condition tests on real PostgreSQL (advisory locks + partial unique indexes)."""

import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import sessionmaker

import app.models  # noqa: F401 — register PostgreSQL DDL before app import

from app.core.db import Base, get_db
from app.core.security import create_access_token, hash_password, hash_pin
from app.main import app
from app.models import Family, PointsLedger, Reward, RewardRedemption, Task, TaskAssignment, User
from app.repositories.base import PointsRepository

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.postgres

if not TEST_DATABASE_URL:
    pytest.skip(
        "TEST_DATABASE_URL not set and no local Postgres binaries — "
        "install postgresql to run race gate",
        allow_module_level=True,
    )

engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _setup_schema():
    # users <-> media circular FK prevents metadata.drop_all on PostgreSQL
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
        conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
        conn.commit()
    Base.metadata.create_all(bind=engine)


def _seed_family_with_child_and_task(points: int = 25):
    """Return dict with ids and tokens for race tests."""
    db = SessionLocal()
    try:
        family = Family(name="Race Family", family_code="RACE01")
        db.add(family)
        db.flush()
        parent = User(
            family_id=family.id,
            role="parent",
            display_name="Parent",
            email="race@example.com",
            password_hash=hash_password("secret12"),
        )
        child = User(
            family_id=family.id,
            role="child",
            display_name="Kid",
            pin_hash=hash_pin("1234"),
        )
        db.add_all([parent, child])
        db.flush()
        task = Task(
            family_id=family.id,
            title="Race Task",
            points=points,
            created_by=parent.id,
        )
        db.add(task)
        db.commit()
        parent_token = create_access_token(user_id=parent.id, role="parent", family_id=family.id)
        child_token = create_access_token(
            user_id=child.id, role="child", family_id=family.id, child_id=child.id
        )
        return {
            "family_id": family.id,
            "parent_id": parent.id,
            "child_id": child.id,
            "task_id": task.id,
            "parent_token": parent_token,
            "child_token": child_token,
            "family_code": family.family_code,
        }
    finally:
        db.close()


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


def _concurrent_approve_assignment(parent_token: str, assignment_id: str, n: int = 15):
    headers = {"Authorization": f"Bearer {parent_token}"}

    def worker():
        local_client = TestClient(app)

        def override():
            db = SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override
        try:
            return local_client.post(f"/api/v1/assignments/{assignment_id}/approve", headers=headers)
        finally:
            app.dependency_overrides.clear()

    with ThreadPoolExecutor(max_workers=n) as pool:
        futures = [pool.submit(worker) for _ in range(n)]
        return [f.result() for f in as_completed(futures)]


@pytest.mark.postgres
def test_race_approve_assignment_single_ledger(client):
    seed = _seed_family_with_child_and_task(points=30)
    p_headers = {"Authorization": f"Bearer {seed['parent_token']}"}
    c_headers = {"Authorization": f"Bearer {seed['child_token']}"}

    claim = client.post(f"/api/v1/tasks/{seed['task_id']}/claim", headers=c_headers)
    assert claim.status_code == 200
    assignment_id = claim.json()["id"]

    submit = client.post(f"/api/v1/assignments/{assignment_id}/submit", headers=c_headers, json={})
    assert submit.status_code == 200

    results = _concurrent_approve_assignment(seed["parent_token"], assignment_id, n=15)
    assert all(r.status_code == 200 for r in results)

    db = SessionLocal()
    try:
        count = db.scalar(
            select(func.count())
            .select_from(PointsLedger)
            .where(
                PointsLedger.task_assignment_id == UUID(assignment_id),
                PointsLedger.kind == "task_approved",
            )
        )
        assert count == 1
        balance = PointsRepository.get_balance(db, seed["child_id"])
        assert balance == 30
    finally:
        db.close()


@pytest.mark.postgres
def test_race_approve_redemption_single_deduct(client):
    seed = _seed_family_with_child_and_task(points=50)
    p_headers = {"Authorization": f"Bearer {seed['parent_token']}"}
    c_headers = {"Authorization": f"Bearer {seed['child_token']}"}

    # Earn points
    claim = client.post(f"/api/v1/tasks/{seed['task_id']}/claim", headers=c_headers)
    assignment_id = claim.json()["id"]
    client.post(f"/api/v1/assignments/{assignment_id}/submit", headers=c_headers, json={})
    client.post(f"/api/v1/assignments/{assignment_id}/approve", headers=p_headers)

    reward_res = client.post(
        "/api/v1/rewards",
        headers=p_headers,
        json={"title": "Toy", "required_points": 50, "stock": 5},
    )
    reward_id = reward_res.json()["id"]

    redeem = client.post(f"/api/v1/rewards/{reward_id}/redeem", headers=c_headers)
    assert redeem.status_code == 200
    redemption_id = redeem.json()["id"]

    headers = {"Authorization": f"Bearer {seed['parent_token']}"}
    n = 15

    def worker():
        local_client = TestClient(app)

        def override():
            db = SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override
        try:
            return local_client.post(f"/api/v1/redemptions/{redemption_id}/approve", headers=headers)
        finally:
            app.dependency_overrides.clear()

    with ThreadPoolExecutor(max_workers=n) as pool:
        results = [f.result() for f in as_completed([pool.submit(worker) for _ in range(n)])]

    assert all(r.status_code == 200 for r in results)

    db = SessionLocal()
    try:
        count = db.scalar(
            select(func.count())
            .select_from(PointsLedger)
            .where(
                PointsLedger.reward_redemption_id == UUID(redemption_id),
                PointsLedger.kind == "reward_redeemed",
            )
        )
        assert count == 1
        balance = PointsRepository.get_balance(db, seed["child_id"])
        assert balance == 0
        reward = db.get(Reward, UUID(reward_id))
        assert reward.stock == 4
    finally:
        db.close()


@pytest.mark.postgres
def test_race_claim_single_active_assignment(client):
    seed = _seed_family_with_child_and_task()
    c_headers = {"Authorization": f"Bearer {seed['child_token']}"}
    task_id = seed["task_id"]
    n = 15

    def worker():
        local_client = TestClient(app)

        def override():
            db = SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override
        try:
            return local_client.post(f"/api/v1/tasks/{task_id}/claim", headers=c_headers)
        finally:
            app.dependency_overrides.clear()

    with ThreadPoolExecutor(max_workers=n) as pool:
        results = [f.result() for f in as_completed([pool.submit(worker) for _ in range(n)])]

    success = [r for r in results if r.status_code == 200]
    conflict = [r for r in results if r.status_code == 409]
    assert len(success) == 1
    assert len(conflict) + len(success) == n

    db = SessionLocal()
    try:
        count = db.scalar(
            select(func.count())
            .select_from(TaskAssignment)
            .where(
                TaskAssignment.task_id == seed["task_id"],
                TaskAssignment.child_id == seed["child_id"],
                TaskAssignment.status.in_(("in_progress", "submitted")),
            )
        )
        assert count == 1
    finally:
        db.close()


@pytest.mark.postgres
def test_race_redeem_single_requested(client):
    seed = _seed_family_with_child_and_task(points=100)
    p_headers = {"Authorization": f"Bearer {seed['parent_token']}"}
    c_headers = {"Authorization": f"Bearer {seed['child_token']}"}

    claim = client.post(f"/api/v1/tasks/{seed['task_id']}/claim", headers=c_headers)
    assignment_id = claim.json()["id"]
    client.post(f"/api/v1/assignments/{assignment_id}/submit", headers=c_headers, json={})
    client.post(f"/api/v1/assignments/{assignment_id}/approve", headers=p_headers)

    reward_res = client.post(
        "/api/v1/rewards",
        headers=p_headers,
        json={"title": "Sticker", "required_points": 50},
    )
    reward_id = reward_res.json()["id"]
    n = 15

    def worker():
        local_client = TestClient(app)

        def override():
            db = SessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override
        try:
            return local_client.post(f"/api/v1/rewards/{reward_id}/redeem", headers=c_headers)
        finally:
            app.dependency_overrides.clear()

    with ThreadPoolExecutor(max_workers=n) as pool:
        results = [f.result() for f in as_completed([pool.submit(worker) for _ in range(n)])]

    success = [r for r in results if r.status_code == 200]
    assert len(success) == n  # all idempotent 200

    db = SessionLocal()
    try:
        count = db.scalar(
            select(func.count())
            .select_from(RewardRedemption)
            .where(
                RewardRedemption.reward_id == UUID(reward_id),
                RewardRedemption.child_id == seed["child_id"],
                RewardRedemption.status == "requested",
            )
        )
        assert count == 1
    finally:
        db.close()
