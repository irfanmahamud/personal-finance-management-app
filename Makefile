.PHONY: start dev db backend start-backend frontend stop migrate seed test test-backend test-frontend gen-api build

BACKEND := app/backend
FRONTEND := app/frontend
# Backend port from .env (default 8000)
BACKEND_PORT := $(shell grep -E '^BACKEND_PORT=' .env 2>/dev/null | cut -d= -f2)
BACKEND_PORT := $(if $(BACKEND_PORT),$(BACKEND_PORT),8000)
export BACKEND_PORT

## start everything: Postgres, then backend + frontend in parallel
start: db migrate
	$(MAKE) -j2 backend frontend

dev: start

## Postgres (waits until the container is healthy)
db:
	docker compose up -d --wait

## FastAPI with reload on $(BACKEND_PORT) (assumes Postgres is already up)
backend:
	cd $(BACKEND) && uv run uvicorn server.main:app --reload --port $(BACKEND_PORT)

## backend only, self-contained: Postgres -> migrations -> FastAPI
start-backend: db migrate backend

## Vite dev server on :5173 (proxies /api to the backend port)
frontend:
	cd $(FRONTEND) && npm run dev

## stop Postgres (backend/frontend stop with Ctrl+C)
stop:
	docker compose down

migrate:
	cd $(BACKEND) && uv run alembic upgrade head

## seed household, users, categories, tax config from .env
seed:
	cd $(BACKEND) && set -a && . ../../.env && set +a && uv run python -m server.db.seed

test: test-backend test-frontend

test-backend:
	cd $(BACKEND) && uv run pytest

test-frontend:
	cd $(FRONTEND) && npm test

## regenerate frontend API types (backend must be running)
gen-api:
	cd $(FRONTEND) && npm run gen:api

## production build of the SPA
build:
	cd $(FRONTEND) && npm run build
