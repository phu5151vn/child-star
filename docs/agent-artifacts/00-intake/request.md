# Intake Request — Ứng dụng tạo điểm loyalty cho con

> **Nguồn sự thật duy nhất:** ý tưởng sản phẩm được cung cấp trong run này (không có BRD/Excel bên ngoài). Mọi phần dưới đây chỉ chuẩn hóa và làm rõ, **không suy diễn ngoài phạm vi** đã nêu. Các mục đánh dấu `[ASSUMPTION]` là giả định hợp lý để triển khai, cần bố mẹ/PO xác nhận.

## 1. Tóm tắt sản phẩm

Ứng dụng web mang phong cách **game hoá (gamification)** giúp gia đình khuyến khích con hoàn thành nhiệm vụ hằng ngày bằng cơ chế **điểm thưởng (loyalty points)**. Giao diện theo hướng **hoạt hình, dễ thương, thân thiện với trẻ em** (hình ảnh ngộ nghĩnh, màu sắc tươi sáng).

Cơ chế cốt lõi:

```
Bố mẹ tạo NHIỆM VỤ (kèm điểm) + PHẦN THƯỞNG (kèm mốc điểm)
          │
          ▼
Con CHỌN nhiệm vụ ──► làm ──► báo hoàn thành
          │
          ▼
Bố mẹ DUYỆT hoàn thành ──► CỘNG điểm cho con
          │
          ▼
Con tích lũy điểm ──► MỞ KHÓA phần thưởng khi đủ mốc điểm ──► ĐỔI thưởng (TRỪ điểm)
```

Phần thưởng chưa đủ điểm vẫn hiển thị (dạng **teaser/locked**) để con thấy mục tiêu và có động lực phấn đấu.

## 2. Các vai trò (roles)

Đúng **2 role** theo yêu cầu:

| Role | Tên hiển thị | Vai trò |
|---|---|---|
| `parent` | Bố mẹ | Người quản trị trong gia đình: tạo/quản lý nhiệm vụ và phần thưởng, duyệt hoàn thành, duyệt đổi thưởng, theo dõi tiến độ của con. |
| `child` | Con | Người chơi chính: chọn nhiệm vụ, hoàn thành, tích điểm, xem kho phần thưởng và đổi thưởng. |

## 3. Yêu cầu chức năng (trích nguyên văn từ ý tưởng → chuẩn hóa)

| # | Yêu cầu gốc | Diễn giải chuẩn hóa |
|---|---|---|
| R1 | "Yêu cầu như 1 ứng dụng game, với các hình ảnh mang tính hoạt hình, dễ thương." | UI phong cách game/hoạt hình: nhân vật ngộ nghĩnh, màu tươi sáng, bo góc lớn, hiệu ứng vui nhộn (âm thanh/animation nhẹ khi hoàn thành). |
| R2 | "Có 2 role là bố mẹ - con." | Hệ thống có đúng 2 role `parent` và `child`. |
| R3 | "Bố mẹ có thể tạo các nhiệm vụ và phần thưởng." | Bố mẹ CRUD nhiệm vụ (task) và phần thưởng (reward), cấu hình điểm/mốc điểm. |
| R4 | "con có thể chọn nhiệm vụ với các điểm tương ứng." | Con xem danh sách nhiệm vụ khả dụng, mỗi nhiệm vụ hiển thị điểm thưởng; con chọn nhận nhiệm vụ. |
| R5 | "phần thưởng sẽ có 1 số mốc điểm, con đạt được số điểm có thể mở khoá để dùng điểm đổi." | Mỗi phần thưởng có mốc điểm yêu cầu (`required_points`). Khi tổng điểm con ≥ mốc, phần thưởng được mở khóa và con có thể đổi (trừ điểm). |
| R6 | "có thể cho con thấy các phần thưởng chưa đủ điểm để con có động lực phấn đấu." | Kho phần thưởng hiển thị cả phần thưởng **chưa đủ điểm** ở trạng thái khóa (teaser), kèm số điểm còn thiếu để tạo động lực. |

## 4. Cơ chế nghiệp vụ cốt lõi (đã chuẩn hóa)

1. **Nhiệm vụ → điểm:** mỗi nhiệm vụ có số điểm thưởng do bố mẹ đặt. Con hoàn thành và được bố mẹ duyệt → cộng điểm.
2. **Trạng thái nhiệm vụ:** `available → chosen/in-progress → submitted → approved | rejected`.
3. **Cộng điểm:** chỉ cộng khi bố mẹ **duyệt (approved)**, không tự cộng khi con tự đánh dấu.
4. **Phần thưởng theo mốc điểm:** so sánh tổng điểm hiện có của con với `required_points`.
5. **Đổi thưởng:** khi đủ điểm, con gửi yêu cầu đổi; bố mẹ duyệt → trừ điểm. Không cho đổi khi chưa đủ điểm.
6. **Teaser:** phần thưởng chưa đủ điểm hiển thị bị khóa + số điểm còn thiếu.

## 5. Ràng buộc & nguyên tắc

- **Backend là nơi enforce** role, permission, chuyển trạng thái, cộng/trừ điểm và điều kiện mở khóa. Frontend **không tự quyết** business rule nhạy cảm.
- **An toàn cho trẻ em:** tài khoản con do bố mẹ tạo và quản lý; không thu thập dữ liệu nhạy cảm ngoài phạm vi (không email/sđt trẻ em, không thanh toán thật, không quảng cáo bên thứ ba).
- Mọi thao tác cộng/trừ điểm phải có **lịch sử (ledger)** để truy vết.

## 6. Phạm vi (scope)

**Trong scope:**
- Quản lý nhiệm vụ, phần thưởng, mốc điểm.
- Chọn nhiệm vụ, báo hoàn thành, duyệt hoàn thành.
- Tích điểm, mở khóa phần thưởng, đổi thưởng, duyệt đổi thưởng.
- Dashboard tiến độ cho con (thanh điểm) và tổng quan cho bố mẹ.
- UI hoạt hình dễ thương, có loading/empty/error state.

**Ngoài scope (cho các stage sau, không triển khai lần này):**
- Thanh toán thật / mua điểm bằng tiền.
- Mạng xã hội, so sánh giữa nhiều gia đình.
- Thông báo đẩy/email marketing.
- App mobile native (chỉ web responsive).

## 7. Cơ chế đính kèm minh chứng (upload) — `[ASSUMPTION – đưa vào scope tùy chọn]`

Ý tưởng gốc không nêu rõ upload minh chứng. Tuy nhiên để bố mẹ duyệt hoàn thành đáng tin cậy, đề xuất đưa vào scope **tùy chọn**: khi con báo hoàn thành, có thể đính kèm 1 ảnh minh chứng (optional). Bố mẹ xem ảnh khi duyệt. Nếu PO không muốn, có thể tắt tính năng này mà không ảnh hưởng luồng chính. → Chi tiết hóa trong PRD.

## 8. Open questions (cần bố mẹ/PO xác nhận)

| # | Câu hỏi | Đề xuất mặc định |
|---|---|---|
| Q1 | 1 gia đình có nhiều con không? | Có, hỗ trợ nhiều con trong 1 gia đình. `[ASSUMPTION]` |
| Q2 | Nhiệm vụ có lặp lại (hằng ngày/tuần) không? | Giai đoạn 1 chỉ nhiệm vụ 1 lần; lặp lại để stage sau. `[ASSUMPTION]` |
| Q3 | Đổi thưởng có cần bố mẹ duyệt không, hay tự động trừ điểm? | Cần bố mẹ duyệt để tránh đổi nhầm; sau duyệt mới trừ điểm. `[ASSUMPTION]` |
| Q4 | Có cho phép upload ảnh minh chứng không? | Có, dạng tùy chọn (mục 7). `[ASSUMPTION]` |
| Q5 | Điểm có hạn sử dụng/hết hạn không? | Không hết hạn ở giai đoạn 1. `[ASSUMPTION]` |
| Q6 | Con đăng nhập bằng gì (tránh dữ liệu nhạy cảm)? | Bố mẹ tạo username + mã PIN/đơn giản cho con; không dùng email trẻ em. `[ASSUMPTION]` |

## 9. Truy vết (traceability)

Mọi mục R1–R6 (§3) đều ánh xạ trực tiếp từ 5 câu mô tả ý tưởng gốc. Các mục `[ASSUMPTION]` được đánh dấu rõ ràng và sẽ được PRD kế thừa cùng nhãn để bố mẹ/PO xác nhận trước khi build.
