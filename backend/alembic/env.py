"""Alembic environment — dùng Base.metadata của app + DATABASE_URL từ settings.

URL lấy từ app.core.config.settings (đã ưu tiên biến môi trường DATABASE_URL rồi .env),
nên có thể trỏ local/Supabase/tạm bằng cách set env DATABASE_URL khi chạy alembic.
"""
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from alembic.script import ScriptDirectory

from app.core.config import settings
from app.core.db import Base
import app.models  # noqa: F401 — nạp toàn bộ model + đăng ký event DDL vào metadata

# Alembic Config object (đọc alembic.ini).
config = context.config
# Đưa URL từ settings vào config để engine_from_config đọc được (thay cho hardcode trong .ini).
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Partial unique index được quản lý bằng raw DDL (app/models/ddl.py), KHÔNG có trong metadata.
# Bỏ qua khi autogenerate để không sinh lệnh drop nhầm.
RAW_DDL_INDEXES = {
    "uq_ledger_task_approved",
    "uq_ledger_reward_redeemed",
    "uq_assignment_active",
    "uq_redemption_requested",
    "uq_child_display_name",
}


def include_object(obj, name, type_, reflected, compare_to):
    if type_ == "index" and name in RAW_DDL_INDEXES:
        return False
    return True


def process_revision_directives(context_, revision, directives):
    """Đánh số revision tuần tự 0001, 0002, … thay cho hash ngẫu nhiên."""
    if not directives:
        return
    script = ScriptDirectory.from_config(config)
    nums = [int(s.revision) for s in script.walk_revisions() if s.revision.isdigit()]
    next_id = (max(nums) + 1) if nums else 1
    directives[0].rev_id = f"{next_id:04d}"


def run_migrations_offline() -> None:
    context.configure(
        url=settings.DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        include_object=include_object,
        process_revision_directives=process_revision_directives,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            include_object=include_object,
            process_revision_directives=process_revision_directives,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
