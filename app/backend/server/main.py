from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.core.config import get_settings
from server.core.errors import register_error_handlers
from server.api.v1.routers import auth as auth_router
from server.api.v1.routers import categories as categories_router
from server.api.v1.routers import budgets as budgets_router
from server.api.v1.routers import expenses as expenses_router
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
    app.include_router(expenses_router.router, prefix="/api/v1")
    app.include_router(settings_router.router, prefix="/api/v1")
    return app


app = create_app()
