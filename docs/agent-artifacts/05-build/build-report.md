# Build Report — Ứng dụng tạo điểm loyalty cho con ("Bé Ngoan")

> Stage 4 Build hoàn tất theo `implementation-plan.md` (slices 0–6). Truy vết `build-ready.md`, PRD, architecture, schema.

## 1. Tóm tắt đã build

Ứng dụng web gamification điểm thưởng cho gia đình với 2 role **parent** và **child**, backend FastAPI layered, frontend React + Ant Design 5 theo design tokens Stitch "Bé Ngoan Playful".

### Vertical slices đã triển khai

| Slice | Nội dung | Trạng thái |
|---|---|---|
| 0 | Foundation: docker-compose, FastAPI skeleton, Vite+React+AntD, theme tokens | ✅ |
| 1 | Auth: register/login parent, child profiles+PIN, JWT, RoleRoute | ✅ |
| 2 | Tasks CRUD (parent), list cho child | ✅ |
| 3 | Claim/submit/approve/reject assignments, ledger, balance | ✅ |
| 4 | Rewards CRUD, locked/unlocked teaser + missing_points | ✅ |
| 5 | Redeem + approve/reject redemption, trừ điểm an toàn | ✅ |
| 6 | Media upload/serve, manual_adjust, audit_log | ✅ |

## 2. Endpoint đã implement (`/api/v1`)

### Auth & identity
- `POST /auth/register`, `/auth/parent/login`, `/auth/child/profiles`, `/auth/child/login`
- `GET /me`

### Family & children
- `GET /family`, `/children`, `POST /children`, `PATCH /children/{id}`
- `GET /children/{id}/balance`, `/children/{id}/ledger`
- `POST /children/{id}/adjust`

### Tasks & assignments
- `GET/POST/PUT/DELETE /tasks`, `GET /tasks/{id}`
- `POST /tasks/{id}/claim`
- `GET /assignments`, `POST /assignments/{id}/submit|approve|reject`

### Rewards & redemptions
- `GET/POST/PUT/DELETE /rewards`, `GET /rewards/{id}`
- `POST /rewards/{id}/redeem`
- `GET /redemptions`, `POST /redemptions/{id}/approve|reject|cancel`

### Media
- `POST /media`, `GET /media/{id}`

## 3. Màn hình frontend (theo `navigation.json`)

| Route | Mô tả |
|---|---|
| `/login`, `/profiles` | Đăng nhập bố mẹ / chọn hồ sơ con + PIN |
| `/parent` | Dashboard tổng quan |
| `/parent/tasks`, `/parent/tasks/new`, `/:id/edit` | Quản lý nhiệm vụ |
| `/parent/rewards`, `/parent/rewards/new`, `/:id/edit` | Quản lý phần thưởng |
| `/parent/approvals` | Duyệt hoàn thành nhiệm vụ |
| `/parent/redemptions` | Duyệt đổi thưởng |
| `/parent/children`, `/parent/children/:id` | Quản lý con & sổ điểm |
| `/child` | Dashboard con (điểm + mốc gần nhất) |
| `/child/tasks`, `/child/tasks/:id` | Danh sách & chi tiết nhiệm vụ |
| `/child/rewards` | Kho thưởng (unlocked + locked teaser) |
| `/child/history` | Lịch sử điểm |

Mọi màn danh sách có **loading / empty / error** qua component `PageState`.

## 4. Business rules enforce backend

- Phân quyền parent-only / child-only qua dependency `require_role`
- State machine assignment: no-skip, idempotent approve (+ledger một lần)
- Balance derived từ `points_ledger` (append-only)
- Reward `is_unlocked` + `missing_points` tính runtime (teaser R6)
- Redemption approve: advisory lock (PostgreSQL), kiểm tra balance tại duyệt, giảm stock
- `audit_log` cho CRUD task/reward/child/adjust
- Cô lập `family_id` từ JWT claim

## 5. Cách chạy local

Xem `RUN.md`. Tóm tắt:

```bash
docker compose up -d
cd backend && python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && python seed.py
uvicorn app.main:app --reload --port 8000

cd frontend && npm install && npm run dev
```

**Demo seed:** `parent@demo.com` / `demo1234`, family code `DEMO01`, PIN Bé An `1234`.

## 6. Tests

```bash
cd backend && pytest -v   # 4 integration tests pass (SQLite in-memory)
cd frontend && npm run build   # TypeScript + Vite build pass
```

## 7. TODO / hạn chế còn lại

1. **Alembic migrations** — hiện dùng `Base.metadata.create_all` + `seed.py`; cần bổ sung Alembic migration chính thức cho production.
2. **PostgreSQL advisory lock** — chỉ hoạt động trên PostgreSQL; SQLite dev/test bỏ qua lock (đủ cho dev).
3. **Upload ảnh UI** — API `/media` có; form task/reward và proof upload trên màn con chưa gắn component `ProofUpload` đầy đủ.
4. **E2E Playwright** — chưa scaffold (optional trong plan).
5. **Rate-limit login** — ghi trong architecture, chưa implement.
6. **RLS PostgreSQL** — optional lớp 2, chưa bật.
7. **Illustration Stitch assets** — chưa nhúng PNG từ `02-design/stitch-assets/` vào empty states (dùng Ant Design `Empty` mặc định).
8. **Partial unique indexes** — schema định nghĩa trong docs; chưa tạo migration SQL riêng (enforce một phần ở service layer).

## 8. Deviation ghi nhận

- Không sửa intake/PRD.
- Parent dashboard tái dùng layout S7 như ghi trong `build-ready.md §7`.
- `reject` assignment tạo assignment `in_progress` mới để con làm lại (khớp BR-T5).

## 9. Cấu trúc code

```
backend/app/          # routers → services → repositories/models
frontend/src/         # layouts, components, features, api, theme
docker-compose.yml    # PostgreSQL 15
RUN.md                # hướng dẫn chạy
```
