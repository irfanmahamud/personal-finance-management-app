import uuid
from datetime import date

from tests.conftest import bearer, login


async def _seed_data(client, token):
    cat = (
        await client.post(
            "/api/v1/categories", headers=bearer(token),
            json={"name_en": "Groceries", "name_bn": "বাজার"},
        )
    ).json()["id"]
    sub = (
        await client.post(
            "/api/v1/categories", headers=bearer(token),
            json={"parent_id": cat, "name_en": "Fish", "name_bn": "মাছ"},
        )
    ).json()["id"]
    today = date.today().isoformat()
    for amount in (50_000, 30_000):  # ৳500 + ৳300 on the subcategory
        await client.post(
            "/api/v1/expenses", headers=bearer(token),
            json={"client_uuid": str(uuid.uuid4()), "date": today,
                  "category_id": sub, "amount": amount},
        )
    return cat, sub


async def test_monthly_summary_rolls_up_to_parent(client):
    token = await login(client, "a@example.com", "pass-a")
    cat, _sub = await _seed_data(client, token)

    res = (await client.get("/api/v1/reports/monthly", headers=bearer(token))).json()
    assert res["total_spent"] == 80_000
    assert res["entries"] == 2
    assert res["surplus"] == -80_000  # no income sources yet
    top = res["by_category"][0]
    assert top["category_id"] == cat  # subcategory spend attributed to parent
    assert top["spent"] == 80_000
    assert len(res["daily"]) == 1


async def test_category_report_with_drilldown(client):
    token = await login(client, "a@example.com", "pass-a")
    cat, sub = await _seed_data(client, token)
    today = date.today().isoformat()

    res = (
        await client.get(
            f"/api/v1/reports/category?date_from={today}&date_to={today}&category_id={cat}",
            headers=bearer(token),
        )
    ).json()
    assert res["total_spent"] == 80_000
    assert res["subcategories"][0]["category_id"] == sub
    assert res["subcategories"][0]["spent"] == 80_000


async def test_csv_reconciles_with_report(client):
    """DoD criterion 4: CSV totals must equal report totals exactly."""
    token = await login(client, "a@example.com", "pass-a")
    await _seed_data(client, token)
    today = date.today().isoformat()

    report = (await client.get("/api/v1/reports/monthly", headers=bearer(token))).json()

    res = await client.get(
        f"/api/v1/export/csv?date_from={today}&date_to={today}", headers=bearer(token)
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    lines = res.text.strip().splitlines()
    assert len(lines) == 3  # header + 2 rows
    # Sum the amount_bdt_taka column as a spreadsheet would.
    import csv as csv_mod
    import io
    rows = list(csv_mod.DictReader(io.StringIO(res.text)))
    csv_total_poisha = sum(
        int(r["amount_bdt_taka"].split(".")[0]) * 100 + int(r["amount_bdt_taka"].split(".")[1])
        for r in rows
    )
    assert csv_total_poisha == report["total_spent"]


async def test_budget_variance(client):
    token = await login(client, "a@example.com", "pass-a")
    cat, _ = await _seed_data(client, token)
    await client.post(
        "/api/v1/budgets", headers=bearer(token),
        json={"lines": [{"category_id": cat, "amount": 100_000}]},
    )
    res = (await client.get("/api/v1/reports/budget-variance", headers=bearer(token))).json()
    line = res["lines"][0]
    assert line["budgeted"] == 100_000
    assert line["spent"] == 80_000
    assert line["variance"] == 20_000


async def test_reports_scoped(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    await _seed_data(client, token_a)
    res = (await client.get("/api/v1/reports/monthly", headers=bearer(token_b))).json()
    assert res["total_spent"] == 0 and res["entries"] == 0
