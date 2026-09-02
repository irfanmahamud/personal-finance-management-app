from datetime import date, timedelta

from server.services.loans import _status
from tests.conftest import bearer, login


# --- Pure status logic ---

def test_status_thresholds():
    today = date(2026, 8, 15)
    active_no_due = {"active": True, "current_balance": 100, "due_date": None}
    assert _status(_loan(**active_no_due), today) == "no_due_date"
    assert _status(_loan(active=True, current_balance=0, due_date=None), today) == "paid_off"
    assert _status(_loan(active=False, current_balance=100, due_date=None), today) == "inactive"
    assert _status(_loan(active=True, current_balance=100, due_date=date(2026, 8, 14)), today) == "overdue"
    assert _status(_loan(active=True, current_balance=100, due_date=date(2026, 8, 20)), today) == "due_soon"
    assert _status(_loan(active=True, current_balance=100, due_date=date(2026, 9, 1)), today) == "upcoming"


def _loan(active, current_balance, due_date):
    from server.db.models import LoanGiven
    return LoanGiven(active=active, current_balance=current_balance, due_date=due_date)


# --- API flow ---

async def test_create_loan_defaults_balance_to_principal(client):
    token = await login(client, "a@example.com", "pass-a")
    created = await client.post(
        "/api/v1/loans", headers=bearer(token),
        json={"borrower_name": "Rahim", "principal": 50_000_00},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["current_balance"] == 50_000_00
    assert body["paid_off"] is False
    assert body["interest_rate_bps"] is None
    assert body["status"] == "no_due_date"


async def test_interest_free_payment_reduces_principal_directly(client):
    token = await login(client, "a@example.com", "pass-a")
    created = (
        await client.post(
            "/api/v1/loans", headers=bearer(token),
            json={"borrower_name": "Karim", "principal": 20_000_00},
        )
    ).json()

    paid = await client.post(
        f"/api/v1/loans/{created['id']}/payments", headers=bearer(token),
        json={"amount": 5_000_00},
    )
    assert paid.status_code == 201, paid.text
    body = paid.json()
    assert body["total_interest_earned"] == 0
    assert body["total_principal_repaid"] == 5_000_00
    assert body["current_balance"] == 15_000_00


async def test_interest_bearing_payment_splits_interest_and_principal(client):
    token = await login(client, "a@example.com", "pass-a")
    created = (
        await client.post(
            "/api/v1/loans", headers=bearer(token),
            json={"borrower_name": "Salim", "principal": 100_000_00, "interest_rate_bps": 1200},
        )
    ).json()

    paid = await client.post(
        f"/api/v1/loans/{created['id']}/payments", headers=bearer(token),
        json={"amount": 10_000_00},
    )
    body = paid.json()
    assert body["total_repaid"] == 10_000_00
    assert body["total_interest_earned"] + body["total_principal_repaid"] == 10_000_00
    assert body["total_interest_earned"] > 0  # 12% annual accrues real interest
    assert body["current_balance"] == 100_000_00 - body["total_principal_repaid"]

    history = (
        await client.get(f"/api/v1/loans/{created['id']}/payments", headers=bearer(token))
    ).json()
    assert len(history) == 1
    assert history[0]["amount"] == 10_000_00


async def test_payment_never_pushes_balance_negative(client):
    token = await login(client, "a@example.com", "pass-a")
    created = (
        await client.post(
            "/api/v1/loans", headers=bearer(token),
            json={"borrower_name": "Jamal", "principal": 1_000_00},
        )
    ).json()

    paid = await client.post(
        f"/api/v1/loans/{created['id']}/payments", headers=bearer(token),
        json={"amount": 5_000_00},  # overpay
    )
    body = paid.json()
    assert body["current_balance"] == 0
    assert body["paid_off"] is True
    assert body["status"] == "paid_off"


async def test_overdue_status_from_past_due_date(client):
    token = await login(client, "a@example.com", "pass-a")
    past = (date.today() - timedelta(days=5)).isoformat()
    created = await client.post(
        "/api/v1/loans", headers=bearer(token),
        json={"borrower_name": "Nasir", "principal": 10_000_00, "due_date": past},
    )
    assert created.json()["status"] == "overdue"


async def test_loan_scoped_to_household(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    created = (
        await client.post(
            "/api/v1/loans", headers=bearer(token_a),
            json={"borrower_name": "Farid", "principal": 25_000_00},
        )
    ).json()

    foreign_patch = await client.patch(
        f"/api/v1/loans/{created['id']}", headers=bearer(token_b), json={"principal": 1}
    )
    assert foreign_patch.status_code == 404

    foreign_payment = await client.post(
        f"/api/v1/loans/{created['id']}/payments", headers=bearer(token_b), json={"amount": 1}
    )
    assert foreign_payment.status_code == 404

    foreign_list = (await client.get("/api/v1/loans", headers=bearer(token_b))).json()
    assert foreign_list == []


async def test_loan_summary_aggregates(client):
    token = await login(client, "a@example.com", "pass-a")
    past = (date.today() - timedelta(days=1)).isoformat()
    loan1 = (
        await client.post(
            "/api/v1/loans", headers=bearer(token),
            json={"borrower_name": "A", "principal": 30_000_00, "due_date": past},
        )
    ).json()
    await client.post(
        "/api/v1/loans", headers=bearer(token),
        json={"borrower_name": "B", "principal": 20_000_00},
    )
    await client.post(
        f"/api/v1/loans/{loan1['id']}/payments", headers=bearer(token), json={"amount": 10_000_00}
    )

    result = await client.get("/api/v1/loans/summary", headers=bearer(token))
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["total_lent"] == 50_000_00
    assert body["total_outstanding"] == 40_000_00
    assert body["total_repaid"] == 10_000_00
    assert body["active_count"] == 2
    assert body["overdue_count"] == 1


async def test_deactivate_hides_from_default_list(client):
    token = await login(client, "a@example.com", "pass-a")
    created = (
        await client.post(
            "/api/v1/loans", headers=bearer(token),
            json={"borrower_name": "Habib", "principal": 5_000_00},
        )
    ).json()
    await client.patch(f"/api/v1/loans/{created['id']}", headers=bearer(token), json={"active": False})

    default_list = (await client.get("/api/v1/loans", headers=bearer(token))).json()
    assert default_list == []

    with_inactive = (await client.get("/api/v1/loans?include_inactive=true", headers=bearer(token))).json()
    assert len(with_inactive) == 1
    assert with_inactive[0]["status"] == "inactive"


async def test_delete_loan(client):
    token = await login(client, "a@example.com", "pass-a")
    created = (
        await client.post(
            "/api/v1/loans", headers=bearer(token),
            json={"borrower_name": "Wasim", "principal": 3_000_00},
        )
    ).json()

    deleted = await client.delete(f"/api/v1/loans/{created['id']}", headers=bearer(token))
    assert deleted.status_code == 204

    listed = (await client.get("/api/v1/loans?include_inactive=true", headers=bearer(token))).json()
    assert listed == []


async def _setup_category(client, token):
    res = await client.post(
        "/api/v1/categories", headers=bearer(token),
        json={"name_en": "Lending", "name_bn": "ঋণ প্রদান"},
    )
    return res.json()["id"]


async def test_log_as_expense_creates_linked_expense(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)

    created = await client.post(
        "/api/v1/loans", headers=bearer(token),
        json={
            "borrower_name": "Nadia", "principal": 15_000_00,
            "log_as_expense": True, "category_id": cat,
        },
    )
    assert created.status_code == 201, created.text

    expenses = (await client.get("/api/v1/expenses", headers=bearer(token))).json()
    assert expenses["total"] == 1
    expense = expenses["items"][0]
    assert expense["amount"] == 15_000_00
    assert expense["category_id"] == cat
    assert "Nadia" in expense["description"]


async def test_log_as_expense_uses_start_date(client):
    token = await login(client, "a@example.com", "pass-a")
    cat = await _setup_category(client, token)
    past = (date.today() - timedelta(days=10)).isoformat()

    await client.post(
        "/api/v1/loans", headers=bearer(token),
        json={
            "borrower_name": "Omar", "principal": 5_000_00, "start_date": past,
            "log_as_expense": True, "category_id": cat,
        },
    )
    expenses = (await client.get("/api/v1/expenses", headers=bearer(token))).json()
    assert expenses["items"][0]["date"] == past


async def test_default_does_not_create_expense(client):
    token = await login(client, "a@example.com", "pass-a")
    await client.post(
        "/api/v1/loans", headers=bearer(token),
        json={"borrower_name": "Previous Loan", "principal": 8_000_00},
    )
    expenses = (await client.get("/api/v1/expenses", headers=bearer(token))).json()
    assert expenses["total"] == 0


async def test_log_as_expense_requires_category(client):
    token = await login(client, "a@example.com", "pass-a")
    result = await client.post(
        "/api/v1/loans", headers=bearer(token),
        json={"borrower_name": "Yusuf", "principal": 2_000_00, "log_as_expense": True},
    )
    assert result.status_code == 422
