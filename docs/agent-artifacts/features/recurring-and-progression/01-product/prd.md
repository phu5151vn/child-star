# PRD — Nhiệm vụ lặp lại & Tiến trình (Streak · Huy hiệu · Cấp độ)

> **Nguồn sự thật:** `../00-intake/request.md` (R1–R8). Kế thừa PRD gốc `docs/agent-artifacts/01-product/prd.md` (role matrix §3–4, ledger append-only §5.2, teaser reward R6). Mọi rule mới đánh mã **BR-RC-*** (recurrence) và **BR-PG-*** (progression). `[ASSUMPTION]` cần PO chốt.

## 1. Mục tiêu sản phẩm

Bổ sung lớp **động lực dài hạn** cho con: làm nhiệm vụ đều mỗi ngày (chuỗi 🔥), leo cấp độ với danh hiệu dễ thương, và sưu tầm huy hiệu thành tựu — trong khi vẫn giữ nguyên vòng loyalty & nguyên tắc dữ liệu hiện có.

**Chỉ số thành công (định hướng):**
- Tỉ lệ con quay lại làm nhiệm vụ nhiều ngày liên tiếp tăng (đo qua độ dài streak trung bình).
- Mỗi con thấy rõ "còn bao nhiêu để lên cấp / mở huy hiệu / giữ chuỗi".
- Không phát sinh lệch điểm: mọi sao thưởng bonus đều truy vết trong `points_ledger`.

## 2. Phạm vi

**Trong scope:**
- **F1:** hoàn thiện hiển thị & test cho nhiệm vụ lặp lại (once/daily/weekly) đã có.
- **F2:** streak theo ngày + thưởng mốc; cấp độ theo tổng sao lũy kế; huy hiệu hệ thống (earned + teaser chưa đạt); màn tiến trình cho con; xem tiến trình cho bố mẹ; hiệu ứng ăn mừng.

**Ngoài scope:** leaderboard, cửa hàng avatar, huy hiệu custom của bố mẹ, thông báo đẩy/email, scheduler nền (xem intake §5).

## 3. Vai trò liên quan (kế thừa role matrix gốc §4)

| Hành động | Bố mẹ | Con |
|---|---|---|
| Xem tiến trình (level/streak/badge) của con | ✅ (mọi con trong nhà) | 👁 (own) |
| Nhận thưởng sao mốc streak | Hệ thống cộng khi duyệt nhiệm vụ (không sửa tay) | ❌ (thụ hưởng) |
| Đặt/sửa ngưỡng level, mốc streak, định nghĩa huy hiệu | ❌ giai đoạn này (hằng số hệ thống — Q-E) | ❌ |
| Chọn recurrence khi tạo/sửa nhiệm vụ | ✅ | ❌ |

> Enforce backend: con chỉ đọc tiến trình `child_id = ctx.child_id`; bố mẹ đọc trong `family_id`. Không endpoint ghi tiến trình từ client — tiến trình là **kết quả tính toán** từ dữ liệu gốc.

## 4. F1 — Nhiệm vụ lặp lại (rules)

- **BR-RC-1 (giữ hành vi hiện có):** `recurrence ∈ {once, daily, weekly}`. `once` xong là khóa vĩnh viễn; `daily` khóa trong ngày (giờ VN); `weekly` khóa trong tuần (giờ VN, tuần bắt đầu **Thứ Hai**). Ranh giới thời gian theo `core/timeutil.py` (UTC+7).
- **BR-RC-2:** Trong một chu kỳ, mỗi con chỉ có **1 assignment mở** cho 1 task và **không nhận lại** sau khi đã `approved` trong chu kỳ đó. Sang chu kỳ mới, task tự trở lại `available` cho con.
- **BR-RC-3 (UX mới):** Trên màn con, mỗi nhiệm vụ hiển thị **nhãn chu kỳ** (Một lần / Hằng ngày 🔁 / Hằng tuần 📅). Khi đã hoàn thành trong chu kỳ: trạng thái **"Hôm nay đã xong — mai làm tiếp"** (daily) / **"Tuần này đã xong — tuần sau làm tiếp"** (weekly), không hiển thị nút nhận.
- **BR-RC-4:** `rejected` cho phép làm lại ngay trong chu kỳ hiện tại (giữ hành vi hiện có: tạo lại `in_progress`).
- **BR-RC-5 (test):** Có test service: daily reopen khi `decided_at` là hôm qua; weekly reopen khi thuộc tuần trước; chặn claim lần 2 trong cùng chu kỳ.

## 5. F2 — Tiến trình (rules)

### 5.1 Sao lũy kế (nền tảng của level & một số huy hiệu)
- **BR-PG-1:** **`lifetime_points`** (tổng sao đã kiếm) = tổng các dòng ledger **dương** của con: `SUM(delta) WHERE child_id=… AND delta > 0`. Bao gồm `task_approved`, `weekly_bonus`, `streak_bonus`, và `manual_adjust` dương. **Không** trừ khi con tiêu điểm đổi thưởng → level không bao giờ tụt (Q-A default).
- **BR-PG-2:** Phân biệt rõ với **`balance`** (số dư tiêu được, gồm cả trừ) đã có sẵn. UI con hiển thị cả hai: "⭐ tiêu được: N" và "🏅 tổng tích lũy: M".

### 5.2 Cấp độ (level)
- **BR-PG-3:** Level được suy ra từ `lifetime_points` theo **bảng ngưỡng hệ thống** (tăng dần). Đề xuất giai đoạn 1 (`[ASSUMPTION]` Q-E):

  | Level | Danh hiệu | Sao lũy kế tối thiểu | Icon |
  |---|---|---|---|
  | 1 | Mầm Non | 0 | 🌱 |
  | 2 | Chồi Xanh | 100 | 🌿 |
  | 3 | Ngôi Sao Nhỏ | 250 | ⭐ |
  | 4 | Ngôi Sao Sáng | 500 | 🌟 |
  | 5 | Siêu Sao | 1000 | 💫 |
  | 6 | Nhà Vô Địch | 2000 | 🏆 |

- **BR-PG-4:** Trả về **tiến độ tới cấp kế**: `progress_pct = (lifetime − min_cur) / (min_next − min_cur)`, cùng `points_to_next = min_next − lifetime`. Ở cấp cao nhất: `progress_pct = 100`, `points_to_next = 0`.
- **BR-PG-5:** **Lên cấp không cộng sao** (chỉ danh hiệu — Q-B default), tránh lạm phát điểm dùng đổi thưởng. Khi `level` sau một lần cộng điểm > `level` trước đó → phát tín hiệu **level-up** cho FE ăn mừng (BR-PG-11).

### 5.3 Chuỗi ngày (streak)
- **BR-PG-6 (định nghĩa ngày hoạt động):** Một **ngày hoạt động** của con = ngày (giờ VN) có **≥ 1 `task_assignment` chuyển sang `approved`** (dựa trên `decided_at`). (Q-C default: bất kỳ nhiệm vụ nào, không bắt buộc daily task cụ thể.)
- **BR-PG-7 (current streak):** Số ngày hoạt động **liên tiếp** tính lùi từ **hôm nay**; nếu hôm nay chưa hoạt động nhưng **hôm qua** có, streak vẫn giữ (đang "chờ" hôm nay). Bỏ lỡ **trọn một ngày** (không có ngày hoạt động giữa 2 mốc) → streak về 0 (Q-D: không freeze).
- **BR-PG-8 (longest streak):** Kỷ lục dài nhất từ trước tới nay (dùng cho huy hiệu & khoe).
- **BR-PG-9 (thưởng mốc):** Khi `current_streak` **đạt** mốc M ∈ {3, 7, 14, 30} lần đầu tiên → cộng **sao bonus** vào ledger (`kind='streak_bonus'`). Đề xuất: 3→+5, 7→+15, 14→+30, 30→+80 (`[ASSUMPTION]`). **Idempotent tuyệt đối**: mỗi con nhận mỗi mốc **đúng 1 lần trọn đời** (không phải mỗi lần đạt lại). Đánh dấu qua bảng `streak_milestone_awards(child_id, milestone)` UNIQUE.
- **BR-PG-10:** Thưởng mốc streak được tính **ngay sau khi duyệt nhiệm vụ** (cùng luồng approve, sau khi ghi điểm task) — không cần job nền. Chạy trong ngữ cảnh có advisory-lock của con để an toàn khi song song.

### 5.4 Huy hiệu (badges)
- **BR-PG-11:** Bộ huy hiệu **hệ thống seed sẵn**, có `criteria_type` + `threshold`. Loại tiêu chí giai đoạn 1:
  - `first_task` — hoàn thành nhiệm vụ đầu tiên (threshold=1 task_approved).
  - `tasks_approved_total` — tổng nhiệm vụ được duyệt (vd 10, 50, 100).
  - `points_earned_total` — tổng sao lũy kế (vd 100, 500, 1000).
  - `streak_days` — đạt chuỗi N ngày (vd 7, 30) — dùng `longest_streak`.
  - `rewards_redeemed_total` — số phần thưởng đã đổi thành công (vd 1, 10).
  - `weekly_goal_hits` — số lần đạt mục tiêu tuần (đếm `weekly_bonus_awards`).
- **BR-PG-12 (teaser):** Kho huy hiệu hiển thị **cả huy hiệu chưa đạt** (mờ + thanh tiến độ + mô tả cách đạt) — nhất quán teaser reward (PRD gốc R6).
- **BR-PG-13 (cấp huy hiệu):** Sau mỗi sự kiện tăng tiến (duyệt nhiệm vụ, đổi thưởng thành công, cập nhật streak, đạt mục tiêu tuần), hệ thống **đánh giá lại** và cấp mọi huy hiệu đã đủ điều kiện mà con **chưa có**. **Idempotent**: `child_badges(child_id, badge_code)` UNIQUE — cấp lại là no-op. Cấp huy hiệu **không cộng sao** (Q-B default).
- **BR-PG-14:** Mọi metric ở BR-PG-11 đều **derive từ dữ liệu gốc** (`points_ledger`, `task_assignments`, `reward_redemptions`, `weekly_bonus_awards`) — không lưu bản đếm song song làm nguồn đúng.

### 5.5 Ăn mừng & hiển thị
- **BR-PG-15:** Level-up, mở huy hiệu mới, đạt mốc streak → FE hiển thị `CelebrationFx` (tắt được theo cấu hình đã có). Backend trả **các sự kiện vừa phát sinh** trong response của thao tác duyệt để FE biết ăn mừng cái gì (`newly_earned_badges`, `streak_milestone_reached`, `level_up`).

## 6. Use cases & acceptance criteria

- **UC-1 Con xem tiến trình:** mở màn "Hành trình của con" → thấy vòng cấp độ + danh hiệu, còn thiếu N sao lên cấp; lửa 🔥 streak + mốc kế; kệ huy hiệu (đạt sáng / chưa đạt mờ + tiến độ). *AC:* dữ liệu khớp `GET /children/{id}/progression`; con A không xem được tiến trình con B (403).
- **UC-2 Giữ chuỗi & đạt mốc:** con hoàn thành ≥1 nhiệm vụ hôm nay được duyệt → `current_streak` tăng; đạt mốc 3/7/14/30 lần đầu → +sao bonus (đúng 1 lần), ledger có dòng `streak_bonus`, FE ăn mừng. *AC:* duyệt nhiều nhiệm vụ trong **cùng ngày** không làm streak tăng >1 và không thưởng mốc trùng.
- **UC-3 Lên cấp:** tổng sao lũy kế vượt ngưỡng khi duyệt nhiệm vụ → `level` tăng, FE ăn mừng, **không** cộng thêm sao ngoài điểm nhiệm vụ. *AC:* đổi thưởng (tiêu điểm) **không** làm tụt level.
- **UC-4 Mở huy hiệu:** đạt điều kiện (vd nhiệm vụ thứ 10 được duyệt) → huy hiệu tương ứng chuyển "đã đạt". *AC:* gọi duyệt idempotent/hai lần không tạo 2 huy hiệu; huy hiệu chưa đạt vẫn hiện kèm tiến độ.
- **UC-5 Bố mẹ theo dõi:** trong màn quản lý con, bố mẹ thấy level/streak/số huy hiệu của từng con. *AC:* chỉ trong `family_id`.
- **UC-6 Nhiệm vụ lặp lại:** con hoàn thành nhiệm vụ hằng ngày → hôm nay hiển thị "đã xong, mai làm tiếp"; hôm sau nhiệm vụ tự mở lại. *AC:* không nhận được 2 lần trong ngày; test tự động phủ reopen daily & weekly.

## 7. Trạng thái UI bắt buộc

Mọi màn mới có **loading / empty / error** (bám Delivery Rules & PRD gốc §9). Đặc thù:
- Kho huy hiệu **rỗng** (chưa có huy hiệu nào) → empty state khích lệ ("Hoàn thành nhiệm vụ đầu tiên để mở huy hiệu!").
- Huy hiệu **đã đạt vs chưa đạt** phân biệt rõ (sáng/màu vs mờ + 🔒 + tiến độ) — như locked/unlocked của reward.
- Streak = 0 → hiển thị lời mời "Bắt đầu chuỗi hôm nay!".

## 8. Bảo mật & tuân thủ

- Con chỉ đọc tiến trình của mình; bố mẹ trong phạm vi gia đình; enforce ở service theo `ctx`.
- Sao bonus (streak) ghi `points_ledger` append-only + `created_by` = actor duyệt (hoặc user hệ thống) + idempotent qua bảng award → có audit trail (bám Data Rules).
- Không thu thập dữ liệu nhạy cảm của trẻ; huy hiệu/level là dữ liệu chơi, không PII.

## 9. Traceability

| PRD (rule) | Nguồn intake | Dữ liệu/logic gốc tái dùng |
|---|---|---|
| BR-RC-1..5 | R1–R3 | `tasks.recurrence`, `core/timeutil.py`, `task_service` |
| BR-PG-1..2 (lifetime vs balance) | R5, §4 | `points_ledger` (nguồn đúng) |
| BR-PG-3..5 (level) | R5 | ngưỡng hệ thống + `lifetime_points` derived |
| BR-PG-6..10 (streak) | R4 | `task_assignments.decided_at`, ledger `streak_bonus`, bảng award mới |
| BR-PG-11..14 (badges) | R6 | metrics derive + bảng `badges`/`child_badges` mới |
| BR-PG-15 (ăn mừng) | R7 | `CelebrationFx` (đã có) |
| §3 xem tiến trình | R8 | scope theo `family_id`/`child_id` |
