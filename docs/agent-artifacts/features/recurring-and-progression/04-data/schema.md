# Data Schema — Nhiệm vụ lặp lại & Tiến trình

> **Increment trên schema "Bé Ngoan" đã chốt** (`docs/agent-artifacts/04-data/schema.md`). PostgreSQL 15+, Alembic. Nguyên tắc giữ nguyên: **điểm & tiến trình là derived** từ `points_ledger` (append-only) và `task_assignments`; chỉ lưu **sự kiện đã trao** để idempotency. Truy vết `../01-product/prd.md`, `../03-architecture/architecture.md`.

## 1. Thay đổi trên bảng hiện có

### 1.1 `points_ledger` — mở rộng enum `kind`
- **Trước:** `kind IN ('task_approved','reward_redeemed','manual_adjust','weekly_bonus')`.
- **Sau:** thêm `'streak_bonus'` →
  `CHECK kind IN ('task_approved','reward_redeemed','manual_adjust','weekly_bonus','streak_bonus')`.
- Migration: `DROP CONSTRAINT ck_ledger_kind; ADD CONSTRAINT ck_ledger_kind CHECK (...)`. Không đụng dữ liệu.
- `streak_bonus`: `delta > 0`, `created_by` = parent duyệt (actor), `reason` = mô tả mốc (vd `"streak 7 ngày"`); không gắn `task_assignment_id`/`reward_redemption_id`.

### 1.2 `tasks.recurrence` — KHÔNG đổi
Đã đủ (`once/daily/weekly` + CHECK). F1 chỉ hoàn thiện service/UX/test — **không thay đổi schema**. (Cập nhật ghi chú "recurrence ngoài scope" trong schema gốc §7 đã lỗi thời: recurrence đã có.)

## 2. Bảng mới

### 2.1 `badges` — định nghĩa huy hiệu hệ thống (seed, KHÔNG theo family)
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| code | text | **PK** (khóa ổn định, vd `first_task`, `tasks_10`) |
| title | text | not null (danh hiệu hiển thị, tiếng Việt) |
| description | text | not null (cách đạt — hiển thị teaser) |
| icon_emoji | text | not null (biểu tượng dễ thương) |
| criteria_type | text | **CHECK IN ('first_task','tasks_approved_total','points_earned_total','streak_days','rewards_redeemed_total','weekly_goal_hits')** |
| threshold | int | **CHECK threshold > 0** (ngưỡng đạt; `first_task` = 1) |
| sort_order | int | not null default 0 (thứ tự hiển thị) |
| is_active | bool | default true |

- Seed hệ thống (không `family_id`) — dùng chung mọi gia đình. Nếu về sau cần huy hiệu riêng theo family → thêm bảng `family_badges` mà không phá bảng này (AD4).

### 2.2 `child_badges` — huy hiệu con đã đạt (append-only, idempotent)
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK default gen_random_uuid() |
| family_id | uuid | FK families, not null (scope/isolation) |
| child_id | uuid | FK users(child), not null |
| badge_code | text | FK badges(code), not null |
| earned_at | timestamptz | default now() |

- **Idempotency (BR-PG-13):** `UNIQUE (child_id, badge_code)` → cấp lại là no-op (bắt `unique_violation`).
- Append-only (không UPDATE/DELETE); là bản ghi "đã đạt", không phải counter.
- Index: `(child_id)`; FK `badge_code` đảm bảo chỉ cấp huy hiệu tồn tại.

### 2.3 `streak_milestone_awards` — đánh dấu đã thưởng mốc streak (idempotent)
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK families, not null |
| child_id | uuid | FK users(child), not null |
| milestone | int | **CHECK milestone > 0** (3/7/14/30) |
| points_awarded | int | not null (số sao đã thưởng — snapshot) |
| ledger_id | uuid | FK points_ledger, null (dòng bonus tương ứng) |
| created_at | timestamptz | default now() |

- **Idempotency (BR-PG-9):** `UNIQUE (child_id, milestone)` → mỗi con nhận mỗi mốc đúng 1 lần trọn đời. Chèn award **trước**, thành công mới ghi ledger `streak_bonus` (cùng transaction); trùng → bỏ qua, không ghi ledger.
- Tương tự pattern `weekly_bonus_awards` đã có (`UNIQUE(child_id, week_start)`).

## 3. Truy vấn dẫn xuất (derived — nguồn đúng của tiến trình)

```sql
-- Tổng sao LŨY KẾ đã kiếm (nền của level & badge points) — BR-PG-1
SELECT COALESCE(SUM(delta), 0) FROM points_ledger
WHERE child_id = :child AND delta > 0;

-- Số dư TIÊU ĐƯỢC (đã có) — để hiển thị song song
SELECT COALESCE(SUM(delta), 0) FROM points_ledger WHERE child_id = :child;

-- Số nhiệm vụ được duyệt (badge tasks_*) — đếm dòng cộng của nhiệm vụ
SELECT COUNT(*) FROM points_ledger
WHERE child_id = :child AND kind = 'task_approved';
-- (tương đương COUNT task_assignments status='approved')

-- Tập NGÀY hoạt động theo giờ VN (streak) — BR-PG-6
SELECT DISTINCT (decided_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS d
FROM task_assignments
WHERE child_id = :child AND status = 'approved' AND decided_at IS NOT NULL
ORDER BY d;
-- current/longest streak tính trong service từ tập ngày này (pure function, dễ test)

-- Số phần thưởng đã đổi thành công (badge rewards_*)
SELECT COUNT(*) FROM reward_redemptions
WHERE child_id = :child AND status = 'approved';

-- Số lần đạt mục tiêu tuần (badge weekly_goal_hits)
SELECT COUNT(*) FROM weekly_bonus_awards WHERE child_id = :child;
```

> Ghi chú: dùng `AT TIME ZONE 'Asia/Ho_Chi_Minh'` để đồng nhất ranh giới ngày với `core/timeutil.py` (UTC+7). Service có thể tự tính ngày từ `decided_at` bằng `timeutil` thay vì đẩy xuống SQL — miễn nhất quán.

## 4. Ghi bonus streak an toàn (transaction, trong advisory-lock của approve)

```sql
-- Đã giữ advisory_lock_child(child) từ luồng approve
BEGIN;
  -- chặn thưởng trùng mốc: UNIQUE(child_id, milestone)
  INSERT INTO streak_milestone_awards(id, family_id, child_id, milestone, points_awarded)
  VALUES (gen_random_uuid(), :family, :child, :milestone, :bonus);
  -- nếu dòng trên vi phạm UNIQUE -> rollback nhánh này, KHÔNG ghi ledger

  INSERT INTO points_ledger(id, family_id, child_id, delta, kind, reason, created_by)
  VALUES (gen_random_uuid(), :family, :child, :bonus, 'streak_bonus',
          concat('streak ', :milestone, ' ngày'), :actor)
  RETURNING id;   -- cập nhật streak_milestone_awards.ledger_id
COMMIT;
```

## 5. Dictionary / LOV (đồng bộ enum với API & UI)

| Nhóm | Giá trị hợp lệ | Dùng ở |
|---|---|---|
| `points_ledger.kind` (mở rộng) | `task_approved`, `reward_redeemed`, `manual_adjust`, `weekly_bonus`, **`streak_bonus`** | BR-PG-9 |
| `badges.criteria_type` | `first_task`, `tasks_approved_total`, `points_earned_total`, `streak_days`, `rewards_redeemed_total`, `weekly_goal_hits` | BR-PG-11 |
| Mốc streak | `3`, `7`, `14`, `30` (ngày) | BR-PG-9 |
| Bonus theo mốc `[ASSUMPTION]` | `3→5`, `7→15`, `14→30`, `30→80` (⭐) | BR-PG-9 |
| Ngưỡng level (lifetime ⭐) `[ASSUMPTION]` | `0/100/250/500/1000/2000` → Lv1..6 | BR-PG-3 |
| `tasks.recurrence` | `once`, `daily`, `weekly` (đã có) | BR-RC-1 |

## 6. Seed dữ liệu

- **`badges`** (seed hệ thống, chạy trong migration hoặc `seed.py`) — bộ khởi tạo đề xuط:

  | code | title | icon | criteria_type | threshold |
  |---|---|---|---|---|
  | first_task | Khởi đầu | 🎉 | first_task | 1 |
  | tasks_10 | Chăm chỉ | 💪 | tasks_approved_total | 10 |
  | tasks_50 | Siêng năng | 🔥 | tasks_approved_total | 50 |
  | tasks_100 | Bậc thầy việc nhà | 👑 | tasks_approved_total | 100 |
  | points_100 | Trăm sao | ⭐ | points_earned_total | 100 |
  | points_500 | Năm trăm sao | 🌟 | points_earned_total | 500 |
  | points_1000 | Nghìn sao | 💫 | points_earned_total | 1000 |
  | streak_7 | Tuần hoàn hảo | 📅 | streak_days | 7 |
  | streak_30 | Bền bỉ | 🏅 | streak_days | 30 |
  | reward_first | Phần thưởng đầu tiên | 🎁 | rewards_redeemed_total | 1 |
  | weekly_goal_first | Đạt mục tiêu tuần | 🏆 | weekly_goal_hits | 1 |

- **Dev demo:** thêm vài dòng `points_ledger`/`task_assignments approved` rải nhiều ngày cho 1 con để thấy streak > 0 và vài huy hiệu đã đạt.

## 7. Migration & tương thích

- 1 Alembic migration: mở rộng CHECK `ck_ledger_kind`; tạo `badges`, `child_badges`, `streak_milestone_awards` + index/unique; seed `badges`.
- **An toàn dữ liệu cũ:** chỉ thêm mới, không đổi cột cũ → gia đình/con hiện có chạy bình thường. Tiến trình tính ngược từ lịch sử; huy hiệu quá khứ được cấp ở lần duyệt kế tiếp hoặc qua backfill tùy chọn (`evaluate_badges` cho mọi con).
- Cô lập dữ liệu (D2 gốc): `child_badges`, `streak_milestone_awards` có `family_id`; repository luôn scope theo token. `badges` là bảng tra cứu hệ thống (không `family_id`) → chỉ đọc.

## 8. Open issues (dữ liệu)

- Nếu bật RLS lớp 2 (D2 gốc): thêm policy cho 2 bảng có `family_id` mới; `badges` cho phép đọc chung.
- Ngưỡng/bonus là hằng số hệ thống — nếu chuyển sang cấu hình theo family (Q-E) cần bảng cấu hình riêng (increment sau).
- Cân nhắc cache `lifetime_points`/streak nếu dữ liệu lớn (phải tái tính được — AD1).
