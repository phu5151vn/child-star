# Resolve Plan — Ứng dụng tạo điểm loyalty cho con ("Bé Ngoan")

> Stage 6 (Resolve loop) — **resolve attempt #3 (đã CHẠM resolve-loop-limit).**
> Nguồn: `06-qa/review-report.md`, `06-qa/re-review-report.md`, `06-qa/checklist.md`, `06-qa/resolve-plan.md` + `06-qa/resolve-checklist.md` (attempt #1 & #2), `05-build/resolve-build-report.md`, code thực tế `backend/` + `frontend/`.
> Verdict gần nhất: **recheck-verdict-pass = false** (recheck attempt #3 KHÔNG PASS) — dù `re-review-report.md` (attempt #2) từng ghi PASS. Xem §0 để biết vì sao mâu thuẫn này chính là root cause.
> **Bước này CHỈ lập kế hoạch. KHÔNG sửa code.** Cursor sẽ implement sau.

---

## 0. TL;DR — vì sao vẫn NOT PASS ở attempt #3 (root-cause của finding tái diễn)

- **Chỉ còn duy nhất 1 item mở: R-BLK-3** — verify empiric các bất biến toàn vẹn điểm dưới concurrency trên PostgreSQL. Toàn bộ enforcement code (2 BLOCKER + 10 ISSUE) đã đóng và đã được xác nhận lại ở attempt #3 (§1) — **không có regression, không đụng business logic**.
- **R-BLK-3 đã sống sót qua 3 attempt.** Bắt buộc chẩn đoán vì sao trước khi viết step mới (yêu cầu của loop-limit):

  | Attempt | Điều gì xảy ra với R-BLK-3 | Vì sao không đóng được |
  |---|---|---|
  | #1 | Test `test_race_postgres.py` viết xong, đúng thiết kế | Không có Postgres/Docker → `pytest.skip(allow_module_level=True)` → 4 test **skip** → gate mở |
  | #2 | `re-review-report.md §2/§5` ghi "reviewer tự chạy `pytest -m postgres` → 4 passed" trên **Homebrew `postgresql@15` @ localhost:5432**, DB `benngoan` set **thủ công** | "PASS" này **không tái lập được**: phụ thuộc một server launch bằng tay + `TEST_DATABASE_URL` export bằng tay. Không phải hạ tầng pipeline sở hữu. |
  | #3 (recheck) | Recheck chạy `pytest` trong môi trường **không** có server tay đó và **không** tự export `TEST_DATABASE_URL` | Module race **skip lại** → recheck **không thể xác nhận empiric** → verdict = NOT PASS |

- **ROOT CAUSE (đã xác minh trực tiếp trên máy này ở bước planning):**
  1. `backend/tests/test_race_postgres.py:20-24` đọc `TEST_DATABASE_URL` ở **module level** và `pytest.skip(allow_module_level=True)` khi biến rỗng ⇒ nếu recheck không set biến, 4 test **âm thầm skip** (không fail, không chạy) ⇒ gate không bao giờ đóng được một cách tự động.
  2. Con đường `docker compose up -d db` (port **5433**) **chưa bao giờ chạy được** ở bất kỳ attempt nào vì **Docker UNAVAILABLE** (xác nhận lại: `docker info` = unavailable). Plan attempt #2 dựa vào cổng 5433 này là bất khả thi trong môi trường resolve/recheck.
  3. "PASS" attempt #2 dùng cổng **5432** (Homebrew, khác 5433 của docker-compose) + DB provision tay ⇒ recheck tự động không tái lập.
  - ⇒ Finding tái diễn **KHÔNG phải vì code defect** (enforcement đã đúng) mà vì **gate verify không self-contained/không tái lập trong môi trường recheck**. Đây là lỗi **test-harness / provisioning**, không phải lỗi service/model.

- **Điều kiện hạ tầng thực tế trên máy recheck (planning đã kiểm):** Docker = ❌, nhưng **PostgreSQL 15.18 binaries CÓ sẵn** (`initdb`, `pg_ctl`, `postgres`, `psql` tại `/opt/homebrew/Cellar/postgresql@15/15.18/bin` + trên PATH), `psycopg2-binary` đã có trong venv. ⇒ **Có thể tự bootstrap một ephemeral Postgres từ binaries local, KHÔNG cần Docker, KHÔNG cần server chạy sẵn, KHÔNG cần export env bằng tay.**

- **Hành động để flip verdict (smallest set):** biến R-BLK-3 từ "gate phụ thuộc provisioning bên ngoài/thủ công" thành **gate tự bootstrap tái lập được**: thêm hook `pytest_configure` trong `backend/tests/conftest.py` tự khởi tạo ephemeral Postgres (nếu `TEST_DATABASE_URL` chưa set và có binaries local), set env trước khi collect, teardown ở `pytest_unconfigure`. Sau đó **`pytest` trần** (không Docker, không env tay) chạy thật 4 test race ⇒ recheck xác nhận empiric ⇒ PASS.

- **Phạm vi:** chỉ chạm **test harness + provisioning** (`conftest.py`, tùy chọn nhẹ ở `test_race_postgres.py`, docs/CI). **KHÔNG** đụng service/model/router, **KHÔNG** nới permission, **KHÔNG** mở finding mới, **KHÔNG** mở rộng product scope.

---

## 1. Đối chiếu trạng thái tất cả finding (vs resolve-checklist #1 & #2)

Quy tắc phân loại (giữ nguyên): **BLOCKER** = phá vỡ (a) role/permission, (b) toàn vẹn điểm (cộng/trừ/số dư âm/atomicity/race), (c) unlock logic mốc thưởng, (d) audit trail — **hoặc không thể verify các điều trên**. Còn lại **ISSUE**; polish/hạ tầng optional là **NOTE/defer**.

| Resolve id | Phân loại | Trạng thái ở attempt #3 | Còn phải làm gì để PASS? |
|---|---|---|---|
| **R-BLK-3** | **BLOCKER** (verify point-integrity dưới concurrency) | ⚠️ **MỞ (re-scope)** — enforcement code đúng, nhưng gate verify **không tái lập** trong recheck ⇒ NOT PASS | **Làm gate tự bootstrap Postgres** để `pytest` trần chạy thật 4 test race → xác nhận empiric. Xem §2. |
| R-BLK-1 | BLOCKER | ✅ ĐÓNG — xác nhận lại attempt #3: `advisory_lock_child` trước check (`task_service.py:280`), re-check (`:282`), `IntegrityError`+`is_unique_violation("uq_ledger_task_approved")` (`:321-326`), index (`ddl.py:9-10`) | — (được empiric verify **đi kèm** R-BLK-3) |
| R-BLK-2 | BLOCKER | ✅ ĐÓNG — xác nhận lại: `advisory_lock_child` (`reward_service.py:222`), re-check, balance sau lock, stock+ledger+audit cùng transaction, `IntegrityError`+`is_unique_violation("uq_ledger_reward_redeemed")`, index (`ddl.py:12-13`) | — (đi kèm R-BLK-3) |
| R-ISS-1 | ISSUE | ✅ ĐÓNG (`ddl.py:15-23` + handling `IntegrityError` ở claim `:234-238`/redeem/child) | — (empiric đi kèm R-BLK-3: claim 409 + redeem idempotent) |
| R-ISS-2 | ISSUE | ✅ ĐÓNG (`media_service.py:67-69` ownership proof) | — |
| R-ISS-3 | ISSUE | ✅ ĐÓNG (`task_service.py:259-267` validate proof_media_id) | — |
| R-ISS-4 | ISSUE | ✅ ĐÓNG (`schemas/__init__.py` `field_validator("delta")`; test PASS SQLite) | — |
| R-ISS-5 | ISSUE | ✅ ĐÓNG khai báo (`ddl.py:25-34` trigger append-only) | — (hiệu lực/verify Postgres đi kèm R-BLK-3) |
| R-ISS-6 | ISSUE | ✅ ĐÓNG (audit approve/reject/cancel cùng transaction; idempotent không double-log) | — |
| R-ISS-7 | ISSUE | ✅ ĐÓNG (`ChildPages.tsx:27-52` PageState 3 state) | — |
| R-ISS-8 | ISSUE | ✅ ĐÓNG phần upload (`MediaUpload.tsx` wired task/reward/proof) | — (illustration = D-1 defer) |
| R-ISS-9 | ISSUE | ✅ ĐÓNG (`assert_transition` wired submit/approve/reject) | — |
| R-ISS-10 | ISSUE | ✅ ĐÓNG (`config.py` prod guard + `rate_limit.py` + `api.py:62,80`) | — |

**Không phát hiện regression** so với attempt #1/#2: mọi mục đã tick vẫn hiệu lực trên code hiện tại (planning đã grep xác nhận advisory lock + IntegrityError handling còn nguyên). **Không mục mới ngoài phạm vi review được thêm.**

> Kết luận đối chiếu: **10/10 ISSUE + 2/3 BLOCKER đã đóng ở code.** Verdict NOT PASS **chỉ** đến từ R-BLK-3 — một gate verify chưa tái lập được, KHÔNG phải code defect. Vì vậy attempt #3 **chỉ** re-scope R-BLK-3, không đụng gì khác.

---

## 2. BLOCKER duy nhất còn mở — R-BLK-3 (re-scope attempt #3)

### R-BLK-3 — Làm gate verify race self-bootstrapping (chạy thật, tái lập được) trên PostgreSQL

- **id:** R-BLK-3
- **priority:** **P0 — BLOCKER (gate bắt buộc, KHÔNG waive).** Là điều kiện DUY NHẤT chặn PASS.
- **recurrence note:** ĐÃ xuất hiện ở attempt #1 (skip vì thiếu Postgres) và attempt #2 ("PASS" bằng server launch tay trên 5432 — không tái lập). **Root cause thực (không phải wrong-file, không phải business logic):** (1) module-level skip ở `test_race_postgres.py:20-24` khiến test **âm thầm skip** khi recheck không set `TEST_DATABASE_URL`; (2) con đường docker-compose port 5433 bất khả thi vì **Docker UNAVAILABLE**; (3) attempt #2 dựa vào provisioning thủ công không thuộc pipeline. Các attempt trước xử lý sai tầng: coi đây là "gate hạ tầng phải chờ CI/deploy" thay vì làm **test tự cung cấp Postgres** — mà máy recheck **đã có sẵn Postgres binaries** để bootstrap không cần Docker.
- **files to touch:**
  - `backend/tests/conftest.py` — thêm bootstrap ephemeral Postgres + dọn dead fixtures.
  - `backend/tests/test_race_postgres.py` — (tùy chọn, nhẹ) chuyển thông điệp skip cho rõ ràng; **không** đổi thân test.
  - `backend/requirements.txt` — **không thêm dependency runtime** (dùng `subprocess` + binaries Postgres local + `psycopg2` đã có). *(Chỉ khi máy target không có Postgres binaries mới cân nhắc thêm `pytest-postgresql` — xem Alternative bên dưới.)*
  - *(khuyến nghị, không chặn)* `.github/workflows/*.yml` hoặc `docs/agent-artifacts/05-build/*` — ghi cách CI chạy gate (§ CI recommendation).
- **exact implementation steps:**

  1. **Thêm hook tự bootstrap ephemeral Postgres vào `backend/tests/conftest.py`.** Hook chạy ở `pytest_configure` (TRƯỚC khi collect module race), tôn trọng `TEST_DATABASE_URL` nếu CI đã set; nếu chưa set và có `initdb`/`pg_ctl` local thì khởi tạo cluster tạm trên cổng tự do, tạo DB, set `os.environ["TEST_DATABASE_URL"]`. Teardown ở `pytest_unconfigure`. Code mẫu (implement verbatim, chỉnh path fallback nếu cần):

     ```python
     # backend/tests/conftest.py
     import atexit
     import glob
     import os
     import shutil
     import socket
     import subprocess
     import tempfile
     from pathlib import Path

     _PG = {}  # holds ephemeral cluster state for teardown


     def _free_port() -> int:
         s = socket.socket()
         s.bind(("127.0.0.1", 0))
         port = s.getsockname()[1]
         s.close()
         return port


     def _find_bin(name: str):
         """Locate a Postgres server binary without requiring Docker."""
         found = shutil.which(name)
         if found:
             return found
         for pat in (
             "/opt/homebrew/Cellar/postgresql@*/*/bin/",
             "/usr/local/Cellar/postgresql@*/*/bin/",
             "/usr/lib/postgresql/*/bin/",
         ):
             for d in glob.glob(pat):
                 cand = Path(d) / name
                 if cand.exists():
                     return str(cand)
         return None


     def _bootstrap_ephemeral_postgres():
         """initdb + pg_ctl start an ephemeral cluster from local binaries.

         Returns a SQLAlchemy URL, or None if binaries are unavailable
         (tests then skip gracefully — same as before)."""
         initdb, pg_ctl, psql = _find_bin("initdb"), _find_bin("pg_ctl"), _find_bin("psql")
         if not (initdb and pg_ctl and psql):
             return None
         datadir = tempfile.mkdtemp(prefix="benngoan_pg_")
         subprocess.run(
             [initdb, "-D", datadir, "-U", "postgres", "--auth=trust", "-E", "UTF8"],
             check=True, capture_output=True,
         )
         port = _free_port()
         logfile = os.path.join(datadir, "server.log")
         subprocess.run(
             [pg_ctl, "-D", datadir, "-l", logfile, "-w", "-o",
              f"-p {port} -k {datadir} -c listen_addresses=127.0.0.1", "start"],
             check=True, capture_output=True,
         )
         subprocess.run(
             [psql, "-h", "127.0.0.1", "-p", str(port), "-U", "postgres",
              "-d", "postgres", "-c", "CREATE DATABASE benngoan"],
             check=True, capture_output=True,
         )
         _PG.update(datadir=datadir, pg_ctl=pg_ctl)
         return f"postgresql+psycopg2://postgres@127.0.0.1:{port}/benngoan"


     def _teardown_ephemeral_postgres():
         if not _PG:
             return
         subprocess.run(
             [_PG["pg_ctl"], "-D", _PG["datadir"], "-m", "immediate", "stop"],
             capture_output=True,
         )
         shutil.rmtree(_PG["datadir"], ignore_errors=True)
         _PG.clear()


     def pytest_configure(config):
         # Respect an externally-provided DB (e.g. CI service). Otherwise
         # self-provision so `pytest` reproducibly runs the race gate.
         if os.environ.get("TEST_DATABASE_URL"):
             return
         url = _bootstrap_ephemeral_postgres()
         if url:
             os.environ["TEST_DATABASE_URL"] = url
             atexit.register(_teardown_ephemeral_postgres)


     def pytest_unconfigure(config):
         _teardown_ephemeral_postgres()
     ```

  2. **Xóa dead fixtures `pg_engine`/`pg_session`** (hiện `conftest.py:20-39`) và biến top-level `TEST_DATABASE_URL`/`pytestmark` (`:12-17`) — chúng không được test nào dùng và dùng `Base.metadata.drop_all` vướng circular FK users↔media (bẫy tiềm ẩn đã ghi ở `re-review-report.md §6`). Việc bootstrap ở step 1 thay thế hoàn toàn vai trò cung cấp Postgres. Sau khi xóa, `conftest.py` chỉ còn phần bootstrap.

  3. **Không đổi thân 4 test** trong `test_race_postgres.py`. Vì `pytest_configure` set `os.environ["TEST_DATABASE_URL"]` **trước** khi module này được import/collect, dòng `:20-24` sẽ thấy env đã set và **không skip** → `engine`/`SessionLocal` khởi tạo trỏ vào cluster ephemeral. Giữ nguyên logic advisory-lock/idempotency đang test. (Tùy chọn: đổi message dòng `:24` thành `"TEST_DATABASE_URL not set and no local Postgres binaries — install postgresql to run race gate"` cho rõ.)

  4. **Không** đụng `backend/app/**` (service/model/router/schema). Enforcement race-safe đã đúng và đã xác nhận (`task_service.py:280,282,321-326`; `reward_service.py:222,224,241-243,274-279`; `ddl.py`).

- **Alternative (chỉ dùng nếu máy target KHÔNG có Postgres binaries):** thêm `pytest-postgresql>=5` vào `backend/requirements.txt`; nó cũng bootstrap ephemeral cluster từ binaries local (vẫn cần binaries, vẫn không cần Docker). Cách hand-rolled ở trên **không thêm dependency** nên ưu tiên hơn khi binaries đã có (đúng với máy recheck hiện tại). **Tuyệt đối không** dùng testcontainers (đòi Docker — đã xác nhận unavailable).

- **acceptance criteria (điều kiện R-BLK-3 = PASS ở recheck):**
  - Chạy **`pytest` trần** trong `backend/` (KHÔNG Docker, KHÔNG export `TEST_DATABASE_URL` bằng tay) → **4 test race PASS, KHÔNG skip**:
    - `test_race_approve_assignment_single_ledger` → đúng **1** ledger `task_approved`, balance con = `task.points` (30) ⇒ **không double-count** (bất biến toàn vẹn điểm khi bố mẹ duyệt hoàn thành đồng thời).
    - `test_race_approve_redemption_single_deduct` → đúng **1** ledger `reward_redeemed`, balance = **0 (không âm)**, `stock` giảm **đúng 1** ⇒ **không double-deduct / không chi vượt điểm**.
    - `test_race_claim_single_active_assignment` → **đúng 1** request 200, còn lại **409**; đúng 1 assignment `in_progress/submitted` ⇒ con không nhận trùng nhiệm vụ.
    - `test_race_redeem_single_requested` → tất cả **200 idempotent**; đúng **1** redemption `requested` ⇒ không tạo trùng yêu cầu đổi thưởng.
  - `pytest -v` (bao gồm suite SQLite) vẫn xanh: **5 passed** SQLite + **4 passed** Postgres race (không còn "skipped" ở nhóm race). Test không-race không đổi hành vi.
  - Trên môi trường **không** có Postgres binaries **và không** set env: 4 test race **skip có thông điệp rõ ràng** (fallback an toàn, không làm đỏ CI local), nhưng gate deploy vẫn yêu cầu chúng chạy (§ Exit criteria).
  - **Không** nới lỏng bất kỳ `require_role("parent")` / `require_owner_child` / family isolation nào; **không** đổi unlock logic; `git diff` chỉ chạm `backend/tests/**` (+ tùy chọn `requirements.txt`/CI/docs).
- **verification steps (lệnh chính xác):**
  ```bash
  cd artifact/ung-dung-tao-diem-loyalty-cho-con-895c/backend
  # 1) Gate tái lập: pytest trần tự bootstrap Postgres, chạy thật 4 test race
  .venv/bin/python -m pytest -v
  #    Kỳ vọng: 4 test test_race_postgres.py PASSED (không skip) + SQLite 5 passed
  # 2) Chạy riêng nhóm race cho rõ
  .venv/bin/python -m pytest -m postgres -v      # 4 passed
  # 3) (nếu CI cấp Postgres service) tôn trọng env ngoài:
  TEST_DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/db \
    .venv/bin/python -m pytest -m postgres -v    # 4 passed, không bootstrap
  # 4) Xác nhận DDL Postgres-only tạo thật (trên cluster đang chạy):
  #    5 index uq_* + trigger trg_points_ledger_append_only tồn tại
  ```
- **contingency (nếu 4 test KHÔNG xanh khi đã chạy thật trên Postgres):** đây là con đường DUY NHẤT quay lại resolve code; **không mở finding mới**, chỉ soi đúng vùng:
  - `approve_assignment` fail (ledger > 1) → thứ tự `advisory_lock_child` / `IntegrityError` handling `backend/app/services/task_service.py:280-326`.
  - `approve_redemption` fail (ledger > 1 / balance âm / stock giảm > 1) → `backend/app/services/reward_service.py:222-279`; xác nhận stock decrement + ledger insert + audit **cùng transaction, không commit sớm**.
  - `claim`/`redeem` fail → kiểm `uq_assignment_active`/`uq_redemption_requested` (`ddl.py:15-20`) đã tạo (query `pg_indexes`) và `IntegrityError` handling.
  - Index/trigger không apply → kiểm `event.listen(... after_create ...)` (`ddl.py:38`) có chạy khi `create_all` không; cân nhắc D-4 (Alembic) sớm.

---

## 3. ISSUE còn mở

**KHÔNG có.** Toàn bộ R-ISS-1..R-ISS-10 đã đóng ở code và xác nhận lại ở attempt #3 (bảng §1). Không ISSUE nào cần đưa vào plan implement.

> Ghi chú R-ISS-5 (trigger append-only) và một phần R-ISS-1 (partial unique index): đã khai báo đúng ở `ddl.py`; **hiệu lực thực tế chỉ trên Postgres** nên được verify **chung cùng gate R-BLK-3** (nay đã tái lập được). Không phải ISSUE code mở.

---

## 4. Deferred (NOTE — ngoài phạm vi PASS, có lý do; an toàn để hoãn)

Không mục nào là BLOCKER hay chạm role enforcement / point integrity / unlock logic / audit trail ⇒ không chặn verdict PASS.

| Id | Nội dung | Lý do defer (an toàn) |
|---|---|---|
| **D-1** | Illustration Stitch cho empty-state | Thuần thẩm mỹ; empty-state chức năng đã có (`PageState`/AntD `Empty`). Không chạm nghiệp vụ/point integrity/permission/audit. |
| **D-2** | E2E Playwright | Optional; đã có integration test backend (SQLite) + race test Postgres nay chạy thật. Không phải bất biến nào của sản phẩm phụ thuộc E2E. |
| **D-3** | RLS PostgreSQL layer-2 | Family isolation đã enforce server-side ở mọi getter (`get_*_in_family`, `family_id` từ JWT; checklist B1–B4 ✅). RLS là phòng thủ chiều sâu tùy chọn, không phải điều kiện đúng-sai của luồng hiện tại. |
| **D-4** | Alembic migrations đầy đủ | Hiện dùng `create_all` + DDL event `after_create` (đã xác nhận apply đúng index/trigger). **Khuyến nghị làm sớm ở phase hạ tầng** để DDL apply nhất quán khi deploy CI/CD; gián tiếp giúp gate R-BLK-3 ổn định trên nhiều môi trường. Không chặn PASS. |
| **NOTE-cleanup** | ~~Dead fixtures `pg_engine`/`pg_session` trong `conftest.py`~~ | Đã gộp vào R-BLK-3 step 2 (xóa khi đang sửa `conftest.py`). Không còn là mục hoãn riêng. |

---

## 5. CI recommendation (không chặn PASS, nhưng chống regression về sau)

- Đưa `pytest -m postgres` thành **job CI cố định**. Hai cách đều tương thích với bootstrap ở §2 (hook tôn trọng `TEST_DATABASE_URL` nếu đã set):
  - **GitHub Actions với `services: postgres`** → export `TEST_DATABASE_URL` trỏ service → hook bỏ qua bootstrap, chạy thẳng.
  - **Runner có Postgres binaries** (không service) → không set env → hook tự bootstrap ephemeral cluster.
- Đặt gate: **build không được merge nếu 4 test race không PASS.**

---

## 6. Không nới lỏng — ràng buộc an toàn giữ nguyên

- Không đụng/không nới bất kỳ `require_role("parent")` / `require_owner_child` / family isolation nào.
- Không đổi unlock logic (đổi thưởng chỉ khi `balance ≥ required_points`; teaser locked vẫn hiển thị read-only, backend chặn redeem khi khóa; balance không âm).
- Không đụng service/model/router/schema ở attempt #3 — chỉ test harness + provisioning + docs/CI.
- Không mở rộng product scope ngoài luồng bố mẹ/con · nhiệm vụ · phần thưởng · điểm · unlock/redemption.
- Không sửa code ở bước planning này.

---

## 7. Exit criteria — điều kiện BẮT BUỘC (tất cả phải đúng) để recheck trả PASS

> Vì đã chạm resolve-loop-limit, recheck sẽ PASS **khi và chỉ khi TẤT CẢ** điều dưới đây đúng. Đây là danh sách chốt cho `claude-recheck-after-resolve`.

1. **[Gate race tái lập]** Chạy `pytest -v` trần trong `backend/` (KHÔNG Docker, KHÔNG export `TEST_DATABASE_URL` bằng tay) → **4/4 test `test_race_postgres.py` PASSED, KHÔNG có "skipped"** ở nhóm này. (Bootstrap ephemeral Postgres từ binaries local hoạt động.)
2. **[Bất biến toàn vẹn điểm dưới concurrency]** 4 test khẳng định: đúng 1 ledger `task_approved` (không double-count); đúng 1 ledger `reward_redeemed` + balance = 0 (không âm) + stock giảm đúng 1 (không double-deduct); claim → đúng 1×200 còn lại 409 (1 active assignment); redeem → toàn bộ 200 idempotent + đúng 1 redemption `requested`.
3. **[Không regression]** `pytest -v` toàn bộ vẫn xanh: **5 passed** SQLite + **4 passed** Postgres race (0 failed).
4. **[DDL Postgres-only hiệu lực thật]** 5 partial unique index `uq_*` + trigger `trg_points_ledger_append_only` được `create_all` tạo thật trên cluster test (verify qua `pg_indexes`/`pg_trigger` hoặc gián tiếp qua 4 test xanh).
5. **[Diff đúng phạm vi]** `git diff` của resolve #3 chỉ chạm `backend/tests/**` (+ tùy chọn `backend/requirements.txt`, CI, docs). **Không** file nào dưới `backend/app/**` bị đổi. Không có `require_role`/`require_owner_child`/family isolation nào bị nới; unlock logic không đổi.
6. **[Không mở scope]** Không thêm screen/role/entity ngoài bố mẹ/con · nhiệm vụ · phần thưởng · điểm · unlock/redemption.

Khi cả 6 điều trên đúng → R-BLK-3 đóng empiric, mọi BLOCKER/ISSUE đã đóng → **verdict = PASS**, kết thúc vòng resolve, sản phẩm đủ điều kiện chuyển runtime verification / demo / merge.
