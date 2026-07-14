# Component Inventory — Ứng dụng tạo điểm loyalty cho con

> Component tái sử dụng cho web (React 18 + AntD 5). Truy vết `ui-flow-spec.md`, `screen-inventory.md`. Đặt tên gợi ý theo domain; wrap AntD để giữ theme game-like nhất quán qua `ConfigProvider`.

## 1. Layout & khung

| Component | Dựa trên AntD | Dùng ở | Mô tả |
|---|---|---|---|
| `AppThemeProvider` | `ConfigProvider` + `theme.token` | toàn app | áp design tokens gamified (màu, borderRadius, font) |
| `ParentLayout` | `Layout` + `Sider` + `Menu` | S1–S8 | sidebar menu bố mẹ, badge số chờ duyệt |
| `ChildLayout` | `Layout` + bottom `Tabs` | S9–S13 | top bar điểm + linh vật, bottom tab mobile |
| `RoleRoute` | react-router + guard | tất cả | bảo vệ route theo role |
| `PageState` | `Skeleton`/`Empty`/`Result` | tất cả | bọc loading/empty/error thống nhất |

## 2. Điểm & gamification

| Component | Dựa trên | Mô tả |
|---|---|---|
| `PointsBadge` | `Statistic` + icon sao | hiển thị số dư điểm, dùng trên top bar con & dashboard |
| `PointsProgress` | `Progress` | tiến độ tới mốc thưởng gần nhất; nhận `current`, `target` |
| `PointsDeltaTag` | `Tag` | +N (xanh) / −N (đỏ) / điều chỉnh (xám) |
| `CelebrationFx` | thư viện confetti | hiệu ứng ăn mừng khi cộng điểm/mở khóa (tắt được) |
| `LevelMascot` | `Avatar`/`Image` | linh vật cổ vũ theo mức điểm |

## 3. Nhiệm vụ

| Component | Dựa trên | Mô tả |
|---|---|---|
| `TaskCard` | `Card` + `Tag` + `Badge` | hiển thị nhiệm vụ (icon, điểm, trạng thái) |
| `TaskForm` | `Form` + `Input`/`InputNumber`/`Switch`/`Upload` | tạo/sửa nhiệm vụ (title*, points*, require_proof, active) |
| `TaskStatusSteps` | `Steps`/`Tag` | available → in_progress → submitted → approved/rejected |
| `ProofUpload` | `Upload` | đính kèm ảnh minh chứng (bắt buộc nếu require_proof) |
| `ApprovalQueueItem` | `List.Item` + `Image` + `Button` | 1 dòng chờ duyệt hoàn thành |

## 4. Phần thưởng

| Component | Dựa trên | Mô tả |
|---|---|---|
| `RewardCard` | `Card` + `Badge.Ribbon` + `Progress` | hiển thị phần thưởng, tự đổi giao diện theo locked/unlocked/out-of-stock |
| `RewardForm` | `Form` + `Input`/`InputNumber`/`Upload` | tạo/sửa phần thưởng (title*, required_points*, stock) |
| `LockOverlay` | overlay + icon 🔒 | phủ lên RewardCard khi khóa + "còn thiếu N điểm" |
| `RedeemButton` | `Button` + `Popconfirm`/`Modal` | gửi yêu cầu đổi (chỉ bật khi unlocked) |
| `RedemptionQueueItem` | `List.Item` + `Statistic` | 1 dòng chờ duyệt đổi thưởng |

## 5. Sổ điểm & con

| Component | Dựa trên | Mô tả |
|---|---|---|
| `LedgerTimeline` | `Timeline`/`List` | lịch sử giao dịch điểm |
| `ChildPicker` | `Card` + `Avatar` | chọn hồ sơ con (S0) / lọc theo con (parent) |
| `PinInput` | `Input.OTP`/`Input` | nhập PIN con |
| `ManualAdjustModal` | `Modal` + `Form` | bố mẹ điều chỉnh điểm (bắt buộc lý do) |

## 6. Data fetching

- Dùng **TanStack Query** cho toàn bộ GET/mutation; query keys theo domain (`tasks`, `rewards`, `approvals`, `redemptions`, `ledger`, `children`).
- Mutation cộng/trừ điểm → invalidate query điểm + ledger + hàng đợi liên quan.
- Optimistic update ở mức UI nhẹ; nguồn đúng cuối cùng luôn là backend (rule nhạy cảm không tin client).
