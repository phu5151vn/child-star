# Cursor Stage 4: Build từ plan đã approved — Ứng dụng tạo điểm loyalty cho con ("Bé Ngoan")

Bạn đang ở Cursor và chỉ xử lý **Stage 4 – Build implementation**. Không sửa artifacts stage trước; không mở rộng scope ngoài tài liệu đã approved.

Đầu tiên, đọc (bắt buộc, theo thứ tự):
- `README.md`, `docs/agent-runbook.md`, `CLAUDE.md`
- `docs/agent-artifacts/00-intake/request.md`
- `docs/agent-artifacts/01-product/prd.md`
- toàn bộ `docs/agent-artifacts/02-design/` (đặc biệt `stitch-design-notes.md`, `states.md`, `component-inventory.md`, `navigation.json`; assets ở `stitch-assets/`)
- `docs/agent-artifacts/03-architecture/architecture.md` (API contract + traceability)
- `docs/agent-artifacts/04-data/schema.md` (bảng + ràng buộc + ledger)
- `docs/agent-artifacts/05-build/implementation-plan.md` (vertical slices)
- `docs/agent-artifacts/05-build/build-ready.md` (mapping màn↔asset, FE/BE/queue/test, open issues)

## Bối cảnh sản phẩm
Ứng dụng web gamification cho gia đình: 2 role **bố mẹ (parent)** & **con (child)**. Bố mẹ tạo nhiệm vụ (kèm điểm) và phần thưởng (kèm mốc điểm); con làm nhiệm vụ → bố mẹ duyệt → cộng điểm; con đổi thưởng khi đủ mốc (bố mẹ duyệt → trừ điểm). Phần thưởng chưa đủ điểm vẫn hiển thị dạng khóa (teaser). UI game hoạt hình dễ thương ("Bé Ngoan Playful").

## Nguyên tắc build (bắt buộc)
1. **Build theo vertical slices** đúng thứ tự `implementation-plan.md §2` (Slice 0→7). Mỗi slice là 1 lát cắt DB→service→API→FE chạy & test được; không đóng slice khi rule chưa có test.
2. **Rule nhạy cảm CHỈ ở backend** (service layer): state machine no-skip, cộng điểm idempotent, trừ điểm không âm (advisory lock), mở khóa/đổi thưởng, phân quyền parent/child, cô lập `family_id`. Frontend không tự quyết.
3. **Contract-first, type-safe**: API khớp `architecture.md §3`; Pydantic v2 (BE) + TypeScript types (FE) đồng bộ. Mã lỗi domain đúng chuẩn (`INVALID_TRANSITION`, `INSUFFICIENT_POINTS`, `REWARD_LOCKED`, `OUT_OF_STOCK`, `FORBIDDEN_ROLE`, `PROOF_REQUIRED`...).
4. **Data**: đúng `schema.md` — ledger append-only, partial unique index (idempotency), CHECK constraints, `pg_advisory_xact_lock(child)` khi trừ điểm. Số dư là derived (SUM ledger), không lưu như nguồn đúng.
5. **Frontend**: 2 shell theo role (`navigation.json`); theme tokens Stitch qua AntD `ConfigProvider`; **mọi màn có loading/empty/error**; kho thưởng phân biệt rõ unlocked / locked (+"còn thiếu N sao") / out_of_stock. Dùng component trong `component-inventory.md`, map màn↔asset theo `build-ready.md §2`.
6. **Queue**: KHÔNG dùng Redis/Celery giai đoạn 1 (build-ready §5) — thông báo/hàng đợi qua refetch TanStack Query.
7. **An toàn trẻ em**: con login `family_code`+avatar+PIN; không thu thập email/sđt trẻ; không thanh toán thật; media validate + serve có auth.
8. **Test**: theo `build-ready.md §6` — unit rule tính/đổi điểm, integration API + phân quyền + cô lập family, race condition đổi thưởng. Chạy lint/typecheck/test trước khi báo hoàn thành mỗi slice.

## Đầu ra
- Mã nguồn `backend/` (FastAPI layered) + `frontend/` (React+Vite+TS+AntD) theo cấu trúc `implementation-plan.md §1`.
- Cập nhật `docs/agent-artifacts/05-build/build-report.md`: slice đã build, quyết định kỹ thuật, cách chạy (migrate/seed/dev), kết quả test, việc còn lại / lệch so với plan (nếu có).

## Ràng buộc
- Bám đúng intake/PRD/architecture/schema; không thêm rule/bảng/endpoint ngoài artifacts.
- Nếu phát hiện artifact thiếu/không khớp → ghi vào `build-report.md` (mục "câu hỏi/mâu thuẫn"), không tự ý suy diễn rule nhạy cảm.

## Next step (sau build)
1. Chạy `bash ./scripts/verify-artifacts.sh review`
2. Nếu pass, quay lại Claude và paste `prompts/claude-review-after-build.md`
