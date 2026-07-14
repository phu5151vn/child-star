# Stitch Screen Inventory — Bé Ngoan (Ứng dụng tạo điểm loyalty cho con)

> Đây là inventory **UI thực tế đã generate bằng Stitch MCP** (mobile, phong cách game hoạt hình dễ thương), truy vết từ `ui-design-prompt.md`.
> Khác với `screen-inventory.md` (bản Stage-1 mô tả hướng web/AntD) — file này phản ánh output Stitch dùng cho bản mobile.
>
> - **Stitch project**: `projects/2642533722835314844`
> - **Design system**: `assets/12629943742838520232` ("Bé Ngoan Playful")
> - **Device**: MOBILE 390×844
> - **Model**: Gemini (PRO_AGENT), style: cartoon/pastel/rounded
> - Chi tiết URL ảnh & mã HTML: xem `stitch-asset-urls.md`. Bảng màu & token: xem `stitch-design-notes.md`.

## Tab bar theo role
- **Con** (3 tab): Nhiệm vụ · Phần thưởng · Của con
- **Bố mẹ** (3 tab): Nhiệm vụ · Phần thưởng · Theo dõi con

## Danh sách màn (9 màn / 11 frame chính, mỗi frame kèm state variant)

### S1 — Chọn vai trò & Đăng nhập
- **Role**: public. **Route**: `onboarding/role`.
- **Mục đích**: chọn vai trò Con / Bố mẹ; bố mẹ đăng nhập (username/SĐT + mật khẩu), con vào bằng avatar + PIN 4 số.
- **States**: Default · Loading (spinner trong nút) · Error (alert "Sai tài khoản hoặc mật khẩu").

### S2 — Nhiệm vụ của con (Con · Tab 1)
- **Route**: `(child)/tasks`.
- **Mục đích**: header chào + huy hiệu điểm; banner động lực; category chips; list task card (icon pastel, điểm `+30 ⭐`, badge trạng thái).
- **States**: Default · Loading (3 skeleton) · Empty (thú ngủ) · Error (mây buồn + Thử lại).

### S3 — Chi tiết & Nhận nhiệm vụ (Con)
- **Route**: `(child)/tasks/[id]`.
- **Mục đích**: hero nhiệm vụ, grid thông tin 2 cột, "Bố mẹ dặn", ô nộp ảnh minh chứng, sticky "Nhận nhiệm vụ" / "Hoàn thành ✅".
- **States**: Default · Success (confetti "Chờ bố mẹ duyệt 🎉") · Error (toast).

### S4 — Cửa hàng phần thưởng (Con · Tab 2)
- **Route**: `(child)/rewards`.
- **Mục đích**: progress tổng tới mốc gần nhất; grid quà 2 cột với **2 variant card**: unlocked (đủ điểm → nút Đổi) và locked (mờ + ổ khoá + progress "320/350" + "Còn 30 sao" — vẫn hiện để tạo động lực).
- **States**: Default · Loading (4 skeleton) · Empty (kệ quà trống) · Error.

### S5 — Chi tiết phần thưởng & Đổi điểm (Con)
- **Route**: `(child)/rewards/[id]`.
- **Mục đích**: hero quà, trạng thái đủ/chưa đủ điểm + gợi ý, sticky "Đổi ngay (350 ⭐)" hoặc nút disabled + ổ khoá.
- **States**: Đủ điểm · Chưa đủ điểm · Đổi thành công (confetti mở hộp quà) · Error.

### S6 — Của con / Hồ sơ (Con · Tab 3)
- **Route**: `(child)/profile`.
- **Mục đích**: avatar + cấp độ, card điểm lớn, 3 ô thống kê, bộ sưu tập huy hiệu, lịch sử điểm (+xanh / −đỏ).
- **States**: Default · Loading · Empty (lịch sử trống).

### S7 — Theo dõi con / Bảng điều khiển (Bố mẹ · Tab 3)
- **Route**: `(parent)/children`.
- **Mục đích**: chọn con (chips), card tổng quan; section "Nhiệm vụ chờ duyệt" với nút Duyệt ✅ / Từ chối + thumbnail minh chứng; hoạt động gần đây; filter Chờ duyệt/Đã duyệt/Đã đổi quà.
- **States**: Default · Loading · Empty ("Chưa có nhiệm vụ chờ duyệt 🎉") · Success (toast "Đã duyệt và cộng 30 sao") · Error.

### S8a — Quản lý nhiệm vụ (Bố mẹ · Tab 1)
- **Route**: `(parent)/tasks`.
- **Mục đích**: filter chips, list task card (điểm, loại, toggle bật/tắt, avatar con được gán), FAB tạo mới.
- **States**: Danh sách · Empty (nút "Tạo nhiệm vụ đầu tiên").

### S8b — Tạo/Sửa nhiệm vụ (Bố mẹ)
- **Route**: `(parent)/tasks/new`, `(parent)/tasks/[id]/edit`.
- **Trường**: tên*, chọn icon/màu, điểm* (stepper), loại (chips), gán cho (multi-select), lặp lại, hạn, "Cần duyệt" (toggle mặc định bật), ghi chú.
- **States**: Default · Validation error (border đỏ) · Submitting/Success (toast "Đã tạo nhiệm vụ!").

### S9a — Quản lý phần thưởng (Bố mẹ · Tab 2)
- **Route**: `(parent)/rewards`.
- **Mục đích**: grid 2 cột reward card (ảnh, mốc điểm, toggle, số lần đã đổi), FAB tạo mới.
- **States**: Danh sách · Empty (nút "Thêm phần thưởng").

### S9b — Tạo/Sửa phần thưởng (Bố mẹ)
- **Route**: `(parent)/rewards/new`, `(parent)/rewards/[id]/edit`.
- **Trường**: tên*, ảnh (upload/mẫu), mốc điểm cần đổi* (ngưỡng mở khoá), giới hạn đổi, dành cho (multi-select), mô tả.
- **States**: Default · Validation error · Submitting · Success (toast "Đã thêm phần thưởng!").

## Illustration (ảnh minh hoạ tạo kèm, tái dùng chéo màn)
- Gia đình dễ thương (S1, S7) · Kệ quà trống + gấu buồn (empty states) · Vé xem phim · Robot đồ chơi · Kem ốc quế (reward cards).
