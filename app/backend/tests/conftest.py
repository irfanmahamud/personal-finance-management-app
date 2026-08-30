"""Test fixtures: real Postgres (finance_test database), tables from
Base.metadata, app with the DB dependency overridden."""

import asyncio
import uuid

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from server.core.security import hash_secret
from server.db.base import Base
from server.db.models import Household, User
from server.db.session import get_db
from server.main import create_app

TEST_DB_URL = "postgresql+asyncpg://finance:change-me-locally@localhost:5432/finance_test"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture()
async def db_engine():
    engine = create_async_engine(TEST_DB_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture()
async def session_factory(db_engine):
    return async_sessionmaker(db_engine, expire_on_commit=False)


@pytest_asyncio.fixture()
async def seeded(session_factory):
    """Two households, one user each - enough to prove scoping."""
    async with session_factory() as db:
        hh_a = Household(name="A")
        hh_b = Household(name="B")
        db.add_all([hh_a, hh_b])
        await db.flush()
        user_a = User(
            household_id=hh_a.id,
            email="a@example.com",
            password_hash=hash_secret("pass-a"),
            role="admin",
        )
        user_b = User(
            household_id=hh_b.id,
            email="b@example.com",
            password_hash=hash_secret("pass-b"),
            role="admin",
        )
        db.add_all([user_a, user_b])
        await db.commit()
        return {"hh_a": hh_a.id, "hh_b": hh_b.id, "user_a": user_a.id, "user_b": user_b.id}


@pytest_asyncio.fixture()
async def client(session_factory, seeded):
    app = create_app()

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        c.seeded = seeded
        yield c


async def login(client: httpx.AsyncClient, email: str, password: str) -> str:
    res = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
