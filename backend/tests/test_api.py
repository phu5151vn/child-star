import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.db import Base, get_db
from app.main import app

SQLALCHEMY_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
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


def _register_parent(client):
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            "password": "secret12",
            "family_name": "Test Family",
            "display_name": "Parent",
        },
    )
    assert res.status_code == 200
    data = res.json()
    return data["access_token"], data["family_code"]


def test_parent_register_and_login(client):
    token, code = _register_parent(client)
    assert token
    assert len(code) == 6

    res = client.post(
        "/api/v1/auth/parent/login",
        json={"email": "test@example.com", "password": "secret12"},
    )
    assert res.status_code == 200


def test_child_forbidden_parent_endpoint(client):
    token, _ = _register_parent(client)
    headers = {"Authorization": f"Bearer {token}"}

    child_res = client.post(
        "/api/v1/children",
        headers=headers,
        json={"display_name": "Kid", "pin": "1234"},
    )
    assert child_res.status_code == 200
    child_id = child_res.json()["id"]

    # Parent can create task
    task_res = client.post(
        "/api/v1/tasks",
        headers=headers,
        json={"title": "Clean room", "points": 10},
    )
    assert task_res.status_code == 200

    # Child login
    family = client.get("/api/v1/family", headers=headers).json()
    profiles = client.get(f"/api/v1/auth/child/profiles?family_code={family['family_code']}").json()
    child_login = client.post(
        "/api/v1/auth/child/login",
        json={"family_code": family["family_code"], "child_id": child_id, "pin": "1234"},
    )
    child_token = child_login.json()["access_token"]
    child_headers = {"Authorization": f"Bearer {child_token}"}

    # Child cannot create task
    forbidden = client.post(
        "/api/v1/tasks",
        headers=child_headers,
        json={"title": "Hack", "points": 5},
    )
    assert forbidden.status_code == 403


def test_task_flow_earn_points(client):
    parent_token, _ = _register_parent(client)
    p_headers = {"Authorization": f"Bearer {parent_token}"}

    child_res = client.post(
        "/api/v1/children", headers=p_headers, json={"display_name": "Kid", "pin": "1234"}
    )
    child_id = child_res.json()["id"]

    task_res = client.post(
        "/api/v1/tasks", headers=p_headers, json={"title": "Homework", "points": 25}
    )
    task_id = task_res.json()["id"]

    family = client.get("/api/v1/family", headers=p_headers).json()
    child_login = client.post(
        "/api/v1/auth/child/login",
        json={"family_code": family["family_code"], "child_id": child_id, "pin": "1234"},
    )
    c_headers = {"Authorization": f"Bearer {child_login.json()['access_token']}"}

    claim = client.post(f"/api/v1/tasks/{task_id}/claim", headers=c_headers)
    assert claim.status_code == 200
    assignment_id = claim.json()["id"]

    submit = client.post(
        f"/api/v1/assignments/{assignment_id}/submit",
        headers=c_headers,
        json={},
    )
    assert submit.status_code == 200

    approve = client.post(f"/api/v1/assignments/{assignment_id}/approve", headers=p_headers)
    assert approve.status_code == 200

    balance = client.get(f"/api/v1/children/{child_id}/balance", headers=c_headers)
    assert balance.json()["balance"] == 25

    # Idempotent approve
    approve2 = client.post(f"/api/v1/assignments/{assignment_id}/approve", headers=p_headers)
    assert approve2.status_code == 200
    balance2 = client.get(f"/api/v1/children/{child_id}/balance", headers=c_headers)
    assert balance2.json()["balance"] == 25


def test_reward_locked_teaser(client):
    parent_token, _ = _register_parent(client)
    p_headers = {"Authorization": f"Bearer {parent_token}"}

    child_res = client.post(
        "/api/v1/children", headers=p_headers, json={"display_name": "Kid", "pin": "1234"}
    )
    child_id = child_res.json()["id"]

    client.post(
        "/api/v1/rewards",
        headers=p_headers,
        json={"title": "Ice cream", "required_points": 100},
    )

    family = client.get("/api/v1/family", headers=p_headers).json()
    child_login = client.post(
        "/api/v1/auth/child/login",
        json={"family_code": family["family_code"], "child_id": child_id, "pin": "1234"},
    )
    c_headers = {"Authorization": f"Bearer {child_login.json()['access_token']}"}

    rewards = client.get("/api/v1/rewards", headers=c_headers).json()
    assert len(rewards) == 1
    assert rewards[0]["is_unlocked"] is False
    assert rewards[0]["missing_points"] == 100


def test_manual_adjust_delta_zero_rejected(client):
    parent_token, _ = _register_parent(client)
    p_headers = {"Authorization": f"Bearer {parent_token}"}

    child_res = client.post(
        "/api/v1/children", headers=p_headers, json={"display_name": "Kid", "pin": "1234"}
    )
    child_id = child_res.json()["id"]

    res = client.post(
        f"/api/v1/children/{child_id}/adjust",
        headers=p_headers,
        json={"delta": 0, "reason": "test"},
    )
    assert res.status_code == 422
