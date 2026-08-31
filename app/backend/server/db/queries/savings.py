"""Savings goal aggregates - hand-written SQL via text() (spec §3.7.2).

Deterministic forecasting reads the actual contribution history; no model.
"""

from sqlalchemy import text

MONTHLY_CONTRIBUTIONS = text("""
    SELECT
        date_trunc('month', date)::date AS month,
        SUM(amount) AS total
    FROM goal_contribution
    WHERE goal_id = :goal_id
    GROUP BY 1
    ORDER BY 1
""")
