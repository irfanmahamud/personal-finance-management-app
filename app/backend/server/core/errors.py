"""Service-layer exception hierarchy and its single HTTP mapping.

Routers never raise HTTPException directly; services raise these and the
handlers registered in main.py translate them. One mapping, no ad-hoc codes.
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class ServiceError(Exception):
    status_code = 500
    detail = "Internal error"

    def __init__(self, detail: str | None = None):
        if detail is not None:
            self.detail = detail
        super().__init__(self.detail)


class NotFoundError(ServiceError):
    status_code = 404
    detail = "Not found"


class ConflictError(ServiceError):
    status_code = 409
    detail = "Conflict"


class DomainValidationError(ServiceError):
    status_code = 422
    detail = "Invalid input"


class AuthError(ServiceError):
    status_code = 401
    detail = "Not authenticated"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ServiceError)
    async def service_error_handler(_: Request, exc: ServiceError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
