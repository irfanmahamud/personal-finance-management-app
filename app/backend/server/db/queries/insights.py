"""Insight aggregates - hand-written SQL via text() (spec §4.2)."""

from sqlalchemy import text

WEEKDAY_TOTALS = text("""
    SELECT EXTRACT(DOW FROM date)::int AS weekday, SUM(amount_bdt) AS total
    FROM expense
    WHERE household_id = :household_id
      AND date >= :date_from AND date <= :date_to
    GROUP BY 1
""")

CATEGORY_TOTALS_BY_TAG = text("""
    SELECT parent.id AS category_id, parent.name_en, parent.name_bn, parent.icon,
           SUM(e.amount_bdt) AS spent
    FROM expense e
    JOIN category c ON c.id = e.category_id
    JOIN category parent ON parent.id = COALESCE(c.parent_id, c.id)
    WHERE e.household_id = :household_id
      AND e.date >= :date_from AND e.date <= :date_to
      AND parent.need_want_save = :tag
    GROUP BY parent.id, parent.name_en, parent.name_bn, parent.icon
    ORDER BY spent DESC
""")
