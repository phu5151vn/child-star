"""PostgreSQL-only DDL: partial unique indexes and append-only trigger."""

from sqlalchemy import DDL, event

from app.core.db import Base

POSTGRES_DDL = DDL(
    """
CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_task_approved
    ON points_ledger (task_assignment_id) WHERE kind = 'task_approved';

CREATE UNIQUE INDEX IF NOT EXISTS uq_ledger_reward_redeemed
    ON points_ledger (reward_redemption_id) WHERE kind = 'reward_redeemed';

CREATE UNIQUE INDEX IF NOT EXISTS uq_assignment_active
    ON task_assignments (task_id, child_id)
    WHERE status IN ('in_progress', 'submitted');

CREATE UNIQUE INDEX IF NOT EXISTS uq_redemption_requested
    ON reward_redemptions (reward_id, child_id) WHERE status = 'requested';

CREATE UNIQUE INDEX IF NOT EXISTS uq_child_display_name
    ON users (family_id, lower(display_name)) WHERE role = 'child';

CREATE OR REPLACE FUNCTION prevent_ledger_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'points_ledger is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_points_ledger_append_only ON points_ledger;
CREATE TRIGGER trg_points_ledger_append_only
    BEFORE UPDATE OR DELETE ON points_ledger
    FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
"""
)

event.listen(Base.metadata, "after_create", POSTGRES_DDL.execute_if(dialect="postgresql"))
