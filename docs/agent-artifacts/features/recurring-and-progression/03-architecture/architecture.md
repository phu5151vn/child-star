# Architecture — Nhiệm vụ lặp lại & Tiến trình (Streak · Huy hiệu · Cấp độ)

> **Increment trên kiến trúc "Bé Ngoan" đã chốt.** Truy vết `../00-intake/request.md`, `../01-product/prd.md`, và kế thừa `docs/agent-artifacts/03-architecture/architecture.md` (layered router→service→repository, JWT claim, advisory lock, ledger append-only). Chỉ mô tả **phần thêm/đổi**; mọi thứ khác giữ nguyên.

## 0. Quyết định kiến trúc (chốt cho increment)

| # | Vấn đề | Quyết định | Rule |
|---|---|---|---|
| AD1 | Lưu hay derive tiến trình? | **Derive** level, streak, và mọi metric huy hiệu từ dữ liệu gốc (`points_ledger`, `task_assignments`, `reward_redemptions`, `weekly_bonus_awards`). Không tạo bảng "counter" làm nguồn đúng. Chỉ **lưu sự kiện đã trao** (huy hiệu đã đạt, mốc streak đã thưởng) để **idempotency** — bản thân chúng cũng append-only. | BR-PG-14, AD1 |
| AD2 | Reset chu kỳ nhiệm vụ | Giữ **lazy** như hiện tại (`_child_assignment_state` + `is_completed_current_period`), **không** thêm scheduler. | BR-RC-1..2, D5 gốc |
| AD3 | Thưởng streak khi nào | Tính **đồng bộ trong luồng `approve` nhiệm vụ**, ngay sau khi ghi điểm task, theo đúng pattern `WeeklyService.maybe_award_bonus` đã có. Không job nền. | BR-PG-10 |
| AD4 | Ngưỡng level & mốc streak & định nghĩa huy hiệu | Giai đoạn 1 là **hằng số/seed hệ thống** trong code + bảng `badges` seed (không theo `family_id`). Cho phép chuyển sang cấu hình theo family ở increment sau mà không phá ledger. | Q-E, BR-PG-3 |
| AD5 | Bonus streak & ledger | Thêm `kind='streak_bonus'` vào `points_ledger` (mở rộng CHECK). Idempotency KHÔNG dựa vào unique-index trên ledger (ledger không có cột milestone) mà dựa vào **bảng `streak_milestone_awards` UNIQUE(child_id, milestone)** — chèn award trước, thành công mới ghi ledger, cùng transaction. | BR-PG-9 |
| AD6 | Level-up không cộng điểm | Level & badge **thuần cosmetic**; chỉ streak-milestone cộng sao. Tránh lạm phát điểm đổi thưởng. | BR-PG-5, BR-PG-13, Q-B |
| AD7 | Múi giờ | Tái dùng `core/timeutil.py` (UTC+7) cho ranh giới "ngày hoạt động" của streak, nhất quán với recurrence. | BR-PG-6 |

## 1. Module thêm/đổi (backend, layered)

| Module | Loại | Trách nhiệm | Rule |
|---|---|---|---|
| `services/progression_service.py` | **mới** | Tính `lifetime_points`, `level`, `current/longest streak`, metrics huy hiệu; đánh giá & cấp huy hiệu (idempotent); tổng hợp response tiến trình. Không chứa HTTP. | BR-PG-1..14 |
| `services/streak_service.py` *(hoặc gộp vào progression)* | **mới** | Tính streak từ tập ngày `approved`; `maybe_award_streak_bonus(child)` — cùng pattern weekly. | BR-PG-6..10 |
| `core/progression_rules.py` | **mới** | Hằng số: `LEVEL_THRESHOLDS`, `STREAK_MILESTONES`, hàm `level_for(lifetime)`, `next_threshold(...)`. Pure functions → dễ unit test. | BR-PG-3, BR-PG-9 |
| `repositories` | **mở rộng** | Query metric: `count_tasks_approved(child)`, `lifetime_points(child)`, `distinct_active_days(child)`, `count_rewards_redeemed(child)`, `count_weekly_hits(child)`; insert award idempotent. Luôn scope `family_id`. | AD1 |
| `services/task_service.py::AssignmentService.approve` | **đổi** | Sau `WeeklyService.maybe_award_bonus(...)`, gọi `StreakService.maybe_award_streak_bonus(...)` rồi `ProgressionService.evaluate_badges(...)`; thu thập sự kiện phát sinh để trả về (level-up so sánh trước/sau). | BR-PG-10, BR-PG-13, BR-PG-15 |
| `services/reward_service.py::approve` | **đổi (nhẹ)** | Sau khi đổi thưởng thành công, gọi `ProgressionService.evaluate_badges(child)` (cho `rewards_redeemed_total`). | BR-PG-13 |
| `models`, `ddl` | **mở rộng** | 3 bảng mới (xem `../04-data/schema.md`); mở rộng CHECK ledger kind. | AD5 |
| `routers/api.py` | **mở rộng** | Endpoint tiến trình + catalog huy hiệu (xem §3). | §3 |
| `schemas` | **mở rộng** | `ProgressionResponse`, `LevelInfo`, `StreakInfo`, `BadgeInfo`, `BadgeCatalogItem`; mở rộng `AssignmentResponse` với khối `progression_events`. | BR-PG-15 |

**Nguyên tắc giữ nguyên:** router chỉ HTTP + guard; rule ở service; repository scope `family_id` từ token; điểm luôn qua `points_ledger`; trừ/bonus điểm trong transaction có `advisory_lock_child`.

## 2. Luồng nghiệp vụ chính

### 2.1 Duyệt nhiệm vụ → cập nhật tiến trình (mở rộng approve hiện có)
```
approve(assignment):
  advisory_lock_child(child)              # đã có
  ... ghi ledger task_approved (idempotent) ...   # đã có
  level_before = level_for(lifetime_points(child)) # đọc trước khi thêm bonus
  WeeklyService.maybe_award_bonus(...)    # đã có (weekly_bonus)
  StreakService.maybe_award_streak_bonus(child):    # MỚI
     days   = distinct_active_days(child) (giờ VN)
     streak = compute_current_streak(days)
     for M in STREAK_MILESTONES if streak >= M:
        try: insert streak_milestone_awards(child, M)   # UNIQUE chặn trùng
             insert points_ledger(kind='streak_bonus', delta=BONUS[M])
             events.streak_milestone_reached = M
        except unique_violation: pass    # đã thưởng trước đó → bỏ qua
  ProgressionService.evaluate_badges(child) -> events.newly_earned_badges  # MỚI
  level_after = level_for(lifetime_points(child))
  events.level_up = level_after if level_after > level_before else None
  return AssignmentResponse + progression_events(events)
```
- Tất cả trong phạm vi lock của con (đã mở đầu `approve`) + transaction → an toàn khi 2 request song song (BR-PG-10).
- Idempotency 2 lớp: (a) ledger task_approved unique theo assignment (đã có); (b) streak bonus unique theo (child, milestone); (c) badge unique theo (child, badge_code).

### 2.2 Tính streak (pure, testable)
```
active_days = { decided_at.astimezone(VN).date()
                for a in assignments where child=?, status='approved' }
current_streak:
  anchor = today_vn if today_vn in active_days else today_vn - 1day
  if anchor not in active_days: return 0
  d = anchor; n = 0
  while d in active_days: n += 1; d -= 1day
  return n
longest_streak: quét chuỗi liên tiếp dài nhất trong active_days
```

### 2.3 Đánh giá huy hiệu (idempotent)
```
evaluate_badges(child):
  metrics = { tasks_approved_total, points_earned_total, longest_streak,
              rewards_redeemed_total, weekly_goal_hits }
  earned = set(child_badges.code where child)
  for b in badges (seed):        # chỉ đọc definitions hệ thống
     if b.code not in earned and metrics[b.criteria_type] >= b.threshold:
        try: insert child_badges(child, b.code); newly.append(b)
        except unique_violation: pass
  return newly
```

## 3. API contract (thêm — REST `/api/v1`, kế thừa quy ước lỗi & quyền gốc)

| Method | Path | Quyền | Mô tả | Rule |
|---|---|---|---|---|
| GET | `/children/{child_id}/progression` | P / C(own) | Trả `level`, `lifetime_points`, `balance`, `streak`, `badges[]` (đạt + chưa đạt kèm tiến độ) | BR-PG-1..14 |
| GET | `/badges` | any auth | Catalog định nghĩa huy hiệu hệ thống (để hiển thị teaser & tra cứu) | BR-PG-12 |
| GET | `/me` | any | (mở rộng) với child: kèm `level`, `current_streak` tóm tắt cho top bar | BR-PG-2 |

- **Không** có endpoint POST/PUT cho tiến trình — tiến trình là kết quả suy ra + hệ thống tự cấp (AD1).
- **`POST /assignments/{id}/approve`** (đã có) mở rộng payload response: thêm `progression_events: { level_up?: LevelInfo, streak_milestone_reached?: int, newly_earned_badges: BadgeInfo[] }` để FE ăn mừng (BR-PG-15). Không đổi request.
- Lỗi: dùng mã domain hiện có; con truy cập tiến trình con khác → `FORBIDDEN_ROLE`/404 theo pattern `require_owner_child`.

### 3.1 Hình dạng `GET /children/{id}/progression`
```jsonc
{
  "child_id": "…",
  "lifetime_points": 320,
  "balance": 140,
  "level": { "level": 3, "title": "Ngôi Sao Nhỏ", "icon": "⭐",
             "min_points": 250, "next_min": 500,
             "points_to_next": 180, "progress_pct": 28 },
  "streak": { "current": 5, "longest": 9, "active_today": true,
              "next_milestone": 7, "days_to_next": 2 },
  "badges": [
    { "code": "first_task", "title": "Khởi đầu", "icon": "🎉",
      "description": "Hoàn thành nhiệm vụ đầu tiên",
      "earned": true, "earned_at": "2026-07-14T…", "progress_pct": 100 },
    { "code": "tasks_10", "title": "Chăm chỉ", "icon": "💪",
      "description": "Hoàn thành 10 nhiệm vụ",
      "earned": false, "earned_at": null, "progress_pct": 70,
      "current": 7, "threshold": 10 }
  ]
}
```

## 4. Frontend (kiến trúc — kế thừa 2 shell theo role)

- **Màn con mới `/child/journey` ("Hành trình của con")**: 3 khối — **Level ring** (tái dùng/`PointsProgress` mở rộng), **Streak flame** (🔥 + số ngày + mốc kế), **Badge shelf** (grid huy hiệu, đạt sáng / chưa đạt mờ + `Progress`). Thêm mục vào bottom-tab `ChildLayout`.
- **Top bar `ChildLayout`**: thêm chip **Lv.N** + **🔥streak** cạnh `PointsBadge` (từ `/me` mở rộng).
- **Parent**: trong `ParentChildrenPage`, mỗi con hiển thị badge cấp độ + streak + số huy hiệu (gọi `/children/{id}/progression`).
- **Data (TanStack Query)**: query key `['progression', childId]`, `['badges']`. **Invalidate `progression` (+ `balance`,`ledger`)** sau mutation `approve`/`redeem`. Dùng `progression_events` trả về từ `approve` để kích hoạt `CelebrationFx` (level-up / badge / streak) — không cần refetch mới ăn mừng.
- **Component mới**: `LevelRing`, `StreakFlame`, `BadgeCard` (earned/locked), `BadgeShelf`. Tái dùng `PageState`, `CelebrationFx`, `PointsProgress`.
- **States**: loading (Skeleton), empty (chưa có huy hiệu → khích lệ), error (Result + Thử lại). Nhãn recurrence trên `TaskCard` (F1, BR-RC-3).

## 5. Bảo mật & tuân thủ

- `require_owner_child` cho con đọc tiến trình của mình; parent scope `family_id` (như endpoint children hiện có).
- Bonus streak: append-only ledger + `streak_milestone_awards` idempotent; `created_by` = parent duyệt (actor). Audit qua ledger.
- `/badges` chỉ trả **định nghĩa** (không PII); `progression` chỉ trả dữ liệu chơi.
- Không mở rộng bề mặt tấn công: không endpoint ghi tiến trình từ client.

## 6. Ảnh hưởng & rủi ro

- **Hiệu năng:** metric dùng `COUNT`/`SUM`/`DISTINCT date` trên dữ liệu 1 gia đình (nhỏ) → chấp nhận được; đã có index `points_ledger(child_id, created_at)`, `task_assignments(child_id, status)`. Nếu về sau lớn: cache `progression` hoặc materialized view (phải tái tính được — AD1).
- **Migration:** thêm 3 bảng + mở rộng 1 CHECK constraint ledger → migration Alembic thuận, không đụng dữ liệu cũ.
- **Tương thích:** con/gia đình cũ vẫn chạy; tiến trình tính ngược từ lịch sử sẵn có (huy hiệu quá khứ được cấp ở lần duyệt kế tiếp, hoặc chạy một lần `evaluate_badges` cho toàn bộ con khi migrate — tùy chọn).

## 7. Open issues (bàn giao)

- Q-A..Q-E (intake §6): đã dùng default; PO chốt trước khi khóa scope (đặc biệt Q-B "bonus khi lên cấp/huy hiệu" và Q-D "freeze streak").
- Backfill huy hiệu cho dữ liệu cũ: chạy `evaluate_badges` một lần khi deploy (tùy chọn, không bắt buộc).
- Ngưỡng level & số bonus streak là đề xuất — cân chỉnh theo phản hồi thực tế của gia đình.
