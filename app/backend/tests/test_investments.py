from datetime import date, timedelta

from server.db.models import Investment, TaxConfig
from server.services.investments import _maturity_status, _projected_maturity_value
from tests.conftest import bearer, login
from tests.test_income import SPEC_CONFIG


def test_maturity_status_thresholds():
    today = date(2026, 8, 15)
    assert _maturity_status(None, today) == "none"
    assert _maturity_status(date(2026, 8, 14), today) == "overdue"
    assert _maturity_status(date(2026, 8, 22), today) == "renewal_due"  # 7 days out
    assert _maturity_status(date(2026, 9, 10), today) == "maturity_soon"  # 26 days out
    assert _maturity_status(date(2026, 10, 1), today) == "upcoming"


def test_projected_maturity_value_simple_interest():
    inv = Investment(amount=100_000, rate_bps=1000, tenure_months=12)  # 10% for 1 year
    assert _projected_maturity_value(inv) == 110_000

    inv_no_rate = Investment(amount=100_000, rate_bps=None, tenure_months=12)
    assert _projected_maturity_value(inv_no_rate) is None


async def test_create_investment_and_list(client):
    token = await login(client, "a@example.com", "pass-a")
    created = await client.post(
        "/api/v1/investments", headers=bearer(token),
        json={
            "instrument_type": "dps", "name": "City Bank DPS", "amount": 500_000,
            "rate_bps": 900, "tenure_months": 60,
            "maturity_date": (date.today() + timedelta(days=400)).isoformat(),
            "rebate_eligible": True,
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["effective_value"] == 500_000  # no manual current_value -> falls back to amount
    assert body["projected_maturity_value"] == 500_000 + 500_000 * 900 // 10_000 * 5
    assert body["maturity_status"] == "upcoming"

    listed = (await client.get("/api/v1/investments", headers=bearer(token))).json()
    assert len(listed) == 1
    assert listed[0]["id"] == body["id"]


async def test_patch_current_value_overrides_effective_value(client):
    token = await login(client, "a@example.com", "pass-a")
    created = (
        await client.post(
            "/api/v1/investments", headers=bearer(token),
            json={"instrument_type": "mutual_fund_gold", "name": "Gold", "amount": 200_000},
        )
    ).json()

    patched = await client.patch(
        f"/api/v1/investments/{created['id']}", headers=bearer(token),
        json={"current_value": 230_000},
    )
    assert patched.status_code == 200
    assert patched.json()["effective_value"] == 230_000
    assert patched.json()["amount"] == 200_000  # principal untouched


async def test_delete_and_household_scoping(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    created = (
        await client.post(
            "/api/v1/investments", headers=bearer(token_a),
            json={"instrument_type": "fdr", "name": "FDR", "amount": 100_000},
        )
    ).json()

    foreign_patch = await client.patch(
        f"/api/v1/investments/{created['id']}", headers=bearer(token_b), json={"amount": 1}
    )
    assert foreign_patch.status_code == 404

    foreign_delete = await client.delete(
        f"/api/v1/investments/{created['id']}", headers=bearer(token_b)
    )
    assert foreign_delete.status_code == 404

    deleted = await client.delete(f"/api/v1/investments/{created['id']}", headers=bearer(token_a))
    assert deleted.status_code == 204

    listed = (await client.get("/api/v1/investments?include_inactive=true", headers=bearer(token_a))).json()
    assert listed == []


async def test_portfolio_aggregates_and_maturities(client):
    token = await login(client, "a@example.com", "pass-a")
    await client.post(
        "/api/v1/investments", headers=bearer(token),
        json={"instrument_type": "dps", "name": "DPS 1", "amount": 100_000,
              "maturity_date": (date.today() + timedelta(days=10)).isoformat()},
    )
    await client.post(
        "/api/v1/investments", headers=bearer(token),
        json={"instrument_type": "fdr", "name": "FDR 1", "amount": 200_000, "current_value": 210_000,
              "maturity_date": (date.today() + timedelta(days=5)).isoformat()},
    )
    await client.post(
        "/api/v1/investments", headers=bearer(token),
        json={"instrument_type": "business", "name": "Shop", "amount": 300_000},
    )

    result = await client.get("/api/v1/investments/portfolio", headers=bearer(token))
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["total_invested"] == 600_000
    assert body["total_current_value"] == 610_000  # FDR's manual current_value counted
    assert len(body["next_maturities"]) == 2
    assert body["next_maturities"][0]["name"] == "FDR 1"  # sooner maturity first
    by_type = {row["instrument_type"]: row for row in body["by_type"]}
    assert by_type["dps"]["invested"] == 100_000
    assert by_type["business"]["current_value"] == 300_000  # no override -> falls back to amount


async def test_rebate_eligible_investment_feeds_tax_estimate(client, session_factory):
    async with session_factory() as db:
        db.add(TaxConfig(**SPEC_CONFIG))
        await db.commit()

    token = await login(client, "a@example.com", "pass-a")
    await client.post(
        "/api/v1/income-sources", headers=bearer(token),
        json={"name": "Salary", "type": "salary", "amount": 100_000_00, "amount_bdt": 100_000_00,
              "frequency": "monthly", "taxable": True},
    )

    without = await client.get("/api/v1/tax/estimate", headers=bearer(token))
    assert without.status_code == 200, without.text

    await client.post(
        "/api/v1/investments", headers=bearer(token),
        json={"instrument_type": "dps", "name": "DPS", "amount": 500_000, "rebate_eligible": True},
    )
    # An investment NOT flagged rebate-eligible must not count.
    await client.post(
        "/api/v1/investments", headers=bearer(token),
        json={"instrument_type": "business", "name": "Shop", "amount": 900_000, "rebate_eligible": False},
    )

    with_rebate = await client.get("/api/v1/tax/estimate", headers=bearer(token))
    assert with_rebate.status_code == 200, with_rebate.text

    # Rebate can only reduce (or hold) net tax, never increase it.
    assert with_rebate.json()["monthly_tds"] <= without.json()["monthly_tds"]
