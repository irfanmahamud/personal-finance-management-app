from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from the environment / repo-root .env."""

    model_config = SettingsConfigDict(
        env_file=("../../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql+asyncpg://finance:finance@localhost:5432/finance"
    jwt_secret: str = "insecure-dev-secret"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30
    cors_origins: str = "http://localhost:5173"
    # Production: serve the built SPA from this directory (M8 single-artifact
    # deploy). Empty = dev mode, the Vite dev server owns the frontend.
    static_dir: str = ""
    # Flip to True behind TLS in production - controls the refresh cookie.
    cookie_secure: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
