# Build & run — Bé Ngoan

## Yêu cầu
- Docker (PostgreSQL)
- Python 3.11+
- Node.js 20+

## Chạy local

```bash
# 1. Database
docker compose up -d

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head   # tạo/cập nhật schema (do Alembic quản lý)
python seed.py         # nạp dữ liệu demo (chỉ chạy 1 lần)
uvicorn app.main:app --reload --port 8000

# 3. Frontend (terminal khác)
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API docs: http://localhost:8000/docs

## Tài khoản demo (sau seed)
- Parent: `parent@demo.com` / `demo1234`
- Family code: `DEMO01`
- Bé An PIN: `1234`, Bé Bình PIN: `5678`

## Database migrations (Alembic)

Schema do **Alembic** quản lý (không dùng `create_all`). Revision đánh số tuần tự: `0001`, `0002`, …

```bash
cd backend
alembic upgrade head                          # áp dụng migration tới mới nhất
alembic current                               # xem revision hiện tại của DB
alembic history                               # xem lịch sử migration

# Sau khi sửa model -> tạo migration mới (tự đánh số 0002…):
alembic revision --autogenerate -m "mô tả thay đổi"
# Kiểm tra file sinh ra trong alembic/versions/ rồi:
alembic upgrade head
```

- URL DB lấy từ `DATABASE_URL` (env) hoặc `.env`. Muốn migrate lên môi trường khác:
  `DATABASE_URL='postgresql+psycopg2://…' alembic upgrade head`.
- Partial unique index + trigger (`app/models/ddl.py`) được nhúng trong migration `0001` và
  được `include_object` bỏ qua khi autogenerate (không sinh lệnh drop nhầm).
- Deploy Render tự chạy `alembic upgrade head` trước khi start API (xem `render.yaml`).

## Lưu ảnh — Supabase Storage (bắt buộc)

Ảnh (minh chứng nhiệm vụ, icon, avatar) lưu trên **Supabase Storage** để không mất khi API
restart/deploy. Không còn lưu ở đĩa cục bộ của instance.

Thiết lập 1 lần:
1. Supabase Dashboard → **Storage** → **New bucket** → tên `media`, để **Private** (không bật public).
2. Lấy khóa ở **Project Settings → API**: `Project URL` và `service_role` key.
3. Đặt biến môi trường cho backend (local `.env` hoặc Render dashboard):

```bash
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=<service_role key — BÍ MẬT, chỉ backend giữ>
SUPABASE_STORAGE_BUCKET=media
```

- Bucket **private** + backend proxy tải ảnh (kèm kiểm tra quyền theo gia đình) ⇒ ảnh trẻ em
  không bao giờ công khai; client không thấy URL Supabase.
- Ảnh minh chứng **tự động bị xóa** sau khi bố mẹ duyệt/từ chối (không cần xem lại → tiết kiệm dung lượng).
- Chưa cấu hình 2 biến trên thì API upload/xem ảnh sẽ báo lỗi cấu hình (cố ý — không lưu tạm rồi mất).

## Tests
```bash
cd backend && pytest -v
```
