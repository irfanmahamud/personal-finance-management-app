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


async def test_add_line_to_existing_budget(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token, "Housing", "আবাসন")
    other_cat = await _setup_category(client, token, "Transport", "পরিবহন")

    created = await client.post(
        "/api/v1/budgets", headers=bearer(token),
        json={"lines": [{"category_id": cat, "amount": 50_000}]},
    )
    budget_id = created.json()["id"]

    added = await client.post(
        f"/api/v1/budgets/{budget_id}/lines", headers=bearer(token),
        json={"category_id": other_cat, "amount": 20_000},
    )
    assert added.status_code == 201, added.text
    names = {l["category_name_en"] for l in added.json()["lines"]}
    assert names == {"Housing", "Transport"}

    # Same category again -> conflict, not a silent duplicate.
    dup = await client.post(
        f"/api/v1/budgets/{budget_id}/lines", headers=bearer(token),
        json={"category_id": other_cat, "amount": 1},
    )
    assert dup.status_code == 409

    # A subcategory can't be added directly as a budget line.
    sub = (
        await client.post(
            "/api/v1/categories", headers=bearer(token),
            json={"name_en": "Bus fare", "name_bn": "বাস ভাড়া", "parent_id": other_cat},
        )
    ).json()["id"]
    bad = await client.post(
        f"/api/v1/budgets/{budget_id}/lines", headers=bearer(token),
        json={"category_id": sub, "amount": 1},
    )
    assert bad.status_code == 422

    # Household B cannot add a line to household A's budget.
    token_b = await login(client, "b@example.com", "pass-b")
    foreign = await client.post(
        f"/api/v1/budgets/{budget_id}/lines", headers=bearer(token_b),
        json={"category_id": other_cat, "amount": 1},
    )
    assert foreign.status_code == 404


def _next_month_start(day: date) -> date:
    return date(day.year + 1, 1, 1) if day.month == 12 else date(day.year, day.month + 1, 1)


async def test_create_next_period_and_fetch_by_period(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)

    current = await client.post(
        "/api/v1/budgets", headers=bearer(token),
        json={"lines": [{"category_id": cat, "amount": 100_000}]},
    )
    assert current.status_code == 201

    next_start = _next_month_start(date.today())
    created = await client.post(
        "/api/v1/budgets", headers=bearer(token),
        json={
            "period_start": next_start.isoformat(),
            "lines": [{"category_id": cat, "amount": 120_000}],
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["period_start"] == next_start.isoformat()

    fetched = await client.get(
        f"/api/v1/budgets/{next_start.strftime('%Y-%m')}", headers=bearer(token)
    )
    assert fetched.status_code == 200
    assert fetched.json()["total_amount"] == 120_000

    missing = await client.get("/api/v1/budgets/1999-01", headers=bearer(token))
    assert missing.status_code == 404

    bad_format = await client.get("/api/v1/budgets/not-a-period", headers=bearer(token))
    assert bad_format.status_code == 422


async def test_budget_history_scoped_and_ordered(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    cat_a = await _setup_category(client, token_a)
    cat_b = await _setup_category(client, token_b)

    next_start = _next_month_start(date.today())
    await client.post(
        "/api/v1/budgets", headers=bearer(token_a),
        json={"lines": [{"category_id": cat_a, "amount": 50_000}]},
    )
    await client.post(
        "/api/v1/budgets", headers=bearer(token_a),
        json={"period_start": next_start.isoformat(), "lines": [{"category_id": cat_a, "amount": 60_000}]},
    )
    await client.post(
        "/api/v1/budgets", headers=bearer(token_b),
        json={"lines": [{"category_id": cat_b, "amount": 999}]},
    )

    history = (await client.get("/api/v1/budgets/history", headers=bearer(token_a))).json()
    assert [h["total_amount"] for h in history] == [60_000, 50_000]  # newest period first
