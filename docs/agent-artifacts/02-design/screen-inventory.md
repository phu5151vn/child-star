# Screen Inventory — Ứng dụng tạo điểm loyalty cho con

> Truy vết `01-product/prd.md` và `ui-flow-spec.md`. Mỗi màn nêu: mục đích, role, dữ liệu chính, hành động, component AntD, và trạng thái (loading/empty/error) — chi tiết state ở `states.md`.

## S0 — Đăng nhập / Chọn hồ sơ
- **Role:** public. **Route:** `/login`, `/profiles`.
- **Mục đích:** bố mẹ đăng nhập bằng email+mật khẩu; sau đó chọn vào hồ sơ bố mẹ hoặc chọn hồ sơ con (con dùng PIN).
- **Dữ liệu:** danh sách hồ sơ trong gia đình (avatar, tên, role).
- **Hành động:** đăng nhập, chọn hồ sơ, nhập PIN con.
- **Component:** `Form`, `Input`, `Card`, `Avatar`, `Button`, `Result` (lỗi auth).

## S1 — Dashboard bố mẹ
- **Role:** parent. **Route:** `/parent`.
- **Mục đích:** tổng quan gia đình: số nhiệm vụ chờ duyệt, yêu cầu đổi thưởng chờ duyệt, điểm hiện tại của từng con, nhiệm vụ gần đây.
- **Component:** `Statistic`, `Card`, `List`, `Badge`, `Progress` (điểm mỗi con), `Button` shortcut.

## S2 — Quản lý nhiệm vụ
- **Role:** parent. **Route:** `/parent/tasks`.
- **Mục đích:** danh sách nhiệm vụ (title, điểm, active, require_proof), tạo/sửa/xóa.
- **Component:** `Table`/`List`, `Tag`, `Switch` (active), `Button`, `Popconfirm` (xóa).

## S3 — Tạo/sửa nhiệm vụ
- **Role:** parent. **Route:** `/parent/tasks/new`, `/parent/tasks/:id/edit`.
- **Trường:** title*, points* (>0), description, icon/ảnh (Upload), require_proof (Switch), active.
- **Component:** `Form`, `Input`, `InputNumber`, `Switch`, `Upload`, `Button`.

## S4 — Quản lý phần thưởng
- **Role:** parent. **Route:** `/parent/rewards`.
- **Mục đích:** danh sách phần thưởng (title, required_points, stock, active), tạo/sửa/xóa.
- **Component:** `List`/`Card`, `Tag`, `Button`, `Popconfirm`.

## S5 — Tạo/sửa phần thưởng
- **Role:** parent. **Route:** `/parent/rewards/new`, `/parent/rewards/:id/edit`.
- **Trường:** title*, required_points* (>0), description, image (Upload), stock (null=không giới hạn), active.
- **Component:** `Form`, `Input`, `InputNumber`, `Upload`, `Switch`.

## S6 — Duyệt hoàn thành
- **Role:** parent. **Route:** `/parent/approvals`.
- **Mục đích:** hàng đợi nhiệm vụ trạng thái `submitted`; xem con nào, nhiệm vụ gì, ảnh minh chứng; **Duyệt** (cộng điểm) hoặc **Từ chối** (kèm lý do).
- **Component:** `List`, `Card`, `Image` (ảnh minh chứng), `Tag` trạng thái, `Button`, `Popconfirm`, `Modal` (lý do từ chối).

## S7 — Duyệt đổi thưởng
- **Role:** parent. **Route:** `/parent/redemptions`.
- **Mục đích:** hàng đợi yêu cầu đổi `requested`; hiển thị con, phần thưởng, điểm cần trừ, số dư hiện tại; Duyệt (trừ điểm, giảm stock) / Từ chối.
- **Component:** `List`, `Card`, `Statistic`, `Tag`, `Button`, `Popconfirm`.

## S8 — Con & sổ điểm (parent view)
- **Role:** parent. **Route:** `/parent/children`, `/parent/children/:id`.
- **Mục đích:** quản lý tài khoản con (tạo/đặt lại PIN), xem số dư & sổ điểm đầy đủ của từng con, điều chỉnh điểm thủ công (có lý do). `[ASSUMPTION]`
- **Component:** `Table`, `Statistic`, `Timeline`/`List` (ledger), `Modal` (điều chỉnh + lý do).

## S9 — Dashboard con
- **Role:** child. **Route:** `/child`.
- **Mục đích:** hiển thị điểm hiện tại (to, có sao/huy hiệu), **mốc thưởng gần nhất** + progress bar tới mốc đó, nhiệm vụ đang làm, lời cổ vũ.
- **Component:** `Statistic`, `Progress`, `Card`, `Badge`, animation confetti khi vừa lên điểm.

## S10 — Danh sách nhiệm vụ (con)
- **Role:** child. **Route:** `/child/tasks`.
- **Mục đích:** nhiệm vụ khả dụng (điểm, icon) để nhận; nhiệm vụ đang làm/chờ duyệt.
- **Component:** lưới `Card`, `Tag` điểm, `Badge` trạng thái, `Button` "Nhận".

## S11 — Chi tiết & báo hoàn thành
- **Role:** child. **Route:** `/child/tasks/:id`.
- **Mục đích:** xem mô tả, nhận nhiệm vụ, bấm **Hoàn thành** (đính kèm ảnh nếu `require_proof`), theo dõi trạng thái chờ duyệt.
- **Component:** `Card`, `Descriptions`, `Upload` (ảnh minh chứng), `Steps` (trạng thái), `Button`.

## S12 — Kho phần thưởng (khóa/mở)
- **Role:** child. **Route:** `/child/rewards`.
- **Mục đích:** hiển thị **tất cả** phần thưởng; **mở** (đủ điểm → nút Đổi) và **khóa** (mờ + ổ khóa + "còn thiếu N điểm" + progress). Tạo động lực (R6).
- **Component:** lưới `Card`, `Badge.Ribbon`, `Progress`, icon khóa, `Button` "Đổi", `Modal`/`Popconfirm` xác nhận.

## S13 — Lịch sử điểm (con)
- **Role:** child. **Route:** `/child/history`.
- **Mục đích:** dòng thời gian cộng/trừ điểm của chính con (nhiệm vụ được duyệt +, đổi thưởng −).
- **Component:** `Timeline`/`List`, `Tag` (loại giao dịch), `Statistic` số dư.
