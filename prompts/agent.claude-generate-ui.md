# Stitch Generation Prompt — Ứng dụng tạo điểm loyalty cho con

> Paste toàn bộ nội dung dưới đây vào Stitch / Gemini CLI khi generate UI.

---

Tạo mobile UI cho ứng dụng **"Bé Ngoan" — Tạo điểm loyalty cho con** — một ứng dụng phong cách **game hoạt hình, dễ thương** giúp bố mẹ tạo nhiệm vụ & phần thưởng, còn con chọn làm nhiệm vụ để tích điểm và đổi phần thưởng. Giao diện vui tươi, bo tròn, nhiều màu pastel rực rỡ, cảm giác như một game trẻ em (không phải app ngân hàng). Nhân vật ngộ nghĩnh, huy hiệu/sao/kho báu, hiệu ứng động viên. Có **2 role: Bố mẹ và Con**.

## Design System (phong cách game hoạt hình, dễ thương)

- Primary (tím vui): `#7C5CFC`
- Secondary (hồng dễ thương): `#FF8FA3`
- Accent điểm/vàng kho báu: `#FFC531`
- Background: `#FBF7FF` (kem tím rất nhạt)
- Card: white, shadow mềm 0 6 16 rgba(124,92,252,0.12), **border-radius 20-24dp** (bo tròn nhiều)
- Input: border `#E7E1FF`, border-radius 16dp, placeholder `#B9B3D6`
- Success (xanh mint): `#3DD598`
- Error (đỏ san hô): `#FF5C5C`
- Locked / khoá: `#C7C2E0` (xám tím)
- Text primary: `#2D2A45`
- Text secondary: `#8E8AA8`
- Font: rounded, friendly (Fredoka / Baloo 2 / Nunito) — bo tròn, thân thiện trẻ em
- Screen padding: 16dp horizontal
- Icon minh hoạ: dùng minh hoạ phẳng dễ thương (ngôi sao, hộp quà, huy chương, chú thú nhỏ). Micro-interaction: sao lấp lánh, confetti khi đạt mốc.

## Tab Bar (cố định bottom) — có 2 cấu hình theo role

**Role CON (3 tabs):**

| Tab | Label | Icon |
|---|---|---|
| 1 | Nhiệm vụ | list-checks / target |
| 2 | Phần thưởng | gift |
| 3 | Của con | smile / user-round |

**Role BỐ MẸ (3 tabs):**

| Tab | Label | Icon |
|---|---|---|
| 1 | Nhiệm vụ | clipboard-list |
| 2 | Phần thưởng | gift |
| 3 | Theo dõi con | users-round |

- Tab bar cao 64dp, background white, bo góc trên 24dp, shadow trên nhẹ
- Label active: `#7C5CFC` + icon phóng to nhẹ; inactive: `#B9B3D6`

---

## SCREEN 1 — Chọn vai trò & Đăng nhập

**Route**: `onboarding/role`
**Layout**: SafeAreaView, content căn giữa dọc, background gradient nhạt tím→hồng

### Top
- Illustration nhân vật gia đình dễ thương (bố mẹ + con + sao vàng) 200dp
- Logo/tên app "Bé Ngoan" (26sp bold `#7C5CFC`, font rounded)
- Subtitle "Làm nhiệm vụ — Tích sao — Đổi quà!" (14sp `#8E8AA8`, center)

### 2 thẻ chọn vai trò (2 card lớn, xếp dọc, gap 16dp)
- **Card "Con"**: background `#FFF0F5`, icon mặt cười/thú nhỏ, tiêu đề "Con vào chơi" (18sp bold), subtitle "Chọn nhiệm vụ và đổi quà"
- **Card "Bố mẹ"**: background `#F1EDFF`, icon phụ huynh, tiêu đề "Bố mẹ quản lý" (18sp bold), subtitle "Tạo nhiệm vụ và phần thưởng"
- Card có border-radius 24dp, shadow mềm, tap → điều hướng vào role tương ứng

### Form đăng nhập (hiện khi chọn Bố mẹ — bottom sheet hoặc màn kế)
- Label "Tên đăng nhập / Số điện thoại" + TextField bo tròn
- Label "Mật khẩu" + TextField password, eye icon toggle
- Button "Đăng nhập" full width, height 52dp, `#7C5CFC`, border-radius 16dp
- Con vào bằng chọn avatar + PIN 4 số (dạng bàn phím số dễ thương, các nút tròn to)

### State - Loading: button disabled + spinner trong button
### State - Error: alert box `#FFECEC`, icon alert-circle đỏ, text "Sai tài khoản hoặc mật khẩu. Thử lại nhé!"

---

## SCREEN 2 — Nhiệm vụ của con (Role Con, Tab 1)

**Route**: `(child)/tasks`
**Layout**: SafeAreaView > ScrollView

### Header (playful)
- Row: avatar con tròn 40dp (viền màu) + lời chào "Chào Bin! 👋" (16sp bold)
- Right: **huy hiệu điểm** — pill vàng `#FFC531`, icon ngôi sao + số điểm hiện có "320 ⭐" (14sp bold `#2D2A45`)

### Banner động lực
- Card gradient tím→hồng, illustration kho báu, text "Làm thêm 80 sao để mở khoá quà mới!" + thanh progress nhỏ

### Category chips (horizontal scroll)
- Chips: `Tất cả` | `Học tập` | `Việc nhà` | `Thể thao` | `Ngoan ngoãn`
- Active: filled `#7C5CFC` white, pill 20dp; inactive: `#F1EDFF` text `#7C5CFC`

### Section "Nhiệm vụ hôm nay"
- Left "Nhiệm vụ hôm nay" (16sp bold) | right link "Tất cả" (13sp `#7C5CFC`)

### Task card list (vertical, gap 12dp)
Mỗi card:
- Container white, border-radius 20dp, shadow mềm, padding 14dp, viền trái màu theo loại (4dp)
- Layout Row — icon minh hoạ nhiệm vụ (hình tròn màu pastel 48dp, ví dụ 📚 / 🧹 / ⚽) | info (flex 1) | điểm bên phải
  - **Icon**: hình tròn màu pastel + emoji/biểu tượng hoạt hình
  - **Info**: Title "Đọc sách 20 phút" (15sp semibold `#2D2A45`) + dòng phụ "Trước 20h hôm nay" (12sp `#8E8AA8`)
  - **Điểm**: chip vàng "+30 ⭐" (14sp bold `#B8860B` trên nền `#FFF6D6`)
- Badge trạng thái nhỏ nếu có: "Đang chờ duyệt" (nền cam nhạt) / "Đã hoàn thành" (nền mint)
- Tap → chi tiết nhiệm vụ

### FAB (nếu cần)
- Không có FAB tạo cho role Con (con không tạo nhiệm vụ). Có thể có nút tròn "Nhiệm vụ đã nhận" ở góc.

### State - Loading: 3 skeleton card (bo tròn, pulse tím nhạt)
### State - Empty: illustration chú thú ngủ + "Chưa có nhiệm vụ nào" + subtitle "Đợi bố mẹ giao nhiệm vụ mới nhé!"
### State - Error: icon mây buồn + "Không tải được nhiệm vụ" + button "Thử lại" filled `#7C5CFC`

---

## SCREEN 3 — Chi tiết nhiệm vụ & Nhận nhiệm vụ (Role Con)

**Route**: `(child)/tasks/[id]`
**Layout**: SafeAreaView > ScrollView + sticky bottom

### Navigation bar
- Back arrow (nút tròn) + title "Chi tiết nhiệm vụ" (17sp semibold)

### Hero nhiệm vụ
- Icon lớn hoạt hình (hình tròn màu pastel 96dp, center)
- Title "Đọc sách 20 phút" (22sp bold, center)
- Chip điểm to "+30 ⭐" nền vàng, center

### Thông tin chi tiết (grid 2 cột, card bo tròn)
- Cell: icon tag + "Loại" + "Học tập"
- Cell: icon clock + "Hạn" + "Hôm nay, 20:00"
- Cell: icon repeat + "Lặp lại" + "Hằng ngày"
- Cell: icon star + "Điểm thưởng" + "30 sao"

### Mô tả
- Section header "Bố mẹ dặn" (14sp semibold)
- Text vui: "Con hãy đọc xong 1 chương và kể lại cho mẹ nghe nhé. Cố lên, con làm được mà! 💪"

### Nộp bằng chứng (tuỳ chọn)
- Section "Chụp ảnh khoe thành quả (không bắt buộc)"
- Ô upload ảnh bo tròn nét đứt + icon camera

### Sticky bottom bar (white, bo góc trên, safe area)
- Nếu chưa nhận: Button primary "Nhận nhiệm vụ" full width, `#7C5CFC`, border-radius 16dp, height 52dp
- Nếu đang làm: Button "Hoàn thành! ✅" nền `#3DD598`
- Trạng thái sau khi hoàn thành: hiển thị "Đang chờ bố mẹ duyệt ⏳"

### State - Success (con bấm hoàn thành): overlay confetti + illustration ngôi sao nảy + "Tuyệt vời! Chờ bố mẹ duyệt nhé 🎉" + button "Về danh sách"
### State - Error: toast bottom `#FFECEC` "Có lỗi rồi, thử lại nhé"

---

## SCREEN 4 — Cửa hàng phần thưởng (Role Con, Tab 2)

**Route**: `(child)/rewards`
**Layout**: SafeAreaView > ScrollView

### Header
- Title "Cửa hàng quà 🎁" (20sp bold) | huy hiệu điểm "320 ⭐" bên phải

### Progress tổng (thanh động lực)
- Card: "Sao của con: 320 ⭐" + thanh progress lớn tới mốc quà gần nhất + text "Còn 30 sao nữa để mở khoá **Vé xem phim**!"

### Grid phần thưởng (2 cột, gap 12dp)
Mỗi reward card:
- Container white, border-radius 20dp, padding 12dp, shadow mềm
- Ảnh/illustration quà (vuông bo tròn 16dp)
- Title quà: "Vé xem phim" (14sp semibold, 1-2 dòng)
- Mốc điểm: chip "350 ⭐" (nền vàng)
- **Trạng thái đã đủ điểm (unlocked)**: card sáng, chip xanh mint "Đủ điểm — Đổi ngay", nút "Đổi" nổi bật `#7C5CFC`
- **Trạng thái chưa đủ điểm (locked)**: card phủ lớp mờ nhẹ + icon ổ khoá `#C7C2E0` ở góc, thanh progress nhỏ dưới ảnh "320/350", text `#8E8AA8` "Còn 30 sao" → **vẫn hiển thị rõ để con phấn đấu**
- Badge "Sắp mở khoá" khi đạt ≥80% mốc

### Section "Đã đổi gần đây" (nếu có)
- List ngang các quà đã đổi (thumbnail nhỏ + ngày)

### State - Loading: 4 skeleton card grid
### State - Empty: illustration kệ quà trống + "Bố mẹ chưa thêm phần thưởng nào"
### State - Error: error + button "Thử lại"

---

## SCREEN 5 — Chi tiết phần thưởng & Đổi điểm (Role Con)

**Route**: `(child)/rewards/[id]`
**Layout**: SafeAreaView > ScrollView + sticky bottom

### Navigation bar
- Back arrow + "Chi tiết phần thưởng" (17sp semibold)

### Hero quà
- Ảnh/illustration lớn (full width, height 200dp, bo tròn dưới 24dp)
- Title "Vé xem phim cuối tuần" (22sp bold)
- Chip mốc điểm to "350 ⭐" nền vàng

### Trạng thái đổi
- **Đủ điểm**: card mint "Con đã đủ sao! 🎉 Còn dư 20 sao sau khi đổi"
- **Chưa đủ**: card xám nhạt + thanh progress "320/350" + "Con cố thêm 30 sao nữa nhé! Gợi ý: làm 1 nhiệm vụ Học tập"

### Mô tả
- Section "Về phần thưởng này" + text mô tả vui vẻ + điều kiện (nếu có)

### Sticky bottom bar
- Đủ điểm: Button primary "Đổi ngay (350 ⭐)" full width, `#7C5CFC`, height 52dp
- Chưa đủ: Button **disabled** màu `#C7C2E0`, label "Chưa đủ sao (còn 30)" + icon khoá

### State - Đổi thành công: full screen confetti + illustration mở hộp quà + "Đổi quà thành công! 🎊" + subtitle "Bố mẹ sẽ trao quà cho con nhé" + button "Về cửa hàng"
### State - Error: toast "Đổi quà thất bại, thử lại nhé"

---

## SCREEN 6 — Của con / Hồ sơ (Role Con, Tab 3)

**Route**: `(child)/profile`
**Layout**: SafeAreaView > ScrollView

### Header profile
- Avatar tròn lớn 88dp (viền màu + huy hiệu cấp độ), tên "Bin" (20sp bold)
- Chip cấp độ "Cấp 5 — Chiến binh sao 🌟"
- Card điểm lớn: "320 ⭐" (32sp bold vàng) + "Tổng sao đã kiếm: 1.250"

### Thống kê nhanh (3 ô ngang)
- "Nhiệm vụ đã xong: 42" | "Quà đã đổi: 6" | "Chuỗi ngày: 5 🔥"

### Bộ sưu tập huy hiệu
- Grid huy hiệu tròn (đạt = màu, chưa đạt = xám mờ) — động lực sưu tầm

### Lịch sử điểm (list)
- Mỗi dòng: icon + mô tả "Hoàn thành: Đọc sách" + thời gian | điểm "+30" (mint) hoặc "-350" (đỏ khi đổi quà)

### State - Loading: skeleton header + list
### State - Empty (lịch sử): "Chưa có hoạt động nào"

---

## SCREEN 7 — Theo dõi con / Bảng điều khiển (Role Bố mẹ, Tab 3)

**Route**: `(parent)/children`
**Layout**: SafeAreaView > ScrollView

### Header
- "Theo dõi con" (20sp bold) | avatar bố mẹ + icon log-out

### Chọn con (nếu nhiều con) — chips ngang
- Chip avatar + tên từng bé; active viền tím

### Card tổng quan bé đang chọn
- Avatar + tên + điểm hiện có "320 ⭐" + cấp độ + chuỗi ngày

### Section "Chờ duyệt" (quan trọng)
- Section header "Nhiệm vụ chờ duyệt (3)" (14sp semibold) + badge số
- Mỗi card: icon nhiệm vụ | tên "Đọc sách 20 phút" + "Bin nộp lúc 19:30" | ảnh bằng chứng thumbnail (nếu có)
  - 2 nút: "Duyệt ✅" (nền mint) | "Từ chối" (viền đỏ)
- Duyệt → cộng điểm cho con

### Section "Hoạt động gần đây"
- List: con hoàn thành / đổi quà, kèm thời gian

### Filter tabs (horizontal): `Chờ duyệt` | `Đã duyệt` | `Đã đổi quà`

### State - Loading: skeleton cards
### State - Empty: "Chưa có nhiệm vụ chờ duyệt 🎉"
### State - Error + retry
### State - Success (duyệt): toast mint "Đã duyệt và cộng 30 sao cho Bin!"

---

## SCREEN 8 — Quản lý & Tạo/Sửa nhiệm vụ (Role Bố mẹ, Tab 1)

**Route list**: `(parent)/tasks` — **Route form**: `(parent)/tasks/new` và `(parent)/tasks/[id]/edit`
**Layout**: SafeAreaView > ScrollView + (form) KeyboardAvoidingView + sticky bottom

### Màn danh sách (`(parent)/tasks`)
- Header "Nhiệm vụ" (20sp bold)
- Filter chips: `Tất cả` | `Đang hoạt động` | `Tạm ẩn`
- List task card: tên nhiệm vụ + điểm "+30 ⭐" + loại + trạng thái (toggle bật/tắt) + gán cho con nào (avatar nhỏ)
- **FAB tạo mới**: góc phải dưới, 56dp tròn, `#7C5CFC`, icon plus white, shadow tím
- State Empty: illustration + "Chưa có nhiệm vụ nào" + button "Tạo nhiệm vụ đầu tiên"

### Màn form tạo/sửa
- Navigation bar: back + "Tạo nhiệm vụ" (17sp semibold)
- **Tên nhiệm vụ \*** — TextField "VD: Đọc sách 20 phút"
- **Chọn icon/màu** — grid emoji + màu pastel để chọn (dễ thương)
- **Điểm thưởng \*** — stepper số lớn (nút −/+) hoặc TextField numeric, hiển thị "⭐"
- **Loại** — chips: `Học tập` | `Việc nhà` | `Thể thao` | `Ngoan ngoãn`
- **Gán cho** — chọn con (multi-select avatar chips)
- **Lặp lại** — chips: `Một lần` | `Hằng ngày` | `Hằng tuần`
- **Hạn hoàn thành** — date/time picker (tuỳ chọn)
- **Cần duyệt** — toggle "Bố mẹ duyệt trước khi cộng điểm" (mặc định bật)
- **Ghi chú cho con** — TextArea 3 dòng
- **Validation error**: border `#FF5C5C` + text lỗi 12sp đỏ dưới field
- Sticky bottom: Button "Lưu nhiệm vụ" full width `#7C5CFC` height 52dp
- State Submitting: spinner trong button
- State Success: toast mint "Đã tạo nhiệm vụ!" → về danh sách
- State Error: toast đỏ "Lưu thất bại, thử lại"

---

## SCREEN 9 — Quản lý & Tạo/Sửa phần thưởng (Role Bố mẹ, Tab 2)

**Route list**: `(parent)/rewards` — **Route form**: `(parent)/rewards/new` và `(parent)/rewards/[id]/edit`
**Layout**: SafeAreaView > ScrollView + (form) KeyboardAvoidingView + sticky bottom

### Màn danh sách (`(parent)/rewards`)
- Header "Phần thưởng" (20sp bold)
- Grid 2 cột reward card: ảnh quà + tên + mốc điểm "350 ⭐" + toggle bật/tắt + số lần đã đổi
- FAB tạo mới `#7C5CFC` icon plus
- State Empty: illustration kệ quà + "Chưa có phần thưởng nào" + button "Thêm phần thưởng"

### Màn form tạo/sửa
- Navigation bar: back + "Tạo phần thưởng" (17sp semibold)
- **Tên phần thưởng \*** — TextField "VD: Vé xem phim"
- **Ảnh phần thưởng** — ô upload bo tròn nét đứt + icon camera (hoặc chọn illustration mẫu dễ thương)
- **Mốc điểm cần đổi \*** — stepper/TextField numeric + "⭐" (đây là ngưỡng mở khoá cho con)
- **Số lượng / giới hạn đổi** — TextField numeric (tuỳ chọn, "Không giới hạn" mặc định)
- **Dành cho** — chọn con (multi-select avatar chips)
- **Mô tả** — TextArea 3 dòng "Mô tả phần thưởng để con háo hức hơn"
- **Validation error**: border đỏ + text lỗi
- Sticky bottom: Button "Lưu phần thưởng" full width `#7C5CFC` height 52dp
- State Submitting: spinner trong button
- State Success: toast mint "Đã thêm phần thưởng!"
- State Error: toast đỏ "Lưu thất bại, thử lại"

---

## Ghi chú kỹ thuật cho Stitch

- Dùng mobile frame (390x844, iPhone 14 ratio)
- Xuất từng screen thành frame riêng, đặt tên theo route: `S1-onboarding-role`, `S2-child-tasks`, `S3-task-detail`, `S4-child-rewards`, `S5-reward-detail`, `S6-child-profile`, `S7-parent-children`, `S8-parent-tasks`, `S9-parent-rewards`
- Với các màn có 2 route (list + form) hãy tạo frame con riêng: `S8a-tasks-list`, `S8b-task-form`, `S9a-rewards-list`, `S9b-reward-form`
- Tất cả state (loading, empty, error, success) phải là component variant riêng trong cùng frame
- Reward card phải có 2 variant rõ ràng: **unlocked (đủ điểm)** và **locked (chưa đủ điểm, hiện progress + ổ khoá)** — locked vẫn hiển thị đầy đủ để tạo động lực
- Tab bar phải có 2 cấu hình variant: role **Con** và role **Bố mẹ**
- Phong cách: hoạt hình dễ thương, bo tròn nhiều (radius 16-24dp), màu pastel, có sao/hộp quà/huy chương/confetti; tránh phong cách nghiêm túc kiểu ngân hàng
- Icon dùng Lucide hoặc Material Symbols style (rounded), kết hợp emoji/illustration phẳng dễ thương cho nhiệm vụ và phần thưởng
- Không dùng icon custom nếu không có reference rõ ràng
