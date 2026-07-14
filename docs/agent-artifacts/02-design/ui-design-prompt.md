# UI Design Prompt (cho Cursor) — Ứng dụng tạo điểm loyalty cho con

> Prompt mô tả UI/UX để Cursor build frontend. **Không** đổi stack: React 18 + Vite + TypeScript + **Ant Design 5** + React Router v6 + TanStack Query. Đạt look **game-like/hoạt hình dễ thương** bằng `ConfigProvider` + `theme.token`, **không** thay AntD bằng UI kit khác.

## 1. Cảm hứng thị giác

Ứng dụng cho gia đình, người dùng chính là **trẻ em**. Phong cách: hoạt hình, dễ thương, màu tươi sáng, bo góc lớn, linh vật ngộ nghĩnh, biểu tượng ngôi sao/huy hiệu cho điểm. Cảm giác như một **trò chơi tích điểm** vui nhộn, tích cực, khích lệ. Màn của **con** phải to, ít chữ, nhiều hình; màn của **bố mẹ** gọn gàng, quản trị nhưng vẫn giữ tông vui.

## 2. Theme token (AntD 5 `ConfigProvider`)

```ts
const theme = {
  token: {
    colorPrimary: '#7C5CFC',
    colorSuccess: '#22C55E',
    colorWarning: '#F59E0B',
    colorError:   '#EF4444',
    borderRadius: 16,
    fontFamily: '"Baloo 2", "Nunito", system-ui, sans-serif',
    fontSizeHeading1: 36,
    boxShadow: '0 8px 24px rgba(124,92,252,.18)',
  },
  components: {
    Card:   { borderRadiusLG: 24 },
    Button: { borderRadius: 999, controlHeight: 44 },
    Progress: { defaultColor: '#7C5CFC' },
  },
}
```

Accent phụ cho huy hiệu/điểm: hồng `#FF7AA2`, xanh `#38BDF8`, vàng sao `#FACC15`. Nền dùng gradient nhẹ (tím → hồng nhạt) cho khu vực con.

## 3. Layout & breakpoint

- **Bố mẹ:** `Layout` + `Sider` (menu trái) trên `lg+`; trên mobile chuyển sang `Drawer`. Nội dung dạng bảng/list card.
- **Con:** mobile-first. Top bar hiển thị **số điểm + linh vật**; **bottom tab bar** (Trang chính / Nhiệm vụ / Kho thưởng / Lịch sử) trên `xs/sm`; lưới card 1–2 cột mobile, 3–4 cột desktop.
- Breakpoint theo AntD Grid (`xs/sm/md/lg/xl`).

## 4. Thành phần gamification chủ đạo

- **Thanh tiến độ tới mốc thưởng** (`Progress`): luôn hiện ở dashboard con, chỉ rõ "còn N điểm nữa tới [phần thưởng]".
- **Huy hiệu / ngôi sao** cho điểm (`Statistic` + icon), số điểm chạy lên khi tăng.
- **Confetti** khi được duyệt nhiệm vụ hoặc mở khóa phần thưởng (có thể tắt).
- **Kho thưởng**: phần thưởng **mở** rực rỡ + nút "Đổi ngay"; phần thưởng **khóa** làm mờ + ổ khóa 🔒 + "Còn thiếu N điểm" + progress (để tạo động lực — R6).

## 5. Yêu cầu theo từng screen (bám `screen-inventory.md`)

- **S0 Đăng nhập/chọn hồ sơ:** card chọn hồ sơ với avatar to; con nhập PIN.
- **S1 Dashboard bố mẹ:** 3–4 ô `Statistic` (chờ duyệt HT, chờ duyệt đổi, điểm mỗi con), list nhiệm vụ gần đây, shortcut tạo nhiệm vụ/phần thưởng.
- **S2/S3 Nhiệm vụ:** danh sách + `TaskForm` (title*, points* InputNumber>0, description, Upload icon, Switch require_proof/active).
- **S4/S5 Phần thưởng:** danh sách + `RewardForm` (title*, required_points*, Upload ảnh, stock, Switch active).
- **S6 Duyệt hoàn thành:** hàng đợi có ảnh minh chứng; nút Duyệt (confetti + toast cộng điểm) / Từ chối (modal lý do).
- **S7 Duyệt đổi thưởng:** hiển thị điểm cần trừ vs số dư; chặn nếu không đủ.
- **S9 Dashboard con:** điểm to + linh vật + progress tới mốc gần nhất + nhiệm vụ đang làm.
- **S10/S11 Nhiệm vụ con:** lưới card điểm; chi tiết có nút Nhận/Hoàn thành + `ProofUpload`; `Steps` trạng thái.
- **S12 Kho thưởng:** như mục 4; xử lý locked/unlocked/hết hàng/đang chờ duyệt.
- **S13 Lịch sử điểm:** timeline +/− điểm với màu tag.

## 6. Trạng thái bắt buộc

Mỗi màn có loading (`Skeleton`/`Spin`), empty (`Empty` minh họa hoạt hình + CTA), error (`Result` + retry). Chi tiết `states.md`. Con nhận thông điệp tích cực; từ chối dùng "làm lại nhé".

## 7. Ràng buộc kỹ thuật

- Không hardcode secret ở frontend. Gọi API qua TanStack Query; rule nhạy cảm (điểm, mở khóa, đổi) **không** tự quyết ở client — luôn theo phản hồi backend.
- Type-safe, contract-first theo `04-data/schema-draft.md` và API contract (chốt ở Stage 3).
- Accessibility cơ bản: tương phản màu đủ, target chạm ≥ 44px cho màn con.
