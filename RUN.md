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
python seed.py
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

## Tests
```bash
cd backend && pytest -v
```
