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

    # ৳1,00,000/month salary, employer withholds TDS
    created = await client.post(
        "/api/v1/income-sources", headers=bearer(token),
        json={"name": "Salary", "type": "salary", "amount": 10_000_000,
              "tds_at_source": True},
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
    # Single all-withheld source: entire liability withheld, nothing to set aside
    assert res["withheld_annual"] == res["net_tax_annual"]
    assert res["remaining_payable_annual"] == 0
    assert res["monthly_set_aside"] == 0
    assert res["monthly_net"] == 10_000_000 - res["monthly_withheld"] - 500_000
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


async def test_mixed_withholding_split(client, session_factory):
    """Salary withheld at source + freelance not: liability splits into
    'already withheld' (proportional estimate) and 'set aside monthly'."""
    async with session_factory() as db:
        db.add(TaxConfig(**SPEC_CONFIG))
        await db.commit()

    token = await login(client, "a@example.com", "pass-a")
    # ৳60,000/mo salary with TDS at source; ৳40,000/mo freelance without
    await client.post(
        "/api/v1/income-sources", headers=bearer(token),
        json={"name": "Salary", "type": "salary", "amount": 6_000_000,
              "tds_at_source": True},
    )
    await client.post(
        "/api/v1/income-sources", headers=bearer(token),
        json={"name": "Freelance", "type": "freelance", "amount": 4_000_000,
              "tds_at_source": False},
    )

    res = (await client.get("/api/v1/tax/estimate", headers=bearer(token))).json()
    liability = res["net_tax_annual"]
    assert liability > 0
    # Proportional estimate: salary is 60% of taxable income
    assert res["withheld_annual"] == liability * 72_000_000 // 120_000_000
    assert res["remaining_payable_annual"] == liability - res["withheld_annual"]
    assert res["monthly_set_aside"] == res["remaining_payable_annual"] // 12
    # Take-home only nets out what is actually withheld
    assert res["monthly_net"] == 10_000_000 - res["monthly_withheld"]


async def test_payslip_figure_overrides_estimate(client, session_factory):
    """A known payslip TDS figure wins over the proportional estimate,
    and over-withholding shows as negative remaining (refund position)."""
    async with session_factory() as db:
        db.add(TaxConfig(**SPEC_CONFIG))
        await db.commit()

    token = await login(client, "a@example.com", "pass-a")
    await client.post(
        "/api/v1/income-sources", headers=bearer(token),
        json={"name": "Salary", "type": "salary", "amount": 10_000_000,
              "tds_at_source": True, "tds_amount_monthly": 500_000},  # ৳5,000/mo
    )
    res = (await client.get("/api/v1/tax/estimate", headers=bearer(token))).json()
    assert res["withheld_annual"] == 6_000_000  # 12 x payslip figure
    # Liability (42,506 taka = 4_250_600 poisha) < withheld 6_000_000 poisha
    assert res["remaining_payable_annual"] == res["net_tax_annual"] - 6_000_000
    assert res["remaining_payable_annual"] < 0  # refund position
    assert res["monthly_set_aside"] == 0
    assert res["monthly_net"] == 10_000_000 - 500_000


async def test_no_withholding_all_set_aside(client, session_factory):
    """Nothing withheld anywhere: full take-home now, full liability to
    self-provision monthly."""
    async with session_factory() as db:
        db.add(TaxConfig(**SPEC_CONFIG))
        await db.commit()

    token = await login(client, "a@example.com", "pass-a")
    await client.post(
        "/api/v1/income-sources", headers=bearer(token),
        json={"name": "Rental", "type": "rental", "amount": 10_000_000,
              "tds_at_source": False},
    )
    res = (await client.get("/api/v1/tax/estimate", headers=bearer(token))).json()
    assert res["withheld_annual"] == 0
    assert res["remaining_payable_annual"] == res["net_tax_annual"]
    assert res["monthly_set_aside"] == res["net_tax_annual"] // 12
    assert res["monthly_net"] == 10_000_000  # nothing withheld from payouts
