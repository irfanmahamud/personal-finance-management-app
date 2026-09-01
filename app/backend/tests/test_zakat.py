from datetime import date

from server.db.models import ZakatConfig
from tests.conftest import bearer, login

ZAKAT_CONFIG = dict(
    nisab_threshold=90_000_00,
    rate_bps=250,
    effective_from=date(2025, 7, 1),
    verified=False,
)


async def _seed_config(session_factory):
    async with session_factory() as db:
        db.add(ZakatConfig(**ZAKAT_CONFIG))
        await db.commit()


async def test_estimate_below_nisab_owes_nothing(client, session_factory):
    await _seed_config(session_factory)
    token = await login(client, "a@example.com", "pass-a")

    await client.post(
        "/api/v1/networth/assets", headers=bearer(token),
        json={"category": "cash_bank", "name": "Savings", "value": 10_000_00},
    )

    result = await client.get("/api/v1/zakat/estimate", headers=bearer(token))
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["meets_nisab"] is False
    assert body["zakat_due"] == 0
    assert body["verified"] is False


async def test_estimate_combines_cash_gold_investments_minus_debt(client, session_factory):
    await _seed_config(session_factory)
    token = await login(client, "a@example.com", "pass-a")

    await client.post(
        "/api/v1/networth/assets", headers=bearer(token),
        json={"category": "cash_bank", "name": "Savings", "value": 100_000_00},
    )
    await client.post(
        "/api/v1/networth/assets", headers=bearer(token),
        json={"category": "gold_jewelry", "name": "Gold", "value": 50_000_00},
    )
    # Property is NOT zakatable - must not count.
    await client.post(
        "/api/v1/networth/assets", headers=bearer(token),
        json={"category": "property", "name": "Land", "value": 5_000_000_00},
    )
    await client.post(
        "/api/v1/investments", headers=bearer(token),
        json={"instrument_type": "dps", "name": "DPS", "amount": 20_000_00, "zakatable": True},
    )
    # Not flagged zakatable - must not count.
    await client.post(
        "/api/v1/investments", headers=bearer(token),
        json={"instrument_type": "business", "name": "Shop", "amount": 40_000_00, "zakatable": False},
    )
    await client.post(
        "/api/v1/debts", headers=bearer(token),
        json={"name": "Loan", "debt_type": "personal_loan", "principal": 20_000_00},
    )

    result = await client.get("/api/v1/zakat/estimate", headers=bearer(token))
    body = result.json()
    assert body["cash_and_bank"] == 100_000_00
    assert body["gold_and_jewelry"] == 50_000_00
    assert body["zakatable_investments"] == 20_000_00
    assert body["liabilities"] == 20_000_00
    expected_wealth = 100_000_00 + 50_000_00 + 20_000_00 - 20_000_00
    assert body["zakatable_wealth"] == expected_wealth
    assert body["meets_nisab"] is True
    assert body["zakat_due"] == expected_wealth * 250 // 10_000


async def test_zakat_config_patch_updates_estimate(client, session_factory):
    await _seed_config(session_factory)
    token = await login(client, "a@example.com", "pass-a")

    patched = await client.patch(
        "/api/v1/zakat/config", headers=bearer(token),
        json={"nisab_threshold": 5_000_00, "verified": True},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["nisab_threshold"] == 5_000_00
    assert patched.json()["verified"] is True

    await client.post(
        "/api/v1/networth/assets", headers=bearer(token),
        json={"category": "cash_bank", "name": "Savings", "value": 6_000_00},
    )
    result = (await client.get("/api/v1/zakat/estimate", headers=bearer(token))).json()
    assert result["meets_nisab"] is True
    assert result["verified"] is True


async def test_eid_mode_toggle_via_settings(client):
    token = await login(client, "a@example.com", "pass-a")

    default = await client.get("/api/v1/settings", headers=bearer(token))
    assert default.json()["eid_mode_enabled"] is False

    patched = await client.patch(
        "/api/v1/settings", headers=bearer(token), json={"eid_mode_enabled": True}
    )
    assert patched.status_code == 200
    assert patched.json()["eid_mode_enabled"] is True
