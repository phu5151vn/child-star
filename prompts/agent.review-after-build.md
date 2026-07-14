# Claude Review After Build — Bé Ngoan (Ứng dụng tạo điểm loyalty cho con)

Bạn đang chạy trong Claude Code và chỉ xử lý **Stage Review**. Tuyệt đối **không sửa code** ở bước này.

## 1. Đọc trước khi review
Đọc theo đúng thứ tự để nắm source of truth và contract:
- `README.md`
- `docs/agent-runbook.md`
- `CLAUDE.md`
- `docs/agent-artifacts/00-intake/request.md`
- `docs/agent-artifacts/01-product/prd.md`
- toàn bộ `docs/agent-artifacts/02-design/` (bao gồm `stitch-assets/` — kiểm tra tinh thần "game hoá, hình hoạt hình dễ thương" có được phản ánh trong UI không)
- `docs/agent-artifacts/03-architecture/architecture.md`
- toàn bộ `docs/agent-artifacts/04-data/`
- `docs/agent-artifacts/05-build/implementation-plan.md`
- `docs/agent-artifacts/05-build/build-ready.md`
- `docs/agent-artifacts/05-build/build-report.md`
- code trong `frontend` và `backend`

## 2. Nhiệm vụ review
Đối chiếu implementation với PRD, flow docs, architecture và data contracts. Đây là app cho trẻ em với 2 role **bố mẹ (parent)** và **con (child)**, cơ chế **nhiệm vụ → điểm → phần thưởng theo mốc điểm (unlock)**. Trọng tâm kiểm tra:

**Role & permission (enforce ở backend, không phải frontend):**
- Chỉ **bố mẹ** được tạo/sửa/xoá nhiệm vụ và phần thưởng; **con** không được tạo hoặc tự chỉnh điểm/phần thưởng.
- **Con** chỉ được chọn/nhận nhiệm vụ và đổi phần thưởng đã đủ điểm; không thể tự cộng điểm cho mình.
- Con của gia đình này không truy cập được dữ liệu (nhiệm vụ, điểm, phần thưởng) của gia đình/child khác — kiểm tra rò rỉ qua API (IDOR: truy cập bằng id tuỳ ý).

**Business rule về điểm & phần thưởng:**
- Điểm cộng đúng khi nhiệm vụ được duyệt/hoàn thành; không double-count, không cộng khi bị từ chối.
- Logic **unlock theo mốc điểm** chính xác: phần thưởng chỉ đổi được khi điểm hiện tại ≥ mốc yêu cầu; khi đổi, điểm bị trừ đúng và không cho phép điểm âm / race condition (đổi 2 lần cùng lúc).
- Phần thưởng **chưa đủ điểm vẫn hiển thị cho con** (để tạo động lực) nhưng ở trạng thái locked, không đổi được — kiểm tra cả UI lẫn enforcement backend.

**Workflow / transition constraints:**
- Vòng đời nhiệm vụ (ví dụ: tạo → con nhận → con báo hoàn thành → bố mẹ duyệt/từ chối) tuân thủ đúng trạng thái, no-skip, không quay lui trái phép.
- Required fields (điểm nhiệm vụ, mốc điểm phần thưởng...) được validate ở backend.

**Frontend states & UX trẻ em:**
- Đủ `loading / empty / error` state ở mọi màn hình chính (danh sách nhiệm vụ, phần thưởng, màn hình điểm của con).
- UI phù hợp định hướng game hoá, dễ thương theo design docs; phản hồi rõ ràng khi con đổi thưởng / khi bị khoá.

**Contract & data:**
- API/schema khớp contract trong `04-data/` và `03-architecture/`; không trả field ngoài phân quyền, không lộ dữ liệu child khác.

**Audit/logging:**
- Thay đổi quan trọng (tạo/sửa nhiệm vụ & phần thưởng, duyệt hoàn thành, cộng/trừ điểm, đổi thưởng) có audit trail đủ để truy vết.

## 3. Sản phẩm phải tạo/cập nhật
- `docs/agent-artifacts/06-qa/checklist.md` — checklist kiểm tra theo từng hạng mục ở trên, đánh dấu đạt/không đạt kèm bằng chứng (file:line hoặc endpoint).
- `docs/agent-artifacts/06-qa/review-report.md`

## 4. `review-report.md` phải ghi rõ
- Kết luận: **PASS / PASS WITH ISSUES / BLOCKED**.
- **Blocker** cần sửa trước merge (đặc biệt các lỗi phân quyền, rò rỉ dữ liệu child, sai logic điểm/unlock, điểm âm/race).
- **Issue** nên sửa trước release (UX, state thiếu, audit chưa đủ...).
- Bước tiếp theo.

## 5. Next step (bắt buộc)
Kết thúc report bằng mục `Next step`:
- Nếu **PASS**: có thể chuyển sang runtime verification / demo / merge.
- Nếu **không PASS**: yêu cầu chạy chuỗi resolve `claude-generate-resolve-plan` → `cursor-resolve-review-issues` → `claude-recheck-after-resolve`.
