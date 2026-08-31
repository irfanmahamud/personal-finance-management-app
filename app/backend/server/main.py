from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from server.core.config import get_settings
from server.core.errors import register_error_handlers
from server.api.v1.routers import auth as auth_router
from server.api.v1.routers import categories as categories_router
from server.api.v1.routers import budgets as budgets_router
from server.api.v1.routers import debts as debts_router
from server.api.v1.routers import expenses as expenses_router
from server.api.v1.routers import income as income_router
from server.api.v1.routers import investments as investments_router
from server.api.v1.routers import members as members_router
from server.api.v1.routers import networth as networth_router
from server.api.v1.routers import recurring as recurring_router
from server.api.v1.routers import reports as reports_router
from server.api.v1.routers import savings as savings_router
from server.api.v1.routers import settings as settings_router


def create_app() -> FastAPI:
    app = FastAPI(title="Personal Finance API", version="0.1.0")

    # In dev the Vite proxy makes everything same-origin, and in production
    # FastAPI serves the built SPA itself (M8) - CORS is a fallback for the
    # rare direct-origin case, not the primary path.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth_router.router, prefix="/api/v1")
    app.include_router(categories_router.router, prefix="/api/v1")
    app.include_router(budgets_router.router, prefix="/api/v1")
    app.include_router(debts_router.router, prefix="/api/v1")
    app.include_router(expenses_router.router, prefix="/api/v1")
    app.include_router(income_router.router, prefix="/api/v1")
    app.include_router(investments_router.router, prefix="/api/v1")
    app.include_router(members_router.router, prefix="/api/v1")
    app.include_router(networth_router.router, prefix="/api/v1")
    app.include_router(recurring_router.router, prefix="/api/v1")
    app.include_router(reports_router.router, prefix="/api/v1")
    app.include_router(savings_router.router, prefix="/api/v1")
    app.include_router(settings_router.router, prefix="/api/v1")

    # Production single-artifact mode (M8): FastAPI serves the built SPA.
    # One origin - the refresh cookie needs no CORS and no SameSite=None.
    static_dir = get_settings().static_dir
    if static_dir and Path(static_dir).is_dir():
        static_path = Path(static_dir)
        app.mount("/assets", StaticFiles(directory=static_path / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        async def spa(path: str) -> FileResponse:
            # Real files (manifest, icons, sw.js) are served as-is; anything
            # else falls back to index.html for the client-side router.
            candidate = static_path / path
            if path and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(static_path / "index.html")

    return app


app = create_app()
