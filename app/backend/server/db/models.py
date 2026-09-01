"""Phase 1 schema (spec v1.1 §7.6).

Rules that are expensive to fix later:
- Every monetary column is a BigInteger count of poisha (1/100 taka). Never
  Numeric, never Float.
- expense.client_uuid is UNIQUE: the offline write queue's idempotency key.
- Every domain table carries household_id even though exactly one household
  exists today (spec §2.2 - this is what keeps productization from being a
  rewrite).
- logged_by_user_id (who entered it) and for_member_id (who it was for) are
  different questions; both columns are needed for Phase 2 reporting.

Landed so far: recurring_rule (§3.4.5, §3.8), goal/goal_contribution (§3.7),
investment (§3.7A), debt/debt_payment (§3.9), asset/net_worth_snapshot
(§3.10 - liabilities read from debt, not a separate table), receipt (§3.4
Files - Postgres bytea, storage only, no OCR), zakat_config (§5.3) and
household.eid_mode_enabled.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from server.db.base import Base


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class Household(Base):
    __tablename__ = "household"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(120))
    # Month the fiscal year starts in: 7 = July-June (BD govt), 1 = calendar.
    fiscal_year_start: Mapped[int] = mapped_column(Integer, default=7)
    base_currency: Mapped[str] = mapped_column(String(3), default="BDT")
    # Ramadan/Eid budget mode (spec §5.3) - a household-toggled seasonal
    # banner, not calendar-computed (no Hijri date source in the stack).
    eid_mode_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class User(Base):
    __tablename__ = "user"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    pin_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pin_failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    pin_locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    role: Mapped[str] = mapped_column(String(20), default="member")  # admin | member
    locale: Mapped[str] = mapped_column(String(5), default="en")  # en | bn


class Member(Base):
    """A tracked person. Not all members have a user account (spec §2.1)."""

    __tablename__ = "member"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"))
    name: Mapped[str] = mapped_column(String(120))
    name_bn: Mapped[str | None] = mapped_column(String(120), nullable=True)
    relation: Mapped[str | None] = mapped_column(String(50), nullable=True)
    dob: Mapped[date | None] = mapped_column(Date, nullable=True)
    monthly_allowance: Mapped[int] = mapped_column(BigInteger, default=0)  # poisha
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class IncomeSource(Base):
    __tablename__ = "income_source"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"))
    name: Mapped[str] = mapped_column(String(120))
    # salary | business | freelance | rental | remittance | investment | other
    type: Mapped[str] = mapped_column(String(30))
    currency: Mapped[str] = mapped_column(String(3), default="BDT")
    amount: Mapped[int] = mapped_column(BigInteger)  # poisha, in `currency`
    amount_bdt: Mapped[int] = mapped_column(BigInteger)  # poisha, at user-entered rate
    # monthly | weekly | biweekly | irregular
    frequency: Mapped[str] = mapped_column(String(20), default="monthly")
    taxable: Mapped[bool] = mapped_column(Boolean, default=True)
    # Whether the payer withholds TDS before paying out (salary usually yes,
    # freelance/rental usually no). Sources without withholding feed the
    # "remaining tax payable / monthly set-aside" figure.
    tds_at_source: Mapped[bool] = mapped_column(Boolean, default=False)
    # Actual withheld amount per month (poisha) from the payslip, if known.
    # None + tds_at_source=True -> estimated as the source's proportional
    # share of the computed liability.
    tds_amount_monthly: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class TaxConfig(Base):
    """Versioned BD tax rules. Nothing tax-related is hardcoded (spec §3.2.2).

    A future fiscal year is a row insert, not a deploy. `verified` gates the
    UNVERIFIED banner in the UI.
    """

    __tablename__ = "tax_config"

    id: Mapped[uuid.UUID] = _uuid_pk()
    fiscal_year: Mapped[str] = mapped_column(String(9), unique=True)  # e.g. "2025-26"
    slabs: Mapped[dict] = mapped_column(JSONB)
    thresholds: Mapped[dict] = mapped_column(JSONB, default=dict)
    rebate_rules: Mapped[dict] = mapped_column(JSONB, default=dict)
    effective_from: Mapped[date] = mapped_column(Date)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)


class ZakatConfig(Base):
    """Versioned nisab threshold + rate for the zakat calculator (spec §5.3).
    Global, not household-scoped - same reasoning as tax_config: nisab
    tracks the market gold/silver price, which this app has no live feed
    for, so a household updates it periodically rather than the app
    computing it. `verified` gates an UNVERIFIED banner, same as tax."""

    __tablename__ = "zakat_config"

    id: Mapped[uuid.UUID] = _uuid_pk()
    nisab_threshold: Mapped[int] = mapped_column(BigInteger)  # poisha
    rate_bps: Mapped[int] = mapped_column(Integer, default=250)  # 2.5%
    effective_from: Mapped[date] = mapped_column(Date)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Deduction(Base):
    __tablename__ = "deduction"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"))
    # professional_tax | provident_fund | emi | association_fee | insurance
    type: Mapped[str] = mapped_column(String(30))
    amount: Mapped[int] = mapped_column(BigInteger)  # poisha
    frequency: Mapped[str] = mapped_column(String(20), default="monthly")
    income_source_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("income_source.id"), nullable=True
    )


class Category(Base):
    """Two-level tree: parent_id NULL = category, set = subcategory."""

    __tablename__ = "category"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"))
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("category.id"), nullable=True
    )
    name_en: Mapped[str] = mapped_column(String(120))
    name_bn: Mapped[str] = mapped_column(String(120))
    icon: Mapped[str | None] = mapped_column(String(16), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    # need | want | save - unused until Phase 2's 50/30/20 rule
    need_want_save: Mapped[str | None] = mapped_column(String(10), nullable=True)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)


class PaymentMethod(Base):
    __tablename__ = "payment_method"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"))
    name: Mapped[str] = mapped_column(String(60))
    name_bn: Mapped[str | None] = mapped_column(String(60), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(16), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class RecurringRule(Base):
    """Auto-entry template for rent/internet/electricity-style recurring
    expenses and bills (spec §3.4.5, §3.8). Occurrences are computed
    lazily from next_due_date when the household looks at the list -
    no background job queue (see services/recurring.py)."""

    __tablename__ = "recurring_rule"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("category.id"))
    amount: Mapped[int] = mapped_column(BigInteger)  # poisha
    payment_method_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("payment_method.id"), nullable=True
    )
    for_member_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("member.id"), nullable=True
    )
    day_of_month: Mapped[int] = mapped_column(Integer)  # 1-28, safe across all months
    next_due_date: Mapped[date] = mapped_column(Date)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Goal(Base):
    """Savings goal (spec §3.7.1). Progress/forecast are computed from
    goal_contribution history, not stored - see services/savings.py."""

    __tablename__ = "goal"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    name_bn: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # emergency_fund | child_education | hajj_umrah | home | vehicle | wedding | custom
    goal_type: Mapped[str] = mapped_column(String(30))
    target_amount: Mapped[int] = mapped_column(BigInteger)  # poisha
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Funding priority - lower sorts first. Household-assigned, not computed.
    priority: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    contributions: Mapped[list["GoalContribution"]] = relationship(back_populates="goal")


class GoalContribution(Base):
    __tablename__ = "goal_contribution"

    id: Mapped[uuid.UUID] = _uuid_pk()
    goal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("goal.id"), index=True)
    date: Mapped[date] = mapped_column(Date)
    amount: Mapped[int] = mapped_column(BigInteger)  # poisha
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    goal: Mapped[Goal] = relationship(back_populates="contributions")


class Investment(Base):
    """One flexible table across the in-scope instrument types (spec
    §3.7A.1: DPS, FDR, Sanchayapatra, pension, provident fund, business,
    mutual funds/gold) rather than seven near-identical tables - fields
    that don't apply to a type are simply left null. DSE stocks are
    Phase 4 (needs price data the app has no source for)."""

    __tablename__ = "investment"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"), index=True)
    # dps | fdr | sanchayapatra | pension | provident_fund | business | mutual_fund_gold
    instrument_type: Mapped[str] = mapped_column(String(30))
    name: Mapped[str] = mapped_column(String(120))  # bank / scheme / business name
    amount: Mapped[int] = mapped_column(BigInteger)  # poisha - principal / installment base
    rate_bps: Mapped[int | None] = mapped_column(Integer, nullable=True)  # annual rate, basis points
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    maturity_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    tenure_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    auto_renewal: Mapped[bool] = mapped_column(Boolean, default=False)
    current_value: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # manual valuation
    # Feeds the §3.2.2 tax engine's eligible_investment automatically - one
    # entry, both the holding and the rebate computed (services/income.py).
    rebate_eligible: Mapped[bool] = mapped_column(Boolean, default=False)
    # Reserved for the zakat calculator (§5.3) - not built yet, same pattern
    # as member rows existing before the Phase 2 family UI landed.
    zakatable: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Debt(Base):
    """Loan or credit-card balance (spec §3.9). current_balance is the
    ledger the household reduces via debt_payment rows; principal/rate/
    term stay fixed so the EMI calculator and amortization schedule always
    describe the original loan terms."""

    __tablename__ = "debt"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    lender: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # bank_loan | personal_loan | family_loan | credit_card
    debt_type: Mapped[str] = mapped_column(String(20))
    principal: Mapped[int] = mapped_column(BigInteger)  # poisha - original amount
    current_balance: Mapped[int] = mapped_column(BigInteger)  # poisha - outstanding now
    interest_rate_bps: Mapped[int | None] = mapped_column(Integer, nullable=True)  # annual
    term_months: Mapped[int | None] = mapped_column(Integer, nullable=True)  # original term
    minimum_payment: Mapped[int | None] = mapped_column(BigInteger, nullable=True)  # poisha/mo
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    payments: Mapped[list["DebtPayment"]] = relationship(back_populates="debt")


class DebtPayment(Base):
    __tablename__ = "debt_payment"

    id: Mapped[uuid.UUID] = _uuid_pk()
    debt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("debt.id"), index=True)
    date: Mapped[date] = mapped_column(Date)
    amount: Mapped[int] = mapped_column(BigInteger)  # poisha
    # Split at payment time from the balance then outstanding, so a later
    # rate change never rewrites past payments (same principle as §3.7A.2's
    # investment rate history).
    interest_portion: Mapped[int] = mapped_column(BigInteger)  # poisha
    principal_portion: Mapped[int] = mapped_column(BigInteger)  # poisha
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    debt: Mapped[Debt] = relationship(back_populates="payments")


class Asset(Base):
    """Manually valued asset (spec §3.10). Point-in-time: value/valued_on/
    logged_by_user_id are overwritten on revaluation, not versioned - "who
    said what and when" is the current state, not a full audit ledger.
    Investments already live in their own table and are pulled in
    separately (services/networth.py) rather than duplicated here."""

    __tablename__ = "asset"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"), index=True)
    # cash_bank | property | vehicle | gold_jewelry | other
    category: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(120))
    value: Mapped[int] = mapped_column(BigInteger)  # poisha
    valued_on: Mapped[date] = mapped_column(Date)
    logged_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class NetWorthSnapshot(Base):
    """One row per household per month (spec §3.10's "monthly snapshots"),
    upserted lazily whenever the household views net worth - no cron."""

    __tablename__ = "net_worth_snapshot"
    __table_args__ = (UniqueConstraint("household_id", "snapshot_date"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"), index=True)
    snapshot_date: Mapped[date] = mapped_column(Date)  # first of month
    total_assets: Mapped[int] = mapped_column(BigInteger)  # poisha
    total_liabilities: Mapped[int] = mapped_column(BigInteger)  # poisha
    net_worth: Mapped[int] = mapped_column(BigInteger)  # poisha
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Budget(Base):
    __tablename__ = "budget"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"))
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    # custom | template | 50_30_20 | zero_based (§3.3.3)
    method: Mapped[str] = mapped_column(String(20), default="custom")
    # poisha - the pool zero-based budgeting assigns from ("every taka
    # assigned"); null for every other method.
    assignable_amount: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    lines: Mapped[list["BudgetLine"]] = relationship(back_populates="budget")


class BudgetLine(Base):
    __tablename__ = "budget_line"
    __table_args__ = (UniqueConstraint("budget_id", "category_id"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    budget_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("budget.id"))
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("category.id"))
    amount: Mapped[int] = mapped_column(BigInteger)  # poisha
    rollover_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    rolled_over_amount: Mapped[int] = mapped_column(BigInteger, default=0)  # poisha

    budget: Mapped[Budget] = relationship(back_populates="lines")


class Receipt(Base):
    """Uploaded receipt photo (spec §3.4, "Files" storage note): bytea in
    Postgres, not S3/Supabase Storage - no bucket to provision for a Phase 1
    dev setup. Storage only, no OCR (explicitly out of scope)."""

    __tablename__ = "receipt"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"), index=True)
    mime_type: Mapped[str] = mapped_column(String(60))
    data: Mapped[bytes] = mapped_column(LargeBinary)
    size_bytes: Mapped[int] = mapped_column(Integer)
    uploaded_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Expense(Base):
    __tablename__ = "expense"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("category.id"))
    amount: Mapped[int] = mapped_column(BigInteger)  # poisha, in `currency`
    currency: Mapped[str] = mapped_column(String(3), default="BDT")
    amount_bdt: Mapped[int] = mapped_column(BigInteger)  # poisha
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_method_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("payment_method.id"), nullable=True
    )
    logged_by_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"))
    for_member_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("member.id"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    receipt_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("receipt.id"), nullable=True
    )
    # Set when this entry was generated from a recurring rule's "mark paid"
    # (spec §3.4.5) - powers that rule's payment history. Null for entries
    # logged normally.
    recurring_rule_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("recurring_rule.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # Offline write queue idempotency key - generated client-side per write.
    client_uuid: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), unique=True, default=uuid.uuid4
    )


class Tag(Base):
    __tablename__ = "tag"
    __table_args__ = (UniqueConstraint("household_id", "name"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"))
    name: Mapped[str] = mapped_column(String(60))


class ExpenseTag(Base):
    __tablename__ = "expense_tag"

    expense_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("expense.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True
    )


class RefreshToken(Base):
    """Server-side record of issued refresh tokens, enabling revocation."""

    __tablename__ = "refresh_token"

    id: Mapped[uuid.UUID] = _uuid_pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)  # sha256 hex
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
