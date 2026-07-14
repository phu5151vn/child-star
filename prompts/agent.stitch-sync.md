# Claude Stitch Sync (Stitch MCP) — Ứng dụng tạo điểm loyalty cho con

Bạn đang ở Claude Code, chỉ xử lý **đồng bộ (sync) UI đã generate bằng Stitch** về repo qua Stitch MCP cho ứng dụng loyalty dạng game cho trẻ em (phong cách hình ảnh hoạt hình, dễ thương). Không tạo project mới.

Bối cảnh sản phẩm cần bám sát khi đối chiếu UI:
- 2 role: **Bố mẹ (parent)** và **Con (child)**.
- Bố mẹ: tạo/quản lý **nhiệm vụ (task)** kèm điểm và **phần thưởng (reward)** kèm mốc điểm.
- Con: chọn/nhận nhiệm vụ để tích điểm; xem kho phần thưởng với các mốc điểm; phần thưởng đã đủ điểm thì **mở khoá đổi**, phần thưởng chưa đủ điểm vẫn **hiển thị (locked)** để tạo động lực.
- Tông thị giác: game, màu tươi, minh hoạ hoạt hình, thân thiện với trẻ.

Bắt buộc đọc trước:
- `docs/agent-artifacts/02-design/ui-design-prompt.md`
- `docs/agent-artifacts/02-design/screen-inventory.md`
- `docs/agent-artifacts/02-design/stitch-screen-inventory.md` (nếu có)

Nhiệm vụ (dùng Stitch MCP `mcp__stitch__*`):
1. `mcp__stitch__list_projects` → tìm đúng project Stitch của ứng dụng loyalty cho con này theo title. Nếu chưa có project khớp, **dừng** và ghi rõ trong output (không tự tạo mới ở bước này).
2. `mcp__stitch__list_screens` + `mcp__stitch__get_screen` để lấy danh sách màn và chi tiết từng màn. Đối chiếu để chắc chắn có đủ các nhóm màn cốt lõi: onboarding/chọn role, dashboard bố mẹ (tạo/sửa nhiệm vụ & phần thưởng), dashboard con (danh sách nhiệm vụ + điểm hiện tại), màn kho phần thưởng (mốc điểm, trạng thái locked/unlocked/đổi thưởng), và các trạng thái loading/empty/error.
3. `mcp__stitch__download_assets` để tải ảnh/HTML export về `docs/agent-artifacts/02-design/stitch-assets/`.
4. Cập nhật/đồng bộ 3 tài liệu (truy vết được về project Stitch thực tế):
   - `docs/agent-artifacts/02-design/stitch-screen-inventory.md` — danh sách màn thực tế đã generate (id, route, mục đích, role sử dụng, states như loading/empty/error, trạng thái reward locked/unlocked).
   - `docs/agent-artifacts/02-design/stitch-asset-urls.md` — bảng URL ảnh + mã HTML từng màn.
   - `docs/agent-artifacts/02-design/stitch-design-notes.md` — design system thực tế (màu, token, font, spacing, bo góc, phong cách minh hoạt hình/game) lấy từ project Stitch.

Bắt buộc:
- Mọi đường dẫn dùng tương đối theo thư mục project hiện tại (`docs/...`), không dùng path tuyệt đối, không tham chiếu repo ngoài.
- Không sửa PRD/flow ngoài phạm vi sync UI.
- Ghi rõ project id Stitch, design system id, device type, model đã dùng.
- Nếu màn hình Stitch còn thiếu so với các nhóm màn cốt lõi ở trên, ghi phần "Gap" trong `stitch-screen-inventory.md` để Stage 2 xử lý.

Kết thúc bằng `Next step`:
1. Chạy `bash ./scripts/verify-artifacts.sh plan`
2. Chuyển sang Claude Stage 2 normalize để chốt readiness kỹ thuật.
