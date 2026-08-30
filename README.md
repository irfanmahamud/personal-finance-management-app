# Personal Finance App

A personal-first household finance manager for a Bangladeshi family. See
`finance_app_spec_v1.1.md` for the product spec (the product name is a
working title — nothing in the code is named after it).

## Layout

```
app/backend/    FastAPI + SQLAlchemy (async) + Alembic  — Python 3.11, uv
app/frontend/   Vite + React + TypeScript PWA           — npm
```

## Run (development)

Copy the environment template once:

```bash
cp .env.example .env   # then edit JWT_SECRET and the seed credentials
```

Start the database:

```bash
docker compose up -d
```

Backend (from `app/backend/`):

```bash
uv sync
uv run alembic upgrade head
uv run uvicorn server.main:app --reload --port 8000
```

Frontend (from `app/frontend/`):

```bash
npm install
npm run dev        # http://localhost:5173 — /api is proxied to :8000
```

After changing any Pydantic schema, regenerate the frontend API types
(backend must be running):

```bash
npm run gen:api
```

## Tests

```bash
cd app/backend && uv run pytest
cd app/frontend && npm test
```
