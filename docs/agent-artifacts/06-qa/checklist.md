# QA Checklist — Ứng dụng tạo điểm loyalty cho con ("Bé Ngoan")

> Stage 5 Review. Đối chiếu implementation (`backend/`, `frontend/`) với `01-product/prd.md`, `03-architecture/architecture.md`, `04-data/schema.md`, `02-design/*`.
> Ký hiệu: ✅ đạt · ⚠️ đạt một phần / issue · ❌ không đạt (blocker). Bằng chứng ghi `file:line` hoặc `METHOD /endpoint`.

## A. Role & permission (enforce ở backend)

| # | Hạng mục | KQ | Bằng chứng |
|---|---|---|---|
| A1 | Chỉ `parent` tạo/sửa/xóa nhiệm vụ | ✅ | `routers/api.py:165,186,199` dùng `require_role("parent")`; test `tests/test_api.py:99-104` child bị 403 |
| A2 | Chỉ `parent` tạo/sửa/xóa phần thưởng & mốc điểm | ✅ | `routers/api.py:279,300,313` `require_role("parent")` |
| A3 | Con **không** tạo task/reward | ✅ | Cùng guard trên; `test_child_forbidden_parent_endpoint` |
| A4 | Con **không** tự cộng/sửa điểm | ✅ | Không có endpoint child ghi ledger; cộng điểm chỉ trong `AssignmentService.approve` (parent-only); `manual_adjust` `require_role("parent")` `api.py:149` |
| A5 | Con chỉ nhận/nộp nhiệm vụ của mình | ✅ | `task_service.py:237` `submit` kiểm `assignment.child_id != ctx.child_id → NotFound`; `claim` dùng `ctx.child_id` `:193-222` |
| A6 | Con chỉ đổi thưởng & hủy yêu cầu của mình | ✅ | `reward_service.py:169` redeem dùng `ctx.child_id`; `cancel :260` kiểm `child_id != ctx.child_id` |
| A7 | Con chỉ xem sổ điểm/balance của chính mình | ✅ | `require_owner_child` `deps.py:60`; áp dụng `task_service.py:327,337` |
| A8 | Duyệt/từ chối hoàn thành & đổi thưởng chỉ `parent` | ✅ | `api.py:248,260,349,361` `require_role("parent")` |

## B. Cô lập dữ liệu (family isolation / IDOR)

| # | Hạng mục | KQ | Bằng chứng |
|---|---|---|---|
| B1 | Mọi truy vấn scope `family_id` từ token, không nhận từ client | ✅ | `repositories/base.py:90-109` helper `get_*_in_family`; `deps.py:38-43` family_id lấy từ JWT claim |
| B2 | Con A không đọc được assignment/ledger/redemption của con B | ✅ | `list_assignments` `task_service.py:164` ép `child_id==ctx.child_id`; `list_redemptions` `reward_service.py:141`; balance/ledger qua `require_owner_child` |
| B3 | Không truy cập dữ liệu family khác qua id tùy ý (IDOR) | ✅ | Tất cả getter lọc `family_id` → trả `NotFound` nếu khác family (vd `get_task_in_family`, `submit`, `approve`) |
| B4 | Media không rò rỉ cross-family | ✅ | `media_service.py:64` `media.family_id != ctx.family_id → NotFound` |
| B5 | Media `proof` kiểm ownership của con trong cùng family | ⚠️ | `media_service.py:62` chỉ kiểm family, **không** kiểm child sở hữu → anh/chị em cùng nhà có thể xem ảnh minh chứng của nhau nếu biết `media_id` (thấp) |
| B6 | `proof_media_id` khi submit được validate thuộc family/child | ⚠️ | `task_service.py:245` gán trực tiếp `data.proof_media_id`, không kiểm media tồn tại/thuộc con (thấp) |

## C. Business rule điểm & phần thưởng

| # | Hạng mục | KQ | Bằng chứng |
|---|---|---|---|
| C1 | Điểm cộng đúng khi nhiệm vụ được duyệt | ✅ | `approve` ghi ledger `+task.points` `task_service.py:269-278`; test `test_task_flow_earn_points` balance=25 |
| C2 | Không cộng điểm khi bị từ chối | ✅ | `reject` không ghi ledger `task_service.py:283-303` |
| C3 | Idempotent double-approve (tuần tự) không cộng trùng | ✅ | Early-return khi status `approved` + `has_ledger_for_assignment` `:255-264`; test `test_api.py:145-149` |
| C4 | Idempotent double-approve **đồng thời** (race) không double-count | ❌ | **Không** có advisory lock ở `approve` assignment và **thiếu** partial unique index `points_ledger(task_assignment_id) WHERE kind='task_approved'` (models `__init__.py:169-178` không khai báo). Kiểm tra check-then-insert không an toàn khi 2 request song song → cộng trùng. Architecture §2.2 & schema §2.7 đã hứa index này |
| C5 | Unlock theo mốc: đổi được chỉ khi `balance ≥ required_points` | ✅ | `_compute_unlock` `reward_service.py:27-31`; `redeem :179` chặn nếu chưa unlock; test `test_reward_locked_teaser` |
| C6 | Trừ điểm đúng khi duyệt đổi thưởng | ✅ | `approve` ghi ledger `-required_points` + `points_spent` snapshot `reward_service.py:222-239` |
| C7 | Kiểm balance **tại thời điểm duyệt** (không chỉ lúc gửi) | ✅ | `reward_service.py:220-223` lấy balance sau lock rồi so sánh |
| C8 | Điểm không âm | ✅ | `approve :222` `balance < required → INSUFFICIENT_POINTS`; `manual_adjust :353-357` `balance+delta<0` chặn |
| C9 | Race đổi 2 lần cùng lúc (double-deduct) | ❌ | `advisory_lock_child` tuần tự hóa theo con, **nhưng** `has_ledger_for_redemption` được kiểm **trước** khi lấy lock và **không** kiểm lại sau lock; thiếu partial unique `points_ledger(reward_redemption_id)` (models `:169-178`) → 2 request approve cùng 1 redemption có thể ghi 2 dòng trừ + giảm stock 2 lần |
| C10 | Ledger append-only (không UPDATE/DELETE) | ⚠️ | Service chỉ INSERT; **nhưng** chưa có trigger/REVOKE ở DB chặn UPDATE/DELETE như schema §2.7 khuyến nghị |
| C11 | Số dư derived từ ledger (không lưu rời rạc) | ✅ | `PointsRepository.get_balance` `base.py:27-31` `SUM(delta)` |
| C12 | Phần thưởng chưa đủ điểm vẫn hiển thị (teaser) nhưng khóa | ✅ | Backend `list_rewards` trả cả locked + `missing_points` `reward_service.py:42-59`; UI `RewardCard.tsx:31-60` + `ChildRewardsPage` tách unlocked/locked |
| C13 | Hết stock không đổi được kể cả khi đủ điểm | ✅ | `_compute_unlock` set out_of_stock; `redeem :177`, `approve :218` chặn |

## D. Workflow / transition & required fields

| # | Hạng mục | KQ | Bằng chứng |
|---|---|---|---|
| D1 | Vòng đời nhiệm vụ `in_progress→submitted→approved/rejected` | ✅ | Kiểm status inline: `submit` yêu cầu `in_progress`, `approve/reject` yêu cầu `submitted` `task_service.py:239,257,287` |
| D2 | No-skip: không `available→approved` | ✅ | Approve chỉ chạy trên assignment đã tồn tại & status `submitted`; `available` không có hàng assignment (schema §2.4) |
| D3 | `rejected` cho làm lại | ✅ | `reject` tạo assignment `in_progress` mới `task_service.py:294-302` (khớp BR-T5, deviation ghi build-report §8) |
| D4 | Redemption `requested→approved/rejected/cancelled` | ✅ | `reward_service.py:201-266` kiểm status `requested` |
| D5 | Required fields validate ở backend (points>0, required_points>0, title) | ✅ | Pydantic `schemas/__init__.py:95,153,93` (`gt=0`, `min_length`); DB CHECK `models/__init__.py:78,126` |
| D6 | `require_proof=true` bắt buộc ảnh khi submit | ✅ | `task_service.py:242-243` `ProofRequiredError` |
| D7 | `manual_adjust` bắt buộc `reason` | ✅ | `schemas:88` `reason min_length=1` |
| D8 | State machine table thực sự được dùng | ⚠️ | `ASSIGNMENT_TRANSITIONS` `task_service.py:24` **dead code**, không tham chiếu (transition enforce bằng if inline) |
| D9 | `manual_adjust` chặn `delta=0` | ⚠️ | `schemas:87` `Field(..., exclude=0)` sai cú pháp (exclude không phải constraint) → delta=0 lọt schema, chỉ bị DB CHECK `delta<>0` chặn muộn (500 thay vì 422) |

## E. Frontend states & UX trẻ em

| # | Hạng mục | KQ | Bằng chứng |
|---|---|---|---|
| E1 | Loading/empty/error mọi màn danh sách chính | ⚠️ | `PageState.tsx` dùng ở `ChildTasksPage/RewardsPage/HistoryPage`, parent pages. **ChildHomePage** `ChildPages.tsx:15-44` không có loading/error state |
| E2 | Kho thưởng phân biệt locked vs unlocked | ✅ | `ChildRewardsPage:157-183` tách 2 nhóm; `RewardCard` overlay 🔒 + progress + "Còn thiếu N sao" |
| E3 | Thông báo khi bị khóa / đổi thưởng | ✅ | `redeem` onError `message.error` `ChildPages.tsx:151-154`; backend trả "Con cần thêm N điểm nữa" `reward_service.py:180` |
| E4 | RoleRoute guard (chỉ ẩn/hiện UI, quyền thật ở backend) | ✅ | `RoleRoute.tsx:9-19` redirect theo role |
| E5 | UI game hoá / hoạt hình dễ thương theo design | ✅ | Tokens Stitch playful `theme/tokens.ts` (primary #7C5CFC, radius 16-24, Baloo 2/Nunito); confetti `CelebrationFx.tsx`; icon sao/gift; ngôn từ khích lệ |
| E6 | Empty state dùng illustration hoạt hình (design intent) | ⚠️ | Dùng AntD `Empty` mặc định, chưa nhúng PNG `02-design/stitch-assets/` (build-report §7.7) |
| E7 | Upload ảnh nhiệm vụ/phần thưởng/proof gắn UI | ⚠️ | API `/media` có; form task/reward & `ProofUpload` chưa gắn đầy đủ (build-report §7.3) |

## F. Contract & data

| # | Hạng mục | KQ | Bằng chứng |
|---|---|---|---|
| F1 | Endpoint khớp API contract `03-architecture §3` | ✅ | `routers/api.py` khớp danh sách; đủ auth/family/tasks/assignments/rewards/redemptions/media |
| F2 | Không trả field ngoài phân quyền | ✅ | Child response ẩn `is_unlocked/missing_points` cho parent (`None`); `ChildProfile` không lộ email/pin `schemas:37-42` |
| F3 | Schema DB khớp `04-data/schema.md` (CHECK, enum) | ⚠️ | Bảng/CHECK/enum khớp; **thiếu** các partial unique index idempotency & chống nhận/gửi trùng (`(task_id,child_id)`, `(reward_id,child_id)`, ledger idempotency), unique `(family_id, lower(display_name))` con |
| F4 | Chống nhận/gửi trùng | ⚠️ | Enforce ở service (`claim :199-216`, `redeem :181-189`) nhưng **không** có unique index DB → race có thể lách |
| F5 | Không lưu email/sđt trẻ em | ✅ | `create_child` không set email `auth_service.py:123-130`; child login bằng family_code+PIN |

## G. Audit / logging

| # | Hạng mục | KQ | Bằng chứng |
|---|---|---|---|
| G1 | Tạo/sửa/xóa nhiệm vụ ghi audit | ✅ | `task_service.py:119,137,151` `AuditRepository.log` |
| G2 | Tạo/sửa/xóa phần thưởng ghi audit | ✅ | `reward_service.py:98,115,128` |
| G3 | Tạo/sửa tài khoản con ghi audit | ✅ | `auth_service.py:133,167` |
| G4 | Cộng/trừ điểm có audit trail | ✅ | `points_ledger` là audit trail điểm (có `created_by`, `created_at`, kind); manual_adjust ghi thêm `audit_log :368` |
| G5 | Duyệt/từ chối hoàn thành & đổi thưởng truy vết được | ⚠️ | Approve → ledger row (truy vết). **Reject** assignment/redemption chỉ lưu `decided_by/decided_at/reject_reason` trên hàng, **không** ghi `audit_log` (đủ tối thiểu nhưng không tập trung) |

## H. Bảo mật khác

| # | Hạng mục | KQ | Bằng chứng |
|---|---|---|---|
| H1 | JWT ký server-side, claim role/family_id/child_id | ✅ | `security.py:29-45` |
| H2 | PIN/password hash bcrypt | ✅ | `security.py:10-26` |
| H3 | Media validate MIME + size ≤5MB | ✅ | `media_service.py:22-32` (`imghdr` + content_type), MAX_SIZE 5MB |
| H4 | Rate-limit login | ⚠️ | Chưa implement (architecture §6 ghi, build-report §7.5) |
| H5 | JWT secret không hardcode ở prod | ⚠️ | `config.py:8` default dev secret — cần override env prod |
| H6 | Advisory lock chỉ hoạt động PostgreSQL | ⚠️ | `db.py:24-27` no-op trên SQLite (dev/test) → test race không thực sự kiểm chứng được |
