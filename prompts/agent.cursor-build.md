# Cursor Stage 4 Build (Manual) — Ứng dụng tạo điểm loyalty cho con

Bạn đang ở Cursor Agent và chỉ xử lý **Stage Build** theo artifacts đã approved. Sản phẩm là một **ứng dụng game hoá thưởng điểm cho con**: giao diện hoạt hình, dễ thương, thân thiện với trẻ; hai role **Bố mẹ (parent)** và **Con (child)**; bố mẹ tạo nhiệm vụ + phần thưởng, con chọn/hoàn thành nhiệm vụ để tích điểm, phần thưởng mở khoá theo mốc điểm.

Bắt buộc đọc trước khi code:
- `README.md`
- `docs/agent-runbook.md`
- `.cursor/rules/`
- `docs/agent-artifacts/00-intake/request.md`
- `docs/agent-artifacts/01-product/prd.md`
- toàn bộ `docs/agent-artifacts/02-design/` (bao gồm `02-design/stitch-assets/` — 41 asset đã sync thủ công; bám theo art style hoạt hình/dễ thương này)
- `docs/agent-artifacts/03-architecture/architecture.md`
- toàn bộ `docs/agent-artifacts/04-data/`
- `docs/agent-artifacts/05-build/implementation-plan.md`
- `docs/agent-artifacts/05-build/build-ready.md`

Nhiệm vụ:
1. Build đúng vertical slice đã được approve trong `implementation-plan.md` — không thừa, không thiếu.
2. Triển khai frontend web và backend FastAPI theo contract đã chốt, với các nhóm màn/luồng cốt lõi:
   - **Auth & chọn role**: đăng nhập, phân biệt Bố mẹ vs Con; child chỉ thấy dữ liệu trong phạm vi gia đình của mình.
   - **Parent — quản lý nhiệm vụ (nhiệm vụ/task)**: tạo/sửa/xoá nhiệm vụ, gán điểm thưởng cho từng nhiệm vụ, duyệt nhiệm vụ con báo hoàn thành.
   - **Parent — quản lý phần thưởng (reward)**: tạo/sửa/xoá phần thưởng với **mốc điểm (point threshold)** để mở khoá.
   - **Child — chọn & hoàn thành nhiệm vụ**: xem danh sách nhiệm vụ với điểm tương ứng, chọn/đánh dấu hoàn thành để cộng điểm (theo rule duyệt trong PRD).
   - **Child — kho phần thưởng**: hiển thị cả phần thưởng **đã mở khoá** (đủ điểm, cho phép đổi điểm) lẫn phần thưởng **chưa đủ điểm** (khoá + hiển thị mốc điểm còn thiếu để tạo động lực).
   - **Số dư điểm & lịch sử điểm** của con.
3. Bám đúng role-based flow và business rules trong PRD:
   - Chỉ **Bố mẹ** được tạo/sửa/xoá nhiệm vụ và phần thưởng, và duyệt hoàn thành nhiệm vụ.
   - Chỉ **Con** mới chọn nhiệm vụ và đổi phần thưởng; con **không** được tự thay đổi điểm hay tự duyệt.
   - Việc **cộng điểm khi hoàn thành nhiệm vụ** và **trừ điểm khi đổi phần thưởng** phải enforce ở backend (transaction, không cho điểm âm, không đổi khi chưa đủ mốc); frontend không tự quyết.
   - Trạng thái mở khoá phần thưởng tính từ điểm hiện có của con, do backend xác định.
4. Không mở rộng scope ngoài `implementation-plan.md`.
5. Khi xong, cập nhật `docs/agent-artifacts/05-build/build-report.md` (mô tả những gì đã build, endpoint/màn đã làm, cách chạy local, phần còn TODO).

Quy tắc:
- Không sửa lại intake/PRD trừ blocker nhỏ liên quan trực tiếp (ghi rõ lý do trong `build-report.md`).
- API, data model, permission check phải khớp business rule đã chuẩn hoá; data access theo layer router → service/domain → repository; không hardcode secret ở frontend.
- Mọi màn/endpoint phải có handling `loading`, `empty`/`not found`, `error` — đặc biệt màn danh sách nhiệm vụ, kho phần thưởng, và lịch sử điểm.
- Mọi thay đổi config/rule nhạy cảm (điểm, mốc mở khoá, duyệt hoàn thành, quyền role) phải có audit trail hoặc ghi rõ TODO.
- Giữ UI đúng tinh thần hoạt hình/dễ thương theo design trong `02-design/`; con là người dùng nhỏ tuổi nên ưu tiên đơn giản, trực quan, feedback tích cực.

Kết thúc bắt buộc bằng `Next step` gồm đúng 2 ý:
1. Chạy `bash ./scripts/verify-artifacts.sh review`
2. Nếu pass, quay lại Claude với `prompts/claude-review-after-build.md`
