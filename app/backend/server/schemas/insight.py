import uuid
from datetime import date

from pydantic import BaseModel


class InsightOut(BaseModel):
    """One deterministic insight (spec §4.2, rows 1-5 - "deterministic
    rules over SQL, not model output"). `type` selects which fields are
    populated; the frontend composes the bilingual message via i18n
    interpolation, same as every other numeric surface in this app -
    nothing here is pre-phrased server-side.
    """

    type: str  # overspend | pattern | anomaly | savings_opportunity | goal_projection
    severity: str  # info | warning

    # overspend
    category_id: uuid.UUID | None = None
    category_name_en: str | None = None
    category_name_bn: str | None = None
    pct: int | None = None
    days_left: int | None = None

    # pattern (day-of-week)
    weekday: int | None = None  # 0=Sunday .. 6=Saturday (Postgres EXTRACT(DOW))
    extra_pct: int | None = None

    # anomaly
    multiplier: float | None = None

    # savings_opportunity
    cut_amount: int | None = None  # poisha
    annual_savings: int | None = None  # poisha

    # goal_projection
    goal_id: uuid.UUID | None = None
    goal_name: str | None = None
    goal_name_bn: str | None = None
    months_remaining: int | None = None
    projected_completion_date: date | None = None
