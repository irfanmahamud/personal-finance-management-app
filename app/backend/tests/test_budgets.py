from datetime import date

from server.services.periods import (
    fiscal_year_label,
    month_period,
    rollover_amount,
)
from tests.conftest import bearer, login


# --- Pure period math (money math - exhaustive) ---

def test_month_period_boundaries():
    assert month_period(date(2026, 8, 30)) == (date(2026, 8, 1), date(2026, 8, 31))
    assert month_period(date(2026, 2, 10)) == (date(2026, 2, 1), date(2026, 2, 28))
    assert month_period(date(2028, 2, 10)) == (date(2028, 2, 1), date(2028, 2, 29))  # leap
    assert month_period(date(2026, 12, 31)) == (date(2026, 12, 1), date(2026, 12, 31))


def test_fiscal_year_label():
    assert fiscal_year_label(date(2026, 8, 30), 7) == "2026-27"
    assert fiscal_year_label(date(2026, 6, 30), 7) == "2025-26"
    assert fiscal_year_label(date(2026, 8, 30), 1) == "2026"


def test_rollover_never_negative():
    assert rollover_amount(100_000, 0, 30_000) == 70_000
    assert rollover_amount(100_000, 20_000, 150_000) == 0  # overspent
    assert rollover_amount(100_000, 20_000, 90_000) == 30_000  # includes prior rollover


# --- API flow ---

async def _setup_category(client, token, name="Groceries", name_bn="বাজার"):
    res = await client.post(
        "/api/v1/categories", headers=bearer(token),
        json={"name_en": name, "name_bn": name_bn},
    )
    return res.json()["id"]


async def test_custom_budget_with_spend_and_warnings(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)

    created = await client.post(
        "/api/v1/budgets", headers=bearer(token),
        json={"lines": [{"category_id": cat, "amount": 100_000}]},
    )
    assert created.status_code == 201, created.text

    # Spend 80% -> warn75
    import uuid as uuid_mod
    today = date.today().isoformat()
    await client.post(
        "/api/v1/expenses", headers=bearer(token),
        json={"client_uuid": str(uuid_mod.uuid4()), "date": today,
              "category_id": cat, "amount": 80_000},
    )
    current = (await client.get("/api/v1/budgets/current", headers=bearer(token))).json()
    line = current["lines"][0]
    assert line["spent"] == 80_000
    assert line["available"] == 20_000
    assert line["status"] == "warn75"
    assert current["total_spent"] == 80_000

    # Push past 95% -> warn95, and available goes negative without any block
    await client.post(
        "/api/v1/expenses", headers=bearer(token),
        json={"client_uuid": str(uuid_mod.uuid4()), "date": today,
              "category_id": cat, "amount": 30_000},
    )
    line = (await client.get("/api/v1/budgets/current", headers=bearer(token))).json()["lines"][0]
    assert line["status"] == "warn95"
    assert line["available"] == -10_000


async def test_duplicate_period_conflict(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)
    body = {"lines": [{"category_id": cat, "amount": 1_000}]}
    assert (await client.post("/api/v1/budgets", headers=bearer(token), json=body)).status_code == 201
    assert (await client.post("/api/v1/budgets", headers=bearer(token), json=body)).status_code == 409


async def test_template_budget_allocates_percentages(client):
    token = await login(client, "a@example.com", "pass-a")
    # Template matching needs the seeded category names; create two of them.
    await _setup_category(client, token, "Housing", "আবাসন")
    await _setup_category(client, token, "Savings & Investment", "সঞ্চয়")

    created = await client.post(
        "/api/v1/budgets", headers=bearer(token),
        json={"template": "young_professional", "total_amount": 1_000_000},
    )
    assert created.status_code == 201
    lines = {l["category_name_en"]: l["amount"] for l in created.json()["lines"]}
    assert lines["Housing"] == 300_000        # 30%
    assert lines["Savings & Investment"] == 200_000  # 20%


async def test_line_patch_and_scoping(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    cat = await _setup_category(client, token_a)
    created = (
        await client.post(
            "/api/v1/budgets", headers=bearer(token_a),
            json={"lines": [{"category_id": cat, "amount": 50_000}]},
        )
    ).json()
    budget_id, line_id = created["id"], created["lines"][0]["id"]

    patched = await client.patch(
        f"/api/v1/budgets/{budget_id}/lines/{line_id}",
        headers=bearer(token_a), json={"amount": 60_000, "rollover_enabled": True},
    )
    line = patched.json()["lines"][0]
    assert line["amount"] == 60_000 and line["rollover_enabled"] is True

    # Household B cannot touch it.
    foreign = await client.patch(
        f"/api/v1/budgets/{budget_id}/lines/{line_id}",
        headers=bearer(token_b), json={"amount": 1},
    )
    assert foreign.status_code == 404
