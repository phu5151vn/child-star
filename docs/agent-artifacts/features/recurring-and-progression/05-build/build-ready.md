# Build Ready — Nhiệm vụ lặp lại & Tiến trình (Streak · Huy hiệu · Cấp độ)

> **Cổng chốt trước Build cho increment.** Truy vết đủ: `../00-intake/request.md`, `../01-product/prd.md`, `../03-architecture/architecture.md`, `../04-data/schema.md`, và code hiện hành (`backend/app`, `frontend/src`). Đây là tài liệu để Cursor implement.

## 1. Xác nhận readiness

| Điều kiện | Trạng thái |
|---|---|
| Intake + PRD khớp yêu cầu cải tiến (F1 hoàn thiện recurrence, F2 streak/level/badge) | ✅ |
| Hiện trạng code đã khảo sát (recurrence phần lớn xong; progression chưa có) | ✅ intake §1 |
| Architecture chốt (derive-first, thưởng đồng bộ trong approve, không scheduler) | ✅ |
| Schema chốt (3 bảng mới + mở rộng CHECK ledger, idempotency, seed) | ✅ |
| Rule nhạy cảm enforce backend, ledger append-only, isolation family | ✅ |
| Open issues ghi rõ (Q-A..Q-E) | ✅ §7 |

## 2. Vertical slices (thứ tự build đề xuất)

> Mỗi slice độc lập chạy được, có test; ưu tiên rẻ→giá trị cao trước.

**Slice 0 — F1 hoàn thiện recurrence (nhỏ, không đổi schema)**
- FE: `TaskCard` hiển thị **nhãn chu kỳ** (Một lần / Hằng ngày 🔁 / Hằng tuần 📅) + trạng thái "đã xong trong chu kỳ, làm lại sau" (BR-RC-3). Dùng `assignment_status`/`recurrence` đã trả về.
- BE: bổ sung test service reopen daily/weekly + chặn claim 2 lần/chu kỳ (BR-RC-5). Không đổi logic nếu đã đúng.

**Slice 1 — Nền progression (backend, derive)**
- `core/progression_rules.py`: `LEVEL_THRESHOLDS`, `STREAK_MILESTONES`, `STREAK_BONUS`, `level_for(lifetime)`, `next_threshold(...)` (pure).
- `models`+`ddl`+migration: bảng `badges`, `child_badges`, `streak_milestone_awards`; mở rộng `ck_ledger_kind` thêm `streak_bonus`; seed `badges` (schema §6).
- Repository: `lifetime_points`, `count_tasks_approved`, `active_days`, `count_rewards_redeemed`, `count_weekly_hits`, insert award idempotent (scope `family_id`).
- `ProgressionService.get_progression(child)` + `evaluate_badges(child)`; `StreakService.compute_current_streak/longest`, `maybe_award_streak_bonus`.

**Slice 2 — Tích hợp vào luồng duyệt & API đọc**
- Mở rộng `AssignmentService.approve`: sau `WeeklyService.maybe_award_bonus`, gọi streak bonus + evaluate badges + so sánh level trước/sau; thu `progression_events` vào `AssignmentResponse` (architecture §2.1).
- Mở rộng `reward_service.approve`: gọi `evaluate_badges(child)` (cho `rewards_redeemed_total`).
- Endpoint: `GET /children/{id}/progression`, `GET /badges`, mở rộng `GET /me` (child kèm level+streak tóm tắt).

**Slice 3 — Frontend tiến trình**
- Màn `/child/journey` + mục bottom-tab; components `LevelRing`, `StreakFlame`, `BadgeCard`, `BadgeShelf`.
- Top bar `ChildLayout`: chip `Lv.N` + `🔥streak`.
- `ParentChildrenPage`: hiển thị level/streak/số huy hiệu mỗi con.
- Ăn mừng: dùng `progression_events` từ `approve` để bật `CelebrationFx` (level-up/badge/streak).
- Query keys `['progression',childId]`, `['badges']`; invalidate sau approve/redeem.

## 3. Backend — yêu cầu build (chi tiết)

- **Layered giữ nguyên**: router chỉ HTTP + guard (`require_owner_child` cho con đọc tiến trình; parent scope family). Rule ở service; repository scope `family_id`.
- **Idempotency 3 lớp** (không được cộng/cấp trùng):
  - task_approved: unique ledger theo assignment (đã có) — giữ.
  - streak_bonus: **`streak_milestone_awards UNIQUE(child_id, milestone)`** — chèn award trước, thành công mới ghi ledger `streak_bonus`, cùng transaction; trùng → bỏ qua.
  - badge: **`child_badges UNIQUE(child_id, badge_code)`** — bắt `unique_violation` → no-op.
- **Điểm bonus** chỉ dương, qua `points_ledger` (append-only), trong phạm vi `advisory_lock_child` đã mở ở `approve`.
- **Derive-first**: level/streak/metrics tính từ dữ liệu gốc; không lưu counter nguồn đúng (AD1). Level & badge **không cộng sao** (AD6).
- **Múi giờ**: dùng `core/timeutil.py` (UTC+7) cho ngày hoạt động streak — nhất quán recurrence.
- **Backfill (tùy chọn)**: lệnh chạy `evaluate_badges` cho mọi con khi deploy để cấp huy hiệu quá khứ.

## 4. Frontend — yêu cầu build

- Stack & theme giữ nguyên (React+AntD, tokens Stitch "Bé Ngoan Playful"). Tông vui, nhiều icon, ít chữ cho màn con.
- **State mọi màn**: loading (Skeleton), empty (chưa có huy hiệu → khích lệ "Hoàn thành nhiệm vụ đầu tiên…"), error (Result + Thử lại).
- **Phân biệt earned vs locked huy hiệu** rõ như reward locked/unlocked (sáng/màu vs mờ + 🔒 + `Progress` "còn N nữa").
- **Level ring**: hiển thị Lv + danh hiệu + icon + % tới cấp kế + "còn N sao".
- **Streak flame**: 🔥 + số ngày + "còn X ngày tới mốc Y"; khi streak=0 → mời "Bắt đầu chuỗi hôm nay!".
- Ăn mừng qua `CelebrationFx` khi `progression_events` có level_up / badge mới / mốc streak.
- Không hardcode secret; quyền thực thi ở backend (guard FE chỉ ẩn/hiện).

## 5. Test strategy

| Loại | Ca tiêu biểu |
|---|---|
| **Unit (pure rules)** | `level_for`: biên 99/100/100→Lv, 2000+; `next_threshold` ở cấp cao nhất; `compute_current_streak`: liên tiếp tới hôm nay, giữ khi hôm nay chưa có nhưng hôm qua có, đứt khi lỡ trọn 1 ngày, longest đúng |
| **Unit (service)** | streak bonus **idempotent**: đạt mốc trong nhiều lần approve cùng ngày chỉ thưởng 1 lần; đạt lại mốc sau khi đứt-nối **không** thưởng lần 2 (unique trọn đời); evaluate_badges cấp đúng & không trùng; lên cấp **không** cộng sao; đổi thưởng **không** tụt level (lifetime dựa trên delta>0) |
| **Integration (API + quyền)** | `GET /children/{id}/progression`: con đọc của mình OK, đọc con khác → 403/404; parent đọc trong family; số liệu khớp seed; `GET /badges` trả catalog; `approve` trả `progression_events` đúng khi vừa lên cấp/đạt mốc/mở huy hiệu |
| **Race condition** | 2 approve song song cùng con khi vừa chạm mốc streak → chỉ 1 dòng `streak_bonus`, không cộng trùng (advisory lock + unique award) |
| **F1 recurrence** | reopen daily sang ngày mới; weekly sang tuần mới; chặn claim lần 2 trong cùng chu kỳ (BR-RC-5) |
| **Migration** | mở rộng CHECK ledger không hỏng dữ liệu cũ; seed badges tạo đúng; dữ liệu cũ tính được progression |

## 6. Định nghĩa hoàn thành (DoD)

- Backend: 3 bảng + migration + seed chạy; endpoint mới hoạt động; approve/redeem tích hợp progression; test unit+integration+race xanh; `pytest` pass.
- Frontend: màn journey + top-bar chips + parent view; states đầy đủ; ăn mừng hoạt động; typecheck/lint pass.
- Không lệch điểm: mọi bonus có dòng ledger + bản ghi award idempotent; đổi thưởng không đổi level.

## 7. Open issues (cần PO/bố mẹ chốt — không chặn bắt đầu build)

1. **Q-A** level theo **lũy kế** (default) hay số dư. → dùng lũy kế.
2. **Q-B** lên cấp / mở huy hiệu **có cộng sao** không → default: **không** (chỉ streak-milestone cộng).
3. **Q-C** "ngày hoạt động" = **≥1 nhiệm vụ duyệt/ngày** (default) hay bắt buộc daily task cụ thể.
4. **Q-D** streak **không freeze** (đứt là về 0) — default; cân nhắc "vé băng" ở increment sau.
5. **Q-E** ngưỡng level / mốc & số bonus streak / bộ huy hiệu là **hằng số hệ thống** — bố mẹ có muốn chỉnh trong app không (để sau).
6. **Backfill huy hiệu** cho dữ liệu cũ: chạy một lần khi deploy hay để cấp dần ở lần duyệt kế tiếp.

## 8. Next step

1. PO xác nhận Q-A..Q-E (hoặc chấp nhận default).
2. Cursor build theo slice 0→3; sau build cập nhật `05-build/build-report.md` (feature).
3. Claude review → `06-qa/` (feature).
