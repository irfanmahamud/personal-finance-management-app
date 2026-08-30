import uuid
from datetime import date

from pydantic import BaseModel


class CategorySpend(BaseModel):
    category_id: uuid.UUID
    name_en: str
    name_bn: str
    icon: str | None = None
    spent: int
    entries: int


class DailyPoint(BaseModel):
    date: date
    spent: int


class MonthlySummaryOut(BaseModel):
    period_start: date
    period_end: date
    fiscal_year: str
    income: int          # projected monthly income from active sources (poisha)
    total_spent: int
    surplus: int         # income - spent (negative = deficit)
    entries: int
    by_category: list[CategorySpend]
    daily: list[DailyPoint]


class VarianceLine(BaseModel):
    category_id: uuid.UUID
    name_en: str
    name_bn: str
    icon: str | None
    budgeted: int        # amount + rollover
    spent: int
    variance: int        # budgeted - spent (negative = over budget)


class BudgetVarianceOut(BaseModel):
    period_start: date
    period_end: date
    lines: list[VarianceLine]
    total_budgeted: int
    total_spent: int


class CategoryReportOut(BaseModel):
    date_from: date
    date_to: date
    total_spent: int
    by_category: list[CategorySpend]
    subcategories: list[CategorySpend] | None = None  # when category_id given
