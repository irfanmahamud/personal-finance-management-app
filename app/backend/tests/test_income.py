import uuid
from datetime import date

from server.db.models import TaxConfig
from tests.conftest import bearer, login

SPEC_CONFIG = dict(
    fiscal_year="2025-26",
    slabs=[
        {"up_to": 35_000_000, "rate_bps": 0},
        {"up_to": 45_000_000, "rate_bps": 500},
        {"up_to": 75_000_000, "rate_bps": 1000},
        {"up_to": 115_000_000, "rate_bps": 1500},
        {"up_to": 175_000_000, "rate_bps": 2000},
        {"up_to": None, "rate_bps": 2500},
    ],
    thresholds={"zero_band": {}, "min_tax": 0},
    rebate_rules={
        "salary_exemption_share_bps": 3333,
        "salary_exemption_cap": 45_000_000,
        "rebate_rate_bps": 1500,
        "max_investment_share_bps": 2000,
        "max_investment": 100_000_000,
    },
    effective_from=date(2025, 7, 1),
    verified=False,
)


async def test_income_sources_and_tax_estimate(client, session_factory):
    async with session_factory() as db:
        db.add(TaxConfig(**SPEC_CONFIG))
        await db.commit()

    token = await login(client, "a@example.com", "pass-a")

    # ৳1,00,000/month salary
    created = await client.post(
        "/api/v1/income-sources", headers=bearer(token),
        json={"name": "Salary", "type": "salary", "amount": 10_000_000},
    )
    assert created.status_code == 201
    assert created.json()["amount_bdt"] == 10_000_000  # BDT defaults

    # Monthly deduction: PF ৳5,000
    await client.post(
        "/api/v1/deductions", headers=bearer(token),
        json={"type": "provident_fund", "amount": 500_000},
    )

    res = (await client.get("/api/v1/tax/estimate", headers=bearer(token))).json()
    assert res["verified"] is False  # the UNVERIFIED banner must show
    assert res["gross_annual"] == 120_000_000  # ৳12,00,000
    # exemption = 12L * 3333bps = ৳3,99,960
    assert res["exemption"] == 120_000_000 * 3333 // 10_000
    # matches the engine unit test hand-calc
    assert res["gross_tax"] == 4_250_600
    assert res["monthly_tds"] == res["net_tax_annual"] // 12
    assert res["monthly_gross"] == 10_000_000
    assert res["monthly_deductions"] == 500_000
    assert res["monthly_net"] == 10_000_000 - res["monthly_tds"] - 500_000
    assert any(l["label"] == "Monthly TDS" for l in res["lines"])


async def test_inactive_source_excluded(client, session_factory):
    async with session_factory() as db:
        db.add(TaxConfig(**SPEC_CONFIG))
        await db.commit()

    token = await login(client, "a@example.com", "pass-a")
    source = (
        await client.post(
            "/api/v1/income-sources", headers=bearer(token),
            json={"name": "Old job", "type": "salary", "amount": 10_000_000},
        )
    ).json()
    await client.patch(
        f"/api/v1/income-sources/{source['id']}", headers=bearer(token),
        json={"active": False},
    )
    res = (await client.get("/api/v1/tax/estimate", headers=bearer(token))).json()
    assert res["gross_annual"] == 0 and res["monthly_tds"] == 0
