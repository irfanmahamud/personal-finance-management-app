"""Regression tests for the Sep 2026 security audit findings."""

import uuid
from datetime import date

from server.db.models import ZakatConfig
from tests.conftest import bearer, login


async def _seed_zakat_template(session_factory):
    async with session_factory() as db:
        db.add(ZakatConfig(nisab_threshold=9_000_000, rate_bps=250, effective_from=date(2026, 1, 1)))
        await db.commit()


async def test_zakat_config_is_household_scoped(client, session_factory):
    """Finding: pre-fix, PATCH /zakat/config edited a GLOBAL row - any
    household could silently change every other household's nisab."""
    await _seed_zakat_template(session_factory)
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")

    before = (await client.get("/api/v1/zakat/estimate", headers=bearer(token_a))).json()

    tamper = await client.patch(
        "/api/v1/zakat/config", headers=bearer(token_b), json={"nisab_threshold": 1}
    )
    assert tamper.status_code == 200  # B may edit B's own config...

    after = (await client.get("/api/v1/zakat/estimate", headers=bearer(token_a))).json()
    assert after["nisab_threshold"] == before["nisab_threshold"]  # ...never A's

    b_view = (await client.get("/api/v1/zakat/config", headers=bearer(token_b))).json()
    assert b_view["nisab_threshold"] == 1


async def test_zakat_patch_never_edits_the_template(client, session_factory):
    await _seed_zakat_template(session_factory)
    token = await login(client, "a@example.com", "pass-a")
    await client.patch("/api/v1/zakat/config", headers=bearer(token), json={"nisab_threshold": 123})

    from sqlalchemy import select
    async with session_factory() as db:
        template = (
            await db.execute(select(ZakatConfig).where(ZakatConfig.household_id.is_(None)))
        ).scalar_one()
        assert template.nisab_threshold == 9_000_000


async def test_csv_export_escapes_formula_prefixes(client):
    """Finding: '=HYPERLINK(...)' in a description landed raw in the CSV."""
    token = await login(client, "a@example.com", "pass-a")
    cat = (
        await client.post(
            "/api/v1/categories", headers=bearer(token),
            json={"name_en": "Groceries", "name_bn": "বাজার"},
        )
    ).json()["id"]
    await client.post(
        "/api/v1/expenses", headers=bearer(token),
        json={"client_uuid": str(uuid.uuid4()), "date": "2026-09-24", "category_id": cat,
              "amount": 50_000, "description": '=HYPERLINK("http://evil","x")',
              "notes": "@SUM(1+9)"},
    )
    res = await client.get(
        "/api/v1/export/csv?date_from=2026-09-01&date_to=2026-09-30", headers=bearer(token)
    )
    body = res.text
    assert "'=HYPERLINK" in body and '"=HYPERLINK' not in body.replace("\"'=", "")
    assert "'@SUM" in body


async def test_receipt_rejects_nonimage_bytes_and_serves_nosniff(client):
    """Finding: HTML bytes declared image/png were stored and re-served."""
    token = await login(client, "a@example.com", "pass-a")
    fake = await client.post(
        "/api/v1/receipts", headers=bearer(token),
        files={"file": ("evil.png", b"<html><script>alert(1)</script>", "image/png")},
    )
    assert fake.status_code == 422

    # Real PNG magic, but the client LIES and says jpeg: stored as what the
    # bytes actually are.
    png = bytes.fromhex(
        "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753"
        "de0000000c4944415478da6360606060000000050001a5f645400000000049454e44ae426082"
    )
    real = await client.post(
        "/api/v1/receipts", headers=bearer(token),
        files={"file": ("r.jpg", png, "image/jpeg")},
    )
    assert real.status_code == 201
    assert real.json()["mime_type"] == "image/png"

    fetched = await client.get(f"/api/v1/receipts/{real.json()['id']}", headers=bearer(token))
    assert fetched.headers["x-content-type-options"] == "nosniff"
    assert "inline" in fetched.headers["content-disposition"]
