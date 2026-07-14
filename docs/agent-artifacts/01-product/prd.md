# PRD — Ứng dụng tạo điểm loyalty cho con

> **Nguồn sự thật:** `docs/agent-artifacts/00-intake/request.md` (chuẩn hóa từ product idea của run này). Mọi rule ở đây đều truy vết về R1–R6 và §4 của intake. Các mục `[ASSUMPTION]` kế thừa nhãn từ intake, cần bố mẹ/PO xác nhận trước khi build.

## 1. Mục tiêu sản phẩm

Xây dựng ứng dụng web gamification giúp gia đình khuyến khích con hoàn thành nhiệm vụ bằng cơ chế điểm thưởng (loyalty points), với UI hoạt hình dễ thương. Con tích điểm qua nhiệm vụ được bố mẹ duyệt, rồi đổi điểm lấy phần thưởng khi đủ mốc điểm; phần thưởng chưa đủ điểm vẫn hiển thị dạng khóa để tạo động lực.

**Chỉ số thành công (định hướng):**
- Con hoàn thành ≥ 1 nhiệm vụ/tuần và thấy được tiến độ tới mốc thưởng gần nhất.
- Bố mẹ tạo nhiệm vụ/phần thưởng và duyệt hoàn thành trong ≤ 3 thao tác.
- Không rò rỉ dữ liệu nhạy cảm của trẻ (không email/sđt trẻ, không thanh toán thật).

## 2. Phạm vi (bám §6 intake)

**Trong scope:** quản lý nhiệm vụ/phần thưởng/mốc điểm; nhận & báo hoàn thành nhiệm vụ; duyệt hoàn thành; tích điểm qua ledger; mở khóa & đổi thưởng; duyệt đổi thưởng; dashboard tiến độ cho con và tổng quan cho bố mẹ; upload ảnh minh chứng (tùy chọn, Q4); UI hoạt hình có loading/empty/error.

**Ngoài scope giai đoạn 1:** thanh toán thật, mạng xã hội/so sánh giữa các gia đình, push/email marketing, app native, nhiệm vụ lặp lại (Q2 – để stage sau), hết hạn điểm (Q5).

## 3. Đối tượng & vai trò

| Role | Mô tả | Cách đăng nhập |
|---|---|---|
| `parent` (Bố mẹ) | Quản trị hộ gia đình. Tạo/sửa/xóa nhiệm vụ & phần thưởng, duyệt hoàn thành, duyệt đổi thưởng, xem toàn bộ sổ điểm. | Email + mật khẩu. |
| `child` (Con) | Người chơi. Nhận nhiệm vụ, báo hoàn thành, xem kho thưởng, gửi yêu cầu đổi, xem sổ điểm của chính mình. | Username + PIN do bố mẹ tạo, không dùng email/sđt trẻ. `[ASSUMPTION Q6]` |

Mỗi tài khoản gắn với một **hộ gia đình (family)**. Một gia đình có 1..n bố mẹ và 1..n con `[ASSUMPTION Q1]`. Dữ liệu bị cô lập theo `family_id`.

## 4. Role matrix (quyền chi tiết)

Ký hiệu: ✅ được phép · ❌ không · 👁 chỉ đọc · (own) chỉ dữ liệu của chính mình.

| Hành động | Bố mẹ | Con |
|---|---|---|
| Tạo/sửa/xóa nhiệm vụ | ✅ | ❌ |
| Tạo/sửa/xóa phần thưởng & mốc điểm | ✅ | ❌ |
| Xem danh sách nhiệm vụ khả dụng | ✅ | ✅ |
| Nhận (chọn) nhiệm vụ | ❌ (thay mặt: gán cho con, tùy chọn) | ✅ |
| Báo hoàn thành nhiệm vụ (+ ảnh minh chứng) | ❌ | ✅ (own) |
| Duyệt / từ chối hoàn thành | ✅ | ❌ |
| Cộng điểm | Hệ thống thực hiện khi bố mẹ duyệt (không sửa tay) | ❌ |
| Xem kho phần thưởng (khóa/mở) | ✅ | ✅ |
| Gửi yêu cầu đổi thưởng | ❌ | ✅ (own, khi đủ điểm) |
| Duyệt / từ chối đổi thưởng | ✅ | ❌ |
| Xem sổ điểm (points ledger) | ✅ (toàn gia đình) | 👁 (own) |
| Quản lý tài khoản con | ✅ | ❌ |
| Điều chỉnh điểm thủ công (thưởng/phạt) | ✅ `[ASSUMPTION]` (ghi ledger + lý do) | ❌ |

> **Enforce ở backend:** toàn bộ ma trận trên do backend kiểm soát (router → service → repository). Frontend chỉ ẩn/hiện UI theo role; không được coi là nơi enforce.

## 5. Vòng đời & business rules

### 5.1 Trạng thái nhiệm vụ (task assignment)

```
available ──(con nhận)──► in_progress ──(con báo HT)──► submitted
                                                          │
                                    (bố mẹ duyệt) ────────┼────► approved  (+ cộng điểm)
                                    (bố mẹ từ chối) ──────┴────► rejected  (quay lại in_progress hoặc available)
```

**Rules (backend enforce):**
- **BR-T1:** Chỉ `child` thuộc đúng gia đình mới nhận được nhiệm vụ `available`. Một assignment gắn với đúng 1 con.
- **BR-T2:** No-skip: không thể chuyển thẳng `available → approved`. Bắt buộc qua `submitted`.
- **BR-T3:** Chỉ `parent` mới chuyển `submitted → approved | rejected`.
- **BR-T4:** Khi `approved`, hệ thống ghi 1 dòng ledger `+points` cho con (idempotent theo `assignment_id` để tránh cộng trùng).
- **BR-T5:** `rejected` không cộng điểm; kèm lý do (tùy chọn) để con làm lại; assignment quay về `in_progress`.
- **BR-T6:** Một nhiệm vụ 1 lần (Q2). `[ASSUMPTION]` Nhiệm vụ lặp lại nằm ngoài scope giai đoạn 1.

### 5.2 Điểm (points ledger)

- **BR-P1:** Số dư điểm của con = tổng đại số các dòng ledger của con đó. Không lưu số dư rời rạc dễ lệch; nếu cache số dư thì phải tái tính được từ ledger.
- **BR-P2:** Nguồn cộng điểm: `task_approved`. Nguồn trừ điểm: `reward_redeemed`. Nguồn khác: `manual_adjust` (bố mẹ, có lý do).
- **BR-P3:** Điểm không âm: mọi giao dịch trừ phải kiểm tra số dư ≥ số điểm trừ tại thời điểm commit (khóa/transaction ở backend).
- **BR-P4:** Điểm không hết hạn ở giai đoạn 1 (Q5). `[ASSUMPTION]`
- **BR-P5:** Mọi thay đổi điểm bắt buộc ghi ledger (audit trail), không sửa/xóa dòng ledger đã ghi (append-only); điều chỉnh sai bằng dòng bù trừ.

### 5.3 Phần thưởng & mở khóa

- **BR-R1:** Mỗi phần thưởng có `required_points` (mốc điểm) do bố mẹ đặt (bắt buộc, > 0).
- **BR-R2:** Trạng thái hiển thị với con: **unlocked** khi `số dư điểm ≥ required_points`, ngược lại **locked** kèm số điểm còn thiếu (teaser – R6).
- **BR-R3:** Kho thưởng hiển thị cả phần thưởng khóa lẫn mở (không ẩn phần thưởng chưa đủ điểm).
- **BR-R4:** Phần thưởng có thể có `stock` (số lượng, tùy chọn); hết stock thì hiển thị "hết hàng", không đổi được.

### 5.4 Đổi thưởng (redemption)

```
child yêu cầu đổi ──► requested ──(bố mẹ duyệt)──► approved (TRỪ điểm) 
                                └(bố mẹ từ chối)──► rejected (không trừ điểm)
```

- **BR-X1:** Chỉ đổi được phần thưởng đang **unlocked** (đủ điểm) và còn stock.
- **BR-X2:** Đổi thưởng cần bố mẹ duyệt (Q3). `[ASSUMPTION]` Chỉ khi `approved` mới ghi ledger `-required_points`.
- **BR-X3:** Kiểm tra số dư đủ điểm **tại thời điểm duyệt** (không chỉ lúc gửi yêu cầu), trong transaction, tránh đổi vượt điểm khi có nhiều yêu cầu song song.
- **BR-X4:** Khi `approved` và có stock: giảm stock 1 đơn vị trong cùng transaction.
- **BR-X5:** Từ chối/hủy không trừ điểm và không đổi stock.

## 6. Trường bắt buộc

### 6.1 Nhiệm vụ (task)
| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `title` | ✅ | tối đa ~80 ký tự |
| `points` | ✅ | số nguyên > 0 |
| `description` | ❌ | mô tả cách làm |
| `icon`/`image` | ❌ | ảnh minh họa hoạt hình (upload, §7) |
| `require_proof` | ❌ | mặc định false; nếu true, báo hoàn thành phải kèm ảnh minh chứng |
| `active` | ✅ | mặc định true; ẩn khỏi danh sách con nếu false |

### 6.2 Phần thưởng (reward)
| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `title` | ✅ | |
| `required_points` | ✅ | số nguyên > 0 (mốc điểm) |
| `description` | ❌ | |
| `image` | ❌ | ảnh phần thưởng hoạt hình |
| `stock` | ❌ | null = không giới hạn |
| `active` | ✅ | mặc định true |

## 7. Upload hình ảnh / minh chứng

- **Icon/ảnh nhiệm vụ & phần thưởng:** do bố mẹ upload (tùy chọn). Định dạng ảnh (png/jpg/webp), giới hạn dung lượng (đề xuất ≤ 5MB), validate MIME + kích thước ở backend.
- **Ảnh minh chứng hoàn thành (Q4):** con có thể đính kèm khi báo hoàn thành; **bắt buộc** nếu `task.require_proof = true`. Bố mẹ xem ảnh khi duyệt.
- **Enforce backend:** kiểm tra loại file, dung lượng, quyền sở hữu (con chỉ upload cho assignment của mình); lưu qua storage có kiểm soát, không lộ đường dẫn tùy tiện. Không thu thập metadata nhạy cảm.

## 8. Use cases chính & acceptance criteria

- **UC-P1 Tạo nhiệm vụ:** bố mẹ nhập title + points (+icon) → lưu → xuất hiện trong danh sách con. *AC:* points ≤ 0 hoặc thiếu title → backend từ chối.
- **UC-P2 Duyệt hoàn thành:** bố mẹ thấy hàng đợi `submitted` → duyệt → điểm con tăng đúng bằng `task.points`, ledger có 1 dòng, không cộng trùng khi bấm 2 lần.
- **UC-P3 Tạo phần thưởng + mốc điểm:** bố mẹ nhập title + required_points → xuất hiện trong kho thưởng của con.
- **UC-P4 Duyệt đổi thưởng:** bố mẹ duyệt yêu cầu đổi → điểm con giảm đúng `required_points`, không cho phép nếu số dư < mốc tại thời điểm duyệt.
- **UC-C1 Nhận nhiệm vụ:** con chọn nhiệm vụ `available` → chuyển `in_progress`.
- **UC-C2 Báo hoàn thành:** con bấm hoàn thành (+ảnh nếu require_proof) → `submitted`; không tự cộng điểm.
- **UC-C3 Xem kho thưởng:** con thấy phần thưởng unlocked (đổi được) và locked (kèm số điểm còn thiếu, progress bar).
- **UC-C4 Đổi thưởng:** con gửi yêu cầu đổi phần thưởng unlocked → `requested`; điểm chưa trừ tới khi bố mẹ duyệt.
- **UC-C5 Xem sổ điểm:** con xem lịch sử cộng/trừ điểm của chính mình.

## 9. Trạng thái UI bắt buộc (bám Delivery Rules)

Mọi màn có đủ **loading / empty / error**. Chi tiết trong `02-design/states.md`. Đặc biệt: kho thưởng phân biệt rõ **khóa vs mở**, và thông báo **"chưa đủ điểm"** khi con thao tác đổi.

## 10. Bảo mật & tuân thủ

- Tài khoản con do bố mẹ tạo/quản lý; không thu thập email/sđt trẻ; không thanh toán thật; không quảng cáo bên thứ ba.
- Auth/role-based access nhất quán với §4; cô lập dữ liệu theo `family_id` (RLS hoặc kiểm soát server-side tương đương — theo Data Rules của CLAUDE.md).
- Mọi thay đổi điểm & cấu hình rule quan trọng có audit trail (ledger append-only, log điều chỉnh).

## 11. Open questions kế thừa từ intake

Q1 (nhiều con), Q2 (nhiệm vụ lặp lại), Q3 (duyệt đổi thưởng), Q4 (ảnh minh chứng), Q5 (hết hạn điểm), Q6 (đăng nhập của con) — xem §8 intake. PRD dùng đề xuất mặc định của intake; cần PO chốt trước Stage build.

## 12. Traceability

| PRD | Nguồn intake |
|---|---|
| §3–4 role matrix | R2, §2 intake |
| §5.1 trạng thái nhiệm vụ | R4, §4.2–4.3 intake |
| §5.2 điểm/ledger | §4, §5 intake |
| §5.3 mở khóa phần thưởng | R5, R6 intake |
| §5.4 đổi thưởng | R5, §4.5 intake |
| §7 upload | §7 intake (Q4) |
