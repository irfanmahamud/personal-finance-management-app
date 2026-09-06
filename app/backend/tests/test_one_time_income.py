from datetime import date

from server.db.models import TaxConfig
from tests.conftest import bearer, login
from tests.test_income import SPEC_CONFIG


async def test_create_list_patch_delete(client):
    token = await login(client, "a@example.com", "pass-a")
    created = await client.post(
        "/api/v1/one-time-income", headers=bearer(token),
        json={"label": "Eid bonus", "amount": 5_000_000, "date": str(date.today())},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["label"] == "Eid bonus"
    assert body["amount"] == 5_000_000
    assert body["taxable"] is False

    listed = (await client.get("/api/v1/one-time-income", headers=bearer(token))).json()
    assert len(listed) == 1 and listed[0]["id"] == body["id"]

    patched = await client.patch(
        f"/api/v1/one-time-income/{body['id']}", headers=bearer(token),
        json={"amount": 6_000_000, "taxable": True},
    )
    assert patched.status_code == 200
    assert patched.json()["amount"] == 6_000_000
    assert patched.json()["taxable"] is True

    deleted = await client.delete(f"/api/v1/one-time-income/{body['id']}", headers=bearer(token))
    assert deleted.status_code == 204
    listed_after = (await client.get("/api/v1/one-time-income", headers=bearer(token))).json()
    assert listed_after == []


async def test_scoped_to_household(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    created = (
        await client.post(
            "/api/v1/one-time-income", headers=bearer(token_a),
            json={"label": "Gift", "amount": 1_000_000, "date": str(date.today())},
        )
    ).json()

    cross_household_patch = await client.patch(
        f"/api/v1/one-time-income/{created['id']}", headers=bearer(token_b), json={"amount": 1}
    )
    assert cross_household_patch.status_code == 404

    cross_household_delete = await client.delete(
        f"/api/v1/one-time-income/{created['id']}", headers=bearer(token_b)
    )
    assert cross_household_delete.status_code == 404

    listed_b = (await client.get("/api/v1/one-time-income", headers=bearer(token_b))).json()
    assert listed_b == []


async def test_counts_toward_monthly_income_regardless_of_taxable(client):
    token = await login(client, "a@example.com", "pass-a")
    today = date.today()
    await client.post(
        "/api/v1/one-time-income", headers=bearer(token),
        json={"label": "Freelance gig", "amount": 3_000_000, "date": str(today), "taxable": False},
    )

    res = (await client.get("/api/v1/reports/monthly", headers=bearer(token))).json()
    assert res["income"] == 3_000_000


async def test_excluded_when_dated_outside_report_month(client):
    token = await login(client, "a@example.com", "pass-a")
    last_year = date(date.today().year - 1, 1, 15)
    await client.post(
        "/api/v1/one-time-income", headers=bearer(token),
        json={"label": "Old gift", "amount": 3_000_000, "date": str(last_year)},
    )

    res = (await client.get("/api/v1/reports/monthly", headers=bearer(token))).json()
    assert res["income"] == 0


async def test_taxable_one_time_income_feeds_tax_estimate(client, session_factory):
    async with session_factory() as db:
        db.add(TaxConfig(**SPEC_CONFIG))
        await db.commit()

    token = await login(client, "a@example.com", "pass-a")
    today = date.today()
    await client.post(
        "/api/v1/one-time-income", headers=bearer(token),
        json={"label": "Bonus", "amount": 10_000_000, "date": str(today), "taxable": True},
    )

    res = (await client.get("/api/v1/tax/estimate", headers=bearer(token))).json()
    assert res["gross_annual"] == 10_000_000  # no income sources, only the one-time entry


async def test_non_taxable_one_time_income_excluded_from_tax_estimate(client, session_factory):
    async with session_factory() as db:
        db.add(TaxConfig(**SPEC_CONFIG))
        await db.commit()

    token = await login(client, "a@example.com", "pass-a")
    today = date.today()
    await client.post(
        "/api/v1/one-time-income", headers=bearer(token),
        json={"label": "Gift", "amount": 10_000_000, "date": str(today), "taxable": False},
    )

    res = (await client.get("/api/v1/tax/estimate", headers=bearer(token))).json()
    assert res["gross_annual"] == 0


async def test_taxable_one_time_income_outside_fiscal_year_excluded(client, session_factory):
    async with session_factory() as db:
        db.add(TaxConfig(**SPEC_CONFIG))
        await db.commit()

    token = await login(client, "a@example.com", "pass-a")
    # Household default fiscal_year_start is 7 (July) - a date from 2 fiscal
    # years ago is always out of the current fiscal year regardless of today.
    long_ago = date(date.today().year - 2, 1, 1)
    await client.post(
        "/api/v1/one-time-income", headers=bearer(token),
        json={"label": "Old bonus", "amount": 10_000_000, "date": str(long_ago), "taxable": True},
    )

    res = (await client.get("/api/v1/tax/estimate", headers=bearer(token))).json()
    assert res["gross_annual"] == 0
