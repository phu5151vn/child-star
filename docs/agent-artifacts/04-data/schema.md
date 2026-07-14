# Data Schema — Ứng dụng tạo điểm loyalty cho con ("Bé Ngoan")

> **Bản chốt Stage 3.** PostgreSQL 15+. Truy vết `01-product/prd.md` (business rules) và `03-architecture/architecture.md`. Nguyên tắc cốt lõi: **số dư điểm là derived** từ `points_ledger` (append-only) — không lưu số dư như nguồn đúng (BR-P1). Migration bằng Alembic.

## 1. Sơ đồ quan hệ (ERD khái niệm)

```
families ─1─n─ users (role = parent | child)
families ─1─n─ tasks ─1─n─ task_assignments ─n─1─ users(child)
families ─1─n─ rewards ─1─n─ reward_redemptions ─n─1─ users(child)
users(child) ─1─n─ points_ledger        (append-only)
task_assignments   ─1─0..1─ points_ledger  (kind='task_approved')
reward_redemptions ─1─0..1─ points_ledger  (kind='reward_redeemed')
media ─1─n─ (tasks.icon | rewards.image | task_assignments.proof | users.avatar)
families ─1─n─ audit_log
```

## 2. Bảng

### 2.1 families
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| name | text | not null |
| family_code | text | not null, **unique** (mã con dùng để đăng nhập — D1) |
| created_at | timestamptz | default now() |

### 2.2 users
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK families, not null |
| role | text | **CHECK role IN ('parent','child')**, not null |
| display_name | text | not null |
| avatar_media_id | uuid | FK media, null |
| email | citext | null (chỉ parent); **unique khi not null** |
| password_hash | text | null (chỉ parent — bcrypt) |
| pin_hash | text | null (chỉ child — bcrypt, Q6) |
| is_active | bool | default true |
| created_at | timestamptz | default now() |

- CHECK ràng buộc chéo: `role='parent' → email & password_hash NOT NULL, pin_hash NULL`; `role='child' → pin_hash NOT NULL, email NULL` (enforce ở service + CHECK.
- Không lưu email/sđt cho child (PRD §10). Index: `(family_id, role)`; unique `(family_id, lower(display_name))` cho child để chọn avatar rõ ràng.

### 2.3 tasks
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK families, not null |
| title | text | not null, length ≤ 80 |
| description | text | null |
| points | int | **CHECK points > 0** (PRD §6.1) |
| icon_media_id | uuid | FK media, null |
| require_proof | bool | default false |
| is_active | bool | default true |
| created_by | uuid | FK users(parent), not null |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

Index: `(family_id, is_active)`.

### 2.4 task_assignments
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK families, not null (denormalized để scope/RLS) |
| task_id | uuid | FK tasks, not null |
| child_id | uuid | FK users(child), not null |
| status | text | **CHECK status IN ('in_progress','submitted','approved','rejected')** |
| proof_media_id | uuid | FK media, null (bắt buộc khi submit nếu task.require_proof) |
| reject_reason | text | null |
| submitted_at | timestamptz | null |
| decided_at | timestamptz | null |
| decided_by | uuid | FK users(parent), null |
| created_at | timestamptz | default now() |

- **`available`** không lưu như 1 dòng assignment — đó là trạng thái "task active chưa được con này claim". Assignment được tạo khi con **claim** (`in_progress`). Điều này khớp state machine PRD §5.1 (available là điều kiện của task, không phải hàng trong bảng).
- **Chống nhận trùng**: partial unique `(task_id, child_id) WHERE status IN ('in_progress','submitted')` — mỗi con chỉ có tối đa 1 assignment đang mở cho 1 task.
- State machine + no-skip (BR-T2), phân quyền (BR-T3) enforce ở service. Index `(family_id, status)`, `(child_id, status)`.

### 2.5 rewards
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK families, not null |
| title | text | not null |
| description | text | null |
| required_points | int | **CHECK required_points > 0** (BR-R1) |
| image_media_id | uuid | FK media, null |
| stock | int | null = không giới hạn; **CHECK stock >= 0** |
| is_active | bool | default true |
| created_by | uuid | FK users(parent), not null |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

Index: `(family_id, is_active)`. `is_unlocked`/`missing_points` **không lưu** — tính runtime theo balance con (BR-R2).

### 2.6 reward_redemptions
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK families, not null |
| reward_id | uuid | FK rewards, not null |
| child_id | uuid | FK users(child), not null |
| status | text | **CHECK status IN ('requested','approved','rejected','cancelled')** |
| points_spent | int | null tới khi approved = snapshot `required_points` |
| reject_reason | text | null |
| requested_at | timestamptz | default now() |
| decided_at | timestamptz | null |
| decided_by | uuid | FK users(parent), null |

- Trừ điểm + giảm stock **chỉ khi `approved`**, trong 1 transaction (BR-X2..X4). `points_spent` snapshot mốc điểm tại thời điểm duyệt.
- Chống gửi trùng: partial unique `(reward_id, child_id) WHERE status='requested'` (một yêu cầu đang chờ / reward / con).

### 2.7 points_ledger (append-only — nguồn đúng của điểm)
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK families, not null |
| child_id | uuid | FK users(child), not null |
| delta | int | **CHECK delta <> 0** (dương=cộng, âm=trừ) |
| kind | text | **CHECK kind IN ('task_approved','reward_redeemed','manual_adjust')** |
| task_assignment_id | uuid | FK task_assignments, null |
| reward_redemption_id | uuid | FK reward_redemptions, null |
| reason | text | null (**bắt buộc khi kind='manual_adjust'** — enforce service) |
| created_by | uuid | FK users, not null |
| created_at | timestamptz | default now() |

- **Idempotency (BR-T4)**: `CREATE UNIQUE INDEX ON points_ledger(task_assignment_id) WHERE kind='task_approved'`.
- **Idempotency đổi thưởng**: `CREATE UNIQUE INDEX ON points_ledger(reward_redemption_id) WHERE kind='reward_redeemed'`.
- **Append-only (BR-P5)**: cấm UPDATE/DELETE (khuyến nghị trigger `RAISE EXCEPTION` hoặc REVOKE quyền); sửa sai bằng dòng `manual_adjust` bù. Index `(child_id, created_at DESC)`.

### 2.8 media
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK families, not null |
| kind | text | **CHECK kind IN ('task_icon','reward_image','proof','avatar')** |
| storage_path | text | not null (đường dẫn nội bộ, không lộ ra client) |
| mime_type | text | **CHECK mime_type IN ('image/png','image/jpeg','image/webp')** |
| size_bytes | int | **CHECK size_bytes <= 5242880** (5MB) |
| uploaded_by | uuid | FK users, not null |
| created_at | timestamptz | default now() |

### 2.9 audit_log (thay đổi cấu hình rule — D6)
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK families, not null |
| actor_id | uuid | FK users, not null |
| action | text | vd 'task.create','task.update','task.delete','reward.create','reward.update','reward.delete','child.update','child.pin_reset' |
| entity_type | text | 'task' \| 'reward' \| 'child' |
| entity_id | uuid | null nếu đã xóa |
| changes | jsonb | before/after tối thiểu (không chứa dữ liệu nhạy cảm như PIN plaintext) |
| created_at | timestamptz | default now() |

Index `(family_id, created_at DESC)`.

## 3. Số dư điểm (derived) & khóa an toàn

```sql
-- Số dư điểm của một con (BR-P1)
SELECT COALESCE(SUM(delta), 0) AS balance
FROM points_ledger
WHERE child_id = :child_id;
```

Trừ điểm an toàn (BR-P3, BR-X3) — trong transaction đổi thưởng approve / manual_adjust âm:

```sql
BEGIN;
  -- D3: tuần tự hóa theo con, chống race condition
  SELECT pg_advisory_xact_lock(hashtext(:child_id::text));

  -- tính balance mới nhất SAU khi đã giữ lock
  SELECT COALESCE(SUM(delta),0) INTO v_balance
  FROM points_ledger WHERE child_id = :child_id;

  IF v_balance < :required_points THEN
     RAISE EXCEPTION 'INSUFFICIENT_POINTS';
  END IF;

  -- giảm stock nếu có (BR-X4)
  UPDATE rewards SET stock = stock - 1
    WHERE id = :reward_id AND (stock IS NULL OR stock > 0);

  INSERT INTO points_ledger(id, family_id, child_id, delta, kind, reward_redemption_id, created_by)
  VALUES (gen_random_uuid(), :family_id, :child_id, -:required_points, 'reward_redeemed', :redemption_id, :parent_id);

  UPDATE reward_redemptions
    SET status='approved', points_spent=:required_points, decided_at=now(), decided_by=:parent_id
    WHERE id = :redemption_id AND status='requested';
COMMIT;
```

- Có thể tạo materialized view/cache balance để hiển thị nhanh, nhưng **phải tái tính được** từ ledger (BR-P1) và không dùng làm nguồn kiểm tra khi trừ điểm.

## 4. Cô lập dữ liệu & bảo mật (D2)

- **Bắt buộc (lớp 1 — server-side)**: mọi bảng nghiệp vụ có `family_id`; repository luôn thêm điều kiện `family_id = :ctx_family_id` (từ token). Con chỉ đọc `task_assignments`/`points_ledger`/`reward_redemptions` có `child_id = :ctx_child_id`.
- **Khuyến nghị (lớp 2 — RLS PostgreSQL, tùy chọn)**: bật RLS trên các bảng nghiệp vụ, policy `USING (family_id = current_setting('app.current_family_id')::uuid)`; app `SET LOCAL app.current_family_id = :family_id` đầu mỗi request/transaction.
- Ràng buộc điểm ở DB (`CHECK delta<>0`, `points>0`, `required_points>0`, `stock>=0`) + logic không-âm & idempotent ở service + partial unique index ledger.

## 5. Dictionary / LOV (đồng bộ enum với API & UI)

| Nhóm | Giá trị hợp lệ | Dùng ở |
|---|---|---|
| `users.role` | `parent`, `child` | phân quyền toàn hệ thống |
| `task_assignments.status` | `in_progress`, `submitted`, `approved`, `rejected` (+ `available` là trạng thái suy ra của task) | state machine BR-T |
| `reward_redemptions.status` | `requested`, `approved`, `rejected`, `cancelled` | BR-X |
| `points_ledger.kind` | `task_approved`, `reward_redeemed`, `manual_adjust` | BR-P2 |
| `media.kind` | `task_icon`, `reward_image`, `proof`, `avatar` | upload PRD §7 |
| Đơn vị điểm | số nguyên "sao ⭐" (int, không phân số) | UI "+30 ⭐" |
| Trạng thái reward (computed) | `unlocked` (balance≥required), `locked` (+missing_points), `out_of_stock` (stock=0) | BR-R2..R4, states.md |

## 6. Ghi chú migration & seed

- Alembic: 1 migration khởi tạo toàn bộ bảng + index + CHECK; bật extension `pgcrypto` (gen_random_uuid) và `citext`.
- Seed demo (dev): 1 family, 1 parent, 2 con, vài task (points 10/20/30), vài reward (mốc 50/150/350, có stock & không), một số ledger để test balance & locked/unlocked.

## 7. Open issues (dữ liệu)

- RLS chi tiết theo role child (đọc-own) nếu bật lớp 2 — cần policy riêng cho `points_ledger`/`task_assignments` với `current_setting('app.current_child_id')`.
- Nhiệm vụ lặp lại (Q2) & hết hạn điểm (Q5): ngoài scope giai đoạn 1; schema hiện chưa có cột recurrence/expiry (thêm sau không phá vỡ ledger).
- Materialized view balance: chưa bắt buộc giai đoạn 1 (dữ liệu 1 gia đình nhỏ, `SUM` đủ nhanh).
