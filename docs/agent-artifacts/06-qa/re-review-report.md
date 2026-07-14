# Re-Review Report — Ứng dụng tạo điểm loyalty cho con ("Bé Ngoan")

> Stage 6 (Resolve loop) — **re-review sau resolve attempt #3 (ĐÃ CHẠM resolve-loop-limit — đây là chốt cuối, không kỳ vọng thêm vòng resolve).** Nguồn đối chiếu: `06-qa/review-report.md`, `06-qa/resolve-plan.md`, `06-qa/resolve-checklist.md`, `05-build/resolve-build-report.md`, và code thực tế trong `backend/` + `frontend/`.
> Phạm vi: **CHỈ** re-review các mục trong `resolve-plan.md` / `resolve-checklist.md`. Không mở rộng scope, không rerun full pipeline.
> Nguyên tắc: verify trực tiếp trên code + **chạy lại test empiric bởi reviewer** (không tin claim của build-report). Không nới lỏng bất kỳ yêu cầu an toàn / permission / verify nào để đạt PASS.

---

## 1. Verdict cuối cùng

**PASS.**

Blocker duy nhất còn mở ở attempt #3 — **R-BLK-3 (gate verify race self-bootstrapping, tái lập được trên PostgreSQL)** — nay **đã đóng empiric**. Root cause của lần tái diễn ở attempt #1/#2 **không phải code defect** (enforcement race-safe đã đúng từ attempt #1) mà là **gate verify không tự cung cấp Postgres**: attempt #1 skip vì thiếu server; attempt #2 "PASS" nhờ server launch thủ công (port 5432 + DB provision tay) mà recheck tự động không tái lập được. Attempt #3 sửa đúng tầng: `backend/tests/conftest.py` tự bootstrap ephemeral PostgreSQL từ **binaries local** khi `TEST_DATABASE_URL` chưa set — không Docker, không env tay.

**Reviewer tự chạy `pytest` TRẦN** (KHÔNG set `TEST_DATABASE_URL`, KHÔNG Docker) trong `backend/`:

```
tests/test_api.py ..... (5 passed — SQLite suite)
tests/test_race_postgres.py::test_race_approve_assignment_single_ledger  PASSED
tests/test_race_postgres.py::test_race_approve_redemption_single_deduct  PASSED
tests/test_race_postgres.py::test_race_claim_single_active_assignment    PASSED
tests/test_race_postgres.py::test_race_redeem_single_requested           PASSED
================= 9 passed, 97 warnings in 5.16s =================   (0 skipped)
```

4 test race **thực sự CHẠY, KHÔNG skip** — khác hẳn attempt #1 (silent skip). Chạy lại nhóm race riêng (`pytest -m postgres`) cho kết quả xác định: **4 passed, 5 deselected** (lặp lại 2 lần, ổn định). Toàn bộ 2 BLOCKER toàn vẹn điểm (R-BLK-1, R-BLK-2) và 10 ISSUE (R-ISS-1..R-ISS-10) đã đóng ở code từ attempt #1, nay được **chứng minh empiric dưới concurrency thực trên Postgres**.

→ **Không còn điều kiện chặn nào cho phase QA.** Sản phẩm đủ điều kiện chuyển sang runtime verification / demo / merge. Chỉ còn khuyến nghị hạ tầng không chặn (D-4 Alembic; đưa gate race vào CI).

---

## 2. Blocker — kết quả verify (đã đóng toàn bộ)

### R-BLK-3 — Gate verify race self-bootstrapping, tái lập được trên PostgreSQL → ✅ RESOLVED (empiric verified bởi reviewer)

**Bằng chứng fix tại code:** `backend/tests/conftest.py`
- `pytest_configure` (`conftest.py:105-113`) — nếu `TEST_DATABASE_URL` chưa set thì gọi `_bootstrap_ephemeral_postgres()`, set `os.environ["TEST_DATABASE_URL"]` **trước khi** module race được collect/import, đăng ký teardown qua `atexit`. Tôn trọng env ngoài nếu CI đã cấp (bỏ qua bootstrap).
- `_bootstrap_ephemeral_postgres` (`conftest.py:42-91`) — `initdb --auth=trust` → `pg_ctl start` trên **cổng tự do** (`_free_port`) + unix socket trong datadir tạm → `CREATE DATABASE benngoan` → trả URL `postgresql+psycopg2://...`.
- **Sửa đúng bẫy "libpq client-only" của lần trước:** `_find_bin` (`conftest.py:23-39`) **ưu tiên Cellar server binaries** (`/opt/homebrew/Cellar/postgresql@*/*/bin/`, ...) **TRƯỚC** `shutil.which`, và loại trừ tường minh shim `"/opt/libpq/"` trên PATH. Xác nhận môi trường máy này: `which initdb` = `/opt/homebrew/opt/libpq/bin/initdb` (chỉ client — bẫy cũ), nhưng full server có tại `/opt/homebrew/Cellar/postgresql@15/15.18/bin/` (chứa `initdb`, `pg_ctl`, `postgres`, `psql`) — hook chọn đúng server binaries ⇒ cluster khởi động thật.
- `pytest_unconfigure` + `atexit` (`conftest.py:94-117`) — `pg_ctl stop -m immediate` + `rmtree` datadir ⇒ dọn sạch, không rò cluster.
- **Dead fixtures `pg_engine`/`pg_session` + top-level `pytestmark` đã bị xoá** khỏi `conftest.py` (đúng resolve-plan §2 step 2) — không còn `Base.metadata.drop_all` vướng circular FK users↔media.
- Thân 4 test trong `test_race_postgres.py` **không đổi**; chỉ làm rõ message skip fallback (`:24-28`) khi máy hoàn toàn không có Postgres binaries.

**Xác minh empiric (reviewer tự chạy, KHÔNG Docker, KHÔNG env tay):** 4 test kiểm đúng các bất biến nghiệp vụ nhạy cảm dưới `ThreadPoolExecutor` n=15 (mỗi thread `Session`/`TestClient` riêng):

- `test_race_approve_assignment_single_ledger` — đúng **1** ledger `task_approved`, balance con = `task.points` (30) ⇒ **không double-count** khi bố mẹ duyệt hoàn thành nhiệm vụ đồng thời.
- `test_race_approve_redemption_single_deduct` — đúng **1** ledger `reward_redeemed`, balance = **0 (không âm)**, `stock` giảm **đúng 1** ⇒ **không chi vượt điểm / không double-deduct** khi duyệt đổi thưởng đồng thời.
- `test_race_claim_single_active_assignment` — đúng **1×200**, còn lại **409**, đúng 1 assignment active ⇒ con không nhận trùng 1 nhiệm vụ (chứng minh `uq_assignment_active` được tạo & hiệu lực trên Postgres).
- `test_race_redeem_single_requested` — tất cả **200 idempotent**, đúng **1** redemption `requested` ⇒ không tạo trùng yêu cầu đổi thưởng.

**Cơ chế chống race (đối chiếu code, khớp với kết quả empiric):**
- Advisory lock tuần tự-hoá theo con: `advisory_lock_child` gọi **ngay sau load, trước mọi check/insert** ở approve assignment (`task_service.py:280`) và approve redemption (`reward_service.py:222`); re-check idempotency **trong** vùng khóa (`task_service.py:282`, `reward_service.py:224`).
- Chốt ở DB bằng partial unique index (`ddl.py:9-23`) + `IntegrityError → is_unique_violation(...) → rollback + idempotent 200` (`task_service.py:321-326`, `reward_service.py:274-279`, `claim` `:234-238`, `redeem` `:201-213`).
- Balance check **sau lock** ở approve redemption (`reward_service.py:241-243`) ⇒ số dư không âm; `stock`+ledger+audit **cùng transaction** (`:245-273`, không commit sớm) ⇒ rollback đồng bộ.

### R-BLK-1 / R-BLK-2 → ✅ RESOLVED (giữ nguyên từ attempt #1, nay có bằng chứng empiric tái lập)

Không regression. Đã xác nhận lại tại code (`task_service.py:274-328`; `reward_service.py:216-281`) và **chứng minh empiric** qua 2 test race approve tương ứng (§2 trên). Enforcement `require_role("parent")` cho approve còn nguyên (`api.py:254,:355`).

---

## 3. Issue — kết quả verify (đều đã đóng, không regression)

| Id | Trạng thái | Vị trí verify | Ghi chú |
|---|---|---|---|
| **R-ISS-1** — partial unique index chống trùng + unique tên con | ✅ RESOLVED | `ddl.py:15-23` (3 index); handling `IntegrityError` ở claim (`task_service.py:234-238`) / redeem (`reward_service.py:201-213`) / child | Empiric: test claim (409) + redeem (idempotent) PASS trên Postgres ⇒ index tạo thật & hiệu lực |
| **R-ISS-2** — ownership `proof` media | ✅ RESOLVED | `media_service.py:64-69` (family + `kind=='proof'` → con chỉ xem của mình) | Con A không xem proof con B; cross-family 404 |
| **R-ISS-3** — validate `proof_media_id` khi submit | ✅ RESOLVED | `task_service.py:259-267` (tồn tại + family + `kind=='proof'` + `uploaded_by==ctx.user_id`) | `require_proof` vẫn enforce |
| **R-ISS-4** — validate `delta` manual_adjust | ✅ RESOLVED | `schemas/__init__.py:90-94` `field_validator("delta")` chặn `delta==0` → 422 | Test `test_manual_adjust_delta_zero_rejected` PASS (SQLite suite) |
| **R-ISS-5** — append-only `points_ledger` | ✅ RESOLVED | `ddl.py:25-34` trigger `trg_points_ledger_append_only` (BEFORE UPDATE OR DELETE) | DDL Postgres-only được `create_all` apply (gián tiếp xác nhận qua race suite xanh) |
| **R-ISS-6** — audit log tập trung | ✅ RESOLVED | approve/reject assignment (`task_service.py:311-319,342-350`), approve/reject/cancel redemption (`reward_service.py:264-322`); cùng transaction; nhánh idempotent **không double-log** | Audit trail không bị nới lỏng |
| **R-ISS-7** — ChildHomePage 3 state | ✅ RESOLVED | `ChildPages.tsx:27-52` (`PageState` loading/error/retry + empty khích lệ); teaser mốc thưởng gần nhất + "Còn thiếu N sao" (`:44-50`) | Locked-reward motivational state cho con có mặt |
| **R-ISS-8** — UI upload ảnh | ✅ RESOLVED (phần upload) | `MediaUpload.tsx`; wired `reward_image` (`RewardFormPage.tsx:58`), `task_icon` (`TaskFormPage.tsx:58`), `proof` (`ChildPages.tsx`) | Illustration empty-state = D-1 defer |
| **R-ISS-9** — dọn dead code | ✅ RESOLVED | `task_service.py:26-36` `ASSIGNMENT_TRANSITIONS` + `assert_transition()` wired submit/approve/reject | No-skip transition giữ nguyên |
| **R-ISS-10** — JWT prod guard + rate-limit login | ✅ RESOLVED | `config.py:23-26` `validate_production_settings()` gọi ở `main.py:9`; `rate_limit.py` + `check_login_rate_limit` tại `api.py:62,80` | Rate-limit in-memory (risk multi-instance đã ghi, không chặn) |

**Ràng buộc permission/transition không bị nới lỏng** (kiểm `routers/api.py`): create/update/delete task & reward, approve/reject assignment & redemption, manual_adjust vẫn `require_role("parent")`; claim/submit/redeem/cancel vẫn `require_role("child")`; rate-limit login còn nguyên. **Attempt #3 chỉ chạm `backend/tests/**` + docs — không file nào dưới `backend/app/**` bị đổi**, nên không thể có suy giảm permission/business rule ở lần này.

---

## 4. Deferred — chấp nhận cho phase này (có lý do, đã chạm resolve-loop-limit)

| Id | Lý do chấp nhận |
|---|---|
| **D-1** Illustration Stitch empty-state | Thuần thẩm mỹ; empty-state chức năng đã có (`PageState`/AntD `Empty`). Không chạm point integrity/permission/audit. |
| **D-2** E2E Playwright | Optional; đã có integration test backend (SQLite) + race test Postgres chạy thật, tái lập. |
| **D-3** RLS PostgreSQL layer-2 | Family isolation enforce server-side ở mọi getter (`get_*_in_family`, `family_id` từ JWT). RLS là phòng thủ chiều sâu tuỳ chọn, không phải điều kiện đúng-sai của luồng hiện tại. |
| **D-4** Alembic migrations đầy đủ | Hiện dùng `create_all` + DDL event `after_create` (đã xác nhận apply đúng index/trigger — race suite xanh chứng minh). **Khuyến nghị làm sớm ở phase hạ tầng** để DDL apply nhất quán khi deploy CI/CD. Không chặn PASS. |
| **CI gate** | Đưa `pytest -m postgres` thành job CI cố định (khuyến nghị resolve-plan §5). Không chặn verdict nhưng cần cho chống regression về sau. |

Xác nhận: **không mục deferred nào là BLOCKER hoặc chạm** role enforcement / point integrity / unlock logic / audit trail.

---

## 5. Kiểm chứng đã chạy trong re-review (empiric, reviewer tự chạy)

| Lệnh | Kết quả |
|---|---|
| `unset TEST_DATABASE_URL; .venv/bin/python -m pytest -v` (KHÔNG Docker, KHÔNG env tay) | **PASS — 9 passed, 0 skipped, 0 failed** (5 SQLite + 4 race Postgres) |
| `.venv/bin/python -m pytest -m postgres -q` (lặp lại lần 2) | **PASS — 4 passed, 5 deselected** (ổn định, tái lập) |
| `docker info` | **UNAVAILABLE** — xác nhận bootstrap KHÔNG phụ thuộc Docker |
| `ls /opt/homebrew/Cellar/postgresql@15/15.18/bin` | có `initdb`, `pg_ctl`, `postgres`, `psql` (full server) — hook chọn đúng, tránh shim `/opt/homebrew/opt/libpq/bin` |

Kết luận empiric: gate race **tự cung cấp Postgres, chạy thật, tái lập được** mà không cần bất kỳ provisioning thủ công nào — đúng root-cause fix mà resolve-plan §2 yêu cầu. Cơ chế idempotency/race và append-only **không còn là no-op**; 4 bất biến toàn vẹn điểm giữ vững dưới concurrency thực.

---

## 6. Next step

Verdict **PASS** ⇒ vòng resolve khép lại (đã chạm resolve-loop-limit và mọi điều kiện Exit criteria — resolve-plan §7 — đã thoả):

1. Chuyển sang **runtime verification / demo / merge**. Gate chặn deploy trước đây (race gate xanh, tái lập trên Postgres thật) **đã thoả**.
2. Đưa `pytest -m postgres` vào **CI** như job cố định (GitHub Actions `services: postgres` → export `TEST_DATABASE_URL`; hoặc runner có Postgres binaries → hook tự bootstrap). Đặt gate: không merge nếu 4 test race không PASS.
3. Bổ sung **Alembic (D-4)** ở phase hạ tầng để index/trigger Postgres-only apply nhất quán khi deploy (thay cho phụ thuộc `create_all` + `after_create`).

Không còn code remediation nào cần thực hiện trong vòng resolve. **Kết thúc vòng resolve tại đây với verdict PASS.**
