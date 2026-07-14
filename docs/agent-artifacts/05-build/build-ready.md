# Build Ready — Ứng dụng tạo điểm loyalty cho con ("Bé Ngoan")

> **Cổng chốt trước Stage Build.** Xác nhận đủ điều kiện để Cursor implement. Truy vết toàn bộ: `00-intake/request.md`, `01-product/prd.md`, `02-design/*` (design system Stitch "Bé Ngoan Playful" + 41 assets), `03-architecture/architecture.md`, `04-data/schema.md`, `05-build/implementation-plan.md`.

## 1. Xác nhận readiness

| Điều kiện | Trạng thái |
|---|---|
| Intake + PRD khớp product idea (2 role parent/child, task→điểm, mốc mở khóa reward, teaser locked) | ✅ |
| Design artifacts đủ làm nguồn technical flow (9 màn / ~30 frame state, 41 assets Stitch mapped) | ✅ (xem §2 mapping; ghi chú thiếu ở §7) |
| Architecture chốt (layered, API contract, traceability rule→API→data) | ✅ `03-architecture/architecture.md` |
| Data schema chốt (bảng, CHECK, ledger append-only, idempotency, isolation, audit) | ✅ `04-data/schema.md` |
| Implementation plan theo vertical slices | ✅ `05-build/implementation-plan.md` |
| Open issues được ghi rõ | ✅ §7 |

## 2. Mapping màn hình: web route (canonical) ↔ Stitch asset ↔ endpoint

> UI thực tế build theo **web SPA responsive** (React+AntD), áp **design language Stitch**. Stitch (mobile 390×844) là nguồn thị giác; `navigation.json` là route canonical. Asset ID trỏ tới file trong `02-design/stitch-assets/<id>.png` (URL preview ở `stitch-asset-urls.md`).

| Web (nav.json) | Stitch màn | Assets (state → ID) | Endpoint chính |
|---|---|---|---|
| S0 `/login`,`/profiles` | Stitch S1 | Default `1fb2ccbd…` · Loading `cf85e1a0…` · Error `0cc87711…` | `/auth/*`, `/me` |
| S10 `/child/tasks` | Stitch S2 | Default `a845613a…` · Loading `8ea4b8f2…` · Empty `a1b1aaaf…` · Error `59a61642…` | `GET /tasks` (child) |
| S11 `/child/tasks/:id` | Stitch S3 | Default `22e1c2f1…` · Success `1d268dc7…` · Error `1f0236d0…` | `/tasks/{id}/claim`, `/assignments/{id}/submit` |
| S12 `/child/rewards` | Stitch S4 | Default `bf678f6c…` · Loading `7ad37654…` · Empty `ee1f834a…` · Error `5a821890…` | `GET /rewards` (locked+unlocked) |
| S12 `/child/rewards/:id` | Stitch S5 | Đủ điểm `e48acccb…` · Chưa đủ `c8e4df77…` · Đổi OK `3299d5d7…` · Error `f4fb02ec…` | `GET /rewards/{id}`, `/rewards/{id}/redeem` |
| S9 `/child` + S13 `/child/history` | Stitch S6 | Default `c94da180…` · Loading `75504847…` · Empty `64b33416…` | `/children/{id}/balance`, `/ledger` |
| S8 `/parent/children` + S6 `/parent/approvals` + S7 `/parent/redemptions` | Stitch S7 | Default `6ded1aba…` · Loading `a8599e6d…` · Empty `1a3f4bd2…` · Success `7bcd8947…` · Error `87b55995…` | `/assignments/*/approve\|reject`, `/redemptions/*/approve\|reject`, `/children/{id}` |
| S2 `/parent/tasks` | Stitch S8a | Danh sách `d12bb030…` · Empty `79d6779e…` | `GET /tasks`, `DELETE /tasks/{id}` |
| S3 `/parent/tasks/new`,`:id/edit` | Stitch S8b | Default `1e493163…` · Validation `961d8f79…` · Success `9994c323…` | `POST/PUT /tasks` |
| S4 `/parent/rewards` | Stitch S9a | Danh sách `427218d9…` · Empty `976a6ce5…` | `GET /rewards`, `DELETE /rewards/{id}` |
| S5 `/parent/rewards/new`,`:id/edit` | Stitch S9b | Default `8f1f0baf…` · Validation `f348388e…` · Submitting `2fcf5d4a…` · Success `947e58cc…` | `POST/PUT /rewards` |
| S1 `/parent` (dashboard) | *(không có màn Stitch riêng)* | tái dùng layout Stitch S7 + illustration `8c4bbb55…` | tổng hợp counts (`?status=submitted`, `?status=requested`) |
| Illustrations (tái dùng chéo) | IMAGE | Gia đình `8c4bbb55…` · Kệ trống/gấu buồn `39a3513a…` · Vé phim `3193608d…` · Robot `41805209…` · Kem `f1211423…` | empty/reward mock |

**Ghi chú mapping:**
- Web tách **duyệt hoàn thành (S6)** và **duyệt đổi thưởng (S7)** thành 2 route riêng để traceability sạch, dù Stitch S7 gộp trong 1 màn "Theo dõi con". Cursor build 2 màn nhưng dùng chung visual style của Stitch S7 (section "chờ duyệt" + filter chip).
- Stitch S6 (hồ sơ con) gộp điểm + thống kê + huy hiệu + lịch sử → web tách **S9 dashboard** và **S13 history**.
- **Parent dashboard S1** không có asset Stitch riêng → tái dùng layout S7 + illustration gia đình (ghi ở open issues §7).

## 3. Frontend (yêu cầu build)

- **Stack**: React 18 + Vite + TS + Ant Design 5 + React Router v6 + TanStack Query v5.
- **2 shell theo role** (`navigation.json`): `ParentLayout` (sidebar `Menu` + badge số chờ duyệt), `ChildLayout` (top bar `PointsBadge` + linh vật, bottom tab mobile). `RoleRoute` guard redirect (unauthenticated→/login, wrongRole→defaultRoute). Guard chỉ ẩn/hiện UI — **quyền thật ở backend**.
- **Theme game hoạt hình dễ thương**: `ConfigProvider` tokens Stitch — primary `#7C5CFC`, accent điểm `#FFC531`, success `#3DD598`, error `#FF5C5C`, locked `#C7C2E0`, bg `#FBF7FF`, radius 16 (card 24), font "Baloo 2"/"Nunito"; shadow mềm; confetti khi cộng điểm/mở khóa (tắt được). Chi tiết `02-design/stitch-design-notes.md`.
- **State bắt buộc mọi màn**: loading (`Skeleton`/`Spin`), empty (`Empty`+illustration), error (`Result`+Thử lại), field error (`Form.Item`). Đặc thù:
  - Kho thưởng phân biệt rõ **unlocked** (card sáng + "Đổi ngay") vs **locked** (mờ + 🔒 + `Progress` + **"Còn thiếu N sao"** — teaser R6) vs **out_of_stock** (disable).
  - Đổi khi chưa đủ điểm → message **"Con cần thêm N điểm nữa"**; backend luôn kiểm tra lại (BR-X3).
  - Chi tiết `02-design/states.md`.
- **2 giao diện phân biệt role**: màn con to, nhiều icon, ít chữ, gamified; màn bố mẹ gọn, thiên quản trị nhưng vẫn giữ tông vui.
- **Data**: TanStack Query; invalidate `balance`+`ledger`+hàng đợi khi duyệt/đổi. Component tái dùng theo `02-design/component-inventory.md`.

## 4. Backend (yêu cầu build)

- **FastAPI layered**: router → service/domain → repository (`architecture.md §2`). Router chỉ HTTP + guard; **rule nhạy cảm chỉ ở service**; repository luôn scope `family_id` từ token.
- **Phân quyền** (PRD §4): tạo/sửa/xóa task & reward, duyệt hoàn thành, duyệt đổi thưởng, manual_adjust → **chỉ parent**; claim/submit/redeem/cancel → **chỉ child (own)**. Dependency `require_role`, `require_owner_child`.
- **State machine nhiệm vụ** (no-skip BR-T2): bảng transition hợp lệ; chuyển sai → `INVALID_TRANSITION`.
- **Điểm**:
  - Cộng khi approve, **idempotent** theo `task_assignment_id` (partial unique ledger) — double-approve không cộng trùng (BR-T4).
  - Trừ điểm (đổi thưởng approve, manual_adjust âm): txn + `pg_advisory_xact_lock(child)` + check balance **tại thời điểm duyệt** + không âm (BR-P3, BR-X3) + giảm stock cùng txn (BR-X4).
  - Ledger **append-only** (BR-P5); sửa sai bằng dòng bù.
- **Ràng buộc đổi thưởng**: chỉ khi unlocked & còn stock (BR-X1); duyệt mới trừ điểm (BR-X2); từ chối/hủy không trừ (BR-X5).
- **Media**: validate MIME+magic bytes+size ≤5MB; serve có auth + ownership; `StorageBackend` (local giai đoạn 1).
- **Audit**: `audit_log` cho thay đổi cấu hình rule; ledger cho điểm.
- **Cô lập family**: server-side bắt buộc; RLS PostgreSQL tùy chọn (D2).

## 5. Queue / batch

- **Không dùng Redis/Celery giai đoạn 1** (D5). Không có job nền bắt buộc. Hàng đợi "chờ duyệt", thông báo con đạt mốc → hiển thị **in-app** qua refetch/polling TanStack Query (invalidate sau mutation).
- Điểm mở rộng sau (ngoài scope): nhắc nhở định kỳ, reset nhiệm vụ lặp lại (Q2), thông báo đẩy → khi đó mới cân nhắc Celery/Redis.

## 6. Test strategy

| Loại | Phạm vi | Ca tiêu biểu |
|---|---|---|
| **Unit (service)** | tính điểm & rule | balance = SUM(ledger); transition hợp lệ/không (chặn `available→approved`); cộng điểm idempotent (double-approve → +1 lần); trừ không âm; unlock & `missing_points` đúng; stock giảm đúng |
| **Integration (API)** | endpoint + phân quyền + isolation | parent-only/child-only (403 `FORBIDDEN_ROLE`); con A không thấy dữ liệu con B / family khác; luồng task end-to-end; luồng redemption end-to-end; validate points≤0/required_points≤0 → 422 |
| **Race condition** | trừ điểm song song | 2 approve redemption cùng con đồng thời → 1 thành công, 1 nhận `INSUFFICIENT_POINTS`, không âm điểm (advisory lock); double-approve assignment đồng thời → cộng đúng 1 lần |
| **Media** | upload | sai MIME/quá 5MB → từ chối; con không tải media family khác |
| **E2E (Playwright, tùy chọn)** | 2 luồng chính | parent tạo task→con làm→duyệt→điểm tăng→đổi thưởng→duyệt→điểm giảm; kiểm loading/empty/error |

## 7. Open issues (bàn giao — cần PO/bố mẹ xác nhận, không chặn bắt đầu build)

1. **Q1–Q6 (intake §8)**: architecture/schema đã dùng đề xuất mặc định (nhiều con: có; nhiệm vụ 1 lần; đổi thưởng cần duyệt; ảnh minh chứng tùy chọn; điểm không hết hạn; con login `family_code`+avatar+PIN). PO chốt lại trước khi khóa scope.
2. **Auth con (D1)**: chốt `family_code`+avatar+PIN. Cần PO xác nhận cơ chế chia sẻ `family_code` an toàn (không lộ ra ngoài gia đình).
3. **RLS (D2)**: giai đoạn 1 dùng server-side isolation bắt buộc; RLS lớp 2 tùy chọn — quyết định bật/không tùy thời gian.
4. **Parent dashboard S1**: chưa có asset Stitch riêng — Cursor tái dùng layout Stitch S7 + illustration gia đình. Nếu PO muốn màn dashboard riêng, cần bổ sung design.
5. **Web vs mobile Stitch (D7)**: Stitch là mobile 390×844; build là web responsive. Đã chốt áp design language qua tokens; nếu PO muốn app mobile native → ngoài scope giai đoạn 1 (intake §6).
6. **Illustration assets**: 41 PNG là screenshot preview (link ký có thể hết hạn). Ảnh minh họa dùng trong app nên export/lưu bản chính thức; hiện dùng làm tham chiếu thị giác.
7. **Đơn vị điểm**: dùng số nguyên "sao ⭐"; xác nhận không cần điểm phân số.

## 8. Next step

1. Chạy `bash ./scripts/verify-artifacts.sh build`
2. Nếu pass, mở Cursor và paste `prompts/cursor-build-from-approved-plan.md`
