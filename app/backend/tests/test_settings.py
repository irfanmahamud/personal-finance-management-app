import uuid
from datetime import date

from sqlalchemy import select

from server.db.models import Budget, Household
from tests.conftest import bearer, login


async def _make_category(client, token: str) -> str:
    res = await client.post(
        "/api/v1/categories", headers=bearer(token),
        json={"name_en": "Groceries", "name_bn": "বাজার"},
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


async def _log_expense(client, token: str, category_id: str, day: date, amount: int = 10_000):
    res = await client.post(
        "/api/v1/expenses", headers=bearer(token),
        json={
            "client_uuid": str(uuid.uuid4()), "date": day.isoformat(),
            "category_id": category_id, "amount": amount,
        },
    )
    assert res.status_code == 201, res.text
    return res.json()


async def test_month_start_day_defaults_to_1(client):
    token = await login(client, "a@example.com", "pass-a")
    res = await client.get("/api/v1/settings", headers=bearer(token))
    assert res.status_code == 200
    assert res.json()["month_start_day"] == 1


async def test_month_start_day_patch_persists_and_is_bounded(client):
    token = await login(client, "a@example.com", "pass-a")
    res = await client.patch(
        "/api/v1/settings", headers=bearer(token), json={"month_start_day": 25}
    )
    assert res.status_code == 200, res.text
    assert res.json()["month_start_day"] == 25

    invalid = await client.patch(
        "/api/v1/settings", headers=bearer(token), json={"month_start_day": 29}
    )
    assert invalid.status_code == 422


async def test_changing_month_start_day_moves_current_budget_in_place(client):
    """The budget covering "today" under the OLD rule is reshaped to the
    NEW boundary in place - same id, same lines - rather than orphaned."""
    token = await login(client, "a@example.com", "pass-a")
    cat = await _make_category(client, token)

    created = await client.post(
        "/api/v1/budgets", headers=bearer(token),
        json={"lines": [{"category_id": cat, "amount": 100_000}]},
    )
    assert created.status_code == 201, created.text
    budget_id = created.json()["id"]

    patched = await client.patch(
        "/api/v1/settings", headers=bearer(token), json={"month_start_day": 25}
    )
    assert patched.status_code == 200, patched.text

    current = (await client.get("/api/v1/budgets/current", headers=bearer(token))).json()
    assert current["id"] == budget_id  # same budget, not a new one

    today = date.today()
    # Sanity-check the resolved boundary actually shifted off day 1.
    assert current["period_start"] != today.replace(day=1).isoformat()


async def test_budget_migration_recomputes_spent_for_the_new_boundary(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _make_category(client, token)
    today = date.today()

    await client.post(
        "/api/v1/budgets", headers=bearer(token),
        json={"lines": [{"category_id": cat, "amount": 100_000}]},
    )
    # An expense dated today - whether it counts depends on which side of
    # day 25 "today" falls, once the boundary shifts.
    await _log_expense(client, token, cat, today, amount=30_000)

    await client.patch("/api/v1/settings", headers=bearer(token), json={"month_start_day": 25})
    current = (await client.get("/api/v1/budgets/current", headers=bearer(token))).json()

    from server.services.periods import month_period
    new_start, new_end = month_period(today, 25)
    should_count = new_start <= today <= new_end
    expected_spent = 30_000 if should_count else 0
    assert current["total_spent"] == expected_spent
    assert current["lines"][0]["spent"] == expected_spent


async def test_changing_month_start_day_with_no_current_budget_is_a_no_op(client):
    token = await login(client, "a@example.com", "pass-a")
    res = await client.patch(
        "/api/v1/settings", headers=bearer(token), json={"month_start_day": 25}
    )
    assert res.status_code == 200, res.text
    assert res.json()["month_start_day"] == 25


async def test_migration_skipped_when_target_period_already_has_a_budget(client, session_factory):
    """A real conflict at the target period_start - inserted directly, since
    the normal create() flow always normalizes period_start through the
    CURRENT month_start_day and would itself reject a same-period-start
    duplicate. This models a rare leftover from an earlier setting."""
    from server.services.periods import month_period

    token = await login(client, "a@example.com", "pass-a")
    cat = await _make_category(client, token)
    today = date.today()

    current_budget = await client.post(
        "/api/v1/budgets", headers=bearer(token),
        json={"lines": [{"category_id": cat, "amount": 100_000}]},
    )
    current_budget_id = current_budget.json()["id"]

    target_start, target_end = month_period(today, 25)
    async with session_factory() as db:
        household = (await db.execute(select(Household).where(Household.name == "A"))).scalar_one()
        db.add(
            Budget(household_id=household.id, period_start=target_start, period_end=target_end)
        )
        await db.commit()

    await client.patch("/api/v1/settings", headers=bearer(token), json={"month_start_day": 25})

    # The original budget is untouched - still at its original boundary.
    from_history = await client.get("/api/v1/budgets/history", headers=bearer(token))
    ids = {b["id"] for b in from_history.json()}
    assert current_budget_id in ids
    original = next(b for b in from_history.json() if b["id"] == current_budget_id)
    assert original["period_start"] == today.replace(day=1).isoformat()


async def test_migration_symmetric_on_round_trip(client):
    """Changing month_start_day again uses the PREVIOUS value (not
    hardcoded to 1) as the old-period lookup key."""
    token = await login(client, "a@example.com", "pass-a")
    cat = await _make_category(client, token)

    created = await client.post(
        "/api/v1/budgets", headers=bearer(token),
        json={"lines": [{"category_id": cat, "amount": 100_000}]},
    )
    budget_id = created.json()["id"]

    await client.patch("/api/v1/settings", headers=bearer(token), json={"month_start_day": 25})
    await client.patch("/api/v1/settings", headers=bearer(token), json={"month_start_day": 1})

    current = (await client.get("/api/v1/budgets/current", headers=bearer(token))).json()
    assert current["id"] == budget_id
    today = date.today()
    assert current["period_start"] == today.replace(day=1).isoformat()
