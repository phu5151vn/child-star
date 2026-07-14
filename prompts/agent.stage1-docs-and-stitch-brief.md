# Claude Stage 1–2: Intake + Product + Flow Docs — Ứng dụng tạo điểm loyalty cho con

Bạn đang ở Claude Code và chỉ xử lý:
- Stage 1: Intake normalization
- Stage 2: Product & flow specification

Đầu tiên, đọc:
- `README.md`
- `docs/agent-runbook.md`
- `CLAUDE.md`
- `docs/agent-artifacts/00-intake/` (nguồn sự thật là product idea đã cung cấp và `docs/agent-artifacts/00-intake/request.md` — KHÔNG có BRD/Excel bên ngoài)
- toàn bộ `docs/agent-artifacts/`

Bối cảnh sản phẩm (không suy diễn ngoài phạm vi này):
- Ứng dụng dạng game cho gia đình, hình ảnh hoạt hình, dễ thương, tạo động lực cho trẻ.
- Hai role: **Bố mẹ (parent)** và **Con (child)**, gắn với một hộ gia đình (family/household).
- Bố mẹ tạo/quản lý **nhiệm vụ (task)** kèm số **điểm (points)** và tạo/quản lý **phần thưởng (reward)** kèm **mốc điểm cần đạt**.
- Con chọn/nhận nhiệm vụ, hoàn thành để tích điểm; bố mẹ duyệt hoàn thành trước khi cộng điểm (cần xác định rõ có bước duyệt hay tự động).
- Phần thưởng hiển thị theo mốc điểm: đủ điểm thì **mở khoá để đổi**, chưa đủ vẫn hiển thị ở trạng thái **khoá** để con thấy mục tiêu và phấn đấu.
- Điểm được quản lý qua sổ giao dịch điểm (points ledger): cộng khi hoàn thành nhiệm vụ, trừ khi đổi thưởng.

Nhiệm vụ:
1. Chuẩn hóa `docs/agent-artifacts/00-intake/request.md` từ product idea, không suy diễn. Ghi rõ các điểm còn mơ hồ cần xác nhận (ví dụ: có duyệt hoàn thành hay không, điểm có hết hạn không, một nhiệm vụ lặp lại hay một lần, nhiều con trong một gia đình).
2. Chuẩn hóa `docs/agent-artifacts/01-product/prd.md` với:
   - Role matrix chi tiết cho **Bố mẹ** và **Con** (ai được tạo/sửa/xoá nhiệm vụ, phần thưởng; ai duyệt hoàn thành; ai đổi thưởng; ai xem sổ điểm).
   - Business rule đầy đủ: điều kiện chuyển trạng thái nhiệm vụ (available → nhận/đang làm → chờ duyệt → hoàn thành/từ chối), quy tắc cộng/trừ điểm, điều kiện mở khoá phần thưởng theo mốc điểm, quy tắc đổi thưởng (đủ điểm mới đổi, trừ điểm khi đổi), trường bắt buộc của nhiệm vụ và phần thưởng, quy tắc upload hình ảnh minh hoạ (icon nhiệm vụ/phần thưởng, ảnh bằng chứng hoàn thành nếu có).
   - Mọi rule nhạy cảm (điểm, mở khoá, đổi thưởng, transition, no-skip) phải nêu rõ được enforce ở backend.
3. Tạo/cập nhật docs flow:
   - `docs/agent-artifacts/02-design/ui-flow-spec.md` (design tokens theo hướng gamified/cartoon + screen list + navigation + Ant Design 5 component mapping cho web)
   - `docs/agent-artifacts/02-design/screen-inventory.md` (tối thiểu: đăng nhập/chọn hồ sơ, dashboard Bố mẹ, quản lý nhiệm vụ, quản lý phần thưởng, duyệt hoàn thành, dashboard Con, danh sách nhiệm vụ, cửa hàng phần thưởng với trạng thái khoá/mở, lịch sử điểm)
   - `docs/agent-artifacts/02-design/navigation.json`
   - `docs/agent-artifacts/02-design/states.md` (loading/empty/error cho từng màn; trạng thái phần thưởng khoá vs mở; điểm không đủ)
   - `docs/agent-artifacts/02-design/component-inventory.md`
4. Tạo `docs/agent-artifacts/02-design/ui-design-prompt.md` như prompt mô tả UI/UX web app cho Cursor: phong cách hoạt hình dễ thương, gamified (progress bar tiến tới mốc điểm, huy hiệu, màu tươi), layout, breakpoint, component chính theo từng screen, ánh xạ sang Ant Design 5 (dùng theme token/ConfigProvider để đạt look game-like mà vẫn giữ Ant Design).
5. Tạo draft cho:
   - `docs/agent-artifacts/03-architecture/architecture-draft.md`
   - `docs/agent-artifacts/04-data/schema-draft.md` (tối thiểu các entity: user/parent/child, family/household, task, reward, task_assignment/completion, points_ledger, reward_redemption; quan hệ và ràng buộc điểm)
6. Không implement code build ở stage này.

Bắt buộc:
- Mọi phần trong intake/product phải truy vết được về product idea và `docs/agent-artifacts/00-intake/request.md`.
- Product phải nêu rõ quyền theo role, điều kiện chuyển bước, trường bắt buộc, upload hình ảnh/chứng từ.
- Stack web: React 18 + Vite + TypeScript + Ant Design 5 + React Router v6 + TanStack Query.
- Viết tiếng Việt có dấu cho nội dung nghiệp vụ tiếng Việt.

Next step:
1. Hoàn tất đối chiếu artifacts theo `bash ./scripts/verify-artifacts.sh plan`
2. Quay lại Claude và paste `prompts/claude-stage2-normalize-after-stitch.md` để chốt readiness kỹ thuật
