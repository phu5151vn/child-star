# Resolve Checklist — Ứng dụng tạo điểm loyalty cho con ("Bé Ngoan")

> **Resolve attempt #3 — HOÀN TẤT & ĐÃ RECHECK.** Chi tiết từng mục xem `06-qa/resolve-plan.md`; kết quả recheck xem `06-qa/re-review-report.md`.
> **Reviewer confirmation (Claude re-check, chốt cuối phase 6):** ✅ **CONFIRMED — recheck-verdict-pass = true (PASS).**
> Bằng chứng empiric do reviewer tự chạy (KHÔNG Docker, KHÔNG env tay): `pytest -v` → **9 passed, 0 skipped** (5 SQLite + 4 race Postgres); `pytest -m postgres` lặp lại → 4 passed ổn định. Gate race tự bootstrap ephemeral Postgres từ Cellar server binaries (tránh shim libpq).
> Nhóm theo priority: **BLOCKER** → **ISSUE** → **Deferred (NOTE)**.
> Ký hiệu: `[x]` = đã đóng & reviewer xác nhận · `[ ]` = còn mở / deferred không chặn.
>
> **Trạng thái tổng:** 3/3 BLOCKER + 10/10 ISSUE đã ĐÓNG & CONFIRMED. R-BLK-3 đóng bằng self-bootstrapping ephemeral Postgres trong `conftest.py` — reviewer đã tái lập empiric.

## 🔴 BLOCKER (P0 — bắt buộc trước merge/production)

### R-BLK-3 — Gate verify race self-bootstrapping (chạy thật, tái lập được) trên PostgreSQL — ✅ **ĐÓNG (attempt #3) · CONFIRMED bởi reviewer**

> Fix: `pytest_configure` tự bootstrap ephemeral Postgres từ binaries local (ưu tiên Cellar server trước libpq client shims). `pytest -v` trần → 9 passed, 0 skipped.
> **Reviewer re-check (empiric, tự chạy):** ✅ tái lập được — `pytest -v` = 9 passed / 0 skipped; `pytest -m postgres` = 4 passed (lặp 2 lần). `docker info` = unavailable ⇒ xác nhận không phụ thuộc Docker. Bẫy libpq shim đã tránh đúng (`_find_bin` ưu tiên Cellar).

- [x] `backend/tests/conftest.py`: thêm `pytest_configure` tự bootstrap ephemeral Postgres (`initdb` + `pg_ctl start` cổng tự do → `CREATE DATABASE` → set `os.environ["TEST_DATABASE_URL"]`) khi env chưa set và có binaries local; teardown ở `pytest_unconfigure`/`atexit`
- [x] `backend/tests/conftest.py`: **xóa dead fixtures** `pg_engine`/`pg_session` + top-level `TEST_DATABASE_URL`/`pytestmark`
- [x] `backend/tests/test_race_postgres.py`: **giữ nguyên thân 4 test**; message skip fallback rõ ràng hơn
- [x] **KHÔNG** đụng `backend/app/**` (service/model/router/schema) — enforcement race-safe đã đúng
- [x] **KHÔNG** dùng testcontainers/Docker; **KHÔNG** thêm dependency runtime (dùng `subprocess` + `psycopg2` sẵn có)
- [x] **AC1 (gate tái lập):** `cd backend && .venv/bin/python -m pytest -v` (KHÔNG Docker, KHÔNG env tay) → **4 test race PASSED, KHÔNG skip**
- [x] **AC2 (không double-count):** `test_race_approve_assignment_single_ledger` → đúng 1 ledger `task_approved`, balance = `task.points` (30)
- [x] **AC3 (không double-deduct / không âm):** `test_race_approve_redemption_single_deduct` → đúng 1 ledger `reward_redeemed`, balance = 0, stock giảm đúng 1
- [x] **AC4 (không nhận trùng):** `test_race_claim_single_active_assignment` → đúng 1×200, còn lại 409, đúng 1 assignment active
- [x] **AC5 (không yêu cầu trùng):** `test_race_redeem_single_requested` → tất cả 200 idempotent, đúng 1 redemption `requested`
- [x] **AC6 (không regression):** `pytest -v` tổng → 5 passed SQLite + 4 passed Postgres race, 0 failed
- [x] **AC7 (đúng phạm vi):** `git diff` chỉ chạm `backend/tests/**` + docs; không đổi `backend/app/**`

## 🟢 BLOCKER đã đóng ở code (xác nhận lại attempt #3 — empiric verify đi kèm R-BLK-3)

### R-BLK-1 — Idempotency + atomic khi approve assignment (chống double-count) — ✅ ĐÓNG
- [x] Partial unique index Postgres-only `uq_ledger_task_approved` (`backend/app/models/ddl.py:9-10`)
- [x] `advisory_lock_child` trước mọi check/insert (`task_service.py:280`) + re-check trong vùng khóa (`:282`)
- [x] `IntegrityError` + `is_unique_violation("uq_ledger_task_approved")` → rollback + 200 idempotent (`task_service.py:321-326`)
- [x] Giữ `require_role("parent")` — child approve → 403
- [x] **AC:** đúng 1 ledger `task_approved`, cộng đúng 1 lần *(empiric ⇒ R-BLK-3 AC2)*

### R-BLK-2 — Idempotency + atomic khi approve redemption (chống double-deduct) — ✅ ĐÓNG
- [x] Partial unique index Postgres-only `uq_ledger_reward_redeemed` (`ddl.py:12-13`)
- [x] `advisory_lock_child` trước mọi check idempotency (`reward_service.py:222`) + re-check (`:224`)
- [x] Balance check sau lock (không âm); stock+ledger+audit **cùng transaction** (`:241-273`)
- [x] `IntegrityError` + `is_unique_violation("uq_ledger_reward_redeemed")` → rollback (stock rollback theo) + 200 (`:274-279`)
- [x] Giữ `require_role("parent")` — child approve → 403
- [x] **AC:** đúng 1 ledger `-required_points`, trừ 1 lần, stock giảm 1, không âm *(empiric ⇒ R-BLK-3 AC3)*

## 🟡 ISSUE (đóng toàn bộ — xác nhận lại attempt #3, không regression)

### R-ISS-1 — Partial unique index chống nhận/gửi trùng + unique tên con (P1) — ✅ ĐÓNG
- [x] `uq_assignment_active`, `uq_redemption_requested`, `uq_child_display_name` (`ddl.py:15-23`)
- [x] `claim`/`redeem`/`create_child`+`update_child` bắt `IntegrityError` → lỗi thân thiện (không 500)
- [x] **AC:** không trùng active-assignment/requested-redemption/tên con *(empiric ⇒ R-BLK-3 AC4/AC5)*

### R-ISS-2 — Kiểm ownership `proof` media của con (P1, security) — ✅ ĐÓNG
- [x] `media_service.get_media_path`: `kind=='proof'` chỉ parent cùng family hoặc con chủ sở hữu (`media_service.py:67-69`)
- [x] **AC:** con A không xem proof con B; parent xem được; cross-family 404

### R-ISS-3 — Validate `proof_media_id` khi submit (P1) — ✅ ĐÓNG
- [x] `submit` kiểm tồn tại + `family_id` + `kind=='proof'` + `uploaded_by==ctx.user_id` (`task_service.py:259-267`)
- [x] **AC:** submit media giả/khác family/không thuộc con → lỗi; `require_proof` vẫn enforce

### R-ISS-4 — Sửa validate `delta` của manual_adjust (P1) — ✅ ĐÓNG
- [x] `field_validator("delta")` chặn `delta==0` → 422 (`schemas/__init__.py`)
- [x] **AC:** `delta=0` → 422 (test PASS SQLite); balance không âm vẫn enforce; chỉ parent gọi

### R-ISS-5 — Append-only DB cho points_ledger (P1, audit trail hardening) — ✅ ĐÓNG
- [x] Trigger `prevent_ledger_mutation` `BEFORE UPDATE OR DELETE` (Postgres-only) (`ddl.py:25-34`)
- [x] **AC:** UPDATE/DELETE bị chặn; INSERT bình thường *(hiệu lực/verify Postgres ⇒ chung gate R-BLK-3)*

### R-ISS-6 — Audit log tập trung cho reject/approve/cancel (P1, audit trail) — ✅ ĐÓNG
- [x] `AuditRepository.log` cho assignment approve/reject (`task_service.py:311-319,342-350`)
- [x] `AuditRepository.log` cho redemption approve/reject/cancel (`reward_service.py:264-322`)
- [x] Cùng transaction; nhánh idempotent KHÔNG double-log
- [x] **AC:** mọi quyết định duyệt/từ chối/hủy truy vết được (G5)

### R-ISS-7 — ChildHomePage loading/empty/error (P1, FE states) — ✅ ĐÓNG
- [x] `PageState` loading/error/retry + empty khích lệ (`ChildPages.tsx:27-52`)
- [x] **AC:** đủ 3 state, đồng bộ pattern; FE build pass

### R-ISS-8 — UI upload ảnh task/reward/proof (P2, illustration defer D-1) — ✅ ĐÓNG
- [x] `MediaUpload.tsx`; wired task_icon (`TaskFormPage.tsx`), reward_image (`RewardFormPage.tsx`), proof (`ChildPages.tsx`, submit truyền `proof_media_id`)
- [x] **AC:** upload + submit proof hoạt động; kết hợp validate R-ISS-3

### R-ISS-9 — Dọn dead code ASSIGNMENT_TRANSITIONS (P2, cleanup) — ✅ ĐÓNG
- [x] `ASSIGNMENT_TRANSITIONS` + `assert_transition()` wired submit/approve/reject (`task_service.py:26-36`)
- [x] **AC:** không còn dead code; no-skip transition giữ nguyên (D1/D2)

### R-ISS-10 — JWT secret prod guard + rate-limit login (P1, bảo mật vận hành) — ✅ ĐÓNG
- [x] `validate_production_settings()` (`config.py`) gọi ở `main.py`
- [x] Rate-limit login parent/child (`rate_limit.py` + `api.py:62,80`) → 429
- [x] **AC:** prod + secret mặc định → không khởi động; login quá ngưỡng → 429; login hợp lệ không ảnh hưởng

## ⚪ Deferred (NOTE — không implement, ngoài phạm vi PASS; an toàn để hoãn)

- [x] ~~D-1 — Illustration Stitch cho empty-state~~ (thuần thẩm mỹ; empty-state chức năng đã có)
- [x] ~~D-2 — E2E Playwright~~ (optional; đã có integration test backend + race test Postgres chạy thật)
- [x] ~~D-3 — RLS PostgreSQL layer-2~~ (family isolation enforce server-side B1–B4)
- [x] ~~D-4 — Alembic migrations đầy đủ~~ (DDL qua `create_all`+event; khuyến nghị phase hạ tầng)
- [ ] *(khuyến nghị, không chặn)* CI: đưa `pytest -m postgres` thành job cố định — chống regression race về sau

> Không mục deferred nào là BLOCKER hoặc chạm role enforcement / point integrity / unlock logic / audit trail.

---

## ✅ Điều kiện thoát vòng resolve (khớp Exit criteria — resolve-plan §7)

Recheck trả **PASS** khi và chỉ khi TẤT CẢ đúng:
1. [x] `pytest -v` trần (không Docker/không env tay) → **4 test race PASSED, không skip** (gate tái lập).
2. [x] 4 bất biến toàn vẹn điểm dưới concurrency giữ vững (AC2–AC5 R-BLK-3).
3. [x] `pytest -v` tổng xanh: 5 passed SQLite + 4 passed Postgres race, 0 failed.
4. [x] 5 index `uq_*` + trigger `trg_points_ledger_append_only` tạo thật trên cluster test (gián tiếp qua 4 test xanh).
5. [x] `git diff` chỉ chạm `backend/tests/**` + docs; không đổi `backend/app/**`.
6. [x] Không mở scope ngoài bố mẹ/con · nhiệm vụ · phần thưởng · điểm · unlock/redemption.
