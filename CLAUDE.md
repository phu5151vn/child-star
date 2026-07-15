# Project Overview

Repo này điều phối agent theo flow docs-first để build **Bé Ngoan** — ứng dụng web quản lý việc nhà & phần thưởng cho gia đình (web frontend + FastAPI backend + Postgres). Đây là dự án độc lập, không theo chuẩn hay reference bên ngoài nào.

## Working Agreements

- Luôn đọc `README.md`, `docs/agent-runbook.md`, `CLAUDE.md`, và `docs/agent-artifacts/` trước khi bắt đầu.
- Không implement code khi chưa có tối thiểu: `00-intake/request.md`, `01-product/prd.md`, `03-architecture/architecture.md`, `04-data/schema.md`, `05-build/build-ready.md`.
- Claude ưu tiên cho docs normalization, architecture/data contracts, review và resolve planning.
- Cursor ưu tiên cho implementation theo build-ready plan.

## Architecture Rules

- Stack đích: web frontend + FastAPI backend + Postgres (+ Redis/Celery nếu cần).
- Frontend không tự quyết business rule nhạy cảm; backend là nơi enforce role, permission và transition constraints.
- Data access phải có layer rõ ràng (router -> service/domain -> repository).
- API contract phải truy vết từ PRD.
- Mọi workflow constraints (required fields, step transition, no-skip, attachment rules) phải được kiểm soát ở backend.

## Data and Security Rules

- Không hardcode secret trong frontend.
- Quản lý auth/role-based access nhất quán với role matrix trong PRD.
- Bảng nghiệp vụ phải có chính sách truy cập rõ ràng (RLS hoặc kiểm soát server-side tương đương).
- Mọi thay đổi config/rules quan trọng cần audit trail.

## Delivery Rules

- Mọi feature phải có loading/empty/error states ở frontend.
- Ưu tiên type-safe và contract-first.
- Khi sửa nhiều file, luôn chạy/đề xuất check phù hợp (lint, typecheck, tests).
- Không mở rộng scope ngoài artifacts đã approved.

## Stage-Gated Execution

- Tuân thủ `docs/agent-runbook.md`.
- Không nhảy stage khi artifacts stage trước chưa đủ.
- Claude tạo/chốt `build-ready.md` trước khi Cursor build.
- Sau build, Claude review và ghi `06-qa/review-report.md`.

## Preferred Skills

- Khi làm kiến trúc/review React web và backend, ưu tiên practices phù hợp với stack hiện hành.
- Khi làm schema/query, ưu tiên các best practices PostgreSQL/Supabase.

## Repository Root Guard

- Repo gốc là thư mục top-level hiện tại, không phải thư mục dưới `.claude/worktrees/`.
- Không tạo/cập nhật artifacts dự án dưới `.claude/`, `.agents/`, hoặc `.claude/worktrees/**`.
