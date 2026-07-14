# Stitch Design Notes — Bé Ngoan (Ứng dụng tạo điểm loyalty cho con)

> Design system thực tế của UI đã generate bằng Stitch MCP, truy vết từ `ui-design-prompt.md` và `stitch-screen-inventory.md`.
>
> - **Stitch project**: `projects/2642533722835314844`
> - **Design system**: `assets/12629943742838520232` ("Bé Ngoan Playful")
> - **Device**: MOBILE 390×844
> - **Model**: Gemini (PRO_AGENT) — style cartoon / pastel / rounded
> - **Tinh thần**: game trẻ em vui tươi, bo tròn nhiều, pastel rực rỡ; KHÔNG phải app ngân hàng.

## Bảng màu (color tokens)

| Token | Hex | Dùng cho |
|---|---|---|
| Primary (tím vui) | `#7C5CFC` | nút chính, nhấn mạnh, active tab |
| Secondary (hồng dễ thương) | `#FF8FA3` | phụ, badge, điểm nhấn |
| Accent (vàng kho báu / điểm) | `#FFC531` | điểm ⭐, huy hiệu, phần thưởng |
| Success (mint) | `#3DD598` | hoàn thành, đạt mốc |
| Error (đỏ san hô) | `#FF5C5C` | lỗi, cảnh báo |
| Locked (xám tím) | `#C7C2E0` | phần thưởng chưa đủ điểm / khoá |
| Background | `#FBF7FF` | nền màn (kem tím rất nhạt) |
| Card | `#FFFFFF` | thẻ nội dung |
| Text primary | `#2D2A45` | chữ chính |
| Text secondary | `#8E8AA8` | chữ phụ, mô tả |
| Input border | `#E7E1FF` | viền ô nhập |
| Placeholder | `#B9B3D6` | chữ gợi ý trong input |

## Typography

- Font: **rounded, friendly** — Fredoka / Baloo 2 / Nunito (bo tròn, thân thiện trẻ em).
- Heading: đậm, bo tròn; số điểm dùng cỡ lớn + màu Accent `#FFC531`.
- Body/label: Nunito/Baloo 2, cân bằng dễ đọc cho phụ huynh.

## Shape / Elevation / Spacing

- **Border-radius**: 20–24dp cho card (bo tròn nhiều); input 16dp; chip/pill bo tròn hoàn toàn.
- **Card shadow**: mềm — `0 6 16 rgba(124,92,252,0.12)`.
- **Screen padding**: 16dp ngang.
- Icon minh hoạ phẳng dễ thương: ngôi sao, hộp quà, huy chương, thú nhỏ.
- Micro-interaction: sao lấp lánh, confetti khi con đạt mốc điểm.

## Tab bar theo role

- **Con** (3 tab): Nhiệm vụ · Phần thưởng · Của con
- **Bố mẹ** (3 tab): Nhiệm vụ · Phần thưởng · Theo dõi con
- Tab active: màu Primary `#7C5CFC`; inactive: Text secondary `#8E8AA8`.

## Quy ước trạng thái phần thưởng (đặc thù ý tưởng)

- **Đủ điểm**: card sáng màu, nút "Đổi quà" bật (Primary), có hiệu ứng khích lệ.
- **Chưa đủ điểm**: card phủ lớp Locked `#C7C2E0`, hiện ổ khoá + "Còn thiếu N điểm" để tạo động lực (theo đúng yêu cầu cho con thấy phần thưởng chưa mở khoá).

## Ghi chú đồng bộ

- Chi tiết URL ảnh & mã HTML từng màn: xem `stitch-asset-urls.md`.
- Danh sách màn & route: xem `stitch-screen-inventory.md`.
- Bản Stage-1 (hướng web/AntD) ở `screen-inventory.md` giữ để tham chiếu; bản mobile Stitch này là nguồn cho UI thực tế.
