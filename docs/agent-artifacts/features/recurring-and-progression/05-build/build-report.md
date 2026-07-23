# Build Report — Nhiệm vụ lặp lại & Tiến trình (Streak · Huy hiệu · Cấp độ)

> **Kết quả Stage 4 (Build) cho increment.** Truy vết `./build-ready.md`, `../03-architecture/architecture.md`, `../04-data/schema.md`, `../01-product/prd.md`. Build chạy bằng 2 lane song song (backend + frontend) trên git worktree cô lập, mỗi lane theo flow **build → review → verify**; sau đó merge vào `main` và re-verify trên tree tích hợp.

## 1. Tổng quan & verdict

| Hạng mục | Kết quả |
|---|---|
| Backend lane | ✅ `pytest` 45/45 pass (gồm race streak trên Postgres) |
| Frontend lane | ✅ `tsc + vite build` pass, `eslint` sạch |
| Merge vào `main` | ✅ sạch, không xung đột (scope tách rời) |
| Re-verify sau merge | ✅ backend 45/45; frontend build ✓ + lint sạch |
| Scope isolation | ✅ backend chỉ `backend/`, frontend chỉ `frontend/`, không overlap |

Commit trên `main`: `24aac09` (merge backend), `02c552b` (merge frontend).

## 2. Backend (lane `backend/`)

### File tạo mới
- `app/core/progression_rules.py` — hằng số + pure functions: `LEVEL_THRESHOLDS [0,100,250,500,1000,2000]`, `STREAK_MILESTONES [3,7,14,30]`, `STREAK_BONUS {3:5,7:15,14:30,30:80}`, `BADGE_SEED` (11 huy hiệu); `level_for`, `next_threshold`, `next_streak_milestone`. (BR-PG-3, BR-PG-9)
- `app/services/streak_service.py` — pure `compute_current_streak`/`compute_longest_streak` (architecture §2.2) + `maybe_award_streak_bonus` (award-first → ledger, idempotent 2 lớp). (BR-PG-6..10)
- `app/services/progression_service.py` — `get_progression`, `evaluate_badges`, `list_badges`, `me_summary`, `_compute_metrics` (derive-first). (BR-PG-1..14)
- `alembic/versions/0006_progression.py` — 3 bảng mới + mở rộng `ck_ledger_kind` + seed 11 badges + bật RLS.
- `tests/test_progression.py` (15 test), `tests/test_progression_race.py` (1 test, Postgres).

### File sửa
- `app/models/__init__.py` — `Badge`/`ChildBadge`/`StreakMilestoneAward`, mở rộng CHECK `ck_ledger_kind` thêm `streak_bonus`, seed badges qua event `after_create` (dev/test).
- `app/repositories/base.py` — `ProgressionRepository` (lifetime_points, count_tasks_approved, active_days giờ VN, count_rewards_redeemed, count_weekly_hits, earned_badges, awarded_milestones) — scope `family_id`. (AD1)
- `app/services/task_service.py::AssignmentService.approve` — `level_before` (đọc trước khi ghi ledger) → weekly → streak → evaluate_badges → `level_after` → gắn `progression_events`. (architecture §2.1)
- `app/services/reward_service.py::approve` — gọi `evaluate_badges` sau đổi thưởng. (BR-PG-13)
- `app/services/auth_service.py::me` — con kèm `level` + `current_streak`.
- `app/routers/api.py` — `GET /children/{id}/progression`, `GET /badges`.
- `app/schemas/__init__.py` — `LevelInfo/StreakInfo/BadgeInfo/BadgeCatalogItem/ProgressionEvents/ProgressionResponse`; `AssignmentResponse.progression_events`; `MeResponse.level/current_streak`.
- `app/core/timeutil.py` — `to_vn_date`.

### Review (đã tự soát + fix)
- **Advisory lock nhả giữa các commit của `approve`** → mỗi sub-service tự re-acquire lock + backstop `UNIQUE(child_id, milestone)` / `UNIQUE(child_id, badge_code)`. Race test Postgres xác nhận đúng 1 dòng `streak_bonus`. (BR-PG-10)
- **Idempotency đa-DB**: `is_unique_violation` khớp theo constraint (Postgres) không áp được cho SQLite → thêm pre-check tuần tự (`awarded_milestones`, `earned` set) để dedup mọi DB; try/except unique chỉ là lưới an toàn cho race.
- **Không lạm phát điểm (AD6)**: level-up/badge chỉ INSERT bảng sự kiện, không ghi ledger → test xác nhận `balance == điểm task`. `lifetime_points` chỉ tính `delta>0` → đổi thưởng **không tụt level** (test xác nhận).
- **Isolation**: repo scope `family_id`; con đọc con khác → 403; parent khác family → 404 (có test).

### Verify (output thật)
- `python -m pytest -q` (`.venv` Python 3.12): **45 passed** (baseline 29 + 16 mới), gồm race streak Postgres (ephemeral, không skip).
- Migration thật trên Postgres 15: `upgrade 0005 → head` OK; dòng `task_approved` cũ nguyên; 11 badges seed; CHECK gồm `streak_bonus`; INSERT `streak_bonus` OK.

## 3. Frontend (lane `frontend/`)

### File tạo mới
- `src/features/progression/queries.ts` — `useProgression(childId)`, `useBadges()`, keys `progressionKey`/`badgesKey`.
- `src/components/LevelRing.tsx`, `StreakFlame.tsx`, `BadgeCard.tsx`, `BadgeShelf.tsx`.

### File sửa
- `src/api/client.ts` — types khớp §3.1: `LevelInfo/StreakInfo/BadgeInfo/Progression/BadgeCatalogItem/ProgressionEvents/ApproveAssignmentResult/BadgeCriteriaType` (không `any`).
- `src/components/TaskCard.tsx` — nhãn chu kỳ (Một lần / Hằng ngày 🔁 / Hằng tuần 📅) + trạng thái "Hôm nay/Tuần này đã xong — làm tiếp" (BR-RC-3).
- `src/components/CelebrationFx.tsx` — `celebrateProgression(events)` tôn trọng `isCelebrationEnabled`, confetti mạnh hơn khi level-up.
- `src/components/LedgerTimeline.tsx` — nhãn kind `weekly_bonus`, `streak_bonus`.
- `src/features/child/ChildPages.tsx` — `ChildJourneyPage` ("Hành trình của con") + `StatLine` (🏅 tổng tích lũy / ⭐ tiêu được), sắp badges theo `sort_order` từ `/badges`, banner khích lệ khi chưa có huy hiệu.
- `src/layouts/ChildLayout.tsx` — tab "Hành trình" + chip Lv.N và 🔥streak trên top bar.
- `src/features/parent/ParentChildrenPage.tsx` — `ChildProgressionSummary` mỗi con (level + streak + số huy hiệu), Skeleton loading.
- `src/features/parent/ParentApprovalsPage.tsx` — approve đọc `progression_events` → ăn mừng; invalidate `['progression']` sau approve/redeem.
- `src/app/router.tsx` — route `/child/journey`.
- i18n vi/en: `common`, `child`, `components`, `parent`.

### Review (đã tự soát + fix)
- Types khớp §3.1, nullable đúng (`next_min`, `next_milestone`, `days_to_next`, badge `current/threshold`), không `any`.
- 3 state mọi màn: journey dùng `PageState` (Skeleton + Result/Thử lại); empty = Alert khích lệ khi 0 huy hiệu + `Empty` fallback.
- earned vs locked phân biệt rõ (gradient vàng vs xám + 🔒 + progress).
- Invalidate `['progression']` sau approve/redeem; `CelebrationFx` tôn trọng cấu hình tắt hiệu ứng.
- Con chỉ thấy tiến trình mình (dùng `me.child_id`; enforce thật ở backend). Không hardcode URL/secret.
- Fix nhỏ: bỏ `Text` thừa ở `ParentChildrenPage` (lint unused).

### Verify (output thật)
- `npm run build` (`tsc -b && vite build`): **pass** (~24s; chỉ cảnh báo chunk >500 kB có sẵn từ trước, không phải lỗi).
- `npm run lint` (`eslint .`): **pass**, không lỗi/cảnh báo.

## 4. Khớp contract giữa 2 lane

BE trả đúng shape architecture §3.1: `GET /children/{id}/progression`, `GET /badges`, `progression_events` trong `POST /assignments/{id}/approve`, `/me` kèm `level`+`current_streak`. FE tiêu thụ đúng các type này. Vì FE build theo contract tài liệu hóa (không chờ BE), tích hợp chạy chung khớp mà không cần sửa 2 phía.

## 5. Còn mở (bàn giao — không chặn merge)

- **Backfill huy hiệu dữ liệu cũ** (build-ready §7): chưa có CLI chạy `evaluate_badges` hàng loạt; huy hiệu quá khứ vẫn được cấp ở lần duyệt kế tiếp.
- **Test weekly-reopen riêng** (BR-RC-5): daily reopen/block đã có test; weekly dùng chung `is_completed_current_period` (tương đương) nhưng chưa có test riêng.
- **Unit test FE**: repo chưa có hạ tầng test FE; verify hiện qua typecheck + lint + build.
- **Môi trường dev**: backend cần Python ≥3.10 (đã có `backend/.venv` 3.12 để chạy).
- **Downgrade migration 0006→0005** chỉ khả thi khi chưa có dữ liệu `streak_bonus` (bản chất thu hẹp CHECK) — forward path deploy đã xác nhận sạch.
- **Q-A..Q-E**: dùng default trong artifact; PO chốt trước khi khóa scope.

## 6. Next step (theo runbook)

1. Claude review code + artifact → phát hành `../06-qa/review-report.md` (feature) và resolve plan nếu có.
2. Resolve loop nếu cần, rồi chốt verdict.
