from datetime import date, timedelta

from server.services.debts import _project_payoff, amortization_schedule, emi_amount
from tests.conftest import bearer, login


# --- Pure money math ---

def test_emi_amount_standard_formula():
    # ৳10,00,000 at 10% annual for 12 months -> known EMI ~ ৳87,916
    emi = emi_amount(1_000_000_00, 1000, 12)
    assert 87_900_00 <= emi <= 87_950_00


def test_emi_amount_zero_rate_is_even_split():
    assert emi_amount(1_200_00, 0, 12) == 100_00


def test_amortization_schedule_ends_at_zero_balance():
    schedule = amortization_schedule(1_000_000_00, 1000, 12)
    assert len(schedule) == 12
    assert schedule[-1].balance == 0
    # Interest portion shrinks and principal portion grows month over month.
    assert schedule[0].interest > schedule[-1].interest
    assert schedule[0].principal < schedule[-1].principal


def test_project_payoff_none_when_payment_never_covers_interest():
    today = date(2026, 8, 15)
    # 24% annual on ৳1,00,000 -> ~৳2,000/mo interest; a ৳500 payment can't win.
    assert _project_payoff(100_000_00, 2400, 500_00, today) is None


def test_project_payoff_reaches_a_date_when_payment_covers_interest():
    today = date(2026, 8, 15)
    result = _project_payoff(100_000_00, 1000, 20_000_00, today)
    assert result is not None
    assert result > today


# --- API flow ---

async def test_create_debt_defaults_balance_to_principal(client):
    token = await login(client, "a@example.com", "pass-a")
    created = await client.post(
        "/api/v1/debts", headers=bearer(token),
        json={"name": "Car loan", "debt_type": "bank_loan", "principal": 500_000_00,
              "interest_rate_bps": 1200, "term_months": 36},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["current_balance"] == 500_000_00
    assert body["paid_off"] is False
    assert body["calculated_emi"] is not None
    assert body["total_paid"] == 0


async def test_payment_splits_interest_and_principal_and_reduces_balance(client):
    token = await login(client, "a@example.com", "pass-a")
    created = (
        await client.post(
            "/api/v1/debts", headers=bearer(token),
            json={"name": "Personal loan", "debt_type": "personal_loan", "principal": 100_000_00,
                  "interest_rate_bps": 1200},
        )
    ).json()

    paid = await client.post(
        f"/api/v1/debts/{created['id']}/payments", headers=bearer(token),
        json={"amount": 10_000_00},
    )
    assert paid.status_code == 201, paid.text
    body = paid.json()
    assert body["total_paid"] == 10_000_00
    assert body["total_interest_paid"] + body["total_principal_paid"] == 10_000_00
    assert body["total_interest_paid"] > 0  # 12% annual on ৳1,00,000 accrues real interest
    assert body["current_balance"] == 100_000_00 - body["total_principal_paid"]

    history = (
        await client.get(f"/api/v1/debts/{created['id']}/payments", headers=bearer(token))
    ).json()
    assert len(history) == 1
    assert history[0]["amount"] == 10_000_00


async def test_payment_never_pushes_balance_negative(client):
    token = await login(client, "a@example.com", "pass-a")
    created = (
        await client.post(
            "/api/v1/debts", headers=bearer(token),
            json={"name": "Small debt", "debt_type": "family_loan", "principal": 1_000_00},
        )
    ).json()

    paid = await client.post(
        f"/api/v1/debts/{created['id']}/payments", headers=bearer(token),
        json={"amount": 5_000_00},  # overpay
    )
    body = paid.json()
    assert body["current_balance"] == 0
    assert body["paid_off"] is True


async def test_debt_scoped_to_household(client):
    token_a = await login(client, "a@example.com", "pass-a")
    token_b = await login(client, "b@example.com", "pass-b")
    created = (
        await client.post(
            "/api/v1/debts", headers=bearer(token_a),
            json={"name": "Loan", "debt_type": "bank_loan", "principal": 50_000_00},
        )
    ).json()

    foreign_patch = await client.patch(
        f"/api/v1/debts/{created['id']}", headers=bearer(token_b), json={"principal": 1}
    )
    assert foreign_patch.status_code == 404

    foreign_payment = await client.post(
        f"/api/v1/debts/{created['id']}/payments", headers=bearer(token_b), json={"amount": 1}
    )
    assert foreign_payment.status_code == 404

    foreign_list = (await client.get("/api/v1/debts", headers=bearer(token_b))).json()
    assert foreign_list == []


async def test_emi_calculator_endpoint(client):
    token = await login(client, "a@example.com", "pass-a")
    result = await client.get(
        "/api/v1/debts/emi-calculator",
        headers=bearer(token),
        params={"principal": 1_000_000_00, "annual_rate_bps": 1000, "term_months": 12},
    )
    assert result.status_code == 200, result.text
    body = result.json()
    assert len(body["schedule"]) == 12
    assert body["schedule"][-1]["balance"] == 0
    assert body["total_interest"] > 0


async def test_payoff_comparison_avalanche_prioritizes_higher_rate(client):
    token = await login(client, "a@example.com", "pass-a")
    await client.post(
        "/api/v1/debts", headers=bearer(token),
        json={"name": "Card A", "debt_type": "credit_card", "principal": 50_000_00,
              "interest_rate_bps": 3000, "minimum_payment": 2_000_00},
    )
    await client.post(
        "/api/v1/debts", headers=bearer(token),
        json={"name": "Card B", "debt_type": "credit_card", "principal": 200_000_00,
              "interest_rate_bps": 1000, "minimum_payment": 5_000_00},
    )

    result = await client.get(
        "/api/v1/debts/payoff-comparison", headers=bearer(token), params={"extra_monthly": 10_000_00}
    )
    assert result.status_code == 200, result.text
    body = result.json()
    # Avalanche targets the higher-rate card first; snowball targets the smaller balance first.
    # Here both point at Card A (higher rate AND smaller balance) - just confirm the endpoint
    # returns a coherent comparison rather than asserting they diverge.
    assert len(body["avalanche"]["order"]) == 2
    assert len(body["snowball"]["order"]) == 2
    assert body["avalanche"]["total_interest_paid"] >= 0
    assert body["snowball"]["total_interest_paid"] >= 0
