# Bé Ngoan — App việc nhà & phần thưởng cho gia đình

Repo này dùng workflow **manual handoff** giữa **Claude Code** và **Cursor** theo hướng **docs-first** để xây dựng ứng dụng web. Đây là dự án độc lập, **không theo chuẩn hay reference bên ngoài nào**.

## Workflow chuẩn

1. Claude chuẩn hóa `00-intake` từ yêu cầu sản phẩm.
2. Claude chuẩn hóa `01-product` với role/rule chi tiết.
3. Claude chốt flow docs + architecture/data/api + build-ready.
4. Cursor build theo vertical slices trong `implementation-plan`.
5. Claude review, rồi vòng resolve nếu cần.

## Stack mục tiêu

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| UI | Ant Design (hoặc UI kit đã chốt trong artifacts) |
| Backend API | FastAPI + Python |
| ORM | SQLAlchemy + Alembic |
| Queue / Async | Celery + Redis (nếu dùng batch/writeback) |
| Database | PostgreSQL |
| Testing | Pytest + Playwright (hoặc tương đương) |

## Artifact chain bắt buộc

- `docs/agent-artifacts/00-intake/request.md`
- `docs/agent-artifacts/01-product/prd.md`
- `docs/agent-artifacts/02-design/*` (flow/screen/state/component specs)
- `docs/agent-artifacts/03-architecture/architecture.md`
- `docs/agent-artifacts/04-data/schema.md`
- `docs/agent-artifacts/05-build/implementation-plan.md`
- `docs/agent-artifacts/05-build/build-ready.md`
- `docs/agent-artifacts/05-build/build-report.md`
- `docs/agent-artifacts/06-qa/*`

## Verify stage gates

```bash
bash ./scripts/verify-artifacts.sh plan
bash ./scripts/verify-artifacts.sh build
bash ./scripts/verify-artifacts.sh review
```

## Prompt entrypoints

- Claude docs-first: `prompts/claude-stage1-docs-and-stitch-brief.md`
- Claude readiness: `prompts/claude-stage2-normalize-after-stitch.md`
- Cursor build: `prompts/cursor-build-from-approved-plan.md`
- Claude review: `prompts/claude-review-after-build.md`
- Resolve loop:
  - `prompts/claude-generate-resolve-plan.md`
  - `prompts/cursor-resolve-review-issues.md`
  - `prompts/claude-recheck-after-resolve.md`

## Notes

- Không bypass flow docs-first.
- Không build nếu thiếu `build-ready.md`.
- Mọi thay đổi phải bám intake/PRD đã chốt.
