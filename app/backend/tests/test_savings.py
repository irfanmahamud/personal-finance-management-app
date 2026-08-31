from datetime import date

from server.services.savings import _add_months
from tests.conftest import bearer, login


def test_add_months_clamps_short_months():
    assert _add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert _add_months(date(2026, 1, 15), 2) == date(2026, 3, 15)
    assert _add_months(date(2026, 12, 5), 1) == date(2027, 1, 5)


async def test_create_goal_default_priority_and_progress(client):
    token = await login(client, "a@example.com", "pass-a")

    first = await client.post(
        "/api/v1/savings/goals", headers=bearer(token),
        json={"name": "Emergency fund", "goal_type": "emergency_fund", "target_amount": 100_000},
    )
    assert first.status_code == 201, first.text
    assert first.json()["priority"] == 1
    assert first.json()["progress_pct"] == 0
    assert first.json()["achieved"] is False

    second = await client.post(
        "/api/v1/savings/goals", headers=bearer(token),
        json={"name": "Hajj", "goal_type": "hajj_umrah", "target_amount": 500_000},
    )
    assert second.json()["priority"] == 2  # defaults after the first


async def test_contribution_updates_progress_and_milestones(client):
    token = await login(client, "a@example.com", "pass-a")
    goal = (
        await client.post(
            "/api/v1/savings/goals", headers=bearer(token),
            json={"name": "Vehicle", "goal_type": "vehicle", "target_amount": 100_000},
        )
    ).json()

    contributed = await client.post(
        f"/api/v1/savings/goals/{goal['id']}/contributions", headers=bearer(token),
        json={"amount": 50_000},
    )
    assert contributed.status_code == 201, contributed.text
    body = contributed.json()
    assert body["total_contributed"] == 50_000
    assert body["progress_pct"] == 50.0
    assert body["milestones_reached"] == [25, 50]
    assert body["remaining"] == 50_000
    assert body["achieved"] is False

    full = await client.post(
        f"/api/v1/savings/goals/{goal['id']}/contributions", headers=bearer(token),
        json={"amount": 50_000},
    )
    body = full.json()
    assert body["achieved"] is True
    assert body["progress_pct"] == 100.0
    assert body["remaining"] == 0
    assert body["projected_completion_date"] is None  # already achieved


async def test_contribution_list_and_household_scoping(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    goal = (
        await client.post(
            "/api/v1/savings/goals", headers=bearer(token_a),
            json={"name": "Wedding", "goal_type": "wedding", "target_amount": 200_000},
        )
    ).json()
    await client.post(
        f"/api/v1/savings/goals/{goal['id']}/contributions", headers=bearer(token_a),
        json={"amount": 20_000, "notes": "first"},
    )

    listed = (
        await client.get(f"/api/v1/savings/goals/{goal['id']}/contributions", headers=bearer(token_a))
    ).json()
    assert len(listed) == 1
    assert listed[0]["notes"] == "first"

    foreign_patch = await client.patch(
        f"/api/v1/savings/goals/{goal['id']}", headers=bearer(token_b), json={"target_amount": 1}
    )
    assert foreign_patch.status_code == 404

    foreign_contribute = await client.post(
        f"/api/v1/savings/goals/{goal['id']}/contributions", headers=bearer(token_b),
        json={"amount": 1},
    )
    assert foreign_contribute.status_code == 404

    foreign_list = (await client.get("/api/v1/savings/goals", headers=bearer(token_b))).json()
    assert foreign_list == []


async def test_deactivate_hides_from_default_list(client):
    token = await login(client, "a@example.com", "pass-a")
    goal = (
        await client.post(
            "/api/v1/savings/goals", headers=bearer(token),
            json={"name": "Custom goal", "goal_type": "custom", "target_amount": 10_000},
        )
    ).json()

    await client.patch(
        f"/api/v1/savings/goals/{goal['id']}", headers=bearer(token), json={"active": False}
    )
    default_list = (await client.get("/api/v1/savings/goals", headers=bearer(token))).json()
    assert default_list == []

    with_inactive = (
        await client.get("/api/v1/savings/goals?include_inactive=true", headers=bearer(token))
    ).json()
    assert len(with_inactive) == 1
    assert with_inactive[0]["active"] is False


async def test_allocation_suggestion_ranks_by_priority(client):
    token = await login(client, "a@example.com", "pass-a")

    await client.post(
        "/api/v1/income-sources", headers=bearer(token),
        json={"name": "Salary", "type": "salary", "amount": 100_000, "amount_bdt": 100_000,
              "frequency": "monthly", "taxable": True},
    )

    high = (
        await client.post(
            "/api/v1/savings/goals", headers=bearer(token),
            json={"name": "High priority", "goal_type": "custom", "target_amount": 30_000, "priority": 1},
        )
    ).json()
    low = (
        await client.post(
            "/api/v1/savings/goals", headers=bearer(token),
            json={"name": "Low priority", "goal_type": "custom", "target_amount": 1_000_000, "priority": 2},
        )
    ).json()

    result = await client.get("/api/v1/savings/allocation-suggestion", headers=bearer(token))
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["monthly_income"] == 100_000
    assert body["surplus"] == 100_000  # no expenses logged this month

    suggestions = {s["goal_id"]: s["suggested_amount"] for s in body["suggestions"]}
    assert suggestions[high["id"]] == 30_000  # capped at its remaining amount
    assert suggestions[low["id"]] == 70_000  # gets the rest of the surplus
