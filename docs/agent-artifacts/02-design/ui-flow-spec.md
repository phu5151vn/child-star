# UI Flow Spec — Ứng dụng tạo điểm loyalty cho con

> Truy vết: `01-product/prd.md`. Stack web: React 18 + Vite + TypeScript + Ant Design 5 + React Router v6 + TanStack Query. Phong cách **gamified / hoạt hình dễ thương**.

## 1. Design tokens (gamified / cartoon)

Áp dụng qua **Ant Design 5 `ConfigProvider` + theme token** (không tự viết CSS framework riêng).

| Token | Giá trị đề xuất | Ghi chú |
|---|---|---|
| `colorPrimary` | `#7C5CFC` (tím vui) | nút chính, nhấn mạnh |
| `colorSuccess` | `#22C55E` | hoàn thành, cộng điểm |
| `colorWarning` | `#F59E0B` | chờ duyệt |
| `colorError` | `#EF4444` | từ chối, lỗi |
| Accent phụ | `#FF7AA2` (hồng), `#38BDF8` (xanh), `#FACC15` (vàng sao) | huy hiệu, điểm |
| `borderRadius` | `16` (base), `24` cho card | bo góc lớn kiểu game |
| `fontFamily` | vui, bo tròn (vd `"Baloo 2", "Nunito", sans-serif`) | tải qua font web |
| `fontSizeHeading1` | `32–40` | tiêu đề lớn cho màn con |
| Shadow | mềm, nhiều lớp (`0 8px 24px rgba(124,92,252,.18)`) | cảm giác nổi khối |

**Nguyên tắc thị giác:** màu tươi sáng, nền gradient nhẹ, nhân vật/linh vật hoạt hình, biểu tượng ngôi sao/huy hiệu cho điểm, animation nhẹ khi cộng điểm/mở khóa (confetti). Màn của **con** to, ít chữ, nhiều icon; màn của **bố mẹ** gọn gàng thiên quản trị nhưng vẫn giữ tông vui.

## 2. Cấu trúc điều hướng

- **Auth shell:** màn đăng nhập / chọn hồ sơ (parent vs child).
- **Parent shell:** layout có sidebar (AntD `Layout` + `Menu`): Dashboard, Nhiệm vụ, Phần thưởng, Duyệt hoàn thành, Duyệt đổi thưởng, Con & Sổ điểm.
- **Child shell:** layout thân thiện (top bar hiển thị số điểm + linh vật, bottom tab trên mobile): Trang chính, Nhiệm vụ, Kho thưởng, Lịch sử điểm.
- Điều hướng do role quyết định; route được bảo vệ theo role (route guard) — chi tiết `navigation.json`.

## 3. Danh sách màn hình (screen list)

| ID | Màn | Role | Route |
|---|---|---|---|
| S0 | Đăng nhập / chọn hồ sơ | public | `/login`, `/profiles` |
| S1 | Dashboard bố mẹ | parent | `/parent` |
| S2 | Quản lý nhiệm vụ | parent | `/parent/tasks` |
| S3 | Tạo/sửa nhiệm vụ | parent | `/parent/tasks/new`, `/parent/tasks/:id/edit` |
| S4 | Quản lý phần thưởng | parent | `/parent/rewards` |
| S5 | Tạo/sửa phần thưởng | parent | `/parent/rewards/new`, `/parent/rewards/:id/edit` |
| S6 | Duyệt hoàn thành | parent | `/parent/approvals` |
| S7 | Duyệt đổi thưởng | parent | `/parent/redemptions` |
| S8 | Con & sổ điểm (parent view) | parent | `/parent/children`, `/parent/children/:id` |
| S9 | Dashboard con | child | `/child` |
| S10 | Danh sách nhiệm vụ (con) | child | `/child/tasks` |
| S11 | Chi tiết & báo hoàn thành | child | `/child/tasks/:id` |
| S12 | Kho phần thưởng (khóa/mở) | child | `/child/rewards` |
| S13 | Lịch sử điểm (con) | child | `/child/history` |

## 4. Luồng người dùng chính

**Bố mẹ:** Đăng nhập → Dashboard (S1) → tạo nhiệm vụ (S3) & phần thưởng (S5) → nhận thông báo hàng đợi duyệt → Duyệt hoàn thành (S6) → điểm con tăng → Duyệt đổi thưởng (S7) khi con yêu cầu.

**Con:** Chọn hồ sơ (S0) → Dashboard (S9) thấy điểm + mốc thưởng gần nhất → Danh sách nhiệm vụ (S10) → nhận & làm (S11) → báo hoàn thành (+ảnh nếu cần) → chờ duyệt → điểm tăng → Kho thưởng (S12) mở khóa → gửi đổi → chờ bố mẹ duyệt → Lịch sử điểm (S13).

## 5. Ant Design 5 component mapping

| Vùng UI | Component AntD 5 |
|---|---|
| Layout tổng | `Layout`, `Layout.Sider`, `Menu`, `Grid` |
| Card nhiệm vụ / phần thưởng | `Card`, `Badge`, `Tag`, `Avatar`, `Image` |
| Tiến độ điểm tới mốc | `Progress` (dạng line/circle), `Statistic` |
| Form tạo nhiệm vụ/phần thưởng | `Form`, `Input`, `InputNumber`, `Switch`, `Upload` |
| Hàng đợi duyệt | `List`/`Table`, `Tag` trạng thái, `Button`, `Popconfirm` |
| Thông báo | `message`, `notification`, `Result` |
| Trạng thái rỗng/lỗi | `Empty`, `Result`, `Skeleton`, `Spin` |
| Đổi thưởng / xác nhận | `Modal`, `Popconfirm`, `Steps` (trạng thái yêu cầu) |
| Điểm & huy hiệu | `Statistic`, `Badge.Ribbon`, `Tag`, icon tùy chỉnh |
| Theme game-like | `ConfigProvider` + `theme.token` / `theme.algorithm` |

## 6. Responsive / breakpoint

- Dùng AntD Grid (`xs < 576`, `sm ≥ 576`, `md ≥ 768`, `lg ≥ 992`, `xl ≥ 1200`).
- **Con:** ưu tiên mobile-first; bottom tab bar trên `xs/sm`, lưới card 1–2 cột; desktop 3–4 cột.
- **Bố mẹ:** sidebar cố định trên `lg+`, drawer menu trên mobile; bảng chuyển thành list card trên `xs`.

## 7. Trạng thái & feedback

Xem `states.md`. Điểm nhấn gamification: animation confetti khi được duyệt/mở khóa, hiệu ứng số điểm chạy lên, progress bar tới mốc thưởng gần nhất luôn hiển thị ở dashboard con.
