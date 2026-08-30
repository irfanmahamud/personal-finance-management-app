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

Everything at once (Postgres → migrations → backend + frontend):

```bash
make start
```

`make stop` stops Postgres; Ctrl+C stops the apps. `make seed` seeds the
database, `make test` runs both suites, `make gen-api` regenerates the
frontend API types. Or run the pieces by hand:

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

## Production (single artifact)

Build the frontend, then let FastAPI serve it — one origin, one process:

```bash
cd app/frontend && npm run build
cd ../backend && STATIC_DIR=$(realpath ../frontend/dist) COOKIE_SECURE=true \
  uv run uvicorn server.main:app --host 0.0.0.0 --port 8000
```

Deploy behind TLS (`COOKIE_SECURE=true` requires it). To reach the app from
both phones, either host the container + a managed Postgres, or expose a
self-hosted instance over Tailscale.

## End-to-end tests

Playwright drives the built app (service worker active) against the local
backend. One-time system dependency:

```bash
sudo npx playwright install-deps chromium
```

Then, with the backend running and the database seeded:

```bash
cd app/frontend && npm run test:e2e
```

## Definition of Done — status

| # | Criterion | Status |
|---|---|---|
| 1 | Expense entry < 5s | Flow built for 3 taps; **measure on a real phone** |
| 2 | Airplane-mode write syncs, no duplicates | Queue logic unit-tested; e2e written (needs install-deps) |
| 3 | TDS matches last year within ৳1 | **Blocked on verified NBR slabs** (spec §13 Q1) |
| 4 | Reports reconcile with CSV | Automated test passes |
| 5 | Both languages, 1,00,000 grouping | Formatting unit-tested; toggle on every screen |
| 6 | Installs to Android home screen | Manifest + SW built; **confirm on a device** |
| 7 | Both users, logged-by + for-whom recorded | logged-by automatic; for-member UI arrives with Phase 2 members |
| 8 | No family names in source | grep clean |
