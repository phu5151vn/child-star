# UI States — Ứng dụng tạo điểm loyalty cho con

> Truy vết PRD §9 và Delivery Rules (CLAUDE.md): mọi màn phải có **loading / empty / error**. Bổ sung state đặc thù: phần thưởng **khóa vs mở**, và **điểm không đủ**.

## 1. State chung cho mọi màn

| State | Cách thể hiện (AntD) | Ghi chú |
|---|---|---|
| Loading | `Skeleton` cho danh sách/card, `Spin` cho action, disable nút khi submit | tránh nhảy layout |
| Empty | `Empty` với minh họa hoạt hình + CTA (vd "Chưa có nhiệm vụ, tạo ngay!") | thân thiện trẻ em |
| Error | `Result` (status=error/500) + nút "Thử lại"; lỗi field dùng `Form.Item` help; toast `message.error` cho lỗi thao tác | không lộ chi tiết kỹ thuật cho con |
| Success feedback | `message.success` / `notification`; con: confetti + số điểm chạy lên | gamified |
| Forbidden | `Result` 403 → điều hướng về dashboard đúng role | backend là nguồn quyết định quyền |

## 2. State theo màn tiêu biểu

### S6 — Duyệt hoàn thành
- Loading: skeleton list. Empty: "Không có nhiệm vụ chờ duyệt 🎉". Error: retry.
- Sau duyệt: item rời hàng đợi + toast "Đã cộng N điểm cho [tên con]".
- Race: nếu item đã được thiết bị khác duyệt → hiện thông báo "đã xử lý" và refetch.

### S7 — Duyệt đổi thưởng
- Empty: "Chưa có yêu cầu đổi thưởng".
- **Điểm không đủ tại thời điểm duyệt:** backend trả lỗi → hiển thị "Số dư của con không còn đủ điểm" và không trừ.

### S9 — Dashboard con
- Loading: skeleton điểm + progress. Empty (chưa có mốc thưởng): "Chưa có phần thưởng nào — nhờ bố mẹ thêm nhé!".
- Luôn hiển thị **mốc thưởng gần nhất** + progress bar (nếu có phần thưởng locked).

### S10/S11 — Nhiệm vụ (con)
- Empty available: "Hôm nay chưa có nhiệm vụ mới".
- `submitted`: hiển thị `Steps`/`Tag` "Đang chờ bố mẹ duyệt".
- `rejected`: banner "Bố mẹ nhờ con làm lại: [lý do]" + nút làm lại.
- Nếu `require_proof=true` mà chưa đính kèm ảnh → chặn submit, `Form` báo lỗi.

### S12 — Kho phần thưởng (khóa/mở) ⭐
| Trạng thái | Hiển thị |
|---|---|
| **Unlocked** (số dư ≥ required_points, còn stock) | card đầy màu, nút **"Đổi ngay"**, ribbon "Mở khóa 🎉" |
| **Locked** (số dư < required_points) | card mờ (grayscale nhẹ) + icon 🔒 + `Progress` tới mốc + dòng **"Còn thiếu N điểm"** (teaser – R6) |
| **Hết hàng** (stock = 0) | tag "Hết hàng", disable nút đổi kể cả khi đủ điểm |
| **Đang chờ duyệt đổi** | tag "Đang chờ bố mẹ duyệt", không cho gửi trùng |

### S12 — Điểm không đủ (khi con bấm Đổi)
- Nút "Đổi" chỉ bật khi unlocked; nếu con vẫn thao tác (state cũ) → `Modal`/`message`: **"Con cần thêm N điểm nữa để đổi phần thưởng này"**. Backend luôn kiểm tra lại (BR-X3).

### S13 — Lịch sử điểm
- Empty: "Chưa có giao dịch điểm nào". Mỗi dòng: `Tag` xanh (+, nhiệm vụ) / đỏ (−, đổi thưởng) / xám (điều chỉnh).

## 3. Nguyên tắc feedback gamified
- Mọi mốc đạt được: hiệu ứng ăn mừng (confetti, âm thanh nhẹ, có thể tắt).
- Ngôn từ tích cực, khích lệ; không dùng từ tiêu cực với con khi bị từ chối (dùng "làm lại nhé").
