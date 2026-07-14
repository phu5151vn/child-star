# Architecture Draft — Ứng dụng tạo điểm loyalty cho con

> **Draft** cho Stage 3 (chưa phải bản chốt `architecture.md`). Truy vết `01-product/prd.md`. Tuân thủ Architecture Rules trong CLAUDE.md.

## 1. Tổng quan stack

| Layer | Công nghệ |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Ant Design 5 + React Router v6 + TanStack Query |
| Backend | FastAPI (Python) |
| ORM/Migration | SQLAlchemy + Alembic |
| Database | PostgreSQL |
| Async (nếu cần) | Celery + Redis — chỉ dùng nếu phát sinh nhu cầu batch/notification; giai đoạn 1 **không bắt buộc** |
| Storage ảnh | Object storage / thư mục có kiểm soát (ảnh icon, minh chứng) |

## 2. Kiến trúc backend (layered)

Bám rule "router → service/domain → repository":

```
FastAPI router (HTTP, validation, auth guard)
        │
        ▼
Service / domain (business rules: transition, points, unlock, redeem)
        │
        ▼
Repository (SQLAlchemy, truy cập DB, transaction)
        │
        ▼
PostgreSQL
```

- **Router:** xác thực JWT/session, kiểm role, validate schema (Pydantic), gọi service. Không chứa business rule.
- **Service/domain:** nơi enforce toàn bộ rule nhạy cảm PRD §5 (state machine nhiệm vụ, cộng/trừ điểm, mở khóa, đổi thưởng). Chạy trong transaction cho thao tác điểm.
- **Repository:** query/persist, khóa hàng (SELECT ... FOR UPDATE) khi trừ điểm/giảm stock.

## 3. Module chính

| Module | Trách nhiệm | Rule liên quan |
|---|---|---|
| `auth` | đăng nhập bố mẹ (email+mật khẩu), phiên con (PIN), phát token, cô lập `family_id` | PRD §3, §10 |
| `family/users` | quản lý gia đình, tài khoản bố mẹ/con | Q1, Q6 |
| `tasks` | CRUD nhiệm vụ, assignment, state machine | BR-T1..T6 |
| `approvals` | duyệt/từ chối hoàn thành, cộng điểm idempotent | BR-T3, BR-T4 |
| `rewards` | CRUD phần thưởng, tính unlocked/locked theo số dư | BR-R1..R4 |
| `redemptions` | yêu cầu đổi, duyệt, trừ điểm + giảm stock trong transaction | BR-X1..X5 |
| `points/ledger` | ghi ledger append-only, tính số dư | BR-P1..P5 |
| `media` | upload/validate ảnh (MIME, size), phân quyền sở hữu | PRD §7 |

## 4. Enforce phía backend (điểm nhạy cảm)

- **State machine nhiệm vụ:** chuyển trạng thái chỉ qua service; chặn no-skip (BR-T2) và kiểm role (BR-T3).
- **Cộng điểm idempotent:** ghi ledger theo `assignment_id` unique cho loại `task_approved` → bấm duyệt 2 lần không cộng trùng (BR-T4).
- **Trừ điểm an toàn:** transaction + khóa; kiểm tra số dư tại thời điểm duyệt đổi (BR-X3), không cho âm điểm (BR-P3).
- **Cô lập gia đình:** mọi query lọc theo `family_id`; áp **RLS (PostgreSQL)** hoặc kiểm soát server-side tương đương (theo Data Rules).
- **Audit:** ledger append-only; điều chỉnh thủ công có lý do; log thay đổi cấu hình quan trọng.

## 5. API contract (định hướng — chốt ở Stage 3)

Ví dụ nhóm endpoint (REST, versioned `/api/v1`):
- `POST /auth/login`, `POST /auth/child-session`
- `GET/POST/PUT/DELETE /tasks`, `POST /tasks/{id}/assign`, `POST /assignments/{id}/submit`
- `POST /assignments/{id}/approve`, `POST /assignments/{id}/reject`
- `GET/POST/PUT/DELETE /rewards`
- `POST /rewards/{id}/redeem` (tạo request), `POST /redemptions/{id}/approve|reject`
- `GET /children/{id}/balance`, `GET /children/{id}/ledger`

Mọi endpoint truy vết được về use case PRD §8. Response có mã lỗi rõ ràng cho FE render state (điểm không đủ, hết hàng, sai role...).

## 6. Frontend

- Route guard theo role (`navigation.json`); shell riêng cho parent/child.
- TanStack Query cho fetch/mutation; invalidate điểm+ledger+hàng đợi khi có duyệt.
- Theme game-like qua `ConfigProvider` (design tokens). Không tin client cho rule nhạy cảm.

## 7. Vấn đề mở cho Stage 3

- Chốt cơ chế auth cho con (PIN vs mã gia đình) — Q6.
- Chốt RLS vs service-side isolation.
- Chốt lưu trữ ảnh (local vs object storage) và chính sách truy cập ảnh minh chứng.
- Có cần Redis/Celery không (giai đoạn 1 dự kiến không).
