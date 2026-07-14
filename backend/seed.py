"""Seed demo data for development."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.db import Base, SessionLocal, engine
import app.models  # noqa: F401 — register PostgreSQL DDL
from app.core.security import hash_password, hash_pin
from app.models import Family, Reward, Task, User


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(Family).first()
        if existing:
            print("Seed already exists, skipping.")
            return

        family = Family(name="Gia đình Demo", family_code="DEMO01")
        db.add(family)
        db.flush()

        parent = User(
            family_id=family.id,
            role="parent",
            display_name="Bố Mẹ Demo",
            email="parent@demo.com",
            password_hash=hash_password("demo1234"),
        )
        db.add(parent)
        db.flush()

        child1 = User(
            family_id=family.id,
            role="child",
            display_name="Bé An",
            pin_hash=hash_pin("1234"),
        )
        child2 = User(
            family_id=family.id,
            role="child",
            display_name="Bé Bình",
            pin_hash=hash_pin("5678"),
        )
        db.add_all([child1, child2])
        db.flush()

        tasks = [
            Task(family_id=family.id, title="Dọn phòng", points=10, created_by=parent.id),
            Task(family_id=family.id, title="Làm bài tập", points=20, created_by=parent.id),
            Task(family_id=family.id, title="Giúp rửa bát", points=15, created_by=parent.id),
        ]
        db.add_all(tasks)

        rewards = [
            Reward(
                family_id=family.id,
                title="Kem que",
                required_points=50,
                stock=5,
                created_by=parent.id,
            ),
            Reward(
                family_id=family.id,
                title="Xem phim cuối tuần",
                required_points=150,
                stock=None,
                created_by=parent.id,
            ),
            Reward(
                family_id=family.id,
                title="Đồ chơi mới",
                required_points=350,
                stock=1,
                created_by=parent.id,
            ),
        ]
        db.add_all(rewards)
        db.commit()
        print("Seed complete!")
        print(f"  Family code: {family.family_code}")
        print("  Parent: parent@demo.com / demo1234")
        print("  Child Bé An PIN: 1234")
        print("  Child Bé Bình PIN: 5678")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
