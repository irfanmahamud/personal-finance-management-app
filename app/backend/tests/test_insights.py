import uuid
from datetime import date, timedelta

from tests.conftest import bearer, login


async def _make_category(client, token: str, name="Groceries", name_bn="বাজার") -> str:
    res = await client.post(
        "/api/v1/categories", headers=bearer(token),
        json={"name_en": name, "name_bn": name_bn},
    )
    return res.json()["id"]


async def _log_expense(client, token, cat, amount, day: date):
    await client.post(
        "/api/v1/expenses", headers=bearer(token),
        json={"client_uuid": str(uuid.uuid4()), "date": day.isoformat(),
              "category_id": cat, "amount": amount},
    )


async def test_overspend_insight_from_budget_line(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _make_category(client, token)
    await client.post(
        "/api/v1/budgets", headers=bearer(token),
        json={"lines": [{"category_id": cat, "amount": 10_000}]},
    )
    await _log_expense(client, token, cat, 9_800, date.today())  # 98% used

    result = await client.get("/api/v1/insights", headers=bearer(token))
    assert result.status_code == 200, result.text
    overspend = [i for i in result.json() if i["type"] == "overspend"]
    assert len(overspend) == 1
    assert overspend[0]["severity"] == "warning"
    assert overspend[0]["pct"] == 98
    assert overspend[0]["days_left"] >= 0


async def test_pattern_insight_detects_concentrated_weekday(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _make_category(client, token)

    today = date.today()
    # Same weekday as today, 4 occurrences within the lookback window,
    # heavy spend - every other day gets nothing.
    for weeks_back in (0, 1, 2, 3):
        await _log_expense(client, token, cat, 50_000, today - timedelta(weeks=weeks_back))

    result = (await client.get("/api/v1/insights", headers=bearer(token))).json()
    pattern = [i for i in result if i["type"] == "pattern"]
    assert len(pattern) == 1
    assert pattern[0]["weekday"] == (today.weekday() + 1) % 7  # Postgres DOW convention
    assert pattern[0]["extra_pct"] >= 20


async def test_anomaly_insight_flags_spike_vs_six_month_average(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _make_category(client, token, "Health", "স্বাস্থ্য")

    today = date.today()
    # Modest historical spend, 3 and 4 months back.
    await _log_expense(client, token, cat, 5_000, today.replace(day=1) - timedelta(days=100))
    await _log_expense(client, token, cat, 5_000, today.replace(day=1) - timedelta(days=130))
    # This month: a spike well past 2x the trailing average.
    await _log_expense(client, token, cat, 30_000, today)

    result = (await client.get("/api/v1/insights", headers=bearer(token))).json()
    anomaly = [i for i in result if i["type"] == "anomaly" and i["category_id"] == cat]
    assert len(anomaly) == 1
    assert anomaly[0]["multiplier"] >= 2.0


async def test_savings_opportunity_insight_from_want_tagged_category(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _make_category(client, token, "Dining Out", "বাইরে খাওয়া")
    await client.patch(
        f"/api/v1/categories/{cat}", headers=bearer(token), json={"need_want_save": "want"}
    )
    await _log_expense(client, token, cat, 10_000, date.today())

    result = (await client.get("/api/v1/insights", headers=bearer(token))).json()
    opportunity = [i for i in result if i["type"] == "savings_opportunity"]
    assert len(opportunity) == 1
    assert opportunity[0]["category_id"] == cat
    assert opportunity[0]["cut_amount"] == 2_000  # 20% of 10_000, rounded
    assert opportunity[0]["annual_savings"] == 2_000 * 12


async def test_goal_projection_insight_from_contribution_history(client):
    token = await login(client, "a@example.com", "pass-a")
    goal = (
        await client.post(
            "/api/v1/savings/goals", headers=bearer(token),
            json={"name": "Emergency fund", "goal_type": "emergency_fund", "target_amount": 1_000_000},
        )
    ).json()
    await client.post(
        f"/api/v1/savings/goals/{goal['id']}/contributions", headers=bearer(token),
        json={"amount": 100_000},
    )

    result = (await client.get("/api/v1/insights", headers=bearer(token))).json()
    projection = [i for i in result if i["type"] == "goal_projection" and i["goal_id"] == goal["id"]]
    assert len(projection) == 1
    assert projection[0]["months_remaining"] > 0
    assert projection[0]["projected_completion_date"] is not None


async def test_insights_scoped_to_household(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    cat = await _make_category(client, token_a)
    await client.post(
        "/api/v1/budgets", headers=bearer(token_a),
        json={"lines": [{"category_id": cat, "amount": 10_000}]},
    )
    await _log_expense(client, token_a, cat, 9_800, date.today())

    result = (await client.get("/api/v1/insights", headers=bearer(token_b))).json()
    assert result == []
