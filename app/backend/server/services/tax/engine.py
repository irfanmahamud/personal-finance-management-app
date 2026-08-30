"""Bangladesh income tax engine - pure functions over versioned config.

NOTHING tax-related is hardcoded here: slabs, thresholds, exemptions and
rebate rules all come from the tax_config row for the fiscal year (spec
§3.2.2). A future fiscal year is a data change, not a deploy.

Every figure the engine produces carries a line-by-line breakdown (which
slab, which exemption, which rebate) - that explainability is what makes
shipping an UNVERIFIED config safe: the user can check the arithmetic.

All amounts are integer poisha. Divisions round down (taxpayer-favourable
rounding is a policy question for the verified config pass).

Config shape (jsonb columns on tax_config):

  slabs: [{"up_to": <poisha|null>, "rate_bps": <int>}, ...]
      Ordered; null up_to = unbounded top slab. rate_bps: 500 = 5%.
  thresholds: {
      "zero_band": {"general": <poisha>, ...},   # optional per-category 0% band override
      "min_tax": <poisha>                         # optional minimum tax floor
  }
  rebate_rules: {
      "salary_exemption_share_bps": <int>,   # e.g. 3333 = one third
      "salary_exemption_cap": <poisha>,
      "rebate_rate_bps": <int>,              # rebate = rate * eligible investment
      "max_investment_share_bps": <int>,     # eligible inv <= share of taxable income
      "max_investment": <poisha>             # absolute cap (e.g. 10 lakh)
  }
"""

from dataclasses import dataclass, field


@dataclass
class BreakdownLine:
    label: str
    detail: str
    amount: int  # poisha


@dataclass
class TaxResult:
    gross_annual: int
    exemption: int
    taxable_annual: int
    slab_lines: list[BreakdownLine] = field(default_factory=list)
    gross_tax: int = 0
    rebate: int = 0
    min_tax_applied: bool = False
    net_tax_annual: int = 0
    monthly_tds: int = 0
    lines: list[BreakdownLine] = field(default_factory=list)


def salary_exemption(gross_annual: int, rules: dict) -> int:
    """Exempt portion of salary income (share of income, capped)."""
    share_bps = rules.get("salary_exemption_share_bps", 0)
    cap = rules.get("salary_exemption_cap", 0)
    if share_bps <= 0:
        return 0
    share = gross_annual * share_bps // 10_000
    return min(share, cap) if cap > 0 else share


def slab_tax(taxable: int, slabs: list[dict], zero_band_override: int | None = None) -> tuple[int, list[BreakdownLine]]:
    """Progressive tax over the slab table. Returns (tax, per-slab lines)."""
    lines: list[BreakdownLine] = []
    tax = 0
    lower = 0
    remaining = taxable
    for i, slab in enumerate(slabs):
        up_to = slab["up_to"]
        # An overridden 0% band (women / senior citizens / disability /
        # freedom fighters) widens the first slab.
        if i == 0 and zero_band_override is not None and up_to is not None:
            up_to = max(up_to, zero_band_override)
        width = None if up_to is None else up_to - lower
        in_slab = remaining if width is None else min(remaining, max(0, width))
        if in_slab <= 0:
            lower = up_to if up_to is not None else lower
            continue
        rate_bps = slab["rate_bps"]
        slab_amount = in_slab * rate_bps // 10_000
        tax += slab_amount
        lines.append(
            BreakdownLine(
                label=f"{rate_bps / 100:.0f}%",
                detail=(
                    f"৳{lower // 100:,} – "
                    + ("∞" if up_to is None else f"৳{up_to // 100:,}")
                ),
                amount=slab_amount,
            )
        )
        remaining -= in_slab
        lower = up_to if up_to is not None else lower
        if remaining <= 0:
            break
    return tax, lines


def investment_rebate(taxable: int, eligible_investment: int, rules: dict) -> int:
    """Rebate on eligible investments (DPS, life insurance, sanchayapatra...)."""
    rate_bps = rules.get("rebate_rate_bps", 0)
    if rate_bps <= 0 or eligible_investment <= 0:
        return 0
    share_bps = rules.get("max_investment_share_bps", 10_000)
    cap = rules.get("max_investment", 0)
    allowed = min(
        eligible_investment,
        taxable * share_bps // 10_000,
        cap if cap > 0 else eligible_investment,
    )
    return allowed * rate_bps // 10_000


def compute(
    gross_annual: int,
    slabs: list[dict],
    thresholds: dict,
    rebate_rules: dict,
    eligible_investment: int = 0,
    taxpayer_category: str = "general",
) -> TaxResult:
    exemption = salary_exemption(gross_annual, rebate_rules)
    taxable = max(0, gross_annual - exemption)

    zero_band = (thresholds.get("zero_band") or {}).get(taxpayer_category)
    gross_tax, slab_lines = slab_tax(taxable, slabs, zero_band)
    rebate = min(gross_tax, investment_rebate(taxable, eligible_investment, rebate_rules))
    net = gross_tax - rebate

    min_tax = thresholds.get("min_tax", 0) or 0
    min_applied = False
    if net > 0 and net < min_tax:
        net = min_tax
        min_applied = True

    result = TaxResult(
        gross_annual=gross_annual,
        exemption=exemption,
        taxable_annual=taxable,
        slab_lines=slab_lines,
        gross_tax=gross_tax,
        rebate=rebate,
        min_tax_applied=min_applied,
        net_tax_annual=net,
        monthly_tds=net // 12,
    )
    result.lines = [
        BreakdownLine("Gross annual income", "", gross_annual),
        BreakdownLine("Salary exemption", "exempt portion per rules", -exemption),
        BreakdownLine("Taxable income", "", taxable),
        *slab_lines,
        BreakdownLine("Gross tax", "sum of slabs", gross_tax),
        BreakdownLine("Investment rebate", "eligible investments", -rebate),
    ]
    if min_applied:
        result.lines.append(BreakdownLine("Minimum tax floor", "applied", min_tax))
    result.lines.append(BreakdownLine("Annual tax", "", net))
    result.lines.append(BreakdownLine("Monthly TDS", "annual / 12", result.monthly_tds))
    return result
