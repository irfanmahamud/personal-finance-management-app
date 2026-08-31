"""Debt payment aggregates - hand-written SQL via text() (spec §3.9).

Payoff projection reads the actual payment history; no model.
"""

from sqlalchemy import text

MONTHLY_PAYMENTS = text("""
    SELECT
        date_trunc('month', date)::date AS month,
        SUM(amount) AS total
    FROM debt_payment
    WHERE debt_id = :debt_id
    GROUP BY 1
    ORDER BY 1
""")
