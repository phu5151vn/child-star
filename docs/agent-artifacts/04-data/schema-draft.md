# Data Schema Draft — Ứng dụng tạo điểm loyalty cho con

> **Draft** cho Stage 3 (chưa phải bản chốt `schema.md`). PostgreSQL. Truy vết `01-product/prd.md` (business rules) và `03-architecture/architecture-draft.md`. Số dư điểm là **derived** từ `points_ledger` (append-only), không lưu số dư như nguồn đúng.

## 1. Sơ đồ quan hệ (mức khái niệm)

```
families 1───n users(role=parent|child)
families 1───n tasks
families 1───n rewards
tasks     1───n task_assignments (n theo con)   ──► child (users)
rewards   1───n reward_redemptions               ──► child (users)
users(child) 1───n points_ledger  (append-only)
task_assignments 1──0..1 points_ledger (task_approved)
reward_redemptions 1──0..1 points_ledger (reward_redeemed)
media 1───n (task.icon, reward.image, assignment.proof)
```

## 2. Bảng

### families
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| name | text | not null |
| created_at | timestamptz | default now() |

### users
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK families, not null |
| role | text | check in ('parent','child') |
| display_name | text | not null |
| avatar_media_id | uuid | FK media, null |
| email | citext | null (chỉ parent); unique khi not null |
| password_hash | text | null (chỉ parent) |
| pin_hash | text | null (chỉ child) — Q6 |
| is_active | bool | default true |
| created_at | timestamptz | default now() |

> Không lưu email/sđt cho child (PRD §10). Index `(family_id, role)`.

### tasks
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK families, not null |
| title | text | not null |
| description | text | null |
| points | int | **check points > 0** (BR-T, PRD §6.1) |
| icon_media_id | uuid | FK media, null |
| require_proof | bool | default false |
| is_active | bool | default true |
| created_by | uuid | FK users(parent) |
| created_at | timestamptz | default now() |

### task_assignments
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| task_id | uuid | FK tasks, not null |
| child_id | uuid | FK users(child), not null |
| status | text | check in ('available','in_progress','submitted','approved','rejected') |
| proof_media_id | uuid | FK media, null (bắt buộc nếu task.require_proof khi submit) |
| reject_reason | text | null |
| submitted_at | timestamptz | null |
| decided_at | timestamptz | null |
| created_at | timestamptz | default now() |

> Gợi ý: unique một assignment "đang mở" cho mỗi (task_id, child_id) để tránh nhận trùng. State machine enforce ở service (BR-T1..T5, no-skip BR-T2).

### rewards
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK families, not null |
| title | text | not null |
| description | text | null |
| required_points | int | **check required_points > 0** (BR-R1) |
| image_media_id | uuid | FK media, null |
| stock | int | null = không giới hạn; check stock >= 0 |
| is_active | bool | default true |
| created_by | uuid | FK users(parent) |
| created_at | timestamptz | default now() |

### reward_redemptions
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| reward_id | uuid | FK rewards, not null |
| child_id | uuid | FK users(child), not null |
| status | text | check in ('requested','approved','rejected','cancelled') |
| points_spent | int | null tới khi approved = snapshot required_points |
| reject_reason | text | null |
| requested_at | timestamptz | default now() |
| decided_at | timestamptz | null |

> Trừ điểm + giảm stock chỉ khi `approved`, trong 1 transaction (BR-X2..X4).

### points_ledger (append-only)
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK families, not null |
| child_id | uuid | FK users(child), not null |
| delta | int | không = 0 (dương = cộng, âm = trừ) |
| kind | text | check in ('task_approved','reward_redeemed','manual_adjust') |
| task_assignment_id | uuid | FK task_assignments, null; **unique khi kind='task_approved'** (idempotent BR-T4) |
| reward_redemption_id | uuid | FK reward_redemptions, null; unique khi kind='reward_redeemed' |
| reason | text | null (bắt buộc khi manual_adjust) |
| created_by | uuid | FK users |
| created_at | timestamptz | default now() |

> **Append-only** (BR-P5): không update/delete; sửa sai bằng dòng bù. Index `(child_id, created_at)`.

## 3. Số dư điểm (derived)

```sql
-- Số dư điểm của một con
SELECT COALESCE(SUM(delta), 0) AS balance
FROM points_ledger
WHERE child_id = :child_id;
```

- Có thể tạo materialized view/cache nhưng phải tái tính được từ ledger (BR-P1).
- Kiểm tra không âm khi trừ (BR-P3): trong transaction, khóa các dòng liên quan hoặc dùng advisory lock theo child_id trước khi ghi dòng âm.

## 4. media
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | uuid | PK |
| family_id | uuid | FK families |
| kind | text | check in ('task_icon','reward_image','proof','avatar') |
| storage_path | text | not null |
| mime_type | text | validate ảnh (png/jpg/webp) |
| size_bytes | int | check <= giới hạn (vd 5MB) |
| uploaded_by | uuid | FK users |
| created_at | timestamptz | default now() |

## 5. Cô lập dữ liệu & bảo mật

- Mọi bảng nghiệp vụ có `family_id`; áp **RLS PostgreSQL** hoặc kiểm soát server-side tương đương (Data Rules). Con chỉ đọc dữ liệu của chính mình cho ledger/assignment.
- Ràng buộc điểm ở DB (check > 0), logic không-âm + idempotent ở service + unique constraint ledger.

## 6. Ràng buộc chốt ở Stage 3

- Cơ chế lock khi trừ điểm (row lock vs advisory).
- Chính sách RLS chi tiết theo role.
- Có cần bảng `notifications`/`audit_log` riêng ngoài ledger không.
- Quan hệ nhiệm vụ lặp lại (Q2 — ngoài scope giai đoạn 1).
