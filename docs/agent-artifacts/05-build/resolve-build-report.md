# Resolve Build Report — Ứng dụng tạo điểm loyalty cho con ("Bé Ngoan")

> Resolve attempt **#3**. Nguồn: `06-qa/resolve-plan.md`, `06-qa/re-review-report.md`. Cursor đóng **R-BLK-3** — gate verify race self-bootstrapping trên PostgreSQL.

## 1. Tóm tắt

Attempt #1 đóng toàn bộ finding code-level (R-BLK-1, R-BLK-2, R-ISS-1..R-ISS-10). Attempt #2 chạy race test trên Postgres thủ công (port 5432) nhưng không tái lập được trong recheck tự động. Attempt #3 đóng **R-BLK-3** bằng cách thêm hook `pytest_configure` tự bootstrap ephemeral PostgreSQL từ binaries local (`initdb` + `pg_ctl` + `psql`) — **không cần Docker, không cần export `TEST_DATABASE_URL` bằng tay**.

**Verdict sau attempt #3:** toàn bộ BLOCKER + ISSUE in-scope đã đóng và verify runtime tái lập được.

## 2. Items fixed (map review → resolve id)

| Resolve id | Review id | Mô tả | Trạng thái |
|---|---|---|---|
| R-BLK-1 | BLK-1 | Idempotency + advisory lock khi approve assignment | ✅ Fixed (attempt #1) — empiric verified R-BLK-3 |
| R-BLK-2 | BLK-2 | Idempotency + advisory lock khi approve redemption | ✅ Fixed (attempt #1) — empiric verified R-BLK-3 |
| **R-BLK-3** | §2/H6 | Gate verify race self-bootstrapping PostgreSQL | ✅ **PASS** (attempt #3) — 4 passed, 0 skipped |
| R-ISS-1 | ISS-1 | Partial unique index + IntegrityError handling | ✅ Fixed — empiric verified R-BLK-3 |
| R-ISS-2 | ISS-2 | Proof media ownership check | ✅ Fixed |
| R-ISS-3 | ISS-3 | Validate `proof_media_id` khi submit | ✅ Fixed |
| R-ISS-4 | ISS-4 | `ManualAdjustRequest.delta` validator | ✅ Fixed |
| R-ISS-5 | ISS-5 | Append-only trigger `points_ledger` | ✅ Fixed — DDL apply trên Postgres (R-BLK-3) |
| R-ISS-6 | ISS-6 | `audit_log` approve/reject/cancel | ✅ Fixed |
| R-ISS-7 | ISS-7 | `ChildHomePage` loading/empty/error | ✅ Fixed |
| R-ISS-8 | ISS-8 | UI upload ảnh task/reward/proof | ✅ Fixed |
| R-ISS-9 | ISS-9 | `ASSIGNMENT_TRANSITIONS` wired | ✅ Fixed |
| R-ISS-10 | ISS-10 | JWT prod guard + rate-limit login | ✅ Fixed |

### Attempt #3 code fix (test harness only — không đổi business logic)

| File | Thay đổi |
|---|---|
| `backend/tests/conftest.py` | Thay dead fixtures bằng `pytest_configure`/`pytest_unconfigure` bootstrap ephemeral Postgres; ưu tiên Cellar server binaries trước libpq client shims |
| `backend/tests/test_race_postgres.py` | Làm rõ message skip fallback khi không có binaries |

## 3. Files changed (attempt #3)

- `backend/tests/conftest.py` — self-bootstrapping ephemeral Postgres + teardown
- `backend/tests/test_race_postgres.py` — skip message rõ ràng hơn
- `docs/agent-artifacts/05-build/resolve-build-report.md` — báo cáo attempt #3
- `docs/agent-artifacts/06-qa/resolve-checklist.md` — tick R-BLK-3 AC

## 4. Remaining blockers / risks

| Risk | Mức | Ghi chú |
|---|---|---|
| *(không còn blocker mở)* | — | Toàn bộ R-BLK-1..3 và R-ISS-1..10 đã đóng |
| Rate-limit in-memory | Low | Reset khi restart; prod multi-instance nên Redis |
| Partial unique index / trigger chỉ Postgres | Low | SQLite tests bỏ qua DDL (đúng thiết kế) |
| D-4 Alembic migrations | Low | Khuyến nghị phase hạ tầng; hiện `create_all` + DDL event |
| Máy không có Postgres server binaries | Low | 4 test race skip có thông báo rõ; CI nên có binaries hoặc service Postgres |

## 5. Verification commands & results

| Command | Kết quả |
|---|---|
| `backend/.venv/bin/python -m pytest -v` (KHÔNG set `TEST_DATABASE_URL`, KHÔNG Docker) | **PASS** — **9 passed**, 0 skipped, 0 failed |
| `backend/.venv/bin/python -m pytest -m postgres -v` | **PASS** — **4 passed** |
| `frontend/npm run build` | *(không chạy lại — không đổi frontend ở attempt #3)* |

### Chi tiết R-BLK-3 (4 test race — tất cả PASS, không skip)

- `test_race_approve_assignment_single_ledger` — 1 ledger `task_approved`, balance = 30 (task.points)
- `test_race_approve_redemption_single_deduct` — 1 ledger `reward_redeemed`, balance = 0, stock −1
- `test_race_claim_single_active_assignment` — 1×200, còn lại 409, 1 active assignment
- `test_race_redeem_single_requested` — tất cả 200 idempotent, 1 redemption `requested`

**Môi trường verify:** Ephemeral Postgres 15.18 bootstrap tự động từ `/opt/homebrew/Cellar/postgresql@15/15.18/bin/` (không Docker, không env tay).

### Lệnh tái lập (recheck / CI)

```bash
cd backend
# Gate tự bootstrap — không cần Docker hay export env
.venv/bin/python -m pytest -v
# Kỳ vọng: 5 passed SQLite + 4 passed Postgres race, 0 skipped

# Hoặc chỉ nhóm race:
.venv/bin/python -m pytest -m postgres -v
# Kỳ vọng: 4 passed

# CI với Postgres service (hook tôn trọng env ngoài):
TEST_DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/db \
  .venv/bin/python -m pytest -m postgres -v
```
