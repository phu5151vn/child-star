# Architecture — Ứng dụng tạo điểm loyalty cho con ("Bé Ngoan")

> **Bản chốt Stage 3.** Truy vết `00-intake/request.md`, `01-product/prd.md`, và toàn bộ `02-design/*` (bao gồm design system Stitch "Bé Ngoan Playful"). Tuân thủ Architecture Rules & Data Rules trong `CLAUDE.md`. Đây là nguồn kỹ thuật để Cursor build ở Stage 4; đi kèm `04-data/schema.md` và `05-build/*`.

## 0. Quyết định chốt (giải quyết open issues của draft)

| # | Vấn đề mở (draft) | Quyết định chốt | Rule truy vết |
|---|---|---|---|
| D1 | Auth cho con (PIN vs mã gia đình) — Q6 | Con đăng nhập bằng **`family_code`** (mã gia đình ngắn do bố mẹ chia sẻ) → chọn **avatar (child_id)** → nhập **PIN 4 số**. Backend cấp session token role=`child`. **Không** thu thập email/sđt trẻ. | PRD §3, §10 |
| D2 | RLS vs kiểm soát server-side | **Server-side isolation là BẮT BUỘC** (repository luôn scope theo `family_id` lấy từ token claim, không nhận `family_id` từ client). **RLS PostgreSQL là lớp phòng thủ tùy chọn** (defense-in-depth) qua `SET LOCAL app.current_family_id` mỗi request. Giai đoạn 1 bắt buộc lớp server-side; RLS khuyến nghị bật khi có thời gian. | PRD §10, CLAUDE Data Rules |
| D3 | Lock khi trừ điểm | Số dư là **derived** từ ledger nên không có 1 hàng để `FOR UPDATE`. Dùng **`pg_advisory_xact_lock(hashtext(child_id::text))`** đầu transaction cho mọi thao tác **trừ điểm** (đổi thưởng approve, manual_adjust âm) → tuần tự hóa theo từng con, chống race condition. | BR-P3, BR-X3 |
| D4 | Lưu trữ ảnh | Giai đoạn 1: **local filesystem có kiểm soát** (`MEDIA_ROOT`), phục vụ qua endpoint `GET /media/{id}` có auth + kiểm tra `family_id`/ownership. Tầng `media` trừu tượng hóa qua interface `StorageBackend` để đổi sang object storage (S3/GCS) về sau mà không đổi service. | PRD §7 |
| D5 | Redis/Celery | **Không cần trong scope giai đoạn 1.** Không có job nền/batch bắt buộc. "Thông báo" (hàng đợi chờ duyệt, con đạt mốc) hiển thị **in-app** qua refetch/polling của TanStack Query. Ghi rõ điểm mở rộng ở §8. | Intake §6 |
| D6 | Bảng audit ngoài ledger | Có. `points_ledger` là audit trail cho **điểm** (append-only). Thêm bảng **`audit_log`** nhẹ cho thay đổi **cấu hình rule** (tạo/sửa/xóa task, reward, toggle active, đổi PIN con). | CLAUDE Delivery/Data Rules |
| D7 | Tension "UI mobile Stitch" vs "web AntD" | Build **web SPA responsive, mobile-first** dùng **React + Vite + TS + Ant Design 5**; áp **design language Stitch** ("Bé Ngoan Playful" — pastel, bo tròn, linh vật) qua `ConfigProvider` tokens. Route canonical = `navigation.json` (S0–S13). Mapping Stitch→web ở `05-build/build-ready.md §2`. | design-notes, ui-flow-spec |

## 1. Tổng quan stack (chốt)

| Layer | Công nghệ |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Ant Design 5 + React Router v6 + TanStack Query v5 |
| Style/theme | AntD `ConfigProvider` + design tokens Stitch "Bé Ngoan Playful"; confetti (canvas-confetti) cho micro-interaction |
| Backend | FastAPI (Python 3.11+) + Pydantic v2 |
| ORM/Migration | SQLAlchemy 2.0 + Alembic |
| Database | PostgreSQL 15+ |
| Auth | JWT (access token) ký server-side; claim: `sub`, `role`, `family_id`, `child_id?` |
| Storage ảnh | Local filesystem (`StorageBackend` interface) — giai đoạn 1 |
| Async/queue | **Không dùng** giai đoạn 1 (Celery/Redis chỉ mở rộng sau) |
| Testing | Pytest (unit + integration) + Playwright (E2E, tùy chọn) |

## 2. Kiến trúc backend (layered — router → service → repository)

```
        HTTP (JSON, /api/v1)
             │
      ┌──────▼───────┐
      │   Router     │  Pydantic validation, auth guard (JWT), map lỗi domain → HTTP
      └──────┬───────┘
      ┌──────▼───────┐
      │  Service /   │  BUSINESS RULES: state machine, cộng/trừ điểm, unlock, redeem,
      │   Domain     │  idempotency, advisory lock, transaction boundary
      └──────┬───────┘
      ┌──────▼───────┐
      │ Repository   │  SQLAlchemy; query luôn scope family_id; SELECT ... FOR UPDATE,
      │              │  advisory lock; append-only ledger
      └──────┬───────┘
      ┌──────▼───────┐
      │ PostgreSQL   │  CHECK constraints, UNIQUE (idempotency), FK, (RLS optional)
      └──────────────┘
```

- **Router**: chỉ HTTP concern — xác thực JWT, kiểm role (dependency `require_role("parent")`), validate payload, gọi service, map exception domain sang mã HTTP + error code. **Không chứa business rule.**
- **Service/domain**: nơi **duy nhất** enforce rule nhạy cảm PRD §5. Mọi thao tác đụng điểm chạy trong 1 transaction. Không tin bất kỳ giá trị `family_id`/`role`/`balance` nào từ client.
- **Repository**: truy cập DB, luôn nhận `family_id` từ context (token), không từ body. Cung cấp helper khóa (`advisory_lock_child`, `select_for_update`).

### 2.1 Module chính

| Module | Trách nhiệm | Rule |
|---|---|---|
| `auth` | login parent (email+password, bcrypt), login child (`family_code`+child_id+PIN), phát/verify JWT, dependency phân quyền | PRD §3, §4, §10; D1 |
| `families` | đăng ký family + parent chủ, sinh `family_code`, thông tin family | Q1 |
| `children` | parent CRUD tài khoản con (display_name, avatar, PIN), list, balance | Q1, Q6 |
| `tasks` | CRUD nhiệm vụ (parent), list theo role | R3, PRD §6.1 |
| `assignments` | claim/submit/approve/reject; state machine; cộng điểm idempotent | BR-T1..T6 |
| `rewards` | CRUD phần thưởng (parent); tính `locked/unlocked` + `missing_points` cho con | BR-R1..R4, R5, R6 |
| `redemptions` | redeem request / approve (trừ điểm + giảm stock trong txn) / reject / cancel | BR-X1..X5 |
| `points` | ghi ledger append-only, tính balance (derived), manual_adjust | BR-P1..P5 |
| `media` | upload/validate ảnh (MIME, size), serve có auth, `StorageBackend` | PRD §7; D4 |
| `audit` | `audit_log` cho thay đổi cấu hình rule | D6 |

### 2.2 Enforce phía backend (điểm nhạy cảm)

- **State machine nhiệm vụ** (BR-T2 no-skip): chỉ chuyển trạng thái qua service; bảng ánh xạ transition hợp lệ; `available→submitted` hay `available→approved` bị từ chối (`INVALID_TRANSITION`).
- **Phân quyền** (PRD §4): tạo/sửa/xóa task & reward, duyệt hoàn thành, duyệt đổi thưởng, manual_adjust → **chỉ `parent`**. Claim/submit/redeem → **chỉ `child`** và chỉ trên dữ liệu của chính mình (BR-T1, BR-X1).
- **Cộng điểm idempotent** (BR-T4): ledger có `UNIQUE(kind='task_approved', task_assignment_id)`; approve lần 2 → no-op (trả 200 idempotent), không cộng trùng.
- **Trừ điểm an toàn** (BR-P3, BR-X3): trong txn → `pg_advisory_xact_lock(child)` → tính balance từ ledger → nếu `balance < required_points` ⇒ `INSUFFICIENT_POINTS`; ngược lại ghi ledger âm + (nếu có) giảm stock. Kiểm tra tại **thời điểm duyệt**, không chỉ lúc gửi yêu cầu.
- **Ledger append-only** (BR-P5): không UPDATE/DELETE; sửa sai bằng dòng bù (`manual_adjust` có `reason`).
- **Cô lập family** (D2): mọi query lọc `family_id` từ token; con chỉ đọc `assignment`/`ledger`/`redemption` của chính mình.
- **Audit** (D6): mọi thay đổi cấu hình rule ghi `audit_log` (actor, action, entity, before/after tối thiểu).

## 3. API contract (chốt — REST, versioned `/api/v1`)

Quy ước: 🔒P = chỉ parent, 🔒C = chỉ child (own), 🌐 = public/anonymous. Lỗi domain trả JSON `{ "error_code": "...", "message": "..." }` + HTTP phù hợp (400/401/403/404/409/422).

### 3.1 Auth & danh tính
| Method | Path | Quyền | Mô tả | Rule |
|---|---|---|---|---|
| POST | `/auth/register` | 🌐 | Tạo family + parent chủ (email, password, family name); trả token + `family_code` | Q1 |
| POST | `/auth/parent/login` | 🌐 | Đăng nhập parent (email+password) → JWT | PRD §3 |
| GET | `/auth/child/profiles?family_code=` | 🌐 | List avatar+display_name con (KHÔNG lộ dữ liệu nhạy cảm) để con chọn | D1 |
| POST | `/auth/child/login` | 🌐 | `{family_code, child_id, pin}` → JWT child | D1 |
| POST | `/auth/logout` | any | Hủy phiên client-side | |
| GET | `/me` | any | User hiện tại + role (+ child: `balance`) | |

### 3.2 Family & con
| Method | Path | Quyền | Mô tả | Rule |
|---|---|---|---|---|
| GET | `/family` | 🔒P | Thông tin family + `family_code` | |
| GET | `/children` | 🔒P | List con trong family | Q1 |
| POST | `/children` | 🔒P | Tạo con (display_name, avatar, PIN) | Q6 |
| GET | `/children/{id}` | 🔒P | Chi tiết con | |
| PATCH | `/children/{id}` | 🔒P | Sửa tên/avatar/PIN/is_active (ghi audit) | D6 |
| GET | `/children/{id}/balance` | P / C(own) | Số dư điểm (derived) | BR-P1 |
| GET | `/children/{id}/ledger` | P / C(own) | Lịch sử điểm (paginated) | BR-P5 |
| POST | `/children/{id}/adjust` | 🔒P | `{delta, reason}` manual_adjust (advisory lock nếu delta<0) | BR-P2, BR-P3 |

### 3.3 Nhiệm vụ & assignment
| Method | Path | Quyền | Mô tả | Rule |
|---|---|---|---|---|
| GET | `/tasks` | P: all family / C: active khả dụng | List nhiệm vụ | R4 |
| POST | `/tasks` | 🔒P | Tạo task (title*, points>0*, require_proof, active) — ghi audit | R3, PRD §6.1 |
| GET | `/tasks/{id}` | P / C | Chi tiết | |
| PUT | `/tasks/{id}` | 🔒P | Sửa (ghi audit) | |
| DELETE | `/tasks/{id}` | 🔒P | Vô hiệu hóa (soft: is_active=false; ghi audit) | |
| POST | `/tasks/{id}/assign` | 🔒P | Gán cho `{child_id}` (tùy chọn) | PRD §4 |
| GET | `/assignments?child_id=&status=` | P: all / C: own | List assignment | BR-T1 |
| POST | `/tasks/{id}/claim` | 🔒C | Con nhận → tạo assignment `in_progress` | BR-T1 |
| POST | `/assignments/{id}/submit` | 🔒C(own) | Báo hoàn thành (+`proof_media_id` nếu require_proof) → `submitted` | BR-T2, PRD §7 |
| POST | `/assignments/{id}/approve` | 🔒P | → `approved` + ledger `+points` (idempotent) | BR-T3, BR-T4 |
| POST | `/assignments/{id}/reject` | 🔒P | `{reason?}` → `rejected` (không cộng điểm), về `in_progress` | BR-T5 |

### 3.4 Phần thưởng & đổi thưởng
| Method | Path | Quyền | Mô tả | Rule |
|---|---|---|---|---|
| GET | `/rewards` | P: all / C: active + `is_unlocked`,`missing_points` | List kho thưởng (hiện cả locked) | BR-R2, BR-R3, R6 |
| POST | `/rewards` | 🔒P | Tạo (title*, required_points>0*, stock?, active) — audit | BR-R1, PRD §6.2 |
| GET | `/rewards/{id}` | P / C | Chi tiết (+ trạng thái mở khóa cho con) | BR-R2 |
| PUT | `/rewards/{id}` | 🔒P | Sửa (audit) | |
| DELETE | `/rewards/{id}` | 🔒P | Vô hiệu hóa (soft; audit) | |
| GET | `/redemptions?child_id=&status=` | P: all / C: own | List yêu cầu đổi | |
| POST | `/rewards/{id}/redeem` | 🔒C | Gửi yêu cầu đổi (chỉ khi unlocked & còn stock) → `requested` | BR-X1 |
| POST | `/redemptions/{id}/approve` | 🔒P | txn: advisory lock → check balance → ledger `−required_points` + giảm stock → `approved` | BR-X2, BR-X3, BR-X4 |
| POST | `/redemptions/{id}/reject` | 🔒P | `{reason?}` → `rejected` (không trừ điểm/stock) | BR-X5 |
| POST | `/redemptions/{id}/cancel` | 🔒C(own) | Hủy khi còn `requested` | BR-X5 |

### 3.5 Media
| Method | Path | Quyền | Mô tả | Rule |
|---|---|---|---|---|
| POST | `/media` | P / C | Upload ảnh `{file, kind}`; validate MIME (png/jpg/webp) + size ≤5MB → `media_id` | PRD §7 |
| GET | `/media/{id}` | auth + ownership/family | Serve ảnh (không lộ path tùy tiện) | PRD §7 |

Mã lỗi domain chuẩn hóa: `INVALID_TRANSITION`, `INSUFFICIENT_POINTS`, `REWARD_LOCKED`, `OUT_OF_STOCK`, `FORBIDDEN_ROLE`, `PROOF_REQUIRED`, `DUPLICATE_APPROVAL` (idempotent → 200), `NOT_IN_FAMILY`.

## 4. Traceability: business rule → API → data

| Business rule (PRD) | API endpoint | Bảng/cột dữ liệu |
|---|---|---|
| Điểm mỗi nhiệm vụ (R4, §6.1) | `POST /tasks`, `GET /tasks` | `tasks.points (CHECK>0)` |
| Trạng thái nhiệm vụ (BR-T1..T5, no-skip T2) | `/tasks/{id}/claim`, `/assignments/{id}/submit|approve|reject` | `task_assignments.status (CHECK enum)`, `submitted_at`, `decided_at`, `reject_reason` |
| Cộng điểm khi duyệt, idempotent (BR-T4) | `POST /assignments/{id}/approve` | `points_ledger(kind='task_approved', delta=+points)`, `UNIQUE(task_assignment_id) WHERE kind='task_approved'` |
| Số dư điểm của con (BR-P1) | `GET /children/{id}/balance` | `SUM(points_ledger.delta) WHERE child_id=…` |
| Điểm không âm (BR-P3) | `approve redemption`, `adjust(-)` | advisory lock + kiểm tra balance trước khi ghi delta âm |
| Mốc điểm mở khóa reward (BR-R1,R2, R5) | `GET /rewards`, `GET /rewards/{id}` | `rewards.required_points (CHECK>0)`; `is_unlocked = balance ≥ required_points` |
| Hiện reward chưa đủ điểm (teaser R6, BR-R3) | `GET /rewards` (trả cả locked + `missing_points`) | `rewards.is_active`, computed `missing_points` |
| Đổi thưởng cần duyệt + trừ điểm (BR-X2,X3,X4) | `POST /rewards/{id}/redeem` → `POST /redemptions/{id}/approve` | `reward_redemptions.status`, `points_spent`; `points_ledger(kind='reward_redeemed', delta=−points)`; `rewards.stock -=1` |
| Stock/hết hàng (BR-R4, BR-X1) | `redeem`, `approve` | `rewards.stock (CHECK≥0)` |
| Audit thay đổi điểm | ledger (mọi delta) | `points_ledger` append-only |
| Audit thay đổi cấu hình | mọi POST/PUT/DELETE task/reward, PATCH child | `audit_log` |
| Cô lập gia đình (PRD §10) | mọi endpoint | `*.family_id` scope từ token; RLS optional |

## 5. Frontend (kiến trúc)

- **2 shell theo role** (route guard, `navigation.json`): `ParentLayout` (sidebar menu) và `ChildLayout` (top bar điểm + linh vật, bottom tab mobile). Guard chỉ ẩn/hiện UI — **quyền thực thi ở backend**.
- **Theme**: `AppThemeProvider` bọc `ConfigProvider` với tokens Stitch (primary `#7C5CFC`, accent điểm `#FFC531`, success mint `#3DD598`, locked `#C7C2E0`, radius 16–24, font Baloo 2/Nunito). Chi tiết `02-design/stitch-design-notes.md`.
- **Data layer**: TanStack Query; query keys theo domain (`tasks`, `assignments`, `rewards`, `redemptions`, `ledger`, `children`, `me`). Mutation cộng/trừ điểm → invalidate `balance`+`ledger`+hàng đợi liên quan. Nguồn đúng luôn là backend.
- **State bắt buộc mọi màn**: loading (`Skeleton`/`Spin`), empty (`Empty` + minh họa Stitch), error (`Result` + Thử lại), + đặc thù reward **locked vs unlocked** và **"còn thiếu N điểm"** (`02-design/states.md`).
- **Component** tái sử dụng: `PageState`, `PointsBadge`, `PointsProgress`, `RewardCard` (auto locked/unlocked/out-of-stock), `LockOverlay`, `TaskCard`, `TaskStatusSteps`, `ProofUpload`, `ApprovalQueueItem`, `RedemptionQueueItem`, `LedgerTimeline`, `PinInput`, `CelebrationFx` (`02-design/component-inventory.md`).

## 6. Bảo mật & tuân thủ (an toàn cho trẻ em)

- JWT ký server-side; `family_id`/`role`/`child_id` **chỉ** lấy từ claim, không từ body/query.
- Không thu thập email/sđt trẻ; con dùng `family_code`+PIN. PIN hash (bcrypt), rate-limit đăng nhập.
- Không thanh toán thật, không quảng cáo bên thứ ba, không mạng xã hội (Intake §6 ngoài scope).
- Media: validate MIME + magic bytes + size ở backend; serve qua endpoint có auth; không lộ đường dẫn hệ thống.
- Audit trail: ledger (điểm, append-only) + `audit_log` (cấu hình rule).

## 7. Kiến trúc test (định hướng — chi tiết ở build-ready §5)

- **Unit (service/domain)**: tính balance, transition hợp lệ/không hợp lệ (no-skip), cộng điểm idempotent, trừ điểm không âm, unlock/`missing_points`, stock.
- **Integration (API + phân quyền)**: parent-only/child-only guards, cô lập family (con A không thấy dữ liệu con B/family khác), luồng end-to-end task & redemption.
- **Race condition**: 2 request approve redemption song song cùng 1 con → chỉ 1 thành công, không âm điểm (advisory lock); double-approve assignment → cộng 1 lần (idempotent).

## 8. Phần chưa cần / mở rộng sau (ghi rõ scope)

- Redis/Celery, push/email: **không** giai đoạn 1 (D5).
- Nhiệm vụ lặp lại (Q2), hết hạn điểm (Q5): ngoài scope giai đoạn 1.
- RLS PostgreSQL: khuyến nghị bật lớp 2, không chặn giai đoạn 1 (D2).
- Object storage cho media: đổi `StorageBackend` khi cần (D4).

## 9. Open issues (bàn giao)

Xem tổng hợp cuối `05-build/build-ready.md §7`. Các điểm cần PO chốt trước build vẫn là Q1–Q6 (intake §8) — architecture đã dùng đề xuất mặc định và đánh dấu rõ.
