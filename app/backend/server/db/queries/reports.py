"""Reporting aggregates - hand-written SQL via text() (plan §M5).

These are GROUP BY rollups over date ranges; SQL reads far more clearly
than ORM composition here, and the arithmetic stays in the database where
it is exact (all amounts integer poisha).
"""

import uuid
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

CATEGORY_BREAKDOWN = text("""
    SELECT
        parent.id          AS category_id,
        parent.name_en,
        parent.name_bn,
        parent.icon,
        SUM(e.amount_bdt)  AS spent,
        COUNT(e.id)        AS entries
    FROM expense e
    JOIN category c       ON c.id = e.category_id
    JOIN category parent  ON parent.id = COALESCE(c.parent_id, c.id)
    WHERE e.household_id = :household_id
      AND e.date >= :date_from AND e.date <= :date_to
    GROUP BY parent.id, parent.name_en, parent.name_bn, parent.icon, parent.sort_order
    ORDER BY spent DESC
""")

SUBCATEGORY_BREAKDOWN = text("""
    SELECT
        c.id               AS category_id,
        c.name_en,
        c.name_bn,
        SUM(e.amount_bdt)  AS spent,
        COUNT(e.id)        AS entries
    FROM expense e
    JOIN category c ON c.id = e.category_id
    WHERE e.household_id = :household_id
      AND e.date >= :date_from AND e.date <= :date_to
      AND COALESCE(c.parent_id, c.id) = :parent_id
    GROUP BY c.id, c.name_en, c.name_bn
    ORDER BY spent DESC
""")

TOTALS = text("""
    SELECT
        COALESCE(SUM(e.amount_bdt), 0) AS total_spent,
        COUNT(e.id)                    AS entries
    FROM expense e
    WHERE e.household_id = :household_id
      AND e.date >= :date_from AND e.date <= :date_to
""")

DAILY_SERIES = text("""
    SELECT e.date, SUM(e.amount_bdt) AS spent
    FROM expense e
    WHERE e.household_id = :household_id
      AND e.date >= :date_from AND e.date <= :date_to
    GROUP BY e.date
    ORDER BY e.date
""")

MONTHLY_INCOME = text("""
    SELECT COALESCE(SUM(
        CASE frequency
            WHEN 'monthly'  THEN amount_bdt
            WHEN 'weekly'   THEN amount_bdt * 52 / 12
            WHEN 'biweekly' THEN amount_bdt * 26 / 12
            ELSE 0  -- irregular income doesn't annualize
        END
    ), 0) AS monthly_income
    FROM income_source
    WHERE household_id = :household_id AND active AND currency IS NOT NULL
""")

EXPORT_ROWS = text("""
    SELECT
        e.date,
        parent.name_en  AS category,
        c.name_en       AS subcategory,
        e.amount_bdt,
        e.currency,
        e.amount,
        e.description,
        pm.name         AS payment_method,
        m.name          AS for_member,
        u.email         AS logged_by,
        e.notes,
        e.created_at
    FROM expense e
    JOIN category c        ON c.id = e.category_id
    JOIN category parent   ON parent.id = COALESCE(c.parent_id, c.id)
    LEFT JOIN payment_method pm ON pm.id = e.payment_method_id
    LEFT JOIN member m     ON m.id = e.for_member_id
    JOIN "user" u          ON u.id = e.logged_by_user_id
    WHERE e.household_id = :household_id
      AND e.date >= :date_from AND e.date <= :date_to
    ORDER BY e.date, e.created_at
""")


async def fetch_all(db: AsyncSession, query, **params):
    return (await db.execute(query, params)).all()


async def fetch_one(db: AsyncSession, query, **params):
    return (await db.execute(query, params)).one()
