"""Seed demo data for development."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.core.db import SessionLocal
import app.models  # noqa: F401 — register models
from app.core.security import hash_password, hash_pin
from app.models import Family, Reward, Task, User, WeeklyGoal


def seed():
    # Schema do Alembic quản lý — chạy `alembic upgrade head` TRƯỚC khi seed.
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
            gender="female",
        )
        child2 = User(
            family_id=family.id,
            role="child",
            display_name="Bé Bình",
            pin_hash=hash_pin("5678"),
            gender="male",
        )
        db.add_all([child1, child2])
        db.flush()

        tasks = [
            Task(family_id=family.id, title="Dọn phòng", points=10, icon_emoji="🧹",
                 recurrence="daily", created_by=parent.id),
            Task(family_id=family.id, title="Làm bài tập", points=20, icon_emoji="📚",
                 recurrence="daily", created_by=parent.id),
            Task(family_id=family.id, title="Giúp rửa bát", points=15, icon_emoji="🍽️",
                 recurrence="daily", created_by=parent.id),
            Task(family_id=family.id, title="Đánh răng buổi tối", points=5, icon_emoji="🦷",
                 recurrence="daily", created_by=parent.id),
            Task(family_id=family.id, title="Tưới cây", points=10, icon_emoji="🌱",
                 recurrence="daily", created_by=parent.id),
            Task(family_id=family.id, title="Gấp quần áo", points=15, icon_emoji="👕",
                 recurrence="weekly", created_by=parent.id),
        ]
        db.add_all(tasks)

        rewards = [
            Reward(
                family_id=family.id,
                title="Kem que",
                required_points=50,
                icon_emoji="🍦",
                stock=5,
                created_by=parent.id,
            ),
            Reward(
                family_id=family.id,
                title="Xem phim cuối tuần",
                required_points=150,
                icon_emoji="🎬",
                stock=None,
                created_by=parent.id,
            ),
            Reward(
                family_id=family.id,
                title="Đồ chơi mới",
                required_points=350,
                icon_emoji="🧸",
                stock=1,
                created_by=parent.id,
            ),
        ]
        db.add_all(rewards)

        db.add(
            WeeklyGoal(
                family_id=family.id,
                target_count=5,
                bonus_points=30,
                is_active=True,
                created_by=parent.id,
            )
        )
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
