from datetime import date

from server.services.recurring import _advance_month, _initial_due_date, _status
from tests.conftest import bearer, login


# --- Pure date math ---

def test_advance_month_clamps_short_months():
    assert _advance_month(date(2026, 1, 31), 31) == date(2026, 2, 28)
    assert _advance_month(date(2026, 1, 15), 15) == date(2026, 2, 15)
    assert _advance_month(date(2026, 12, 5), 5) == date(2027, 1, 5)


def test_initial_due_date_this_month_or_next():
    today = date(2026, 8, 15)
    assert _initial_due_date(today, 20) == date(2026, 8, 20)  # later this month
    assert _initial_due_date(today, 15) == date(2026, 8, 15)  # today counts
    assert _initial_due_date(today, 10) == date(2026, 9, 10)  # already passed -> next month
    assert _initial_due_date(date(2026, 1, 31), 28) == date(2026, 2, 28)  # 28th already passed
    assert _initial_due_date(date(2026, 1, 1), 28) == date(2026, 1, 28)


def test_status_thresholds():
    today = date(2026, 8, 15)
    assert _status(date(2026, 8, 14), today, True) == "overdue"
    assert _status(date(2026, 8, 15), today, True) == "due_today"
    assert _status(date(2026, 8, 18), today, True) == "due_soon"
    assert _status(date(2026, 8, 19), today, True) == "upcoming"
    assert _status(date(2026, 8, 14), today, False) == "inactive"


# --- API flow ---

async def _setup_category(client, token, name="Utilities", name_bn="ইউটিলিটি"):
    res = await client.post(
        "/api/v1/categories", headers=bearer(token),
        json={"name_en": name, "name_bn": name_bn},
    )
    return res.json()["id"]


def _safe_day(today: date) -> int:
    return min(today.day, 28)


async def test_create_recurring_rule_and_list(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)

    created = await client.post(
        "/api/v1/recurring", headers=bearer(token),
        json={"name": "Internet", "category_id": cat, "amount": 120_000, "day_of_month": _safe_day(date.today())},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["active"] is True
    assert body["last_paid_date"] is None
    assert body["status"] in ("overdue", "due_today", "due_soon", "upcoming")

    listed = (await client.get("/api/v1/recurring", headers=bearer(token))).json()
    assert len(listed) == 1
    assert listed[0]["id"] == body["id"]
    assert listed[0]["category_name_en"] == "Utilities"


async def test_mark_paid_creates_expense_and_advances_due_date(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)
    created = (
        await client.post(
            "/api/v1/recurring", headers=bearer(token),
            json={"name": "Rent", "category_id": cat, "amount": 500_000, "day_of_month": _safe_day(date.today())},
        )
    ).json()
    due_before = created["next_due_date"]

    paid = await client.post(
        f"/api/v1/recurring/{created['id']}/mark-paid", headers=bearer(token), json={}
    )
    assert paid.status_code == 201, paid.text
    expense = paid.json()
    assert expense["amount"] == 500_000
    assert expense["category_id"] == cat
    assert expense["description"] == "Rent"

    listed = (await client.get("/api/v1/recurring", headers=bearer(token))).json()
    rule = listed[0]
    assert rule["last_paid_date"] == expense["date"]
    assert rule["next_due_date"] != due_before


async def test_skip_advances_without_creating_expense(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)
    created = (
        await client.post(
            "/api/v1/recurring", headers=bearer(token),
            json={"name": "Gym", "category_id": cat, "amount": 20_000, "day_of_month": _safe_day(date.today())},
        )
    ).json()
    due_before = created["next_due_date"]

    skipped = await client.post(f"/api/v1/recurring/{created['id']}/skip", headers=bearer(token))
    assert skipped.status_code == 200
    assert skipped.json()["next_due_date"] != due_before
    assert skipped.json()["last_paid_date"] is None

    expenses = (await client.get("/api/v1/expenses", headers=bearer(token))).json()
    assert expenses["total"] == 0


async def test_deactivate_hides_from_default_list(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)
    created = (
        await client.post(
            "/api/v1/recurring", headers=bearer(token),
            json={"name": "Subscription", "category_id": cat, "amount": 5_000, "day_of_month": 1},
        )
    ).json()

    await client.patch(
        f"/api/v1/recurring/{created['id']}", headers=bearer(token), json={"active": False}
    )
    default_list = (await client.get("/api/v1/recurring", headers=bearer(token))).json()
    assert default_list == []

    with_inactive = (
        await client.get("/api/v1/recurring?include_inactive=true", headers=bearer(token))
    ).json()
    assert len(with_inactive) == 1
    assert with_inactive[0]["status"] == "inactive"


async def test_mark_paid_on_inactive_rule_rejected(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)
    created = (
        await client.post(
            "/api/v1/recurring", headers=bearer(token),
            json={"name": "Cable", "category_id": cat, "amount": 15_000, "day_of_month": 1},
        )
    ).json()
    await client.patch(
        f"/api/v1/recurring/{created['id']}", headers=bearer(token), json={"active": False}
    )
    result = await client.post(
        f"/api/v1/recurring/{created['id']}/mark-paid", headers=bearer(token), json={}
    )
    assert result.status_code == 422


async def test_recurring_scoped_to_household(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    cat = await _setup_category(client, token_a)
    created = (
        await client.post(
            "/api/v1/recurring", headers=bearer(token_a),
            json={"name": "Electricity", "category_id": cat, "amount": 30_000, "day_of_month": 5},
        )
    ).json()

    foreign_patch = await client.patch(
        f"/api/v1/recurring/{created['id']}", headers=bearer(token_b), json={"amount": 1}
    )
    assert foreign_patch.status_code == 404

    foreign_paid = await client.post(
        f"/api/v1/recurring/{created['id']}/mark-paid", headers=bearer(token_b), json={}
    )
    assert foreign_paid.status_code == 404

    foreign_delete = await client.delete(
        f"/api/v1/recurring/{created['id']}", headers=bearer(token_b)
    )
    assert foreign_delete.status_code == 404

    foreign_list = (await client.get("/api/v1/recurring", headers=bearer(token_b))).json()
    assert foreign_list == []


async def test_delete_recurring_rule(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)
    created = (
        await client.post(
            "/api/v1/recurring", headers=bearer(token),
            json={"name": "Newspaper", "category_id": cat, "amount": 1_000, "day_of_month": 1},
        )
    ).json()

    deleted = await client.delete(f"/api/v1/recurring/{created['id']}", headers=bearer(token))
    assert deleted.status_code == 204

    listed = (await client.get("/api/v1/recurring?include_inactive=true", headers=bearer(token))).json()
    assert listed == []


async def _setup_investment(client, token, current_value=None):
    res = await client.post(
        "/api/v1/investments", headers=bearer(token),
        json={
            "instrument_type": "dps",
            "name": "Monthly DPS",
            "amount": 500_000,
            "current_value": current_value,
        },
    )
    return res.json()


async def test_recurring_rule_linked_to_investment(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)
    investment = await _setup_investment(client, token)

    created = await client.post(
        "/api/v1/recurring", headers=bearer(token),
        json={
            "name": "DPS installment", "category_id": cat, "amount": 500_000,
            "day_of_month": 5, "investment_id": investment["id"],
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["investment_id"] == investment["id"]
    assert body["investment_name"] == "Monthly DPS"


async def test_mark_paid_accumulates_into_investment_current_value(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)
    investment = await _setup_investment(client, token, current_value=1_000_000)

    rule = (
        await client.post(
            "/api/v1/recurring", headers=bearer(token),
            json={
                "name": "DPS installment", "category_id": cat, "amount": 500_000,
                "day_of_month": 5, "investment_id": investment["id"],
            },
        )
    ).json()

    result = await client.post(
        f"/api/v1/recurring/{rule['id']}/mark-paid", headers=bearer(token), json={}
    )
    assert result.status_code == 201

    refreshed = (
        await client.get("/api/v1/investments", headers=bearer(token))
    ).json()
    updated = next(i for i in refreshed if i["id"] == investment["id"])
    assert updated["current_value"] == 1_500_000  # 10L + 5k installment

    # A second mark-paid keeps accumulating, not overwriting.
    await client.post(f"/api/v1/recurring/{rule['id']}/mark-paid", headers=bearer(token), json={})
    refreshed2 = (await client.get("/api/v1/investments", headers=bearer(token))).json()
    updated2 = next(i for i in refreshed2 if i["id"] == investment["id"])
    assert updated2["current_value"] == 2_000_000


async def test_mark_paid_initializes_current_value_when_unset(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)
    investment = await _setup_investment(client, token)  # current_value unset

    rule = (
        await client.post(
            "/api/v1/recurring", headers=bearer(token),
            json={
                "name": "DPS installment", "category_id": cat, "amount": 500_000,
                "day_of_month": 5, "investment_id": investment["id"],
            },
        )
    ).json()
    await client.post(f"/api/v1/recurring/{rule['id']}/mark-paid", headers=bearer(token), json={})

    refreshed = (await client.get("/api/v1/investments", headers=bearer(token))).json()
    updated = next(i for i in refreshed if i["id"] == investment["id"])
    assert updated["current_value"] == 500_000


async def test_recurring_rule_rejects_cross_household_investment(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    cat = await _setup_category(client, token_a)
    investment_b = await _setup_investment(client, token_b)

    result = await client.post(
        "/api/v1/recurring", headers=bearer(token_a),
        json={
            "name": "DPS installment", "category_id": cat, "amount": 500_000,
            "day_of_month": 5, "investment_id": investment_b["id"],
        },
    )
    assert result.status_code == 404


async def test_recurring_rule_can_unlink_investment(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)
    investment = await _setup_investment(client, token)
    rule = (
        await client.post(
            "/api/v1/recurring", headers=bearer(token),
            json={
                "name": "DPS installment", "category_id": cat, "amount": 500_000,
                "day_of_month": 5, "investment_id": investment["id"],
            },
        )
    ).json()

    patched = await client.patch(
        f"/api/v1/recurring/{rule['id']}", headers=bearer(token), json={"clear_investment": True}
    )
    assert patched.status_code == 200
    assert patched.json()["investment_id"] is None
