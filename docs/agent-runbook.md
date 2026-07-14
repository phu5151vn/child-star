# Agent Runbook

## Nguyên tắc chung

- Đây là repo `manual handoff`: Claude chuẩn hóa tài liệu trước, Cursor implement sau, Claude review cuối.
- Không dùng flow Stitch cho UI generation; source of truth nghiệp vụ là BRD/Excel + artifacts đã chuẩn hóa.
- Flow/engine tham chiếu theo mô hình WO của `debtor-portrait-202603`, nhưng ngữ cảnh business giữ theo NPL.
- Luồng triển khai chuẩn: `Intake -> Product -> User flow/Technical flow -> Architecture/Data/API -> Build -> Review -> Resolve`.

## Stage ownership

### Prep
Thủ công:
- chuẩn bị môi trường backend/frontend;
- điền env;
- chuẩn bị DB/Redis;
- xác nhận tools và skills.

### Stage 1 - Intake normalization
Claude:
- đọc BRD + Excel nguồn;
- chuẩn hóa `docs/agent-artifacts/00-intake/request.md`;
- ghi rõ open questions và assumption.

### Stage 2 - Product specification
Claude:
- chuẩn hóa `docs/agent-artifacts/01-product/prd.md`;
- chi tiết vai trò/quyền/use case/rule/acceptance criteria theo Excel.

### Stage 3 - Flow and architecture readiness
Claude:
- chốt user flow + technical flow + architecture + data + API contract + build-ready artifacts.

### Stage 4 - Build implementation
Cursor:
- implement web frontend + FastAPI backend theo artifacts đã approved;
- cập nhật build report.

### Stage 5 - Review
Claude:
- review code và artifact theo checklist;
- phát hành review report và resolve plan (nếu có).

### Stage 6 - Resolve loop
Cursor rồi Claude:
- Cursor sửa theo resolve plan;
- Claude re-review và chốt verdict.
