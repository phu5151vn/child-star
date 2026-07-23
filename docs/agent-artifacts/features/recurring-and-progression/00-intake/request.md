# Feature Intake — Nhiệm vụ lặp lại & Tiến trình (Streak · Huy hiệu · Cấp độ)

> **Feature increment** trên nền "Bé Ngoan" đã build (core loyalty đã chạy). Nguồn: đề xuất cải tiến gamification để tăng độ gắn kết cho trẻ. Truy vết về `idea.md` ("như 1 ứng dụng game… tạo động lực phấn đấu") và `docs/agent-artifacts/01-product/prd.md` §1 (chỉ số: con hoàn thành ≥1 nhiệm vụ/tuần, thấy tiến độ). Tài liệu này chuẩn hóa yêu cầu; mọi rule truy vết về R-* dưới đây. Các mục `[ASSUMPTION]` cần bố mẹ/PO xác nhận trước khi build.

## 1. Bối cảnh & hiện trạng (đã khảo sát code)

App đã có vòng loyalty đầy đủ: nhiệm vụ → duyệt → cộng điểm (ledger append-only) → đổi thưởng; RBAC parent/child; mục tiêu tuần (`weekly_goals` + `weekly_bonus_awards`); mini-game gia đình (caro/cờ/cá ngựa, không gắn điểm).

Trạng thái 2 nhóm tính năng của increment này:

| Nhóm | Hiện trạng trong code | Kết luận scope |
|---|---|---|
| **F1 — Nhiệm vụ lặp lại** | `tasks.recurrence` (`once`/`daily`/`weekly`) đã có; `core/timeutil.py` tính ranh giới ngày/tuần theo giờ VN (UTC+7); `task_service._child_assignment_state` tự mở lại nhiệm vụ khi sang chu kỳ mới; `claim` chặn nhận trùng trong cùng chu kỳ với thông báo thân thiện; form parent + `TaskCard`/`WeeklyProgressCard` đã đọc `recurrence`. | **Phần lớn đã xong.** Increment = **hoàn thiện UX hiển thị chu kỳ + đảm bảo test + hardening**, KHÔNG đổi schema lõi. |
| **F2 — Streak / Huy hiệu / Cấp độ** | **Chưa có** bảng, endpoint hay màn nào (không có `streak`/`badge`/`level` ở backend/models). Có sẵn `CelebrationFx`, `PointsProgress` để tái dùng; có `points_ledger` (nguồn đúng của điểm) và `task_assignments` (nguồn đúng của ngày hoàn thành). | **Build mới hoàn toàn.** |

## 2. Mục tiêu

- Tăng động lực dài hạn cho con qua 3 cơ chế game kinh điển: **chuỗi ngày (streak)**, **huy hiệu thành tựu (badges)**, **cấp độ/danh hiệu (level)**.
- Hoàn thiện nhiệm vụ lặp lại để nuôi streak (làm mỗi ngày → giữ lửa 🔥).
- Không phá vỡ nguyên tắc dữ liệu hiện có: **điểm là derived từ `points_ledger` append-only**; tiến trình cũng phải **tái tính được** từ dữ liệu gốc.

## 3. Yêu cầu (requirements truy vết)

**F1 — Nhiệm vụ lặp lại (hoàn thiện):**
- **R1:** Con nhìn rõ nhiệm vụ là **một lần / hằng ngày / hằng tuần**, và khi đã xong trong chu kỳ thì thấy trạng thái "đã xong, làm lại sau" + thời điểm mở lại (mai / tuần sau).
- **R2:** Nhiệm vụ hằng ngày/tuần tự mở lại đúng chu kỳ (giữ hành vi hiện có), không cho nhận 2 lần trong 1 chu kỳ.
- **R3:** Có test tự động cho reopen daily (sang ngày mới) và weekly (sang tuần mới).

**F2 — Tiến trình:**
- **R4 (Streak):** Con có **chuỗi ngày hoạt động liên tiếp**; đạt mốc (3/7/14/30 ngày) được **thưởng sao bonus**. Hiển thị lửa 🔥 + số ngày + mốc kế tiếp.
- **R5 (Level):** Con có **cấp độ + danh hiệu dễ thương** tăng theo **tổng sao đã kiếm** (lũy kế, không tụt khi tiêu điểm), có thanh tiến độ tới cấp kế.
- **R6 (Badges):** Con sưu tầm **huy hiệu thành tựu**; huy hiệu **chưa đạt vẫn hiển thị (mờ + tiến độ)** để tạo động lực — nhất quán tinh thần "teaser" của kho thưởng (PRD gốc R6).
- **R7:** Lên cấp / mở huy hiệu / đạt mốc streak → **hiệu ứng ăn mừng** (tái dùng `CelebrationFx`).
- **R8:** Bố mẹ xem được tiến trình (cấp độ, streak, huy hiệu) của từng con.

## 4. Nguyên tắc ràng buộc (kế thừa CLAUDE.md & PRD gốc)

- Backend enforce mọi rule; frontend chỉ hiển thị. Cô lập theo `family_id`; con chỉ xem tiến trình của chính mình (bố mẹ xem cả nhà).
- Điểm bonus (streak) phải ghi `points_ledger` (audit trail), **idempotent** (không thưởng trùng), append-only.
- Level/streak/badge **derive được** từ dữ liệu gốc; không tạo "nguồn đúng" song song dễ lệch.
- An toàn trẻ em: không thu thập dữ liệu nhạy cảm; không thanh toán thật; điểm là "sao ⭐" số nguyên.

## 5. Ngoài phạm vi increment này

- Bảng xếp hạng giữa các con (leaderboard), cửa hàng avatar mua bằng điểm, thông báo đẩy/email — để increment sau.
- Huy hiệu **do bố mẹ tự định nghĩa** (custom) — giai đoạn này dùng bộ huy hiệu **hệ thống seed sẵn**; custom để sau.
- Job nền/scheduler (Celery/Redis) — không cần: reset chu kỳ dùng cơ chế **lazy** (tính lúc đọc/claim), thưởng streak tính **khi duyệt nhiệm vụ**.

## 6. Open questions (cần PO/bố mẹ chốt — đã có default để không chặn build)

- **Q-A (Level cơ sở):** Level theo **tổng sao lũy kế đã kiếm** (default, không tụt) hay theo **số dư hiện tại** (tụt khi đổi thưởng)? → *Default: lũy kế.*
- **Q-B (Thưởng khi lên cấp / đạt huy hiệu):** Có cộng thêm sao không, hay chỉ **danh hiệu/cosmetic**? → *Default: chỉ streak-milestone thưởng sao; lên cấp & huy hiệu chỉ cosmetic (tránh lạm phát điểm đổi thưởng).*
- **Q-C (Định nghĩa "ngày hoạt động" của streak):** Cần con hoàn thành **≥1 nhiệm vụ bất kỳ được duyệt trong ngày** (default) hay bắt buộc hoàn thành **nhiệm vụ hằng ngày cụ thể**? → *Default: ≥1 nhiệm vụ được duyệt/ngày (giờ VN).*
- **Q-D (Streak đứt):** Bỏ lỡ trọn 1 ngày là đứt (về 0) — default. Có cần "vé băng" (freeze) bỏ qua 1 ngày không? → *Default: không có freeze giai đoạn này.*
- **Q-E (Mốc & ngưỡng):** Mốc streak 3/7/14/30 và ngưỡng level (xem PRD §5) là đề xuất — bố mẹ có muốn chỉnh trong app không? → *Default: hằng số hệ thống, chưa cho chỉnh trong app.*
