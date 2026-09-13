from datetime import date

from sqlalchemy import select

from server.db.models import (
    Asset,
    Budget,
    BudgetLine,
    Category,
    Debt,
    DebtPayment,
    Deduction,
    Expense,
    ExpenseTag,
    Goal,
    GoalContribution,
    Household,
    IncomeSource,
    Investment,
    InvestmentTransaction,
    LoanGiven,
    LoanGivenPayment,
    Member,
    NetWorthSnapshot,
    OneTimeIncome,
    PaymentMethod,
    Receipt,
    RecurringRule,
    Tag,
    User,
)
from tests.conftest import bearer, login


async def _build_full_household_graph(session_factory, household_id, user_id):
    """One row in (almost) every household-scoped table, deep enough to
    exercise the whole FK graph delete_account has to walk in order."""
    async with session_factory() as db:
        hid = household_id

        parent_cat = Category(household_id=hid, name_en="Food", name_bn="খাবার")
        db.add(parent_cat)
        await db.flush()
        sub_cat = Category(household_id=hid, parent_id=parent_cat.id, name_en="Groceries", name_bn="বাজার")
        pm = PaymentMethod(household_id=hid, name="Cash")
        member = Member(household_id=hid, name="Kid")
        db.add_all([sub_cat, pm, member])
        await db.flush()

        expense = Expense(
            household_id=hid, date=date(2026, 1, 1), category_id=sub_cat.id, amount=1000,
            amount_bdt=1000, logged_by_user_id=user_id, payment_method_id=pm.id, for_member_id=member.id,
        )
        db.add(expense)
        await db.flush()
        tag = Tag(household_id=hid, name="urgent")
        db.add(tag)
        await db.flush()
        db.add(ExpenseTag(expense_id=expense.id, tag_id=tag.id))

        db.add(
            RecurringRule(
                household_id=hid, name="Internet", category_id=sub_cat.id, amount=50_000,
                day_of_month=5, next_due_date=date(2026, 2, 5),
            )
        )
        db.add(
            Receipt(
                household_id=hid, mime_type="image/png", data=b"x", size_bytes=1,
                uploaded_by_user_id=user_id,
            )
        )

        budget = Budget(household_id=hid, period_start=date(2026, 1, 1), period_end=date(2026, 1, 31))
        db.add(budget)
        await db.flush()
        db.add(BudgetLine(budget_id=budget.id, category_id=parent_cat.id, amount=100_000))

        goal = Goal(household_id=hid, name="Emergency fund", goal_type="emergency_fund", target_amount=500_000)
        db.add(goal)
        await db.flush()
        db.add(GoalContribution(goal_id=goal.id, date=date(2026, 1, 1), amount=10_000))

        investment = Investment(household_id=hid, instrument_type="dps", name="Bank DPS", amount=100_000)
        db.add(investment)
        await db.flush()
        db.add(
            InvestmentTransaction(investment_id=investment.id, type="capital_in", amount=100_000, date=date(2026, 1, 1))
        )

        debt = Debt(household_id=hid, name="Car loan", debt_type="bank_loan", principal=1_000_000, current_balance=900_000)
        db.add(debt)
        await db.flush()
        db.add(
            DebtPayment(
                debt_id=debt.id, date=date(2026, 1, 1), amount=10_000,
                interest_portion=2_000, principal_portion=8_000,
            )
        )

        loan = LoanGiven(household_id=hid, borrower_name="Friend", principal=50_000, current_balance=50_000)
        db.add(loan)
        await db.flush()
        db.add(
            LoanGivenPayment(
                loan_id=loan.id, date=date(2026, 1, 1), amount=5_000,
                interest_portion=0, principal_portion=5_000,
            )
        )

        db.add(
            Asset(
                household_id=hid, category="cash_bank", name="Savings a/c", value=200_000,
                valued_on=date(2026, 1, 1), logged_by_user_id=user_id,
            )
        )
        db.add(
            NetWorthSnapshot(
                household_id=hid, snapshot_date=date(2026, 1, 1),
                total_assets=200_000, total_liabilities=900_000, net_worth=-700_000,
            )
        )

        income = IncomeSource(household_id=hid, name="Salary", type="salary", amount=1_000_000, amount_bdt=1_000_000)
        db.add(income)
        await db.flush()
        db.add(Deduction(household_id=hid, type="provident_fund", amount=50_000))

        db.add(OneTimeIncome(household_id=hid, label="Bonus", amount=50_000, date=date(2026, 1, 1)))

        await db.commit()


async def test_delete_account_wrong_password_rejected(client):
    token = await login(client, "a@example.com", "pass-a")
    res = await client.request(
        "DELETE", "/api/v1/auth/account", headers=bearer(token), json={"password": "nope"}
    )
    assert res.status_code == 401

    # Untouched - login still works.
    assert await login(client, "a@example.com", "pass-a")


async def test_delete_account_removes_everything_and_frees_the_email(client, session_factory):
    token = await login(client, "a@example.com", "pass-a")

    async with session_factory() as db:
        household = (await db.execute(select(Household).where(Household.name == "A"))).scalar_one()
        user = (await db.execute(select(User).where(User.email == "a@example.com"))).scalar_one()
        household_id, user_id = household.id, user.id

    await _build_full_household_graph(session_factory, household_id, user_id)

    res = await client.request(
        "DELETE", "/api/v1/auth/account", headers=bearer(token), json={"password": "pass-a"}
    )
    assert res.status_code == 204, res.text

    # The whole household graph is gone - no FK stragglers anywhere.
    async with session_factory() as db:
        assert await db.get(Household, household_id) is None
        assert await db.get(User, user_id) is None
        for Model in (
            Category, PaymentMethod, Member, Expense, Tag, RecurringRule, Receipt,
            Budget, BudgetLine, Goal, GoalContribution, Investment, InvestmentTransaction,
            Debt, DebtPayment, LoanGiven, LoanGivenPayment, Asset, NetWorthSnapshot,
            IncomeSource, Deduction, OneTimeIncome,
        ):
            remaining = (
                await db.execute(select(Model).where(Model.household_id == household_id))
                if hasattr(Model, "household_id")
                else None
            )
            if remaining is not None:
                assert remaining.first() is None, f"{Model.__name__} row survived account deletion"

    # The email is free again - a fresh signup with it succeeds.
    signed_up = await client.post(
        "/api/v1/auth/signup",
        json={"email": "a@example.com", "password": "brand-new-pass", "household_name": "New A"},
    )
    assert signed_up.status_code == 201, signed_up.text

    # Household B (untouched by A's deletion) still logs in fine.
    assert await login(client, "b@example.com", "pass-b")
