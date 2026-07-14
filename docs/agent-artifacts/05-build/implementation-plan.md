# Implementation Plan — Ứng dụng tạo điểm loyalty cho con ("Bé Ngoan")

> Kế hoạch build theo **vertical slices** cho Cursor (Stage 4). Truy vết `03-architecture/architecture.md`, `04-data/schema.md`, `01-product/prd.md`, `02-design/*`. Mỗi slice là 1 lát cắt dọc (DB → service → API → FE) có thể chạy & test được.

## 0. Nguyên tắc build

- Contract-first, type-safe: định nghĩa Pydantic schema (BE) + TypeScript types (FE) khớp API `architecture.md §3`.
- **Rule nhạy cảm chỉ ở backend** (service layer). FE không tự quyết điểm/quyền/mở khóa.
- Mỗi slice kèm test tương ứng (unit rule + integration API); không đóng slice khi rule chưa có test.
- Mọi màn FE có đủ **loading / empty / error** ngay từ slice đầu (dùng `PageState`).
- Không mở rộng ngoài artifacts đã approved.

## 1. Cấu trúc repo đề xuất

```
backend/
  app/
    main.py                     # FastAPI app, CORS, error handlers
    core/                       # config, security(JWT/bcrypt), db(session), deps(require_role)
    models/                     # SQLAlchemy models (families,users,tasks,assignments,rewards,redemptions,ledger,media,audit_log)
    schemas/                    # Pydantic v2 request/response
    repositories/               # truy cập DB, scope family_id, khóa
    services/                   # business rules (auth,tasks,assignments,rewards,redemptions,points,media,audit)
    routers/                    # /api/v1/* endpoints
    alembic/                    # migrations
  tests/                        # pytest: unit/ + integration/
frontend/
  src/
    app/                        # main, router, ThemeProvider(ConfigProvider), queryClient
    layouts/                    # ParentLayout, ChildLayout, RoleRoute
    components/                 # PageState, PointsBadge, RewardCard, TaskCard, ... (component-inventory)
    features/                   # auth, tasks, rewards, approvals, redemptions, ledger, children (hooks TanStack Query + pages)
    api/                        # client fetch + generated types khớp contract
    theme/                      # tokens Stitch "Bé Ngoan Playful"
```

## 2. Slices (thứ tự khuyến nghị)

### Slice 0 — Nền tảng (foundation)
- BE: FastAPI skeleton, config, DB session, Alembic init, error-handler map `error_code`→HTTP, health check.
- DB: migration khởi tạo toàn bộ bảng + index + CHECK + partial unique (schema §2), extension `pgcrypto`+`citext`; seed dev (§6 schema).
- FE: Vite + React + TS + AntD + React Router + TanStack Query; `AppThemeProvider` với tokens Stitch; `RoleRoute`, `PageState`.
- **DoD**: app chạy, migrate được, seed được, FE render shell rỗng theo role.

### Slice 1 — Auth & danh tính (2 role)
- BE: `/auth/register`, `/auth/parent/login`, `/auth/child/profiles`, `/auth/child/login`, `/me`; JWT (claim role/family_id/child_id); bcrypt password & PIN; dependency `require_role`.
- FE: S0 `/login` (parent) + `/profiles` (chọn avatar con + `PinInput`); guard redirect theo role (`navigation.json`).
- Test: login đúng/sai; token claim đúng; child không truy cập endpoint parent (403 `FORBIDDEN_ROLE`); cô lập family.
- **Rule**: PRD §3, §4, §10; D1.

### Slice 2 — Nhiệm vụ (parent CRUD) + list cho con
- BE: `/tasks` CRUD (parent-only tạo/sửa/xóa, ghi `audit_log`); `GET /tasks` role-aware; CHECK `points>0`.
- FE: S2 quản lý nhiệm vụ (`TaskCard`, FAB), S3 form (`TaskForm`: title*, points* stepper, require_proof, active) với validation; S10 list nhiệm vụ cho con.
- Test: points≤0 hoặc thiếu title → 422; con không tạo được task (403); audit ghi đúng.
- **Rule**: R3, R4, PRD §6.1.

### Slice 3 — Assignment + points ledger + duyệt (lõi nghiệp vụ)
- BE: `/tasks/{id}/claim`, `/assignments/{id}/submit|approve|reject`; state machine + no-skip; ghi ledger `task_approved` **idempotent**; `GET /children/{id}/balance`, `/ledger`.
- FE: S11 chi tiết & nhận/hoàn thành (+`ProofUpload` nếu require_proof, `TaskStatusSteps`); S6 duyệt hoàn thành (`ApprovalQueueItem`, duyệt/từ chối, toast "+N sao"); S13 lịch sử điểm; S9 dashboard con (`PointsBadge`, `PointsProgress`), confetti khi được duyệt.
- Test (quan trọng): transition hợp lệ/không (no-skip `available→approved` bị chặn); double-approve → cộng 1 lần (idempotent); reject không cộng; balance = SUM(ledger).
- **Rule**: BR-T1..T6, BR-P1..P5.

### Slice 4 — Phần thưởng + mở khóa (teaser locked/unlocked)
- BE: `/rewards` CRUD (parent); `GET /rewards` cho con trả `is_unlocked` + `missing_points` (hiện cả locked — R6); CHECK `required_points>0`, `stock>=0`.
- FE: S4/S5 quản lý & form reward; S12 kho thưởng con với `RewardCard` (auto unlocked/locked/out-of-stock), `LockOverlay` + "Còn thiếu N sao", `PointsProgress` tới mốc gần nhất.
- Test: reward chưa đủ điểm vẫn trả về + `missing_points` đúng; unlocked khi balance≥required.
- **Rule**: BR-R1..R4, R5, R6.

### Slice 5 — Đổi thưởng (redemption + trừ điểm an toàn)
- BE: `/rewards/{id}/redeem` (chỉ unlocked & còn stock), `/redemptions/{id}/approve|reject`, `/redemptions/{id}/cancel`; approve chạy txn + `pg_advisory_xact_lock` + check balance tại thời điểm duyệt + giảm stock + ledger `reward_redeemed` idempotent.
- FE: S5/S12 nút "Đổi ngay" (chỉ bật khi unlocked; message "cần thêm N điểm" nếu state cũ), confetti mở hộp quà khi thành công; S7 duyệt đổi thưởng (`RedemptionQueueItem`), lỗi `INSUFFICIENT_POINTS` hiển thị "số dư con không còn đủ".
- Test (race condition): 2 approve song song cùng con → 1 thành công, không âm điểm; đổi khi thiếu điểm → `INSUFFICIENT_POINTS`; hết stock → `OUT_OF_STOCK`.
- **Rule**: BR-X1..X5, BR-P3.

### Slice 6 — Media + manual adjust + hoàn thiện
- BE: `/media` upload (validate MIME+magic bytes+size) & `GET /media/{id}` (auth+ownership); `/children/{id}/adjust` (manual_adjust, advisory lock nếu âm, `reason` bắt buộc, audit).
- FE: gắn upload icon/ảnh (task/reward form), ảnh minh chứng (submit), avatar con; `ManualAdjustModal`; S8 parent xem con & sổ điểm; hoàn thiện empty/error toàn bộ màn theo `states.md`.
- Test: upload sai MIME/size bị từ chối; con không xem được media family khác; manual_adjust ghi ledger + audit; adjust âm quá balance → `INSUFFICIENT_POINTS`.
- **Rule**: PRD §7, BR-P2, BR-P5, D6.

### Slice 7 — QA & polish
- E2E (Playwright, tùy chọn) 2 luồng chính: parent tạo task→duyệt→điểm tăng; con làm→đổi thưởng→điểm giảm.
- Kiểm accessibility cơ bản, responsive (mobile-first con, desktop parent), gamified feedback (confetti tắt được).
- Rà lại loading/empty/error mọi màn; kiểm cô lập family end-to-end.

## 3. Bản đồ slice ↔ màn hình ↔ endpoint (tóm tắt)

| Slice | Màn (web / Stitch) | Endpoint chính |
|---|---|---|
| 1 | S0 / Stitch S1 | `/auth/*`, `/me` |
| 2 | S2,S3,S10 / Stitch S8a,S8b,S2 | `/tasks*` |
| 3 | S6,S9,S11,S13 / Stitch S3,S6,S7 | `/tasks/{id}/claim`, `/assignments/*`, `/children/{id}/balance\|ledger` |
| 4 | S4,S5,S12 / Stitch S9a,S9b,S4,S5 | `/rewards*` |
| 5 | S5,S7,S12 / Stitch S5,S7 | `/rewards/{id}/redeem`, `/redemptions/*` |
| 6 | S8 + form uploads / Stitch S7,S8b,S9b | `/media*`, `/children/{id}/adjust` |

Chi tiết mapping màn ↔ asset Stitch: `05-build/build-ready.md §2`.

## 4. Definition of Done (mỗi slice)

- API khớp contract `architecture.md §3`; Pydantic + TS types đồng bộ.
- Rule nhạy cảm có unit test; API có integration test (kèm phân quyền + cô lập family).
- Màn FE có loading/empty/error; lỗi domain map đúng thông điệp thân thiện.
- Lint + typecheck (FE: eslint+tsc; BE: ruff/mypy nếu cấu hình) pass.
- Không rò rỉ dữ liệu nhạy cảm trẻ em; audit/ledger ghi đúng.
