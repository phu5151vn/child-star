# Claude Stage 3: Architecture/Data/API + Build Ready — Ứng dụng tạo điểm loyalty cho con

Bạn đang ở Claude Code và chỉ xử lý:
- chốt readiness kỹ thuật trước build cho ứng dụng loyalty/gamification dành cho gia đình (bố mẹ tạo nhiệm vụ + phần thưởng, con làm nhiệm vụ để tích điểm và đổi thưởng), với phong cách giao diện game hoạt hình dễ thương đã được phác thảo ở stage design (Stitch).

Đầu tiên, đọc:
- `README.md`
- `docs/agent-runbook.md`
- `CLAUDE.md`
- `docs/agent-artifacts/00-intake/request.md`
- `docs/agent-artifacts/01-product/prd.md`
- toàn bộ `docs/agent-artifacts/02-design/` (bao gồm `stitch-design-notes.md` và toàn bộ 41 assets đã tải trong `docs/agent-artifacts/02-design/stitch-assets/` — kiểm tra và ánh xạ asset vào từng màn hình)
- `docs/agent-artifacts/03-architecture/architecture-draft.md` nếu có
- `docs/agent-artifacts/04-data/schema-draft.md` nếu có

Lưu ý stage trước: bước Stitch sync đã hoàn tất thủ công (`status: done-manually`, 41 assets trong `02-design/stitch-assets/`). Hãy xác nhận design artifacts đã đủ để làm nguồn cho technical flow; ghi vào `open issues` nếu asset nào thiếu mapping hoặc chưa khớp PRD.

Nhiệm vụ:
1. Chuẩn hóa flow artifacts theo mô hình WO-style, bám sát 2 role **bố mẹ (parent)** và **con (child)**:
   - user flow: parent tạo/sửa/gán nhiệm vụ (task) với điểm tương ứng, tạo phần thưởng (reward) kèm mốc điểm; con xem danh sách nhiệm vụ, nhận/hoàn thành nhiệm vụ, tích điểm, xem các phần thưởng đã mở khoá và các phần thưởng chưa đủ điểm (hiển thị để tạo động lực), đổi điểm lấy phần thưởng khi đủ mốc; parent duyệt hoàn thành nhiệm vụ / xác nhận đổi thưởng nếu quy trình yêu cầu;
   - technical flow: mapping từng màn hình (theo Stitch assets) -> hành động -> API endpoint -> bảng dữ liệu;
   - traceability flow -> API -> data: mỗi business rule (điểm nhiệm vụ, mốc điểm mở khoá reward, trạng thái nhiệm vụ, số dư điểm của con) truy vết được tới endpoint và cột dữ liệu.
2. Chốt:
   - `docs/agent-artifacts/03-architecture/architecture.md`
   - `docs/agent-artifacts/04-data/schema.md`
3. Tạo/cập nhật:
   - `docs/agent-artifacts/05-build/implementation-plan.md`
   - `docs/agent-artifacts/05-build/build-ready.md`
4. Build-ready phải mô tả rõ:
   - frontend web (SPA phong cách game hoạt hình dễ thương, có loading/empty/error states cho mọi màn; hai giao diện phân biệt theo role parent/child, hiển thị reward đã mở khoá vs chưa đủ điểm);
   - backend FastAPI (router -> service/domain -> repository; enforce role parent/child, quyền tạo nhiệm vụ/phần thưởng chỉ dành cho parent, transition trạng thái nhiệm vụ, ràng buộc đổi thưởng phải đủ mốc điểm và trừ điểm nguyên tử/không âm ở backend);
   - queue/batch (nếu áp dụng — ví dụ thông báo khi con đạt mốc, reset định kỳ; nêu rõ nếu chưa cần Redis/Celery trong scope này);
   - test strategy (unit cho business rule tính điểm/đổi thưởng, integration cho API + phân quyền, kịch bản race condition khi đổi thưởng).
5. Không implement code ở bước này.

Bắt buộc:
- Architecture và data phải khớp intake + PRD vừa chuẩn hóa.
- Rule phân quyền (parent vs child), workflow step constraints (vòng đời nhiệm vụ, điều kiện mở khoá & đổi thưởng), dictionary/LOV (trạng thái nhiệm vụ, loại phần thưởng, đơn vị điểm) phải được phản ánh trong API/data contract.
- Bảng nghiệp vụ (users/roles, family/quan hệ parent-child, tasks, task_assignments, point_transactions/point_balance, rewards, reward_redemptions) phải có chính sách truy cập rõ ràng (RLS hoặc kiểm soát server-side tương đương); mọi thay đổi rule/điểm có audit trail.
- Ghi rõ mọi phần chưa đủ dữ liệu trong `open issues`.

Kết thúc bắt buộc bằng `Next step` gồm đúng 2 ý:
1. Chạy `bash ./scripts/verify-artifacts.sh build`
2. Nếu pass, mở Cursor và paste `prompts/cursor-build-from-approved-plan.md`
