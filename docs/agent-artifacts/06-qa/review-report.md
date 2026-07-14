# Review Report — Ứng dụng tạo điểm loyalty cho con ("Bé Ngoan")

> Stage 5 (Claude Review after build). Nguồn đối chiếu: `01-product/prd.md`, `03-architecture/architecture.md`, `04-data/schema.md`, `02-design/*`, code `backend/` + `frontend/`. Chi tiết theo hạng mục: `06-qa/checklist.md`. **Không sửa code ở stage này.**

## 1. Kết luận

**PASS WITH ISSUES.**

Sản phẩm bám sát PRD và design: đúng 2 role `parent`/`child`, cơ chế nhiệm vụ → điểm → phần thưởng theo mốc (unlock) với teaser locked hiển thị đầy đủ. Kiến trúc layered (router → service → repository) được tôn trọng; **phân quyền và cô lập gia đình enforce ở backend**, không phát hiện rò rỉ dữ liệu cross-family (IDOR) qua các endpoint đã rà. Điểm là **derived từ ledger append-only**, unlock/`missing_points` tính đúng, UI game hoá dễ thương theo tokens Stitch.

Tuy nhiên tồn tại **1 nhóm blocker về idempotency/race điểm** (đúng khu vực trọng tâm review): các **partial unique index** mà `architecture §2.2` và `schema §2.7` cam kết **chưa được hiện thực** ở tầng DB, và `approve` assignment **không có advisory lock** — nên dưới truy cập đồng thời có thể **cộng/trừ điểm trùng**. Ở luồng tuần tự (single-click) hệ thống hoạt động đúng nhờ kiểm tra ở service, nhưng đảm bảo "không double-count / không double-deduct" mà tài liệu hứa **chưa đạt** khi có concurrency. Build-report §7.8 đã tự thừa nhận thiếu index này.

## 2. Blocker (phải sửa trước khi merge/lên production)

### BLK-1 — Race double-count khi duyệt hoàn thành nhiệm vụ đồng thời
- **Vị trí:** `backend/app/services/task_service.py:251-280` (`AssignmentService.approve`), models `backend/app/models/__init__.py:169-178`.
- **Vấn đề:** Idempotency dựa trên check-then-insert (`status`, `has_ledger_for_assignment`) **không** có advisory lock và **không** có unique index `points_ledger(task_assignment_id) WHERE kind='task_approved'`. Hai request approve cùng 1 assignment gần như đồng thời (vd bố mẹ double-click, 2 thiết bị) đều vượt qua check → ghi 2 dòng `+points` → **cộng trùng điểm**.
- **Cam kết bị vi phạm:** BR-T4; architecture §2.2 ("ledger có `UNIQUE(kind='task_approved', task_assignment_id)`"); schema §2.7.
- **Đề xuất:** tạo partial unique index đúng như schema (qua Alembic hoặc `Index(..., postgresql_where=...)`); DB sẽ raise trên INSERT thứ 2 → service bắt và trả 200 idempotent.

### BLK-2 — Race double-deduct khi duyệt đổi thưởng đồng thời
- **Vị trí:** `backend/app/services/reward_service.py:200-241` (`RedemptionService.approve`).
- **Vấn đề:** `advisory_lock_child` tuần tự hóa theo con, **nhưng** `has_ledger_for_redemption` được kiểm **trước** khi lấy lock và **không** kiểm lại **sau** khi giữ lock; thiếu unique index `points_ledger(reward_redemption_id)`. Kết quả: 2 request approve cùng 1 redemption → dòng thứ 2 vẫn ghi ledger `-required_points` và giảm stock lần nữa (nếu balance còn đủ), redemption bị "approve 2 lần".
- **Cam kết bị vi phạm:** BR-X2/X3/X4; architecture §2.2; schema §2.7 ("Idempotency đổi thưởng").
- **Đề xuất:** thêm partial unique index reward_redemption_id; và/hoặc lấy advisory lock **trước** mọi kiểm tra idempotency rồi re-check `status`/`has_ledger` sau khi giữ lock.

> Ghi chú mức độ: cả BLK-1/BLK-2 chỉ phát tác dưới truy cập đồng thời trên PostgreSQL; luồng đơn (single request) đúng. Nhưng do thuộc nhóm "logic điểm / race" mà review đặt là blocker, và tài liệu đã hứa cơ chế này, cần đóng trước khi coi là an toàn cho production. Kèm theo cần bổ sung **test race thực sự trên PostgreSQL** (test hiện chạy SQLite → advisory lock no-op, không kiểm chứng được).

## 3. Issue (nên sửa trước release)

- **ISS-1 (data/contract):** Thiếu các partial unique index chống nhận/gửi trùng: `task_assignments(task_id,child_id) WHERE status IN ('in_progress','submitted')`, `reward_redemptions(reward_id,child_id) WHERE status='requested'`, và unique `users(family_id, lower(display_name))` cho con (schema §2.2/2.4/2.6). Hiện chỉ enforce ở service. → `models/__init__.py`.
- **ISS-2 (security, thấp):** `GET /media/{id}` chỉ kiểm `family_id`, không kiểm ownership của con với ảnh `proof` → anh/chị em cùng nhà có thể xem ảnh minh chứng của nhau. `media_service.py:62-69`.
- **ISS-3 (validate):** `proof_media_id` khi submit không được validate tồn tại/thuộc family/child. `task_service.py:245`.
- **ISS-4 (validate):** `ManualAdjustRequest.delta = Field(..., exclude=0)` dùng sai — `exclude` không phải constraint nên `delta=0` lọt Pydantic, chỉ bị DB CHECK chặn muộn (500 thay vì 422). `schemas/__init__.py:87`.
- **ISS-5 (append-only):** Chưa có trigger/REVOKE ở DB chặn UPDATE/DELETE trên `points_ledger` như schema §2.7 khuyến nghị (hiện chỉ dựa vào kỷ luật service).
- **ISS-6 (audit):** Reject assignment/redemption chỉ lưu `decided_by/decided_at/reject_reason` trên hàng, không ghi `audit_log` tập trung (G5).
- **ISS-7 (FE state):** `ChildHomePage` thiếu loading/error state (`ChildPages.tsx:15-44`). Các màn danh sách khác đã đủ qua `PageState`.
- **ISS-8 (UX/design):** Empty state dùng AntD `Empty` mặc định, chưa nhúng illustration Stitch; upload ảnh (task/reward/proof) chưa gắn UI đầy đủ (build-report §7.3/§7.7).
- **ISS-9 (dead code):** `ASSIGNMENT_TRANSITIONS` (`task_service.py:24`) không được dùng — nên nối vào state machine hoặc xóa để tránh nhầm.
- **ISS-10 (bảo mật vận hành):** Chưa rate-limit login (H4); `JWT_SECRET` mặc định dev (`config.py:8`) cần bắt buộc override env ở production.

## 4. Điểm đạt tốt (ghi nhận)

- Phân quyền backend nhất quán với role matrix PRD §4 (`require_role`, `require_owner_child`); test xác nhận child bị 403 ở endpoint parent.
- Cô lập family qua `family_id` từ JWT claim ở mọi getter; không nhận `family_id`/`role` từ client.
- Balance derived từ ledger; unlock + `missing_points` + out_of_stock tính đúng; teaser locked hiển thị cả API lẫn UI (đúng R6).
- No-skip state machine (available→approved bị chặn) và kiểm balance tại thời điểm duyệt (BR-X3) đã có.
- UI bám design system "Bé Ngoan Playful" (màu pastel, bo tròn lớn, font vui, confetti, ngôn từ khích lệ).

## 5. Next step

Verdict **không PASS** → **bắt buộc chạy chuỗi resolve**:

1. `claude-generate-resolve-plan` — lập kế hoạch sửa **BLK-1, BLK-2** (partial unique index idempotency + advisory lock/re-check ở approve) và ISS-1 (unique index chống trùng), kèm bổ sung test race trên PostgreSQL.
2. `cursor-resolve-review-issues` — Cursor implement theo resolve plan (ưu tiên blocker; issue nên gộp ISS-1..ISS-4, ISS-7).
3. `claude-recheck-after-resolve` — re-review, chốt verdict.

Sau khi 2 blocker được đóng và có test race pass trên PostgreSQL, sản phẩm đủ điều kiện chuyển sang runtime verification / demo / merge.
