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

Phase 2+ tables (recurring_rule, goal, asset, liability) are intentionally
absent - adding a table later is trivial, carrying dead schema is not free.
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

    children: Mapped[list["Category"]] = relationship()


class PaymentMethod(Base):
    __tablename__ = "payment_method"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"))
    name: Mapped[str] = mapped_column(String(60))
    name_bn: Mapped[str | None] = mapped_column(String(60), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(16), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Budget(Base):
    __tablename__ = "budget"

    id: Mapped[uuid.UUID] = _uuid_pk()
    household_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("household.id"))
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    method: Mapped[str] = mapped_column(String(20), default="custom")

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
        UUID(as_uuid=True), nullable=True
    )  # column reserved; upload UI is Phase 2
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
